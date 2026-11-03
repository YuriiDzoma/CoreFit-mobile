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
import { useTheme } from '@/hooks/use-theme';
import { formatExerciseType } from '@/lib/format-enums';
import { isNotFoundError } from '@/lib/supabase/errors';
import { getExerciseById, localizeExercise, type ExerciseRow } from '@/lib/supabase/exercises';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; exercise: ExerciseRow }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

export default function ExerciseDetailScreen() {
  const { t, i18n } = useTranslation();
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
    getExerciseById(exerciseId)
      .then((exercise) => setLoadState({ state: 'success', exercise }))
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
    () =>
      loadState.state === 'success' ? localizeExercise(loadState.exercise, i18n.language) : null,
    [loadState, i18n.language],
  );

  // Laid out like web's ExerciseDetail (measured live at 390px): centered
  // title, two 14px "Label: value" lines 16px apart, a 200px contained
  // image right under them, the description 16px below, the video 24px
  // below that.
  return (
    <Workspace scroll bottomClearance={clearance.bottom} contentStyle={styles.page}>
      {loadState.state === 'loading' && <ExerciseSkeleton />}

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
        <ThemedView>
          <ThemedText type="pageTitle" style={styles.title}>
            {localized.name || t('programs.wiki.byId.untitled')}
          </ThemedText>

          <ThemedView style={styles.info}>
            <ThemedText style={styles.text}>
              <ThemedText style={[styles.text, styles.label]}>{t('programs.create.typeLabel')}:</ThemedText>{' '}
              {formatExerciseType(t, localized.type)}
            </ThemedText>
            <ThemedText style={styles.text}>
              <ThemedText style={[styles.text, styles.label]}>
                {t('programs.wiki.byId.secondaryMuscles')}:
              </ThemedText>{' '}
              {localized.secondary || t('common.none')}
            </ThemedText>
          </ThemedView>

          {localized.imageUrl ? (
            <Image source={{ uri: localized.imageUrl }} style={styles.image} contentFit="contain" />
          ) : (
            <ThemedView style={styles.image} />
          )}

          <ThemedText style={[styles.text, styles.description]}>{localized.description}</ThemedText>

          <YoutubeEmbed url={localized.videoUrl} title={localized.name} style={styles.video} />
        </ThemedView>
      )}
    </Workspace>
  );
}

// Web's ExerciseSkeleton: title bar, two 100px rows, a blank image-height
// gap, a 132px description block, a 300px video block.
function ExerciseSkeleton() {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <ThemedView>
      <ThemedView style={[styles.skeletonBar, styles.skeletonTitle, bg]} />
      <ThemedView style={[styles.skeletonBar, styles.skeletonRow, bg]} />
      <ThemedView style={[styles.skeletonBar, styles.skeletonRow, bg]} />
      <ThemedView style={styles.skeletonImage} />
      <ThemedView style={[styles.skeletonBar, styles.skeletonText, bg]} />
      <ThemedView style={[styles.skeletonBar, styles.skeletonVideo, bg]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Web's `.videoWrapper` keeps 16px under the video.
  page: {
    paddingBottom: Spacing.three,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    marginBottom: Spacing.three,
  },
  info: {
    gap: Spacing.three,
  },
  text: {
    fontSize: 14,
    lineHeight: 16.5,
    fontWeight: 400,
  },
  label: {
    fontWeight: 700,
  },
  image: {
    width: '100%',
    height: 200,
  },
  description: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  video: {
    aspectRatio: undefined,
    height: 284,
  },
  skeletonBar: {
    borderRadius: Spacing.one,
  },
  skeletonTitle: {
    alignSelf: 'center',
    width: 120,
    height: 21,
    marginBottom: Spacing.three,
  },
  skeletonRow: {
    width: 100,
    height: 16,
    marginBottom: Spacing.three,
  },
  skeletonImage: {
    height: 200,
    marginTop: -Spacing.three,
  },
  skeletonText: {
    height: 132,
    marginVertical: Spacing.three,
  },
  skeletonVideo: {
    height: 300,
    marginTop: Spacing.two,
  },
});
