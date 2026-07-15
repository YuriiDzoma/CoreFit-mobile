import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgramCard } from '@/components/program-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getPrograms, type ProgramRow } from '@/lib/supabase/programs';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; programs: ProgramRow[] }
  | { state: 'error'; message: string };

function handleProgramPress(id: string) {
  router.push(`/programs/${id}`);
}

// The CTA is already wired to a handler so the create-wizard sprint is pure
// wiring, not a restructure — there's just nowhere to navigate to yet.
function handleCreatePress() {}

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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
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
            <Pressable
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              onPress={handleCreatePress}
            >
              <ThemedText type="smallBold">+ Create Program</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {loadState.state === 'success' && loadState.programs.length > 0 && (
          <>
            <Pressable
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              onPress={handleCreatePress}
            >
              <ThemedText type="smallBold">+ Create Program</ThemedText>
            </Pressable>

            <FlatList
              data={loadState.programs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <ProgramCard program={item} onPress={() => handleProgramPress(item.id)} />
              )}
            />
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  createButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  pressed: {
    opacity: 0.7,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
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
