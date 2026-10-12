import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExercises, localizeExercise } from '@/lib/supabase/exercises';
import { getExerciseIdsForProgramExercises } from '@/lib/supabase/programs';
import {
  getTrainingHistoryFeedForUser,
  WALL_PAGE_SIZE,
  type TrainingHistoryFeedRow,
} from '@/lib/supabase/training-history';

// Resolving exercise names is the same three-step chain regardless of which
// page of entries it's for — factored out so `loadFirstPage`/`loadMore`
// below don't duplicate it, and so a "load more" page's names get merged
// into the running map rather than replacing it (an earlier page's already-
// resolved names must survive a later page's fetch).
function resolveExerciseNames(
  entries: TrainingHistoryFeedRow[],
): Promise<Map<string, string>> {
  const programExerciseIds = Array.from(
    new Set(entries.flatMap((entry) => Object.keys(entry.values))),
  );
  return getExerciseIdsForProgramExercises(programExerciseIds).then((exerciseIdByProgramExerciseId) =>
    getExercises().then((exercises) => {
      const nameByExerciseId = new Map(
        exercises.map((exercise) => [exercise.id, localizeExercise(exercise).name]),
      );
      const exerciseNames = new Map<string, string>();
      for (const [programExerciseId, exerciseId] of Object.entries(exerciseIdByProgramExerciseId)) {
        const name = nameByExerciseId.get(exerciseId);
        if (name) exerciseNames.set(programExerciseId, name);
      }
      return exerciseNames;
    }),
  );
}

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      entries: TrainingHistoryFeedRow[];
      exerciseNames: Map<string, string>;
      // A page shorter than `WALL_PAGE_SIZE` means the table had no more
      // rows to give back — matches Records' own `leaderboards.length ===
      // 10` derivation (`records.tsx`) exactly, same reasoning.
      hasMore: boolean;
    }
  | { state: 'error' };

interface UserWallProps {
  userId: string;
}

// Matches HomeScreen's own skeleton card exactly (same anatomy: avatar+name
// header, a "Finished" bar, six exercise-line bars) — this is that same
// feed, just scoped to one user, so it reuses the identical loading shape
// rather than inventing a new one.
function WallCardSkeleton() {
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

/**
 * Profile screen's "Wall" section — the same completed-workout feed cards
 * as the Home tab (`(home)/index.tsx`), scoped to just this one profile's
 * own history via `getTrainingHistoryFeedForUser` instead of Home's
 * all-users `getTrainingHistoryFeed`. Rendered below the trainer/client
 * preview on both the own-profile and other-user-profile screens.
 *
 * Unlike Home's cards, there's no avatar/username press-to-navigate here —
 * every entry already belongs to the profile this block is rendered on, so
 * a link back to that same profile would be redundant.
 *
 * Self-fetching (like `WorkoutLogForm`'s drafts), not pure-rendering (like
 * `FriendsPreview`/`PeoplePreview`) — the exercise-name resolution this
 * needs is a self-contained, three-step chain unrelated to the profile
 * screen's own friendship/trainer-link fetch, so folding it into that
 * screen's `Promise.all` would just be unrelated complexity pushed
 * upstream for no benefit.
 *
 * Renders nothing at all once loaded empty — matches `FriendsPreview`'s/
 * `PeoplePreview`'s own "don't show an empty-state prompt" convention for
 * this profile screen specifically (see docs/decisions.md).
 */
export function UserWall({ userId }: UserWallProps) {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);

  // No synchronous `setLoadState({state:'loading'})` reset at the top of
  // this effect (an eslint react-hooks/set-state-in-effect violation) --
  // both profile screens that render this remount it fresh on every route
  // change (Expo Router keys a new screen instance per route param), so
  // `userId` never actually changes under an already-mounted instance in
  // practice; the initial `useState` value already covers the one real
  // case (first mount).
  useEffect(() => {
    let isMounted = true;

    getTrainingHistoryFeedForUser(userId)
      .then((entries) =>
        resolveExerciseNames(entries).then((exerciseNames) => {
          if (!isMounted) return;
          setLoadState({
            state: 'success',
            entries,
            exerciseNames,
            hasMore: entries.length === WALL_PAGE_SIZE,
          });
        }),
      )
      .catch(() => {
        if (isMounted) setLoadState({ state: 'error' });
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Loads the next `WALL_PAGE_SIZE` entries and appends them — matches
  // `records.tsx`'s own `handleShowMore` shape (offset = however many
  // rows are already loaded, `hasMore` re-derived from the new page's own
  // length, not the running total). `exerciseNames` is merged rather than
  // replaced: an earlier page's already-resolved names must survive a
  // later page's own (smaller, page-scoped) resolution.
  const handleShowMore = () => {
    if (loadState.state !== 'success') return;
    setLoadingMore(true);
    getTrainingHistoryFeedForUser(userId, loadState.entries.length)
      .then((moreEntries) =>
        resolveExerciseNames(moreEntries).then((moreExerciseNames) => {
          setLoadState((prev) =>
            prev.state === 'success'
              ? {
                  state: 'success',
                  entries: [...prev.entries, ...moreEntries],
                  exerciseNames: new Map([...prev.exerciseNames, ...moreExerciseNames]),
                  hasMore: moreEntries.length === WALL_PAGE_SIZE,
                }
              : prev,
          );
        }),
      )
      .finally(() => setLoadingMore(false));
  };

  // Matches the sibling sections on this screen (FriendsPreview/
  // PeoplePreview): a failed or empty fetch renders nothing rather than an
  // error message or empty-state prompt — a wall with nothing on it isn't
  // worth a whole section's worth of chrome.
  if (loadState.state === 'error') return null;
  if (loadState.state === 'success' && loadState.entries.length === 0) return null;

  return (
    <ThemedView>
      <ThemedText type="smallBold" style={styles.header}>
        {t('profile.wall.title')}
      </ThemedText>

      {loadState.state === 'loading' && (
        <ThemedView style={styles.list}>
          <WallCardSkeleton />
          <WallCardSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <ThemedView style={styles.list}>
          {loadState.entries.map((entry) => (
            <ElevatedCard key={entry.id} style={styles.card}>
              <ThemedView style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
                <ThemedView style={styles.userInfo}>
                  <Avatar uri={entry.profiles?.avatar_url} name={entry.profiles?.username} size={32} />
                  <ThemedText type="small">
                    {entry.profiles?.username ?? t('home.unknown')}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={[styles.dateRow, { backgroundColor: 'transparent' }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('home.finished')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(entry.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={[styles.exerciseList, { backgroundColor: 'transparent' }]}>
                {Object.entries(entry.values).map(([programExerciseId, value]) => (
                  <ThemedText key={programExerciseId} type="small">
                    {loadState.exerciseNames.get(programExerciseId) ?? t('common.unknownExercise')}:{' '}
                    <ThemedText type="smallBold">{value}</ThemedText>
                  </ThemedText>
                ))}
              </ThemedView>
            </ElevatedCard>
          ))}

          {loadState.hasMore && (
            <Button onPress={handleShowMore} disabled={loadingMore} style={styles.showMore}>
              <ThemedText type="smallBold">
                {loadingMore ? '…' : t('profile.wall.showMore')}
              </ThemedText>
            </Button>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
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
    backgroundColor: 'transparent',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  exerciseList: {
    gap: Spacing.half,
  },
  // Matches `records.tsx`'s own identical button.
  showMore: {
    marginTop: Spacing.two,
  },
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
