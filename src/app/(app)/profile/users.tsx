import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  deleteFriendship,
  getFriendshipsForUser,
  getFriendshipState,
  sendFriendRequest,
  type Friendship,
} from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; profiles: Profile[]; friendships: Friendship[] }
  | { state: 'error'; message: string };

export default function UsersScreen() {
  const user = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect
  // below (mirrors profile/[id].tsx's independent-fetches Promise.all).
  const fetchData = (userId: string) => {
    Promise.all([getAllProfiles(), getFriendshipsForUser(userId)])
      .then(([profiles, friendships]) => setLoadState({ state: 'success', profiles, friendships }))
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

  // Cheap, single-table refetch after a successful mutation — only
  // `friendships` can have changed, `profiles` hasn't, so there's no need
  // to redo the whole-table profiles fetch too.
  const refreshFriendships = () => {
    if (!user?.id) return;
    getFriendshipsForUser(user.id).then((friendships) => {
      setLoadState((prev) => (prev.state === 'success' ? { ...prev, friendships } : prev));
    });
  };

  const withSubmitting = (profileId: string, action: () => Promise<void>) => {
    setActionError(null);
    setSubmittingIds((prev) => new Set(prev).add(profileId));
    action()
      .then(refreshFriendships)
      .catch((error: unknown) => setActionError((error as Error).message))
      .finally(() => {
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
      });
  };

  const handleAdd = (profileId: string) => {
    if (!user?.id) return;
    withSubmitting(profileId, () => sendFriendRequest(user.id, profileId));
  };

  // Used directly for "Cancel request" and, after confirmation, for
  // "Remove friend" — both are the same delete call (see deleteFriendship's
  // own reasoning in friends.ts), so one handler covers both call sites.
  const handleDeleteFriendship = (profileId: string, friendshipId: string) => {
    withSubmitting(profileId, () => deleteFriendship(friendshipId));
  };

  const handleRemovePress = (profileId: string, friendshipId: string, name: string) => {
    const message = `You'll need to send a new request to become friends with ${name} again.`;

    // react-native-web's Alert.alert() is a no-op, so web needs its own
    // path — same Platform.OS branch established for Program Deletion.
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove friend?\n\n${message}`)) {
        handleDeleteFriendship(profileId, friendshipId);
      }
      return;
    }

    Alert.alert('Remove friend?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => handleDeleteFriendship(profileId, friendshipId),
      },
    ]);
  };

  const renderAction = (profile: Profile, friendships: Friendship[]) => {
    if (!user?.id) return null;
    const state = getFriendshipState(friendships, user.id, profile.id);
    const isSubmitting = submittingIds.has(profile.id);
    const name = profile.username ?? 'this user';

    if (state.status === 'accepted') {
      return (
        <Pressable
          disabled={isSubmitting}
          onPress={() => handleRemovePress(profile.id, state.friendshipId, name)}
        >
          <ThemedText type="smallBold" themeColor="danger">
            {isSubmitting ? '…' : 'Remove friend'}
          </ThemedText>
        </Pressable>
      );
    }

    if (state.status === 'outgoing') {
      return (
        <Pressable
          disabled={isSubmitting}
          onPress={() => handleDeleteFriendship(profile.id, state.friendshipId)}
        >
          <ThemedText type="smallBold">{isSubmitting ? '…' : 'Cancel request'}</ThemedText>
        </Pressable>
      );
    }

    if (state.status === 'incoming') {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Pending
        </ThemedText>
      );
    }

    return (
      <Pressable disabled={isSubmitting} onPress={() => handleAdd(profile.id)}>
        <ThemedText type="smallBold">{isSubmitting ? '…' : 'Add friend'}</ThemedText>
      </Pressable>
    );
  };

  const others =
    loadState.state === 'success' ? loadState.profiles.filter((p) => p.id !== user?.id) : [];

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <ScreenHeader backHref="/profile" backLabel="← Back" title="Users" />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading users…
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

      {loadState.state === 'success' && (
        <>
          {actionError && (
            <ThemedText type="small" themeColor="danger">
              ❌ {actionError}
            </ThemedText>
          )}

          {others.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No other users yet.
            </ThemedText>
          ) : (
            <FlatList
              data={others}
              keyExtractor={(profile) => profile.id}
              contentContainerStyle={styles.list}
              renderItem={({ item: profile }) => (
                <UserCard
                  profile={profile}
                  onPress={() => router.push(`/profile/${profile.id}`)}
                  action={renderAction(profile, loadState.friendships)}
                />
              )}
            />
          )}
        </>
      )}
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
