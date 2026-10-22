-- A learner's saved progress: one row per account, holding the same snapshot the app keeps in
-- IndexedDB (stars, XP, streak, riddles, rematches). The app merges it with the device's copy, so
-- the row is only a backup that travels between devices. `rev` goes up on every write, so two
-- devices saving at once can't overwrite each other: an update only applies to the rev it read.

create table public.progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 262144),
  rev integer not null default 1 check (rev > 0),
  updated_at timestamptz not null default now()
);

comment on table public.progress is 'Each learner''s progress snapshot, merged with the copy on their devices.';

create function public.touch_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger progress_touch
before update on public.progress
for each row execute function public.touch_progress();

alter table public.progress enable row level security;

-- Tables are not exposed to the Data API automatically: only signed-in learners get access,
-- and the policies below limit them to their own row.
revoke all on table public.progress from anon, authenticated;
grant select, insert, update, delete on table public.progress to authenticated;

create policy "Learners read their own progress"
on public.progress for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Learners save their own progress"
on public.progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Learners update their own progress"
on public.progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Learners delete their own progress"
on public.progress for delete
to authenticated
using ((select auth.uid()) = user_id);
