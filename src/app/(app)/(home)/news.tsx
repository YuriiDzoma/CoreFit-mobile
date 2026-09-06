import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useHomeChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { getNewsFeed, type NewsRow } from '@/lib/supabase/news';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; entries: NewsRow[] }
  | { state: 'error'; message: string };

// Mirrors HomeScreen's own local `HomeCardSkeleton` convention — each screen
// in this route group owns its own skeleton rather than sharing one, since
// each card's anatomy differs (image + title/date + description here, vs
// avatar + exercise lines on Trainings).
function NewsCardSkeleton() {
  const theme = useTheme();

  return (
    <View style={[styles.skeletonCard, { backgroundColor: theme.skeletonWrapperBg }]}>
      <View style={[styles.skeletonImage, { backgroundColor: theme.skeletonBg }]} />
      <View
        style={[styles.skeletonBar, styles.skeletonTitle, { backgroundColor: theme.skeletonBg }]}
      />
      <View
        style={[styles.skeletonBar, styles.skeletonDate, { backgroundColor: theme.skeletonBg }]}
      />
      <View
        style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.skeletonBg }]}
      />
      <View
        style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.skeletonBg }]}
      />
    </View>
  );
}

export default function NewsScreen() {
  const { t } = useTranslation();
  const clearance = useHomeChromeClearance();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Same convention as HomeScreen/RecordsScreen: never resets to 'loading'
  // on a refocus refetch, so new content swaps in silently.
  const fetchData = useCallback(() => {
    getNewsFeed()
      .then((entries) => setLoadState({ state: 'success', entries }))
      .catch((error: unknown) => {
        setLoadState({ state: 'error', message: (error as Error).message });
      });
  }, []);

  useFocusEffect(fetchData);

  const handleRetry = () => {
    setLoadState({ state: 'loading' });
    fetchData();
  };

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('components.homeSubNav.news')}
      </ThemedText>

      {loadState.state === 'loading' && (
        <ThemedView style={styles.list}>
          <NewsCardSkeleton />
          <NewsCardSkeleton />
        </ThemedView>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {loadState.state === 'success' && (
        <FlatList
          data={loadState.entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary">
              {t('news.empty')}
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ElevatedCard style={styles.card}>
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
              )}
              <ThemedText type="default">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(item.published_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {' · '}
                {new Date(item.published_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
              <ThemedText type="small">{item.description}</ThemedText>
            </ElevatedCard>
          )}
        />
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
    padding: Spacing.two,
    gap: Spacing.one,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    marginBottom: Spacing.one,
  },
  skeletonCard: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
  },
  skeletonBar: {
    borderRadius: Spacing.one,
  },
  skeletonTitle: {
    width: '60%',
    height: 19,
  },
  skeletonDate: {
    width: 120,
    height: 16,
  },
  skeletonLine: {
    width: '90%',
    height: 16,
  },
});
