import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseSearchBar } from '@/components/exercise-search-bar';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useExerciseBrowser } from '@/hooks/use-exercise-browser';
import { useProgramWizardStore } from '@/stores/program-wizard-store';

export default function ExercisePickerScreen() {
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ dayIndex?: string | string[] }>();
  const dayIndexParam = Array.isArray(params.dayIndex) ? params.dayIndex[0] : params.dayIndex;
  const dayIndex = dayIndexParam ? Number(dayIndexParam) : 0;

  const getDayExercises = useProgramWizardStore((state) => state.getDayExercises);
  const setDayExercises = useProgramWizardStore((state) => state.setDayExercises);

  const {
    loadState,
    selectedMuscleGroup,
    setSelectedMuscleGroup,
    searchQuery,
    setSearchQuery,
    localizedExercises,
    retry,
  } = useExerciseBrowser();

  // Local, uncommitted session selection — seeded once from the store on
  // mount. The store is never touched until Confirm, mirroring the
  // wizard's own Cancel/Confirm boundary (Sprint 18): Cancel here discards
  // this local array entirely and never calls a store setter.
  const [selected, setSelected] = useState<string[]>(() => getDayExercises(dayIndex));

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((exerciseId) => exerciseId !== id) : [...prev, id],
    );
  };

  const handleCancel = () => {
    router.back();
  };

  const handleConfirm = () => {
    setDayExercises(dayIndex, selected);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ScreenHeader
            onBackPress={handleCancel}
            backLabel="Cancel"
            title={`Day ${dayIndex + 1}`}
          />
        </ThemedView>

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
              renderItem={({ item }) => {
                const selectionIndex = selected.indexOf(item.id);
                const isSelected = selectionIndex !== -1;
                return (
                  <Pressable onPress={() => toggleSelect(item.id)}>
                    <ThemedView
                      type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.card}
                    >
                      <ThemedView style={styles.thumbnailWrapper}>
                        {item.imageUrl && (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.thumbnail}
                            contentFit="cover"
                          />
                        )}
                        {isSelected && (
                          <ThemedView style={styles.badge}>
                            <ThemedText type="small" style={styles.badgeText}>
                              {selectionIndex + 1}
                            </ThemedText>
                          </ThemedView>
                        )}
                      </ThemedView>
                      <ThemedText style={styles.cardName}>{item.name}</ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              }}
            />

            <ThemedView style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={handleConfirm}
              >
                <ThemedText type="smallBold">Confirm ({selected.length})</ThemedText>
              </Pressable>
            </ThemedView>
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
  header: {
    paddingHorizontal: Spacing.four,
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
  thumbnailWrapper: {
    width: 64,
    height: 64,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  badge: {
    position: 'absolute',
    top: -Spacing.one,
    left: -Spacing.one,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3c87f7',
  },
  badgeText: {
    color: '#ffffff',
  },
  cardName: {
    flexShrink: 1,
  },
  actions: {
    paddingHorizontal: Spacing.four,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  pressed: {
    opacity: 0.7,
  },
});
