-- Sprint 47 shipped trainer_clients gated only by friendship. This adds
-- the two role rules requested afterward: only a self-declared trainer
-- (profiles.is_trainer = true) can be invited, and a trainer can't
-- themselves send an invite (can't become someone else's client).
-- `ALTER POLICY ... WITH CHECK` replaces the existing expression in
-- place rather than dropping/recreating the policy.
alter policy "Allow inviting a friend as trainer"
on public.trainer_clients
with check (
  client_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = auth.uid() and f.friend_id = trainer_id)
        or (f.friend_id = auth.uid() and f.user_id = trainer_id))
  )
  and coalesce(
    (select p.is_trainer from public.profiles p where p.id = trainer_id),
    false
  ) = true
  and coalesce(
    (select p.is_trainer from public.profiles p where p.id = auth.uid()),
    false
  ) = false
);
