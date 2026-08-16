import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FriendsPreview } from '@/components/friends-preview';
import { ProgramsList } from '@/components/programs-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { isNotFoundError } from '@/lib/supabase/errors';
import {
  deleteFriendship,
  getFriendshipState,
  getFriendshipsForUser,
  resolveFriendProfiles,
  sendFriendRequest,
  type Friendship,
} from '@/lib/supabase/friends';
import { getPrograms, type ProgramRow } from '@/lib/supabase/programs';
import { getAllProfiles, getProfileById, type Profile } from '@/lib/supabase/profile';
import {
  deleteTrainerLink,
  getTrainerClientLinksForUser,
  getTrainerClientState,
  sendTrainerRequest,
  type TrainerClient,
} from '@/lib/supabase/trainer-clients';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | {
      state: 'success';
      profile: Profile;
      programs: ProgramRow[];
      friends: Profile[];
      viewerFriendships: Friendship[];
      trainerLinks: TrainerClient[];
      // The signed-in viewer's own profile — only needed for its
      // `is_trainer` flag (a trainer can't send a trainer request; only
      // an actual trainer can receive one, checked against `profile`
      // above, which already carries its own `is_trainer`). `null` when
      // viewing your own profile or before auth resolves — the "Add as
      // trainer" gate below treats that the same as "not a trainer".
      viewerProfile: Profile | null;
    }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

