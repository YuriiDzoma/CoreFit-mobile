import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
import { getExerciseIdsForProgramExercises } from '@/lib/supabase/programs';
import {
  getTrainingHistoryFeed,
  type TrainingHistoryFeedRow,
} from '@/lib/supabase/training-history';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; entries: TrainingHistoryFeedRow[]; exerciseNames: Map<string, string> }
  | { state: 'error'; message: string };

// Shape-only placeholder for the loading state, matching web's own skeleton
// treatment — reuses the real card's styles so the loading and loaded
// states share one shape rather than loading reading as a bare status line.
function HomeCardSkeleton() {
  const theme = useTheme();

  return (
    <ThemedView style={[styles.card, { borderColor: theme.border, backgroundColor: 'transparent' }]}>
      <ThemedView style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
        <ThemedView style={[styles.userInfo, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.skeletonAvatar, { backgroundColor: theme.backgroundElement }]} />
          <ThemedView
            style={[styles.skeletonBar, styles.skeletonName, { backgroundColor: theme.backgroundElement }]}
          />
        </ThemedView>
        <ThemedView
          style={[styles.skeletonBar, styles.skeletonDate, { backgroundColor: theme.backgroundElement }]}
        />
      </ThemedView>

      <ThemedView style={[styles.exerciseList, { backgroundColor: 'transparent' }]}>
        <ThemedView
          style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.backgroundElement }]}
        />
        <ThemedView
          style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.backgroundElement }]}
        />
      </ThemedView>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // Never resets to 'loading' itself, so a refocus refetch swaps data in
  // silently rather than flashing the loading state over existing content.
  const fetchData = useCallback(() => {
    let feedEntries: TrainingHistoryFeedRow[] = [];
    let exerciseIdByProgramExerciseId: Record<string, string> = {};

    getTrainingHistoryFeed()
      .then((entries) => {
        feedEntries = entries;
        const programExerciseIds = Array.from(
          new Set(entries.flatMap((entry) => Object.keys(entry.values))),
        );
        return getExerciseIdsForProgramExercises(programExerciseIds);
      })
      .then((map) => {
        exerciseIdByProgramExerciseId = map;
        return getExercises();
      })
      .then((exercises) => {
        const nameByExerciseId = new Map(
          exercises.map((exercise) => [exercise.id, localizeExercise(exercise).name]),
        );
        const exerciseNames = new Map<string, string>();
        for (const [programExerciseId, exerciseId] of Object.entries(
          exerciseIdByProgramExerciseId,
        )) {
          const name = nameByExerciseId.get(exerciseId);
          if (name) exerciseNames.set(programExerciseId, name);
        }
        setLoadState({ state: 'success', entries: feedEntries, exerciseNames });
      })
      .catch((error: unknown) => {
        setLoadState({ state: 'error', message: (error as Error).message });
      });
  }, []);

  useFocusEffect(fetchData);

  const handleRetry = () => {
    setLoadState({ state: 'loading' });
    fetchData();
  };

  return (
    <Workspace
      justify="flex-start"
      contentStyle={{ paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <Header />

      {loadState.state === 'loading' && (
        <ThemedView style={styles.list}>
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <FlatList
          data={loadState.entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              No activity yet.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ThemedView style={[styles.card, { borderColor: theme.border, backgroundColor: 'transparent' }]}>
              <ThemedView style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
                <Pressable
                  style={styles.userInfo}
                  disabled={!item.profiles}
                  onPress={() => item.profiles && router.push(`/profile/${item.profiles.id}`)}
                >
                  <Avatar
                    uri={item.profiles?.avatar_url}
                    name={item.profiles?.username}
                    size={32}
                  />
                  <ThemedText type="small">{item.profiles?.username ?? 'Unknown'}</ThemedText>
                </Pressable>
                <ThemedView style={[styles.dateRow, { backgroundColor: 'transparent' }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Finished
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(item.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={[styles.exerciseList, { backgroundColor: 'transparent' }]}>
                {Object.entries(item.values).map(([programExerciseId, value]) => (
                  <ThemedText key={programExerciseId} type="small">
                    {loadState.exerciseNames.get(programExerciseId) ?? 'Unknown exercise'}:{' '}
                    <ThemedText type="smallBold">{value}</ThemedText>
                  </ThemedText>
                ))}
              </ThemedView>
            </ThemedView>
          )}
        />
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  card: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  cardHeader: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  exerciseList: {
    gap: Spacing.half,
  },
  skeletonAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  skeletonBar: {
    borderRadius: Spacing.half,
  },
  skeletonName: {
    width: 96,
    height: 14,
  },
  skeletonDate: {
    width: 100,
    height: 14,
  },
  skeletonLine: {
    width: '100%',
    height: 14,
  },
});
