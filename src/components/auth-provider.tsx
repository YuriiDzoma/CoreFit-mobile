import { useEffect, type PropsWithChildren } from 'react';

import { subscribeToAppStateAutoRefresh } from '@/lib/supabase/auth';
import { useAuthStore } from '@/stores/auth-store';

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

  return <>{children}</>;
}
