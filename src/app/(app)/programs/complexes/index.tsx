import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { ElevatedCard } from '@/components/elevated-card';
import { ProgramsListSkeleton } from '@/components/programs-list-skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType } from '@/lib/format-enums';
import {
  addGlobalProgramToUser,
  getGlobalPrograms,
  getGlobalProgramDetail,
  getUserGlobalProgramMap,
  removeGlobalProgramFromUser,
  type GlobalProgramDetailRow,
  type GlobalProgramRow,
} from '@/lib/supabase/complexes';
import { getExercises, localizeExercise, type LocalizedExercise } from '@/lib/supabase/exercises';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      programs: GlobalProgramRow[];
      ownedMap: Record<string, string>;
      exerciseCatalog: Map<string, LocalizedExercise>;
    }
  | { state: 'error'; message: string };

// Matches web's ExpandMoreIcon (MUI, `complexes.tsx`'s AccordionSummary)
// — the standard Material "expand_more" glyph, not an approximation.
// Rotation itself is driven by the caller (an Animated.View wrapper) so
// it can animate smoothly alongside the accordion's own open/close
// transition, same as MUI's own CSS-transform approach.
function ExpandIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" fill={color} />
    </Svg>
  );
}

const ACCORDION_ANIMATION_CONFIG = { duration: 220, easing: Easing.out(Easing.cubic) };

export default function ComplexesScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useTrainingChromeClearance();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuation, never
  // synchronously at call time — safe to invoke directly from the effect.
  // The exercise catalog is fetched once here (not per-accordion-expand)
  // since every card's exercise rows draw from the same table.
  const fetchData = (userId: string) => {
    Promise.all([getGlobalPrograms(), getUserGlobalProgramMap(userId), getExercises()])
      .then(([programs, ownedMap, exercises]) => {
        const exerciseCatalog = new Map(
          exercises.map((exercise) => [exercise.id, localizeExercise(exercise)]),
        );
        setLoadState({ state: 'success', programs, ownedMap, exerciseCatalog });
      })
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

  const handleOwnedChange = (programId: string, ownedProgramId: string | null) => {
    setLoadState((prev) => {
      if (prev.state !== 'success') return prev;
      const nextOwnedMap = { ...prev.ownedMap };
      if (ownedProgramId) {
        nextOwnedMap[programId] = ownedProgramId;
      } else {
        delete nextOwnedMap[programId];
      }
      return { ...prev, ownedMap: nextOwnedMap };
    });
  };

  const title = (
    <ThemedText type="pageTitle">{t('components.trainingSubNav.complexes')}</ThemedText>
  );

  // The FlatList (not a static title sibling above it) is what needs to
  // fill Workspace's full flex:1 frame, top to bottom, the same way
  // `(home)/index.tsx`'s own feed does — `clearance.top`/`.bottom` belong
  // on *its* `contentContainerStyle` as internal padding, not as a
  // margin on an element sitting outside/above the scrollable area.
  // A title rendered as a fixed sibling instead (the previous shape here)
  // caps the list's own frame at the title's bottom edge, so it can never
  // scroll its top content up behind the floating header the way Home's
  // does — only the *actual* scrollable state (a non-empty list) needs
  // this; loading/error/empty are static, single-screen content with no
  // meaningful "scroll behind chrome" of their own, matching Home's same
  // split (its loading/error blocks use a plain `marginTop`, only its
  // success FlatList uses internal `paddingTop`).
  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      {loadState.state === 'loading' && (
        <ThemedView style={{ marginTop: clearance.top, gap: Spacing.three }}>
          {title}
          <ProgramsListSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={{ marginTop: clearance.top, gap: Spacing.three }}>
          {title}
          <ThemedView style={styles.errorBlock}>
            <ThemedText type="small" themeColor="danger">
              ❌ {loadState.message}
            </ThemedText>
            <Pressable onPress={handleRetry}>
              <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>
      )}

      {loadState.state === 'success' && loadState.programs.length === 0 && (
        <ThemedView style={{ marginTop: clearance.top, gap: Spacing.three }}>
          {title}
          <ThemedText type="small" themeColor="textSecondary">
            {t('programs.complexes.empty')}
          </ThemedText>
        </ThemedView>
      )}

      {loadState.state === 'success' && loadState.programs.length > 0 && (
        <FlatList
          data={loadState.programs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={title}
          contentContainerStyle={[
            styles.list,
            { paddingTop: clearance.top, paddingBottom: clearance.bottom },
          ]}
          renderItem={({ item }) => (
            <GlobalProgramAccordion
              program={item}
              ownedProgramId={loadState.ownedMap[item.id] ?? null}
              exerciseCatalog={loadState.exerciseCatalog}
              userId={user?.id}
              onOwnedChange={handleOwnedChange}
            />
          )}
        />
      )}
    </Workspace>
  );
}

