import { Link, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { LoginForm } from '@/components/login-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();

  return (
    <Workspace>
      <ThemedText type="title">{t('auth.login.title')}</ThemedText>

      {passwordReset === '1' && (
        <ThemedText type="small">{t('auth.login.passwordResetSuccess')}</ThemedText>
      )}

      <LoginForm
        onEmailNotConfirmed={(email) =>
          router.push({ pathname: '/confirm-email', params: { email } })
        }
      />

      <ThemedView style={styles.footer}>
        <Link href="/forgot-password">
          <ThemedText type="linkPrimary">{t('auth.login.forgotPassword')}</ThemedText>
        </Link>
      </ThemedView>

      <ThemedView style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.login.noAccount')}
        </ThemedText>
        <Link href="/register">
          <ThemedText type="linkPrimary">{t('auth.login.register')}</ThemedText>
        </Link>
      </ThemedView>
    </Workspace>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
