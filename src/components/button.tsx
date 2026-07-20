import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ButtonProps {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  /** Escape hatch for per-instance sizing tweaks (e.g. wizard step-nav
   * buttons' extra horizontal padding) — not a general styling API. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The shared primary-action button — outlined, not filled, matching web's
 * `.submit`/`.button` design language (border + transparent fill, no bright
 * accent color; web itself has none). Renders `children` as-is rather than
 * forcing a text wrapper, so call sites keep providing their own
 * `ThemedText`/icon+text content exactly as before, minimizing how much
 * each migrated call site has to change.
 */
export function Button({ onPress, disabled, children, style }: ButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border },
        style,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.one,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
