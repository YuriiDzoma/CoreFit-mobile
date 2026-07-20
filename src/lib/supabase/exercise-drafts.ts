import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `exercise_drafts` table live here.
 * Callers never touch `supabase.from('exercise_drafts')` directly.
 *
 * Drafts are per-user, per-`program_exercise_id` autosave scratch values —
 * free text (e.g. "80/8x3"), never parsed/validated as numbers, mirroring
 * web's `fetchDrafts`/`saveDraft` (`lib/trainingData.ts`).
 */

const draftRowSchema = z.object({
  program_exercise_id: z.uuid(),
  value: z.string(),
});

export async function getDrafts(
  userId: string,
  programExerciseIds: string[],
): Promise<Record<string, string>> {
  if (programExerciseIds.length === 0) return {};

  const { data, error } = await supabase
    .from('exercise_drafts')
    .select('program_exercise_id, value')
    .eq('user_id', userId)
    .in('program_exercise_id', programExerciseIds);
  if (error) throw error;

  const rows = z.array(draftRowSchema).parse(data);
  const drafts: Record<string, string> = {};
  for (const row of rows) {
    drafts[row.program_exercise_id] = row.value;
  }
  return drafts;
}

export async function saveDraft(
  userId: string,
  programExerciseId: string,
  dayId: string,
  value: string,
): Promise<void> {
  const { error } = await supabase.from('exercise_drafts').upsert(
    {
      user_id: userId,
      program_exercise_id: programExerciseId,
      day_id: dayId,
      value,
    },
    { onConflict: 'user_id,program_exercise_id' },
  );
  if (error) throw error;
}

/**
 * Called only by workout.ts's completeDay orchestration, once the day's
 * values have already been written to exercise_logs and training_history —
 * never called standalone from UI code.
 */
export async function deleteDrafts(
  userId: string,
  dayId: string,
  programExerciseIds: string[],
): Promise<void> {
  if (programExerciseIds.length === 0) return;

  const { error } = await supabase
    .from('exercise_drafts')
    .delete()
    .eq('user_id', userId)
    .eq('day_id', dayId)
    .in('program_exercise_id', programExerciseIds);
  if (error) throw error;
}
