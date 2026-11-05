-- Read receipts (Telegram-style ticks) and per-conversation unread counts.
--
-- `conversation_reads` was a private "read up to here" marker (see
-- 20261013090000_add_messaging.sql): each user could only see their own.
-- Ticks need the other participant's marker -- a message of mine is read
-- once their `last_read_at` reaches its `created_at` -- so participants of
-- a conversation can now read each other's marker there. Nobody else can.

-- ---------------------------------------------------------------------------
-- conversation_reads: own rows writable, both participants' rows readable
-- ---------------------------------------------------------------------------

drop policy "Allow managing own read markers" on public.conversation_reads;

-- Writes: own marker only, and only in a conversation you're part of (the
-- old `for all` policy didn't check participation on insert).
create policy "Allow managing own read markers"
on public.conversation_reads for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

create policy "Allow participants to see each other's read markers"
on public.conversation_reads for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_reads.conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- mark_conversation_read: stamped with the server clock
-- ---------------------------------------------------------------------------

-- Messages get `created_at` from the server; the marker has to come from
-- the same clock, or a phone whose clock runs behind would leave its own
-- reads looking unread (and the sender's ticks single). `greatest` keeps a
-- late-arriving older call from moving the marker backwards.
create function public.mark_conversation_read(p_conversation_id uuid)
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = greatest(conversation_reads.last_read_at, excluded.last_read_at)
  returning last_read_at;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unread_message_counts: unread messages per conversation for the caller
-- ---------------------------------------------------------------------------

-- Security invoker on purpose: `messages`' SELECT policy already limits
-- rows to the caller's conversations and drops messages hidden "for me"
-- or before a "delete chat for me", so those never count as unread.
create function public.unread_message_counts()
returns table (conversation_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select m.conversation_id, count(*)::integer
  from public.messages m
  left join public.conversation_reads r
    on r.conversation_id = m.conversation_id and r.user_id = auth.uid()
  where m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.conversation_id;
$$;

grant execute on function public.unread_message_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- The other participant opening the chat flips my ticks live. Realtime
-- applies the SELECT policies above to each subscriber, so a marker only
-- reaches the two participants.
alter publication supabase_realtime add table public.conversation_reads;
