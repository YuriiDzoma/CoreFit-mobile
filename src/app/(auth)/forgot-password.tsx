import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

function createForgotPasswordSchema(t: TFunction) {
  return z.object({
    email: z.email(t('auth.validation.email')),
  });
}

type ForgotPasswordValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

type SubmitStatus = { state: 'idle' } | { state: 'success' } | { state: 'error'; message: string };

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const forgotPasswordSchema = useMemo(() => createForgotPasswordSchema(t), [t]);
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
    <Workspace>
      <ThemedText type="title">{t('auth.forgotPassword.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('auth.forgotPassword.description')}
      </ThemedText>

      <ThemedView style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <AuthTextField
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.email?.message}
            />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          <ThemedText type="smallBold">
            {isSubmitting ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendButton')}
          </ThemedText>
        </Button>

        {submitStatus.state === 'success' && (
          <ThemedText type="small">{t('auth.forgotPassword.success')}</ThemedText>
        )}
        {submitStatus.state === 'error' && (
          <ThemedText type="small" style={styles.errorText}>
            ❌ {submitStatus.message}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.footer}>
        <Link href="/login">
          <ThemedText type="linkPrimary">{t('auth.backToSignIn')}</ThemedText>
        </Link>
      </ThemedView>
    </Workspace>
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
