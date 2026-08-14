import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseSearchBar } from '@/components/exercise-search-bar';
import { MuscleGroupFilter } from '@/components/muscle-group-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { useExerciseBrowser } from '@/hooks/use-exercise-browser';

function handleExercisePress(id: string) {
  router.push(`/programs/wiki/${id}`);
}

export default function WikiScreen() {
  const { t } = useTranslation();
  const clearance = useTrainingChromeClearance();
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
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText style={[styles.pageTitle, { marginTop: clearance.top }]}>
        {t('components.trainingSubNav.wiki')}
      </ThemedText>

      {/* Web's Wiki page has no search bar at all — filtering is by
          muscle group only. Kept per the Stage 2 review rule: it doesn't
          conflict with web's structure, doesn't touch the shell/nav, and
          adds a capability rather than removing one. */}
      {loadState.state === 'success' && (
        <ExerciseSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      )}

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.exercisePicker.loading')}
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={retry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Mobile-native layout, not a port of web's `.content` row (see
          MuscleGroupFilter's own doc comment): the muscle-group rail sits
          above the list, horizontally scrolling, rather than beside it as
          a vertical sidebar. */}
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
            contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary">
                {searchQuery.trim()
                  ? t('programs.exercisePicker.noMatchQuery', { query: searchQuery.trim() })
                  : t('programs.exercisePicker.noneForMuscleGroup')}
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
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  // Vertical stack now (rail above list) — see the doc comment above.
  content: {
    flex: 1,
    gap: Spacing.two,
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
