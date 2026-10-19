-- Messenger beta: 1-on-1 text-only chat between any two users (no
-- friends-only restriction -- matches the product decision), delivered
-- live via Supabase Realtime (postgres_changes on `messages`, the same
-- mechanism friend-requests-store.ts already uses) and backed by push
-- notifications via a Database Webhook -> Edge Function (set up
-- separately, outside this migration -- see docs/decisions.md). Beta
-- scope only: no attachments, no group chats, no read receipts/typing
-- indicators visible to the other participant.

-- One row per unordered pair of participants. `user_a`/`user_b` are kept
-- in a canonical order (`user_a < user_b`, enforced below) so the same
-- pair can never produce two rows no matter which side starts the chat --
-- a real unique constraint, not an app-level "check first" race. Callers
-- (getOrCreateConversation) sort the two ids themselves before insert.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  -- Denormalized preview of the newest message, kept in sync by the
  -- trigger below -- lets the conversation list render previews/ordering
  -- off this one table alone, no per-row messages lookup.
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_ordered_pair check (user_a < user_b),
  constraint conversations_unique_pair unique (user_a, user_b)
);

create index conversations_user_a_idx on public.conversations (user_a);
create index conversations_user_b_idx on public.conversations (user_b);

alter table public.conversations enable row level security;

create policy "Allow selecting own conversations"
on public.conversations for select
using (user_a = auth.uid() or user_b = auth.uid());

-- Any user can start a conversation with any other user -- the caller
-- must be one of the two named participants, and the pair must be two
-- distinct people.
create policy "Allow creating a conversation you're part of"
on public.conversations for insert
with check (
  (user_a = auth.uid() or user_b = auth.uid())
  and user_a <> user_b
);

-- No UPDATE policy -- `last_message_*` is only ever written by the
-- SECURITY DEFINER trigger function below, never directly by a client.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (btrim(body) <> '')
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Allow selecting messages in own conversations"
on public.messages for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

create policy "Allow sending messages in own conversations"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

-- No UPDATE/DELETE policy -- beta scope has no message editing or
-- deletion.

create function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_body = new.body,
      last_message_sender_id = new.sender_id
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_last_message();

-- Personal "how far have I scrolled" marker, used only to compute this
-- user's own unread badge count -- never exposed to the other
-- participant (no shared read-receipt UI in beta, per the product
-- decision). One row per (conversation, viewer); RLS scopes every
-- operation to `user_id = auth.uid()`, so a user can't see or infer the
-- other participant's read state at all.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create policy "Allow managing own read markers"
on public.conversation_reads for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Push notification device registrations -- one row per device/browser (a
-- user can be signed in on several), upserted on token refresh. `platform`
-- distinguishes the two delivery paths the push Edge Function uses:
-- 'expo' tokens go through Expo's push service, 'web' rows hold a
-- JSON-stringified PushSubscription (endpoint + keys) sent through the Web
-- Push protocol instead.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('expo', 'web')),
  token text not null,
  created_at timestamptz not null default now(),
  constraint push_tokens_unique_token unique (platform, token)
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Allow managing own push tokens"
on public.push_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- `messages` needs live INSERT delivery for the chat screen and
-- conversation-list previews, the same postgres_changes mechanism
-- friend-requests-store.ts already relies on. `conversations` doesn't
-- need its own subscription -- the client-side store re-derives ordering
-- and previews from the `messages` stream plus the initial fetch instead.
alter publication supabase_realtime add table public.messages;
