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
    // The prompt (`small`, 20px line) and the link (`linkPrimary`, 30px
    // line) differ in height -- centering keeps their text on one line
    // instead of the link sitting 5px low.
    alignItems: 'center',
    gap: Spacing.one,
  },
});
