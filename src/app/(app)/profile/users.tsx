import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { SearchBar } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useFriendsChromeClearance } from '@/hooks/use-chrome-clearance';
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
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useFriendsChromeClearance();

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<{
    profileId: string;
    friendshipId: string;
    name: string;
  } | null>(null);

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

  // Opens the themed ConfirmDialog rather than Alert.alert/window.confirm
  // (see confirm-dialog.tsx) — the actual deletion happens in
  // handleConfirmRemoval below, once the user confirms in that dialog.
  const handleRemovePress = (profileId: string, friendshipId: string, name: string) => {
    setPendingRemoval({ profileId, friendshipId, name });
  };

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) return;
    handleDeleteFriendship(pendingRemoval.profileId, pendingRemoval.friendshipId);
    setPendingRemoval(null);
  };

  const renderAction = (profile: Profile, friendships: Friendship[]) => {
    if (!user?.id) return null;
    const state = getFriendshipState(friendships, user.id, profile.id);
    const isSubmitting = submittingIds.has(profile.id);
    const name = profile.username ?? t('users.thisUser');

    if (state.status === 'accepted') {
      return (
        <Pressable
          disabled={isSubmitting}
          onPress={() => handleRemovePress(profile.id, state.friendshipId, name)}
        >
          <ThemedText type="smallBold" themeColor="danger">
            {isSubmitting ? '…' : t('users.removeFriend')}
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
          <ThemedText type="smallBold">{isSubmitting ? '…' : t('users.cancelRequest')}</ThemedText>
        </Pressable>
      );
    }

    if (state.status === 'incoming') {
      return (
        <ThemedText type="small" themeColor="textSecondary">
          {t('users.pending')}
        </ThemedText>
      );
    }

    return (
      <Pressable disabled={isSubmitting} onPress={() => handleAdd(profile.id)}>
        <ThemedText type="smallBold">{isSubmitting ? '…' : t('users.addFriend')}</ThemedText>
      </Pressable>
    );
  };

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

  return (
    <>
      <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
        {/* `marginTop` (not the Workspace container's own padding) carries
            the header clearance — matches friends.tsx/requests.tsx exactly;
            see their identical comment for why padding the container
            itself would shrink the FlatList sibling's own scrolling
            frame. */}
        <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
          {t('components.friendsSubNav.users')}
        </ThemedText>

        {loadState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('users.loading')}
          </ThemedText>
        )}

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

        {loadState.state === 'success' && (
          <>
            {actionError && (
              <ThemedText type="small" themeColor="danger">
                ❌ {actionError}
              </ThemedText>
            )}

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
                    onPress={() => router.push(`/profile/${profile.id}`)}
                    action={renderAction(profile, loadState.friendships)}
                  />
                )}
              />
            )}
          </>
        )}
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
});
