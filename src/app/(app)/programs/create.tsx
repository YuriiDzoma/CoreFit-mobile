import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
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
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createProgram,
  formatProgramLevel,
  formatProgramType,
  getProgramDetail,
  updateProgramMetadata,
} from '@/lib/supabase/programs';
import { useAuthStore } from '@/stores/auth-store';
import { useProgramWizardStore } from '@/stores/program-wizard-store';

// Same rule as web: required, at least 3 characters, and not purely numeric.
const nameSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .regex(/^(?!\d+$)[\p{L}\d\s'-]+$/u, 'Name must include letters and may contain digits'),
});

type NameFormValues = z.infer<typeof nameSchema>;

type SubmitStatus =
  { state: 'idle' } | { state: 'submitting' } | { state: 'error'; message: string };

// Only relevant in edit mode (programId present) — create mode has nothing
// to fetch, so it goes straight to 'ready'. Kept separate from
// SubmitStatus: this gates whether step content can render at all, not
// whether a write is in flight.
type PrefillState = { state: 'ready' } | { state: 'loading' } | { state: 'error'; message: string };

const TYPE_OPTIONS = ['aerobic', 'anaerobic', 'crossfit'] as const;
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced', 'expert', 'professional'] as const;
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function handleAddExercisesPress(dayIndex: number) {
  router.push({ pathname: '/programs/exercise-picker', params: { dayIndex: String(dayIndex) } });
}

