import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';

import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { UserCard } from '@/components/user-card';
import { UsersSkeleton } from '@/components/users-skeleton';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { getOrCreateConversation } from '@/lib/supabase/messages';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; profiles: Profile[] }
  | { state: 'error'; message: string };

/** Any user, not just friends — matches the product decision for this
 * beta (no friends-only restriction, unlike `trainer_clients`' own
 * "already accepted friends" gate). Reuses `getAllProfiles`/`UserCard`/
 * `SearchBar`, the exact same browse-and-search shape the Users screen
 * already has, just with a different tap action. */
export default function NewMessageScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useChromeClearance();

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [searchQuery, setSearchQuery] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    getAllProfiles()
      .then((profiles) => setLoadState({ state: 'success', profiles }))
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  }, []);

  const others = useMemo(
    () => (loadState.state === 'success' ? loadState.profiles.filter((p) => p.id !== user?.id) : []),
    [loadState, user?.id],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredOthers = useMemo(
    () =>
      trimmedQuery
        ? others.filter((profile) => (profile.username ?? '').toLowerCase().includes(trimmedQuery))
        : others,
    [others, trimmedQuery],
  );

  const handlePick = (profileId: string) => {
    if (!user?.id || startingId) return;
    setStartingId(profileId);
    setStartError(null);
    getOrCreateConversation(user.id, profileId)
      .then((conversation) => {
        router.replace(`/messages/${conversation.id}`);
      })
      .catch((error: Error) => {
        setStartError(error.message);
        setStartingId(null);
      });
  };

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('messages.newMessage')}
      </ThemedText>

      {loadState.state === 'loading' && <UsersSkeleton />}

      {loadState.state === 'error' && (
        <ThemedText type="small" themeColor="danger">
          ❌ {loadState.message}
        </ThemedText>
      )}

      {startError && (
        <ThemedText type="small" themeColor="danger">
          ❌ {startError}
        </ThemedText>
      )}

      {loadState.state === 'success' && (
        <>
          {others.length > 0 && (
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('users.searchPlaceholder')}
            />
          )}

          {others.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('users.empty')}
            </ThemedText>
          ) : filteredOthers.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('users.noMatch', { query: trimmedQuery })}
            </ThemedText>
          ) : (
            <FlatList
              data={filteredOthers}
              keyExtractor={(profile) => profile.id}
              contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
              renderItem={({ item: profile }) => (
                <UserCard
                  profile={profile}
                  onPress={() => handlePick(profile.id)}
                  action={
                    startingId === profile.id ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        …
                      </ThemedText>
                    ) : undefined
                  }
                />
              )}
            />
          )}
        </>
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
});
