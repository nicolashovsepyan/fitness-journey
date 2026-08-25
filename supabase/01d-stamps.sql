-- STEP 1d. Keeps "last updated" true on every row.
-- This is the part that broke twice. It is now one plain function and seven
-- plain triggers, with a named delimiter, and no dollar pair anywhere else in
-- the file including the comments.
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
