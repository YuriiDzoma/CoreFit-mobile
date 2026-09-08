import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { subscribeToAppStateAutoRefresh } from '@/lib/supabase/auth';
import { updateProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

const LAST_ACTIVE_HEARTBEAT_MS = 60_000;

function touchLastActive(userId: string) {
  updateProfileById(userId, { last_active_at: new Date().toISOString() }).catch(() => {});
}

/**
 * Mounts once at the app root: restores/subscribes to the auth session and
 * drives Supabase's token auto-refresh off app foreground/background state.
 * Renders no UI of its own and makes no navigation decisions.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const unsubscribeAuth = useAuthStore.getState().initialize();
    const unsubscribeAppState = subscribeToAppStateAutoRefresh();

    return () => {
      unsubscribeAuth();
      unsubscribeAppState();
    };
  }, []);

  // Separate from the effect above on purpose: that one runs exactly once
  // for the app's lifetime, but the friend-requests channel needs to open
  // on sign-in and close on sign-out (and reopen if a different user signs
  // in without an app restart) — `userId` is what drives that, not mount.
  const userId = useAuthStore((state) => state.user?.id);
  useEffect(() => {
    if (!userId) return;
    return useFriendRequestsStore.getState().subscribeToRealtime(userId);
  }, [userId]);

  // Heartbeat for the "Онлайн"/last-seen line on profile screens (see
  // lib/lastActive.ts) -- a plain polled timestamp, not a live socket. The
  // interval only runs while the app is foregrounded so a backgrounded app
  // stops extending its own "online" window; foregrounding again touches
  // immediately rather than waiting for the next tick.
  useEffect(() => {
    if (!userId) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      touchLastActive(userId);
      interval = setInterval(() => touchLastActive(userId), LAST_ACTIVE_HEARTBEAT_MS);
    };

    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    if (AppState.currentState === 'active') start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!interval) start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [userId]);

  return <>{children}</>;
}
