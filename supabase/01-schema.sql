-- ============================================================
-- FITNESS JOURNEY - the database, one table per record type.
--
-- Turns the sketch in docs/BACKEND.md into something runnable. One table for
-- each make*() in js/core/schema.js and nothing invented beyond them.
--
-- RUN THIS FIRST, then 02-rls.sql, then 03-verify-rls.sql. Do not merge the
-- steps: the whole point of the order is that the tables exist with no access
-- at all before any policy opens a door.
--
-- DOCUMENTS STAY DOCUMENTS. answers, derived, days, profile and blocks are
-- jsonb. They are documents and the app already treats them that way. Making
-- them relational would buy query power nobody needs and cost the ability to
-- store a log exactly as it was performed.
--
-- ABSENT ON PURPOSE: run state and device preferences. A workout in progress
-- belongs to the phone in your hand, and the voice on an iPhone is not the one
-- on a laptop. Syncing either is a bug, not a feature.
-- ============================================================

-- gen_random_uuid() is built in on the Postgres version Supabase runs. This
-- line is here so the file also works on an older one, and costs nothing.
create extension if not exists pgcrypto;

-- ---------- who ----------
-- The id IS the Supabase auth id. That is the join that makes every policy
-- below a one-line comparison instead of a lookup.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'client' check (role in ('trainer','client')),
  status        text not null default 'pending' check (status in ('pending','active','archived')),
  display_name  text not null default '',
  email         text,
  ui            text not null default 'beginner' check (ui in ('pro','beginner')),
  program_id    uuid,
  trainer_id    uuid references public.users(id) on delete set null,
  accent        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists users_trainer_idx on public.users(trainer_id);

-- ---------- what they said ----------
-- HEALTH DATA LIVES HERE. answers.parq is a medical screening and answers.pain
-- is a body map of injuries. This table is the reason RLS is not optional.
create table if not exists public.intakes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  version       int  not null default 6,
  answers       jsonb not null default '{}'::jsonb,
  derived       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists intakes_user_idx on public.intakes(user_id, submitted_at desc);

-- ---------- what the coach wrote ----------
create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references public.users(id) on delete set null,   -- the trainer
  assigned_to   uuid references public.users(id) on delete cascade,    -- the client
  name          text not null default 'Untitled program',
  status        text not null default 'draft' check (status in ('draft','assigned','archived')),
  days          jsonb not null default '[]'::jsonb,
  profile       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists programs_assigned_idx on public.programs(assigned_to);

create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  name          text not null default '',
  pattern       text,
  blocks        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sessions_program_idx on public.sessions(program_id);

-- ---------- what they actually did ----------
create table if not exists public.logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  session_id    uuid,
  date          date not null default current_date,
  blocks        jsonb not null default '[]'::jsonb,
  duration_sec  int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists logs_user_idx on public.logs(user_id, date desc);

create table if not exists public.prs (
  user_id       uuid not null references public.users(id) on delete cascade,
  ex_id         text not null,
  value         numeric,
  unit          text,
  weight        numeric,
  date          date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, ex_id)
);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references public.users(id) on delete cascade,
  to_user_id    uuid not null references public.users(id) on delete cascade,
  body          text not null default '',
  context_type  text,
  context_id    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists messages_pair_idx on public.messages(to_user_id, from_user_id, created_at desc);

-- ---------- every record is stamped, and stays stamped ----------
-- WRITTEN OUT LONGHAND ON PURPOSE.
-- This was an anonymous DO block calling format() with a positional
-- argument. That is valid Postgres, but the Supabase SQL editor splits
-- statements itself before the database sees them, and it cannot tell
-- where a dollar-quoted block ends when there is a dollar sign inside
-- it. It returned "Backend error! Retry your query", which sounds like
-- their problem and was ours.
--
-- Seven repeated statements are duller and they run everywhere. If you add a
-- table later, copy one of these blocks for it.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $touch$
begin
  new.updated_at = now();
  return new;
end;
$touch$;

drop trigger if exists touch_users on public.users;
create trigger touch_users before update on public.users
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_intakes on public.intakes;
create trigger touch_intakes before update on public.intakes
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_programs on public.programs;
create trigger touch_programs before update on public.programs
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_sessions on public.sessions;
create trigger touch_sessions before update on public.sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_logs on public.logs;
create trigger touch_logs before update on public.logs
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_prs on public.prs;
create trigger touch_prs before update on public.prs
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_messages on public.messages;
create trigger touch_messages before update on public.messages
  for each row execute function public.touch_updated_at();
