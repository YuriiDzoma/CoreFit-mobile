import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface WorkspaceProps extends PropsWithChildren {
  /** Renders a ScrollView (with `theme.workspace` applied) instead of a
   * plain themed container — same role as `ScreenLayout`'s own `scroll`
   * prop. Default `false`. */
  scroll?: boolean;
  /** `'center'` for short, form-like content; `'flex-start'` for
   * top-aligned content such as a list. Default `'center'`. */
  justify?: 'center' | 'flex-start';
  /** Escape hatch for the per-screen values this shell doesn't
   * standardize (`paddingTop`, `paddingBottom`, and `gap` where a screen
   * genuinely differs from the four-unit default) — merged after the base
   * styles, same role as `ScreenLayout`'s own `contentStyle`. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Sprint 39, step one of the Continuous Workspace migration (see
 * docs/decisions.md). Structurally identical to `ScreenLayout` — same
 * `SafeAreaView` shell, same prop API, same max-width centering — the only
 * substantive change is painting with the new `theme.workspace` token
 * instead of `theme.background`, so a migrated screen's surface reads as
 * distinct from the rest of the still-unmigrated app.
 *
 * Deliberately not layering in the fuller Continuous Workspace design (a
 * top-edge marker, tab-bar tone continuity) in this same step — this
 * component's only job right now is to prove the surface token itself
 * looks right on a real device before anything else changes. `ScreenLayout`
 * is untouched and keeps serving every screen that hasn't migrated yet;
 * this coexists alongside it rather than replacing it project-wide in one
 * pass. See docs/decisions.md for the migration plan this is the first
 * step of.
 */
export function Workspace({ scroll = false, justify = 'center', contentStyle, children }: WorkspaceProps) {
  const theme = useTheme();

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.workspace }]}
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
        type="workspace"
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
