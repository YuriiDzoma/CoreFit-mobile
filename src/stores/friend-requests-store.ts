import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase/client';
import {
  friendshipSchema,
  getIncomingFriendRequests,
  type Friendship,
} from '@/lib/supabase/friends';

export type FriendRequestsPhase = 'loading' | 'ready' | 'error';

interface FriendRequestsState {
  requests: Friendship[];
  phase: FriendRequestsPhase;
  error: string | null;
  refresh: (userId: string) => Promise<void>;
  removeRequest: (requestId: string) => void;
  /** Fetches the current incoming list, then opens one Realtime channel to
   * keep it live. Returns the unsubscribe function — call on sign-out or
   * when `userId` changes, mirroring `useAuthStore`'s own `initialize()`/
   * `subscribeToAppStateAutoRefresh` shape (both `() => void`-returning). */
  subscribeToRealtime: (userId: string) => () => void;
}

export const useFriendRequestsStore = create<FriendRequestsState>((set, get) => ({
  requests: [],
  phase: 'loading',
  error: null,

  refresh: async (userId) => {
    set({ phase: 'loading', error: null });
    try {
      const requests = await getIncomingFriendRequests(userId);
      set({ requests, phase: 'ready' });
    } catch (error) {
      set({ phase: 'error', error: (error as Error).message });
    }
  },

  removeRequest: (requestId) => {
    set({ requests: get().requests.filter((request) => request.id !== requestId) });
  },

  subscribeToRealtime: (userId) => {
    set({ requests: [], phase: 'loading', error: null });
    get().refresh(userId);

    // One unfiltered channel, not `filter: friend_id=eq.${userId}` the way
    // web's own equivalent subscription is scoped (store/useFriendRequestStore.ts
    // there). That filter looks reasonable but doesn't actually work for the
    // DELETE case (a decline or a cancel) — Supabase's Realtime docs confirm
    // postgres_changes `filter` is never evaluated server-side for DELETE
    // events, and separately, because `friends` has RLS enabled, a DELETE's
    // `old` record is stripped down to primary-key columns regardless of the
    // table's REPLICA IDENTITY (verified live: `friends` is REPLICA IDENTITY
    // DEFAULT) — `old.friend_id` is never sent, so there'd be nothing for
    // such a filter to match against even if it were applied. A
    // `friend_id=eq.<id>` filter would therefore silently drop every
    // decline/cancel event rather than ever matching one — the same failure
    // shape as web's confirmed-broken Decline button, just at the Realtime
    // layer instead of the RLS layer this time. Subscribing unfiltered and
    // scoping client-side below (by `id` for DELETE, by `friend_id`/`status`
    // for INSERT/UPDATE, both always fully present) is the only approach
    // that actually works. This is safe to do unfiltered specifically
    // because `friends`' SELECT policy already permits any authenticated
    // user to read any row (see Maintenance 01, docs/decisions.md) — an
    // unfiltered subscription exposes nothing a direct query couldn't
    // already return.
    const channel = supabase
      .channel(`friend-requests:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          applyRealtimeChange(userId, payload, get().removeRequest);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));

function applyRealtimeChange(
  currentUserId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  removeRequest: (requestId: string) => void,
): void {
  if (payload.eventType === 'DELETE') {
    // `old` is PK-only under RLS (see the comment above) — `id` is the
    // primary key, so it's the one column guaranteed to be present.
    const oldId = payload.old.id;
    if (typeof oldId === 'string') removeRequest(oldId);
    return;
  }

  const parsed = friendshipSchema.safeParse(payload.new);
  if (!parsed.success) return;
  const row = parsed.data;
  if (row.friend_id !== currentUserId) return;

  const { requests } = useFriendRequestsStore.getState();
  const alreadyTracked = requests.some((request) => request.id === row.id);

  if (row.status === 'pending') {
    if (!alreadyTracked) {
      useFriendRequestsStore.setState({ requests: [...requests, row] });
    }
    return;
  }

  // Accepted (or any other non-pending status) elsewhere — same removal
  // `declineFriendRequest`'s local caller already does on this device.
  if (alreadyTracked) removeRequest(row.id);
}
