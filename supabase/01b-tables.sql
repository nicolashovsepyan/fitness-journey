-- STEP 1b. The other six tables. No links to the Supabase login table here,
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
