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
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

interface SubNavItem {
  key: string;
  label: string;
  href: Href;
  isActive: (pathname: string) => boolean;
  badge?: number;
}

function useSubNavItems(): SubNavItem[] {
  const { t } = useTranslation();
  const pendingRequests = useFriendRequestsStore((state) => state.requests.length);
  return [
    {
      key: 'requests',
      label: t('components.friendsSubNav.requests'),
      href: '/profile/requests',
      isActive: (pathname) => pathname === '/profile/requests',
      badge: pendingRequests,
    },
    {
      key: 'friends',
      label: t('components.friendsSubNav.friends'),
      href: '/profile/friends',
      isActive: (pathname) => pathname === '/profile/friends',
    },
    {
      key: 'users',
      label: t('components.friendsSubNav.users'),
      href: '/profile/users',
      isActive: (pathname) => pathname === '/profile/users',
    },
  ];
}

const SUB_NAV_HEIGHT = 48;
const SUB_NAV_MARGIN = Spacing.three;
// Vertical gap up to the main Navigation bar specifically — deliberately
// smaller than SUB_NAV_MARGIN (which still governs this bar's own left/right
// insets and the content-clearance breathing room above it), so the two
// floating bars read as a tighter, more visually-connected stack. Same
// constants as TrainingSubNav's own — not shared, since each floating bar
// in this app already owns its geometry independently (Navigation and
// TrainingSubNav don't share theirs either).
const NAV_GAP = Spacing.two;

/** Total vertical space this floating sub-nav occupies above the main
 * Navigation bar — mirrors `getFloatingSubNavClearance` in
 * training-sub-nav.tsx exactly (same bar height/margins), kept as its own
 * copy rather than a shared export since the two bars' geometry is only
 * coincidentally identical, not conceptually linked. */
export function getFloatingFriendsSubNavClearance(insetBottom: number): number {
  return getFloatingNavTopEdge(insetBottom) + NAV_GAP + SUB_NAV_HEIGHT + SUB_NAV_MARGIN;
}

/**
 * Friends/Requests/Users — Friends' secondary tab bar, structurally
 * identical to `TrainingSubNav` (Complexes/Programs/Wiki). Rendered from
 * `profile/_layout.tsx`, but — unlike `TrainingSubNav`, whose whole route
 * group is training screens — only shown on these three specific routes,
 * since `profile/_layout.tsx` also serves `index`/`[id]`/`settings` where a
 * Friends subnav has no place.
 */
export function FriendsSubNav({ blurTarget }: { blurTarget?: RefObject<View | null> }) {
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
      {/* Shadow/elevation live on this outer, non-clipped wrapper — see
          TrainingSubNav's identical comment: Android's `elevation` casts a
          shadow off the view's full rectangular bounds before
          `overflow:'hidden'`/`borderRadius` clip it, so splitting them onto
          separate nodes avoids a visible pale sliver past the rounded
          corners. */}
      <View style={styles.shadowWrap}>
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
              badge={item.badge}
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
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
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
          { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}
      />
      <View>
        <ThemedText style={[styles.label, { color: active ? theme.text : theme.title }]}>
          {label}
        </ThemedText>
        {!!badge && badge > 0 && (
          <View style={[styles.badge, { borderColor: theme.workspace }]}>
            <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</ThemedText>
          </View>
        )}
      </View>
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
  // Same visual token as Navigation's icon badge (#e5484d, white bold text,
  // theme.workspace border) — positioned relative to a text label instead
  // of an icon, since this bar's items are words, not glyphs.
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    backgroundColor: '#e5484d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
});
