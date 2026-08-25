-- STEP 1c. The links between the tables, and the indexes.
-- Split out because a foreign key is where a table creation usually trips,
-- and this way one failure does not cost you the other six tables.
alter table public.users    add constraint users_trainer_fk
  foreign key (trainer_id) references public.users(id) on delete set null;
alter table public.intakes  add constraint intakes_user_fk
  foreign key (user_id) references public.users(id) on delete cascade;
alter table public.programs add constraint programs_owner_fk
  foreign key (owner_id) references public.users(id) on delete set null;
alter table public.programs add constraint programs_assigned_fk
  foreign key (assigned_to) references public.users(id) on delete cascade;
alter table public.sessions add constraint sessions_program_fk
  foreign key (program_id) references public.programs(id) on delete cascade;
alter table public.logs     add constraint logs_user_fk
  foreign key (user_id) references public.users(id) on delete cascade;
alter table public.prs      add constraint prs_user_fk
  foreign key (user_id) references public.users(id) on delete cascade;
alter table public.messages add constraint messages_from_fk
  foreign key (from_user_id) references public.users(id) on delete cascade;
alter table public.messages add constraint messages_to_fk
  foreign key (to_user_id) references public.users(id) on delete cascade;

create index if not exists users_trainer_idx    on public.users(trainer_id);
create index if not exists intakes_user_idx     on public.intakes(user_id, submitted_at desc);
create index if not exists programs_assigned_idx on public.programs(assigned_to);
create index if not exists sessions_program_idx on public.sessions(program_id);
create index if not exists logs_user_idx        on public.logs(user_id, performed_on desc);
create index if not exists messages_pair_idx    on public.messages(to_user_id, from_user_id, created_at desc);
