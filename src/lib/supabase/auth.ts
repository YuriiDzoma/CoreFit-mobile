import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase Auth calls live here. Callers (the auth store, the
 * auth provider) never touch `supabase.auth` directly — they go through
 * these wrappers.
 */

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthChanges(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Supabase's token auto-refresh timer needs to be paused while the app is
 * backgrounded and resumed on foreground — there's no persistent tab/window
 * keeping it alive like on web. See:
 * https://supabase.com/docs/reference/javascript/auth-startautorefresh
 */
export function subscribeToAppStateAutoRefresh(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => subscription.remove();
}
