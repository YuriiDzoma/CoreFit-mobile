import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

type ElevatedCardProps = PropsWithChildren<{ style?: StyleProp<ViewStyle> }>;

/**
 * Shared "lifted" surface — filled + soft shadow in light mode, filled +
 * a brand-navy glow in dark mode (a plain black shadow disappears against
 * an already-dark background — confirmed via live variant comparison,
 * which also ruled out a neutral-grey fill for the same reason `theme
 * .elevatedBg`'s dark value diverges from `backgroundElement`). Meant to
 * be reused by other card-like surfaces later, not rebuilt per consumer —
 * first user is `ProgramCard`'s `elevated` variant on the My Programs list.
 */
export function ElevatedCard({ children, style }: ElevatedCardProps) {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.elevatedBg },
        scheme === 'dark' ? styles.dark : styles.light,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Spacing.one,
  },
  light: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dark: {
    borderWidth: 1,
    // Same navy as `theme.border` (`#204879`), at low alpha — a thin ring
    // rather than a hard outline. Matches web's
    // `0 0 0 1px rgba(70,120,190,.2), 0 4px 8px rgba(32,72,121,.45)`
    // exactly — `shadowRadius` maps 1:1 to CSS blur radius on RN-web (same
    // as the light variant above, confirmed via live computed-style
    // comparison; an earlier "halved" conversion here was wrong and left
    // the glow half as soft as web's).
    borderColor: 'rgba(70, 120, 190, 0.2)',
    shadowColor: '#204879',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
