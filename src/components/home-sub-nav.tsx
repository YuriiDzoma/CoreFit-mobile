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
      key: 'records',
      label: t('components.homeSubNav.records'),
      href: '/records',
      isActive: (pathname) => pathname === '/records',
    },
    {
      key: 'trainings',
      label: t('components.homeSubNav.trainings'),
      href: '/',
      isActive: (pathname) => pathname === '/',
    },
    {
      key: 'news',
      label: t('components.homeSubNav.news'),
      href: '/news',
      isActive: (pathname) => pathname === '/news',
    },
  ];
}

const SUB_NAV_HEIGHT = 48;
const SUB_NAV_MARGIN = Spacing.three;
// Same constants as TrainingSubNav/FriendsSubNav's own — not shared, each
// floating bar in this app owns its geometry independently.
const NAV_GAP = Spacing.two;

/** Total vertical space this floating sub-nav occupies above the main
 * Navigation bar — mirrors `getFloatingFriendsSubNavClearance` exactly. */
export function getFloatingHomeSubNavClearance(insetBottom: number): number {
  return getFloatingNavTopEdge(insetBottom) + NAV_GAP + SUB_NAV_HEIGHT + SUB_NAV_MARGIN;
}

/**
 * Records/Trainings/News — Home's secondary tab bar, structurally identical to
 * `FriendsSubNav`/`TrainingSubNav`. Rendered unconditionally from
 * `(home)/_layout.tsx` — unlike `FriendsSubNav`, this route group has no
 * other screens sharing it, so there's no pathname gate needed.
 */
export function HomeSubNav({ blurTarget }: { blurTarget?: RefObject<View | null> }) {
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
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
