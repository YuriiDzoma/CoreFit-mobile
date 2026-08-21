-- In-app account deletion (Google Play requires this for apps that
-- support account creation). Scoped entirely to auth.uid() -- no
-- parameter, so a caller can never delete anyone but themselves.
--
-- programs.author_id is NOT NULL with NO ACTION (not SET NULL) back to
-- profiles.id, and can legitimately differ from programs.user_id (a
-- trainer-edited client program) -- confirmed with live data before
-- writing this function. A naive "delete everything I authored" would
-- delete someone else's program just because the deleting user once
-- edited it as their trainer. The reassignment below hands authorship
-- back to the actual owner first, then only programs the deleting user
-- actually owns (user_id = them) are removed.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_uid uuid := auth.uid();
begin
  if target_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.programs
  set author_id = user_id
  where author_id = target_uid and user_id != target_uid;

  -- Cascades program_days -> program_exercises -> exercise_drafts/exercise_logs.
  delete from public.programs where user_id = target_uid;

  -- Cascades friends, trainer_clients, training_history.
  -- global_programs.author_id is set null automatically (shared content
  -- intentionally survives its author's deletion).
  delete from public.profiles where id = target_uid;

  -- Removes the auth identity itself (and Supabase's own
  -- identities/sessions/mfa/etc. rows via their own auth-schema cascades).
  delete from auth.users where id = target_uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
