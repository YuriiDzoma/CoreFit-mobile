import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Web's AppShell keeps its StartPreloader up for this long after startup
// work finishes, so the screen never just flashes by.
const MIN_VISIBLE_AFTER_READY_MS = 1000;

/**
 * Port of web's `ui/startPreloader`: a full-screen navy cover with the
 * pulsing CoreFit logo, the red "CoreFit" title and a spinning ring,
 * shown on launch until `ready` (session restored + language resolved),
 * then for another second -- same as web's START_PRELOADER_DELAY. Its
 * background matches the native splash (`app.config.ts`), so hiding the
 * native splash under it is seamless.
 *
 * Web's title asks for 'Orbitron' but never loads that font, so it renders
 * in the default bold sans-serif -- matched here with the system font.
 */
export function StartPreloader({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setVisible(false), MIN_VISIBLE_AFTER_READY_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    // `pulse 2s infinite ease-in-out`: 0 → 1 → 0 over 2s.
    pulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // `spin 1s linear infinite`.
    spin.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [pulse, spin]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + 0.2 * pulse.value,
    transform: [{ scale: 1 + 0.1 * pulse.value }],
  }));

  const loaderStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.preloader} onLayout={() => SplashScreen.hideAsync().catch(() => {})}>
      <StatusBar style="light" />
      <View style={styles.logoWrap}>
        <Animated.View style={logoStyle}>
          <Image
            source={require('@/assets/images/brand/logo-dark.png')}
            style={styles.logo}
            accessibilityLabel="CoreFit logo"
          />
        </Animated.View>
        <Text style={styles.title}>CoreFit</Text>
      </View>
      <Animated.View style={[styles.loader, loaderStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  preloader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
  },
  // `font-size: 2rem; font-weight: bold; margin-top: 0.5rem` (the h1's
  // own default block margin is what web's title still carries below it).
  title: {
    color: '#e44b2f',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 21,
  },
  loader: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderTopColor: '#e44b2f',
  },
});
