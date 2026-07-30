import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TrainingSubNav } from '@/components/training-sub-nav';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';

// Mirrors web's `training/layout.tsx`: one `TrainingSubNav` (web's
// `TrainingMenu`), now rendered above the routed content instead of fixed
// to the bottom, on every screen under this route group — Complexes/
// Programs/Wiki, plus Program Detail/Create/Exercise Picker, all keep
// "Programs" highlighted.
//
// This wrapper reserves the Header's own top clearance (TrainingSubNav
// itself isn't a `Workspace`, so it would otherwise render under the
// Header) — every screen inside `<Stack>` then only needs *bottom*
// clearance for the Navigation bar, since that top space is already spent
// here. TrainingSubNav isn't translucent, so there's no "scroll behind it"
// requirement the way there is for Header/Navigation.
export default function ProgramsLayout() {
  const clearance = useChromeClearance();

  return (
    <View style={[styles.fill, { paddingTop: clearance.top }]}>
      <TrainingSubNav />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
        <Stack.Screen name="exercise-picker" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="complexes" />
        <Stack.Screen name="wiki" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
