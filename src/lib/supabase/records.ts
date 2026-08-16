import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * `get_exercise_leaderboards` (Postgres function, SECURITY DEFINER — see
 * supabase/migrations/20260816080011_replace_leaderboard_with_paginated_exercise_leaderboards.sql)
 * returns a page of exercises (default 10, optionally filtered to one
 * muscle group) that have at least one valid logged weight, each with up
 * to its top 3 users by max weight — flat rows, ordered by exercise name
 * then rank, grouped into `ExerciseLeaderboard[]` below. An empty array
 * means no exercise (matching the filter) has a parseable logged weight
 * yet — not an error.
 */
const leaderboardRowSchema = z.object({
  exercise_id: z.uuid(),
  name_en: z.string().nullable(),
  name_uk: z.string().nullable(),
  name_ru: z.string().nullable(),
  image_url: z.string().nullable(),
  rank: z.number(),
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
  rank: number;
};

export type ExerciseLeaderboard = {
  exerciseId: string;
  exerciseName: string;
  exerciseImageUrl: string | null;
  entries: LeaderboardEntry[];
};

export const RECORDS_PAGE_SIZE = 10;

// Only `en` today, matching every other `localizeExercise()` call site in
// the app — threading the resolved app language through is a pre-existing,
// explicitly out-of-scope gap (Sprint 41), not something to fix only here.
function localizeName(row: LeaderboardRow): string {
  return row.name_en ?? row.name_uk ?? row.name_ru ?? '';
}

export type GetExerciseLeaderboardsParams = {
  muscleGroupId: string | null;
  offset?: number;
  limit?: number;
};

// Rows arrive already grouped by exercise (the RPC's own ORDER BY), so a
// single linear pass — no map keyed by id needed — is enough to fold flat
// rows into one leaderboard per exercise.
export async function getExerciseLeaderboards({
  muscleGroupId,
  offset = 0,
  limit = RECORDS_PAGE_SIZE,
}: GetExerciseLeaderboardsParams): Promise<ExerciseLeaderboard[]> {
  const { data, error } = await supabase.rpc('get_exercise_leaderboards', {
    p_muscle_group_id: muscleGroupId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;

  const rows = z.array(leaderboardRowSchema).parse(data);

  const leaderboards: ExerciseLeaderboard[] = [];
  for (const row of rows) {
    const current = leaderboards.at(-1);
    if (current?.exerciseId === row.exercise_id) {
      current.entries.push({
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        weight: row.weight,
        rank: row.rank,
      });
      continue;
    }
    leaderboards.push({
      exerciseId: row.exercise_id,
      exerciseName: localizeName(row),
      exerciseImageUrl: row.image_url,
      entries: [
        {
          userId: row.user_id,
          username: row.username,
          avatarUrl: row.avatar_url,
          weight: row.weight,
          rank: row.rank,
        },
      ],
    });
  }

  return leaderboards;
}
