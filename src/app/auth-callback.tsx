import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { exchangeCodeForSession } from '@/lib/supabase/auth';

type ExchangeStatus = { state: 'exchanging' } | { state: 'error'; message: string };

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState<ExchangeStatus>(() =>
    code
      ? { state: 'exchanging' }
      : { state: 'error', message: 'This link is missing required information.' },
  );

  useEffect(() => {
    if (!code) return;

    exchangeCodeForSession(code)
      .then(() => {
        // Stack.Protected only guarantees a redirect when the *focused*
        // screen's own guard flips false — this screen is intentionally
        // unguarded (reachable from any auth state), so we hand off
        // explicitly rather than assume that happens automatically.
        router.replace('/');
      })
      .catch((error: Error) => {
        setStatus({ state: 'error', message: error.message });
      });
  }, [code]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {status.state === 'exchanging' && <ThemedText>Signing you in…</ThemedText>}
        {status.state === 'error' && (
          <>
            <ThemedText type="small" style={styles.errorText}>
              {status.message}
            </ThemedText>
            <Link href="/login">
              <ThemedText type="linkPrimary">Back to sign in</ThemedText>
            </Link>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  errorText: {
    color: '#e5484d',
    textAlign: 'center',
  },
});
