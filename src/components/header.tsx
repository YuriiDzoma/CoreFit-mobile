import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type View as RNView,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { updateProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

const LOGO_SIZE = 32;
const FRIEND_REQUEST_ICON_SIZE = 24;

// Corresponds to web's `.menu__show`/`.menu__content`/`.shadowActive`.
const MENU_PANEL_HEIGHT = 107;
const MENU_ANIMATION_MS = 150;
const MENU_BACKDROP_OPACITY = 0.3;

// Corresponds to web's `.addBadge`.
const BADGE_SIZE = 16;

/**
 * The app's persistent top bar — brand identity (left-aligned back
 * button, centered logo/wordmark) plus utility actions (friend requests,
 * menu) on the right. Renders only on the four tab roots; pushed screens
 * use `ScreenHeader` instead, so the two never appear together.
 */
export function Header() {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const setThemePreference = useAuthStore((state) => state.setThemePreference);
  const user = useAuthStore((state) => state.user);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);
  const pendingRequests = useFriendRequestsStore((state) => state.requests.length);
  const badgeValue = pendingRequests > 99 ? '99+' : String(pendingRequests);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });
  const menuButtonRef = useRef<RNView>(null);
  const [animation] = useState(() => new Animated.Value(0));

  const logoSource =
    scheme === 'dark'
      ? require('@/assets/images/brand/logo-dark.png')
      : require('@/assets/images/brand/logo-light.png');
  // expo-image renders .svg assets natively (already the established
  // pattern in this codebase — login-form.tsx's google-icon.svg) — no
  // rasterization step or extra dependency needed.
  const friendRequestIconSource =
    scheme === 'dark'
      ? require('@/assets/images/brand/friend-request-dark.svg')
      : require('@/assets/images/brand/friend-request-light.svg');
  const backIconSource =
    scheme === 'dark'
      ? require('@/assets/images/brand/back-dark.svg')
      : require('@/assets/images/brand/back-light.svg');

  const openMenu = () => {
    // Web anchors the panel to the button via `position:absolute; top:100%`
    // on a relatively-positioned parent — there's no such implicit
    // relationship once the panel renders through a root-level Modal, so
    // the button's real on-screen position is measured directly rather
    // than guessed.
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height, right: toRightOffset(x, width) });
      setIsMenuOpen(true);
      Animated.timing(animation, {
        toValue: 1,
        duration: MENU_ANIMATION_MS,
        useNativeDriver: false,
      }).start();
    });
  };

  const closeMenu = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: MENU_ANIMATION_MS,
      useNativeDriver: false,
    }).start(() => setIsMenuOpen(false));
  };

  const toggleMenu = () => (isMenuOpen ? closeMenu() : openMenu());

  const handleSettingsPress = () => {
    closeMenu();
    router.push('/profile/settings');
  };

  // Same toggle semantics as web's `handleToggleTheme` — a single flip of
  // the current effective scheme, not a two-option picker (that's
  // Settings' own, separate control).
  const handleThemeToggle = () => {
    if (!user?.id) return;
    const nextDark = scheme !== 'dark';
    updateProfileById(user.id, { dark: nextDark })
      .then(() => setThemePreference(nextDark))
      .catch(() => {});
  };

  const panelHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MENU_PANEL_HEIGHT],
  });
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MENU_BACKDROP_OPACITY],
  });

  return (
    <View style={styles.row}>
      <View style={[styles.sideZone, styles.leftZone]}>
        <Pressable hitSlop={Spacing.two} onPress={() => router.back()}>
          <Image source={backIconSource} style={styles.backIcon} contentFit="contain" />
        </Pressable>
      </View>

      <Pressable style={styles.brand} onPress={() => router.push('/')}>
        <Image source={logoSource} style={styles.logo} contentFit="contain" />
        <ThemedText type="default" style={styles.wordmark}>
          COREFIT
        </ThemedText>
      </Pressable>

      <View style={[styles.sideZone, styles.rightZone]}>
        <View style={styles.rightSection}>
          {pendingRequests > 0 && (
            <Pressable
              style={styles.friendRequestButton}
              onPress={() => router.push('/profile/requests')}
            >
              <Image
                source={friendRequestIconSource}
                style={styles.friendRequestIcon}
                contentFit="contain"
              />
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{badgeValue}</ThemedText>
              </View>
            </Pressable>
          )}

          <Pressable ref={menuButtonRef} hitSlop={Spacing.two} onPress={toggleMenu}>
            {isMenuOpen ? (
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={LOGO_SIZE}
                tintColor={theme.text}
              />
            ) : (
              <HamburgerIcon color={theme.text} />
            )}
          </Pressable>
        </View>
      </View>

      <Modal transparent visible={isMenuOpen} animationType="none" onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.panel,
            {
              top: anchor.top,
              right: anchor.right,
              height: panelHeight,
              borderColor: theme.border,
              backgroundColor: theme.background,
            },
          ]}
        >
          <View style={styles.panelContent}>
            <Pressable onPress={handleSettingsPress}>
              <ThemedText type="default">Settings</ThemedText>
            </Pressable>

            <Pressable style={styles.themeRow} onPress={handleThemeToggle}>
              <ThemedText type="default">Theme: </ThemedText>
              <SymbolView
                name={{
                  ios: scheme === 'dark' ? 'moon.fill' : 'sun.max.fill',
                  android: scheme === 'dark' ? 'dark_mode' : 'light_mode',
                  web: scheme === 'dark' ? 'dark_mode' : 'light_mode',
                }}
                size={24}
                tintColor={theme.text}
              />
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// Web's glyph is asymmetric: top and bottom bars are right-aligned at
// half the middle bar's width, not a symmetric hamburger. Proportions
// scaled from its 24x24 viewBox path (`M11 17H19M5 12H19M11 7H19`,
// stroke-width 2, round caps) to this component's 32px render size.
function HamburgerIcon({ color }: { color: string }) {
  return (
    <View style={styles.hamburger}>
      <View style={[styles.hamburgerBar, styles.hamburgerBarShort, { backgroundColor: color, top: 8 }]} />
      <View style={[styles.hamburgerBar, styles.hamburgerBarLong, { backgroundColor: color, top: 14.667 }]} />
      <View style={[styles.hamburgerBar, styles.hamburgerBarShort, { backgroundColor: color, top: 21.333 }]} />
    </View>
  );
}

