import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useHomeChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { getRandomExerciseLeaderboard, type ExerciseLeaderboard } from '@/lib/supabase/records';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; leaderboard: ExerciseLeaderboard | null }
  | { state: 'error'; message: string };

export default function RecordsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = useHomeChromeClearance();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Never resets to 'loading' on refocus — matches Home's own fetchData —
  // so returning to this tab silently swaps in a fresh random exercise
  // rather than flashing the loading state, which also happens to be how
  // "pick a new random exercise" is surfaced: no separate shuffle affordance,
  // just revisit the tab (this app has no pull-to-refresh anywhere else).
  const fetchData = useCallback(() => {
    getRandomExerciseLeaderboard()
      .then((leaderboard) => setLoadState({ state: 'success', leaderboard }))
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
      <ThemedText style={[styles.pageTitle, { marginTop: clearance.top }]}>
        {t('components.homeSubNav.records')}
      </ThemedText>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('home.records.loading')}
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

      {loadState.state === 'success' &&
        (loadState.leaderboard === null ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ paddingBottom: clearance.bottom }}
          >
            {t('home.records.empty')}
          </ThemedText>
        ) : (
          <ThemedView style={[styles.content, { paddingBottom: clearance.bottom }]}>
            <ThemedView style={styles.exerciseHeader}>
              {loadState.leaderboard.exerciseImageUrl && (
                <Image
                  source={{ uri: loadState.leaderboard.exerciseImageUrl }}
                  style={styles.exerciseIcon}
                />
              )}
              <ThemedText style={styles.exerciseName}>
                {loadState.leaderboard.exerciseName}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.list}>
              {loadState.leaderboard.entries.map((entry, index) => (
                <Pressable
                  key={entry.userId}
                  onPress={() => router.push(`/profile/${entry.userId}`)}
                >
                  <ThemedView style={[styles.row, { borderColor: theme.border }]}>
                    <ThemedText style={styles.rank}>{index + 1}.</ThemedText>
                    <Avatar uri={entry.avatarUrl} name={entry.username} size={40} />
                    <ThemedText style={styles.name} numberOfLines={1}>
                      {entry.username ?? t('components.userCard.unknownUser')}
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.weight}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>
        ))}
    </Workspace>
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
  content: {
    gap: Spacing.four,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  exerciseIcon: {
    width: 36,
    height: 36,
    borderRadius: Spacing.one,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.three,
  },
  rank: {
    width: 20,
  },
  name: {
    flex: 1,
  },
});
