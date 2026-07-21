import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `training_history` table live here.
 *
 * This mirrors web's global, cross-user activity feed (`fetchAllTrainingHistories`
 * in `lib/trainingData.ts`) — every completed workout entry from every user,
 * not scoped to the current one; there is no ownership filter here by design.
 * `user_id` is nullable on the live table (confirmed directly, not assumed —
 * currently 0 of 14 rows are null, but the schema allows it), so `profiles`
 * is modeled as nullable too, unlike web's own code, which doesn't guard
 * against a missing profile at all.
 */

const TRAINING_HISTORY_FEED_QUERY = `
  id,
  date,
  created_at,
  values,
  profiles (
    id,
    username,
    avatar_url
  )
`;

const trainingHistoryFeedRowSchema = z.object({
  id: z.uuid(),
  date: z.string(),
  created_at: z.string().nullable(),
  values: z.record(z.string(), z.string()),
  profiles: z
    .object({
      id: z.uuid(),
      username: z.string().nullable(),
      avatar_url: z.string().nullable(),
    })
    .nullable(),
});

export type TrainingHistoryFeedRow = z.infer<typeof trainingHistoryFeedRowSchema>;

export async function getTrainingHistoryFeed(): Promise<TrainingHistoryFeedRow[]> {
  const { data, error } = await supabase
    .from('training_history')
    .select(TRAINING_HISTORY_FEED_QUERY)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return z.array(trainingHistoryFeedRowSchema).parse(data);
}

/**
 * Called only by workout.ts's completeDay orchestration. `values` is the
 * same program_exercise_id → free-text-value map written to exercise_logs
 * for the same day, denormalized into one row — mirrors web's completeDay
 * (`lib/trainingData.ts`), which writes both from the same filtered map.
 */
export async function createTrainingHistoryEntry(
  userId: string,
  dayId: string,
  date: string,
  values: Record<string, string>,
): Promise<void> {
  const { error } = await supabase
    .from('training_history')
    .insert({ user_id: userId, day_id: dayId, date, values });
  if (error) throw error;
}

const TRAINING_HISTORY_FOR_PROGRAM_QUERY = `
  id,
  day_id,
  date,
  created_at,
  values,
  program_days!inner(program_id)
`;

const trainingHistoryRowSchema = z.object({
  id: z.uuid(),
  day_id: z.uuid(),
  date: z.string(),
  created_at: z.string().nullable(),
  values: z.record(z.string(), z.string()),
});

export type TrainingHistoryEntry = z.infer<typeof trainingHistoryRowSchema>;

/**
 * Filters through the embedded `program_days` relation (`!inner`, required
 * for the filter to actually restrict the parent rows rather than just the
 * embed) instead of requiring the caller to already know a program's day
 * ids — this is what lets `programs/[id].tsx` fetch program detail,
 * exercises, and this history query all in the same `Promise.all`, with no
 * sequential dependency on the program fetch resolving first.
 *
 * Grouped by `day_id` before returning, matching `getDrafts`'/
 * `getExerciseIdsForProgramExercises`' existing map-returning convention —
 * the sole consumer only ever needs "this day's entries", so grouping here
 * avoids pushing the same boilerplate into the screen for no benefit.
 */
export async function getTrainingHistoryForProgram(
  programId: string,
): Promise<Record<string, TrainingHistoryEntry[]>> {
  const { data, error } = await supabase
    .from('training_history')
    .select(TRAINING_HISTORY_FOR_PROGRAM_QUERY)
    .eq('program_days.program_id', programId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = z.array(trainingHistoryRowSchema).parse(data);
  const grouped: Record<string, TrainingHistoryEntry[]> = {};
  for (const row of rows) {
    const entries = grouped[row.day_id] ?? [];
    entries.push(row);
    grouped[row.day_id] = entries;
  }
  return grouped;
}
