import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AuthTextField } from '@/components/auth-text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType } from '@/lib/supabase/programs';
import { useProgramWizardStore } from '@/stores/program-wizard-store';

// Same rule as web: required, at least 3 characters, and not purely numeric.
const nameSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .regex(/^(?!\d+$)[\p{L}\d\s'-]+$/u, 'Name must include letters and may contain digits'),
});

type NameFormValues = z.infer<typeof nameSchema>;

const TYPE_OPTIONS = ['aerobic', 'anaerobic', 'crossfit'] as const;
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced', 'expert', 'professional'] as const;
const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function handleAddExercisesPress(dayIndex: number) {
  router.push({ pathname: '/programs/exercise-picker', params: { dayIndex: String(dayIndex) } });
}

// Placeholder for now — the final "create" write is a later, still
// unscheduled sprint (Sprint 18/19 are local-state and picker foundation
// only, per docs/decisions.md).
function handleFinishPress() {}

export default function CreateProgramScreen() {
  const theme = useTheme();
  const [step, setStep] = useState(1);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <Pressable
          onPress={() => {
            resetWizard();
            router.back();
          }}
        >
          <ThemedText type="linkPrimary">Cancel</ThemedText>
        </Pressable>

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

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleSubmit(onSubmitName)}
            >
              <ThemedText type="smallBold">Next</ThemedText>
            </Pressable>
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
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.navButton,
                  !type && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => type && setStep(3)}
                disabled={!type}
              >
                <ThemedText type="smallBold">Next</ThemedText>
              </Pressable>
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
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.navButton,
                  !level && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => level && setStep(4)}
                disabled={!level}
              >
                <ThemedText type="smallBold">Next</ThemedText>
              </Pressable>
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

            <ThemedView style={styles.stepNav}>
              <Pressable onPress={() => setStep(3)}>
                <ThemedText type="linkPrimary">Back</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.navButton,
                  !daysCount && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleFinishPress}
                disabled={!daysCount}
              >
                <ThemedText type="smallBold">Continue</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
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
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  navButton: {
    paddingHorizontal: Spacing.four,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
