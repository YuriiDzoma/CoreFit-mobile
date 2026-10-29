import { StyleSheet, View } from 'react-native';

import { ElevatedCard } from '@/components/elevated-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROW_COUNT = 3;
const AVATAR_SIZE = 32;
const SEARCH_HEIGHT = 40;

/**
 * Placeholder for the Friends screen's list while it's loading — matches
 * what actually renders there: the `SearchBar` (border included), then
 * `UserCard`'s compact `elevated` variant (`ElevatedCard` surface,
 * `Spacing.two` padding, 32px avatar) with a trailing placeholder sized
 * for the 32px-tall "Remove friend" `Button`. The page title above this
 * renders independently (its own loading state), so this only covers the
 * search bar and list.
 */
export function FriendsSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />

      <View style={styles.list}>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <ElevatedCard key={index} style={styles.card}>
            <View style={[styles.avatar, bg]} />
            <View style={styles.nameCol}>
              <View style={[styles.name, bg]} />
            </View>
            <View style={[styles.action, bg]} />
          </ElevatedCard>
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
    borderWidth: 2,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    width: '50%',
    height: 16,
    borderRadius: Spacing.one,
  },
  action: {
    width: 100,
    height: 32,
    borderRadius: Spacing.one,
  },
});
