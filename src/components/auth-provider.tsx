import { useEffect, type PropsWithChildren } from 'react';

import { subscribeToAppStateAutoRefresh } from '@/lib/supabase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

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

  return <>{children}</>;
}