type DetailState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; detail: GlobalProgramDetailRow };

type ActionState = { state: 'idle' } | { state: 'working' } | { state: 'error'; message: string };

// One card per global program, each managing its own expand/collapse and
// detail fetch independently — matches web's own uncontrolled MUI
// `<Accordion>` usage (no `expanded`/`onChange` passed there either), so
// several cards can be open at once, not exclusively one at a time.
// Detail (days/exercises) is fetched lazily on first expand rather than
// upfront for every program in the list, unlike web's own
// fetchGlobalProgramsWithDetails — a mobile-appropriate adaptation of the
// same visual result, not a difference the user can see.
function GlobalProgramAccordion({
  program,
  ownedProgramId,
  exerciseCatalog,
  userId,
  onOwnedChange,
}: {
  program: GlobalProgramRow;
  ownedProgramId: string | null;
  exerciseCatalog: Map<string, LocalizedExercise>;
  userId: string | undefined;
  onOwnedChange: (programId: string, ownedProgramId: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [detailState, setDetailState] = useState<DetailState>({ state: 'idle' });
  const [actionState, setActionState] = useState<ActionState>({ state: 'idle' });

  // The content wrapper stays mounted (not conditionally rendered) once
  // a first expand has kicked off a fetch — `measuredHeight` is captured
  // via `onLayout` on its actual natural size and cached across
  // collapse/reopen cycles, so only the very first expand needs to grow
  // in steps (a small "loading…" height, then the full content height
  // once the fetch resolves and `onLayout` re-fires) — every later
  // toggle already knows its target height and animates directly to it.
  // RN has no native `height: auto` transition, so this measure-then-
  // animate-to-a-concrete-value approach is the standard way to get a
  // smooth open/close instead of an instant snap.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const animatedHeight = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withTiming(expanded ? measuredHeight : 0, ACCORDION_ANIMATION_CONFIG);
    rotation.value = withTiming(expanded ? 180 : 0, ACCORDION_ANIMATION_CONFIG);
  }, [expanded, measuredHeight, animatedHeight, rotation]);

  const animatedContentStyle = useAnimatedStyle(() => ({ height: animatedHeight.value }));
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleContentLayout = (event: LayoutChangeEvent) => {
    setMeasuredHeight(event.nativeEvent.layout.height);
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && detailState.state === 'idle') {
      setDetailState({ state: 'loading' });
      getGlobalProgramDetail(program.id)
        .then((detail) => setDetailState({ state: 'success', detail }))
        .catch((error: unknown) =>
          setDetailState({ state: 'error', message: (error as Error).message }),
        );
    }
  };

  const handleToggleOwned = () => {
    if (!userId) return;
    setActionState({ state: 'working' });
    const request = ownedProgramId
      ? removeGlobalProgramFromUser(program.id, userId).then(() => null)
      : addGlobalProgramToUser(program.id, userId);

    request
      .then((newOwnedProgramId) => {
        setActionState({ state: 'idle' });
        onOwnedChange(program.id, newOwnedProgramId);
      })
      .catch((error: unknown) => {
        setActionState({ state: 'error', message: (error as Error).message });
      });
  };

  const exerciseName = (exerciseId: string | null): string =>
    (exerciseId && exerciseCatalog.get(exerciseId)?.name) || t('common.unknownExercise');
  const exerciseImage = (exerciseId: string | null): string | null =>
    (exerciseId && exerciseCatalog.get(exerciseId)?.imageUrl) || null;

  return (
    <ElevatedCard>
      {/* A separate inner clip layer, not `overflow:'hidden'` on the
          `ElevatedCard` itself — RN clips a view's own shadow along with
          its content, so putting `overflow:'hidden'` (needed so the
          header/content's square edges don't flatten the card's rounded
          corners once expanded) directly on the shadowed view would clip
          the shadow/glow away too. This inner view carries the same
          radius and does the clipping instead, leaving the outer
          `ElevatedCard`'s shadow undisturbed. */}
      <View style={styles.cardClip}>
        <Pressable style={styles.cardHeader} onPress={handleToggle}>
          <ThemedView style={[styles.cardHeaderText, { backgroundColor: 'transparent' }]}>
            <ThemedText style={styles.cardTitle}>
              {program.title || t('programs.byId.untitled')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.byId.typeLabel')}
              {formatProgramType(t, program.type)} | {t('programs.byId.levelLabel')}
              {formatProgramLevel(t, program.level)}
            </ThemedText>
          </ThemedView>
          <Animated.View style={animatedIconStyle}>
            <ExpandIcon color={theme.text} />
          </Animated.View>
        </Pressable>

        {detailState.state !== 'idle' && (
          <Animated.View style={[styles.cardContentClip, animatedContentStyle]}>
            <View onLayout={handleContentLayout} style={styles.cardContent}>
              {detailState.state === 'loading' && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('programs.loadingProgram')}
                </ThemedText>
              )}

              {detailState.state === 'error' && (
                <ThemedText type="small" themeColor="danger">
                  ❌ {detailState.message}
                </ThemedText>
              )}

              {detailState.state === 'success' &&
                detailState.detail.global_program_days.map((day) => (
                  <ThemedView key={day.id} style={[styles.dayBlock, { backgroundColor: 'transparent' }]}>
                    <ThemedText type="smallBold">
                      {t('programs.day', { number: day.day_number })}
                    </ThemedText>
                    {day.global_program_exercises.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('programs.byId.noExercisesForDay')}
                      </ThemedText>
                    ) : (
                      day.global_program_exercises.map((exercise) => {
                        const imageUrl = exerciseImage(exercise.exercise_id);
                        return (
                          <ThemedView
                            key={exercise.id}
                            style={[styles.exerciseRow, { backgroundColor: 'transparent' }]}
                          >
                            {imageUrl && (
                              <Image source={{ uri: imageUrl }} style={styles.exerciseImage} />
                            )}
                            <ThemedText type="small">
                              {exerciseName(exercise.exercise_id)}
                            </ThemedText>
                          </ThemedView>
                        );
                      })
                    )}
                  </ThemedView>
                ))}

              {detailState.state === 'success' && (
                <Button
                  onPress={handleToggleOwned}
                  disabled={actionState.state === 'working'}
                  style={[styles.actionButton, ownedProgramId && { borderColor: theme.danger }]}
                >
                  <ThemedText type="smallBold" themeColor={ownedProgramId ? 'danger' : 'text'}>
                    {actionState.state === 'working'
                      ? t('programs.complexes.working')
                      : ownedProgramId
                        ? t('programs.complexes.removeFromMyPrograms')
                        : t('programs.complexes.addToMyPrograms')}
                  </ThemedText>
                </Button>
              )}

              {actionState.state === 'error' && (
                <ThemedText type="small" themeColor="danger">
                  ❌ {actionState.message}
                </ThemedText>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </ElevatedCard>
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
  // Matches `ElevatedCard`'s own base radius (`Spacing.one`) exactly, not
  // a separate value — see the `ElevatedCard` render comment above for
  // why this can't just be `overflow:'hidden'` on `ElevatedCard` itself.
  cardClip: {
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Height is driven entirely by `animatedContentStyle` — this only
  // needs to clip whatever doesn't fit yet during the animation.
  cardContentClip: {
    overflow: 'hidden',
  },
  cardContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  dayBlock: {
    gap: Spacing.two,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseImage: {
    width: 40,
    height: 40,
    borderRadius: Spacing.one,
  },
  // Overrides Button's own default 2px border — this one specific
  // instance needed a thinner 1px border per live feedback.
  actionButton: {
    borderWidth: 1,
  },
});
