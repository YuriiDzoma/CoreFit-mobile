import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addGlobalProgramToUser,
  getGlobalProgramDetail,
  getUserGlobalProgramMap,
  removeGlobalProgramFromUser,
  type GlobalProgramDetailRow,
} from '@/lib/supabase/complexes';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
import { formatProgramLevel, formatProgramType } from '@/lib/supabase/programs';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      program: GlobalProgramDetailRow;
      exerciseNames: Map<string, string>;
      ownedProgramId: string | null;
    }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

type ActionState = { state: 'idle' } | { state: 'working' } | { state: 'error'; message: string };

export default function GlobalProgramDetailScreen() {
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const theme = useTheme();

  const user = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );
  const [actionState, setActionState] = useState<ActionState>({ state: 'idle' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = (programId: string, userId: string) => {
    Promise.all([
      getGlobalProgramDetail(programId),
      getExercises(),
      getUserGlobalProgramMap(userId),
    ])
      .then(([program, exercises, ownedMap]) => {
        const exerciseNames = new Map(
          exercises.map((exercise) => [exercise.id, localizeExercise(exercise).name]),
        );
        setLoadState({
          state: 'success',
          program,
          exerciseNames,
          ownedProgramId: ownedMap[programId] ?? null,
        });
      })
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          setLoadState({ state: 'not-found' });
        } else {
          setLoadState({ state: 'error', message: (error as Error).message });
        }
      });
  };

  useEffect(() => {
    if (id && user?.id) {
      fetchData(id, user.id);
    }
  }, [id, user?.id]);

  const handleRetry = () => {
    if (!id || !user?.id) return;
    setLoadState({ state: 'loading' });
    fetchData(id, user.id);
  };

  const handleToggle = () => {
    if (!id || !user?.id || loadState.state !== 'success') return;
    setActionState({ state: 'working' });

    const request = loadState.ownedProgramId
      ? removeGlobalProgramFromUser(id, user.id).then(() => null)
      : addGlobalProgramToUser(id, user.id);

    request
      .then((ownedProgramId) => {
        setActionState({ state: 'idle' });
        setLoadState((prev) => (prev.state === 'success' ? { ...prev, ownedProgramId } : prev));
      })
      .catch((error: unknown) => {
        setActionState({ state: 'error', message: (error as Error).message });
      });
  };

  const exerciseName = (exerciseId: string | null): string => {
    if (loadState.state !== 'success') return 'Unknown exercise';
    return (exerciseId && loadState.exerciseNames.get(exerciseId)) || 'Unknown exercise';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.container}
      >
        <ScreenHeader backHref="/programs/complexes" backLabel="← Back to global programs" />

        {loadState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            Loading program…
          </ThemedText>
        )}

        {loadState.state === 'not-found' && (
          <ThemedText type="small" themeColor="textSecondary">
            This program couldn&apos;t be found.
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
          <ThemedView style={styles.content}>
            <ThemedText type="title">{loadState.program.title || 'Untitled program'}</ThemedText>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="small" themeColor="textSecondary">
                Type
              </ThemedText>
              <ThemedText>{formatProgramType(loadState.program.type)}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.fieldGroup}>
              <ThemedText type="small" themeColor="textSecondary">
                Level
              </ThemedText>
              <ThemedText>{formatProgramLevel(loadState.program.level)}</ThemedText>
            </ThemedView>

            <Button onPress={handleToggle} disabled={actionState.state === 'working'}>
              <ThemedText type="smallBold">
                {actionState.state === 'working'
                  ? 'Working…'
                  : loadState.ownedProgramId
                    ? 'Remove from my programs'
                    : 'Add to my programs'}
              </ThemedText>
            </Button>

            {loadState.ownedProgramId && (
              <Pressable onPress={() => router.push(`/programs/${loadState.ownedProgramId}`)}>
                <ThemedText type="linkPrimary">View in My Programs →</ThemedText>
              </Pressable>
            )}

            {actionState.state === 'error' && (
              <ThemedView style={styles.errorBlock}>
                <ThemedText type="small" themeColor="danger">
                  ❌ {actionState.message}
                </ThemedText>
              </ThemedView>
            )}

            {loadState.program.global_program_days.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                This program has no days yet.
              </ThemedText>
            ) : (
              loadState.program.global_program_days.map((day) => (
                <ThemedView key={day.id} style={styles.dayBlock}>
                  <ThemedText type="smallBold">Day {day.day_number}</ThemedText>
                  {day.global_program_exercises.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      No exercises for this day yet.
                    </ThemedText>
                  ) : (
                    day.global_program_exercises.map((exercise, index) => (
                      <ThemedText key={exercise.id} type="small">
                        {index + 1}. {exerciseName(exercise.exercise_id)}
                      </ThemedText>
                    ))
                  )}
                </ThemedView>
              ))
            )}
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  content: {
    gap: Spacing.four,
  },
  fieldGroup: {
    gap: Spacing.half,
  },
  dayBlock: {
    gap: Spacing.one,
  },
});
