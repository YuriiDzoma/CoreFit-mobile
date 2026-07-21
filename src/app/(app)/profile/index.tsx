import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getProfileById, type Profile } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type ProfileLoadState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile }
  | { state: 'error'; message: string };

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const theme = useTheme();

  const [profileState, setProfileState] = useState<ProfileLoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never synchronously
  // at call time — so this is safe to invoke directly from the effect below.
  const fetchProfile = useCallback((id: string) => {
    getProfileById(id)
      .then((profile) => setProfileState({ state: 'success', profile }))
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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
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
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.six,
  },
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
