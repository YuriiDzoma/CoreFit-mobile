import { BlurTargetView } from 'expo-blur';
import { Stack, usePathname } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { FriendsSubNav } from '@/components/friends-sub-nav';

// This route group also serves `index`/`[id]`/`settings` — screens where a
// Friends/Requests/Users subnav has no place — so, unlike `programs/_layout.tsx`
// (whose whole group is Training screens and always shows `TrainingSubNav`),
// `FriendsSubNav` is gated to these three specific routes.
const SUB_NAV_ROUTES = ['/profile/friends', '/profile/requests', '/profile/users'];

// Mirrors `programs/_layout.tsx` structurally: `FriendsSubNav` is a floating
// glass bar, not docked chrome, so it's rendered as a sibling of `<Stack>`
// rather than wrapping it in a padded row — every screen inside owns its
// own top/bottom clearance (`useFriendsChromeClearance`), so scrollable
// content can reach the very top/bottom of the screen and pass behind
// Header, FriendsSubNav, and Navigation.
//
// `<Stack>` is wrapped in its own local `BlurTargetView`, handed to
// `FriendsSubNav` as `blurTarget` — the same mechanism `programs/_layout.tsx`
// uses for `TrainingSubNav`. Must stay a *sibling* of this `BlurTargetView`,
// not a descendant of it (pointing a subnav at an ancestor `BlurTargetView`
// that contains the subnav itself previously crashed Android's
// RenderThread with a SIGSEGV — see training-sub-nav.tsx's own comment).
export default function ProfileLayout() {
  const pathname = usePathname();
  const blurTarget = useRef<View>(null);
  const showSubNav = SUB_NAV_ROUTES.includes(pathname);

  return (
    <View style={styles.fill}>
      <BlurTargetView ref={blurTarget} style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="requests" />
          <Stack.Screen name="users" />
        </Stack>
      </BlurTargetView>

      {showSubNav && <FriendsSubNav blurTarget={blurTarget} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
