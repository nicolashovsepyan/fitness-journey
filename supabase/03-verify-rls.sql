-- ============================================================
-- THE NEGATIVE TEST. Run this THIRD, and read the output.
--
-- docs/BACKEND.md, step 3: "sign in as client A and confirm a read of client
-- the rows of client B and confirm nothing comes back. This is that test,
--
--   IF ANY LINE BELOW SAYS "FAIL", THE ANON KEY DOES NOT GO IN THE REPO.
--
-- It runs inside a transaction and ROLLS BACK at the end, so it leaves no
-- rows behind. Paste the whole file into the Supabase SQL editor and run it.
--
-- It proves the thing that actually matters: that a signed-in person cannot
-- read the medical answers of somebody else, not merely that the app does
-- ============================================================
begin;

-- Three people. Plain rows, no auth rows: this project will not let the
-- editor write to auth.users either, which is the same wall 01a hit. The test
-- does not need real logins. It fakes the signed-in id further down with
-- set_config, which is exactly what a real session does.
-- The trainer goes in FIRST. Client A points at them, and while Postgres does
-- check foreign keys at the end of a statement rather than row by row, there
-- is no reason to lean on that when the order is free.
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

-- ---- become Client A, an ordinary signed-in user ----
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select case when count(*) = 0
            then 'PASS  client A cannot read client B''s intake'
            else 'FAIL  client A READ ' || count(*) || ' OF CLIENT B''S INTAKES' end as test_1
from public.intakes where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select case when count(*) = 1
            then 'PASS  client A can read their own intake'
            else 'FAIL  client A cannot read their own intake' end as test_2
from public.intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select case when count(*) = 0
            then 'PASS  client A cannot see client B as a person'
            else 'FAIL  client A can see client B''s user row' end as test_3
from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- The blunt one: ask for everything and see what comes back.
select case when count(*) <= 1
            then 'PASS  a bare select on intakes returns only their own (' || count(*) || ')'
            else 'FAIL  a bare select on intakes returned ' || count(*) || ' rows' end as test_4
from public.intakes;

-- ---- become the Trainer, who owns client A but NOT client B ----
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

select case when count(*) = 1
            then 'PASS  trainer can read their own client''s intake'
            else 'FAIL  trainer cannot read their own client (' || count(*) || ')' end as test_5
from public.intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select case when count(*) = 0
            then 'PASS  trainer cannot read a client who is not theirs'
            else 'FAIL  TRAINER READ A CLIENT WHO IS NOT THEIRS' end as test_6
from public.intakes where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ---- become nobody: the anon key with no session ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select case when count(*) = 0
            then 'PASS  the anon key alone reads nothing'
            else 'FAIL  THE ANON KEY READ ' || count(*) || ' ROWS - DO NOT PUBLISH IT' end as test_7
from public.intakes;

select case when count(*) = 0
            then 'PASS  the anon key alone sees no people'
            else 'FAIL  THE ANON KEY READ ' || count(*) || ' USER ROWS' end as test_8
from public.users;

rollback;
