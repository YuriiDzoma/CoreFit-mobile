import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `exercise_logs` table live here.
 * Write-only from the app's perspective — nothing reads this table back;
 * the activity feed and per-day history both read `training_history`
 * instead, mirroring web (`lib/trainingData.ts`'s `completeDay`).
 */

export interface ExerciseLogEntry {
  programExerciseId: string;
  value: string;
}

export async function insertExerciseLogs(
  userId: string,
  date: string,
  entries: ExerciseLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const { error } = await supabase.from('exercise_logs').insert(
    entries.map((entry) => ({
      program_exercise_id: entry.programExerciseId,
      user_id: userId,
      date,
      weight: entry.value,
    })),
  );
  if (error) throw error;
}
