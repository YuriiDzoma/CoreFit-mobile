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
