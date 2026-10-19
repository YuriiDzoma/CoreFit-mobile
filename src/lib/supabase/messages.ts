import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against `conversations`/`messages`/
 * `conversation_reads` live here. Callers never touch those tables
 * directly. Schema matches the migration that created them
 * (20261013090000_add_messaging.sql) — 1-on-1 only (no group chats), any
 * user can message any other user (no friends-only restriction), text
 * only (no attachments), no read receipts visible to the other
 * participant — all deliberate beta-scope decisions, not gaps.
 */

export const conversationSchema = z.object({
  id: z.uuid(),
  user_a: z.uuid(),
  user_b: z.uuid(),
  last_message_at: z.string().nullable(),
  last_message_body: z.string().nullable(),
  last_message_sender_id: z.uuid().nullable(),
  created_at: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  conversation_id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

const CONVERSATION_COLUMNS =
  'id, user_a, user_b, last_message_at, last_message_body, last_message_sender_id, created_at';
const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at';

/** `user_a`/`user_b` are stored in a fixed (lexicographically sorted)
 * order — see the migration's `conversations_ordered_pair` check — so any
 * caller that needs "the other person" must go through this rather than
 * assuming `user_a` is always "me". */
export function otherParticipantId(conversation: Conversation, userId: string): string {
  return conversation.user_a === userId ? conversation.user_b : conversation.user_a;
}

export async function getConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return z.array(conversationSchema).parse(data);
}

export async function getConversationById(id: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return conversationSchema.parse(data);
}

/** Finds the existing 1-on-1 conversation between the two users, or
 * creates one — the unique constraint on `(user_a, user_b)` (sorted)
 * means two near-simultaneous calls from both sides can never create a
 * duplicate row, but this still checks first rather than relying on a
 * race into a constraint-violation catch, since the common case (an
 * existing conversation, opened from the conversation list rather than
 * the new-message picker) shouldn't pay an insert attempt's cost. */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string,
): Promise<Conversation> {
  const [userA, userB] = [userId, otherUserId].sort();

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return conversationSchema.parse(existing);

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ user_a: userA, user_b: userB })
    .select(CONVERSATION_COLUMNS)
    .single();
  if (insertError) throw insertError;
  return conversationSchema.parse(created);
}

export const MESSAGES_PAGE_SIZE = 30;

/** Newest-first page, matching the chat screen's inverted `FlatList`.
 * Pass `before` (an already-loaded message's `created_at`) to load an
 * older page; omit it for the initial/latest page. */
export async function getMessages(conversationId: string, before?: string): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  return z.array(messageSchema).parse(data);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return messageSchema.parse(data);
}

/** Personal "read up to here" marker for the unread badge — never exposed
 * to the other participant (see `conversation_reads`' own RLS/comment in
 * the migration). Upserted every time the chat screen is opened/focused,
 * not on each incoming message while it's open — the badge only needs to
 * reflect whether the user has *visited* the conversation since the last
 * message, not live per-message state. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_reads').upsert(
    { conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: 'conversation_id,user_id' },
  );
  if (error) throw error;
}

/** Keyed by `conversation_id` — the whole-table-for-this-user shape mirrors
 * `getFriendshipsForUser`'s own "fetch everything relevant in one call"
 * precedent rather than one row at a time. */
export async function getReadMarkers(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId);
  if (error) throw error;

  const markers: Record<string, string> = {};
  for (const row of data ?? []) {
    markers[row.conversation_id as string] = row.last_read_at as string;
  }
  return markers;
}
