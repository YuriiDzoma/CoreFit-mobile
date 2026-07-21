import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ScreenLayoutProps extends PropsWithChildren {
  /** Renders a ScrollView (with `theme.background` applied) instead of a
   * plain themed container — for screens whose content can exceed one
   * screen's height (Program Detail, Exercise Detail, Exercise Picker's
   * detail-style screens). Default `false`. */
  scroll?: boolean;
  /** `'center'` for short, form-like content (the auth screens this
   * component was originally built for); `'flex-start'` for top-aligned
   * content such as a list or a multi-step wizard. Default `'center'`. */
  justify?: 'center' | 'flex-start';
  /** Escape hatch for the per-screen values this shell has never
   * standardized (`paddingTop`, `paddingBottom`, and `gap` where a screen
   * genuinely differs from the four-unit default) — merged after the
   * base styles, same role as `Button`'s own `style` prop. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The shared screen shell (SafeAreaView + themed container, optionally a
 * ScrollView) consolidating what was previously duplicated near-verbatim
 * across most screens in the app — see docs/decisions.md's App Shell
 * Consolidation entry for the three shapes this replaces.
 */
export function ScreenLayout({
  scroll = false,
  justify = 'center',
  contentStyle,
  children,
}: ScreenLayoutProps) {
  const theme = useTheme();

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.background }]}
          contentContainerStyle={[styles.container, { justifyContent: justify }, contentStyle]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView
        style={[styles.container, styles.fill, { justifyContent: justify }, contentStyle]}
      >
        {children}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  container: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
});
