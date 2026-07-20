import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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

function initialFrom(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {loadState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            Loading activity…
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
              <ThemedView style={[styles.card, { borderColor: theme.border }]}>
                <ThemedView style={styles.cardHeader}>
                  <ThemedView style={styles.userInfo}>
                    {item.profiles?.avatar_url ? (
                      <Image
                        source={{ uri: item.profiles.avatar_url }}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                    ) : (
                      <ThemedView type="backgroundElement" style={styles.avatarFallback}>
                        <ThemedText type="small">{initialFrom(item.profiles?.username)}</ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText type="smallBold">{item.profiles?.username ?? 'Unknown'}</ThemedText>
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(item.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.exerciseList}>
                  {Object.entries(item.values).map(([programExerciseId, value]) => (
                    <ThemedText key={programExerciseId} type="small">
                      {loadState.exerciseNames.get(programExerciseId) ?? 'Unknown exercise'}:{' '}
                      {value}
                    </ThemedText>
                  ))}
                </ThemedView>
              </ThemedView>
            )}
          />
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
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseList: {
    gap: Spacing.half,
  },
});
