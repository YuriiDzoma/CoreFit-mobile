import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * `get_random_exercise_leaderboard` (Postgres function, SECURITY DEFINER —
 * see supabase/migrations/20260816062432_add_get_random_exercise_leaderboard_function.sql)
 * picks one random exercise among those with at least one valid logged
 * weight and returns up to the top 3 users by max weight for it, one row
 * per user (all rows share the same exercise fields). An empty array means
 * nobody has logged a parseable weight for any exercise yet — not an error.
 */
const leaderboardRowSchema = z.object({
  exercise_id: z.uuid(),
  name_en: z.string().nullable(),
  name_uk: z.string().nullable(),
  name_ru: z.string().nullable(),
  image_url: z.string().nullable(),
  user_id: z.uuid(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  weight: z.number(),
});

export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

export type LeaderboardEntry = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  weight: number;
};

export type ExerciseLeaderboard = {
  exerciseId: string;
  exerciseName: string;
  exerciseImageUrl: string | null;
  entries: LeaderboardEntry[];
};

// Only `en` today, matching every other `localizeExercise()` call site in
// the app — threading the resolved app language through is a pre-existing,
// explicitly out-of-scope gap (Sprint 41), not something to fix only here.
function localizeName(row: LeaderboardRow): string {
  return row.name_en ?? row.name_uk ?? row.name_ru ?? '';
}

export async function getRandomExerciseLeaderboard(): Promise<ExerciseLeaderboard | null> {
  const { data, error } = await supabase.rpc('get_random_exercise_leaderboard');
  if (error) throw error;

  const rows = z.array(leaderboardRowSchema).parse(data);
  if (rows.length === 0) return null;

  const [first] = rows;
  return {
    exerciseId: first.exercise_id,
    exerciseName: localizeName(first),
    exerciseImageUrl: first.image_url,
    entries: rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      avatarUrl: row.avatar_url,
      weight: row.weight,
    })),
  };
}
