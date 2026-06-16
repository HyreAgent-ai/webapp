-- SP-022 (CODE-08): first-class user_companies table
-- Replaces JSON blob in settings(key='{userId}:custom_companies')

create table if not exists user_companies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  tier         int,
  h1b          text,
  itar         text,
  industry     text,
  roles        text,
  ats_platform text,
  domain       text,
  ats_board_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, name)
);

alter table user_companies enable row level security;

create policy "user_owns_companies"
  on user_companies
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_companies_user_id_idx on user_companies(user_id);
