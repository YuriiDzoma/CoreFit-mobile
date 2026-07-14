import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase Auth calls live here. Callers (the auth store, the
 * auth provider) never touch `supabase.auth` directly — they go through
 * these wrappers.
 */

/**
 * Computed per-call rather than cached at module scope: on web, this reads
 * from the current origin, which isn't meaningfully available during
 * server-side rendering. These functions are only ever invoked from client
 * event handlers, so a fresh call always resolves in the right context.
 */
function authCallbackUrl(): string {
  return Linking.createURL('auth-callback');
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ requiresEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
  return { requiresEmailConfirmation: data.session === null };
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

export async function exchangeCodeForSession(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl(),
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
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
