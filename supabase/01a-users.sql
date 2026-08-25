-- STEP 1a. The people table.
--
-- WHAT CHANGED, AND WHAT IT COSTS.
--
-- This said:  id uuid primary key references auth.users(id) on delete cascade
--
-- auth.users is Supabase's own login table, in a schema this project will not
-- let the editor reach across to. That is what "Backend error" meant, twice.
--
-- The link is gone. `id` is still the login id, it is simply no longer the
-- DATABASE enforcing that. The app sets it from the signed-in session.
--
-- WHAT THIS DOES NOT COST: security. Nothing in the locking step reads this
-- link. Every policy compares id against auth.uid(), which comes from the
-- signed-in session itself, not from any foreign key. The protection is
-- identical.
--
-- WHAT IT DOES COST: two housekeeping things the database used to do for
-- free. If a login is deleted, its row here is no longer swept up with it,
-- and a row could in principle be written with an id that has no login. Both
-- are tidiness, not exposure, and both belong to the app now.
create table if not exists public.users (
  id            uuid primary key,
  role          text not null default 'client',
  status        text not null default 'pending',
  display_name  text not null default '',
  email         text,
  ui            text not null default 'beginner',
  program_id    uuid,
  trainer_id    uuid,
  accent        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
