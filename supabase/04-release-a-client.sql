-- ============================================================
-- STEP 4. A coach can let a client go.
--
-- WHAT WAS WRONG, AND IT WAS NOT OBVIOUS.
--
-- users_update_own_clients read:
--
--   using (trainer_id = auth.uid()) with check (trainer_id = auth.uid())
--
-- The USING half says which rows you may touch: the ones already yours.
-- That is right. The WITH CHECK half says what the row is allowed to
-- look like AFTERWARDS, and it said the client must still be yours.
--
-- So a coach could change anything about their client except the one
-- thing that ends the relationship. Releasing somebody was refused with
-- "new row violates row-level security policy", which reads like a bug
-- in the app and was in fact the policy doing exactly what it said.
--
-- WHY IT MATTERS MORE THAN IT SOUNDS. There is no delete policy on
-- public.users, on purpose: every foreign key cascades from a person, so
-- deleting one would take their intakes, logs, records and settings with
-- them, and js/core/storage.js is explicit that removing a PERSON is not
-- removing their training. Unassigning is how a coach removes somebody
-- without destroying what they did. With it refused, there was no way at
-- all to drop a client, and no error that said so.
--
-- WHAT THIS ALLOWS, EXACTLY: a coach may set the trainer_id of
-- their own client to null. The USING half is untouched, so it is still only
-- ever a row that was already theirs, and null is the only new value
-- besides themselves. Nobody gains the ability to take a client, because
-- claiming one would need a row that was not yours to begin with.
--
-- Safe to run more than once.
-- ============================================================

drop policy if exists users_update_own_clients on public.users;

create policy users_update_own_clients on public.users
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid() or trainer_id is null);


-- ============================================================
-- THE PROOF. Expect 4 rows, all PASS. Runs and rolls back.
-- ============================================================
begin;

insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);

insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

insert into public.intakes (user_id, answers) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"name":"Client A"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

-- 1. the release itself
update public.users set trainer_id = null
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 2. and the theft that must not work: client B was never theirs
update public.users set trainer_id = 'cccccccc-0000-0000-0000-000000000003'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select 1 as n, case when count(*) = 0
     then 'PASS  a released client is no longer visible to that coach'
     else 'FAIL  the release did not take' end as result
from public.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'
union all
select 2, case when count(*) = 0
     then 'PASS  and neither is their intake'
     else 'FAIL  the coach can still read a released client intake' end
from public.intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
union all
select 3, case when count(*) = 0
     then 'PASS  a coach cannot help themselves to somebody elses client'
     else 'FAIL  A COACH CLAIMED A CLIENT WHO WAS NOT THEIRS' end
from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
-- The client keeps everything. Becoming unassigned is not being deleted.
select 4, case when count(*) = 1
     then 'PASS  the released client still has their own intake'
     else 'FAIL  releasing a client destroyed their intake' end
from (select set_config('request.jwt.claims',
        '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true)) sw,
     public.intakes
where intakes.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
order by n;

rollback;
