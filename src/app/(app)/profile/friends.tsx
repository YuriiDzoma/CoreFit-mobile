import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { getFriendshipsForUser, resolveFriendProfiles } from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; friends: Profile[]; viewedName: string | null }
  | { state: 'error'; message: string };

export default function FriendsScreen() {
  const user = useAuthStore((state) => state.user);

  // Absent → the signed-in user's own friends (unchanged from before this
  // param existed). Present → someone else's — reached from their profile's
  // FriendsPreview. A self-referencing id (?userId=<your own id>) degrades
  // safely to the own-profile case below, not a special case.
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const paramUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const subjectId = paramUserId ?? user?.id;
  const isOwnProfile = !paramUserId || paramUserId === user?.id;

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Guards the two setLoadState calls below against a real, reproduced race:
  // when this screen is the one expo-router restores directly on cold start
  // (no normal navigation in between — confirmed via repeated device tests,
  // not assumed), it briefly mounts a transient instance that unmounts and
  // remounts before the route settles. The transient instance's own fetch
  // can resolve after *its* unmount, racing the new instance's mount and
  // triggering React's "state update on a component that hasn't mounted
  // yet" warning. Each instance gets its own ref, reset to `false` by its
  // own cleanup — so a transient instance's late response is dropped by
  // the guard that belonged to *it*, not carried over to the real one.
  const canSetStateRef = useRef(false);
  useEffect(() => {
    canSetStateRef.current = true;
    return () => {
      canSetStateRef.current = false;
    };
  }, []);

  // Resolves both the friend list and (when viewing someone else) their
  // display name from the same already-fetched getAllProfiles() map,
  // rather than a second getProfileById call — a stale/removed userId
  // just falls back to a generic "Friends" title below instead of erroring.
  // Wrapped in useCallback (matching profile/index.tsx's fetchProfile)
  // since, unlike [id].tsx's fetchData, this one closes over isOwnProfile
  // — without memoizing it, the effect below would need `fetchData` itself
  // in its deps, and a fresh closure every render would refetch every render.
  const fetchData = useCallback(
    (id: string) => {
      Promise.all([getFriendshipsForUser(id), getAllProfiles()])
        .then(([friendships, profiles]) => {
          if (!canSetStateRef.current) return;
          const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
          const friends = resolveFriendProfiles(friendships, id, profileById);
          const viewedName = isOwnProfile ? null : (profileById.get(id)?.username ?? null);
          setLoadState({ state: 'success', friends, viewedName });
        })
        .catch((error: unknown) => {
          if (!canSetStateRef.current) return;
          setLoadState({ state: 'error', message: (error as Error).message });
        });
    },
    [isOwnProfile],
  );

  // Keyed on subjectId, not user?.id, so navigating from one user's
  // friends list to another's (or to your own) re-fetches — the same
  // dependency shape [id].tsx already uses for its own id param.
  useEffect(() => {
    if (subjectId) {
      fetchData(subjectId);
    }
  }, [subjectId, fetchData]);

  const handleRetry = () => {
    if (!subjectId) return;
    setLoadState({ state: 'loading' });
    fetchData(subjectId);
  };

  const title =
    loadState.state === 'success' && !isOwnProfile
      ? loadState.viewedName
        ? `${loadState.viewedName}'s Friends`
        : 'Friends'
      : 'Friends';

  return (
    <Workspace
      topInset={false}
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, gap: Spacing.three }}
    >
      {/* allFriends.module.scss's `pageTitle` — web always shows the
          plain "Friends" heading regardless of whose list it is; the
          per-viewed-user variant here is a pre-existing mobile addition,
          kept as a Stage 2 item (content-level, doesn't touch shell/nav). */}
      <ThemedText style={styles.pageTitle}>{title}</ThemedText>

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
            {isOwnProfile
              ? "You don't have any friends yet."
              : `${loadState.viewedName ?? 'This user'} doesn't have any friends yet.`}
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
});
