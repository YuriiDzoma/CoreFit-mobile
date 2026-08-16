import { BlurView } from 'expo-blur';
import { usePathname, useRouter, type Href } from 'expo-router';
import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFloatingNavTopEdge } from '@/components/navigation';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

interface SubNavItem {
  key: string;
  label: string;
  href: Href;
  isActive: (pathname: string) => boolean;
}

function useSubNavItems(): SubNavItem[] {
  const { t } = useTranslation();
  return [
    {
      key: 'complexes',
      label: t('components.trainingSubNav.complexes'),
      href: '/programs/complexes',
      isActive: (pathname) => pathname.startsWith('/programs/complexes'),
    },
    {
      key: 'programs',
      label: t('components.trainingSubNav.programs'),
      href: '/programs',
      isActive: (pathname) =>
        !pathname.startsWith('/programs/complexes') && !pathname.startsWith('/programs/wiki'),
    },
    {
      key: 'wiki',
      label: t('components.trainingSubNav.wiki'),
      href: '/programs/wiki',
      isActive: (pathname) => pathname.startsWith('/programs/wiki'),
    },
  ];
}

const SUB_NAV_HEIGHT = 48;
const SUB_NAV_MARGIN = Spacing.three;
// Vertical gap up to the main Navigation bar specifically — deliberately
// smaller than SUB_NAV_MARGIN (which still governs this bar's own left/right
// insets and the content-clearance breathing room above it), so the two
// floating bars read as a tighter, more visually-connected stack.
const NAV_GAP = Spacing.two;

/** Total vertical space the floating sub-nav occupies above the main
 * Navigation bar — stacks directly on top of it, using its already-exported
 * top edge as the base rather than duplicating Navigation's own margin
 * math. Training screens pull their own bottom padding from this. */
export function getFloatingSubNavClearance(insetBottom: number): number {
  return getFloatingNavTopEdge(insetBottom) + NAV_GAP + SUB_NAV_HEIGHT + SUB_NAV_MARGIN;
}

/**
 * Complexes/Programs/Wiki — Training's secondary tab bar. Floats directly
 * above the primary `Navigation` bar (same glass/blur treatment as
 * Header/Navigation, not docked in-flow chrome), so routed Training content
 * can scroll behind it the same way Home already scrolls behind Header and
 * Navigation. Rendered from `programs/_layout.tsx`, above every screen in
 * that route group (list, detail, create, exercise picker), so "Programs"
 * stays highlighted throughout.
 */
export function TrainingSubNav({ blurTarget }: { blurTarget?: RefObject<View | null> }) {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useSubNavItems();

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: getFloatingNavTopEdge(insets.bottom) + NAV_GAP,
          left: SUB_NAV_MARGIN,
          right: SUB_NAV_MARGIN,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Shadow/elevation live on this outer, non-clipped wrapper — Android's
          `elevation` casts a shadow off the view's full rectangular bounds
          before `overflow:'hidden'`/`borderRadius` clip it, so putting all
          three on the same node let a sliver of the unclipped rectangle
          show past the rounded corners (a visible pale edge along the
          bottom). Splitting them onto separate nodes is the standard fix. */}
      <View style={styles.shadowWrap}>
        {/* `blurTarget` here points at `programs/_layout.tsx`'s own local
            `BlurTargetView` (wrapping just its `<Stack>`), not AppShell's —
            this bar must stay a *sibling* of whichever `BlurTargetView` it
            samples, never a descendant. Pointing it at AppShell's ancestor
            view (which contains this bar itself) caused a reproducible
            native SIGSEGV on Android (RenderThread), confirmed via a crash
            tombstone. Same `blurMethod` as Header/Navigation now that this
            is wired correctly, so all three floating bars render identical
            glass — not just a matching flat tint. */}
        <BlurView
          intensity={45}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={[styles.bar, { borderColor: theme.glassBorder }]}
        >
          {items.map((item) => (
            <SubNavButton
              key={item.key}
              label={item.label}
              active={item.isActive(pathname)}
              onPress={() => router.push(item.href)}
            />
          ))}
        </BlurView>
      </View>
    </View>
  );
}

function SubNavButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  const pillStyle = useAnimatedStyle(() => ({
    opacity: withSpring(active ? 1 : 0, { damping: 18, stiffness: 200 }),
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={Spacing.two}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Animated.View
        style={[
          styles.pill,
          pillStyle,
          { backgroundColor: theme.accentFill, borderColor: theme.border },
        ]}
      />
      <ThemedText style={[styles.label, { color: active ? theme.text : theme.title }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 5,
    alignItems: 'center',
  },
  shadowWrap: {
    width: '100%',
    borderRadius: 20,
    // iOS
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    // Android
    elevation: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    height: SUB_NAV_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    opacity: 0.7,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4,
    borderRadius: 16,
    borderWidth: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
