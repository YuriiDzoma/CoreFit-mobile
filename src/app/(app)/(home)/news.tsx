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
      {/* One two-line description text in the real card, so no gap here. */}
      <View>
        <View
          style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.skeletonBg }]}
        />
        <View
          style={[styles.skeletonBar, styles.skeletonLine, { backgroundColor: theme.skeletonBg }]}
        />
      </View>
    </View>
  );
}

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
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
              <ThemedText style={styles.title}>{item.title}</ThemedText>
              <ThemedText style={styles.date}>
                {new Date(item.published_at).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {' · '}
                {new Date(item.published_at).toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
              <ThemedText style={styles.description}>{item.description}</ThemedText>
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
  // Web's `.card` on /news (measured at 390px): 8px padding, 8px between
  // the 8px-radius 16:9 image, the 16px semibold title, the 13px date at
  // 70% and the 14px description.
  card: {
    padding: Spacing.two,
    gap: Spacing.two,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.two,
  },
  title: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 600,
  },
  date: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: 400,
    opacity: 0.7,
  },
  description: {
    fontSize: 14,
    lineHeight: 16.5,
    fontWeight: 400,
  },
  // Same gap/padding/image as `card`/`image` above; each bar sits inside
  // the line box of the text it stands in for (title 19, date 15,
  // description 16.5), 4px shorter than the line.
  skeletonCard: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.two,
  },
  skeletonBar: {
    borderRadius: Spacing.one,
    marginVertical: Spacing.half,
  },
  skeletonTitle: {
    width: '60%',
    height: 15,
  },
  skeletonDate: {
    width: 120,
    height: 11,
  },
  skeletonLine: {
    width: '90%',
    height: 12.5,
  },
});
