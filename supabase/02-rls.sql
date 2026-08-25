-- ============================================================
-- ROW LEVEL SECURITY. Run this SECOND, immediately after 01-schema.sql.
--
-- WHY THIS IS THE WHOLE JOB, not a formality.
--
-- The repo is public. The anon key ships inside a public web page and anybody
-- can read it. That is fine, and ONLY fine, because the key by itself opens
-- nothing: every table below denies by default and only these policies open a
-- door, one signed-in person at a time.
--
-- With RLS off, publishing that key exposes every PAR-Q answer and every
-- injury map in the database to anyone who views source. So:
--
--   NO KEY GOES NEAR THE REPO UNTIL 03-verify-rls.sql PASSES.
--
-- HOW POSTGRES BEHAVES, and why "no policy" is the safe state: enabling RLS
-- with no policy on a table means no rows are visible to anyone except the
-- table owner and the service role. Deny is the default; every line below is
-- a deliberate exception.
-- ============================================================

alter table public.users    enable row level security;
alter table public.intakes  enable row level security;
alter table public.programs enable row level security;
alter table public.sessions enable row level security;
alter table public.logs     enable row level security;
alter table public.prs      enable row level security;
alter table public.messages enable row level security;

-- Force it even for the table owner, so a mistake in a migration cannot
-- quietly bypass the policies.
alter table public.users    force row level security;
alter table public.intakes  force row level security;
alter table public.programs force row level security;
alter table public.sessions force row level security;
alter table public.logs     force row level security;
alter table public.prs      force row level security;
alter table public.messages force row level security;

-- ---------------------------------------------------------------
-- "Is this client mine?"
--
-- SECURITY DEFINER on purpose, and this is the subtle part. A policy on
-- public.users that itself queries public.users would re-enter RLS and
-- recurse. Running as the definer steps outside RLS for this one lookup.
-- It is safe because it answers exactly one yes/no question about the
-- CALLER and cannot be asked anything else.
-- ---------------------------------------------------------------
create or replace function public.is_my_client(client uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users u
    where u.id = client and u.trainer_id = auth.uid()
  );
$$;
revoke all on function public.is_my_client(uuid) from public;
grant execute on function public.is_my_client(uuid) to authenticated;

-- ---------------- users ----------------
create policy users_read_self on public.users
  for select using (id = auth.uid());
create policy users_read_own_clients on public.users
  for select using (trainer_id = auth.uid());
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
-- A trainer sets status and program, which is the release. Nothing else here
-- lets one person write another person's row.
create policy users_update_own_clients on public.users
  for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
-- Signing up creates your own row and only your own.
create policy users_insert_self on public.users
  for insert with check (id = auth.uid());

-- ---------------- intakes : the health data ----------------
create policy intakes_read_own on public.intakes
  for select using (user_id = auth.uid());
create policy intakes_read_by_trainer on public.intakes
  for select using (public.is_my_client(user_id));
create policy intakes_insert_own on public.intakes
  for insert with check (user_id = auth.uid());
-- Deliberately NO update and NO delete. schema.js: "the record of what
-- somebody actually said has to stay true". A correction is a new intake.

-- ---------------- programs ----------------
create policy programs_read_assigned on public.programs
  for select using (assigned_to = auth.uid());
create policy programs_read_own on public.programs
  for select using (owner_id = auth.uid());
create policy programs_write_own on public.programs
  for insert with check (owner_id = auth.uid());
create policy programs_update_own on public.programs
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------- sessions : reachable only through their program ----------------
create policy sessions_read on public.sessions
  for select using (exists (
    select 1 from public.programs p where p.id = program_id
      and (p.assigned_to = auth.uid() or p.owner_id = auth.uid())));
create policy sessions_write_by_owner on public.sessions
  for all using (exists (
    select 1 from public.programs p where p.id = program_id and p.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.programs p where p.id = program_id and p.owner_id = auth.uid()));

-- ---------------- logs and prs : what they did ----------------
create policy logs_read_own on public.logs
  for select using (user_id = auth.uid());
create policy logs_read_by_trainer on public.logs
  for select using (public.is_my_client(user_id));
create policy logs_insert_own on public.logs
  for insert with check (user_id = auth.uid());
create policy logs_update_own on public.logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy prs_read_own on public.prs
  for select using (user_id = auth.uid());
create policy prs_read_by_trainer on public.prs
  for select using (public.is_my_client(user_id));
create policy prs_write_own on public.prs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- messages : both parties, nobody else ----------------
create policy messages_read_either on public.messages
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy messages_send_as_self on public.messages
  for insert with check (from_user_id = auth.uid());
-- Marking read is the only update, and only by the recipient.
create policy messages_mark_read on public.messages
  for update using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());
