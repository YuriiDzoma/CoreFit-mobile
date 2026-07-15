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
