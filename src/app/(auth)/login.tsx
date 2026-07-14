import { Link, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoginForm } from '@/components/login-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Sign in</ThemedText>

        {passwordReset === '1' && (
          <ThemedText type="small">✅ Password updated. Sign in with your new password.</ThemedText>
        )}

        <LoginForm
          onEmailNotConfirmed={(email) =>
            router.push({ pathname: '/confirm-email', params: { email } })
          }
        />

        <ThemedView style={styles.footer}>
          <Link href="/forgot-password">
            <ThemedText type="linkPrimary">Forgot password?</ThemedText>
          </Link>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            Don&apos;t have an account?
          </ThemedText>
          <Link href="/register">
            <ThemedText type="linkPrimary">Register</ThemedText>
          </Link>
        </ThemedView>
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
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
