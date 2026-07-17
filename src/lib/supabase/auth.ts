import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
  fullName: string,
): Promise<{ requiresEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      // Matches web's registerUserWithEmail (lib/userData.ts) exactly,
      // including relying on the same third-party avatar generator — not
      // a new risk, the same one web already accepts.
      data: {
        full_name: fullName,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}`,
      },
    },
  });
  if (error) throw error;
  return { requiresEmailConfirmation: data.session === null };
}

/**
 * Browser-redirect OAuth, not the native Google Sign-In SDK — reuses
 * `expo-web-browser` (already a dependency, previously unused) and this
 * file's existing `authCallbackUrl()`/`exchangeCodeForSession`, rather
 * than adding `@react-native-google-signin/google-signin` (a native
 * dependency needing its own config plugin, rebuild, and per-platform
 * Google Cloud OAuth client ids this project has none of yet). Does NOT
 * route through `/auth-callback` — `openAuthSessionAsync` captures the
 * redirect directly in the calling code, unlike the email-triggered
 * flows (password reset, email confirm), which land on that screen
 * because the OS dispatches a genuine cold-start deep link.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = authCallbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // user cancelled/dismissed — not an error

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Google sign-in did not return an authorization code.');
  await exchangeCodeForSession(code);
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
