-- STEP 1a. The people table, on its own.
--
-- This is the riskiest statement in the whole set, which is why it is alone.
-- It points at auth.users, Supabase's own login table, and that is a link
-- across schemas that some projects will not allow from the editor.
--
-- If THIS is the one that errors, say so and I will drop the link. The app
-- works without it; it only means the database stops policing that every
-- person also has a login.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
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
