import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseSearchBar } from '@/components/exercise-search-bar';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useExerciseBrowser } from '@/hooks/use-exercise-browser';

function handleExercisePress(id: string) {
  router.push(`/programs/wiki/${id}`);
}

export default function WikiScreen() {
  const {
    loadState,
    selectedMuscleGroup,
    setSelectedMuscleGroup,
    searchQuery,
    setSearchQuery,
    localizedExercises,
    retry,
  } = useExerciseBrowser();

  return (
    <Workspace
      topInset={false}
      justify="flex-start"
      contentStyle={{ paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <ThemedText style={styles.pageTitle}>Wiki</ThemedText>

      {/* Web's Wiki page has no search bar at all — filtering is by
          muscle group only. Kept per the Stage 2 review rule: it doesn't
          conflict with web's structure, doesn't touch the shell/nav, and
          adds a capability rather than removing one. */}
      {loadState.state === 'success' && (
        <ExerciseSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      )}

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading exercises…
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={retry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* wiki.module.scss's `.content`: a row — a narrow, independently-
          scrolling muscle-group rail beside an independently-scrolling
          exercise list. Not a single vertical stack. */}
      {loadState.state === 'success' && (
        <View style={styles.content}>
          <MuscleGroupFilter
            muscleGroups={loadState.muscleGroups}
            selectedMuscleGroup={selectedMuscleGroup}
            onSelect={setSelectedMuscleGroup}
          />

          <FlatList
            style={styles.listColumn}
            data={localizedExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary">
                {searchQuery.trim()
                  ? `No exercises match "${searchQuery.trim()}".`
                  : 'No exercises found for this muscle group.'}
              </ThemedText>
            }
            renderItem={({ item }) => (
              // wiki.module.scss's `.exercise`: a bare row, no card chrome
              // at all — no border, no fill, no radius (mobile previously
              // rendered this as a filled, rounded card).
              <Pressable style={styles.exercise} onPress={() => handleExercisePress(item.id)}>
                {item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                )}
                <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
              </Pressable>
            )}
          />
        </View>
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  // base.scss's `.pageTitle`: 18px, centered, 16px margin-bottom — not
  // Programs' `.title` (20px). A different, separately-measured value.
  pageTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  // wiki.module.scss's `.content`: row, column-gap 12 (not in the existing
  // Spacing scale — used exactly, not rounded to the nearest token),
  // items start-aligned.
  content: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  listColumn: {
    flex: 1,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  // `.exercise`: bare row, no card chrome — no border, no fill, no radius.
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thumbnail: {
    width: 64,
    height: 64,
  },
  exerciseName: {
    flexShrink: 1,
  },
});
