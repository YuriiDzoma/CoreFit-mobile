import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { WorkoutLogExercise } from '@/components/workout-log-form';
import { Spacing } from '@/constants/theme';
import type { TrainingHistoryEntry } from '@/lib/supabase/training-history';

interface WorkoutHistoryProps {
  entries: TrainingHistoryEntry[];
  exercises: WorkoutLogExercise[];
}

/**
 * Pure presentation — all data (entries, exercise names) is loaded and
 * owned by the caller (programs/[id].tsx); this component fetches nothing
 * itself. Renders as a vertical list of past entries, most recent first
 * (already sorted by the data layer), rather than web's TrainingHistory
 * grid (dates as columns, exercises as rows) — a wide, ever-growing grid
 * doesn't fit a narrow mobile viewport, so the same information is
 * rebalanced into a list instead of pixel-ported.
 */
export function WorkoutHistory({ entries, exercises }: WorkoutHistoryProps) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold">History</ThemedText>

      {entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No history yet.
        </ThemedText>
      ) : (
        entries.map((entry) => (
          <ThemedView key={entry.id} type="backgroundElement" style={styles.entry}>
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(entry.date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </ThemedText>
            {exercises.map((exercise) => {
              const value = entry.values[exercise.programExerciseId];
              if (!value) return null;
              return (
                <ThemedText key={exercise.programExerciseId} type="small">
                  {exercise.name}: {value}
                </ThemedText>
              );
            })}
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  entry: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
