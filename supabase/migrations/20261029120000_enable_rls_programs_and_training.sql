-- RLS for `programs`, `training_history`, `exercise_logs`, `exercise_drafts`
-- (Sprint 125). All four were created before this repo tracked migrations
-- and had row level security switched off entirely, so anyone holding the
-- public anon key could read, change or delete any user's programs and
-- workouts directly, whatever the apps' UI allowed.
--
-- Reads stay as open as the apps already rely on: programs, completed
-- workouts and exercise logs are public (Home feed, Records, profile Wall,
-- viewing someone else's program). Drafts are private to the owner and
-- their trainer.
--
-- Writes: the row's own user, or that user's accepted trainer. A trainer
-- may log workouts into a client's program (saved under the client's
-- user_id) and edit its structure -- which also deletes the client's
-- history/logs/drafts for removed days -- but never create or delete the
-- client's programs. Same trainer join as the existing program_days /
-- program_exercises policies.

-- programs ------------------------------------------------------------------

alter table public.programs enable row level security;

create policy "Allow read programs"
  on public.programs for select
  using (true);

create policy "Allow creating own programs"
  on public.programs for insert
  with check (user_id = auth.uid());

create policy "Allow owner or trainer updating programs"
  on public.programs for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = programs.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = programs.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );

create policy "Allow deleting own programs"
  on public.programs for delete
  using (user_id = auth.uid());

-- training_history ------------------------------------------------------------

alter table public.training_history enable row level security;

create policy "Allow read training history"
  on public.training_history for select
  using (true);

create policy "Allow owner or trainer writing training history"
  on public.training_history for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = training_history.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = training_history.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );

-- exercise_logs ---------------------------------------------------------------

alter table public.exercise_logs enable row level security;

create policy "Allow read exercise logs"
  on public.exercise_logs for select
  using (true);

create policy "Allow owner or trainer writing exercise logs"
  on public.exercise_logs for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = exercise_logs.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = exercise_logs.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );

-- exercise_drafts (private: no public read) ------------------------------------

alter table public.exercise_drafts enable row level security;

create policy "Allow owner or trainer managing exercise drafts"
  on public.exercise_drafts for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = exercise_drafts.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = exercise_drafts.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );
