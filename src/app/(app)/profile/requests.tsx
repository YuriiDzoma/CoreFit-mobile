import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { acceptFriendRequest, declineFriendRequest } from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

export default function RequestsScreen() {
  const user = useAuthStore((state) => state.user);
  const requests = useFriendRequestsStore((state) => state.requests);
  const phase = useFriendRequestsStore((state) => state.phase);
  const loadError = useFriendRequestsStore((state) => state.error);
  const refresh = useFriendRequestsStore((state) => state.refresh);
  const removeRequest = useFriendRequestsStore((state) => state.removeRequest);

  const [profileById, setProfileById] = useState<Map<string, Profile>>(new Map());
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // The requests list itself comes from the shared friend-requests-store,
  // kept live by the Realtime subscription AuthProvider opens for the
  // whole signed-in session — this screen never re-triggers that fetch on
  // focus. Only the profile lookups (a purely local, presentational
  // concern) are refetched here, silently, matching users.tsx/friends.tsx's
  // own refetch-on-focus convention; a failed lookup just leaves the
  // previous map in place rather than blocking the screen, since a
  // per-item `profile` miss already renders nothing for that row below.
  useFocusEffect(
    useCallback(() => {
      getAllProfiles()
        .then((profiles) => {
          setProfileById(new Map(profiles.map((profile) => [profile.id, profile])));
        })
        .catch(() => {});
    }, []),
  );

  const handleRetry = () => {
    if (user?.id) refresh(user.id);
  };

  const withSubmitting = (requestId: string, action: () => Promise<void>) => {
    setActionError(null);
    setSubmittingIds((prev) => new Set(prev).add(requestId));
    action()
      .then(() => removeRequest(requestId))
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

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <ScreenHeader backHref="/profile" backLabel="← Back" title="Requests" />

      {phase === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading requests…
        </ThemedText>
      )}

      {phase === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadError}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {phase === 'ready' && (
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
                const profile = profileById.get(request.user_id);
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
