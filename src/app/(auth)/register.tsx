import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { RegisterForm } from '@/components/register-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <ThemedText type="title">{t('auth.register.title')}</ThemedText>

      <RegisterForm
        onRequiresConfirmation={(email) =>
          router.push({ pathname: '/confirm-email', params: { email } })
        }
      />

      <ThemedView style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.register.alreadyHaveAccount')}
        </ThemedText>
        <Link href="/login">
          <ThemedText type="linkPrimary">{t('auth.login.title')}</ThemedText>
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
