import { z } from 'zod';

import { createProgram, deleteProgram } from '@/lib/supabase/programs';
import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls for the Global Programs ("Complexes") feature
 * live here — reading `global_programs`/`global_program_days`/
 * `global_program_exercises` (all confirmed live: RLS enabled only on
 * `global_programs`, with a public `SELECT` policy; the two child tables
 * have RLS disabled entirely, so no auth is needed to browse), plus
 * resolving/copying a user's ownership of them via the `programs` table.
 * Writes never touch `programs`/`program_days`/`program_exercises`
 * directly — they delegate to `programs.ts`'s already-proven
 * `createProgram`/`deleteProgram` rather than duplicating insert/cascade
 * logic, mirroring web's `addGlobalProgramToUser`/
 * `removeGlobalProgramFromUser` (`lib/complexesData.ts`) at the behavior
 * level without porting their manual multi-table steps.
 *
 * `global_program_exercises` has no `order_index` column (confirmed
 * live) — unlike `program_exercises`, exercises within a day come back in
 * whatever order Postgrest returns them, matching web's own lack of any
 * client-side sort here too, not a mobile-side gap.
 */

const globalProgramRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.string(),
  level: z.string(),
  days_count: z.number(),
});

export type GlobalProgramRow = z.infer<typeof globalProgramRowSchema>;

const GLOBAL_PROGRAM_COLUMNS = 'id, title, type, level, days_count';

export async function getGlobalPrograms(): Promise<GlobalProgramRow[]> {
  const { data, error } = await supabase
    .from('global_programs')
    .select(GLOBAL_PROGRAM_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z.array(globalProgramRowSchema).parse(data);
}

const GLOBAL_PROGRAM_DETAIL_QUERY = `
  id,
  title,
  type,
  level,
  global_program_days (
    id,
    day_number,
    global_program_exercises (
      id,
      exercise_id
    )
  )
`;

const globalProgramDetailExerciseRowSchema = z.object({
  id: z.uuid(),
  exercise_id: z.uuid().nullable(),
});

const globalProgramDetailDayRowSchema = z.object({
  id: z.uuid(),
  day_number: z.number(),
  global_program_exercises: z.array(globalProgramDetailExerciseRowSchema),
});

const globalProgramDetailRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.string(),
  level: z.string(),
  global_program_days: z.array(globalProgramDetailDayRowSchema),
});

export type GlobalProgramDetailExerciseRow = z.infer<typeof globalProgramDetailExerciseRowSchema>;
export type GlobalProgramDetailDayRow = z.infer<typeof globalProgramDetailDayRowSchema>;
export type GlobalProgramDetailRow = z.infer<typeof globalProgramDetailRowSchema>;

export async function getGlobalProgramDetail(id: string): Promise<GlobalProgramDetailRow> {
  const { data, error } = await supabase
    .from('global_programs')
    .select(GLOBAL_PROGRAM_DETAIL_QUERY)
    .eq('id', id)
    .single();
  if (error) throw error;

  const program = globalProgramDetailRowSchema.parse(data);

  // Only day order is guaranteed sortable (day_number); see the
  // module-level note on why exercises aren't re-sorted here.
  const sortedDays = [...program.global_program_days].sort((a, b) => a.day_number - b.day_number);

  return { ...program, global_program_days: sortedDays };
}

const ownedProgramRowSchema = z.object({
  id: z.uuid(),
  source_global_program_id: z.uuid().nullable(),
});

/**
 * Maps `global_program_id` → the user's own copy's `programs.id`, read
 * as a flat query against `programs` (not embedded under
 * `getGlobalPrograms()`), even though a real FK enabling that
 * (`programs.source_global_program_id` → `global_programs.id`,
 * confirmed live via `pg_constraint`) does exist. Treat this as the
 * current implementation, not a permanent one — folding ownership into
 * a single combined query is a reasonable fast-follow, not attempted
 * here since it wasn't part of the approved Sprint 28 scope.
 */
export async function getUserGlobalProgramMap(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, source_global_program_id')
    .eq('user_id', userId)
    .not('source_global_program_id', 'is', null);
  if (error) throw error;

  const rows = z.array(ownedProgramRowSchema).parse(data);
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.source_global_program_id) map[row.source_global_program_id] = row.id;
  }
  return map;
}

async function findOwnedProgramId(globalProgramId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', userId)
    .eq('source_global_program_id', globalProgramId)
    .maybeSingle();
  if (error) throw error;
  return data ? z.object({ id: z.uuid() }).parse(data).id : null;
}

/**
 * Copies a global program into the user's own programs/program_days/
 * program_exercises via `createProgram` — reuses its proven
 * insert-then-cleanup-on-failure shape rather than duplicating it, and
 * gets `source_global_program_id` set in the same initial insert (see
 * `CreateProgramInput` in `programs.ts`). Returns the existing copy's id
 * without creating a duplicate if one already exists, matching web's
 * own check in `addGlobalProgramToUser`.
 */
export async function addGlobalProgramToUser(
  globalProgramId: string,
  userId: string,
): Promise<string> {
  const existingId = await findOwnedProgramId(globalProgramId, userId);
  if (existingId) return existingId;

  const detail = await getGlobalProgramDetail(globalProgramId);
  const days = detail.global_program_days.map((day) =>
    day.global_program_exercises
      .map((exercise) => exercise.exercise_id)
      .filter((exerciseId): exerciseId is string => exerciseId !== null),
  );

  return createProgram({
    userId,
    title: detail.title,
    type: detail.type,
    level: detail.level,
    days,
    sourceGlobalProgramId: globalProgramId,
  });
}

/**
 * Removes the user's copy of a global program. Reuses `deleteProgram`
 * (a single cascading delete on `programs`) rather than web's manual
 * three-table `removeGlobalProgramFromUser` — the same reasoning as
 * `deleteProgram` itself: `program_days`/`program_exercises` have no
 * DELETE RLS policy, so explicit steps there would be silent no-ops.
 * A no-op (not an error) if no copy exists.
 */
export async function removeGlobalProgramFromUser(
  globalProgramId: string,
  userId: string,
): Promise<void> {
  const existingId = await findOwnedProgramId(globalProgramId, userId);
  if (!existingId) return;
  await deleteProgram(existingId);
}
