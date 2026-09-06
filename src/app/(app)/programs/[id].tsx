import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { WorkoutLogForm } from '@/components/workout-log-form';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType } from '@/lib/format-enums';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
import { deleteProgram, getProgramDetail, type ProgramDetailRow } from '@/lib/supabase/programs';
import { updateProfileById } from '@/lib/supabase/profile';
import {
  getTrainingHistoryForProgram,
  type TrainingHistoryEntry,
} from '@/lib/supabase/training-history';
import { isAcceptedTrainerOfClient } from '@/lib/supabase/trainer-clients';
import { useAuthStore } from '@/stores/auth-store';

interface ExerciseMeta {
  name: string;
  imageUrl: string | null;
}

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      program: ProgramDetailRow;
      exerciseMeta: Map<string, ExerciseMeta>;
      history: Record<string, TrainingHistoryEntry[]>;
    }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

type DeleteStatus = { state: 'idle' } | { state: 'deleting' } | { state: 'error'; message: string };

// Mirrors web's `ProgramTabs` — a display-only density switch (thumbnail /
// single truncated line / wrapping paragraph), no effect on the underlying
// data. Web's own `ProgramTabs` doesn't persist this at all (always resets
// to 2); this mobile screen does, per-user via `profiles.program_view_density`
// (a deliberate divergence, not a parity gap) — `null` (never explicitly
// set) falls back to `2`, matching what this screen rendered before the
// density toggle existed, so nothing changes visually until touched.
type ViewDensity = 1 | 2 | 3;
const DENSITY_LABELS: Record<ViewDensity, string> = { 1: 'I', 2: 'II', 3: 'III' };

