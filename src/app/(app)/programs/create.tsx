import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
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
import { createProgram, formatProgramLevel, formatProgramType } from '@/lib/supabase/programs';
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

const TYPE_OPTIONS = ['aerobic', 'anaerobic', 'crossfit'] as const;
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced', 'expert', 'professional'] as const;
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function handleAddExercisesPress(dayIndex: number) {
  router.push({ pathname: '/programs/exercise-picker', params: { dayIndex: String(dayIndex) } });
}

export default function CreateProgramScreen() {
  const theme = useTheme();
  const [step, setStep] = useState(1);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ state: 'idle' });

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

  // Fires once per genuine fresh entry into the wizard — this screen stays
  // mounted (not remounted) when a future exercise-picker screen is pushed
  // on top of it and popped back, so this won't clear an in-progress draft.
  useEffect(() => {
    resetWizard();
  }, [resetWizard]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name },
  });

  const onSubmitName = (values: NameFormValues) => {
    setName(values.name);
    setStep(2);
  };

  const isSubmitting = submitStatus.state === 'submitting';

  const handleCancel = () => {
    resetWizard();
    router.back();
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
      .then((programId) => {
        resetWizard();
        router.replace(`/programs/${programId}`);
      })
      .catch((error: unknown) => {
        setSubmitStatus({ state: 'error', message: (error as Error).message });
      });
  };

  return (
    <ScreenLayout
      justify="flex-start"
      contentStyle={{ paddingTop: Spacing.four, paddingBottom: BottomTabInset + Spacing.four }}
    >
      <ScreenHeader onBackPress={handleCancel} backLabel="Cancel" />

      <ThemedText type="title">Create program</ThemedText>

      {step === 1 && (
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

      {step === 2 && (
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

      {step === 3 && (
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

          <ThemedView style={styles.stepNav}>
            <Pressable onPress={() => setStep(2)}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
            <Button style={styles.navButton} onPress={() => level && setStep(4)} disabled={!level}>
              <ThemedText type="smallBold">Next</ThemedText>
            </Button>
          </ThemedView>
        </ThemedView>
      )}

      {step === 4 && (
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
