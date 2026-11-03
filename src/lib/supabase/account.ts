import { AVATARS_BUCKET } from '@/lib/supabase/avatarStorage';
import { supabase } from '@/lib/supabase/client';

/**
 * Permanently deletes the signed-in user's own account, their uploaded
 * photos and every row that belongs to them (programs, training history,
 * messages, friend/trainer links) — the `delete_own_account` RPC is scoped entirely to
 * `auth.uid()` server-side, so there's no id to pass here. Callers must
 * still explicitly sign out afterward (this only removes the account,
 * it doesn't clear the now-stale local session) — same split as every
 * other auth action in this app.
 */
export async function deleteOwnAccount(): Promise<void> {
  await deleteOwnAvatarFiles();
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}

// The RPC can't reach Storage, so uploaded profile photos (every file in
// avatars/<userId>/, including old ones) are removed here first, while the
// session still exists to authorize it. Best-effort: a leftover file must
// not block deleting the account itself.
async function deleteOwnAvatarFiles(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const bucket = supabase.storage.from(AVATARS_BUCKET);
  const { data: files } = await bucket.list(userId, { limit: 1000 });
  if (!files?.length) return;
  await bucket.remove(files.map((file) => `${userId}/${file.name}`)).catch(() => {});
}
