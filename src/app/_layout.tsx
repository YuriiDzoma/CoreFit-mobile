import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/components/auth-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const status = useAuthStore((state) => state.status);

  // Session restore hasn't resolved yet — render nothing rather than guess.
  // AnimatedSplashOverlay (absolutely positioned, high zIndex) still covers
  // the screen at this point, so this is invisible to the user. Unlike
  // `status`, `themePreference` never gates this — it's a fire-and-forget
  // background fetch (see auth-store.ts) that must never block startup.
  if (status === 'idle' || status === 'loading') {
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
