import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { formatProgramLevel, formatProgramType } from '@/lib/format-enums';
import {
  addGlobalProgramToUser,
  getGlobalProgramDetail,
  getUserGlobalProgramMap,
  removeGlobalProgramFromUser,
  type GlobalProgramDetailRow,
} from '@/lib/supabase/complexes';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
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
  const { t } = useTranslation();
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const clearance = useTrainingChromeClearance();
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
    if (loadState.state !== 'success') return t('common.unknownExercise');
    return (exerciseId && loadState.exerciseNames.get(exerciseId)) || t('common.unknownExercise');
  };

  return (
    <Workspace
      scroll
      bottomClearance={clearance.bottom}
      contentStyle={{ paddingBottom: Spacing.four }}
    >
      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.loadingProgram')}
        </ThemedText>
      )}

      {loadState.state === 'not-found' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.byId.notFound')}
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <ThemedView style={styles.content}>
          <ThemedText type="title">
            {loadState.program.title || t('programs.byId.untitled')}
          </ThemedText>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.create.typeLabel')}
            </ThemedText>
            <ThemedText>{formatProgramType(t, loadState.program.type)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.complexes.levelLabel')}
            </ThemedText>
            <ThemedText>{formatProgramLevel(t, loadState.program.level)}</ThemedText>
          </ThemedView>

          <Button onPress={handleToggle} disabled={actionState.state === 'working'}>
            <ThemedText type="smallBold">
              {actionState.state === 'working'
                ? t('programs.complexes.working')
                : loadState.ownedProgramId
                  ? t('programs.complexes.removeFromMyPrograms')
                  : t('programs.complexes.addToMyPrograms')}
            </ThemedText>
          </Button>

          {loadState.ownedProgramId && (
            <Pressable onPress={() => router.push(`/programs/${loadState.ownedProgramId}`)}>
              <ThemedText type="linkPrimary">{t('programs.complexes.viewInMyPrograms')}</ThemedText>
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
              {t('programs.byId.noDays')}
            </ThemedText>
          ) : (
            loadState.program.global_program_days.map((day) => (
              <ThemedView key={day.id} style={styles.dayBlock}>
                <ThemedText type="smallBold">
                  {t('programs.day', { number: day.day_number })}
                </ThemedText>
                {day.global_program_exercises.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('programs.byId.noExercisesForDay')}
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
    </Workspace>
  );
}

const styles = StyleSheet.create({
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
