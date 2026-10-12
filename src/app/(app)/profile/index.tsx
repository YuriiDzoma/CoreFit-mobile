import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { AvatarActionSheet } from '@/components/avatar-action-sheet';
import { FriendsPreview } from '@/components/friends-preview';
import { FullscreenImage } from '@/components/fullscreen-image';
import { PeoplePreview } from '@/components/people-preview';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileHeaderSkeleton, ProfilePeopleSkeleton } from '@/components/profile-skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserWall } from '@/components/user-wall';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { hasRealAvatar } from '@/lib/avatar';
import {
  AvatarTooLargeError,
  deleteAvatarFile,
  pickAvatarImage,
  uploadAvatar,
} from '@/lib/supabase/avatarStorage';
import { getFriendshipsForUser, resolveFriendProfiles } from '@/lib/supabase/friends';
import { getAllProfiles, getProfileById, updateProfileById, type Profile } from '@/lib/supabase/profile';
import { getTrainerClientLinksForUser } from '@/lib/supabase/trainer-clients';
import { useAuthStore } from '@/stores/auth-store';

type ProfileLoadState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile; friends: Profile[]; people: Profile[] }
  | { state: 'error'; message: string };

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useChromeClearance();

  const [profileState, setProfileState] = useState<ProfileLoadState>({ state: 'loading' });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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

  const applyAvatarChange = (newUrl: string | null) => {
    setProfileState((prev) =>
      prev.state === 'success' ? { ...prev, profile: { ...prev.profile, avatar_url: newUrl } } : prev,
    );
  };

  const handleChangePhoto = async () => {
    setSheetVisible(false);
    const asset = await pickAvatarImage();
    if (!asset || !user?.id) return;

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const newUrl = await uploadAvatar(user.id, asset);
      await updateProfileById(user.id, { avatar_url: newUrl });
      // Best-effort -- a no-op for a Google/ui-avatars URL we don't own.
      await deleteAvatarFile(profile?.avatar_url);
      applyAvatarChange(newUrl);
    } catch (err) {
      setAvatarError(err instanceof AvatarTooLargeError ? t('profile.avatar.tooLarge') : t('profile.avatar.uploadError'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    setSheetVisible(false);
    if (!user?.id) return;

    setAvatarUploading(true);
    try {
      await deleteAvatarFile(profile?.avatar_url);
      await updateProfileById(user.id, { avatar_url: null });
      applyAvatarChange(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    // `scroll` — this screen's content used to always fit one viewport
    // (avatar header + two short preview grids), so it never needed
    // Workspace's own ScrollView; the Wall section below can run to
    // several cards, well past viewport height, and none of this screen's
    // own content is a self-scrolling FlatList the way Home's/Records'
    // own feeds are (see Workspace's own doc comment on the two ways its
    // children can scroll) -- without this, everything past the fold was
    // simply unreachable, not just visually cramped. `topClearance`
    // defaults to `true` in `scroll` mode, so `clearance.top` no longer
    // needs to be applied by hand here the way the non-scroll branch
    // required.
    <Workspace
      scroll
      justify="flex-start"
      bottomClearance={clearance.bottom}
      contentStyle={{
        paddingBottom: Spacing.four,
        gap: Spacing.three,
      }}
    >
      {/* Mirrors web's own `loading.tsx` -- a full-page skeleton (header +
          both preview grids) rather than a bare loading line, since this
          screen's fetch is one combined `Promise.all` with no per-section
          streaming to show partial real content against. */}
      {profileState.state === 'loading' && (
        <>
          <ProfileHeaderSkeleton />
          <ProfilePeopleSkeleton showSeeAll />
          <ProfilePeopleSkeleton />
        </>
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

      {profileState.state === 'success' && (
        <>
          <ProfileHeader
            profile={profileState.profile}
            displayName={profileState.profile.username ?? user?.email}
            isOwnProfile
            trainerClientCount={profileState.people.length}
            avatarUploading={avatarUploading}
            onAvatarPress={() => setSheetVisible(true)}
            onSettingsPress={() => router.push('/profile/settings')}
            onProgramsPress={() => router.push('/programs')}
          />

          {profileState.friends.length > 0 && (
            <FriendsPreview
              friends={profileState.friends}
              totalCount={profileState.friends.length}
              onFriendPress={(friendId) => router.push(`/profile/${friendId}`)}
              onSeeAllPress={() => router.push('/profile/friends')}
            />
          )}

          {profileState.people.length > 0 && (
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
        </>
      )}

      {/* Mounted independent of `profileState` -- `user.id` (the auth
          store) resolves before the profile/friends/trainer `Promise.all`
          does, so gating this on `profileState.state === 'success'` meant
          the Wall didn't even start its own fetch (or show its own
          skeleton, see `UserWall`'s `WallCardSkeleton`) until the rest of
          the page had already finished loading — a second, sequential
          wait instead of the parallel one every other section above gets
          via its own skeleton. */}
      {user?.id && <UserWall userId={user.id} />}

      <AvatarActionSheet
        visible={sheetVisible}
        hasPhoto={hasRealAvatar(profile?.avatar_url)}
        error={avatarError}
        onView={() => {
          setSheetVisible(false);
          setViewerVisible(true);
        }}
        onChange={handleChangePhoto}
        onDelete={handleDeletePhoto}
        onClose={() => setSheetVisible(false)}
      />

      {profile?.avatar_url && (
        <FullscreenImage
          visible={viewerVisible}
          uri={profile.avatar_url}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
