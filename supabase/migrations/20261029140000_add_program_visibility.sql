-- Program visibility (Sprint 127). Each program gets a `visibility`:
--   public  -- everyone (default; every existing program)
--   friends -- the owner's accepted friends and accepted trainer
--   trainer -- the owner's accepted trainer only
--   private -- the owner only
-- It gates who can read the program itself, its days and exercises, and
-- the completed workouts logged into it (Home feed, profile Wall). Records
-- (`exercise_logs`) stay public by the user's choice -- leaderboards show
-- only the best weight per exercise, not the program.
--
-- The checks live in SECURITY DEFINER functions so the day/exercise/
-- history policies can look the parent program up even when the viewer
-- can't see it (a policy subquery on `programs` would itself be filtered
-- by `programs`' RLS). They return true for rows whose program no longer
-- exists, matching today's open reads for such rows.

alter table public.programs
  add column visibility text not null default 'public'
  constraint programs_visibility_check
    check (visibility in ('public', 'friends', 'trainer', 'private'));

create or replace function public.can_view_program(owner_id uuid, vis text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    vis = 'public'
    or owner_id = auth.uid()
    or (
      vis in ('friends', 'trainer')
      and exists (
        select 1 from trainer_clients tc
        where tc.client_id = owner_id
          and tc.trainer_id = auth.uid()
          and tc.status = 'accepted'
      )
    )
    or (
      vis = 'friends'
      and exists (
        select 1 from friends f
        where f.status = 'accepted'
          and (
            (f.user_id = owner_id and f.friend_id = auth.uid())
            or (f.friend_id = owner_id and f.user_id = auth.uid())
          )
      )
    );
$$;

create or replace function public.can_view_program_id(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.can_view_program(p.user_id, p.visibility) from programs p where p.id = pid),
    true
  );
$$;

create or replace function public.can_view_program_day(did uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.can_view_program_id(d.program_id) from program_days d where d.id = did),
    true
  );
$$;

grant execute on function public.can_view_program(uuid, text) to anon, authenticated;
grant execute on function public.can_view_program_id(uuid) to anon, authenticated;
grant execute on function public.can_view_program_day(uuid) to anon, authenticated;

drop policy "Allow read programs" on public.programs;
create policy "Allow read programs by visibility"
  on public.programs for select
  using (public.can_view_program(user_id, visibility));

drop policy "Allow read program_days" on public.program_days;
create policy "Allow read program_days by program visibility"
  on public.program_days for select
  using (public.can_view_program_id(program_id));

drop policy "Allow read program_exercises" on public.program_exercises;
create policy "Allow read program_exercises by program visibility"
  on public.program_exercises for select
  using (public.can_view_program_day(day_id));

drop policy "Allow read training history" on public.training_history;
create policy "Allow read training history by program visibility"
  on public.training_history for select
  using (public.can_view_program_day(day_id));

-- The Sprint 125 write policy on training_history was `for all`, which also
-- grants SELECT -- a trainer could read a client's workouts straight by
-- user_id even from a 'private' program. Split into insert/update/delete so
-- reads go only through the visibility policy above.
drop policy "Allow owner or trainer writing training history" on public.training_history;

create policy "Allow owner or trainer inserting training history"
  on public.training_history for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = training_history.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );

create policy "Allow owner or trainer updating training history"
  on public.training_history for update
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

create policy "Allow owner or trainer deleting training history"
  on public.training_history for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trainer_clients tc
      where tc.client_id = training_history.user_id
        and tc.trainer_id = auth.uid()
        and tc.status = 'accepted'
    )
  );
