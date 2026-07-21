import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { Button } from '@/components/button';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

type SubmitStatus = { state: 'idle' } | { state: 'success' } | { state: 'error'; message: string };

export default function ForgotPasswordScreen() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setSubmitStatus({ state: 'idle' });
    try {
      await authService.requestPasswordReset(values.email);
      setSubmitStatus({ state: 'success' });
    } catch (error) {
      setSubmitStatus({ state: 'error', message: (error as Error).message });
    }
  };

  return (
    <ScreenLayout>
      <ThemedText type="title">Reset password</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Enter your email and we&apos;ll send you a link to reset your password.
      </ThemedText>

      <ThemedView style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AuthTextField
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.email?.message}
            />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          <ThemedText type="smallBold">{isSubmitting ? 'Sending…' : 'Send reset link'}</ThemedText>
        </Button>

        {submitStatus.state === 'success' && (
          <ThemedText type="small">
            ✅ If an account exists for that email, we&apos;ve sent a password reset link.
          </ThemedText>
        )}
        {submitStatus.state === 'error' && (
          <ThemedText type="small" style={styles.errorText}>
            ❌ {submitStatus.message}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.footer}>
        <Link href="/login">
          <ThemedText type="linkPrimary">Back to sign in</ThemedText>
        </Link>
      </ThemedView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  errorText: {
    color: '#e5484d',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
