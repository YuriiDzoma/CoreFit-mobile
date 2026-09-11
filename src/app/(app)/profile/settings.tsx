import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { Button } from '@/components/button';
import { CitySelect } from '@/components/city-select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES, setLanguagePreference } from '@/lib/i18n';
import { createNameSchema } from '@/lib/validation';
import { deleteOwnAccount } from '@/lib/supabase/account';
import { getProfileById, updateProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type SettingsFormValues = { firstName: string; lastName: string };

type LoadState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

type SubmitStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success' }
  | { state: 'error'; message: string };

type ThemeToggleStatus =
  { state: 'idle' } | { state: 'submitting' } | { state: 'error'; message: string };

type TrainerToggleStatus =
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

// The policy itself is a web page (`app/privacy` in the CoreFit web repo),
// not a native screen -- opening it in the device browser is the standard
// pattern for this, rather than duplicating the legal text natively.
const PRIVACY_POLICY_URL = 'https://core-fit-ua.vercel.app/privacy';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const clearance = useChromeClearance();
  const osScheme = useColorScheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const themePreference = useAuthStore((state) => state.themePreference);
  const setThemePreference = useAuthStore((state) => state.setThemePreference);
  const effectiveScheme = resolveEffectiveScheme(osScheme, themePreference);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const [themeToggleStatus, setThemeToggleStatus] = useState<ThemeToggleStatus>({ state: 'idle' });
  // Sprint 47 gave `is_trainer` a second, user-facing meaning (self-
  // declare as a trainer to receive "be my trainer" requests) — was
  // previously backend/admin-managed only. Local state here, not a
  // shared store, matching this screen's own `themePreference`-vs-local
  // split: `dark` genuinely needs to be global (every screen reads
  // `useTheme()`), but nothing outside this screen reads `is_trainer`
  // synchronously today.
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerToggleStatus, setTrainerToggleStatus] = useState<TrainerToggleStatus>({
    state: 'idle',
  });
  const [location, setLocation] = useState<{ city: string | null; country: string | null }>({
    city: null,
    country: null,
  });
  const [locationSaveStatus, setLocationSaveStatus] = useState<
    { state: 'idle' } | { state: 'error'; message: string }
  >({ state: 'idle' });
  const [deleteAccountState, setDeleteAccountState] = useState<
    | { state: 'idle' }
    | { state: 'confirming' }
    | { state: 'deleting' }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  const settingsFormSchema = useMemo(() => {
    const nameSchema = createNameSchema(t);
    return z.object({ firstName: nameSchema, lastName: nameSchema });
  }, [t]);

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
        setIsTrainer(profile.is_trainer ?? false);
        setLocation({ city: profile.city, country: profile.country });
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

  // Instant-apply, same shape as handleThemeSelect above.
  const handleTrainerToggle = () => {
    if (!user?.id) return;
    const next = !isTrainer;
    setTrainerToggleStatus({ state: 'submitting' });
    updateProfileById(user.id, { is_trainer: next })
      .then(() => {
        setIsTrainer(next);
        setTrainerToggleStatus({ state: 'idle' });
      })
      .catch((error: unknown) => {
        setTrainerToggleStatus({ state: 'error', message: (error as Error).message });
      });
  };

  // Instant-apply, same shape as handleThemeSelect/handleTrainerToggle —
  // `CitySelect` already resolved the label to whichever of the 4 app
  // languages is currently active (native Ukrainian/Russian name where
  // available, canonical English otherwise), so this is just the
  // persistence step.
  const handleCitySelect = (city: { name: string; country: string }) => {
    if (!user?.id) return;
    setLocation({ city: city.name, country: city.country });
    updateProfileById(user.id, { city: city.name, country: city.country })
      .then(() => setLocationSaveStatus({ state: 'idle' }))
      .catch((error: unknown) => {
        setLocationSaveStatus({ state: 'error', message: (error as Error).message });
      });
  };

  // Opens the themed ConfirmDialog rather than Alert.alert/window.confirm
  // (see confirm-dialog.tsx) — the actual deletion happens in
  // handleConfirmDeleteAccount below, once the user confirms in that
  // dialog. No manual navigation on success: signOut() clears the
  // session, and the root layout's session-gated routing already
  // redirects automatically, same as the existing plain Sign Out button.
  const handleDeleteAccountPress = () => setDeleteAccountState({ state: 'confirming' });

  const handleConfirmDeleteAccount = () => {
    setDeleteAccountState({ state: 'deleting' });
    deleteOwnAccount()
      .then(() => signOut())
      .catch((error: unknown) => {
        setDeleteAccountState({ state: 'error', message: (error as Error).message });
      });
  };

  const isSubmitting = submitStatus.state === 'submitting';
  const isTogglingTheme = themeToggleStatus.state === 'submitting';
  const isTogglingTrainer = trainerToggleStatus.state === 'submitting';
  const isDeletingAccount = deleteAccountState.state === 'deleting';

  return (
    <>
    <Workspace
      scroll
      justify="flex-start"
      bottomClearance={clearance.bottom}
      contentStyle={{
        paddingBottom: Spacing.four,
        gap: Spacing.three,
      }}
    >
      <ThemedText type="pageTitle">{t('components.header.settings')}</ThemedText>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('profile.settings.loading')}
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
            <ThemedText type="smallBold">{t('profile.settings.profileSection')}</ThemedText>

            <Controller
              control={control}
              name="firstName"
              render={({ field }) => (
                <AuthTextField
                  label={t('auth.register.firstNameLabel')}
                  placeholder={t('auth.register.firstNamePlaceholder')}
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
                  label={t('auth.register.lastNameLabel')}
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={errors.lastName?.message}
                />
              )}
            />

            <Button onPress={handleSubmit(onSubmit)} disabled={!isDirty || isSubmitting}>
              <ThemedText type="smallBold">
                {isSubmitting ? t('profile.settings.saving') : t('common.save')}
              </ThemedText>
            </Button>

            {submitStatus.state === 'success' && (
              <ThemedText type="small">{t('profile.settings.saved')}</ThemedText>
            )}
            {submitStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {submitStatus.message}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('profile.settings.themeSection')}</ThemedText>
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
                        borderColor: isSelected ? theme.border : 'transparent',
                      },
                    ]}
                    disabled={isTogglingTheme}
                    onPress={() => handleThemeSelect(option === 'dark')}
                  >
                    <ThemedText
                      type={isSelected ? 'smallBold' : 'small'}
                      themeColor={isSelected ? 'text' : 'textSecondary'}
                    >
                      {option === 'dark' ? t('profile.settings.dark') : t('profile.settings.light')}
                    </ThemedText>
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

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('profile.settings.trainerSection')}</ThemedText>
            <View style={styles.optionRow}>
              <Pressable
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: isTrainer ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: isTrainer ? theme.border : 'transparent',
                  },
                ]}
                disabled={isTogglingTrainer}
                onPress={handleTrainerToggle}
              >
                <ThemedText
                  type={isTrainer ? 'smallBold' : 'small'}
                  themeColor={isTrainer ? 'text' : 'textSecondary'}
                >
                  {t('profile.settings.trainerToggle')}
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {t('profile.settings.trainerHint')}
            </ThemedText>
            {trainerToggleStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {trainerToggleStatus.message}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('profile.settings.locationSection')}</ThemedText>
            <CitySelect
              city={location.city}
              country={location.country}
              onSelect={handleCitySelect}
            />
            {locationSaveStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {locationSaveStatus.message}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('profile.settings.language.label')}</ThemedText>
            <View style={styles.optionRow}>
              {SUPPORTED_LANGUAGES.map((code) => {
                const isSelected = code === i18n.language;
                return (
                  <Pressable
                    key={code}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: isSelected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                        borderColor: isSelected ? theme.border : 'transparent',
                      },
                    ]}
                    onPress={() => setLanguagePreference(code, user?.id)}
                  >
                    <ThemedText
                      type={isSelected ? 'smallBold' : 'small'}
                      themeColor={isSelected ? 'text' : 'textSecondary'}
                    >
                      {t(`profile.settings.language.${code}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <Pressable
            style={({ pressed }) => [styles.privacyLink, pressed && styles.pressed]}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <ThemedText type="linkPrimary">{t('profile.settings.privacyPolicy')}</ThemedText>
          </Pressable>

          {/* Deliberately less prominent than the filled Sign Out button
              below it — an outlined text link, not a filled button — this
              is the rare, irreversible action, Sign Out is the common,
              reversible one. Requires the ConfirmDialog below rather than
              acting instantly like Sign Out does. */}
          <Pressable
            style={({ pressed }) => [
              styles.deleteAccountButton,
              { borderColor: theme.danger },
              pressed && styles.pressed,
            ]}
            onPress={handleDeleteAccountPress}
          >
            <ThemedText type="smallBold" themeColor="danger">
              {t('profile.settings.deleteAccount.button')}
            </ThemedText>
          </Pressable>
          {deleteAccountState.state === 'error' && (
            <ThemedText type="small" themeColor="danger">
              ❌ {deleteAccountState.message}
            </ThemedText>
          )}

          {/* Same button this app already has on Profile
              (`profile/index.tsx`) — same styling, same no-confirmation
              instant sign-out, at the very end of the screen per its own
              precedent there too. */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: theme.danger },
              pressed && styles.pressed,
            ]}
            onPress={() => signOut()}
          >
            <ThemedText type="smallBold">{t('components.header.signOut')}</ThemedText>
          </Pressable>
        </>
      )}
    </Workspace>

    <ConfirmDialog
      visible={deleteAccountState.state === 'confirming' || deleteAccountState.state === 'deleting'}
      title={t('profile.settings.deleteAccount.confirmTitle')}
      message={t('profile.settings.deleteAccount.confirmMessage')}
      confirmLabel={t('common.delete')}
      onConfirm={handleConfirmDeleteAccount}
      onCancel={() => setDeleteAccountState({ state: 'idle' })}
      confirming={isDeletingAccount}
    />
    </>
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
    borderWidth: 1.5,
  },
  privacyLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteAccountButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
