import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TAB_COUNT = 5;
const ROW_COUNT = 6;
const TAB_SIZE = 64;
const SEARCH_HEIGHT = 44;

/**
 * Placeholder for the Wiki screen while its exercise list is loading —
 * the real search bar, `MuscleGroupFilter` row, and exercise list are
 * all gated behind the same `loadState.state === 'success'` check
 * (`wiki/index.tsx`), so before this there was nothing but a bare
 * "Loading..." line. Covers all three: a `SearchBar`-shaped block, a row
 * of 64×64 tabs matching `MuscleGroupFilter`'s own size, and a list of
 * bare exercise rows (64×64 thumbnail + name, no card chrome — matches
 * `wiki/index.tsx`'s own `styles.exercise` exactly). The page title
 * above this renders independently (its own loading state).
 */
export function WikiSkeleton() {
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
          <View key={index} style={styles.row}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Spacing.one,
  },
  name: {
    flex: 1,
    height: 16,
    borderRadius: Spacing.one,
  },
});
