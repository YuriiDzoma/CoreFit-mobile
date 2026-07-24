import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `friends` table live here.
 * Callers never touch `supabase.from('friends')` directly.
 *
 * Schema mirrors the live `public.friends` table (confirmed directly
 * against the Supabase project, not inferred from the web app's client
 * code): only `id` and `user_id` are NOT NULL — `friend_id`/`status` are
 * nullable, and there is no CHECK constraint on `status` at all, so any
 * string (or null) is a technically valid value. `status` is kept as a
 * plain string rather than a strict `'pending' | 'accepted'` union for the
 * same reason `programs.type`/`level` are — handling an unrecognized value
 * gracefully is `getFriendshipState`'s job below, not the schema's.
 *
 * A single row represents a directed relationship: `user_id` is whoever
 * sent it, `friend_id` is the recipient. `status` moves `'pending' ->
 * 'accepted'`, or the row is deleted outright (there is no
 * `'declined'`/`'cancelled'` status value — see Maintenance 01 in
 * docs/decisions.md for the RLS policies this relies on).
 */

const friendshipSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  friend_id: z.uuid().nullable(),
  status: z.string().nullable(),
});

export type Friendship = z.infer<typeof friendshipSchema>;

const FRIENDSHIP_COLUMNS = 'id, user_id, friend_id, status';

// Both directions in one query — a row where the viewer sent the request
// and one where they received it are equally relevant to "what's my
// relationship with this other person", which is all either screen needs.
export async function getFriendshipsForUser(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(FRIENDSHIP_COLUMNS)
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw error;
  return z.array(friendshipSchema).parse(data);
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' });
  if (error) throw error;
}

// One function for both "Cancel request" and "Remove friend" — the two
// ownership-scoped RLS DELETE policies (Maintenance 01) already
// differentiate by the row's actual status and the caller's identity
// server-side; the client-side call is identical either way, so a second,
// identically-bodied function would only be duplication.
export async function deleteFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friends').delete().eq('id', friendshipId);
  if (error) throw error;
}

// Incoming requests only — rows where the current user is the recipient
// of a still-pending request. Outgoing pending requests are handled
// entirely by getFriendshipState's 'outgoing' case on the Users screen.
export async function getIncomingFriendRequests(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(FRIENDSHIP_COLUMNS)
    .eq('friend_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return z.array(friendshipSchema).parse(data);
}

// `currentUserId` filters aren't strictly required by RLS (which already
// scopes both operations to the recipient), but mirror this project's
// existing defense-in-depth convention (see deleteProgram/
// updateProgramMetadata) of not relying solely on the database layer.
export async function acceptFriendRequest(requestId: string, currentUserId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('friend_id', currentUserId);
  if (error) throw error;
}

// Relies on Maintenance 02's DELETE policy (docs/decisions.md) — before
// that fix, this would have silently affected zero rows while still
// reporting success, exactly like web's own confirmed-broken Decline.
// `count: 'exact'` guards a *different* zero-row case the policy fix
// doesn't cover: the request's status moving off `'pending'` between the
// screen's fetch and this call (e.g. accepted from another device/web,
// which shares this same table). RLS then filters out the now-stale row
// just as it would for a policy gap, and Supabase still reports no error
// — so without this check the caller would locally remove a request that
// was never actually deleted.
export async function declineFriendRequest(
  requestId: string,
  currentUserId: string,
): Promise<void> {
  const { error, count } = await supabase
    .from('friends')
    .delete({ count: 'exact' })
    .eq('id', requestId)
    .eq('friend_id', currentUserId);
  if (error) throw error;
  if (count === 0) {
    throw new Error('This request is no longer pending — it may have already been handled.');
  }
}

export type FriendshipState =
  | { status: 'none' }
  | { status: 'outgoing'; friendshipId: string }
  | { status: 'incoming'; friendshipId: string }
  | { status: 'accepted'; friendshipId: string };

/**
 * Derives the viewer's relationship to one other user from the full
 * two-directional list `getFriendshipsForUser` returns. `'incoming'` means
 * the other user sent the viewer a pending request — accepting/declining
 * it is handled on the dedicated Requests screen, not here, so this state
 * still has no action on the Users screen; it's surfaced so the UI can
 * show a disabled "Pending" label instead of a misleading "Add friend"
 * button. Any `status` value other than `'pending'`/`'accepted'` —
 * possible since the column has no CHECK constraint — falls back to
 * `'none'`.
 */
export function getFriendshipState(
  friendships: Friendship[],
  viewerId: string,
  otherUserId: string,
): FriendshipState {
  const match = friendships.find(
    (friendship) =>
      (friendship.user_id === viewerId && friendship.friend_id === otherUserId) ||
      (friendship.user_id === otherUserId && friendship.friend_id === viewerId),
  );
  if (!match) return { status: 'none' };

  if (match.status === 'accepted') return { status: 'accepted', friendshipId: match.id };
  if (match.status === 'pending') {
    return match.user_id === viewerId
      ? { status: 'outgoing', friendshipId: match.id }
      : { status: 'incoming', friendshipId: match.id };
  }
  return { status: 'none' };
}
