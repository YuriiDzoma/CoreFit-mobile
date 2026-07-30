import { BlurTargetView } from 'expo-blur';
import { Stack } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { TrainingSubNav } from '@/components/training-sub-nav';

// Mirrors `AppShell` itself: `TrainingSubNav` is a floating glass bar, not
// docked chrome, so it's rendered as a sibling of `<Stack>` rather than
// wrapping it in a padded row. `{children}`-equivalent (`<Stack>`) stays
// fully unconstrained here — every screen inside owns its own top/bottom
// clearance (see `useTrainingChromeClearance`), the same model Home/Friends/
// Requests already use, so their scrollable content can genuinely reach the
// very top and bottom of the screen and pass behind Header, TrainingSubNav,
// and Navigation. Padding this wrapper would shrink every screen's own
// scrolling frame instead — the exact bug this replaces.
//
// `<Stack>` is wrapped in its own local `BlurTargetView`, and that ref is
// handed to `TrainingSubNav` as `blurTarget` — the same mechanism
// `AppShell` uses for Header/Navigation, scoped to this route group.
// `TrainingSubNav` must stay a *sibling* of this `BlurTargetView`, not a
// descendant of it (an earlier attempt pointed it at AppShell's own,
// ancestor `BlurTargetView` — which contains `TrainingSubNav` itself —
// and that self-referential sampling crashed Android's RenderThread with
// a SIGSEGV, confirmed via a crash tombstone).
export default function ProgramsLayout() {
  const blurTarget = useRef<View>(null);

  return (
    <View style={styles.fill}>
      <BlurTargetView ref={blurTarget} style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="create" />
          <Stack.Screen name="exercise-picker" />
          <Stack.Screen name="[id]" />
          <Stack.Screen name="complexes" />
          <Stack.Screen name="wiki" />
        </Stack>
      </BlurTargetView>

      <TrainingSubNav blurTarget={blurTarget} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
