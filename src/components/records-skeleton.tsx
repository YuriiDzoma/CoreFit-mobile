import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARD_COUNT = 3;
const ENTRY_COUNT = 2;

/**
 * Placeholder for the Records screen's leaderboard-card list while
 * `leaderboardsState` is loading — the title and `MuscleGroupFilter` tabs
 * above it already render independently (they have their own loading
 * state), so this only covers the list itself.
 *
 * Filled-wrapper cards (`theme.skeletonWrapperBg`, no border) matching
 * `HomeCardSkeleton`'s own visual language on the Trainings/history feed
 * ((home)/index.tsx), not the real `records.tsx` card's own border-only
 * treatment — an explicit request to bring Records' skeleton into the
 * same style, not a fidelity fix. Row anatomy (rank/avatar/name/weight)
 * still mirrors `records.tsx`'s own `EntryRow` exactly, rather than
 * collapsing to a single generic bar per row — a leaderboard reads as a
 * leaderboard shape even as a placeholder. No shimmer animation, matching
 * every other skeleton in this app.
 */
export function RecordsSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.list}>
      {Array.from({ length: CARD_COUNT }).map((_, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.skeletonWrapperBg }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardImage, bg]} />
            <View style={[styles.cardName, bg]} />
          </View>
          {Array.from({ length: ENTRY_COUNT }).map((_, entryIndex) => (
            <View key={entryIndex} style={styles.entryRow}>
              <View style={[styles.entryRank, bg]} />
              <View style={[styles.entryAvatar, bg]} />
              <View style={[styles.entryName, bg]} />
              <View style={[styles.entryWeight, bg]} />
            </View>
          ))}
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
    borderRadius: Spacing.one,
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
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entryRank: {
    width: 22,
    height: 14,
    borderRadius: Spacing.one,
  },
  entryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  entryName: {
    flex: 1,
    height: 14,
    borderRadius: Spacing.one,
  },
  entryWeight: {
    width: 40,
    height: 14,
    borderRadius: Spacing.one,
  },
});
