import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import * as authService from '@/lib/supabase/auth';

// Same rule as web (lib/validations.tsx's firstNameOptions/lastNameOptions):
// required, at least 3 characters, letters only.
const nameSchema = z
  .string()
  .min(3, 'Must be at least 3 characters')
  .regex(/^[A-Za-z]+$/i, 'Must contain letters only');

const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: z.email('Enter a valid email address'),
    password: z.string().min(10, 'Password must be at least 10 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

type SubmitStatus = { state: 'idle' } | { state: 'success' } | { state: 'error'; message: string };

interface RegisterFormProps {
  /** Invoked instead of the inline success state when sign-up requires email confirmation. */
  onRequiresConfirmation?: (email: string) => void;
}

export function RegisterForm({ onRequiresConfirmation }: RegisterFormProps = {}) {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitStatus({ state: 'idle' });
    try {
      // Matches web's signInForm.tsx exactly.
      const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`;
      const { requiresEmailConfirmation } = await authService.signUpWithPassword(
        values.email,
        values.password,
        fullName,
      );
      if (requiresEmailConfirmation) {
        onRequiresConfirmation?.(values.email);
      } else {
        setSubmitStatus({ state: 'success' });
      }
    } catch (error) {
      setSubmitStatus({ state: 'error', message: (error as Error).message });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <AuthTextField
            label="First name"
            placeholder="Jane"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.firstName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <AuthTextField
            label="Last name"
            placeholder="Doe"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.lastName?.message}
          />
        )}
      />
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
            label="Confirm password"
            placeholder="Repeat your password"
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </ThemedText>
      </Pressable>

      {submitStatus.state === 'success' && <ThemedText type="small">✅ Account created</ThemedText>}
      {submitStatus.state === 'error' && (
        <ThemedText type="small" style={styles.errorText}>
          ❌ {submitStatus.message}
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
  pressed: {
    opacity: 0.7,
  },
  errorText: {
    color: '#e5484d',
  },
});
