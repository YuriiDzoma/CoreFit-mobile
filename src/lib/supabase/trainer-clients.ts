import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `trainer_clients` table live
 * here, mirroring `friends.ts`'s own single-file convention.
 *
 * A client invites an already-accepted friend to become their trainer;
 * the trainer confirms. Unlike `friends` (a symmetric relationship,
 * `user_id`/`friend_id`), direction matters here — `client_id` is always
 * the requester/mentee, `trainer_id` is always the one being asked —
 * so the columns are named for their role, not left directionless.
 * `status` moves `'pending' -> 'accepted'`, or the row is deleted
 * outright (no `'declined'`/`'cancelled'` value), same as `friends`.
 *
 * Schema mirrors the live `public.trainer_clients` table (confirmed via
 * `supabase db query --linked` before any app code was written, along
 * with every RLS boundary below — see docs/decisions.md).
 */

export const trainerClientSchema = z.object({
  id: z.uuid(),
  trainer_id: z.uuid(),
  client_id: z.uuid(),
  status: z.string().nullable(),
});

export type TrainerClient = z.infer<typeof trainerClientSchema>;

const TRAINER_CLIENT_COLUMNS = 'id, trainer_id, client_id, status';

// Both directions in one query — a row where the viewer is the trainer
// and one where they're the client are equally relevant to "what's my
// relationship with this other person" — same reasoning as
// getFriendshipsForUser.
export async function getTrainerClientLinksForUser(userId: string): Promise<TrainerClient[]> {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(TRAINER_CLIENT_COLUMNS)
    .or(`trainer_id.eq.${userId},client_id.eq.${userId}`);
  if (error) throw error;
  return z.array(trainerClientSchema).parse(data);
}

// The RLS insert policy already enforces `client_id = auth.uid()` and
// that an accepted friendship exists between the two parties — this
// call just supplies the two ids, the same defense-in-depth-but-not-
// duplicated-here shape sendFriendRequest already uses.
export async function sendTrainerRequest(clientId: string, trainerId: string): Promise<void> {
  const { error } = await supabase
    .from('trainer_clients')
    .insert({ client_id: clientId, trainer_id: trainerId, status: 'pending' });
  if (error) throw error;
}

// One function for cancel (by the client), decline (by the trainer), and
// remove (either party, once accepted) — the three ownership-scoped RLS
// DELETE policies already differentiate by the row's actual status and
// the caller's identity server-side, so the client-side call is
// identical in all three cases. Same reasoning as deleteFriendship.
export async function deleteTrainerLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('trainer_clients').delete().eq('id', linkId);
  if (error) throw error;
}

// Incoming requests only — rows where the current user is the trainer
// being asked, still pending. Outgoing pending requests are handled
// entirely by getTrainerClientState's 'outgoing' case on the profile
// screen, same split getIncomingFriendRequests already establishes.
export async function getIncomingTrainerRequests(userId: string): Promise<TrainerClient[]> {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(TRAINER_CLIENT_COLUMNS)
    .eq('trainer_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return z.array(trainerClientSchema).parse(data);
}

// `currentUserId` filter is defense-in-depth, not an enforced
// constraint on top of RLS — mirrors acceptFriendRequest's own reasoning
// exactly (RLS already scopes UPDATE to `trainer_id = auth.uid()`).
export async function acceptTrainerRequest(linkId: string, currentUserId: string): Promise<void> {
  const { error } = await supabase
    .from('trainer_clients')
    .update({ status: 'accepted' })
    .eq('id', linkId)
    .eq('trainer_id', currentUserId);
  if (error) throw error;
}

export type TrainerClientState =
  | { status: 'none' }
  | { status: 'outgoing'; linkId: string }
  | { status: 'incoming'; linkId: string }
  | { status: 'accepted'; linkId: string };

/**
 * Derives the viewer's trainer/client relationship to one other user
 * from the full two-directional list `getTrainerClientLinksForUser`
 * returns — same shape as getFriendshipState. `'outgoing'` means the
 * viewer asked `otherUserId` to be their trainer (viewer is the client);
 * `'incoming'` means the other user asked the viewer (viewer is the
 * trainer) — surfaced so the Requests screen can show Accept/Decline,
 * not acted on here.
 */
export function getTrainerClientState(
  links: TrainerClient[],
  viewerId: string,
  otherUserId: string,
): TrainerClientState {
  const match = links.find(
    (link) =>
      (link.client_id === viewerId && link.trainer_id === otherUserId) ||
      (link.trainer_id === viewerId && link.client_id === otherUserId),
  );
  if (!match) return { status: 'none' };

  if (match.status === 'accepted') return { status: 'accepted', linkId: match.id };
  if (match.status === 'pending') {
    return match.client_id === viewerId
      ? { status: 'outgoing', linkId: match.id }
      : { status: 'incoming', linkId: match.id };
  }
  return { status: 'none' };
}

// A single targeted query (not the full getTrainerClientLinksForUser
// list) — used by programs/[id].tsx's Edit-permission check, which only
// ever needs to know about one specific trainer/client pair and is only
// called at all when the viewer isn't already the program's owner.
export async function isAcceptedTrainerOfClient(
  trainerId: string,
  clientId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('id')
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
