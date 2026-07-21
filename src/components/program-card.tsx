import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType, type ProgramRow } from '@/lib/supabase/programs';

type ProgramCardProps = {
  program: ProgramRow;
  onPress: () => void;
  /** Optional slot rendered between the text stack and the chevron —
   * introduced for the Complexes list's "Added" indicator. Unused by
   * every other call site so far, so it's a no-op by default. */
  badge?: ReactNode;
};

export function ProgramCard({ program, onPress, badge }: ProgramCardProps) {
  const theme = useTheme();
  const dayLabel = program.days_count === 1 ? 'day' : 'days';

  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.card, { borderColor: theme.border }]}>
        <ThemedView style={styles.textStack}>
          <ThemedText>{program.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatProgramType(program.type)} • {formatProgramLevel(program.level)} •{' '}
            {program.days_count} {dayLabel}
          </ThemedText>
        </ThemedView>
        {badge}
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={16}
          tintColor={theme.textSecondary}
        />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.three,
  },
  textStack: {
    flex: 1,
    gap: Spacing.half,
  },
});
