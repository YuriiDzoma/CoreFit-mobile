import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase/client';
import {
  conversationSchema,
  getConversationById,
  getConversationsForUser,
  getPeerReadMarkers,
  getUnreadCounts,
  messageSchema,
  otherParticipantId,
  type Conversation,
} from '@/lib/supabase/messages';
import { getProfilesByIds, type Profile } from '@/lib/supabase/profile';

export interface ConversationWithProfile {
  conversation: Conversation;
  otherProfile: Profile | null;
}

export type MessagesPhase = 'loading' | 'ready' | 'error';

interface MessagesState {
  conversations: ConversationWithProfile[];
  /** Unread messages per conversation (Sprint 150), from the
   * `unread_message_counts` RPC; absent = 0. */
  unreadCounts: Record<string, number>;
  /** The other participant's read marker per conversation -- ticks on my
   * last message in the list. */
  peerReadMarkers: Record<string, string>;
  phase: MessagesPhase;
  error: string | null;
  refresh: (userId: string) => Promise<void>;
  /** Zeroes one conversation's count once the chat screen has stored its
   * read marker. */
  markRead: (conversationId: string) => void;
  /** Local removal right after this user deleted/cleared a chat — the
   * realtime refetch would get there too, this just avoids the lag. */
  removeConversation: (conversationId: string) => void;
  /** Fetches the current conversation list + read markers, then opens one
   * Realtime channel (on `messages`, same table/shape `friend-requests-
   * store.ts` subscribes to) to keep both live. Returns the unsubscribe
   * function — same `() => void` shape as that store's own
   * `subscribeToRealtime`, called from `auth-provider.tsx` the same way. */
  subscribeToRealtime: (userId: string) => () => void;
}

/** Unread messages across all conversations -- the Messages badge. */
export function selectUnreadCount(state: MessagesState): number {
  return Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
}

/** Conversations, unread counts and peer read markers in one go -- what
 * both the first load and the quiet background refresh need. */
async function fetchListState(userId: string) {
  const [conversations, unreadCounts, peerReadMarkers] = await Promise.all([
    fetchConversationsWithProfiles(userId),
    getUnreadCounts(),
    getPeerReadMarkers(userId),
  ]);
  return { conversations, unreadCounts, peerReadMarkers };
}

async function fetchConversationsWithProfiles(userId: string): Promise<ConversationWithProfile[]> {
  const conversations = await getConversationsForUser(userId);
  const otherIds = [...new Set(conversations.map((c) => otherParticipantId(c, userId)))];
  const profiles = await getProfilesByIds(otherIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  return conversations.map((conversation) => ({
    conversation,
    otherProfile: profileById.get(otherParticipantId(conversation, userId)) ?? null,
  }));
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  unreadCounts: {},
  peerReadMarkers: {},
  phase: 'loading',
  error: null,

  refresh: async (userId) => {
    set({ phase: 'loading', error: null });
    try {
      set({ ...(await fetchListState(userId)), phase: 'ready' });
    } catch (error) {
      set({ phase: 'error', error: (error as Error).message });
    }
  },

  // Local only -- the chat screen already awaited the actual
  // `markConversationRead` write before calling this; re-deriving the
  // badge from a full refetch here would just add a flash of stale state.
  markRead: (conversationId) => {
    const { [conversationId]: _cleared, ...rest } = get().unreadCounts;
    void _cleared;
    set({ unreadCounts: rest });
  },

  removeConversation: (conversationId) => {
    set({
      conversations: get().conversations.filter(
        (entry) => entry.conversation.id !== conversationId,
      ),
    });
  },

  subscribeToRealtime: (userId) => {
    set({
      conversations: [],
      unreadCounts: {},
      peerReadMarkers: {},
      phase: 'loading',
      error: null,
    });
    get().refresh(userId);

    // Unfiltered, same reasoning as friend-requests-store.ts's own channel:
    // `messages` SELECT RLS already scopes rows to each user's own
    // conversations, and Realtime enforces that same policy against the
    // subscriber's JWT, so an unfiltered INSERT stream here only ever
    // delivers messages from conversations this user is actually part of.
    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          applyIncomingMessage(userId, payload);
        },
      )
      // Deletes (Sprint 119): a "delete for everyone" fires an UPDATE here
      // (the trigger recomputing last_message_*), a chat deleted for both
      // fires a DELETE. UPDATE is RLS-scoped to participants; DELETE
      // payloads carry only the id and can't be filtered, so it's matched
      // locally. Either way, a quiet refetch of the per-user previews view
      // is the one correct source — a local patch can't know what *this*
      // user's newest visible message now is.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () =>
        scheduleQuietRefresh(userId),
      )
      // Read markers (Sprint 150): the other participant's turns my ticks
      // double; my own from another device (or this one) re-derives the
      // counts. RLS limits these to my conversations' participants.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as {
            conversation_id?: string;
            user_id?: string;
            last_read_at?: string;
          };
          if (!row.conversation_id || !row.last_read_at) return;
          if (row.user_id === userId) {
            scheduleQuietRefresh(userId);
            return;
          }
          set({
            peerReadMarkers: { ...get().peerReadMarkers, [row.conversation_id]: row.last_read_at },
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const deletedId = (payload.old as { id?: string }).id;
          if (deletedId) get().removeConversation(deletedId);
        },
      )
      .subscribe();

    return () => {
      if (quietRefreshTimer) clearTimeout(quietRefreshTimer);
      supabase.removeChannel(channel);
    };
  },
}));