export default function ProgramDetailScreen() {
  const { t } = useTranslation();
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const theme = useTheme();
  const clearance = useTrainingChromeClearance();
  const user = useAuthStore((state) => state.user);
  // `null` (never explicitly set) falls back to `2` — see the `ViewDensity`
  // comment above.
  const storedViewDensity = useAuthStore((state) => state.viewDensity);
  const setStoredViewDensity = useAuthStore((state) => state.setViewDensity);
  const viewDensity: ViewDensity = storedViewDensity ?? 2;

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>({ state: 'idle' });
  const [densityUpdateError, setDensityUpdateError] = useState<string | null>(null);

  // Instant-apply, matching Settings' own theme toggle: no separate Save
  // step. Optimistic — the tab switches immediately via the store, and a
  // failed write just means it won't survive a reload (surfaced with a
  // small inline error) rather than blocking or reverting the UI.
  const handleDensitySelect = (density: ViewDensity) => {
    if (density === viewDensity) return;
    setStoredViewDensity(density);
    setDensityUpdateError(null);
    if (!user?.id) return;
    updateProfileById(user.id, { program_view_density: density }).catch((error: unknown) => {
      setDensityUpdateError((error as Error).message);
    });
  };

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
        const exerciseMeta = new Map(
          exercises.map((exercise) => {
            const localized = localizeExercise(exercise);
            return [exercise.id, { name: localized.name, imageUrl: localized.imageUrl }];
          }),
        );
        setLoadState({ state: 'success', program, exerciseMeta, history });
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
    const dialogTitle = t('programs.byId.deleteConfirm.title');
    const message = t('programs.byId.deleteConfirm.body', { title });

    // react-native-web's Alert.alert() is a no-op (confirmed by reading its
    // source), so web needs its own path — window.confirm is the only
    // cross-browser equivalent, and doesn't support custom button labels.
    if (Platform.OS === 'web') {
      if (window.confirm(`${dialogTitle}\n\n${message}`)) {
        handleDelete();
      }
      return;
    }

    Alert.alert(dialogTitle, message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: handleDelete },
    ]);
  };

  const unknownExercise: ExerciseMeta = { name: t('common.unknownExercise'), imageUrl: null };
  const exerciseMetaFor = (exerciseId: string | null): ExerciseMeta => {
    if (loadState.state !== 'success') return unknownExercise;
    return (exerciseId && loadState.exerciseMeta.get(exerciseId)) || unknownExercise;
  };

  const isOwner = loadState.state === 'success' && loadState.program.user_id === user?.id;
  const author = loadState.state === 'success' ? loadState.program.author : null;

  // Only queried when the viewer isn't already the owner — an accepted
  // trainer of the program's owner may also edit its structure remotely
  // (Sprint 47's trainer/client relationships), but never delete it or
  // log workouts on the owner's behalf; see the isOwner-gated branches
  // below, both of which are deliberately left untouched by this.
  const [isAcceptedTrainer, setIsAcceptedTrainer] = useState(false);
  const ownerId = loadState.state === 'success' ? loadState.program.user_id : null;
  useEffect(() => {
    // No synchronous reset-to-false here when the guard fails — `isOwner`
    // alone already grants access wherever this is consumed below
    // (`isOwner || isAcceptedTrainer`), so a stale `true` left over from a
    // different program is harmless there; the async check below still
    // corrects it as soon as it resolves for the new `ownerId`, and the
    // real security boundary is server-side RLS regardless of what this
    // briefly renders.
    if (isOwner || !user?.id || !ownerId) return;
    isAcceptedTrainerOfClient(user.id, ownerId)
      .then(setIsAcceptedTrainer)
      .catch(() => setIsAcceptedTrainer(false));
  }, [isOwner, user?.id, ownerId]);

  return (
    <Workspace
      scroll
      bottomClearance={clearance.bottom}
      contentStyle={{ paddingBottom: Spacing.four, gap: Spacing.three }}
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
          <ThemedView style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
            {isOwner && (
              <Pressable
                onPress={() =>
                  handleDeletePress(loadState.program.title || t('programs.byId.untitled'))
                }
                disabled={deleteStatus.state === 'deleting'}
                hitSlop={Spacing.two}
              >
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={24}
                  tintColor={theme.danger}
                />
              </Pressable>
            )}

            <ThemedText type="default" style={styles.titleText}>
              {loadState.program.title || t('programs.byId.untitled')}
            </ThemedText>

            {(isOwner || isAcceptedTrainer) && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/programs/create',
                    params: { programId: loadState.program.id },
                  })
                }
                hitSlop={Spacing.two}
              >
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  size={24}
                  tintColor={theme.text}
                />
              </Pressable>
            )}
          </ThemedView>

          {deleteStatus.state === 'error' && (
            <ThemedView style={styles.errorBlock}>
              <ThemedText type="small" themeColor="danger">
                ❌ {deleteStatus.message}
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.infoBlock}>
            <ThemedText type="small" style={styles.infoText}>
              {t('programs.byId.typeLabel')}
              {formatProgramType(t, loadState.program.type)}
            </ThemedText>
            <ThemedText type="small" style={styles.infoText}>
              {t('programs.byId.levelLabel')}
              {formatProgramLevel(t, loadState.program.level)}
            </ThemedText>
            {author && (
              <Pressable onPress={() => router.push(`/profile/${author.id}`)}>
                <ThemedText type="small" style={styles.infoText}>
                  {t('programs.byId.authorLabel')}
                  <ThemedText type="linkPrimary" style={styles.infoText}>
                    {author.username ?? t('home.unknown')}
                  </ThemedText>
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>

          <ThemedView style={[styles.densityTabs, { borderColor: theme.border }]}>
            {([1, 2, 3] as ViewDensity[]).map((density) => (
              <Pressable
                key={density}
                style={[
                  styles.densityTab,
                  density !== 1 && { borderLeftWidth: 1, borderLeftColor: theme.border },
                  density === viewDensity && { backgroundColor: theme.backgroundSelected },
                ]}
                onPress={() => handleDensitySelect(density)}
              >
                <ThemedText type="smallBold">{DENSITY_LABELS[density]}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          {densityUpdateError && (
            <ThemedText type="small" themeColor="danger">
              ❌ {densityUpdateError}
            </ThemedText>
          )}

          {loadState.program.program_days.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.byId.noDays')}
            </ThemedText>
          ) : (
            loadState.program.program_days.map((day) => {
              const dayHistory = loadState.history[day.id] ?? [];
              const dayExercises = day.program_exercises.map((exercise) => {
                const meta = exerciseMetaFor(exercise.exercise_id);
                return {
                  programExerciseId: exercise.id,
                  name: meta.name,
                  imageUrl: meta.imageUrl,
                  sets: exercise.sets,
                };
              });

              return (
                <ThemedView key={day.id} style={styles.dayBlock}>
                  {day.program_exercises.length === 0 ? (
                    <>
                      <ThemedText type="smallBold">
                        {t('programs.day', { number: day.day_number })}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('programs.byId.noExercisesForDay')}
                      </ThemedText>
                    </>
                  ) : isOwner && user ? (
                    <WorkoutLogForm
                      userId={user.id}
                      dayId={day.id}
                      dayLabel={t('programs.day', { number: day.day_number })}
                      viewDensity={viewDensity}
                      exercises={dayExercises}
                      history={dayHistory}
                      onComplete={refreshHistory}
                    />
                  ) : (
                    <>
                      <ThemedText type="smallBold">
                        {t('programs.day', { number: day.day_number })}
                      </ThemedText>
                      {dayExercises.map((exercise, index) => (
                        <ThemedText key={exercise.programExerciseId} type="small">
                          {index + 1}. {exercise.name}
                          {dayHistory[0]?.values[exercise.programExerciseId]
                            ? ` — ${dayHistory[0].values[exercise.programExerciseId]}`
                            : ''}
                        </ThemedText>
                      ))}
                    </>
                  )}
                </ThemedView>
              );
            })
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  titleText: {
    flex: 1,
    fontSize: 18,
  },
  infoBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    columnGap: Spacing.four,
    rowGap: Spacing.one,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
  },
  densityTabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Spacing.one,
    borderWidth: 1,
    overflow: 'hidden',
  },
  densityTab: {
    minWidth: 44,
    paddingVertical: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBlock: {
    gap: Spacing.three,
  },
});
