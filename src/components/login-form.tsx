import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ state: 'idle' });
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
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <AuthTextField
            label="Password"
            placeholder="Your password"
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.password?.message}
          />
        )}
      />

      <Pressable
        style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        <ThemedText type="smallBold">{isSubmitting ? 'Signing in…' : 'Sign in'}</ThemedText>
      </Pressable>

      {submitStatus.state === 'success' && <ThemedText type="small">✅ Signed in</ThemedText>}
      {submitStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {submitStatus.message}
        </ThemedText>
      )}

      <Pressable
        style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
        onPress={handleGooglePress}
        disabled={googleStatus.state === 'loading'}
      >
        <View style={styles.googleButtonContent}>
          <Image
            source={require('@/assets/images/google-icon.svg')}
            style={styles.googleIcon}
            contentFit="contain"
          />
          <ThemedText type="smallBold">
            {googleStatus.state === 'loading' ? 'Signing in…' : 'Auth with Google'}
          </ThemedText>
        </View>
      </Pressable>

      {googleStatus.state === 'success' && <ThemedText type="small">✅ Signed in</ThemedText>}
      {googleStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {googleStatus.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  submitButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
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
  pressed: {
    opacity: 0.7,
  },
  errorText: {
    color: '#e5484d',
  },
});
