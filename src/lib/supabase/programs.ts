import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `programs` table live here.
 * Callers never touch `supabase.from('programs')` directly.
 *
 * Schema mirrors the live `public.programs` table (columns, types, and
 * nullability confirmed directly against the Supabase project, not
 * inferred from the web app's client code). Only the columns this
 * screen actually renders are selected — `user_id` (used only for the
 * `.eq()` filter, not read back), `author_id`, `source_global_program_id`,
 * and `created_at` aren't needed here.
 *
 * `type`/`level` are kept as plain strings rather than strict Zod enums,
 * even though the DB's CHECK constraints currently limit them to known
 * values — an enum here would make the whole fetch throw if that ever
 * changes. Formatting unknown values gracefully is the UI's job (see
 * `ProgramCard`), not the schema's.
 */

const programRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.string().nullable(),
  level: z.string().nullable(),
  days_count: z.number(),
});

export type ProgramRow = z.infer<typeof programRowSchema>;

const PROGRAM_COLUMNS = 'id, title, type, level, days_count';

export async function getPrograms(userId: string): Promise<ProgramRow[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return z.array(programRowSchema).parse(data);
}

export function formatProgramType(type: string | null): string {
  switch (type) {
    case 'aerobic':
      return 'Aerobic';
    case 'anaerobic':
      return 'Anaerobic';
    case 'crossfit':
      return 'CrossFit';
    default:
      return 'Not specified';
  }
}

export function formatProgramLevel(level: string | null): string {
  switch (level) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    case 'expert':
      return 'Expert';
    case 'professional':
      return 'Professional';
    default:
      return 'Not specified';
  }
}

/**
 * `programs` → `program_days` → `program_exercises`, one query with nested
 * PostgREST selects rather than three sequential round trips — a program is
 * genuinely a tree, so this fits better than decomposing it. No aliases:
 * each relation is unambiguous from its FK (program_days.program_id →
 * programs.id, program_exercises.day_id → program_days.id). Exercise names
 * aren't included here — callers resolve them via the existing
 * `getExercises()` lookup, the same small dataset already fetched whole
 * elsewhere, rather than adding a near-duplicate by-ids fetch function.
 */
const PROGRAM_DETAIL_QUERY = `
  id,
  title,
  type,
  level,
  user_id,
  program_days (
    id,
    day_number,
    program_exercises (
      id,
      exercise_id,
      order_index
    )
  )
`;

const programDetailExerciseRowSchema = z.object({
  id: z.uuid(),
  exercise_id: z.uuid().nullable(),
  order_index: z.number(),
});

const programDetailDayRowSchema = z.object({
  id: z.uuid(),
  day_number: z.number(),
  program_exercises: z.array(programDetailExerciseRowSchema),
});

const programDetailRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.string().nullable(),
  level: z.string().nullable(),
  user_id: z.uuid().nullable(),
  program_days: z.array(programDetailDayRowSchema),
});

export type ProgramDetailExerciseRow = z.infer<typeof programDetailExerciseRowSchema>;
export type ProgramDetailDayRow = z.infer<typeof programDetailDayRowSchema>;
export type ProgramDetailRow = z.infer<typeof programDetailRowSchema>;

export async function getProgramDetail(id: string): Promise<ProgramDetailRow> {
  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_DETAIL_QUERY)
    .eq('id', id)
    .single();
  if (error) throw error;

  const program = programDetailRowSchema.parse(data);

  // Embedded PostgREST relations aren't guaranteed to come back in a
  // deterministic order, so days and their exercises are sorted explicitly
  // by their domain ordering fields (day_number, order_index) rather than
  // relying on whatever order Postgrest happens to return them in.
  const sortedDays = [...program.program_days]
    .sort((a, b) => a.day_number - b.day_number)
    .map((day) => ({
      ...day,
      program_exercises: [...day.program_exercises].sort((a, b) => a.order_index - b.order_index),
    }));

  return { ...program, program_days: sortedDays };
}

/**
 * Input for `createProgram`, mirroring `program-wizard-store.ts`'s shape
 * once `type`/`level` have been narrowed from nullable to their validated,
 * non-null form by the caller — the wizard's own step gates (steps 2/3
 * can't be passed without picking one) already guarantee that by the time
 * step 4's Finish button is reachable, so this layer doesn't re-validate
 * it. `days[dayIndex]` is the ordered list of exercise ids for that day;
 * `day_number` (1-based) is derived as `dayIndex + 1`, matching the
 * wizard UI's own "Day N" labeling — there's no separate `daysCount` field
 * here since it's always exactly `days.length`.
 */
export interface CreateProgramInput {
  userId: string;
  title: string;
  type: string;
  level: string;
  days: string[][];
}

const programIdRowSchema = z.object({ id: z.uuid() });
const programDayIdRowSchema = z.object({ id: z.uuid(), day_number: z.number() });

