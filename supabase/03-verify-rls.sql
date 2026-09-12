-- ============================================================
-- THE NEGATIVE TEST. Run this THIRD, and read the output.
--
--   IF ANY LINE BELOW SAYS "FAIL", THE KEY DOES NOT GO IN THE REPO.
--
-- It proves the thing that actually matters: that a signed-in person
-- cannot read the medical answers of somebody else, not merely that the
-- app does not ask for them.
--
-- WHY THIS IS IN THREE PARTS NOW.
--
-- It used to be one script with eleven separate selects, and it looked
-- fine. The Supabase SQL editor shows only the LAST result set, so it
-- printed one line out of eleven, and the ten it swallowed included
-- every one that a client cannot read another client. A gate that hides
-- ten of its twelve answers is not a gate.
--
-- The role has to change between the parts and a union cannot span that,
-- so each part sets itself up, becomes one person, asks everything that
-- person should be asked, and rolls back. Run them in order. Each is a
-- separate paste, and each leaves nothing behind.
--
-- TWELVE LINES ACROSS THREE RUNS. EVERY ONE MUST SAY PASS.
-- ============================================================


-- ============================================================
-- PART 1 of 3 — an ordinary client. Expect 6 rows, all PASS.
-- ============================================================
begin;

-- Three people. Plain rows, no auth rows: this project will not let the
-- editor write to auth.users either, which is the same wall 01a hit. The
-- test does not need real logins. It fakes the signed-in id with
-- set_config, which is exactly what a real session does.
-- The trainer goes in FIRST, because client A points at them.
insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);

insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

-- Client B has answered a PAR-Q. This is the row nobody else may see.
insert into public.intakes (user_id, answers) values
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '{"parq":["heart condition"],"pain":["left knee"],"name":"Client B"}'::jsonb);

insert into public.intakes (user_id, answers) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"name":"Client A"}'::jsonb);

-- And both of them have a per-user document: settings, streak, schedule.
insert into public.user_state (user_id, state) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"streak":9,"sound":false}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"streak":2,"sound":true}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select 1 as n, case when count(*) = 0
     then 'PASS  client A cannot read client B intake'
     else 'FAIL  client A READ ' || count(*) || ' OF CLIENT B INTAKES' end as result
from public.intakes where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
select 2, case when count(*) = 1
     then 'PASS  client A can read their own intake'
     else 'FAIL  client A cannot read their own intake' end
from public.intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
union all
select 3, case when count(*) = 0
     then 'PASS  client A cannot see client B as a person'
     else 'FAIL  client A can see client B user row' end
from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
-- The blunt one: ask for everything and see what comes back.
select 4, case when count(*) <= 1
     then 'PASS  a bare select on intakes returns only their own (' || count(*) || ')'
     else 'FAIL  a bare select on intakes returned ' || count(*) || ' rows' end
from public.intakes
union all
select 5, case when count(*) = 0
     then 'PASS  client A cannot read client B per-user document'
     else 'FAIL  CLIENT A READ CLIENT B USER STATE' end
from public.user_state where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
select 6, case when count(*) = 1
     then 'PASS  client A can read their own per-user document'
     else 'FAIL  client A cannot read their own user state' end
from public.user_state where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
order by n;

rollback;


-- ============================================================
-- PART 2 of 3 — the coach, who owns client A but NOT client B.
-- Expect 3 rows, all PASS.
-- ============================================================
begin;

insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);

insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

insert into public.intakes (user_id, answers) values
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '{"parq":["heart condition"],"pain":["left knee"],"name":"Client B"}'::jsonb);

insert into public.intakes (user_id, answers) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"name":"Client A"}'::jsonb);

insert into public.user_state (user_id, state) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '{"streak":2,"sound":true}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

select 7 as n, case when count(*) = 1
     then 'PASS  trainer can read their own client intake'
     else 'FAIL  trainer cannot read their own client (' || count(*) || ')' end as result
from public.intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
union all
select 8, case when count(*) = 0
     then 'PASS  trainer cannot read a client who is not theirs'
     else 'FAIL  TRAINER READ A CLIENT WHO IS NOT THEIRS' end
from public.intakes where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
-- The shut door, on purpose. A coach reads the logs, which is the record
-- of what happened. The per-user document is how the app feels to the
-- person using it, and no coaching question needs it.
select 9, case when count(*) = 0
     then 'PASS  trainer cannot read even their own client per-user document'
     else 'FAIL  trainer read a client per-user document' end
from public.user_state where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
order by n;

rollback;


-- ============================================================
-- PART 3 of 3 — nobody at all: the published key with no session.
-- This is the one that decides whether the key may be committed.
-- Expect 3 rows, all PASS.
-- ============================================================
begin;

insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);

insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

insert into public.intakes (user_id, answers) values
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '{"parq":["heart condition"],"pain":["left knee"],"name":"Client B"}'::jsonb);

insert into public.user_state (user_id, state) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '{"streak":9,"sound":false}'::jsonb);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select 10 as n, case when count(*) = 0
     then 'PASS  the published key alone reads nothing'
     else 'FAIL  THE KEY READ ' || count(*) || ' ROWS - DO NOT PUBLISH IT' end as result
from public.intakes
union all
select 11, case when count(*) = 0
     then 'PASS  the published key alone sees no people'
     else 'FAIL  THE KEY READ ' || count(*) || ' USER ROWS' end
from public.users
union all
select 12, case when count(*) = 0
     then 'PASS  the published key alone reads no per-user documents'
     else 'FAIL  THE KEY READ ' || count(*) || ' USER STATE ROWS' end
from public.user_state
order by n;

rollback;
