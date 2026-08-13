import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
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

function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      password: z.string().min(10, t('auth.passwordValidation.minLength')),
      confirmPassword: z.string().min(1, t('auth.passwordValidation.confirmRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.passwordValidation.mismatch'),
      path: ['confirmPassword'],
    });
}

type ResetPasswordValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;

type SubmitStatus = { state: 'idle' } | { state: 'error'; message: string };

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const resetPasswordSchema = useMemo(() => createResetPasswordSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setSubmitStatus({ state: 'idle' });
    try {
      await authService.updatePassword(values.password);
      // The recovery session is single-purpose: end it and send the user
      // back to sign in explicitly with their new password, rather than
      // dropping them straight into the app on a leftover recovery session.
      await authService.signOut();
      router.replace({ pathname: '/login', params: { passwordReset: '1' } });
    } catch (error) {
      setSubmitStatus({ state: 'error', message: (error as Error).message });
    }
  };

  return (
    <Workspace>
      <ThemedText type="title">{t('auth.resetPassword.title')}</ThemedText>

      <ThemedView style={styles.form}>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <AuthTextField
              label={t('auth.resetPassword.newPasswordLabel')}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <AuthTextField
              label={t('auth.resetPassword.confirmPasswordLabel')}
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.confirmPassword?.message}
            />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          <ThemedText type="smallBold">
            {isSubmitting ? t('auth.resetPassword.updating') : t('auth.resetPassword.updateButton')}
          </ThemedText>
        </Button>

        {submitStatus.state === 'error' && (
          <ThemedText type="small" style={styles.errorText}>
            ❌ {submitStatus.message}
          </ThemedText>
        )}
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
});
