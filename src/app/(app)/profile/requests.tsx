import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserCard } from '@/components/user-card';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useFriendsChromeClearance } from '@/hooks/use-chrome-clearance';
import { acceptFriendRequest, declineFriendRequest } from '@/lib/supabase/friends';
import { getAllProfiles, type Profile } from '@/lib/supabase/profile';
import {
  acceptTrainerRequest,
  deleteTrainerLink,
  getIncomingTrainerRequests,
  type TrainerClient,
} from '@/lib/supabase/trainer-clients';
import { useAuthStore } from '@/stores/auth-store';
import { useFriendRequestsStore } from '@/stores/friend-requests-store';

type TrainerRequestsState =
  | { state: 'loading' }
  | { state: 'ready'; requests: TrainerClient[] }
  | { state: 'error'; message: string };

export default function RequestsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useFriendsChromeClearance();
  const requests = useFriendRequestsStore((state) => state.requests);
  const phase = useFriendRequestsStore((state) => state.phase);
  const loadError = useFriendRequestsStore((state) => state.error);
  const refresh = useFriendRequestsStore((state) => state.refresh);
  const removeRequest = useFriendRequestsStore((state) => state.removeRequest);

  const [profileById, setProfileById] = useState<Map<string, Profile>>(new Map());
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // No dedicated store/Realtime for trainer requests in this first pass
  // (matching how Friend Requests itself started, before Sprint 35's
  // realtime follow-up) — a plain fetch-on-focus is enough; easy to
  // promote to a store the same way later if it's ever needed.
  const [trainerRequestsState, setTrainerRequestsState] = useState<TrainerRequestsState>({
    state: 'loading',
  });
  const [trainerSubmittingIds, setTrainerSubmittingIds] = useState<Set<string>>(new Set());
  const [trainerActionError, setTrainerActionError] = useState<string | null>(null);

  const userId = user?.id;

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

      if (!userId) return;
      setTrainerRequestsState({ state: 'loading' });
      getIncomingTrainerRequests(userId)
        .then((trainerRequests) => setTrainerRequestsState({ state: 'ready', requests: trainerRequests }))
        .catch((error: unknown) =>
          setTrainerRequestsState({ state: 'error', message: (error as Error).message }),
        );
    }, [userId]),
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

  const removeTrainerRequest = (linkId: string) => {
    setTrainerRequestsState((prev) =>
      prev.state === 'ready'
        ? { ...prev, requests: prev.requests.filter((request) => request.id !== linkId) }
        : prev,
    );
  };

  const withTrainerSubmitting = (linkId: string, action: () => Promise<void>) => {
    setTrainerActionError(null);
    setTrainerSubmittingIds((prev) => new Set(prev).add(linkId));
    action()
      .then(() => removeTrainerRequest(linkId))
      .catch((error: unknown) => setTrainerActionError((error as Error).message))
      .finally(() => {
        setTrainerSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(linkId);
          return next;
        });
      });
  };

  const handleAcceptTrainer = (linkId: string) => {
    if (!user?.id) return;
    withTrainerSubmitting(linkId, () => acceptTrainerRequest(linkId, user.id));
  };

  const handleDeclineTrainer = (linkId: string) => {
    withTrainerSubmitting(linkId, () => deleteTrainerLink(linkId));
  };

  return (
    // `scroll` — this screen now has two independent small sections
    // (friend requests, trainer requests) rather than one big virtualized
    // list, so a single owned ScrollView (not a FlatList, and not the
    // non-scroll Workspace variant every other Friends/Requests/Users
    // screen uses) is the right shape here; neither list is ever long
    // enough to need windowing. `topClearance={false}` + the manual
    // `marginTop` below reproduces the exact same FriendsSubNav-aware
    // clearance those other screens apply themselves — Workspace's own
    // internal clearance hook doesn't know about that floating bar.
    <Workspace
      scroll
      justify="flex-start"
      topClearance={false}
      bottomClearance={clearance.bottom}
      contentStyle={{ gap: Spacing.four }}
    >
      {/* requests.module.scss's plain `<h2>Requests</h2>`. */}
      <ThemedText style={[styles.pageTitle, { marginTop: clearance.top }]}>
        {t('profile.requests.title')}
      </ThemedText>

      <ThemedView style={styles.section}>
        {phase === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('profile.requests.loading')}
          </ThemedText>
        )}

        {phase === 'error' && (
          <ThemedView style={styles.errorBlock}>
            <ThemedText type="small" themeColor="danger">
              ❌ {loadError}
            </ThemedText>
            <Pressable onPress={handleRetry}>
              <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {phase === 'ready' && (
          <>
            {actionError && (
              <ThemedText type="small" themeColor="danger">
                ❌ {t(`errors.${actionError}`, { defaultValue: actionError })}
              </ThemedText>
            )}

            {requests.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('profile.requests.empty')}
              </ThemedText>
            ) : (
              <ThemedView style={styles.list}>
                {requests.map((request) => {
                  const profile = profileById.get(request.user_id);
                  if (!profile) return null;
                  const isSubmitting = submittingIds.has(request.id);

                  return (
                    <UserCard
                      key={request.id}
                      profile={profile}
                      onPress={() => router.push(`/profile/${profile.id}`)}
                      action={
                        <ThemedView style={styles.actions}>
                          <Pressable
                            disabled={isSubmitting}
                            onPress={() => handleAccept(request.id)}
                          >
                            <ThemedText type="smallBold">
                              {isSubmitting ? '…' : t('profile.requests.accept')}
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            disabled={isSubmitting}
                            onPress={() => handleDecline(request.id)}
                          >
                            <ThemedText type="smallBold" themeColor="danger">
                              {isSubmitting ? '…' : t('profile.requests.decline')}
                            </ThemedText>
                          </Pressable>
                        </ThemedView>
                      }
                    />
                  );
                })}
              </ThemedView>
            )}
          </>
        )}
      </ThemedView>

      {/* Trainer requests — a second, independent section below Friend
          Requests, not a new nav destination (per live discussion). Only
          rendered once loaded, so it doesn't flash an empty state while
          the friend-requests section above is still settling. */}
      {trainerRequestsState.state === 'ready' && (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">{t('trainer.requests.title')}</ThemedText>

          {trainerActionError && (
            <ThemedText type="small" themeColor="danger">
              ❌ {trainerActionError}
            </ThemedText>
          )}

          {trainerRequestsState.requests.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('trainer.requests.empty')}
            </ThemedText>
          ) : (
            <ThemedView style={styles.list}>
              {trainerRequestsState.requests.map((request) => {
                const profile = profileById.get(request.client_id);
                if (!profile) return null;
                const isSubmitting = trainerSubmittingIds.has(request.id);

                return (
                  <UserCard
                    key={request.id}
                    profile={profile}
                    onPress={() => router.push(`/profile/${profile.id}`)}
                    action={
                      <ThemedView style={styles.actions}>
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => handleAcceptTrainer(request.id)}
                        >
                          <ThemedText type="smallBold">
                            {isSubmitting ? '…' : t('profile.requests.accept')}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={isSubmitting}
                          onPress={() => handleDeclineTrainer(request.id)}
                        >
                          <ThemedText type="smallBold" themeColor="danger">
                            {isSubmitting ? '…' : t('profile.requests.decline')}
                          </ThemedText>
                        </Pressable>
                      </ThemedView>
                    }
                  />
                );
              })}
            </ThemedView>
          )}
        </ThemedView>
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.two,
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
