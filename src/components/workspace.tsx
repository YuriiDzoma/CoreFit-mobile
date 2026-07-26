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
          contentContainerStyle={styles.container}
        >
          <ThemedView
            style={[
              styles.content,
              { borderColor: theme.border, backgroundColor: 'transparent', justifyContent: justify },
              contentStyle,
            ]}
          >
            {children}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ThemedView type="workspace" style={[styles.container, styles.fill]}>
        <ThemedView
          style={[
            styles.content,
            styles.fill,
            { borderColor: theme.border, backgroundColor: 'transparent', justifyContent: justify },
            contentStyle,
          ]}
        >
          {children}
        </ThemedView>
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
  // Web's `.content` (app.module.scss): border 2px, radius 4px, padding
  // 8px at mobile width — measured, not estimated. On web this box wraps
  // only the page's own content, never Header/Navigation; `Workspace`
  // doesn't yet have that same chrome/content separation (Header still
  // renders as a child here on the four primary tabs), so for now this
  // border also encloses Header on those screens — a known, temporary
  // imperfection tracked against finishing Phase 1, not a new decision.
  content: {
    borderWidth: 2,
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.four,
  },
});
