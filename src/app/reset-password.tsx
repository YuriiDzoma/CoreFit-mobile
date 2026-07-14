import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

const resetPasswordSchema = z
  .object({
    password: z.string().min(10, 'Password must be at least 10 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type SubmitStatus = { state: 'idle' } | { state: 'error'; message: string };

export default function ResetPasswordScreen() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Set a new password</ThemedText>

        <ThemedView style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <AuthTextField
                label="New password"
                placeholder="At least 10 characters"
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
                label="Confirm new password"
                placeholder="Repeat your new password"
                secureTextEntry
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                errorMessage={errors.confirmPassword?.message}
              />
            )}
          />

          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <ThemedText type="smallBold">
              {isSubmitting ? 'Updating…' : 'Update password'}
            </ThemedText>
          </Pressable>

          {submitStatus.state === 'error' && (
            <ThemedText type="small" style={styles.errorText}>
              ❌ {submitStatus.message}
            </ThemedText>
          )}
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  form: {
    gap: Spacing.three,
  },
  submitButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  pressed: {
    opacity: 0.7,
  },
  errorText: {
    color: '#e5484d',
  },
});
