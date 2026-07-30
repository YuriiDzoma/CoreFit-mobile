import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FriendsPreview } from '@/components/friends-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
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
  const clearance = useChromeClearance();

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
    <Workspace
      justify="flex-start"
      contentStyle={{
        paddingTop: clearance.top,
        paddingBottom: clearance.bottom + Spacing.four,
        gap: Spacing.four,
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
                Loading profile…
              </ThemedText>
            )}
            {profileState.state === 'error' && (
              <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
                <ThemedText type="small" themeColor="danger">
                  ❌ {profileState.message}
                </ThemedText>
                <Pressable onPress={handleRetry}>
                  <ThemedText type="linkPrimary">Retry</ThemedText>
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

            {/* `.programsLink`: bold, underlined, 16px, opacity:1 (not
                dimmed like the date above it). Web links to
                `/training/{id}`; mobile's equivalent destination is the
                Programs tab. */}
            <Pressable onPress={() => router.push('/programs')}>
              <ThemedText style={[styles.programsLink, { color: theme.text }]}>
                Programs
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {profileState.state === 'success' && (
          <Pressable
            style={styles.settingsIcon}
            onPress={() => router.push('/profile/settings')}
          >
            <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={24} tintColor={theme.text} />
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
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
