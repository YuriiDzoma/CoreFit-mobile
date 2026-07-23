import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import * as authService from '@/lib/supabase/auth';
import { getProfileById } from '@/lib/supabase/profile';

export type AuthStatus =
  'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'passwordRecovery';

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  error: string | null;
  /** The current user's `profiles.dark` — `null` means no explicit
   * preference has ever been set (or none has loaded yet), in which case
   * `useTheme()` falls back to the OS scheme. Populated by a fire-and-forget
   * background fetch (see `refreshThemePreference` below), never awaited by
   * `initialize()` or anything else — a failure or slow network here must
   * never block or affect app startup. */
  themePreference: boolean | null;
  /** Restores the session and subscribes to auth changes. Returns an unsubscribe function. */
  initialize: () => () => void;
  signOut: () => Promise<void>;
  setThemePreference: (dark: boolean) => void;
}

let isInitialized = false;

/**
 * Fire-and-forget — never awaited by any caller. A failure (offline,
 * timeout, server error) is silently swallowed: `themePreference` simply
 * stays whatever it already was (`null` on first load, meaning the OS
 * scheme keeps being used), exactly the same fallback a user who never set
 * a preference gets. Settings' own profile fetch (needed anyway to seed
 * its name form) provides a natural, low-cost resync point later if this
 * one fails — no dedicated retry is needed.
 *
 * The `get().user?.id === userId` guard ignores a stale response arriving
 * after the user has signed out, or a different user has since signed in,
 * while this fetch was still in flight.
 */
function refreshThemePreference(userId: string): void {
  getProfileById(userId)
    .then((profile) => {
      if (useAuthStore.getState().user?.id === userId) {
        useAuthStore.setState({ themePreference: profile.dark });
      }
    })
    .catch(() => {});
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  status: 'idle',
  error: null,
  themePreference: null,

  initialize: () => {
    if (isInitialized) {
      return () => {};
    }
    isInitialized = true;

    set({ status: 'loading', error: null });

    authService
      .getCurrentSession()
      .then((session) => {
        set({
          session,
          user: session?.user ?? null,
          status: session ? 'authenticated' : 'unauthenticated',
        });
        if (session) {
          refreshThemePreference(session.user.id);
        }
      })
      .catch((error: Error) => {
        set({ status: 'unauthenticated', error: error.message });
      });

    // A session established via a password-recovery link (event
    // 'PASSWORD_RECOVERY') must never be treated as a normal authenticated
    // session — it only ever unlocks the reset-password screen. That status
    // is sticky across subsequent events for the same session (e.g. a token
    // refresh while sitting on that screen) until an explicit sign-out.
    const unsubscribe = authService.subscribeToAuthChanges((event, session) => {
      set((state) => {
        if (event === 'PASSWORD_RECOVERY') {
          return { session, user: session?.user ?? null, status: 'passwordRecovery', error: null };
        }
        if (!session) {
          return {
            session: null,
            user: null,
            status: 'unauthenticated',
            error: null,
            themePreference: null,
          };
        }
        return {
          session,
          user: session.user,
          status: state.status === 'passwordRecovery' ? 'passwordRecovery' : 'authenticated',
          error: null,
        };
      });
      // Outside the `set()` updater on purpose — this kicks off a new
      // fetch (a side effect), not a state transition itself. Skipped for
      // password-recovery sessions, which never reach the main app.
      if (session && event !== 'PASSWORD_RECOVERY') {
        refreshThemePreference(session.user.id);
      }
    });

    return () => {
      unsubscribe();
      isInitialized = false;
    };
  },

  signOut: async () => {
    try {
      await authService.signOut();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setThemePreference: (dark) => set({ themePreference: dark }),
}));
