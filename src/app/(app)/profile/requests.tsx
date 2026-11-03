import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useFriendsChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
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

/**
 * One incoming request, as web's `.request` row (requests.module.scss):
 * a 96px photo and the name on the left (tapping opens the profile), a
 * column of "Accept"/"Decline" buttons (web's `.button`, 16px text, 16px
 * apart) on the right.
 */
function RequestRow({
  profile,
  isSubmitting,
  onAccept,
  onDecline,
}: {
  profile: Profile;
  isSubmitting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const buttonStyle = [styles.requestButton, { backgroundColor: theme.workspace }];

  return (
    <View style={styles.request}>
      <Pressable style={styles.requestInfo} onPress={() => router.push(`/profile/${profile.id}`)}>
        <Avatar uri={profile.avatar_url} name={profile.username} size={96} radius={0} />
        <ThemedText style={styles.requestName}>
          {profile.username ?? t('components.userCard.unknownUser')}
        </ThemedText>
      </Pressable>
      <View style={styles.requestActions}>
        <Button disabled={isSubmitting} onPress={onAccept} style={buttonStyle}>
          <ThemedText style={styles.requestButtonText}>
            {isSubmitting ? '…' : t('profile.requests.accept')}
          </ThemedText>
        </Button>
        <Button disabled={isSubmitting} onPress={onDecline} style={buttonStyle}>
          <ThemedText style={styles.requestButtonText}>
            {isSubmitting ? '…' : t('profile.requests.decline')}
          </ThemedText>
        </Button>
      </View>
    </View>
  );
}

type TrainerRequestsState =
  | { state: 'loading' }
  | { state: 'ready'; requests: TrainerClient[] }
  | { state: 'error'; message: string };

export default function RequestsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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
      contentStyle={{ gap: Spacing.three }}
    >
      {/* requests.module.scss's plain `<h2>Requests</h2>`. */}
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('profile.requests.title')}
      </ThemedText>

      <ThemedView style={styles.section}>
        {/* Matches "Trainer requests" below exactly (same type, same
            left alignment) — previously this section had no heading of
            its own at all, an asymmetry with the trainer section that
            read as inconsistent once both existed side by side. */}
        <ThemedText style={[styles.sectionTitle, { color: theme.title }]}>
          {t('profile.requests.friendRequestsTitle')}
        </ThemedText>

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
              <ThemedText style={styles.emptyText}>{t('profile.requests.empty')}</ThemedText>
            ) : (
              <ThemedView style={styles.list}>
                {requests.map((request) => {
                  const profile = profileById.get(request.user_id);
                  if (!profile) return null;
                  const isSubmitting = submittingIds.has(request.id);

                  return (
                    <RequestRow
                      key={request.id}
                      profile={profile}
                      isSubmitting={isSubmitting}
                      onAccept={() => handleAccept(request.id)}
                      onDecline={() => handleDecline(request.id)}
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
          <ThemedText style={[styles.sectionTitle, { color: theme.title }]}>
            {t('trainer.requests.title')}
          </ThemedText>

          {trainerActionError && (
            <ThemedText type="small" themeColor="danger">
              ❌ {trainerActionError}
            </ThemedText>
          )}

          {trainerRequestsState.requests.length === 0 ? (
            <ThemedText style={styles.emptyText}>{t('trainer.requests.empty')}</ThemedText>
          ) : (
            <ThemedView style={styles.list}>
              {trainerRequestsState.requests.map((request) => {
                const profile = profileById.get(request.client_id);
                if (!profile) return null;
                const isSubmitting = trainerSubmittingIds.has(request.id);

                return (
                  <RequestRow
                    key={request.id}
                    profile={profile}
                    isSubmitting={isSubmitting}
                    onAccept={() => handleAcceptTrainer(request.id)}
                    onDecline={() => handleDeclineTrainer(request.id)}
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

// Measured live on web's /requests at 390px (requests.module.scss).
const styles = StyleSheet.create({
  // Heading and its empty-state line sit flush; a list starts 16px below.
  section: {
    gap: 0,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 400,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  request: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  requestInfo: {
    flexDirection: 'row',
    gap: Spacing.three,
    flexShrink: 1,
  },
  requestName: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
    flexShrink: 1,
  },
  requestActions: {
    gap: Spacing.three,
  },
  requestButton: {
    minHeight: 31,
    paddingVertical: Spacing.one,
  },
  requestButtonText: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
  },
});
