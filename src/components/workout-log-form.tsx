import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getDrafts, saveDraft } from '@/lib/supabase/exercise-drafts';
import { completeDay } from '@/lib/supabase/workout';
import { useTheme } from '@/hooks/use-theme';

export interface WorkoutLogExercise {
  programExerciseId: string;
  name: string;
}

interface WorkoutLogFormProps {
  userId: string;
  dayId: string;
  exercises: WorkoutLogExercise[];
  /** Invoked once, after completeDay succeeds — lets the caller refresh history. */
  onComplete?: () => void;
}

type DraftsState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

type CompleteState =
  | { state: 'idle' }
  | { state: 'completing' }
  | { state: 'done' }
  | { state: 'error'; message: string };

/**
 * Per-day workout logging: date + free-text value per exercise, autosaved
 * as a draft on blur, with a Complete action that writes exercise_logs +
 * training_history and clears the drafts. Mirrors web's TrainingProcessing
 * (`app/training/program/[id]/components/trainingProcessing/trainingProcessing.tsx`).
 *
 * Plain component state rather than react-hook-form: unlike the auth forms,
 * there's no validation schema here — just a dynamically-keyed set of
 * free-text fields with per-field async autosave, which RHF doesn't buy
 * anything for.
 */
export function WorkoutLogForm({ userId, dayId, exercises, onComplete }: WorkoutLogFormProps) {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState('');
  const [draftsState, setDraftsState] = useState<DraftsState>({ state: 'loading' });
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [completeState, setCompleteState] = useState<CompleteState>({ state: 'idle' });

  // Mirrors `values`, mutated synchronously alongside every state update.
  // `TextInput`'s onBlur event in this React Native version carries no
  // text payload (confirmed against the installed types — it's typed as
  // `BlurEvent`, not `TextInputFocusEvent`), and reading from `values`
  // state directly in a blur handler isn't safe either: onChangeText's
  // state update and the blur event can land in the same batch, so a
  // closure over `values` isn't guaranteed to have caught the very last
  // keystroke yet. A ref sidesteps both — it's always current the instant
  // it's written, independent of React's render/commit timing.
  const valuesRef = useRef<Record<string, string>>({});

  const applyValues = (next: Record<string, string>) => {
    valuesRef.current = next;
    setValues(next);
  };

  // `exercises` is rebuilt as a fresh array by the caller on every render of
  // its own parent — depending on it by reference would refetch (and
  // overwrite any in-progress unsaved keystroke) on unrelated re-renders
  // elsewhere on the screen. This derived id list only changes value when
  // the actual set of exercises does.
  const programExerciseIds = exercises.map((exercise) => exercise.programExerciseId);
  const programExerciseIdsKey = programExerciseIds.join(',');

  useEffect(() => {
    let isMounted = true;

    getDrafts(userId, programExerciseIds)
      .then((drafts) => {
        if (!isMounted) return;
        applyValues(drafts);
        setDraftsState({ state: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setDraftsState({ state: 'error', message: (error as Error).message });
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- programExerciseIdsKey is the intentional, stable proxy for programExerciseIds
  }, [userId, dayId, programExerciseIdsKey]);

  const handleChangeText = (programExerciseId: string, text: string) => {
    valuesRef.current = { ...valuesRef.current, [programExerciseId]: text };
    setValues(valuesRef.current);
  };

  const handleBlur = (programExerciseId: string) => {
    const value = valuesRef.current[programExerciseId] ?? '';
    saveDraft(userId, programExerciseId, dayId, value)
      .then(() => setDraftSaveError(null))
      .catch((error: unknown) => setDraftSaveError((error as Error).message));
  };

  const handleComplete = () => {
    if (!date) return;

    setCompleteState({ state: 'completing' });
    completeDay(userId, dayId, date, valuesRef.current)
      .then(() => {
        applyValues({});
        setCompleteState({ state: 'done' });
        onComplete?.();
      })
      .catch((error: unknown) => {
        setCompleteState({ state: 'error', message: (error as Error).message });
      });
  };

  if (draftsState.state === 'loading') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Loading log…
      </ThemedText>
    );
  }

  if (draftsState.state === 'error') {
    return (
      <ThemedText type="small" themeColor="danger">
        ❌ {draftsState.message}
      </ThemedText>
    );
  }

  const isComplete = completeState.state === 'done';
  const isCompleting = completeState.state === 'completing';

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[styles.dateInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.textSecondary}
        value={date}
        onChangeText={setDate}
        editable={!isComplete}
      />

      {exercises.map((exercise) => (
        <ThemedView key={exercise.programExerciseId} style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            {exercise.name}
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholder="XXX/YYxZ"
            placeholderTextColor={theme.textSecondary}
            value={values[exercise.programExerciseId] ?? ''}
            onChangeText={(text) => handleChangeText(exercise.programExerciseId, text)}
            onBlur={() => handleBlur(exercise.programExerciseId)}
            editable={!isComplete}
          />
        </ThemedView>
      ))}

      {draftSaveError && (
        <ThemedText type="small" themeColor="danger">
          ❌ {draftSaveError}
        </ThemedText>
      )}

      <Button onPress={handleComplete} disabled={!date || isCompleting || isComplete}>
        <ThemedText type="smallBold">
          {isComplete ? 'Completed ✅' : isCompleting ? 'Completing…' : 'Complete'}
        </ThemedText>
      </Button>

      {completeState.state === 'error' && (
        <ThemedText type="small" themeColor="danger">
          ❌ {completeState.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  dateInput: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
