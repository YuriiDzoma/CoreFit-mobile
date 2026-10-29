-- Message + chat deletion, Telegram-style (Sprint 119):
--   * own message: "delete for everyone" (real DELETE) or "delete for me"
--   * other's message: "delete for me" only
--   * chat: "delete for me" (clear history up to now, hide until a new
--     message arrives) or, with the "also delete for <name>" checkbox,
--     delete the conversation row itself (cascades to its messages).
--
-- "For me" is enforced in RLS, not in each client: the messages SELECT
-- policy hides rows the viewer has hidden or cleared, so every existing
-- read path -- paginated fetch, realtime INSERT delivery (Realtime applies
-- the same SELECT policy per subscriber), the per-user previews view below
-- -- respects it with no client-side filtering.

-- ---------------------------------------------------------------------------
-- Per-user hide/clear markers
-- ---------------------------------------------------------------------------

create table public.hidden_messages (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.hidden_messages enable row level security;

create policy "Allow managing own hidden messages"
on public.hidden_messages for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- "Delete chat for me": everything up to `cleared_at` is gone for this user;
-- the chat comes back in their list as soon as a newer message exists.
create table public.conversation_clears (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_clears enable row level security;

create policy "Allow managing own conversation clears"
on public.conversation_clears for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_clears.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- messages: SELECT now excludes hidden/cleared rows; DELETE for own messages
-- ---------------------------------------------------------------------------

drop policy "Allow selecting messages in own conversations" on public.messages;

create policy "Allow selecting messages in own conversations"
on public.messages for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
  and not exists (
    select 1 from public.hidden_messages h
    where h.message_id = messages.id and h.user_id = auth.uid()
  )
  and not exists (
    select 1 from public.conversation_clears cc
    where cc.conversation_id = messages.conversation_id
      and cc.user_id = auth.uid()
      and messages.created_at <= cc.cleared_at
  )
);

-- "Delete for everyone" is sender-only (Telegram's private-chat rule for
-- this app's beta scope: the other participant can only hide it for
-- themselves).
create policy "Allow deleting own messages"
on public.messages for delete
using (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- conversations: DELETE ("also delete for <name>") by either participant
-- ---------------------------------------------------------------------------

create policy "Allow deleting own conversations"
on public.conversations for delete
using (user_a = auth.uid() or user_b = auth.uid());

-- ---------------------------------------------------------------------------
-- Keep the shared last_message_* preview correct after a real delete
-- ---------------------------------------------------------------------------

-- Recomputes from whatever message is now newest (or nulls, if none left).
-- On a cascade from a conversation delete the parent row is already gone,
-- so the UPDATE simply matches nothing.
create function public.recompute_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A row subquery that finds nothing sets all three columns to null.
  update public.conversations
  set (last_message_at, last_message_body, last_message_sender_id) = (
    select created_at, body, sender_id
    from public.messages
    where conversation_id = old.conversation_id
    order by created_at desc
    limit 1
  )
  where id = old.conversation_id;
  return old;
end;
$$;

create trigger on_message_delete_recompute_conversation
after delete on public.messages
for each row execute function public.recompute_conversation_last_message();

-- ---------------------------------------------------------------------------
-- Per-user conversation list
-- ---------------------------------------------------------------------------

-- Same columns as `conversations`, but the last_message_* preview is the
-- newest message *this viewer* can still see (security_invoker, so the
-- messages SELECT policy above applies), and a chat the viewer cleared is
-- left out until something newer arrives. Clients read the list from here;
-- the shared columns on `conversations` stay as the realtime "something
-- changed" signal.
create view public.conversation_previews
with (security_invoker = true)
as
select
  c.id,
  c.user_a,
  c.user_b,
  m.created_at as last_message_at,
  m.body as last_message_body,
  m.sender_id as last_message_sender_id,
  c.created_at
from public.conversations c
left join lateral (
  select created_at, body, sender_id
  from public.messages
  where conversation_id = c.id
  order by created_at desc
  limit 1
) as m on true
where m.created_at is not null
  or not exists (
    select 1 from public.conversation_clears cc
    where cc.conversation_id = c.id and cc.user_id = auth.uid()
  );

grant select on public.conversation_previews to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- UPDATE (preview changed after a send/delete) and DELETE (chat deleted for
-- both) on conversations drive the list; DELETE on messages drives an open
-- thread. DELETE payloads carry only the primary key (default replica
-- identity), so nothing beyond a row id reaches non-participants.
alter publication supabase_realtime add table public.conversations;
