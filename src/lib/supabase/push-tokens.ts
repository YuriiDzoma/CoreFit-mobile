import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against `push_tokens` live here. One row per
 * device/browser (a user can be signed in on several at once) — the
 * `send-message-push` Edge Function reads this table (via the service
 * role, bypassing RLS) to know where to deliver a push for a new message.
 * `platform` distinguishes an Expo push token (mobile) from a
 * JSON-stringified `PushSubscription` (web, Web Push protocol) — see that
 * function for the two different delivery paths.
 */

export type PushPlatform = 'expo' | 'web';

/** Upserts on `(platform, token)` — a token value is already unique
 * per-device, so re-registering the same device (app relaunch, browser
 * reload) updates `user_id` in place rather than accumulating duplicate
 * rows, which also naturally re-points a token at whoever is currently
 * signed in if a device switches accounts. */
export async function upsertPushToken(
  userId: string,
  platform: PushPlatform,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, platform, token }, { onConflict: 'platform,token' });
  if (error) throw error;
}

/** Called on sign-out so a shared/signed-out device stops receiving
 * pushes meant for the account that just left it. */
export async function removePushToken(platform: PushPlatform, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('platform', platform)
    .eq('token', token);
  if (error) throw error;
}
