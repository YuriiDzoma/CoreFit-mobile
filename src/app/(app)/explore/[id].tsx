import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YoutubeEmbed } from '@/components/youtube-embed';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { isNotFoundError } from '@/lib/supabase/errors';
import {
  getExerciseById,
  getMuscleGroups,
  localizeExercise,
  type ExerciseRow,
  type MuscleGroupRow,
} from '@/lib/supabase/exercises';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; exercise: ExerciseRow; muscleGroups: MuscleGroupRow[] }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

function formatExerciseType(type: string | null): string {
  switch (type) {
    case 'compound':
      return 'Compound';
    case 'isolation':
      return 'Isolation';
    default:
      return 'Not specified';
  }
}

export default function ExerciseDetailScreen() {
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = (exerciseId: string) => {
    Promise.all([getExerciseById(exerciseId), getMuscleGroups()])
      .then(([exercise, muscleGroups]) =>
        setLoadState({ state: 'success', exercise, muscleGroups }),
      )
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          setLoadState({ state: 'not-found' });
        } else {
          setLoadState({ state: 'error', message: (error as Error).message });
        }
      });
  };

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  const handleRetry = () => {
    if (!id) return;
    setLoadState({ state: 'loading' });
    fetchData(id);
  };

  const localized = useMemo(
    () => (loadState.state === 'success' ? localizeExercise(loadState.exercise) : null),
    [loadState],
  );

  const primaryMuscleGroupName = useMemo(() => {
    if (loadState.state !== 'success' || !localized?.muscleGroupId) return 'Not specified';
    const match = loadState.muscleGroups.find((group) => group.id === localized.muscleGroupId);
    return match?.name ?? 'Not specified';
  }, [loadState, localized]);

  return (
    <ScreenLayout
      scroll
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset + Spacing.four }}
    >
      <ScreenHeader backHref="/explore" backLabel="← Back to exercises" />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading exercise…
        </ThemedText>
      )}

      {loadState.state === 'not-found' && (
        <ThemedText type="small" themeColor="textSecondary">
          This exercise couldn&apos;t be found.
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

      {loadState.state === 'success' && localized && (
        <ThemedView style={styles.content}>
          {localized.imageUrl ? (
            <Image source={{ uri: localized.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <ThemedView type="backgroundElement" style={styles.image} />
          )}

          <ThemedText type="title">{localized.name || 'Untitled exercise'}</ThemedText>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Type
            </ThemedText>
            <ThemedText>{formatExerciseType(localized.type)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Primary muscle group
            </ThemedText>
            <ThemedText>{primaryMuscleGroupName}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Secondary muscles
            </ThemedText>
            <ThemedText>{localized.secondary || 'None'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              Description
            </ThemedText>
            <ThemedText>{localized.description || 'No description available.'}</ThemedText>
          </ThemedView>

          <YoutubeEmbed url={localized.videoUrl} title={localized.name} />
        </ThemedView>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  content: {
    gap: Spacing.four,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.three,
  },
  fieldGroup: {
    gap: Spacing.half,
  },
});
