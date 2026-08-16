import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useHomeChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { getMuscleGroups, type MuscleGroupRow } from '@/lib/supabase/exercises';
import {
  getExerciseLeaderboards,
  type ExerciseLeaderboard,
  type LeaderboardEntry,
} from '@/lib/supabase/records';

type MuscleGroupsState =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'success'; groups: MuscleGroupRow[] };

type LeaderboardsState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; leaderboards: ExerciseLeaderboard[]; hasMore: boolean };

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function RecordsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = useHomeChromeClearance();

  const [muscleGroupsState, setMuscleGroupsState] = useState<MuscleGroupsState>({ state: 'loading' });
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [leaderboardsState, setLeaderboardsState] = useState<LeaderboardsState>({ state: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFirstPage = useCallback((muscleGroupId: string | null) => {
    setLeaderboardsState({ state: 'loading' });
    getExerciseLeaderboards({ muscleGroupId })
      .then((leaderboards) => {
        setLeaderboardsState({
          state: 'success',
          leaderboards,
          hasMore: leaderboards.length === 10,
        });
      })
      .catch((error: unknown) => {
        setLeaderboardsState({ state: 'error', message: (error as Error).message });
      });
  }, []);

  // Resets the muscle-group filter back to "All" on every visit, matching
  // Home's own always-fresh-on-refocus convention — not preserved across
  // navigating away and back.
  useFocusEffect(
    useCallback(() => {
      setSelectedMuscleGroup(null);
      getMuscleGroups()
        .then((groups) => setMuscleGroupsState({ state: 'success', groups }))
        .catch(() => setMuscleGroupsState({ state: 'error' }));
      fetchFirstPage(null);
    }, [fetchFirstPage]),
  );

  const handleSelectMuscleGroup = (muscleGroupId: string | null) => {
    setSelectedMuscleGroup(muscleGroupId);
    fetchFirstPage(muscleGroupId);
  };

  const handleShowMore = () => {
    if (leaderboardsState.state !== 'success') return;
    setLoadingMore(true);
    getExerciseLeaderboards({
      muscleGroupId: selectedMuscleGroup,
      offset: leaderboardsState.leaderboards.length,
    })
      .then((more) => {
        setLeaderboardsState((prev) =>
          prev.state === 'success'
            ? {
                state: 'success',
                leaderboards: [...prev.leaderboards, ...more],
                hasMore: more.length === 10,
              }
            : prev,
        );
      })
      .finally(() => setLoadingMore(false));
  };

  const handleRetry = () => fetchFirstPage(selectedMuscleGroup);

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText style={[styles.pageTitle, { marginTop: clearance.top }]}>
        {t('components.homeSubNav.records')}
      </ThemedText>

      {muscleGroupsState.state === 'success' && (
        <MuscleGroupFilter
          muscleGroups={muscleGroupsState.groups}
          selectedMuscleGroup={selectedMuscleGroup}
          onSelect={handleSelectMuscleGroup}
          compact
        />
      )}

      {leaderboardsState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('home.records.loading')}
        </ThemedText>
      )}

      {leaderboardsState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {leaderboardsState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {leaderboardsState.state === 'success' &&
        (leaderboardsState.leaderboards.length === 0 ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ paddingBottom: clearance.bottom }}
          >
            {t('home.records.empty')}
          </ThemedText>
        ) : (
          <FlatList
            data={leaderboardsState.leaderboards}
            keyExtractor={(item) => item.exerciseId}
            contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
            renderItem={({ item }) => <ExerciseCard leaderboard={item} theme={theme} t={t} />}
            ListFooterComponent={
              leaderboardsState.hasMore ? (
                <Button onPress={handleShowMore} disabled={loadingMore} style={styles.showMore}>
                  <ThemedText type="smallBold">
                    {loadingMore ? '…' : t('home.records.showMore')}
                  </ThemedText>
                </Button>
              ) : null
            }
          />
        ))}
    </Workspace>
  );
}

function ExerciseCard({
  leaderboard,
  theme,
  t,
}: {
  leaderboard: ExerciseLeaderboard;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <ThemedView style={[styles.card, { borderColor: theme.border }]}>
      <ThemedView style={[styles.exerciseHeader, { backgroundColor: 'transparent' }]}>
        {leaderboard.exerciseImageUrl && (
          <Image source={{ uri: leaderboard.exerciseImageUrl }} style={styles.exerciseIcon} />
        )}
        <ThemedText style={styles.exerciseName}>{leaderboard.exerciseName}</ThemedText>
      </ThemedView>

      <ThemedView style={[styles.entries, { backgroundColor: 'transparent' }]}>
        {leaderboard.entries.map((entry) => (
          <EntryRow key={entry.userId} entry={entry} t={t} />
        ))}
      </ThemedView>
    </ThemedView>
  );
}

function EntryRow({
  entry,
  t,
}: {
  entry: LeaderboardEntry;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <Pressable onPress={() => router.push(`/profile/${entry.userId}`)}>
      <ThemedView style={[styles.row, { backgroundColor: 'transparent' }]}>
        <ThemedText style={styles.rank}>{RANK_MEDALS[entry.rank] ?? `${entry.rank}.`}</ThemedText>
        <Avatar uri={entry.avatarUrl} name={entry.username} size={28} />
        <ThemedText type="small" style={styles.name} numberOfLines={1}>
          {entry.username ?? t('components.userCard.unknownUser')}
        </ThemedText>
        <ThemedText type="small" style={styles.weight}>
          {entry.weight}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  exerciseIcon: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  exerciseName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  entries: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  rank: {
    width: 22,
    fontSize: 15,
  },
  name: {
    flex: 1,
  },
  weight: {
    fontWeight: '700',
  },
  showMore: {
    marginTop: Spacing.two,
  },
});
