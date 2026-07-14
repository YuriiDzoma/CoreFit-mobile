import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getExercises,
  getMuscleGroups,
  localizeExercise,
  type ExerciseRow,
  type LocalizedExercise,
  type MuscleGroupRow,
} from '@/lib/supabase/exercises';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; exercises: ExerciseRow[]; muscleGroups: MuscleGroupRow[] }
  | { state: 'error'; message: string };

function handleExercisePress(id: string) {
  router.push(`/explore/${id}`);
}

export default function ExploreScreen() {
  const theme = useTheme();

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = () => {
    Promise.all([getExercises(), getMuscleGroups()])
      .then(([exercises, muscleGroups]) =>
        setLoadState({ state: 'success', exercises, muscleGroups }),
      )
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRetry = () => {
    setLoadState({ state: 'loading' });
    fetchData();
  };

  const localizedExercises = useMemo<LocalizedExercise[]>(() => {
    if (loadState.state !== 'success') return [];
    const filtered = selectedMuscleGroup
      ? loadState.exercises.filter((exercise) => exercise.muscle_group_id === selectedMuscleGroup)
      : loadState.exercises;
    return filtered.map((exercise) => localizeExercise(exercise));
  }, [loadState, selectedMuscleGroup]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {loadState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            Loading exercises…
          </ThemedText>
        )}

        {loadState.state === 'error' && (
          <ThemedView style={styles.errorBlock}>
            <ThemedText type="small" themeColor="danger">
              ❌ {loadState.message}
            </ThemedText>
            <Pressable onPress={handleRetry}>
              <ThemedText type="linkPrimary">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {loadState.state === 'success' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <Pressable
                style={[
                  styles.filterPill,
                  {
                    backgroundColor:
                      selectedMuscleGroup === null
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                  },
                ]}
                onPress={() => setSelectedMuscleGroup(null)}
              >
                <ThemedText type="small">All</ThemedText>
              </Pressable>
              {loadState.muscleGroups.map((group) => (
                <Pressable
                  key={group.id}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor:
                        selectedMuscleGroup === group.id
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                    },
                  ]}
                  onPress={() => setSelectedMuscleGroup(group.id)}
                >
                  <ThemedText type="small">{group.name}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <FlatList
              data={localizedExercises}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary">
                  No exercises found for this muscle group.
                </ThemedText>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => handleExercisePress(item.id)}>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    {item.imageUrl && (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.thumbnail}
                        contentFit="cover"
                      />
                    )}
                    <ThemedText style={styles.cardName}>{item.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              )}
            />
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.three,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  filterRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  cardName: {
    flexShrink: 1,
  },
});
