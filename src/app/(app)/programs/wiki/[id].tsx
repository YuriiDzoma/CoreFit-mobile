import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { YoutubeEmbed } from '@/components/youtube-embed';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
import { formatExerciseType } from '@/lib/format-enums';
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

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const clearance = useTrainingChromeClearance();

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
    if (loadState.state !== 'success' || !localized?.muscleGroupId) return t('common.notSpecified');
    const match = loadState.muscleGroups.find((group) => group.id === localized.muscleGroupId);
    return match?.name ?? t('common.notSpecified');
  }, [loadState, localized, t]);

  return (
    <Workspace
      scroll
      bottomClearance={clearance.bottom}
      contentStyle={{ paddingBottom: Spacing.four, gap: Spacing.three }}
    >
      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.wiki.byId.loading')}
        </ThemedText>
      )}

      {loadState.state === 'not-found' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('programs.wiki.byId.notFound')}
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
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

          <ThemedText type="pageTitle">{localized.name || t('programs.wiki.byId.untitled')}</ThemedText>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.create.typeLabel')}
            </ThemedText>
            <ThemedText>{formatExerciseType(t, localized.type)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.wiki.byId.primaryMuscleGroup')}
            </ThemedText>
            <ThemedText>{primaryMuscleGroupName}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.wiki.byId.secondaryMuscles')}
            </ThemedText>
            <ThemedText>{localized.secondary || t('common.none')}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.fieldGroup}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('programs.wiki.byId.description')}
            </ThemedText>
            <ThemedText>
              {localized.description || t('programs.wiki.byId.noDescription')}
            </ThemedText>
          </ThemedView>

          <YoutubeEmbed url={localized.videoUrl} title={localized.name} />
        </ThemedView>
      )}
    </Workspace>
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
