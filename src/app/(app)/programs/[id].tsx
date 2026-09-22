import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';

import { ElevatedCard } from '@/components/elevated-card';
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
// single truncated line), no effect on the underlying data. Web's own
// `ProgramTabs` doesn't persist this at all (always resets to 2); this
// mobile screen does, per-user via `profiles.program_view_density` (a
// deliberate divergence, not a parity gap) — `null` (never explicitly set)
// falls back to `2`, matching what this screen rendered before the density
// toggle existed, so nothing changes visually until touched.
//
// Only 1 and 2 are selectable — matches web, which narrowed its own density
// picker from three options (thumbnail / single line / wrapping paragraph)
// down to two (thumbnail / single line) before this mobile screen ever had
// one. A profile row can still carry a legacy `3` from before that
// narrowing (or from this screen's own now-removed third option); `viewDensity`
// below folds that into `2`, same as web's `ProgramDaysList` already does.
type ViewDensity = 1 | 2;

export default function ProgramDetailScreen() {
  const { t } = useTranslation();
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const theme = useTheme();
  const clearance = useTrainingChromeClearance();
  const user = useAuthStore((state) => state.user);
  // `null` (never explicitly set) or a legacy `3` both fall back to `2` —
  // see the `ViewDensity` comment above.
  const storedViewDensity = useAuthStore((state) => state.viewDensity);
  const setStoredViewDensity = useAuthStore((state) => state.setViewDensity);
  const viewDensity: ViewDensity = storedViewDensity === 1 ? 1 : 2;

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>({ state: 'idle' });
  const [densityUpdateError, setDensityUpdateError] = useState<string | null>(null);
  const [showRotateHint, setShowRotateHint] = useState(false);
  // Tracks which way *this button* last locked the screen, independent of
  // the OS's own reported orientation -- the button is a toggle (press once
  // for landscape, press again for portrait), not a one-way "rotate" action,
  // so it needs its own memory of which state it's in rather than re-issuing
  // the same `lockAsync(LANDSCAPE)` on every press.
  const [isLandscape, setIsLandscape] = useState(false);

  // Real device rotation (not a visual-only transform) — the root layout
  // locks every screen to portrait by default (see `_layout.tsx`); this is
  // the one screen that opts out of that lock while mounted, and restores
  // it the moment it's left, matching web's own `ProgramTabs` unlock-on-leave
  // behavior. `useFocusEffect`, not a plain mount/unmount `useEffect` --
  // Expo Router's Stack keeps a screen mounted (just unfocused) when
  // navigating to a *sibling* route (e.g. a bottom-tab switch), so a bare
  // unmount cleanup never ran in that case and the app stayed stuck in
  // landscape after leaving this screen; only an actual pop (back button)
  // happened to unmount it. `useFocusEffect`'s own cleanup runs on losing
  // focus for *either* reason (blur or unmount), covering both. Also resets
  // `isLandscape` so the rotate button's own toggle state doesn't come back
  // stale if this screen is revisited. Requires `app.config.ts`'s
  // `orientation` to be `'default'`, not a hard `'portrait'` -- iOS only
  // ever presents orientations declared supported in the native Info.plist,
  // so a build with the old hard lock baked in would silently reject
  // `lockAsync(LANDSCAPE)` no matter what this code does. Needs a fresh
  // native build to take effect, not just a JS reload.
  useFocusEffect(
    useCallback(() => {
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        setIsLandscape(false);
      };
    }, []),
  );

  const handleRotatePress = () => {
    const nextLock = isLandscape
      ? ScreenOrientation.OrientationLock.PORTRAIT_UP
      : ScreenOrientation.OrientationLock.LANDSCAPE;

    ScreenOrientation.lockAsync(nextLock)
      .then(() => setIsLandscape(!isLandscape))
      .catch(() => {
        // Same fallback as web: an unsupported device/OS combination, or a
        // one-off native rejection, still gets a clear "do it yourself" hint
        // rather than a button that looks broken.
        setShowRotateHint(true);
      });
  };

  useEffect(() => {
    if (!showRotateHint) return;
    const timer = setTimeout(() => setShowRotateHint(false), 4000);
    return () => clearTimeout(timer);
  }, [showRotateHint]);

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

          <ThemedView style={styles.tabsRow}>
            <ThemedView style={[styles.densityTabs, { borderColor: theme.border }]}>
              {(
                [
                  { density: 1, label: t('programs.byId.densityImage'), ios: 'photo', android: 'image' },
                  {
                    density: 2,
                    label: t('programs.byId.densityText'),
                    ios: 'list.bullet',
                    android: 'format_list_bulleted',
                  },
                ] as const
              ).map(({ density, label, ios, android }) => (
                <Pressable
                  key={density}
                  style={[
                    styles.densityTab,
                    density !== 1 && { borderLeftWidth: 1, borderLeftColor: theme.border },
                    density === viewDensity && { backgroundColor: theme.backgroundSelected },
                  ]}
                  onPress={() => handleDensitySelect(density)}
                  accessibilityLabel={label}
                >
                  <SymbolView
                    name={{ ios, android, web: android }}
                    size={20}
                    tintColor={theme.text}
                  />
                </Pressable>
              ))}

              {/* Third segment of the same bordered group as the two density
                  buttons above (not a separate box beside it) -- wrapped in
                  its own plain, borderless `ThemedView` purely so the hint
                  below positions itself relative to *this* button specifically
                  rather than the whole three-segment row. */}
              <ThemedView style={styles.rotateCell}>
                <Pressable
                  style={[styles.densityTab, { borderLeftWidth: 1, borderLeftColor: theme.border }]}
                  onPress={handleRotatePress}
                  accessibilityLabel={t('programs.byId.rotateScreen')}
                  hitSlop={Spacing.two}
                >
                  <SymbolView
                    name={{
                      ios: 'arrow.triangle.2.circlepath',
                      android: 'screen_rotation',
                      web: 'screen_rotation',
                    }}
                    size={20}
                    tintColor={theme.text}
                  />
                </Pressable>

                {showRotateHint && (
                  <ElevatedCard style={styles.rotateHint}>
                    <ThemedText type="small">{t('programs.byId.rotateHint')}</ThemedText>
                  </ElevatedCard>
                )}
              </ThemedView>
            </ThemedView>
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
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  densityTabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: Spacing.one,
    borderWidth: 1,
    overflow: 'hidden',
  },
  densityTab: {
    // Same cell size for all three segments (the two density buttons and
    // the rotate button) -- without an explicit height here, a cell sized
    // itself to icon(20)+padding instead, visibly shorter than a sibling
    // cell despite both holding a same-size icon.
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Plain, borderless wrapper around just the rotate button -- exists only
  // so `rotateHint` below (an absolutely-positioned child) anchors to *this*
  // button specifically. RN treats a View's immediate parent as the
  // containing block for an absolutely-positioned child regardless of
  // `position: relative` (unlike web/CSS), so this wrapper doesn't need
  // that style itself for the hint to line up under the rotate button
  // rather than under the whole three-segment `densityTabs` row it's
  // nested inside.
  rotateCell: {
    backgroundColor: 'transparent',
  },
  // Absolutely positioned within `rotateCell` -- unlike web's CSS tooltip,
  // there's no ancestor `overflow: hidden` to fight here (this row isn't
  // inside a horizontally-clipped scroll container the way web's `.detail`
  // is), so a plain top-left anchor is enough; no left/right clipping
  // concern to design around.
  rotateHint: {
    position: 'absolute',
    top: 52,
    left: 0,
    zIndex: 5,
    maxWidth: 180,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  dayBlock: {
    gap: Spacing.three,
  },
});
