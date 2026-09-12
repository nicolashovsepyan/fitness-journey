-- ============================================================
-- STEP 5. The phones we are allowed to reach.
--
-- WHAT A SUBSCRIPTION IS. When somebody allows notifications, their
-- browser hands back three things: an endpoint URL at Apple or Google,
-- and two keys that the message has to be encrypted with. Without all
-- three, nothing can be delivered. With them, anybody can deliver.
--
-- So this table is worth reading carefully. It is not sensitive the way
-- a PAR-Q is, but a row here is permission to make somebody phone buzz.
--
-- ONE PERSON CAN HAVE SEVERAL. A phone, a tablet, a laptop. Each gets
-- its own row, and the endpoint is what tells them apart, which is why
-- the endpoint is the key rather than the person.
--
-- WHY THE POLICIES LOOK LIKE THIS:
--
--   You may write, read and delete your own. That is the whole of what
--   a client needs: subscribe on this phone, unsubscribe on this phone.
--
--   NOBODY may read anybody elses, not even their coach. A coach does
--   not need to see the endpoints to send to them, because the sending
--   happens in an Edge Function running as the service role, above
--   these policies. Opening this to a coach would buy nothing and hand
--   out the ability to message somebody phone directly.
--
-- Safe to run more than once.
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint      text primary key,
  user_id       uuid not null,
  p256dh        text not null,
  auth          text not null,
  -- What kind of thing this is, so a stale iPhone row can be told from
  -- a laptop when one of them stops accepting deliveries.
  agent         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_user_fk') then
    alter table public.push_subscriptions add constraint push_user_fk
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end
$fk$;

create index if not exists push_user_idx on public.push_subscriptions(user_id);

drop trigger if exists touch_push on public.push_subscriptions;
create trigger touch_push before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists push_read_own on public.push_subscriptions;
create policy push_read_own on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists push_write_own on public.push_subscriptions;
create policy push_write_own on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists push_update_own on public.push_subscriptions;
create policy push_update_own on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete using (user_id = auth.uid());


-- ---- what somebody has been told, and whether they have seen it ----
-- The badge on the app icon is a count, and a count needs a table. This
-- is also what makes a notification survive a phone being off: it is
-- read on next open, whether or not the push ever arrived.
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  title         text not null default '',
  body          text not null default '',
  -- Where tapping it should land them.
  url           text,
  kind          text not null default 'message',
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $fk2$
begin
  if not exists (select 1 from pg_constraint where conname = 'notif_user_fk') then
    alter table public.notifications add constraint notif_user_fk
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end
$fk2$;

create index if not exists notif_user_idx on public.notifications(user_id, created_at desc);

drop trigger if exists touch_notif on public.notifications;
create trigger touch_notif before update on public.notifications
  for each row execute function public.touch_updated_at();

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists notif_read_own on public.notifications;
create policy notif_read_own on public.notifications
  for select using (user_id = auth.uid());

-- Marking one read is the only thing a person does to it. They do not
-- get to write their own notifications: those come from a coach, through
-- the Edge Function, which runs above these policies.
--
-- AND THE UPDATE HAS TO LEAVE IT VISIBLE. These tables are FORCE ROW
-- LEVEL SECURITY, so Postgres applies the select policy to the NEW row
-- as well: an update that moved a row out of your own view would be
-- refused. Marking read does not change user_id, so it stays legal.
-- See the note in 04-release-a-client.sql, where that rule cost a day.
drop policy if exists notif_mark_read on public.notifications;
create policy notif_mark_read on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_read_by_trainer on public.notifications;
create policy notif_read_by_trainer on public.notifications
  for select using (public.is_my_client(user_id));


-- ============================================================
-- THE PROOF. Expect 4 rows, all PASS. Runs and rolls back.
-- ============================================================
begin;

insert into public.users (id, role, display_name, trainer_id) values
  ('cccccccc-0000-0000-0000-000000000003','trainer','Trainer',  null);
insert into public.users (id, role, display_name, trainer_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','client', 'Client A','cccccccc-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000002','client', 'Client B', null);

insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example/A','aaaaaaaa-0000-0000-0000-000000000001','k','a'),
  ('https://push.example/B','bbbbbbbb-0000-0000-0000-000000000002','k','a');

insert into public.notifications (user_id, title, body) values
  ('bbbbbbbb-0000-0000-0000-000000000002','B only','nobody else may read this');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select 1 as n, case when count(*) = 1
     then 'PASS  a person can read their own push subscription'
     else 'FAIL  a person cannot read their own push subscription' end as result
from public.push_subscriptions
union all
select 2, case when count(*) = 0
     then 'PASS  and nobody elses, which is permission to buzz a phone'
     else 'FAIL  SOMEBODY READ ANOTHER PERSON PUSH SUBSCRIPTION' end
from public.push_subscriptions where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
select 3, case when count(*) = 0
     then 'PASS  a client cannot read another client notifications'
     else 'FAIL  A CLIENT READ ANOTHER CLIENT NOTIFICATIONS' end
from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
union all
-- The coach may see what their own client was told, because that is a
-- conversation they are half of. Client B is not theirs.
select 4, case when count(*) = 0
     then 'PASS  even a coach cannot read a push subscription'
     else 'FAIL  a coach read a push subscription' end
from (select set_config('request.jwt.claims',
        '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true)) sw,
     public.push_subscriptions
order by n;

rollback;
