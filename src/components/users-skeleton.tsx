import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROW_COUNT = 3;
const AVATAR_SIZE = 40;
const SEARCH_HEIGHT = 44;

/**
 * Placeholder for the Users screen while its profile list is loading —
 * same `UserCard` row shape as `FriendsSkeleton` (see its own comment),
 * plus a `SearchBar`-shaped block on top, which that screen has and
 * Friends doesn't. The page title above this renders independently (its
 * own loading state), so this only covers the search bar and list.
 */
export function UsersSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.search, { backgroundColor: theme.backgroundElement }]}
      />

      <View style={styles.list}>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <View key={index} style={[styles.card, { borderColor: theme.border }]}>
            <View style={[styles.avatar, bg]} />
            <View style={[styles.name, bg]} />
            <View style={[styles.action, bg]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  search: {
    height: SEARCH_HEIGHT,
    borderRadius: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  name: {
    flex: 1,
    height: 16,
    borderRadius: Spacing.one,
  },
  action: {
    width: 110,
    height: 32,
    borderRadius: Spacing.one,
  },
});
