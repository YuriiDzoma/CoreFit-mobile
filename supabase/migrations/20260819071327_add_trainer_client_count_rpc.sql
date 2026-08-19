-- A trainer-level badge on the profile page needs the *count* of a
-- trainer's accepted clients, including on a profile that isn't the
-- viewer's own -- `trainer_clients`' SELECT RLS policy only allows a
-- user to read relationships they're personally part of
-- (`trainer_id = auth.uid() or client_id = auth.uid()`), so a plain
-- client-side query can't see another trainer's full client list.
--
-- SECURITY DEFINER bypasses that, but only to return a count, not the
-- underlying rows -- a viewer can learn "this trainer has 12 clients"
-- without learning who any of them are.
create or replace function public.get_trainer_client_count(target_trainer_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.trainer_clients
  where trainer_id = target_trainer_id and status = 'accepted';
$$;

grant execute on function public.get_trainer_client_count(uuid) to authenticated, anon;
