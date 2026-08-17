import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARD_COUNT = 4;

/**
 * Placeholder for the Programs screen's list while it's loading — matches
 * `ProgramCard`/`ProgramsList`'s own current shape exactly (`Spacing.two`
 * list gap, outlined card with `Spacing.two` padding, centered title+
 * subtitle with `Spacing.one` gap between them). The title and
 * "+ Create new program" button above this render unconditionally
 * (not part of any loading state), so this only covers the list itself.
 */
export function ProgramsListSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.list}>
      {Array.from({ length: CARD_COUNT }).map((_, index) => (
        <View key={index} style={[styles.card, { borderColor: theme.border }]}>
          <View style={[styles.title, bg]} />
          <View style={[styles.subtitle, bg]} />
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
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.two,
  },
  title: {
    height: 16,
    width: '40%',
    borderRadius: Spacing.one,
  },
  subtitle: {
    height: 14,
    width: '65%',
    borderRadius: Spacing.one,
  },
});
