import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { resendConfirmationEmail } from '@/lib/supabase/auth';

type ResendStatus =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'error'; message: string };

export default function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  // Expo Router can hand back a param as string[] rather than string —
  // normalize once here rather than trusting the generic type assertion.
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const [resendStatus, setResendStatus] = useState<ResendStatus>({ state: 'idle' });

  const handleResend = async () => {
    if (!email) return;

    setResendStatus({ state: 'sending' });
    try {
      await resendConfirmationEmail(email);
      setResendStatus({ state: 'sent' });
    } catch (error) {
      setResendStatus({ state: 'error', message: (error as Error).message });
    }
  };

  return (
    <Workspace>
      <ThemedText type="title">{t('auth.confirmEmail.title')}</ThemedText>
      <ThemedText>
        {t('auth.confirmEmail.body', { email: email ?? t('auth.confirmEmail.yourEmail') })}
      </ThemedText>

      <Button onPress={handleResend} disabled={!email || resendStatus.state === 'sending'}>
        <ThemedText type="smallBold">
          {resendStatus.state === 'sending'
            ? t('auth.confirmEmail.sending')
            : t('auth.confirmEmail.resend')}
        </ThemedText>
      </Button>

      {resendStatus.state === 'sent' && (
        <ThemedText type="small">{t('auth.confirmEmail.sent')}</ThemedText>
      )}
      {resendStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {resendStatus.message}
        </ThemedText>
      )}

      <ThemedView style={styles.footer}>
        <Link href="/login">
          <ThemedText type="linkPrimary">{t('auth.backToSignIn')}</ThemedText>
        </Link>
      </ThemedView>
    </Workspace>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#e5484d',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
