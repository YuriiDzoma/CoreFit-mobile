-- Trainer/client relationships: a client invites an already-accepted
-- friend to become their trainer; the trainer confirms. Mirrors the
-- `friends` table's shape (id/status/created_at, no unique constraint on
-- the pair -- the app checks state via a query, not a DB constraint,
-- matching getFriendshipState's own precedent), but with named,
-- direction-specific columns (trainer_id/client_id) rather than
-- friends' symmetric user_id/friend_id, since direction is meaningful
-- here in a way it isn't for friends.
create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table public.trainer_clients enable row level security;

-- Deliberately scoped to the two involved parties, unlike friends'
-- original open `true` SELECT policy (see docs/decisions.md Maintenance
-- 01, which had to walk that back) -- starting scoped rather than fixing
-- it later.
create policy "Allow selecting own trainer/client links"
on public.trainer_clients for select
using (trainer_id = auth.uid() or client_id = auth.uid());

-- Enforces "only among already-accepted friends" at the DB layer, not
-- just in the UI -- the requester must be the client, and an accepted
-- friends row must already exist between the two parties.
create policy "Allow inviting a friend as trainer"
on public.trainer_clients for insert
with check (
  client_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = auth.uid() and f.friend_id = trainer_id)
        or (f.friend_id = auth.uid() and f.user_id = trainer_id))
  )
);

-- Only the trainer can accept -- the client can't self-accept their own request.
create policy "Allow trainer accepting a client request"
on public.trainer_clients for update
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

-- Three distinct DELETE policies, matching the exact lesson friends'
-- Maintenance 01/02 already taught this project: cancel (by the
-- requester), decline (by the recipient), and remove (either party, once
-- accepted) are three different cases that each need their own policy --
-- getting this right upfront rather than discovering a silent no-op gap
-- later, the way friends' own Decline button did.
create policy "Allow client cancelling own pending trainer request"
on public.trainer_clients for delete
using (client_id = auth.uid() and status = 'pending');

create policy "Allow trainer declining incoming pending trainer request"
on public.trainer_clients for delete
using (trainer_id = auth.uid() and status = 'pending');

create policy "Allow either party removing accepted trainer relationship"
on public.trainer_clients for delete
using ((trainer_id = auth.uid() or client_id = auth.uid()) and status = 'accepted');

-- Lets an accepted trainer edit their client's program structure
-- remotely. `programs` itself has RLS disabled entirely (confirmed live),
-- so no policy is needed there -- only program_days/program_exercises
-- (which do have RLS) need new grants. Added as new, separate policies
-- rather than editing the existing owner-only ones, for a clean,
-- independently revertible diff.
create policy "Allow trainer insert program_days for client"
on public.program_days for insert
with check (
  exists (
    select 1 from public.programs p
    join public.trainer_clients tc on tc.client_id = p.user_id
    where p.id = program_days.program_id
      and tc.trainer_id = auth.uid() and tc.status = 'accepted'
  )
);

create policy "Allow trainer delete program_days for client"
on public.program_days for delete
using (
  exists (
    select 1 from public.programs p
    join public.trainer_clients tc on tc.client_id = p.user_id
    where p.id = program_days.program_id
      and tc.trainer_id = auth.uid() and tc.status = 'accepted'
  )
);

create policy "Allow trainer insert program_exercises for client"
on public.program_exercises for insert
with check (
  exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    join public.trainer_clients tc on tc.client_id = p.user_id
    where d.id = program_exercises.day_id
      and tc.trainer_id = auth.uid() and tc.status = 'accepted'
  )
);

create policy "Allow trainer delete program_exercises for client"
on public.program_exercises for delete
using (
  exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    join public.trainer_clients tc on tc.client_id = p.user_id
    where d.id = program_exercises.day_id
      and tc.trainer_id = auth.uid() and tc.status = 'accepted'
  )
);
