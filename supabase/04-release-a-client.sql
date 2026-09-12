-- ============================================================
-- STEP 4. A coach can let a client go.
--
-- AND THE THING THIS TAUGHT, WHICH IS WORTH MORE THAN THE POLICY.
--
-- users_update_own_clients read:
--
--   using (trainer_id = auth.uid()) with check (trainer_id = auth.uid())
--
-- The USING half says which rows you may touch: the ones already yours.
-- The WITH CHECK half says what the row may look like AFTERWARDS, and it
-- said the client must still be yours. So a coach could change anything
-- about a client except the one thing that ends the relationship.
--
-- Widening the check to allow null, which is what this file does, is
-- correct and IT IS NOT ENOUGH. The update is still refused, with 42501
-- "new row violates row-level security policy" - an error that names no
-- policy and reads exactly like the wrong one being in force.
--
-- THE REAL RULE: these tables have FORCE ROW LEVEL SECURITY, and under
-- it Postgres applies the SELECT policies to the NEW row as well. You
-- may not update a row into a state where you can no longer see it. A
-- coach sees a client through trainer_id, so the instant it goes null
-- the row leaves their view and the write is rejected.
--
-- It was found by adding, inside a transaction that rolled back, a
-- select policy that made unassigned rows visible. The same update then
-- succeeded immediately.
--
-- WHY THAT IS NOT THE FIX. A select policy for unassigned people means
-- every signed-in person can read every unclaimed person: a list of
-- names and emails belonging to strangers. The hole is worse than the
-- feature.
--
-- SO WHAT THE APP DOES INSTEAD: it archives. status becomes archived,
-- the row stays exactly as visible to the coach as it was, which is what
-- keeps the write legal, and the console stops listing them. The client
-- keeps everything, their coach included, which is the truth anyway -
-- being archived is not the same as never having been trained. See
-- SupabaseAdapter.removeUser.
--
-- This policy stays because it is correct and costs nothing: a coach may
-- set the trainer_id of their own client to null. The USING half is
-- untouched, so it is still only ever a row that was already theirs, and
-- nobody gains the ability to take a client.
--
-- Safe to run more than once.
-- ============================================================

drop policy if exists users_update_own_clients on public.users;

create policy users_update_own_clients on public.users
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid() or trainer_id is null);


-- ============================================================
-- THE PROOF, and it proves the rule rather than the wish.
-- Expect 3 rows, all PASS. Runs and rolls back.
-- ============================================================
begin;

insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);

insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

-- 1. What the app actually does: archive. The row stays visible, so the
--    write is legal, and the console filters archived out in listUsers.
update public.users set status = 'archived'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 2. The theft that must not work: client B was never theirs.
update public.users set trainer_id = 'cccccccc-0000-0000-0000-000000000003'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select 1 as n, case when count(*) = 1
     then 'PASS  archiving a client is allowed and the row stays visible'
     else 'FAIL  archiving did not take' end as result
from public.users
where id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'archived'
union all
select 2, case when count(*) = 0
     then 'PASS  a coach cannot help themselves to somebody elses client'
     else 'FAIL  A COACH CLAIMED A CLIENT WHO WAS NOT THEIRS' end
from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
-- 3. The rule itself, stated as a test so it cannot be forgotten.
select 3, case when count(*) = 1
     then 'PASS  an archived client is still theirs, not deleted'
     else 'FAIL  archiving detached or destroyed the client' end
from public.users
where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  and trainer_id = 'cccccccc-0000-0000-0000-000000000003'
order by n;

rollback;
