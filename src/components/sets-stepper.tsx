import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MIN_SETS = 1;
const MAX_SETS = 7;

interface SetsStepperProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Compact `-`/`+` stepper for the wizard's per-exercise "sets" config
 * (1-7, default 3). No native picker/select component exists anywhere in
 * this app yet — rather than pull in a new dependency for a 7-value range,
 * this reuses the app's own minimal bordered-button language instead of an
 * OS picker wheel. The `×` prefix on the number mirrors this app's own
 * "weight/repsxsets" logged-value convention, so it reads as "sets" in
 * context without needing a separate text label.
 */
export function SetsStepper({ value, onChange }: SetsStepperProps) {
  const theme = useTheme();

  const decrement = () => onChange(Math.max(MIN_SETS, value - 1));
  const increment = () => onChange(Math.min(MAX_SETS, value + 1));

  return (
    <ThemedView style={[styles.wrap, { borderColor: theme.border }]}>
      <Pressable
        onPress={decrement}
        disabled={value <= MIN_SETS}
        hitSlop={Spacing.two}
        style={styles.button}
      >
        <ThemedText type="smallBold" themeColor={value <= MIN_SETS ? 'textSecondary' : 'text'}>
          −
        </ThemedText>
      </Pressable>
      <ThemedText type="small" style={styles.value}>
        ×{value}
      </ThemedText>
      <Pressable
        onPress={increment}
        disabled={value >= MAX_SETS}
        hitSlop={Spacing.two}
        style={styles.button}
      >
        <ThemedText type="smallBold" themeColor={value >= MAX_SETS ? 'textSecondary' : 'text'}>
          +
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  button: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
  },
});
