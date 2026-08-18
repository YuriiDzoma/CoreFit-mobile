import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TAB_COUNT = 5;
const ROW_COUNT = 6;
const TAB_SIZE = 64;
const SEARCH_HEIGHT = 44;

/**
 * Placeholder for the exercise-picker screen while its list is loading —
 * same search bar + `MuscleGroupFilter` row as `WikiSkeleton` (see its
 * own comment for why both are needed, not just the list), but this
 * screen's own rows are filled `backgroundElement` cards (`styles.card`,
 * `Spacing.three` radius, a 64×64 thumbnail), not Wiki's bare rows — so
 * a separate component rather than reusing WikiSkeleton verbatim.
 */
export function ExercisePickerSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.wrap}>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]} />

      <View style={styles.tabs}>
        {Array.from({ length: TAB_COUNT }).map((_, index) => (
          <View key={index} style={[styles.tab, bg]} />
        ))}
      </View>

      <View style={styles.list}>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={[styles.thumbnail, bg]} />
            <View style={[styles.name, bg]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  search: {
    height: SEARCH_HEIGHT,
    borderRadius: Spacing.two,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tab: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderRadius: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  name: {
    flex: 1,
    height: 16,
    borderRadius: Spacing.one,
  },
});
