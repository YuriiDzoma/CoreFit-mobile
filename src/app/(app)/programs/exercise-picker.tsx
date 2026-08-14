import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SearchBar } from '@/components/search-bar';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { useExerciseBrowser } from '@/hooks/use-exercise-browser';
import { useProgramWizardStore } from '@/stores/program-wizard-store';

export default function ExercisePickerScreen() {
  const { t } = useTranslation();
  const clearance = useTrainingChromeClearance();

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
  // mount, tracking only exercise ids for the toggle UI. The store is
  // never touched until Confirm, mirroring the wizard's own Cancel/Confirm
  // boundary (Sprint 18): Cancel here discards this local array entirely
  // and never calls a store setter.
  const [selected, setSelected] = useState<string[]>(() =>
    getDayExercises(dayIndex).map((slot) => slot.exerciseId),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((exerciseId) => exerciseId !== id) : [...prev, id],
    );
  };

  const handleCancel = () => {
    router.back();
  };

  // Reconciles the final selection against the store's *current* slots for
  // this day (by exerciseId, never by position) — an exercise that stays
  // selected keeps its existing `program_exercises.id` regardless of how
  // many times it was toggled off/on within this session or where it ends
  // up in the list; a newly-selected exercise gets `id: null` (new row).
  // This is what makes Sprint 32's structural diff safe: row identity is
  // never reassigned to a different logical exercise.
  const handleConfirm = () => {
    const existingIdByExerciseId = new Map(
      getDayExercises(dayIndex).map((slot) => [slot.exerciseId, slot.id]),
    );
    const exercises = selected.map((exerciseId) => ({
      id: existingIdByExerciseId.get(exerciseId) ?? null,
      exerciseId,
    }));
    setDayExercises(dayIndex, exercises);
    router.back();
  };

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ScreenHeader
        onBackPress={handleCancel}
        backLabel={t('common.cancel')}
        title={t('programs.day', { number: dayIndex + 1 })}
        style={{ marginTop: clearance.top }}
      />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.exercisePicker.loading')}
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={retry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('components.exerciseSearchBar.placeholder')}
          />

          <MuscleGroupFilter
            muscleGroups={loadState.muscleGroups}
            selectedMuscleGroup={selectedMuscleGroup}
            onSelect={setSelectedMuscleGroup}
          />

          <FlatList
            data={localizedExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary">
                {searchQuery.trim()
                  ? t('programs.exercisePicker.noMatchQuery', { query: searchQuery.trim() })
                  : t('programs.exercisePicker.noneForMuscleGroup')}
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

          <ThemedView>
            <Button onPress={handleConfirm}>
              <ThemedText type="smallBold">
                {t('programs.exercisePicker.confirmWithCount', { count: selected.length })}
              </ThemedText>
            </Button>
          </ThemedView>
        </>
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
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
});
