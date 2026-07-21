import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ProgramsList } from '@/components/programs-list';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { getPrograms, type ProgramRow } from '@/lib/supabase/programs';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; programs: ProgramRow[] }
  | { state: 'error'; message: string };

function handleProgramPress(id: string) {
  router.push(`/programs/${id}`);
}

function handleCreatePress() {
  router.push('/programs/create');
}

function handleBrowseComplexesPress() {
  router.push('/programs/complexes');
}

export default function ProgramsScreen() {
  const user = useAuthStore((state) => state.user);
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = (userId: string) => {
    getPrograms(userId)
      .then((programs) => setLoadState({ state: 'success', programs }))
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  };

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id);
    }
  }, [user?.id]);

  const handleRetry = () => {
    if (!user?.id) return;
    setLoadState({ state: 'loading' });
    fetchData(user.id);
  };

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <Pressable onPress={handleBrowseComplexesPress}>
        <ThemedText type="linkPrimary">Browse Global Programs →</ThemedText>
      </Pressable>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading programs…
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

      {loadState.state === 'success' && loadState.programs.length === 0 && (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
            You don&apos;t have any programs yet.
          </ThemedText>
          <Button onPress={handleCreatePress}>
            <ThemedText type="smallBold">+ Create Program</ThemedText>
          </Button>
        </ThemedView>
      )}

      {loadState.state === 'success' && loadState.programs.length > 0 && (
        <>
          <Button onPress={handleCreatePress}>
            <ThemedText type="smallBold">+ Create Program</ThemedText>
          </Button>

          <ProgramsList programs={loadState.programs} onProgramPress={handleProgramPress} />
        </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