/**
 * Best-effort cleanup after a later step fails — removes whatever this
 * call already committed. Children are deleted before the parent: the
 * same RLS-driven ordering constraint that governs the inserts in
 * `createProgram` applies in reverse here, mirroring web's
 * `deleteProgramWithRelations` (`lib/programData.ts`). Delete errors are
 * deliberately not checked — this is explicitly best-effort, and the
 * caller always throws the original write error regardless of whether
 * cleanup fully succeeds.
 */
async function cleanupOrphanedProgram(programId: string): Promise<void> {
  await supabase.from('program_days').delete().eq('program_id', programId);
  await supabase.from('programs').delete().eq('id', programId);
}

/**
 * Sequential, dependent inserts — `programs` → `program_days` →
 * `program_exercises` — ported from web's `createTrainingProgram`
 * (`lib/trainingData.ts`). The order isn't just a data dependency (each
 * step needs the previous step's generated ids); it's required by the
 * live RLS INSERT policies on `program_days`/`program_exercises`, which
 * authorize via an `EXISTS` subquery through the parent row(s) — confirmed
 * directly against the Supabase project. No Postgres RPC/transaction
 * exists in this project (see `docs/decisions.md`), so a failure past
 * step 1 cannot be rolled back automatically; `cleanupOrphanedProgram`
 * removes whatever was already committed instead of leaving it orphaned.
 * Each individual `.insert()` call is a single SQL statement, so it's
 * atomic on its own — a failure never leaves a *partial* set of rows
 * within one step, only whole-step gaps between steps.
 */
export async function createProgram(input: CreateProgramInput): Promise<string> {
  const { userId, title, type, level, days } = input;

  const { data: programData, error: programError } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      author_id: userId,
      title,
      type,
      level,
      days_count: days.length,
    })
    .select('id')
    .single();
  if (programError) throw programError;
  const program = programIdRowSchema.parse(programData);

  try {
    const daysToInsert = days.map((_, dayIndex) => ({
      program_id: program.id,
      day_number: dayIndex + 1,
      title: `Day ${dayIndex + 1}`,
    }));

    const { data: insertedDaysData, error: daysError } = await supabase
      .from('program_days')
      .insert(daysToInsert)
      .select('id, day_number');
    if (daysError) throw daysError;
    const insertedDays = z.array(programDayIdRowSchema).parse(insertedDaysData);

    const dayIdByNumber = new Map(insertedDays.map((day) => [day.day_number, day.id]));

    const exercisesToInsert: { day_id: string; exercise_id: string; order_index: number }[] = [];
    days.forEach((exerciseIds, dayIndex) => {
      const dayId = dayIdByNumber.get(dayIndex + 1);
      if (!dayId) {
        throw new Error(`Program day insert did not return an id for day ${dayIndex + 1}`);
      }
      exerciseIds.forEach((exerciseId, exerciseIndex) => {
        exercisesToInsert.push({
          day_id: dayId,
          exercise_id: exerciseId,
          order_index: exerciseIndex + 1,
        });
      });
    });

    // An empty array here is a valid (if incomplete) intermediate state,
    // not a failure — Finish-button validation gating what's allowed to
    // reach this function is future UI work, not this data layer's job.
    // A zero-row bulk insert would itself error, so it's skipped outright.
    if (exercisesToInsert.length > 0) {
      const { error: exercisesError } = await supabase
        .from('program_exercises')
        .insert(exercisesToInsert);
      if (exercisesError) throw exercisesError;
    }

    return program.id;
  } catch (error) {
    await cleanupOrphanedProgram(program.id);
    throw error;
  }
}

/**
 * A single delete on `programs` is sufficient — `program_days.program_id`,
 * `program_exercises.day_id`, and `training_history.day_id` are all
 * `ON DELETE CASCADE` (confirmed live via `pg_constraint`, not assumed),
 * so deleting the parent row removes the entire tree. This is
 * deliberately not a port of web's `deleteProgramWithRelations`, which
 * manually deletes each table in reverse order — redundant here, and,
 * since `program_days`/`program_exercises` currently have no DELETE RLS
 * policy of their own, those explicit steps would silently affect zero
 * rows if ported; only the final `programs` delete (RLS disabled on that
 * table) actually needs to run, and its cascade does the rest.
 */
export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', id);
  if (error) throw error;
}

const programExerciseIdRowSchema = z.object({
  id: z.uuid(),
  exercise_id: z.uuid().nullable(),
});

/**
 * Maps `program_exercises.id` → `exercise_id`, mirroring web's
 * `fetchProgramExerciseMap` (`lib/trainingData.ts`) — used by the Home
 * feed to resolve `training_history.values`' keys (which are
 * `program_exercise_id`s) down to an actual exercise via `getExercises()`.
 */
export async function getExerciseIdsForProgramExercises(
  programExerciseIds: string[],
): Promise<Record<string, string>> {
  if (programExerciseIds.length === 0) return {};

  const { data, error } = await supabase
    .from('program_exercises')
    .select('id, exercise_id')
    .in('id', programExerciseIds);
  if (error) throw error;

  const rows = z.array(programExerciseIdRowSchema).parse(data);
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.exercise_id) map[row.id] = row.exercise_id;
  }
  return map;
}
