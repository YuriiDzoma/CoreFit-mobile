import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ButtonProps {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  /** `'outline'` (default) matches web's `.button` — border only, fill is
   * the page background, effectively "invisible" until pressed. `'filled'`
   * matches web's `.submit` — same border, a real `accentFill` fill
   * (`--submit-bg`), and full-width (`.submit`'s `width: 100%`), reserved
   * for a screen's one primary action (e.g. "+ Create new program"). Both
   * share every other web-measured value (border width/color, radius,
   * padding, min-height). */
  variant?: 'outline' | 'filled';
  /** Escape hatch for per-instance sizing tweaks (e.g. wizard step-nav
   * buttons' extra horizontal padding) — not a general styling API. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The shared action button — outlined by default, matching web's `.button`
 * design language (border + transparent fill, no bright accent color; web
 * itself has none). Renders `children` as-is rather than forcing a text
 * wrapper, so call sites keep providing their own `ThemedText`/icon+text
 * content exactly as before, minimizing how much each migrated call site
 * has to change.
 */
export function Button({ onPress, disabled, children, variant = 'outline', style }: ButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border },
        variant === 'filled' && { backgroundColor: theme.accentFill, alignSelf: 'stretch' },
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
