import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { WorkoutCard, WorkoutCardSkeleton } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useHomeChromeClearance } from '@/hooks/use-chrome-clearance';
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

export default function HomeScreen() {
  const { t } = useTranslation();
  const clearance = useHomeChromeClearance();
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
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('components.homeSubNav.trainings')}
      </ThemedText>

      {loadState.state === 'loading' && (
        <ThemedView style={styles.list}>
          <WorkoutCardSkeleton />
          <WorkoutCardSkeleton />
          <WorkoutCardSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <FlatList
          data={loadState.entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              {t('home.noActivity')}
            </ThemedText>
          }
          renderItem={({ item }) => (
            <WorkoutCard
              entry={item}
              exerciseNames={loadState.exerciseNames}
              onUserPress={
                item.profiles ? () => router.push(`/profile/${item.profiles!.id}`) : undefined
              }
            />
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
    // Matches ProgramsList/friends.tsx/Complexes' own list gap — was
    // Spacing.three (16px), the one place this app's card lists didn't
    // already agree on 8px between items.
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
});