// measureInWindow gives the button's left edge (x) and width; the panel's
// web equivalent is right-anchored (`right: -2px`), so this converts that
// left-edge measurement into a right-offset from the actual screen width.
function toRightOffset(x: number, width: number): number {
  const screenWidth = Dimensions.get('window').width;
  return screenWidth - (x + width);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Equal-width left/right zones, independent of their content, so the
  // brand block in between stays visually centered regardless of whether
  // the back button or friend-request icon is present.
  sideZone: {
    flex: 1,
  },
  leftZone: {
    alignItems: 'flex-start',
  },
  rightZone: {
    alignItems: 'flex-end',
  },
  backIcon: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  wordmark: {
    fontSize: 20,
  },
  // `.header__rightSection{column-gap:16px}`.
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  friendRequestButton: {
    position: 'relative',
  },
  friendRequestIcon: {
    width: FRIEND_REQUEST_ICON_SIZE,
    height: FRIEND_REQUEST_ICON_SIZE,
  },
  // `.addBadge`: top:-6px, right:-8px, min-width/height:16px,
  // padding:0 4px, border-radius:8px, font-size:10px, weight:700,
  // line-height:16px.
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#e5484d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: BADGE_SIZE,
  },
  hamburger: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  hamburgerBar: {
    position: 'absolute',
    right: 6.667,
    height: 2.667,
    borderRadius: 1.333,
  },
  hamburgerBarShort: {
    width: 10.667,
  },
  hamburgerBarLong: {
    width: 18.667,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  panel: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: Spacing.one,
    minWidth: 100,
    overflow: 'hidden',
  },
  panelContent: {
    paddingVertical: 20,
    paddingHorizontal: Spacing.four,
    gap: 20,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
