import { supabase } from '@/lib/supabase/client';

/**
 * Permanently deletes the signed-in user's own account and every row
 * that belongs to them (programs, training history, friend/trainer
 * links) — the `delete_own_account` RPC is scoped entirely to
 * `auth.uid()` server-side, so there's no id to pass here. Callers must
 * still explicitly sign out afterward (this only removes the account,
 * it doesn't clear the now-stale local session) — same split as every
 * other auth action in this app.
 */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
