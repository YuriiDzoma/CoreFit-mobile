import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROW_COUNT = 4;
const AVATAR_SIZE = 48;

/** Placeholder for the Messages conversation list while it loads —
 * mirrors `UsersSkeleton`'s row shape, adjusted for `ConversationRow`'s
 * own layout (a two-line text column instead of one, plus a trailing
 * meta column rather than an action button). */
export function MessagesSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.list}>
      {Array.from({ length: ROW_COUNT }).map((_, index) => (
        <View key={index} style={[styles.row, { borderColor: theme.border }]}>
          <View style={[styles.avatar, bg]} />
          <View style={styles.textCol}>
            <View style={[styles.nameLine, bg]} />
            <View style={[styles.previewLine, bg]} />
          </View>
          <View style={[styles.timeLine, bg]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
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
  textCol: {
    flex: 1,
    gap: Spacing.one,
  },
  nameLine: {
    height: 14,
    width: '40%',
    borderRadius: Spacing.half,
  },
  previewLine: {
    height: 12,
    width: '70%',
    borderRadius: Spacing.half,
  },
  timeLine: {
    height: 10,
    width: 32,
    borderRadius: Spacing.half,
  },
});
