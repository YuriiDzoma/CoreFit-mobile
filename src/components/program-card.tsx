import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ProgramRow } from '@/lib/supabase/programs';

function formatProgramType(type: string | null): string {
  switch (type) {
    case 'aerobic':
      return 'Aerobic';
    case 'anaerobic':
      return 'Anaerobic';
    case 'crossfit':
      return 'CrossFit';
    default:
      return 'Not specified';
  }
}

function formatProgramLevel(level: string | null): string {
  switch (level) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    case 'expert':
      return 'Expert';
    case 'professional':
      return 'Professional';
    default:
      return 'Not specified';
  }
}

type ProgramCardProps = {
  program: ProgramRow;
  onPress: () => void;
};

export function ProgramCard({ program, onPress }: ProgramCardProps) {
  const theme = useTheme();
  const dayLabel = program.days_count === 1 ? 'day' : 'days';

  return (
    <Pressable onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.card}>
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
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  textStack: {
    flex: 1,
    gap: Spacing.half,
  },
});
