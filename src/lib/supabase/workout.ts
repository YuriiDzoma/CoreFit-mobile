import { deleteDrafts } from '@/lib/supabase/exercise-drafts';
import { insertExerciseLogs, type ExerciseLogEntry } from '@/lib/supabase/exercise-logs';
import { createTrainingHistoryEntry } from '@/lib/supabase/training-history';

/**
 * Coordinates the "complete a workout day" workflow across three tables.
 * This is the only place that sequences exercise-drafts.ts,
 * exercise-logs.ts, and training-history.ts together — none of those
 * table modules import one another. Mirrors web's completeDay
 * (`lib/trainingData.ts`) step for step: write exercise_logs, write
 * training_history, then clear that day's drafts — run sequentially
 * (not Promise.all) since each is a real write and the order is what
 * "completing" means if an earlier step fails.
 *
 * Empty-string values are dropped before writing, matching web — a blank
 * field means "nothing logged for this exercise today", not a value.
 */
export async function completeDay(
  userId: string,
  dayId: string,
  date: string,
  values: Record<string, string>,
): Promise<void> {
  const filteredEntries = Object.entries(values).filter(([, value]) => value.trim().length > 0);
  const filteredValues = Object.fromEntries(filteredEntries);
  const entries: ExerciseLogEntry[] = filteredEntries.map(([programExerciseId, value]) => ({
    programExerciseId,
    value,
  }));

  await insertExerciseLogs(userId, date, entries);
  await createTrainingHistoryEntry(userId, dayId, date, filteredValues);
  await deleteDrafts(
    userId,
    dayId,
    entries.map((entry) => entry.programExerciseId),
  );
}
