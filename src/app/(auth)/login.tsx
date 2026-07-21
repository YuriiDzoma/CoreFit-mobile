import { Link, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { LoginForm } from '@/components/login-form';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();

  return (
    <ScreenLayout>
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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
