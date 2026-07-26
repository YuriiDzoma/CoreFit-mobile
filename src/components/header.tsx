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

const LOGO_SIZE = 32;

// Measured directly from web's header.module.scss (`.menu__show`, `.menu__content`,
// `.shadowActive`) — not estimated. Web's own values, reproduced as-is.
const MENU_PANEL_HEIGHT = 107;
const MENU_ANIMATION_MS = 150;
const MENU_BACKDROP_OPACITY = 0.3;

/**
 * Stage 1, Web → Mobile shell parity (see docs/decisions.md): left brand
 * identity + right menu entry point, with every measurable value taken
 * directly from web's `header.module.scss`/`header.tsx` at its own
 * mobile-width breakpoint (≤768px), not estimated — wordmark 20px, menu
 * icon 32px tinted `theme.text` (matching `menuMob.svg`'s `#ffffff` /
 * `menuMobDark.svg`'s `#19355A` exactly), no vertical padding of its own
 * (web's row has none; the space after it comes from the parent's own
 * gap, same as web's `margin-bottom`).
 *
 * The menu button now reproduces web's actual in-place dropdown
 * (`menu.tsx`/`.menu__show`/`.shadowActive`) rather than navigating away:
 * a `Modal` is the RN equivalent of CSS `position: fixed` covering the
 * viewport — React Native has no direct "fixed relative to viewport"
 * primitive outside of a portal-like mechanism, so this is the one place
 * a native API is used out of a real technical limitation, not
 * preference. Panel height (107px), backdrop opacity (0.3), and
 * animation duration (150ms) are web's exact measured values.
 */
export function Header() {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const setThemePreference = useAuthStore((state) => state.setThemePreference);
  const user = useAuthStore((state) => state.user);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });
  const menuButtonRef = useRef<RNView>(null);
  const [animation] = useState(() => new Animated.Value(0));

  const logoSource =
    scheme === 'dark'
      ? require('@/assets/images/brand/logo-dark.png')
      : require('@/assets/images/brand/logo-light.png');

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
      <View style={styles.brand}>
        <Image source={logoSource} style={styles.logo} contentFit="contain" />
        <ThemedText type="default" style={styles.wordmark}>
          COREFIT
        </ThemedText>
      </View>

      <Pressable ref={menuButtonRef} hitSlop={Spacing.two} onPress={toggleMenu}>
        <SymbolView
          name={{
            ios: isMenuOpen ? 'xmark' : 'line.3.horizontal',
            android: isMenuOpen ? 'close' : 'menu',
            web: isMenuOpen ? 'close' : 'menu',
          }}
          size={32}
          tintColor={theme.text}
        />
      </Pressable>

      <Modal transparent visible={isMenuOpen} animationType="none" onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
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
    justifyContent: 'space-between',
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
