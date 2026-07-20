import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType, type ProgramRow } from '@/lib/supabase/programs';

type ProgramCardProps = {
  program: ProgramRow;
  onPress: () => void;
};

export function ProgramCard({ program, onPress }: ProgramCardProps) {
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
