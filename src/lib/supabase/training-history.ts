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
