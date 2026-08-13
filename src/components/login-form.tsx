import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t('auth.validation.email')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  });
}

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;

type SubmitStatus = { state: 'idle' } | { state: 'success' } | { state: 'error'; message: string };

// Distinct from SubmitStatus: this button isn't part of the react-hook-form
// form, so it has no equivalent to formState.isSubmitting and needs its own
// loading state.
type GoogleStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success' }
  | { state: 'error'; message: string };

interface LoginFormProps {
  /** Invoked instead of the inline error state when Supabase reports an unconfirmed email. */
  onEmailNotConfirmed?: (email: string) => void;
}

function isEmailNotConfirmedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'email_not_confirmed'
  );
}

export function LoginForm({ onEmailNotConfirmed }: LoginFormProps = {}) {
  const { t } = useTranslation();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ state: 'idle' });
  const loginSchema = useMemo(() => createLoginSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitStatus({ state: 'idle' });
    try {
      await authService.signInWithPassword(values.email, values.password);
      setSubmitStatus({ state: 'success' });
    } catch (error) {
      if (isEmailNotConfirmedError(error) && onEmailNotConfirmed) {
        onEmailNotConfirmed(values.email);
      } else {
        setSubmitStatus({ state: 'error', message: (error as Error).message });
      }
    }
  };

  const handleGooglePress = async () => {
    setGoogleStatus({ state: 'loading' });
    try {
      await authService.signInWithGoogle();
      setGoogleStatus({ state: 'success' });
    } catch (error) {
      setGoogleStatus({ state: 'error', message: (error as Error).message });
    }
  };

  return (
    <ThemedView style={styles.container}>
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
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <AuthTextField
            label={t('auth.passwordLabel')}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.password?.message}
          />
        )}
      />

      <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        <ThemedText type="smallBold">
          {isSubmitting ? t('auth.login.signingIn') : t('auth.login.title')}
        </ThemedText>
      </Button>

      {submitStatus.state === 'success' && (
        <ThemedText type="small">{t('auth.login.signedIn')}</ThemedText>
      )}
      {submitStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {submitStatus.message}
        </ThemedText>
      )}

      <Button onPress={handleGooglePress} disabled={googleStatus.state === 'loading'}>
        <View style={styles.googleButtonContent}>
          <Image
            source={require('@/assets/images/google-icon.svg')}
            style={styles.googleIcon}
            contentFit="contain"
          />
          <ThemedText type="smallBold">
            {googleStatus.state === 'loading'
              ? t('auth.login.signingIn')
              : t('auth.login.authWithGoogle')}
          </ThemedText>
        </View>
      </Button>

      {googleStatus.state === 'success' && (
        <ThemedText type="small">{t('auth.login.signedIn')}</ThemedText>
      )}
      {googleStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {t(`errors.${googleStatus.message}`, { defaultValue: googleStatus.message })}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  errorText: {
    color: '#e5484d',
  },
});
