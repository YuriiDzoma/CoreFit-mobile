import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FriendsPreview } from '@/components/friends-preview';
import { PeoplePreview } from '@/components/people-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrainerBadge } from '@/components/trainer-badge';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { getFriendshipsForUser, resolveFriendProfiles } from '@/lib/supabase/friends';
import { getAllProfiles, getProfileById, type Profile } from '@/lib/supabase/profile';
import { getTrainerClientLinksForUser } from '@/lib/supabase/trainer-clients';
import { useAuthStore } from '@/stores/auth-store';

type ProfileLoadState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile; friends: Profile[]; people: Profile[] }
  | { state: 'error'; message: string };

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const theme = useTheme();
  const clearance = useChromeClearance();

  const [profileState, setProfileState] = useState<ProfileLoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never synchronously
  // at call time — so this is safe to invoke directly from the effect below.
  // Friends are fetched alongside the profile (independent data, same
  // combined-fetch shape profile/[id].tsx uses) rather than a second
  // effect/loading state of their own.
  const fetchProfile = useCallback((id: string) => {
    Promise.all([
      getProfileById(id),
      getFriendshipsForUser(id),
      getTrainerClientLinksForUser(id),
      getAllProfiles(),
    ])
      .then(([profile, friendships, trainerLinks, profiles]) => {
        const profileById = new Map(profiles.map((p) => [p.id, p]));
        const friends = resolveFriendProfiles(friendships, id, profileById);

        // Clients if I'm a trainer (people who accepted me), otherwise my
        // own trainer if I have one (accepted, the other direction) —
        // never both, and never an empty-state prompt when there's
        // neither (see docs/decisions.md, same rule FriendsPreview's own
        // callers already follow).
        const acceptedLinks = trainerLinks.filter((link) => link.status === 'accepted');
        const otherIds = profile.is_trainer
          ? acceptedLinks.filter((link) => link.trainer_id === id).map((link) => link.client_id)
          : acceptedLinks.filter((link) => link.client_id === id).map((link) => link.trainer_id);
        const people = otherIds
          .map((otherId) => profileById.get(otherId))
          .filter((p): p is Profile => p !== undefined);

        setProfileState({ state: 'success', profile, friends, people });
      })
      .catch((error: Error) => setProfileState({ state: 'error', message: error.message }));
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const handleRetry = () => {
    if (!user?.id) return;
    setProfileState({ state: 'loading' });
    fetchProfile(user.id);
  };

  const profile = profileState.state === 'success' ? profileState.profile : null;
  const displayName = profile?.username ?? user?.email ?? null;

  return (
    <Workspace
      justify="flex-start"
      contentStyle={{
        paddingTop: clearance.top,
        paddingBottom: clearance.bottom + Spacing.four,
        gap: Spacing.three,
      }}
    >
      {/* profiles.module.scss's `.profile__header`: a left-aligned row
          (avatar left, text stack right) — not centered/stacked like
          before. `.settings` is absolutely positioned top-right on the
          outer `.profile` container, own-profile only. Avatar radius 4px
          here specifically (Profile.client.tsx's own `img{border-radius:
          4px}`) — not circular, unlike Home's feed avatars; see the
          Stage 1 Shell Review for whether Avatar's shape needs revisiting
          elsewhere too. */}
      <View style={styles.profileContainer}>
        <View style={styles.header}>
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.username ?? user?.email}
            size={96}
            radius={Spacing.one}
          />

          <View style={styles.headerText}>
            {profileState.state === 'loading' && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('profile.loadingProfile')}
              </ThemedText>
            )}
            {profileState.state === 'error' && (
              <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
                <ThemedText type="small" themeColor="danger">
                  ❌ {profileState.message}
                </ThemedText>
                <Pressable onPress={handleRetry}>
                  <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
                </Pressable>
              </ThemedView>
            )}
            {displayName && profileState.state !== 'loading' && (
              <ThemedText style={styles.username}>{displayName}</ThemedText>
            )}

            {user?.email && (
              <ThemedText type="small" themeColor="textSecondary">
                {user.email}
              </ThemedText>
            )}
            {/* Profile.client.tsx: `{new Date(profile.created_at)
                .toLocaleString()}` — full locale date+time, no "Joined"
                prefix, dimmed via opacity (`span{opacity:0.4}`), not a
                themeColor swap. */}
            {profile?.created_at && (
              <ThemedText style={[styles.joinedDate, { color: theme.text }]}>
                {new Date(profile.created_at).toLocaleString()}
              </ThemedText>
            )}

            {profile?.city && (
              <ThemedText style={[styles.joinedDate, { color: theme.text }]}>
                {profile.city}
                {profile.country ? `, ${profile.country}` : ''}
              </ThemedText>
            )}

            {/* `people` is already exactly "my accepted clients" when
                `is_trainer` is true (see the comment at its own
                derivation above) — no separate fetch needed here. */}
            {profile?.is_trainer && profileState.state === 'success' && (
              <TrainerBadge clientCount={profileState.people.length} />
            )}

            {/* `.programsLink`: bold, underlined, 16px, opacity:1 (not
                dimmed like the date above it). Web links to
                `/training/{id}`; mobile's equivalent destination is the
                Programs tab. */}
            <Pressable onPress={() => router.push('/programs')}>
              <ThemedText style={[styles.programsLink, { color: theme.text }]}>
                {t('components.trainingSubNav.programs')}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {profileState.state === 'success' && (
          <Pressable style={styles.settingsIcon} onPress={() => router.push('/profile/settings')}>
            <SymbolView
              name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
              size={24}
              tintColor={theme.text}
            />
          </Pressable>
        )}
      </View>

      {profileState.state === 'success' && profileState.friends.length > 0 && (
        <FriendsPreview
          friends={profileState.friends}
          totalCount={profileState.friends.length}
          onFriendPress={(friendId) => router.push(`/profile/${friendId}`)}
          onSeeAllPress={() => router.push('/profile/friends')}
        />
      )}

      {profileState.state === 'success' && profileState.people.length > 0 && (
        <PeoplePreview
          people={profileState.people}
          title={
            profile?.is_trainer
              ? t('components.peoplePreview.clientsCount', { count: profileState.people.length })
              : t('components.peoplePreview.trainerCount', { count: profileState.people.length })
          }
          onPersonPress={(personId) => router.push(`/profile/${personId}`)}
        />
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    position: 'relative',
  },
  // `.profile__header`: row, column-gap 16, left-aligned (no centering).
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  headerText: {
    flexShrink: 1,
  },
  // `p{font-size:18px; margin:8px 0}`.
  username: {
    fontSize: 18,
    marginVertical: Spacing.two,
  },
  // `span{opacity:0.4}` — dimmed via opacity, not a themeColor swap.
  joinedDate: {
    opacity: 0.4,
  },
  // `.programsLink span{font-size:16px; opacity:1; font-weight:600;
  // letter-spacing:1.1; text-decoration:underline}`.
  programsLink: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1.1,
    textDecorationLine: 'underline',
    marginTop: Spacing.two,
  },
  // `.settings{position:absolute; right:4px; top:4px}`.
  settingsIcon: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
