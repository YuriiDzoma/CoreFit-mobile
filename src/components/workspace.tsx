import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

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
  /** Phase 1, App Shell & Chrome Ownership (see docs/decisions.md):
   * additive, opt-in escape hatch for the one case where something else
   * already owns the top safe-area edge (a shell composing its own App
   * Bar above `Workspace`). Default `true` — every existing caller keeps
   * claiming all four edges exactly as before; passing `false` is the
   * only way to change behavior, and nothing does yet. */
  topInset?: boolean;
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
export function Workspace({
  scroll = false,
  justify = 'center',
  contentStyle,
  topInset = true,
  children,
}: WorkspaceProps) {
  const theme = useTheme();

  // Omitting `edges` entirely (rather than always passing all four)
  // preserves today's default behavior exactly for every existing caller —
  // only the `topInset={false}` path changes what's passed at all.
  const edges: Edge[] | undefined = topInset ? undefined : ['right', 'bottom', 'left'];

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={edges}>
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
    <SafeAreaView style={styles.safeArea} edges={edges}>
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
    // Matches web's `.container` padding at its own mobile-width
    // breakpoint (app.module.scss, @media max-width:769px) — 8px, not
    // the 24px used here before. Measured, not estimated: web's desktop
    // value is 16px/24px, but mobile is always in the narrow state.
    paddingHorizontal: Spacing.two,
    gap: Spacing.four,
  },
});
