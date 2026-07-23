import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenLayout } from '@/components/screen-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { nameSchema } from '@/lib/validation';
import { getProfileById, updateProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

const settingsFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

type LoadState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

type SubmitStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success' }
  | { state: 'error'; message: string };

type ThemeToggleStatus =
  { state: 'idle' } | { state: 'submitting' } | { state: 'error'; message: string };

// Splits a combined display name into first/last. Unlike web's own
// `profile.username?.split(' ')` destructured into exactly two elements
// (which silently drops any word beyond the second — a confirmed bug, not
// a design choice), this keeps every trailing word in `lastName`, so a
// three-plus-word name round-trips without losing data.
function splitName(fullName: string | null): { firstName: string; lastName: string } {
  const words = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  return { firstName: words[0] ?? '', lastName: words.slice(1).join(' ') };
}

const THEME_OPTIONS = ['light', 'dark'] as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const osScheme = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const themePreference = useAuthStore((state) => state.themePreference);
  const setThemePreference = useAuthStore((state) => state.setThemePreference);
  const effectiveScheme = resolveEffectiveScheme(osScheme, themePreference);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const [themeToggleStatus, setThemeToggleStatus] = useState<ThemeToggleStatus>({ state: 'idle' });

  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: { firstName: '', lastName: '' },
  });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  // Also the natural resync point for `themePreference` if auth-store.ts's
  // own background fetch (Sprint 33) failed or hasn't resolved yet — cheap,
  // no dedicated retry mechanism needed for that.
  useEffect(() => {
    if (!user?.id) return;
    getProfileById(user.id)
      .then((profile) => {
        resetForm(splitName(profile.username));
        if (profile.dark !== null) setThemePreference(profile.dark);
        setLoadState({ state: 'ready' });
      })
      .catch((error: unknown) => {
        setLoadState({ state: 'error', message: (error as Error).message });
      });
  }, [user?.id, resetForm, setThemePreference]);

  const onSubmit = (values: SettingsFormValues) => {
    if (!user?.id) return;
    setSubmitStatus({ state: 'submitting' });
    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`;
    updateProfileById(user.id, { username: fullName })
      .then(() => {
        // Re-seed so `isDirty`/Save-disabled reflects the just-saved state.
        resetForm(values);
        setSubmitStatus({ state: 'success' });
      })
      .catch((error: unknown) => {
        setSubmitStatus({ state: 'error', message: (error as Error).message });
      });
  };

  // Instant-apply, matching web's own theme toggle exactly — no separate
  // Save step, unlike the name form above.
  const handleThemeSelect = (dark: boolean) => {
    if (!user?.id || dark === themePreference) return;
    setThemeToggleStatus({ state: 'submitting' });
    updateProfileById(user.id, { dark })
      .then(() => {
        setThemePreference(dark);
        setThemeToggleStatus({ state: 'idle' });
      })
      .catch((error: unknown) => {
        setThemeToggleStatus({ state: 'error', message: (error as Error).message });
      });
  };

  const isSubmitting = submitStatus.state === 'submitting';
  const isTogglingTheme = themeToggleStatus.state === 'submitting';

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, gap: Spacing.six }}
    >
      <ScreenHeader backHref="/profile" backLabel="← Back" />

      <ThemedText type="title">Settings</ThemedText>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading settings…
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedText type="small" themeColor="danger">
          ❌ {loadState.message}
        </ThemedText>
      )}

      {loadState.state === 'ready' && (
        <>
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Profile</ThemedText>

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

            <Button onPress={handleSubmit(onSubmit)} disabled={!isDirty || isSubmitting}>
              <ThemedText type="smallBold">{isSubmitting ? 'Saving…' : 'Save'}</ThemedText>
            </Button>

            {submitStatus.state === 'success' && <ThemedText type="small">✅ Saved</ThemedText>}
            {submitStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {submitStatus.message}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Theme</ThemedText>
            <View style={styles.optionRow}>
              {THEME_OPTIONS.map((option) => {
                const isSelected = option === effectiveScheme;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: isSelected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                      },
                    ]}
                    disabled={isTogglingTheme}
                    onPress={() => handleThemeSelect(option === 'dark')}
                  >
                    <ThemedText type="small">{option === 'dark' ? 'Dark' : 'Light'}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {themeToggleStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {themeToggleStatus.message}
              </ThemedText>
            )}
          </ThemedView>
        </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
});
