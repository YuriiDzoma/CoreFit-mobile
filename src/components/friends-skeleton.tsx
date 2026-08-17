import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROW_COUNT = 3;
const AVATAR_SIZE = 40;

/**
 * Placeholder for the Friends screen's list while it's loading — matches
 * `UserCard`'s own current shape exactly (outlined card, `Spacing.two`
 * gap/`Spacing.three` padding, a 40px round avatar), with a trailing
 * placeholder sized for Friends' own "Remove friend" `Button`. The page
 * title above this renders independently (its own loading state), so
 * this only covers the list itself.
 */
export function FriendsSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.list}>
      {Array.from({ length: ROW_COUNT }).map((_, index) => (
        <View key={index} style={[styles.card, { borderColor: theme.border }]}>
          <View style={[styles.avatar, bg]} />
          <View style={[styles.name, bg]} />
          <View style={[styles.action, bg]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
