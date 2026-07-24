import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FriendsPreview } from '@/components/friends-preview';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFriendshipsForUser, resolveFriendProfiles } from '@/lib/supabase/friends';
import { getAllProfiles, getProfileById, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type ProfileLoadState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile; friends: Profile[] }
  | { state: 'error'; message: string };

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const theme = useTheme();

  const [profileState, setProfileState] = useState<ProfileLoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never synchronously
  // at call time — so this is safe to invoke directly from the effect below.
  // Friends are fetched alongside the profile (independent data, same
  // combined-fetch shape profile/[id].tsx uses) rather than a second
  // effect/loading state of their own.
  const fetchProfile = useCallback((id: string) => {
    Promise.all([getProfileById(id), getFriendshipsForUser(id), getAllProfiles()])
      .then(([profile, friendships, profiles]) => {
        const profileById = new Map(profiles.map((p) => [p.id, p]));
        const friends = resolveFriendProfiles(friendships, id, profileById);
        setProfileState({ state: 'success', profile, friends });
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
    <ScreenLayout
      justify="flex-start"
      contentStyle={{
        paddingTop: Spacing.four,
        paddingBottom: BottomTabInset + Spacing.four,
        gap: Spacing.four,
      }}
    >
      <ThemedView style={styles.header}>
        <Avatar uri={profile?.avatar_url} name={profile?.username ?? user?.email} size={96} />

        {profileState.state === 'loading' && (
          <ThemedText type="small" themeColor="textSecondary">
            Loading profile…
          </ThemedText>
        )}
        {profileState.state === 'error' && (
          <ThemedView style={styles.errorBlock}>
            <ThemedText type="small" themeColor="danger">
              ❌ {profileState.message}
            </ThemedText>
            <Pressable onPress={handleRetry}>
              <ThemedText type="linkPrimary">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}
        {displayName && profileState.state !== 'loading' && (
          <ThemedText type="subtitle">{displayName}</ThemedText>
        )}

        {user?.email && (
          <ThemedText type="small" themeColor="textSecondary">
            {user.email}
          </ThemedText>
        )}
        {profile?.created_at && (
          <ThemedText type="small" themeColor="textSecondary">
            Joined{' '}
            {new Date(profile.created_at).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </ThemedText>
        )}
      </ThemedView>

      {profileState.state === 'success' && profileState.friends.length > 0 && (
        <FriendsPreview
          friends={profileState.friends}
          totalCount={profileState.friends.length}
          onFriendPress={(friendId) => router.push(`/profile/${friendId}`)}
          onSeeAllPress={() => router.push('/profile/friends')}
        />
      )}

      <Pressable onPress={() => router.push('/profile/friends')}>
        <ThemedText type="smallBold">Friends</ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/profile/requests')}>
        <ThemedText type="smallBold">Requests</ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/profile/users')}>
        <ThemedText type="smallBold">Users</ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/profile/settings')}>
        <ThemedText type="smallBold">Settings</ThemedText>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          { backgroundColor: theme.danger },
          pressed && styles.pressed,
        ]}
        onPress={() => signOut()}
      >
        <ThemedText type="smallBold">Sign out</ThemedText>
      </Pressable>
    </ScreenLayout>
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
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
