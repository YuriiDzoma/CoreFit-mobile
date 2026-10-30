-- Editing sent messages (Sprint 131): a sender can change the text of
-- their own message; both participants see it (realtime UPDATE) with an
-- "edited" mark. No time limit, no push for edits.

alter table public.messages add column edited_at timestamptz;

-- Only the text is editable: column-level privileges keep conversation_id,
-- sender_id and created_at out of reach even for the row's own sender, and
-- edited_at is set by the trigger below rather than by clients.
revoke update on public.messages from anon, authenticated;
grant update (body) on public.messages to authenticated;

create policy "Allow editing own messages"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create or replace function public.stamp_message_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger on_message_edit_stamp
  before update of body on public.messages
  for each row execute function public.stamp_message_edit();

-- Editing the newest message must refresh the conversation preview.
-- recompute_conversation_last_message (20261029090000) only reads OLD's
-- conversation_id, so it works unchanged for UPDATE.
create trigger on_message_edit_recompute_conversation
  after update of body on public.messages
  for each row execute function public.recompute_conversation_last_message();
