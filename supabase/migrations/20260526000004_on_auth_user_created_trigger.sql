-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: on_auth_user_created trigger — atomic consent_ledger writes
-- ─────────────────────────────────────────────────────────────────────────────
-- SP-013 / Gate 2 EC2 = Option A.
--
-- When a new row is INSERTed into auth.users, this trigger reads consent
-- payload from raw_user_meta_data (set by signUpWithConsent() in src/lib/auth.js)
-- and writes the corresponding consent_ledger rows in the same transaction.
--
-- If consent metadata is missing or malformed, the trigger RAISEs — the
-- signup transaction is rolled back, and no auth.users row is created.
-- This is "fail closed": a user can never exist in auth.users without their
-- baseline consent rows in consent_ledger.
--
-- The trigger is SECURITY DEFINER (runs as table owner) with an explicit
-- empty search_path to avoid mutable-search-path attacks.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data_storage  text;
  v_beta_terms    text;
  v_version       text;
begin
  -- Read the consent payload set by signUpWithConsent(email, password, payload).
  -- supabase-js stores user_metadata under raw_user_meta_data on the row.
  v_data_storage := new.raw_user_meta_data ->> 'consent_data_storage';
  v_beta_terms   := new.raw_user_meta_data ->> 'consent_beta_terms';
  v_version      := coalesce(new.raw_user_meta_data ->> 'consent_version', '2026-05-25');

  -- Fail closed: both baseline grants must be present and truthy.
  if v_data_storage is null or v_data_storage <> 'granted' then
    raise exception 'consent_data_storage missing or not granted — signup blocked';
  end if;
  if v_beta_terms is null or v_beta_terms <> 'granted' then
    raise exception 'consent_beta_terms missing or not granted — signup blocked';
  end if;

  -- Atomic with the auth.users INSERT — both rows commit together or neither.
  insert into public.consent_ledger (user_id, purpose, version, accepted_at)
  values
    (new.id, 'data_storage', v_version, now()),
    (new.id, 'beta_terms',   v_version, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_consent on auth.users;

create trigger on_auth_user_created_consent
  after insert on auth.users
  for each row
  execute function public.on_auth_user_created();