export default function UserProfileScreen() {
  const { t } = useTranslation();
  // Expo Router can hand back a dynamic param as string[] rather than
  // string — normalize once here rather than trusting the generic type.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const theme = useTheme();
  const clearance = useChromeClearance();

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [loadState, setLoadState] = useState<LoadState>(() =>
    id ? { state: 'loading' } : { state: 'not-found' },
  );

  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [isSubmittingFriendAction, setIsSubmittingFriendAction] = useState(false);
  const [pendingFriendRemoval, setPendingFriendRemoval] = useState<{
    friendshipId: string;
    name: string;
  } | null>(null);

  const [trainerActionError, setTrainerActionError] = useState<string | null>(null);
  const [isSubmittingTrainerAction, setIsSubmittingTrainerAction] = useState(false);
  // `asClient` picks which confirm copy to show — "remove my trainer" and
  // "remove my client" read differently even though both delete the same
  // row (see trainer-clients.ts's deleteTrainerLink, one function for
  // both — the direction only matters for display copy, not the call).
  const [pendingTrainerRemoval, setPendingTrainerRemoval] = useState<{
    linkId: string;
    asClient: boolean;
    name: string;
  } | null>(null);

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // All fetches are independent (profile, their programs, their friends,
  // and the *viewer's own* friendships/trainer links don't depend on each
  // other), so they run in the same Promise.all rather than sequentially
  // — kept as one combined LoadState, matching every other multi-fetch
  // screen in this app. `viewerFriendships`/`trainerLinks` are the
  // signed-in viewer's own relationships (for the Add/Remove friend and
  // Add-as-trainer buttons below) — a different query from `friendships`
  // here, which is the *viewed* profile's own friends, for FriendsPreview.
  const fetchData = (profileId: string, viewerId: string | undefined) => {
    Promise.all([
      getProfileById(profileId),
      getPrograms(profileId),
      getFriendshipsForUser(profileId),
      getAllProfiles(),
      viewerId ? getFriendshipsForUser(viewerId) : Promise.resolve([]),
      viewerId ? getTrainerClientLinksForUser(viewerId) : Promise.resolve([]),
      viewerId && viewerId !== profileId ? getProfileById(viewerId) : Promise.resolve(null),
    ])
      .then(
        ([profile, programs, friendships, profiles, viewerFriendships, trainerLinks, viewerProfile]) => {
          const profileById = new Map(profiles.map((p) => [p.id, p]));
          const friends = resolveFriendProfiles(friendships, profileId, profileById);
          setLoadState({
            state: 'success',
            profile,
            programs,
            friends,
            viewerFriendships,
            trainerLinks,
            viewerProfile,
          });
        },
      )
      .catch((error: unknown) => {
        if (isNotFoundError(error)) {
          setLoadState({ state: 'not-found' });
        } else {
          setLoadState({ state: 'error', message: (error as Error).message });
        }
      });
  };

  useEffect(() => {
    if (id) {
      fetchData(id, user?.id);
    }
    // Re-runs when the viewer's own id becomes available (auth loads
    // shortly after mount) so the friend/trainer buttons aren't stuck
    // showing stale "no relationship" state from an unauthenticated fetch.
  }, [id, user?.id]);

  const handleRetry = () => {
    if (!id) return;
    setLoadState({ state: 'loading' });
    fetchData(id, user?.id);
  };

  const handleProgramPress = (programId: string) => {
    router.push(`/programs/${programId}`);
  };

  const isOwnProfile = loadState.state === 'success' && loadState.profile.id === user?.id;

  // Only re-fetches the viewer's own two relationship lists after an
  // action — not the whole profile/programs/viewed-friends payload,
  // matching users.tsx's own refreshFriendships (lighter than a full
  // fetchData call for the same reason).
  const refreshRelationships = () => {
    if (!user?.id) return;
    Promise.all([getFriendshipsForUser(user.id), getTrainerClientLinksForUser(user.id)]).then(
      ([viewerFriendships, trainerLinks]) => {
        setLoadState((prev) =>
          prev.state === 'success' ? { ...prev, viewerFriendships, trainerLinks } : prev,
        );
      },
    );
  };

  const handleAddFriend = () => {
    if (!user?.id || !id) return;
    setFriendActionError(null);
    setIsSubmittingFriendAction(true);
    sendFriendRequest(user.id, id)
      .then(refreshRelationships)
      .catch((error: unknown) => setFriendActionError((error as Error).message))
      .finally(() => setIsSubmittingFriendAction(false));
  };

  const handleCancelFriendRequest = (friendshipId: string) => {
    setFriendActionError(null);
    setIsSubmittingFriendAction(true);
    deleteFriendship(friendshipId)
      .then(refreshRelationships)
      .catch((error: unknown) => setFriendActionError((error as Error).message))
      .finally(() => setIsSubmittingFriendAction(false));
  };

  const handleConfirmRemoveFriend = () => {
    if (!pendingFriendRemoval) return;
    const { friendshipId } = pendingFriendRemoval;
    setPendingFriendRemoval(null);
    setFriendActionError(null);
    setIsSubmittingFriendAction(true);
    deleteFriendship(friendshipId)
      .then(refreshRelationships)
      .catch((error: unknown) => setFriendActionError((error as Error).message))
      .finally(() => setIsSubmittingFriendAction(false));
  };

  const handleAddTrainer = () => {
    if (!user?.id || !id) return;
    setTrainerActionError(null);
    setIsSubmittingTrainerAction(true);
    sendTrainerRequest(user.id, id)
      .then(refreshRelationships)
      .catch((error: unknown) => setTrainerActionError((error as Error).message))
      .finally(() => setIsSubmittingTrainerAction(false));
  };

  const handleCancelTrainerRequest = (linkId: string) => {
    setTrainerActionError(null);
    setIsSubmittingTrainerAction(true);
    deleteTrainerLink(linkId)
      .then(refreshRelationships)
      .catch((error: unknown) => setTrainerActionError((error as Error).message))
      .finally(() => setIsSubmittingTrainerAction(false));
  };

  const handleConfirmRemoveTrainerLink = () => {
    if (!pendingTrainerRemoval) return;
    const { linkId } = pendingTrainerRemoval;
    setPendingTrainerRemoval(null);
    setTrainerActionError(null);
    setIsSubmittingTrainerAction(true);
    deleteTrainerLink(linkId)
      .then(refreshRelationships)
      .catch((error: unknown) => setTrainerActionError((error as Error).message))
      .finally(() => setIsSubmittingTrainerAction(false));
  };

  const friendState =
    loadState.state === 'success' && user?.id
      ? getFriendshipState(loadState.viewerFriendships, user.id, loadState.profile.id)
      : { status: 'none' as const };

  const trainerState =
    loadState.state === 'success' && user?.id
      ? getTrainerClientState(loadState.trainerLinks, user.id, loadState.profile.id)
      : { status: 'none' as const };

  // getTrainerClientState's 'accepted' case doesn't itself say which role
  // the viewer has (trainer or client) — both directions collapse to the
  // same status. Resolved here from the matching link row, only where the
  // distinction actually matters: which button label/confirm copy to show.
  const acceptedTrainerLink =
    loadState.state === 'success' && trainerState.status === 'accepted'
      ? loadState.trainerLinks.find((link) => link.id === trainerState.linkId)
      : null;
  const viewerIsClientOfAcceptedLink = acceptedTrainerLink?.client_id === user?.id;

  // Only a self-declared trainer can be *asked* to be one, and only a
  // non-trainer can *ask* — a trainer can't also be someone else's
  // client. Enforced server-side too (the trainer_clients insert policy
  // checks both flags — see docs/decisions.md), this only controls
  // whether the "Add as trainer" button itself renders; it doesn't
  // affect an already-outgoing/accepted relationship, which stays
  // visible regardless of either party's *current* flag.
  const targetIsTrainer = loadState.state === 'success' && loadState.profile.is_trainer === true;
  const viewerIsTrainer =
    loadState.state === 'success' && loadState.viewerProfile?.is_trainer === true;

  return (
    <>
      <Workspace
        justify="flex-start"
        contentStyle={{
          paddingTop: clearance.top + Spacing.four,
          paddingBottom: clearance.bottom,
          gap: Spacing.three,
        }}
      >
        {loadState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.loadingProfile')}
          </ThemedText>
        )}

        {loadState.state === 'not-found' && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.byId.notFound')}
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
            <ThemedView style={styles.header}>
              <Avatar
                uri={loadState.profile.avatar_url}
                name={loadState.profile.username}
                size={96}
              />
              <ThemedText type="pageTitle">
                {loadState.profile.username ?? t('components.userCard.unknownUser')}
              </ThemedText>
              {/* loadState.profile.email is intentionally never rendered here —
                    getProfileById returns it (RLS permits reading any profile's
                    email, per profile.ts's own decision log) but showing another
                    user's email is a deliberate privacy choice, not a gap left
                    because the data wasn't available. */}
              {loadState.profile.created_at && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('profile.byId.joined')}{' '}
                  {new Date(loadState.profile.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </ThemedText>
              )}

              {isOwnProfile && (
                <Pressable
                  style={({ pressed }) => [
                    styles.signOutButton,
                    { backgroundColor: theme.danger },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => signOut()}
                >
                  <ThemedText type="smallBold">{t('components.header.signOut')}</ThemedText>
                </Pressable>
              )}

              {!isOwnProfile && user?.id && (
                <ThemedView style={[styles.actionsBlock, { backgroundColor: 'transparent' }]}>
                  {friendState.status === 'none' && (
                    <Button onPress={handleAddFriend} disabled={isSubmittingFriendAction}>
                      <ThemedText type="smallBold">
                        {isSubmittingFriendAction ? '…' : t('users.addFriend')}
                      </ThemedText>
                    </Button>
                  )}
                  {friendState.status === 'outgoing' && (
                    <Button
                      onPress={() => handleCancelFriendRequest(friendState.friendshipId)}
                      disabled={isSubmittingFriendAction}
                    >
                      <ThemedText type="smallBold">
                        {isSubmittingFriendAction ? '…' : t('users.cancelRequest')}
                      </ThemedText>
                    </Button>
                  )}
                  {friendState.status === 'incoming' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('users.pending')}
                    </ThemedText>
                  )}
                  {friendState.status === 'accepted' && (
                    <Button
                      onPress={() =>
                        setPendingFriendRemoval({
                          friendshipId: friendState.friendshipId,
                          name: loadState.profile.username ?? t('users.thisUser'),
                        })
                      }
                      disabled={isSubmittingFriendAction}
                    >
                      <ThemedText type="smallBold" themeColor="danger">
                        {isSubmittingFriendAction ? '…' : t('users.removeFriend')}
                      </ThemedText>
                    </Button>
                  )}

                  {friendActionError && (
                    <ThemedText type="small" themeColor="danger">
                      ❌ {friendActionError}
                    </ThemedText>
                  )}

                  {/* Trainer requests only make sense between friends —
                      enforced both here (visibility) and at the RLS layer
                      (the insert policy itself requires an accepted
                      friendship — see docs/decisions.md). */}
                  {friendState.status === 'accepted' && (
                    <>
                      {trainerState.status === 'none' && targetIsTrainer && !viewerIsTrainer && (
                        <Button onPress={handleAddTrainer} disabled={isSubmittingTrainerAction}>
                          <ThemedText type="smallBold">
                            {isSubmittingTrainerAction ? '…' : t('trainer.addAsTrainer')}
                          </ThemedText>
                        </Button>
                      )}
                      {trainerState.status === 'outgoing' && (
                        <Button
                          onPress={() => handleCancelTrainerRequest(trainerState.linkId)}
                          disabled={isSubmittingTrainerAction}
                        >
                          <ThemedText type="smallBold">
                            {isSubmittingTrainerAction ? '…' : t('users.cancelRequest')}
                          </ThemedText>
                        </Button>
                      )}
                      {trainerState.status === 'accepted' && (
                        <Button
                          onPress={() =>
                            setPendingTrainerRemoval({
                              linkId: trainerState.linkId,
                              asClient: viewerIsClientOfAcceptedLink,
                              name: loadState.profile.username ?? t('users.thisUser'),
                            })
                          }
                          disabled={isSubmittingTrainerAction}
                        >
                          <ThemedText type="smallBold" themeColor="danger">
                            {isSubmittingTrainerAction
                              ? '…'
                              : viewerIsClientOfAcceptedLink
                                ? t('trainer.yourTrainer')
                                : t('trainer.yourClient')}
                          </ThemedText>
                        </Button>
                      )}

                      {trainerActionError && (
                        <ThemedText type="small" themeColor="danger">
                          ❌ {trainerActionError}
                        </ThemedText>
                      )}
                    </>
                  )}
                </ThemedView>
              )}
            </ThemedView>

            {loadState.friends.length > 0 && (
              <FriendsPreview
                friends={loadState.friends}
                totalCount={loadState.friends.length}
                onFriendPress={(friendId) => router.push(`/profile/${friendId}`)}
                onSeeAllPress={() =>
                  router.push({ pathname: '/profile/friends', params: { userId: id } })
                }
              />
            )}

            <ThemedView style={styles.programsSection}>
              <ThemedText type="smallBold">{t('components.trainingSubNav.programs')}</ThemedText>

              {isOwnProfile && (
                <Button onPress={() => router.push('/programs/create')}>
                  <ThemedText type="smallBold">{t('profile.byId.createProgram')}</ThemedText>
                </Button>
              )}

              {loadState.programs.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {isOwnProfile ? t('profile.byId.noProgramsOwn') : t('profile.byId.noProgramsOther')}
                </ThemedText>
              ) : (
                <ProgramsList programs={loadState.programs} onProgramPress={handleProgramPress} />
              )}
            </ThemedView>
          </>
        )}
      </Workspace>

      <ConfirmDialog
        visible={pendingFriendRemoval !== null}
        title={t('users.removeConfirm.title')}
        message={t('users.removeConfirm.body', { name: pendingFriendRemoval?.name ?? '' })}
        confirmLabel={t('common.remove')}
        onConfirm={handleConfirmRemoveFriend}
        onCancel={() => setPendingFriendRemoval(null)}
        confirming={isSubmittingFriendAction}
      />

      <ConfirmDialog
        visible={pendingTrainerRemoval !== null}
        title={
          pendingTrainerRemoval?.asClient
            ? t('trainer.removeTrainerConfirm.title')
            : t('trainer.removeClientConfirm.title')
        }
        message={
          pendingTrainerRemoval?.asClient
            ? t('trainer.removeTrainerConfirm.body', { name: pendingTrainerRemoval?.name ?? '' })
            : t('trainer.removeClientConfirm.body', { name: pendingTrainerRemoval?.name ?? '' })
        }
        confirmLabel={t('common.remove')}
        onConfirm={handleConfirmRemoveTrainerLink}
        onCancel={() => setPendingTrainerRemoval(null)}
        confirming={isSubmittingTrainerAction}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  actionsBlock: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  programsSection: {
    flex: 1,
    gap: Spacing.two,
  },
});
