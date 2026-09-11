import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CoreFit-mobile',
  slug: 'yuriidzoma',
  owner: 'yuriidzomas-team',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'corefitmobile',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.corefit.mobile',
  },
  android: {
    package: 'com.corefit.mobile',
    adaptiveIcon: {
      // Matches the brand's own dark navy (`--bg-color` in the web repo's
      // `ui/variables.scss`) -- a plain color, not a separate background
      // image, since the foreground layer already carries all the actual
      // logo art.
      backgroundColor: '#0F172A',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow CoreFit to use your location to suggest your city.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow CoreFit to access your photos to set a profile picture.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: '3d95740f-e7e3-45dd-a995-253634b287b5',
    },
  },
});
