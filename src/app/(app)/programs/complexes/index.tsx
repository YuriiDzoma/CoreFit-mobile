import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ProgramCard } from '@/components/program-card';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  getGlobalPrograms,
  getUserGlobalProgramMap,
  type GlobalProgramRow,
} from '@/lib/supabase/complexes';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; programs: GlobalProgramRow[]; ownedMap: Record<string, string> }
  | { state: 'error'; message: string };

function handleProgramPress(id: string) {
  router.push(`/programs/complexes/${id}`);
}

export default function ComplexesScreen() {
  const user = useAuthStore((state) => state.user);
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuation, never
  // synchronously at call time — safe to invoke directly from the effect.
  // Both fetches are independent (the catalog doesn't depend on ownership
  // or vice versa), so they run in the same Promise.all rather than
  // sequentially.
  const fetchData = (userId: string) => {
    Promise.all([getGlobalPrograms(), getUserGlobalProgramMap(userId)])
      .then(([programs, ownedMap]) => setLoadState({ state: 'success', programs, ownedMap }))
      .catch((error: unknown) =>
        setLoadState({ state: 'error', message: (error as Error).message }),
      );
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
      <ScreenHeader backHref="/programs" backLabel="← Back to programs" title="Global Programs" />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading global programs…
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
        <ThemedText type="small" themeColor="textSecondary">
          No global programs found.
        </ThemedText>
      )}

      {loadState.state === 'success' && loadState.programs.length > 0 && (
        <FlatList
          data={loadState.programs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ProgramCard
              program={item}
              onPress={() => handleProgramPress(item.id)}
              badge={
                loadState.ownedMap[item.id] ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Added
                  </ThemedText>
                ) : undefined
              }
            />
          )}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
});
