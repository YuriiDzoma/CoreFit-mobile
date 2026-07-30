import { BlurView } from 'expo-blur';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Dumbbell, House, MessageSquareText, Users } from 'lucide-react-native';
import { useEffect, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { getProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

const ICON_SIZE = 24;
const AVATAR_SIZE = 26;
const NAV_HEIGHT = 56;
const NAV_MARGIN = Spacing.three;

/** Total vertical space the floating bar occupies above the bottom edge —
 * exported so `AppShell` can pad routed content by the same number rather
 * than a second, independently-guessed constant. */
export function getFloatingNavClearance(insetBottom: number): number {
  return insetBottom + NAV_MARGIN + NAV_HEIGHT + NAV_MARGIN;
}

type NavKey = 'home' | 'friends' | 'training' | 'messages' | 'profile';

interface NavItem {
  key: NavKey;
  href: Href;
  isActive: (pathname: string) => boolean;
}

// Friends and Requests both currently live under the `profile/` route group
// (unchanged this phase — see `profile/_layout.tsx`), but Friends is now a
// primary destination in its own right, so `/profile/friends` must win over
// the Profile tab's own `isActive` check, not fall through to it.
const ITEMS: NavItem[] = [
  { key: 'home', href: '/', isActive: (pathname) => pathname === '/' },
  {
    key: 'friends',
    href: '/profile/friends',
    isActive: (pathname) => pathname === '/profile/friends',
  },
  { key: 'training', href: '/programs', isActive: (pathname) => pathname.startsWith('/programs') },
  { key: 'messages', href: '/messages', isActive: (pathname) => pathname === '/messages' },
  {
    key: 'profile',
    href: '/profile',
    isActive: (pathname) => pathname === '/profile' || pathname === '/profile/settings',
  },
];

/**
 * Instagram/Threads-style floating glass bar — the app's only primary
 * navigation now, replacing the old top pill row. Self-positions via safe
 * area insets rather than relying on `AppShell`'s layout flow, so it reads
 * identically wherever it's mounted.
 */
export function Navigation({ blurTarget }: { blurTarget?: RefObject<View | null> }) {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const themePreference = useAuthStore((state) => state.themePreference);
  // Same resolver `useTheme()` and `Header` both use — a raw `useColorScheme()`
  // read here (the previous bug) ignores the user's explicit profile
  // preference, so this bar's BlurView could pick the opposite `tint` from
  // every other themed value on screen whenever the OS scheme and the
  // user's saved preference disagree.
  const scheme = resolveEffectiveScheme(osScheme, themePreference);
  const pendingRequests = useFriendRequestsStore((state) => state.requests.length);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getProfileById(user.id)
      .then((profile) => {
        if (cancelled) return;
        setAvatarUri(profile.avatar_url);
        setAvatarName(profile.username ?? user.email ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  return (
    <View
      style={[
        styles.wrap,
        { bottom: insets.bottom + NAV_MARGIN, left: NAV_MARGIN, right: NAV_MARGIN },
      ]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={45}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget}
        style={[styles.bar, { borderColor: theme.glassBorder }]}
      >
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <NavButton
              key={item.key}
              active={active}
              onPress={() => router.push(item.href)}
            >
              {item.key === 'home' && (
                <House size={ICON_SIZE} color={active ? theme.text : theme.title} strokeWidth={2} />
              )}
              {item.key === 'friends' && (
                <View>
                  <Users size={ICON_SIZE} color={active ? theme.text : theme.title} strokeWidth={2} />
                  {pendingRequests > 0 && (
                    <View style={[styles.badge, { borderColor: theme.workspace }]}>
                      <Animated.Text style={styles.badgeText}>
                        {pendingRequests > 99 ? '99+' : String(pendingRequests)}
                      </Animated.Text>
                    </View>
                  )}
                </View>
              )}
              {item.key === 'training' && (
                <Dumbbell size={ICON_SIZE} color={active ? theme.text : theme.title} strokeWidth={2} />
              )}
              {item.key === 'messages' && (
                // Not yet built — stays permanently at the same visual
                // weight every *inactive* icon already has (never promoted
                // to theme.text/the active pill/scale-bump), rather than a
                // separate, extra-muted tone that read as a thinner icon
                // family. MessageSquareText (internal text lines) matches
                // House/Users/Dumbbell's optical density; MessageCircle's
                // bare outline didn't.
                <MessageSquareText size={ICON_SIZE} color={theme.title} strokeWidth={2} />
              )}
              {item.key === 'profile' && (
                <View
                  style={[
                    styles.avatarRing,
                    {
                      borderColor: active ? theme.text : theme.title,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <Avatar uri={avatarUri} name={avatarName} size={AVATAR_SIZE} />
                </View>
              )}
            </NavButton>
          );
        })}
      </BlurView>
    </View>
  );
}

function NavButton({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  const pillStyle = useAnimatedStyle(() => ({
    opacity: withSpring(active ? 1 : 0, { damping: 18, stiffness: 200 }),
    transform: [{ scale: withSpring(active ? 1 : 0.6, { damping: 18, stiffness: 200 }) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(active ? 1.08 : 1, { damping: 14, stiffness: 220 }) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={Spacing.two}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Animated.View
        style={[styles.pill, pillStyle, { backgroundColor: theme.backgroundSelected }]}
      />
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    height: NAV_HEIGHT,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    // iOS
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    // Android
    elevation: 8,
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
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarRing: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    // borderWidth/borderColor are always set inline (active vs inactive).
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
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
