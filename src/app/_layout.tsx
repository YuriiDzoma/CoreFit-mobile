import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/components/auth-provider';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const status = useAuthStore((state) => state.status);

  // Session restore hasn't resolved yet — render nothing rather than guess.
  // AnimatedSplashOverlay (absolutely positioned, high zIndex) still covers
  // the screen at this point, so this is invisible to the user.
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
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
