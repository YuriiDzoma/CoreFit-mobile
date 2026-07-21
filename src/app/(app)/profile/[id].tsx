import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ProgramsList } from '@/components/programs-list';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getPrograms, type ProgramRow } from '@/lib/supabase/programs';
import { getProfileById, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile; programs: ProgramRow[] }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

// Guarded by canGoBack() (confirmed as the documented pre-check for back()
// in the pinned v57 docs) rather than a bare back() — this screen has no
// single guaranteed entry point (reached from the Home feed today, likely
// more places later), so falling back to Home covers the edge case of
// landing here with no history to return to (e.g. a future deep link).
function handleBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export default function UserProfileScreen() {
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const theme = useTheme();

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // Both fetches are independent (profile and their programs don't
  // depend on each other), so they run in the same Promise.all rather
  // than sequentially — kept as one combined LoadState, matching every
  // other multi-fetch screen in this app.
  const fetchData = (profileId: string) => {
    Promise.all([getProfileById(profileId), getPrograms(profileId)])
      .then(([profile, programs]) => setLoadState({ state: 'success', profile, programs }))
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          setLoadState({ state: 'not-found' });
        } else {
          setLoadState({ state: 'error', message: (error as Error).message });
        }
      });
  };

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  const handleRetry = () => {
    if (!id) return;
    setLoadState({ state: 'loading' });
    fetchData(id);
  };

  const handleProgramPress = (programId: string) => {
    router.push(`/programs/${programId}`);
  };

  const isOwnProfile = loadState.state === 'success' && loadState.profile.id === user?.id;

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset }}
    >
      <ScreenHeader onBackPress={handleBack} backLabel="← Back" />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading profile…
        </ThemedText>
      )}

      {loadState.state === 'not-found' && (
        <ThemedText type="small" themeColor="textSecondary">
          This profile couldn&apos;t be found.
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <>
          <ThemedView style={styles.header}>
            <Avatar
              uri={loadState.profile.avatar_url}
              name={loadState.profile.username}
              size={96}
            />
            <ThemedText type="subtitle">{loadState.profile.username ?? 'Unknown user'}</ThemedText>
            {/* loadState.profile.email is intentionally never rendered here —
                  getProfileById returns it (RLS permits reading any profile's
                  email, per profile.ts's own decision log) but showing another
                  user's email is a deliberate privacy choice, not a gap left
                  because the data wasn't available. */}
            {loadState.profile.created_at && (
              <ThemedText type="small" themeColor="textSecondary">
                Joined{' '}
                {new Date(loadState.profile.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </ThemedText>
            )}

            {isOwnProfile && (
              <Pressable
                style={({ pressed }) => [
                  styles.signOutButton,
                  { backgroundColor: theme.danger },
                  pressed && styles.pressed,
                ]}
                onPress={() => signOut()}
              >
                <ThemedText type="smallBold">Sign out</ThemedText>
              </Pressable>
            )}
          </ThemedView>

          <ThemedView style={styles.programsSection}>
            <ThemedText type="smallBold">Programs</ThemedText>

            {isOwnProfile && (
              <Button onPress={() => router.push('/programs/create')}>
                <ThemedText type="smallBold">+ Create Program</ThemedText>
              </Button>
            )}

            {loadState.programs.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {isOwnProfile
                  ? "You don't have any programs yet."
                  : "This user hasn't created any programs yet."}
              </ThemedText>
            ) : (
              <ProgramsList programs={loadState.programs} onProgramPress={handleProgramPress} />
            )}
          </ThemedView>
        </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  programsSection: {
    flex: 1,
    gap: Spacing.two,
  },
});
