import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';

interface WorkspaceProps extends PropsWithChildren {
  /** Renders a ScrollView (with `theme.workspace` applied) instead of a
   * plain themed container — same role as `ScreenLayout`'s own `scroll`
   * prop. Default `false`. */
  scroll?: boolean;
  /** `scroll` only: whether this ScrollView's own `contentContainerStyle`
   * should reserve top clearance for the floating Header. Default `true`.
   * The one exception is Training routes — `programs/_layout.tsx`'s own
   * wrapper already reserves that space for `TrainingSubNav`, so its
   * screens pass `false` to avoid double-padding. Bottom (Navigation)
   * clearance always applies; nothing else provides it. */
  topClearance?: boolean;
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
 * The shared screen shell for every `(app)`-group screen. Header/Navigation
 * clearance is deliberately *not* handled here as a blanket rule — this
 * component's default (non-`scroll`) branch is used both by genuinely
 * static screens and by screens that render their own `FlatList` as
 * `children`; auto-applying padding in that branch would shrink every such
 * FlatList's own frame (the exact scroll-behind-chrome bug this project is
 * fixing). Static screens and FlatList screens each apply clearance
 * themselves, from the shared `useChromeClearance()` hook, at their own
 * `contentStyle`/`contentContainerStyle`.
 *
 * The `scroll` branch is different: `Workspace` owns that `ScrollView`
 * itself (screens only provide content, not a competing scroll widget), so
 * clearance is safely centralized here for that one case.
 */
export function Workspace({
  scroll = false,
  topClearance = true,
  justify = 'center',
  contentStyle,
  children,
}: WorkspaceProps) {
  const theme = useTheme();
  const clearance = useChromeClearance();

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.workspace }]}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: topClearance ? clearance.top : 0,
              paddingBottom: clearance.bottom,
            },
          ]}
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
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
  // 8px at mobile width — measured, not estimated. Header/Navigation are
  // both floating overlays now (see `app-shell.tsx`), never nested inside
  // this border, matching web's own `.content` div exactly.
  content: {
    borderWidth: 2,
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.four,
  },
});
