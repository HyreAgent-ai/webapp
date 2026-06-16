-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: consent_ledger table
-- ─────────────────────────────────────────────────────────────────────────────
-- Ported from monorepo Phase A artifact (supabase_migration_consent_ledger.sql,
-- shipped 2026-05-18) into the webapp repo as part of SP-013 / Gate 2.
--
-- Append-only audit log of GDPR Art. 7 consent grants and revocations. The
-- latest row per (user_id, purpose) is the authoritative state; older rows
-- are evidence trail. UPDATEs are forbidden by design — revocation = a new
-- row with revoked_at set and accepted_at = null.
--
-- Reference: docs/architecture/PHASE_A_DESIGN.md §1.8.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists consent_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  purpose       text not null,
  version       text not null,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  ip            inet,
  ua            text,
  created_at    timestamptz not null default now(),
  constraint consent_ledger_xor_check check (
    (accepted_at is not null and revoked_at is null) or
    (accepted_at is null     and revoked_at is not null)
  )
);

create index if not exists consent_ledger_user_purpose_idx
  on consent_ledger (user_id, purpose, created_at desc);

-- Allowed purposes — typos fail at write time. Extending is an ADR decision.
-- NB: contacts_csv_import is in the vocabulary but unused in friends-beta
-- per Decision #33 Path D (CSV import shelved).
alter table consent_ledger
  drop constraint if exists consent_ledger_purpose_allowed;
alter table consent_ledger
  add constraint consent_ledger_purpose_allowed check (
    purpose in (
      'data_storage',
      'beta_terms',
      'contacts_csv_import',
      'owner_linkedin_lia'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: user reads/writes own rows. No UPDATE / DELETE policies — append-only.
-- Account deletion cascades via the FK.
-- ─────────────────────────────────────────────────────────────────────────────
alter table consent_ledger enable row level security;

drop policy if exists "consent_ledger_user_owns_read"  on consent_ledger;
drop policy if exists "consent_ledger_user_owns_write" on consent_ledger;

create policy "consent_ledger_user_owns_read" on consent_ledger
  for select
  using ((select auth.uid()) = user_id);

create policy "consent_ledger_user_owns_write" on consent_ledger
  for insert
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- latest_consent_state — most recent row per (user, purpose). Used by the
-- SPA's onboarding gate and GET /v1/me/consent.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view latest_consent_state as
select distinct on (user_id, purpose)
  user_id,
  purpose,
  version,
  accepted_at,
  revoked_at,
  created_at,
  case
    when revoked_at is not null then 'revoked'
    when accepted_at is not null then 'granted'
  end as state
from consent_ledger
order by user_id, purpose, created_at desc;

grant select on latest_consent_state to authenticated;
