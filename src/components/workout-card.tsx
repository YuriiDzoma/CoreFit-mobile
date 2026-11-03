import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type TrainingHistoryFeedRow } from '@/lib/supabase/training-history';

// Web formats this date as 2-digit uk-UA ("05.09.26") regardless of the
// UI language — matched as-is.
function formatFinishedDate(date: string): string {
  return new Date(date).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

interface WorkoutCardProps {
  entry: TrainingHistoryFeedRow;
  exerciseNames: Map<string, string>;
  /** Home's feed links the author to their profile; the profile Wall
   * doesn't (every entry there is that same profile's). */
  onUserPress?: () => void;
}

/**
 * One completed workout — the card shared by the Home feed and the profile
 * Wall, a port of web's `.historyCard` (trainingHistories.module.scss,
 * measured live at 390px): square 32px avatar + 16px name, "Закінчив
 * тренування - 05.09.26" with the date semibold, then one 14px line per
 * exercise with its value bold, 8px past the colon.
 */
export function WorkoutCard({ entry, exerciseNames, onUserPress }: WorkoutCardProps) {
  const { t } = useTranslation();

  return (
    <ElevatedCard style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.userInfo} disabled={!onUserPress} onPress={onUserPress}>
          <Avatar
            uri={entry.profiles?.avatar_url}
            name={entry.profiles?.username}
            size={32}
            radius={0}
          />
          <ThemedText style={styles.name}>{entry.profiles?.username ?? t('home.unknown')}</ThemedText>
        </Pressable>
        <View style={styles.dateRow}>
          <ThemedText style={styles.text}>{t('home.finished')}</ThemedText>
          <ThemedText style={[styles.text, styles.date]}>{formatFinishedDate(entry.date)}</ThemedText>
        </View>
      </View>

      <View style={styles.exerciseList}>
        {Object.entries(entry.values).map(([programExerciseId, value]) => (
          <ThemedText key={programExerciseId} style={styles.text}>
            {exerciseNames.get(programExerciseId) ?? t('common.unknownExercise')}:{' '}
            {/* An en space stands in for web's `margin-left: 8px` — nested
                Text can't take margins. */}
            <ThemedText style={[styles.text, styles.weight]}>{` ${value}`}</ThemedText>
          </ThemedText>
        ))}
      </View>
    </ElevatedCard>
  );
}

// Matches web's NewsSkeleton exactly (ui/skeleton/skeleton.tsx/.module.scss)
// — a solid `skeletonWrapperBg` fill (not the real card's elevated look —
// the skeleton has its own, deliberately distinct visual language on web),
// centered avatar+name and a single combined "Finished" bar, then 6
// left-aligned exercise-line bars at 80% width. No shimmer/animation.
export function WorkoutCardSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={[styles.skeletonCard, { backgroundColor: theme.skeletonWrapperBg }]}>
      <View style={styles.skeletonHeaderRow}>
        <View style={[styles.skeletonAvatar, bg]} />
        <View style={[styles.skeletonBar, styles.skeletonName, bg]} />
      </View>
      <View style={[styles.skeletonBar, styles.skeletonFinished, bg]} />
      <View style={styles.skeletonList}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={[styles.skeletonBar, styles.skeletonLine, bg]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  text: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 400,
  },
  date: {
    fontWeight: 600,
  },
  exerciseList: {
    gap: Spacing.one,
  },
  weight: {
    fontWeight: 700,
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
  // NewsSkeleton's own bar sizes (16px bars, 2px above and below).
  skeletonFinished: {
    width: 200,
    height: 16,
    marginVertical: Spacing.half,
  },
  skeletonList: {
    width: '100%',
    gap: Spacing.half,
  },
  skeletonLine: {
    width: '80%',
    height: 16,
    marginVertical: Spacing.half,
  },
});
