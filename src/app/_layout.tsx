import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/components/auth-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme } from '@/hooks/use-theme';
import { initI18n } from '@/lib/i18n';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  // Session restore hasn't resolved yet — render nothing rather than guess.
  // AnimatedSplashOverlay (absolutely positioned, high zIndex) still covers
  // the screen at this point, so this is invisible to the user. Unlike
  // `status`, `themePreference` never gates this — it's a fire-and-forget
  // background fetch (see auth-store.ts) that must never block startup.
  // `i18nReady` does gate render, unlike `themePreference` — the resolved
  // language must be known before any text renders, not backfilled later.
  if (status === 'idle' || status === 'loading' || !i18nReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'passwordRecovery'}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
}

export default function RootLayout() {
  // Uses the same custom `useColorScheme` (not react-native's directly) and
  // the same `resolveEffectiveScheme` helper as `useTheme()` — previously
  // this used a different, raw OS-scheme source than the rest of the app's
  // colors did, which could never disagree in practice (no preference
  // existed yet) but now genuinely could once a preference does.
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);

  return (
    <AuthProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
