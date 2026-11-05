import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // Shown under the icon on the home screen and in the store.
  name: 'CoreFit',
  slug: 'yuriidzoma',
  owner: 'yuriidzomas-team',
  version: '1.0.0',
  // Was a hard 'portrait' lock. That bakes portrait-only into the native
  // manifest/Info.plist at build time, which on iOS blocks
  // ScreenOrientation.lockAsync(LANDSCAPE) from ever working at
  // runtime -- iOS only ever presents orientations declared as supported
  // there. 'default' declares every orientation as supported so the
  // runtime lock (see the root layout and the program-detail screen) can
  // freely move between portrait (everywhere, by default) and landscape
  // (only where a screen explicitly opts in), instead of the native layer
  // enforcing portrait unconditionally.
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'corefitmobile',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.corefit.mobile',
  },
  android: {
    package: 'com.corefit.mobile',
    // Firebase (project corefit-976e3) -- required for push notifications
    // on Android (FCM). Not a secret: it only identifies the Firebase app;
    // the server key for sending lives in EAS credentials.
    googleServicesFile: './google-services.json',
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
    // Expo's prebuild template adds this "draw over other apps" permission;
    // CoreFit never draws outside its own window, and Play review flags it.
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
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
        // Brand logo on the same navy as the adaptive icon background --
        // replaces the Expo template's chevron on #208AEF.
        backgroundColor: '#0F172A',
        image: './assets/images/splash-icon.png',
        imageWidth: 150,
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
        // Avatars come from the photo library only (`launchImageLibraryAsync`)
        // -- `false` blocks the CAMERA/RECORD_AUDIO permissions the plugin
        // would otherwise add, so Play doesn't see unused camera/mic access.
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        // Same brand navy as the Android adaptive icon's background
        // above -- Android tints a notification's small icon to a flat
        // silhouette regardless, but `color` is what fills in behind it.
        color: '#0F172A',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // R8 on release builds: Play flagged "DEX code optimization below
          // threshold -- obfuscation 1%" (deadline Feb 2027). Shrinks and
          // obfuscates the Java/Kotlin side; the JS bundle is unaffected.
          // Libraries ship their own keep rules; add `extraProguardRules`
          // here only if a release build crashes on a stripped class.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
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
