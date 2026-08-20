import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FriendsSkeleton } from '@/components/friends-skeleton';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useFriendsChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteFriendship,
  getFriendshipState,
  getFriendshipsForUser,
  resolveFriendProfiles,
  type Friendship,
} from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; friends: Profile[]; friendships: Friendship[]; viewedName: string | null }
  | { state: 'error'; message: string };

export default function FriendsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = useFriendsChromeClearance();
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
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<{
    profileId: string;
    friendshipId: string;
    name: string;
  } | null>(null);

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
          setLoadState({ state: 'success', friends, friendships, viewedName });
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

  // Same submitting/error shape as users.tsx's own "Remove friend" flow —
  // duplicated rather than shared, matching how requests.tsx already
  // carries its own independent copy of the same pattern. A full
  // `fetchData` refetch (not just friendships, unlike users.tsx's lighter
  // `refreshFriendships`) is used here since this screen doesn't retain
  // the `profileById` map `resolveFriendProfiles` needs — simpler than
  // threading it through just to shave one query.
  const withSubmitting = (profileId: string, action: () => Promise<void>) => {
    if (!subjectId) return;
    setActionError(null);
    setSubmittingIds((prev) => new Set(prev).add(profileId));
    action()
      .then(() => fetchData(subjectId))
      .catch((error: unknown) => setActionError((error as Error).message))
      .finally(() => {
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
      });
  };

  // Opens the themed ConfirmDialog rather than Alert.alert/window.confirm
  // (see confirm-dialog.tsx) — the actual deletion happens in
  // handleConfirmRemoval below, once the user confirms in that dialog.
  const handleRemovePress = (profileId: string, friendshipId: string, name: string) => {
    setPendingRemoval({ profileId, friendshipId, name });
  };

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) return;
    const { profileId, friendshipId } = pendingRemoval;
    withSubmitting(profileId, () => deleteFriendship(friendshipId));
    setPendingRemoval(null);
  };

  const title =
    loadState.state === 'success' && !isOwnProfile && loadState.viewedName
      ? t('profile.friends.titleWithName', { name: loadState.viewedName })
      : t('profile.friends.title');

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredFriends = useMemo(() => {
    if (loadState.state !== 'success') return [];
    if (!trimmedQuery) return loadState.friends;
    return loadState.friends.filter((profile) =>
      (profile.username ?? '').toLowerCase().includes(trimmedQuery),
    );
  }, [loadState, trimmedQuery]);

  return (
    <>
      <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
        {/* allFriends.module.scss's `pageTitle` — web always shows the
            plain "Friends" heading regardless of whose list it is; the
            per-viewed-user variant here is a pre-existing mobile addition,
            kept as a Stage 2 item (content-level, doesn't touch shell/nav).
            `marginTop` (not the Workspace container's own padding) carries
            the header clearance here — padding the container would shrink
            the FlatList sibling's own frame below and break its ability to
            scroll behind the floating Header (see workspace.tsx). */}
        <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>{title}</ThemedText>

        {loadState.state === 'loading' && <FriendsSkeleton />}

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

        {loadState.state === 'success' && actionError && (
          <ThemedText type="small" themeColor="danger">
            ❌ {actionError}
          </ThemedText>
        )}

        {loadState.state === 'success' && loadState.friends.length > 0 && (
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('profile.friends.searchPlaceholder')}
          />
        )}

        {loadState.state === 'success' &&
          (loadState.friends.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {isOwnProfile
                ? t('profile.friends.emptyOwn')
                : t('profile.friends.emptyOther', {
                    name: loadState.viewedName ?? t('profile.friends.thisUser'),
                  })}
            </ThemedText>
          ) : trimmedQuery && filteredFriends.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('profile.friends.noMatch', { query: searchQuery.trim() })}
            </ThemedText>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(profile) => profile.id}
              contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
              renderItem={({ item: profile }) => {
                // Only your own friends list can remove anyone — viewing
                // someone else's (via their FriendsPreview) stays
                // read-only, same gating profile/friends.tsx already
                // applies to its title/empty-state copy above.
                if (!isOwnProfile || !user?.id) {
                  return (
                    <UserCard
                      profile={profile}
                      onPress={() => router.push(`/profile/${profile.id}`)}
                      variant="elevated"
                      avatarSize={32}
                    />
                  );
                }

                const state = getFriendshipState(loadState.friendships, user.id, profile.id);
                if (state.status !== 'accepted') return null;
                const isSubmitting = submittingIds.has(profile.id);
                const name = profile.username ?? t('users.thisUser');

                return (
                  <UserCard
                    profile={profile}
                    onPress={() => router.push(`/profile/${profile.id}`)}
                    hideChevron
                    variant="elevated"
                    avatarSize={32}
                    action={
                      <Button
                        disabled={isSubmitting}
                        onPress={() => handleRemovePress(profile.id, state.friendshipId, name)}
                        style={[styles.removeButton, { borderColor: theme.danger }]}
                      >
                        <ThemedText type="smallBold" themeColor="danger">
                          {isSubmitting ? '…' : t('users.removeFriend')}
                        </ThemedText>
                      </Button>
                    }
                  />
                );
              }}
            />
          ))}
      </Workspace>

      <ConfirmDialog
        visible={pendingRemoval !== null}
        title={t('users.removeConfirm.title')}
        message={t('users.removeConfirm.body', { name: pendingRemoval?.name ?? '' })}
        confirmLabel={t('common.remove')}
        onConfirm={handleConfirmRemoval}
        onCancel={() => setPendingRemoval(null)}
        confirming={pendingRemoval !== null && submittingIds.has(pendingRemoval.profileId)}
      />
    </>
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
  // Compact enough to sit inline in a UserCard row (Button's own default
  // 40px min-height/16px padding is sized for a standalone action, not
  // one sharing a row with an avatar and name).
  removeButton: {
    minHeight: 32,
    paddingHorizontal: Spacing.two,
  },
});
