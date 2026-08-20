import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useHomeChromeClearance } from '@/hooks/use-chrome-clearance';
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

// Matches web's NewsSkeleton exactly (ui/skeleton/skeleton.tsx/.module.scss)
// — measured, not estimated: a solid `skeletonWrapperBg` fill (not the real
// card's border-only treatment — the skeleton has its own, deliberately
// distinct visual language on web), centered avatar+name and a single
// combined "Finished" bar, then 6 left-aligned exercise-line bars at 80%
// width. No shimmer/animation — confirmed by reading skeleton.module.scss
// directly: it has no @keyframes or animation property anywhere.
function HomeCardSkeleton() {
  const theme = useTheme();

  return (
    <View style={[styles.skeletonCard, { backgroundColor: theme.skeletonWrapperBg }]}>
      <View style={styles.skeletonHeaderRow}>
        <View style={[styles.skeletonAvatar, { backgroundColor: theme.skeletonBg }]} />
        <View
          style={[styles.skeletonBar, styles.skeletonName, { backgroundColor: theme.skeletonBg }]}
        />
      </View>
      <View
        style={[styles.skeletonBar, styles.skeletonFinished, { backgroundColor: theme.skeletonBg }]}
      />
      <View style={styles.skeletonList}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View
            key={index}
            style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.skeletonBg }]}
          />
        ))}
      </View>
    </View>
  );
}

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
      {loadState.state === 'loading' && (
        <ThemedView style={[styles.list, { marginTop: clearance.top }]}>
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'error' && (
        <ThemedView
          style={[styles.errorBlock, { backgroundColor: 'transparent', marginTop: clearance.top }]}
        >
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
          contentContainerStyle={[
            styles.list,
            { paddingTop: clearance.top, paddingBottom: clearance.bottom },
          ]}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              {t('home.noActivity')}
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ElevatedCard style={styles.card}>
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
                  <ThemedText type="small">
                    {item.profiles?.username ?? t('home.unknown')}
                  </ThemedText>
                </Pressable>
                <ThemedView style={[styles.dateRow, { backgroundColor: 'transparent' }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('home.finished')}
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
                    {loadState.exerciseNames.get(programExerciseId) ?? t('common.unknownExercise')}:{' '}
                    <ThemedText type="smallBold">{value}</ThemedText>
                  </ThemedText>
                ))}
              </ThemedView>
            </ElevatedCard>
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
  card: {
    // Radius comes from `ElevatedCard`'s own base (`Spacing.one`), already
    // the same value this used explicitly before. Height is intentionally
    // left content-driven (variable exercise-list length per entry), not
    // matched to any other card's fixed height.
    padding: Spacing.two,
    gap: Spacing.three,
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
  // Measured from skeleton.module.scss's `.news` rule set.
  skeletonCard: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.three,
    alignItems: 'center',
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  skeletonAvatar: {
    width: 32,
    height: 32,
  },
  skeletonBar: {
    borderRadius: Spacing.one,
  },
  skeletonName: {
    width: 90,
    height: 19,
  },
  skeletonFinished: {
    width: 200,
    height: 16,
  },
  skeletonList: {
    width: '100%',
    gap: Spacing.half,
  },
  skeletonLine: {
    width: '80%',
    height: 16,
  },
});
