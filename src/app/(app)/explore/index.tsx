import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseSearchBar } from '@/components/exercise-search-bar';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useExerciseBrowser } from '@/hooks/use-exercise-browser';

function handleExercisePress(id: string) {
  router.push(`/explore/${id}`);
}

export default function ExploreScreen() {
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
            <Pressable onPress={retry}>
              <ThemedText type="linkPrimary">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {loadState.state === 'success' && (
          <>
            <ExerciseSearchBar value={searchQuery} onChangeText={setSearchQuery} />

            <MuscleGroupFilter
              muscleGroups={loadState.muscleGroups}
              selectedMuscleGroup={selectedMuscleGroup}
              onSelect={setSelectedMuscleGroup}
            />

            <FlatList
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
