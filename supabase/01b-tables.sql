-- STEP 1b. The other seven tables. No links to the Supabase login table here,
-- so if 1a failed and this one passes, we have found it exactly.
create table if not exists public.intakes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  version       int  not null default 6,
  answers       jsonb not null default '{}'::jsonb,
  derived       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,
  assigned_to   uuid,
  name          text not null default 'Untitled program',
  status        text not null default 'draft',
  days          jsonb not null default '[]'::jsonb,
  profile       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null,
  name          text not null default '',
  pattern       text,
  blocks        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  session_id    uuid,
  -- What they called it on the day. LogEntry.name in js/core/schema.js has
  -- always carried this and there was no column for it, so every logged
  -- workout would have synced up as an untitled one.
  name          text not null default '',
  performed_on  date not null default current_date,
  blocks        jsonb not null default '[]'::jsonb,
  duration_sec  int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.prs (
  user_id       uuid not null,
  ex_id         text not null,
  value         numeric,
  unit          text,
  weight        numeric,
  -- Per-side records. The contract spells the PR bag as
  -- { value, unit, date, weight?, l?, r? } and single-limb work fills l and
  -- r rather than value. Without these two columns a pistol squat record
  -- would sync as a record of nothing.
  l             numeric,
  r             numeric,
  achieved_on   date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, ex_id)
);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null,
  to_user_id    uuid not null,
  body          text not null default '',
  context_type  text,
  context_id    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The per-user document. js/core/storage.js explains why this is one row and
-- not fifteen tables: settings, streaks, the schedule, the swaps a person has
-- made. Nobody queries across them. They are read and written whole.
--
-- What does NOT belong in here is logs and prs. They are above, in real
-- tables with real columns, because they are the irreplaceable data and a
-- coach needs to ask questions of them per person and per date. The contract
-- keeps them as separate methods for exactly this reason.
--
-- One row per person, so user_id is the key and there is no id column.
create table if not exists public.user_state (
  user_id       uuid primary key,
  state         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
