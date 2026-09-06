import { BlurTargetView } from 'expo-blur';
import { Stack } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { HomeSubNav } from '@/components/home-sub-nav';

// Mirrors `programs/_layout.tsx` structurally: `HomeSubNav` is a floating
// glass bar, not docked chrome, so it's rendered as a sibling of `<Stack>`
// rather than wrapping it in a padded row — every screen inside owns its
// own top/bottom clearance (`useHomeChromeClearance`). Unlike
// `profile/_layout.tsx`'s `FriendsSubNav`, no pathname gate is needed here:
// this route group's only screens are `index` (Trainings), `records`, and
// `news`, all of which want the bar.
//
// `<Stack>` is wrapped in its own local `BlurTargetView`, handed to
// `HomeSubNav` as `blurTarget` — same mechanism as every other floating
// subnav in this app. Must stay a *sibling* of this `BlurTargetView`, not a
// descendant (see training-sub-nav.tsx's own comment about the Android
// RenderThread SIGSEGV this avoids).
export default function HomeLayout() {
  const blurTarget = useRef<View>(null);

  return (
    <View style={styles.fill}>
      <BlurTargetView ref={blurTarget} style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="records" />
          <Stack.Screen name="news" />
        </Stack>
      </BlurTargetView>

      <HomeSubNav blurTarget={blurTarget} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
