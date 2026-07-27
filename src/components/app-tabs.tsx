import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  // Was react-native's raw useColorScheme() + a manual Colors lookup —
  // switched to this app's own useTheme() (found while verifying Sprint
  // 39's tab-bar/workspace tone sync, see docs/decisions.md): the raw OS
  // scheme ignores a signed-in user's explicit in-app dark/light
  // preference (`profiles.dark`, via useAuthStore), which every other
  // screen already accounts for through useTheme()/resolveEffectiveScheme.
  // Pre-existing since this component was first written — the two could
  // silently disagree whenever the OS scheme and the in-app preference
  // differed, it just never had a visible consequence until a tab-bar
  // color needed to actually match a screen's own resolved theme.
  const colors = useTheme();

  return (
    <NativeTabs
      // Sprint 39, Continuous Workspace (see docs/decisions.md): tone-matched
      // to Workspace's own surface rather than `background`, so a migrated
      // screen's content reads as continuous with the tab bar beneath it.
      // This is applied globally (NativeTabs has one bar shared by every
      // tab), so until every screen migrates off ScreenLayout, unmigrated
      // tabs will show this bar against their still-`background`-toned
      // content — an expected, temporary seam during the migration window,
      // not a regression to fix here.
      backgroundColor={colors.workspace}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="programs">
        <NativeTabs.Trigger.Label>Programs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.strengthtraining.traditional" md="fitness_center" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Sprint 37's interim badge lived here because Friend Requests had
          no other entry point yet. Stage 1 gave the Header its own
          icon+badge (header.tsx), matching web's single location for this
          signal — removed here to avoid showing the same count twice. */}
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
