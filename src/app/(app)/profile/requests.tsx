import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { acceptFriendRequest, declineFriendRequest } from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

export default function RequestsScreen() {
  const user = useAuthStore((state) => state.user);
  const clearance = useChromeClearance();
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
    <Workspace
      justify="flex-start"
      contentStyle={{ gap: Spacing.three }}
    >
      {/* requests.module.scss's plain `<h2>Requests</h2>`. `marginTop`
          (not the Workspace container's own padding) carries the header
          clearance — padding the container would shrink the FlatList
          sibling's own frame below and break its ability to scroll
          behind the floating Header (see workspace.tsx). */}
      <ThemedText style={[styles.pageTitle, { marginTop: clearance.top }]}>Requests</ThemedText>

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
              contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
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
    </Workspace>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
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
