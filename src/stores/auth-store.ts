import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import * as authService from '@/lib/supabase/auth';

export type AuthStatus =
  'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'passwordRecovery';

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  error: string | null;
  /** Restores the session and subscribes to auth changes. Returns an unsubscribe function. */
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

let isInitialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  status: 'idle',
  error: null,

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
          return { session: null, user: null, status: 'unauthenticated', error: null };
        }
        return {
          session,
          user: session.user,
          status: state.status === 'passwordRecovery' ? 'passwordRecovery' : 'authenticated',
          error: null,
        };
      });
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
}));
