import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase/client';
import {
  conversationSchema,
  getConversationById,
  getConversationsForUser,
  getReadMarkers,
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
  readMarkers: Record<string, string>;
  phase: MessagesPhase;
  error: string | null;
  refresh: (userId: string) => Promise<void>;
  markRead: (conversationId: string, userId: string) => void;
  /** Fetches the current conversation list + read markers, then opens one
   * Realtime channel (on `messages`, same table/shape `friend-requests-
   * store.ts` subscribes to) to keep both live. Returns the unsubscribe
   * function — same `() => void` shape as that store's own
   * `subscribeToRealtime`, called from `auth-provider.tsx` the same way. */
  subscribeToRealtime: (userId: string) => () => void;
}

/** Unread means: the conversation's last message wasn't sent by me, and
 * either I've never opened it or I opened it before that last message
 * arrived. A conversation with no messages yet (`last_message_at` null —
 * freshly created via the new-message picker, nobody has sent anything)
 * is never unread. This is purely a local badge-count heuristic, not a
 * shared read receipt — see `conversation_reads`' own comment in the
 * migration for why that distinction matters here. */
export function isUnreadEntry(
  { conversation }: ConversationWithProfile,
  userId: string,
  readMarkers: Record<string, string>,
): boolean {
  if (!conversation.last_message_at || !conversation.last_message_sender_id) return false;
  if (conversation.last_message_sender_id === userId) return false;
  const readAt = readMarkers[conversation.id];
  return !readAt || new Date(readAt) < new Date(conversation.last_message_at);
}

export function selectUnreadCount(state: MessagesState, userId: string): number {
  return state.conversations.filter((entry) => isUnreadEntry(entry, userId, state.readMarkers))
    .length;
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
  readMarkers: {},
  phase: 'loading',
  error: null,

  refresh: async (userId) => {
    set({ phase: 'loading', error: null });
    try {
      const [conversations, readMarkers] = await Promise.all([
        fetchConversationsWithProfiles(userId),
        getReadMarkers(userId),
      ]);
      set({ conversations, readMarkers, phase: 'ready' });
    } catch (error) {
      set({ phase: 'error', error: (error as Error).message });
    }
  },

  // Optimistic/local only — the chat screen already awaited the actual
  // `markConversationRead` write before calling this; re-deriving the
  // badge from a full refetch here would just add a flash of stale state.
  markRead: (conversationId, userId) => {
    void userId;
    set({
      readMarkers: { ...get().readMarkers, [conversationId]: new Date().toISOString() },
    });
  },

  subscribeToRealtime: (userId) => {
    set({ conversations: [], readMarkers: {}, phase: 'loading', error: null });
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));

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
  const { conversation_id: conversationId, sender_id: senderId, body, created_at: createdAt } =
    parsedMessage.data;

  const { conversations } = useMessagesStore.getState();
  const existingIndex = conversations.findIndex((entry) => entry.conversation.id === conversationId);

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