export default function CreateProgramScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ programId?: string | string[] }>();
  const programId = Array.isArray(params.programId) ? params.programId[0] : params.programId;
  const isEditMode = Boolean(programId);

  const [step, setStep] = useState(1);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });
  const [prefillState, setPrefillState] = useState<PrefillState>(
    isEditMode ? { state: 'loading' } : { state: 'ready' },
  );

  const user = useAuthStore((state) => state.user);

  const name = useProgramWizardStore((state) => state.name);
  const type = useProgramWizardStore((state) => state.type);
  const level = useProgramWizardStore((state) => state.level);
  const daysCount = useProgramWizardStore((state) => state.daysCount);
  // Selecting the whole array (not one hook call per day inside a .map())
  // keeps this a single hook call regardless of day count, and re-renders
  // whenever any day's exercises change — including immediately after
  // returning from the picker, since Confirm always produces a new array.
  const days = useProgramWizardStore((state) => state.days);
  const setName = useProgramWizardStore((state) => state.setName);
  const setType = useProgramWizardStore((state) => state.setType);
  const setLevel = useProgramWizardStore((state) => state.setLevel);
  const setDaysCount = useProgramWizardStore((state) => state.setDaysCount);
  const resetWizard = useProgramWizardStore((state) => state.reset);

  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name },
  });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect
  // below. `prefillState`'s initial value (computed once in useState above)
  // already covers the synchronous "start in loading" case for edit mode.
  const fetchProgramForEdit = (id: string) => {
    getProgramDetail(id)
      .then((program) => {
        setName(program.title);
        if (program.type) setType(program.type);
        if (program.level) setLevel(program.level);
        resetForm({ name: program.title });
        setPrefillState({ state: 'ready' });
      })
      .catch((error: unknown) => {
        setPrefillState({ state: 'error', message: (error as Error).message });
      });
  };

  // Fires once per genuine fresh entry into this screen — reset always
  // runs first and unconditionally, in both modes, before anything else.
  // This is what guarantees edit mode can never inherit a previous Create
  // session's `days`/`daysCount` (or vice versa): whichever mode ran last,
  // the next mount always starts from a fully blank store before any
  // prefill happens. Edit mode's prefill only ever calls setName/setType/
  // setLevel — days/daysCount are never touched, so they stay at reset()'s
  // defaults (`[]`/`null`) for the entire edit session.
  //
  // This screen stays mounted (not remounted) when the exercise-picker
  // screen is pushed on top of it and popped back, so none of this refires
  // mid-session — only on a genuine fresh navigation to this screen.
  useEffect(() => {
    resetWizard();
    if (programId) {
      fetchProgramForEdit(programId);
    }
    // Only re-run for a genuinely new mount/programId — fetchProgramForEdit
    // and resetForm are stable-enough closures here that including them
    // would just re-trigger on every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, resetWizard]);

  const onSubmitName = (values: NameFormValues) => {
    setName(values.name);
    setStep(2);
  };

  const isSubmitting = submitStatus.state === 'submitting';

  const handleCancel = () => {
    resetWizard();
    router.back();
  };

  const handleRetryPrefill = () => {
    if (!programId) return;
    setPrefillState({ state: 'loading' });
    fetchProgramForEdit(programId);
  };

  // Type/level are guaranteed non-null here — steps 2/3 can't be passed
  // without picking one — this narrows them for createProgram's stricter
  // input type rather than re-validating something the wizard already
  // enforces. Same for daysCount/user.id: the button is disabled without
  // a daysCount, and this screen only renders inside the authenticated
  // app group, so a missing user is not a reachable case in practice.
  const handleCreatePress = () => {
    if (!daysCount || !type || !level || !user?.id) return;

    setSubmitStatus({ state: 'submitting' });
    createProgram({ userId: user.id, title: name, type, level, days })
      .then((newProgramId) => {
        resetWizard();
        router.replace(`/programs/${newProgramId}`);
      })
      .catch((error: unknown) => {
        setSubmitStatus({ state: 'error', message: (error as Error).message });
      });
  };

  // Metadata-only — title/type/level, never program_days/program_exercises.
  // Structural editing (days/exercises) isn't part of this sprint's scope.
  const handleSaveMetadataPress = () => {
    if (!type || !level || !user?.id || !programId) return;

    setSubmitStatus({ state: 'submitting' });
    updateProgramMetadata(programId, user.id, { title: name, type, level })
      .then(() => {
        resetWizard();
        router.replace(`/programs/${programId}`);
      })
      .catch((error: unknown) => {
        setSubmitStatus({ state: 'error', message: (error as Error).message });
      });
  };

  const handleStep3Press = () => {
    if (!level) return;
    if (isEditMode) {
      handleSaveMetadataPress();
    } else {
      setStep(4);
    }
  };

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset + Spacing.four }}
    >
      <ScreenHeader onBackPress={handleCancel} backLabel="Cancel" />

      <ThemedText type="title">{isEditMode ? 'Edit program' : 'Create program'}</ThemedText>

      {prefillState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading program…
        </ThemedText>
      )}

      {prefillState.state === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {prefillState.message}
          </ThemedText>
          <Pressable onPress={handleRetryPrefill}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {prefillState.state === 'ready' && step === 1 && (
        <ThemedView style={styles.stepContent}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <AuthTextField
                label="Program name"
                placeholder="e.g. Push Pull Legs"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                errorMessage={errors.name?.message}
              />
            )}
          />

          <Button onPress={handleSubmit(onSubmitName)}>
            <ThemedText type="smallBold">Next</ThemedText>
          </Button>
        </ThemedView>
      )}

      {prefillState.state === 'ready' && step === 2 && (
        <ThemedView style={styles.stepContent}>
          <ThemedText type="small" themeColor="textSecondary">
            Type
          </ThemedText>
          <View style={styles.optionRow}>
            {TYPE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor:
                      type === option ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}
                onPress={() => setType(option)}
              >
                <ThemedText type="small">{formatProgramType(option)}</ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedView style={styles.stepNav}>
            <Pressable onPress={() => setStep(1)}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
            <Button style={styles.navButton} onPress={() => type && setStep(3)} disabled={!type}>
              <ThemedText type="smallBold">Next</ThemedText>
            </Button>
          </ThemedView>
        </ThemedView>
      )}

      {prefillState.state === 'ready' && step === 3 && (
        <ThemedView style={styles.stepContent}>
          <ThemedText type="small" themeColor="textSecondary">
            Difficulty
          </ThemedText>
          <View style={styles.optionRow}>
            {LEVEL_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor:
                      level === option ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}
                onPress={() => setLevel(option)}
              >
                <ThemedText type="small">{formatProgramLevel(option)}</ThemedText>
              </Pressable>
            ))}
          </View>

          {isEditMode && submitStatus.state === 'error' && (
            <ThemedView style={styles.errorBlock}>
              <ThemedText type="small" themeColor="danger">
                ❌ {submitStatus.message}
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.stepNav}>
            <Pressable onPress={() => setStep(2)} disabled={isEditMode && isSubmitting}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
            <Button
              style={styles.navButton}
              onPress={handleStep3Press}
              disabled={!level || (isEditMode && isSubmitting)}
            >
              <ThemedText type="smallBold">
                {isEditMode ? (isSubmitting ? 'Saving…' : 'Save changes') : 'Next'}
              </ThemedText>
            </Button>
          </ThemedView>
        </ThemedView>
      )}

      {prefillState.state === 'ready' && !isEditMode && step === 4 && (
        <ThemedView style={styles.stepContent}>
          <ThemedText type="small" themeColor="textSecondary">
            Number of days
          </ThemedText>
          <View style={styles.optionRow}>
            {DAYS_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor:
                      daysCount === option ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}
                onPress={() => setDaysCount(option)}
              >
                <ThemedText type="small">{option}</ThemedText>
              </Pressable>
            ))}
          </View>

          {daysCount !== null && (
            <ThemedView style={styles.dayList}>
              {Array.from({ length: daysCount }, (_, dayIndex) => {
                const exerciseCount = days[dayIndex]?.length ?? 0;
                return (
                  <ThemedView key={dayIndex} type="backgroundElement" style={styles.dayCard}>
                    <ThemedView style={styles.dayCardText}>
                      <ThemedText>Day {dayIndex + 1}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {exerciseCount === 0
                          ? 'No exercises yet'
                          : `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} selected`}
                      </ThemedText>
                    </ThemedView>
                    <Pressable onPress={() => handleAddExercisesPress(dayIndex)}>
                      <ThemedText type="linkPrimary">
                        {exerciseCount === 0 ? 'Add exercises' : 'Edit exercises'}
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}

          {submitStatus.state === 'error' && (
            <ThemedView style={styles.errorBlock}>
              <ThemedText type="small" themeColor="danger">
                ❌ {submitStatus.message}
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.stepNav}>
            <Pressable onPress={() => setStep(3)} disabled={isSubmitting}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
            <Button
              style={styles.navButton}
              onPress={handleCreatePress}
              disabled={!daysCount || isSubmitting}
            >
              <ThemedText type="smallBold">
                {isSubmitting ? 'Creating…' : 'Create program'}
              </ThemedText>
            </Button>
          </ThemedView>
        </ThemedView>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: Spacing.three,
  },
  stepNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dayList: {
    gap: Spacing.two,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  dayCardText: {
    gap: Spacing.half,
  },
  navButton: {
    paddingHorizontal: Spacing.four,
  },
});
