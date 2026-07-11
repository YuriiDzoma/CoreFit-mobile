import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import * as authService from '@/lib/supabase/auth';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

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

    const unsubscribe = authService.subscribeToAuthChanges((session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'authenticated' : 'unauthenticated',
        error: null,
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
