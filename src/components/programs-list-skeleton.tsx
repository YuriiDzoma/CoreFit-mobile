import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARD_COUNT = 4;

/**
 * Placeholder for the Programs screen's list while it's loading — matches
 * web's own `ProgramsListSkeleton` exactly (`ui/skeleton/skeleton.tsx`):
 * each item is a single flat, unbordered, filled rectangle
 * (`.programList__item`: 52px tall, 4px radius), not a bordered card with
 * separate title/subtitle bars inside — the real `ProgramCard` content is
 * just centered text with no avatar/image, so one solid block reads fine
 * without faking that extra structure. The title above this renders
 * unconditionally (not part of any loading state), so this only covers
 * the list itself.
 *
 * `itemHeight` defaults to `ProgramCard`'s 52px; Complexes passes its own
 * accordion header's height (62px: 16px title line of 24 + small 20 line
 * + 2 gap + 8px padding each side).
 */
export function ProgramsListSkeleton({ itemHeight = 52 }: { itemHeight?: number }) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {Array.from({ length: CARD_COUNT }).map((_, index) => (
        <View
          key={index}
          style={[styles.item, { height: itemHeight, backgroundColor: theme.skeletonBg }]}
        />
      ))}
    </View>
  );
}

/**
 * Placeholder for the "+ Create new program" button, matching web's
 * `.createLink` height (40px) — shown in its place while the screen is
 * still loading.
 */
export function ProgramCreateSkeleton() {
  const theme = useTheme();

  return <View style={[styles.create, { backgroundColor: theme.skeletonBg }]} />;
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  item: {
    borderRadius: Spacing.one,
  },
  create: {
    height: 40,
    borderRadius: Spacing.one,
  },
});
