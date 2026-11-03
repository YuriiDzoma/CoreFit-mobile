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
import { useTheme } from '@/hooks/use-theme';
import { type SupportedLanguage, setLanguagePreference } from '@/lib/i18n';
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

// Web's own order (LanguagesBox): English, Russian, Ukrainian, Polish.
const LANGUAGE_ORDER: SupportedLanguage[] = ['en', 'ru', 'uk', 'pl'];

/**
 * Web's radio row (`.languages__btn`): a 16px label, 16px gap, then a
 * 16px white dot -- filled with a 12px navy dot when on.
 * Shared by the trainer toggle and the language list, same as web.
 */
function RadioRow({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <ThemedText style={styles.radioLabel}>{label}</ThemedText>
      <View style={styles.radioDot}>
        {selected && <View style={[styles.radioDotInner, { backgroundColor: theme.border }]} />}
      </View>
    </Pressable>
  );
}

/** Web's bordered settings block with its centered title. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.section, { borderColor: theme.border }]}>
      <ThemedText style={[styles.sectionTitle, { color: theme.title }]}>{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

// The policy itself is a web page (`app/privacy` in the CoreFit web repo),
// not a native screen -- opening it in the device browser is the standard
// pattern for this, rather than duplicating the legal text natively.
const PRIVACY_POLICY_URL = 'https://core-fit-ua.vercel.app/privacy';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const clearance = useChromeClearance();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const setThemePreference = useAuthStore((state) => state.setThemePreference);

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  // Sprint 47 gave `is_trainer` a second, user-facing meaning (self-
  // declare as a trainer to receive "be my trainer" requests) — was
  // previously backend/admin-managed only. Local state here, not a
  // shared store: `dark` genuinely needs to be global (every screen reads
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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

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

  // Instant-apply -- no separate Save step, unlike the name form above.
  // (The theme toggle lives in the Header menu, as on web.)
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

  // Instant-apply, same shape as handleTrainerToggle —
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
  const isTogglingTrainer = trainerToggleStatus.state === 'submitting';
  const isDeletingAccount = deleteAccountState.state === 'deleting';

  return (
    <>
    <Workspace
      scroll
      justify="flex-start"
      bottomClearance={clearance.bottom}
      // Web's title sits right at the 80px header clearance, and "Sign out"
      // ends 12px above the nav -- no extra inset at either end.
      contentStyle={{
        paddingTop: 0,
        paddingBottom: 0,
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
          <Section title={t('profile.settings.profileSection')}>
            <Controller
              control={control}
              name="firstName"
              render={({ field }) => (
                <AuthTextField
                  label={t('profile.settings.firstNameLabel')}
                  placeholder={t('profile.settings.firstNamePlaceholder')}
                  labelStyle={[styles.fieldLabel, { color: theme.text }]}
                  style={styles.fieldInput}
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
                  label={t('profile.settings.lastNameLabel')}
                  placeholder={t('profile.settings.lastNamePlaceholder')}
                  labelStyle={[styles.fieldLabel, { color: theme.text }]}
                  style={styles.fieldInput}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={errors.lastName?.message}
                />
              )}
            />

            {/* Web's `.submit`: full width, white fill, 40px. */}
            <Button
              variant="filled"
              onPress={handleSubmit(onSubmit)}
              disabled={!isDirty || isSubmitting}
            >
              <ThemedText style={styles.buttonText}>
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
          </Section>

          <Section title={t('profile.settings.trainerSection')}>
            <RadioRow
              label={t('profile.settings.trainerToggle')}
              selected={isTrainer}
              disabled={isTogglingTrainer}
              onPress={handleTrainerToggle}
            />
            <ThemedText style={styles.hint}>{t('profile.settings.trainerHint')}</ThemedText>
            {trainerToggleStatus.state === 'error' && (
              <ThemedText type="small" themeColor="danger">
                ❌ {trainerToggleStatus.message}
              </ThemedText>
            )}
          </Section>

          <Section title={t('profile.settings.locationSection')}>
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
          </Section>

          <Section title={t('profile.settings.language.label')}>
            {LANGUAGE_ORDER.map((code) => (
              <RadioRow
                key={code}
                label={t(`profile.settings.language.${code}`)}
                selected={code === i18n.language}
                onPress={() => setLanguagePreference(code, user?.id)}
              />
            ))}
          </Section>

          <Pressable
            style={({ pressed }) => [styles.privacyLink, pressed && styles.pressed]}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <ThemedText style={styles.privacyText}>{t('profile.settings.privacyPolicy')}</ThemedText>
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
            <ThemedText style={styles.buttonTextLarge} themeColor="danger">
              {t('profile.settings.deleteAccount.button')}
            </ThemedText>
          </Pressable>
          {deleteAccountState.state === 'error' && (
            <ThemedText type="small" themeColor="danger">
              ❌ {deleteAccountState.message}
            </ThemedText>
          )}

          {/* Outlined like every ordinary button: signing out is
              reversible, so only Delete account above stays red. Asks
              first, like Delete account does. */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
            onPress={() => setConfirmingSignOut(true)}
          >
            <ThemedText style={styles.buttonTextLarge}>{t('components.header.signOut')}</ThemedText>
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

    <ConfirmDialog
      visible={confirmingSignOut}
      title={t('components.header.signOutConfirmTitle')}
      message={t('components.header.signOutConfirmMessage')}
      confirmLabel={t('components.header.signOut')}
      onConfirm={() => {
        setConfirmingSignOut(false);
        signOut();
      }}
      onCancel={() => setConfirmingSignOut(false)}
    />
    </>
  );
}

// Measured live from web's settings page at 390px (settings.module.scss,
// InputBox, base.scss `.submit`).
const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
    textAlign: 'center',
  },
  // InputBox label: 14px on a 21px line, 8px in from the left.
  fieldLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: 400,
    paddingLeft: Spacing.two,
  },
  fieldInput: {
    height: 40,
    minHeight: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 400,
  },
  buttonTextLarge: {
    fontSize: 16,
    fontWeight: 400,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    alignSelf: 'flex-start',
  },
  radioLabel: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: 400,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hint: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 400,
    opacity: 0.7,
  },
  privacyLink: {
    alignSelf: 'center',
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 400,
    textDecorationLine: 'underline',
  },
  // Web's `.deleteAccount`/`.signOut`: 40px, 2px border, 4px radius.
  deleteAccountButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.one,
    borderWidth: 2,
  },
  signOutButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.one,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