// Every send also UPDATEs `conversations` (the last_message_* trigger), so
// these arrive in bursts — debounced, and without flipping `phase` back to
// 'loading' (no skeleton flash for a background refresh).
let quietRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleQuietRefresh(userId: string): void {
  if (quietRefreshTimer) clearTimeout(quietRefreshTimer);
  quietRefreshTimer = setTimeout(() => {
    quietRefreshTimer = null;
    fetchListState(userId)
      .then((listState) => useMessagesStore.setState({ ...listState, phase: 'ready', error: null }))
      .catch(() => {});
  }, 400);
}

/** Patches the one affected conversation's preview fields in place and
 * re-sorts by `last_message_at`, rather than refetching the whole list on
 * every single incoming message. The one case a local patch can't handle —
 * a brand new conversation someone else just started with this user, not
 * yet in `conversations` at all — falls back to fetching that one row. */
function applyIncomingMessage(
  currentUserId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const parsedMessage = messageSchema.safeParse(payload.new);
  if (!parsedMessage.success) return;
  const {
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    created_at: createdAt,
  } = parsedMessage.data;

  // Someone else's message: one more unread. The open chat (if it's this
  // one) marks it read right after, which zeroes it again.
  if (senderId !== currentUserId) {
    const { unreadCounts } = useMessagesStore.getState();
    useMessagesStore.setState({
      unreadCounts: { ...unreadCounts, [conversationId]: (unreadCounts[conversationId] ?? 0) + 1 },
    });
  }

  const { conversations } = useMessagesStore.getState();
  const existingIndex = conversations.findIndex(
    (entry) => entry.conversation.id === conversationId,
  );

  if (existingIndex === -1) {
    getConversationById(conversationId)
      .then(async (conversation) => {
        const otherId = otherParticipantId(conversation, currentUserId);
        const [otherProfile] = await getProfilesByIds([otherId]);
        const { conversations: latest } = useMessagesStore.getState();
        if (latest.some((entry) => entry.conversation.id === conversationId)) return;
        useMessagesStore.setState({
          conversations: [{ conversation, otherProfile: otherProfile ?? null }, ...latest],
        });
      })
      .catch(() => {});
    return;
  }

  const parsedConversation = conversationSchema.safeParse({
    ...conversations[existingIndex].conversation,
    last_message_at: createdAt,
    last_message_body: body,
    last_message_sender_id: senderId,
  });
  if (!parsedConversation.success) return;

  const updatedEntry: ConversationWithProfile = {
    ...conversations[existingIndex],
    conversation: parsedConversation.data,
  };
  const next = [updatedEntry, ...conversations.filter((_, i) => i !== existingIndex)];
  useMessagesStore.setState({ conversations: next });
}
