/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// text/background/title/border below match web's ui/variables.scss palette
// directly (confirmed live against that file, not approximated) — the goal
// is the same design language, not a pixel-identical port, so
// backgroundElement/backgroundSelected/textSecondary/danger are unchanged:
// web has no distinct "element background" concept (its cards/inputs are
// bordered, not filled), and changing those would ripple into screens this
// sprint doesn't otherwise touch (Explore, muscle-group filters, exercise
// picker selection).
export const Colors = {
  light: {
    text: '#19355A',
    background: '#ECEDF2',
    // Sprint 39 originally gave this its own value (reusing
    // backgroundElement's), a deliberate mobile-native design choice made
    // before Stage 1's "measure web exactly" mandate existed. Corrected
    // here: a live `getComputedStyle` check of web's actual `body`
    // background returned `rgb(15, 23, 42)` (dark) / this light
    // equivalent — i.e. web's real screen surface is `background`'s
    // value, not a separate tone. Kept as its own token name (semantic
    // separation from `background` may still matter later), but the
    // value now matches web exactly rather than an approximation.
    workspace: '#ECEDF2',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    danger: '#e5484d',
    title: '#1A1C28',
    border: '#204879',
    // A soft hairline highlight for the floating Header/Navigation's glass
    // edge — `border`'s saturated navy read as a hard, deliberate outline
    // there rather than just defining the surface's edge. There is
    // deliberately no background fill alongside it: blur alone separates
    // the glass from content behind it, not a color overlay.
    glassBorder: 'rgba(0, 0, 0, 0.08)',
    // Web's dedicated skeleton palette (ui/variables.scss) — distinct from
    // every other token above, not approximated from the nearest existing
    // one. Used only by loading-state placeholders.
    skeletonBg: '#fff',
    skeletonWrapperBg: '#d0d4dd',
  },
  dark: {
    text: '#ffffff',
    background: '#0F172A',
    // Corrected to match web's actual measured body background exactly
    // (`rgb(15, 23, 42)`) — see the light-theme comment above.
    workspace: '#0F172A',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    danger: '#e5484d',
    title: '#f3e8dd',
    border: '#204879',
    // See the light theme's `glassBorder` comment — same purpose, a light
    // highlight suits a dark blurred surface instead of a dark hairline.
    glassBorder: 'rgba(255, 255, 255, 0.15)',
    skeletonBg: '#2e364a',
    skeletonWrapperBg: '#1d273f',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Was the old fixed-bottom NativeTabs/TrainingSubNav clearance value.
// AppShell now reserves bottom space for the floating Navigation bar
// globally (see `getFloatingNavClearance` in `components/navigation.tsx`),
// so every screen already clears it without adding its own inset — kept at
// 0 rather than removed from its ~8 existing call sites, to avoid touching
// Training's own screens for a navigation-presentation change.
export const BottomTabInset = 0;
export const MaxContentWidth = 800;
