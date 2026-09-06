-- Per-exercise "sets" config (1-7, default 3): moves the "x3" suffix that
-- users previously had to retype into every single logged workout value
-- ("100/8x3") into a one-time setting on the program-exercise slot itself.
-- Live data confirmed this never actually varies session-to-session for
-- the same program_exercise -- only weight/reps do.
alter table public.program_exercises
  add column sets smallint not null default 3
  check (sets between 1 and 7);

-- First-ever UPDATE policy on this table (previously insert-or-delete
-- only, by design). Needed so changing just the `sets` value on an
-- already-saved slot doesn't require deleting/recreating the row -- that
-- would orphan exercise_logs/training_history entries keyed by its id.
-- Mirrors the existing owner-based condition already used by this table's
-- INSERT/DELETE policies.
create policy "Allow update program_exercises"
on public.program_exercises for update
using (exists (
  select 1 from program_days d join programs p on p.id = d.program_id
  where d.id = program_exercises.day_id and p.user_id = auth.uid()
))
with check (exists (
  select 1 from program_days d join programs p on p.id = d.program_id
  where d.id = program_exercises.day_id and p.user_id = auth.uid()
));

-- Mirrors the existing trainer-editing-a-client's-program condition
-- already used by "Allow trainer delete/insert program_exercises for
-- client".
create policy "Allow trainer update program_exercises for client"
on public.program_exercises for update
using (exists (
  select 1 from program_days d
    join programs p on p.id = d.program_id
    join trainer_clients tc on tc.client_id = p.user_id
  where d.id = program_exercises.day_id and tc.trainer_id = auth.uid() and tc.status = 'accepted'
))
with check (exists (
  select 1 from program_days d
    join programs p on p.id = d.program_id
    join trainer_clients tc on tc.client_id = p.user_id
  where d.id = program_exercises.day_id and tc.trainer_id = auth.uid() and tc.status = 'accepted'
));
