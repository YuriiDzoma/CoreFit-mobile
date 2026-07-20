import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { resendConfirmationEmail } from '@/lib/supabase/auth';

type ResendStatus =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent' }
  | { state: 'error'; message: string };

export default function ConfirmEmailScreen() {
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
    <ScreenLayout>
      <ThemedText type="title">Confirm your email</ThemedText>
      <ThemedText>
        We sent a confirmation link to{email ? ` ${email}` : ' your email'}. Open it on this device
        to activate your account.
      </ThemedText>

      <Button onPress={handleResend} disabled={!email || resendStatus.state === 'sending'}>
        <ThemedText type="smallBold">
          {resendStatus.state === 'sending' ? 'Sending…' : 'Resend email'}
        </ThemedText>
      </Button>

      {resendStatus.state === 'sent' && <ThemedText type="small">✅ Email sent</ThemedText>}
      {resendStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {resendStatus.message}
        </ThemedText>
      )}

      <ThemedView style={styles.footer}>
        <Link href="/login">
          <ThemedText type="linkPrimary">Back to sign in</ThemedText>
        </Link>
      </ThemedView>
    </ScreenLayout>
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
