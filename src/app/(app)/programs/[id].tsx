import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutHistory } from '@/components/workout-history';
import { WorkoutLogForm } from '@/components/workout-log-form';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
import {
  deleteProgram,
  formatProgramLevel,
  formatProgramType,
  getProgramDetail,
  type ProgramDetailRow,
} from '@/lib/supabase/programs';
import {
  getTrainingHistoryForProgram,
  type TrainingHistoryEntry,
} from '@/lib/supabase/training-history';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      program: ProgramDetailRow;
      exerciseNames: Map<string, string>;
      history: Record<string, TrainingHistoryEntry[]>;
    }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

type DeleteStatus = { state: 'idle' } | { state: 'deleting' } | { state: 'error'; message: string };

export default function ProgramDetailScreen() {
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const theme = useTheme();

  const user = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>({ state: 'idle' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // All three fetches run in parallel: getTrainingHistoryForProgram only
  // needs the programId (it filters through the embedded program_days
  // relation rather than requiring day ids up front), so there's no
  // sequential dependency on getProgramDetail resolving first.
  const fetchData = (programId: string) => {
    Promise.all([
      getProgramDetail(programId),
      getExercises(),
      getTrainingHistoryForProgram(programId),
    ])
      .then(([program, exercises, history]) => {
        const exerciseNames = new Map(
          exercises.map((exercise) => [exercise.id, localizeExercise(exercise).name]),
        );
        setLoadState({ state: 'success', program, exerciseNames, history });
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
    if (id) {
      fetchData(id);
    }
  }, [id]);

  // Called imperatively by WorkoutLogForm's onComplete, once per successful
  // completeDay — never wired into an effect dependency array, so it can't
  // trigger the kind of refetch loop the exercises-array bug did. Re-fetches
  // the whole program's history (matching web's loadAllHistory), not just
  // the completed day, avoiding any partial-state-merge bookkeeping. A
  // failure here is silently ignored — the workout itself already
  // completed successfully; the existing (now slightly stale) history
  // stays visible rather than surfacing an error for a secondary refresh.
  const refreshHistory = () => {
    if (!id) return;
    getTrainingHistoryForProgram(id)
      .then((history) => {
        setLoadState((prev) => (prev.state === 'success' ? { ...prev, history } : prev));
      })
      .catch(() => {});
  };

  const handleRetry = () => {
    if (!id) return;
    setLoadState({ state: 'loading' });
    fetchData(id);
  };

  const handleDelete = () => {
    if (!id) return;
    setDeleteStatus({ state: 'deleting' });
    deleteProgram(id)
      .then(() => {
        router.replace('/programs');
      })
      .catch((error: unknown) => {
        setDeleteStatus({ state: 'error', message: (error as Error).message });
      });
  };

  const handleDeletePress = (title: string) => {
    const message = `This will permanently delete "${title}" and everything in it. This can't be undone.`;

    // react-native-web's Alert.alert() is a no-op (confirmed by reading its
    // source), so web needs its own path — window.confirm is the only
    // cross-browser equivalent, and doesn't support custom button labels.
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete program?\n\n${message}`)) {
        handleDelete();
      }
      return;
    }

    Alert.alert('Delete program?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
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
        <ScreenHeader backHref="/programs" backLabel="← Back to programs" />

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

            {loadState.program.user_id === user?.id && (
              <Pressable
                onPress={() => handleDeletePress(loadState.program.title || 'Untitled program')}
                disabled={deleteStatus.state === 'deleting'}
              >
                <ThemedText type="smallBold" themeColor="danger">
                  {deleteStatus.state === 'deleting' ? 'Deleting…' : 'Delete program'}
                </ThemedText>
              </Pressable>
            )}

            {deleteStatus.state === 'error' && (
              <ThemedView style={styles.errorBlock}>
                <ThemedText type="small" themeColor="danger">
                  ❌ {deleteStatus.message}
                </ThemedText>
              </ThemedView>
            )}

            {loadState.program.program_days.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                This program has no days yet.
              </ThemedText>
            ) : (
              loadState.program.program_days.map((day) => {
                const dayExercises = day.program_exercises.map((exercise) => ({
                  programExerciseId: exercise.id,
                  name: exerciseName(exercise.exercise_id),
                }));

                return (
                  <ThemedView key={day.id} style={styles.dayBlock}>
                    <ThemedText type="smallBold">Day {day.day_number}</ThemedText>
                    {day.program_exercises.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        No exercises for this day yet.
                      </ThemedText>
                    ) : (
                      <>
                        {day.program_exercises.map((exercise, index) => (
                          <ThemedText key={exercise.id} type="small">
                            {index + 1}. {exerciseName(exercise.exercise_id)}
                          </ThemedText>
                        ))}
                        {loadState.program.user_id === user?.id && user && (
                          <WorkoutLogForm
                            userId={user.id}
                            dayId={day.id}
                            exercises={dayExercises}
                            onComplete={refreshHistory}
                          />
                        )}
                        <WorkoutHistory
                          entries={loadState.history[day.id] ?? []}
                          exercises={dayExercises}
                        />
                      </>
                    )}
                  </ThemedView>
                );
              })
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
