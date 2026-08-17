import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARD_COUNT = 3;

/**
 * Placeholder for the Records screen's leaderboard-card list while
 * `leaderboardsState` is loading — the title and `MuscleGroupFilter` tabs
 * above it already render independently (they have their own loading
 * state), so this only covers the list itself. Sized to match the real
 * `ProgramCard`-shaped cards exactly (`records.tsx`'s own `styles.card`:
 * `Spacing.two` gap/padding, a 64×64 image), not estimated. No shimmer
 * animation — matches web's own skeleton system (`ui/skeleton`), which is
 * static colored boxes too.
 */
export function RecordsSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.list}>
      {Array.from({ length: CARD_COUNT }).map((_, index) => (
        <View key={index} style={[styles.card, { borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardImage, bg]} />
            <View style={[styles.cardName, bg]} />
          </View>
          <View style={[styles.cardRow, bg]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  cardName: {
    flex: 1,
    height: 16,
    borderRadius: Spacing.one,
  },
  cardRow: {
    height: 14,
    width: '60%',
    borderRadius: Spacing.one,
  },
});
