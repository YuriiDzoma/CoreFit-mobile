import Constants from 'expo-constants';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';

function shortenId(id: string) {
  return `${id.slice(0, 8)}…`;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText>{value}</ThemedText>
    </ThemedView>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const provider = user?.app_metadata?.provider ?? 'unknown';
  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Profile</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ProfileRow label="Email" value={user?.email ?? '—'} />
          <ProfileRow label="Provider" value={provider} />
          <ProfileRow label="User ID" value={user ? shortenId(user.id) : '—'} />
          <ProfileRow label="App version" value={appVersion} />
        </ThemedView>

        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
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
    gap: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.half,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#e5484d',
  },
  pressed: {
    opacity: 0.7,
  },
});
