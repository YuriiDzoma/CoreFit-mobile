import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { getFriendshipsForUser } from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; friends: Profile[] }
  | { state: 'error'; message: string };

function handleBrowseUsersPress() {
  router.push('/profile/users');
}

export default function FriendsScreen() {
  const user = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // `friendships` and `profiles` are independent fetches, combined here:
  // accepted rows are resolved to the *other* party's profile via the
  // whole-table profiles list rather than a per-friend fetch, since the
  // full profiles table is already being fetched whole on the Users screen
  // — reusing that same "fetch a small table whole" convention here too.
  const fetchData = (userId: string) => {
    Promise.all([getFriendshipsForUser(userId), getAllProfiles()])
      .then(([friendships, profiles]) => {
        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
        const friends = friendships
          .filter((friendship) => friendship.status === 'accepted')
          .map((friendship) =>
            friendship.user_id === userId ? friendship.friend_id : friendship.user_id,
          )
          .filter((id): id is string => id !== null)
          .map((id) => profileById.get(id))
          .filter((profile): profile is Profile => profile !== undefined);
        setLoadState({ state: 'success', friends });
      })
      .catch((error: unknown) => {
        setLoadState({ state: 'error', message: (error as Error).message });
      });
  };

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id);
    }
  }, [user?.id]);

  const handleRetry = () => {
    if (!user?.id) return;
    setLoadState({ state: 'loading' });
    fetchData(user.id);
  };

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <ScreenHeader backHref="/profile" backLabel="← Back" title="Friends" />

      <Pressable onPress={handleBrowseUsersPress}>
        <ThemedText type="linkPrimary">Browse users →</ThemedText>
      </Pressable>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading friends…
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

      {loadState.state === 'success' &&
        (loadState.friends.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            You don&apos;t have any friends yet.
          </ThemedText>
        ) : (
          <FlatList
            data={loadState.friends}
            keyExtractor={(profile) => profile.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: profile }) => (
              <UserCard profile={profile} onPress={() => router.push(`/profile/${profile.id}`)} />
            )}
          />
        ))}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
});
