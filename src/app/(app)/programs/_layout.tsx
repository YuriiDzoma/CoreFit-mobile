import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TrainingSubNav } from '@/components/training-sub-nav';

// Mirrors web's `training/layout.tsx`: one `TrainingSubNav` (web's
// `TrainingMenu`) fixed to the bottom of every screen under this route
// group, not just the index — Complexes/Programs/Wiki, plus Program
// Detail/Create/Exercise Picker, all keep "Programs" highlighted.
export default function ProgramsLayout() {
  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
        <Stack.Screen name="exercise-picker" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="complexes" />
        <Stack.Screen name="wiki" />
      </Stack>
      <TrainingSubNav />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
