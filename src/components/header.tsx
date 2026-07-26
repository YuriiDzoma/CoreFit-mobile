import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

const LOGO_SIZE = 32;

/**
 * Stage 1, Web → Mobile shell parity (see docs/decisions.md): left brand
 * identity + right menu entry point, with every measurable value taken
 * directly from web's `header.module.scss`/`header.tsx` at its own
 * mobile-width breakpoint (≤768px), not estimated — wordmark 20px, menu
 * icon 32px tinted `theme.text` (matching `menuMob.svg`'s `#ffffff` /
 * `menuMobDark.svg`'s `#19355A` exactly), no vertical padding of its own
 * (web's row has none; the space after it comes from the parent's own
 * gap, same as web's `margin-bottom`). The menu button navigates
 * straight to Settings — no popup/drawer of its own yet; reproducing
 * web's actual in-place dropdown behavior is its own, separate pass.
 * Friend Requests still lives on the Profile tab badge — placement
 * undecided, not part of this pass. Plain, unthemed `View`s throughout
 * (no `ThemedView`), so there's no default opaque fill to override —
 * this sits directly on whatever surface renders behind it.
 */
export function Header() {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);

  const logoSource =
    scheme === 'dark'
      ? require('@/assets/images/brand/logo-dark.png')
      : require('@/assets/images/brand/logo-light.png');

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Image source={logoSource} style={styles.logo} contentFit="contain" />
        <ThemedText type="default" style={styles.wordmark}>
          COREFIT
        </ThemedText>
      </View>

      <Pressable hitSlop={Spacing.two} onPress={() => router.push('/profile/settings')}>
        <SymbolView
          name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
          size={32}
          tintColor={theme.text}
        />
      </Pressable>
    </View>
  );
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
});
