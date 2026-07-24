import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getIncomingFriendRequests,
  type Friendship,
} from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; requests: Friendship[]; profileById: Map<string, Profile> }
  | { state: 'error'; message: string };

export default function RequestsScreen() {
  const user = useAuthStore((state) => state.user);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to pass directly to useFocusEffect.
  // Never resets to 'loading' itself, so a refocus refetch swaps data in
  // silently rather than flashing the loading state over existing content
  // (matching Home's own established refetch-on-focus pattern). Reuses
  // the already-fetched-whole getAllProfiles rather than a new by-ids
  // lookup, same convention friends.tsx/users.tsx already established.
  const fetchData = useCallback(() => {
    const userId = user?.id;
    if (!userId) return;
    Promise.all([getIncomingFriendRequests(userId), getAllProfiles()])
      .then(([requests, profiles]) => {
        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
        setLoadState({ state: 'success', requests, profileById });
      })
      .catch((error: unknown) => {
        setLoadState({ state: 'error', message: (error as Error).message });
      });
  }, [user?.id]);

  useFocusEffect(fetchData);

  const handleRetry = () => {
    setLoadState({ state: 'loading' });
    fetchData();
  };

  // Removes the request from local state immediately on success — no
  // refetch. Friends/Users pick up the change naturally next time their
  // own useFocusEffect fires when the user navigates there.
  const removeRequestLocally = (requestId: string) => {
    setLoadState((prev) =>
      prev.state === 'success'
        ? { ...prev, requests: prev.requests.filter((request) => request.id !== requestId) }
        : prev,
    );
  };

  const withSubmitting = (requestId: string, action: () => Promise<void>) => {
    setActionError(null);
    setSubmittingIds((prev) => new Set(prev).add(requestId));
    action()
      .then(() => removeRequestLocally(requestId))
      .catch((error: unknown) => setActionError((error as Error).message))
      .finally(() => {
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      });
  };

  const handleAccept = (requestId: string) => {
    if (!user?.id) return;
    withSubmitting(requestId, () => acceptFriendRequest(requestId, user.id));
  };

  const handleDecline = (requestId: string) => {
    if (!user?.id) return;
    withSubmitting(requestId, () => declineFriendRequest(requestId, user.id));
  };

  const requests = loadState.state === 'success' ? loadState.requests : [];

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <ScreenHeader backHref="/profile" backLabel="← Back" title="Requests" />

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading requests…
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

          {requests.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No pending friend requests.
            </ThemedText>
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(request) => request.id}
              contentContainerStyle={styles.list}
              renderItem={({ item: request }) => {
                const profile = loadState.profileById.get(request.user_id);
                if (!profile) return null;
                const isSubmitting = submittingIds.has(request.id);

                return (
                  <UserCard
                    profile={profile}
                    onPress={() => router.push(`/profile/${profile.id}`)}
                    action={
                      <ThemedView style={styles.actions}>
                        <Pressable disabled={isSubmitting} onPress={() => handleAccept(request.id)}>
                          <ThemedText type="smallBold">{isSubmitting ? '…' : 'Accept'}</ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => handleDecline(request.id)}
                        >
                          <ThemedText type="smallBold" themeColor="danger">
                            {isSubmitting ? '…' : 'Decline'}
                          </ThemedText>
                        </Pressable>
                      </ThemedView>
                    }
                  />
                );
              }}
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
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
