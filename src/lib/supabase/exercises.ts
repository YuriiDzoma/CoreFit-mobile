import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `exercises` and `muscle_groups`
 * tables live here. Callers never touch `supabase.from('exercises')` or
 * `supabase.from('muscle_groups')` directly.
 *
 * `ExerciseRow` mirrors the live `public.exercises` table exactly (columns,
 * types, and nullability confirmed directly against the Supabase project,
 * not inferred from the web app's client code) — one column per language
 * (`name_en`/`name_uk`/`name_ru`, and likewise for `description_*` and
 * `secondary_*`). `LocalizedExercise` below is a deliberately separate,
 * UI-facing shape with one resolved value per field — the raw/localized
 * split stays intact even though only `'en'` is used anywhere today.
 */

const exerciseRowSchema = z.object({
  id: z.uuid(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  name_en: z.string().nullable(),
  name_uk: z.string().nullable(),
  name_ru: z.string().nullable(),
  description_en: z.string().nullable(),
  description_uk: z.string().nullable(),
  description_ru: z.string().nullable(),
  secondary_en: z.string().nullable(),
  secondary_uk: z.string().nullable(),
  secondary_ru: z.string().nullable(),
  muscle_group_id: z.uuid().nullable(),
  // Kept as a plain string, not a strict enum: the DB has a CHECK constraint
  // limiting this to 'compound'/'isolation' today, but validating it here
  // would make the whole fetch throw if that ever changes. Handling unknown
  // values gracefully is the UI's job (see explore/[id].tsx), not the
  // schema's — this field only needs to be *present*, not *known*.
  type: z.string().nullable(),
});

export type ExerciseRow = z.infer<typeof exerciseRowSchema>;

const muscleGroupRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type MuscleGroupRow = z.infer<typeof muscleGroupRowSchema>;

const EXERCISE_COLUMNS =
  'id, image_url, video_url, name_en, name_uk, name_ru, description_en, description_uk, description_ru, secondary_en, secondary_uk, secondary_ru, muscle_group_id, type';

export async function getExercises(): Promise<ExerciseRow[]> {
  const { data, error } = await supabase.from('exercises').select(EXERCISE_COLUMNS);
  if (error) throw error;
  return z.array(exerciseRowSchema).parse(data);
}

export async function getMuscleGroups(): Promise<MuscleGroupRow[]> {
  const { data, error } = await supabase.from('muscle_groups').select('id, name');
  if (error) throw error;
  return z.array(muscleGroupRowSchema).parse(data);
}

export async function getExerciseById(id: string): Promise<ExerciseRow> {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return exerciseRowSchema.parse(data);
}

export type Locale = 'en' | 'uk' | 'ru';

export type LocalizedExercise = {
  id: string;
  name: string;
  description: string | null;
  secondary: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  type: string | null;
  muscleGroupId: string | null;
};

const DEFAULT_LOCALE: Locale = 'en';

// Only `en`/`uk`/`ru` have DB columns — any other locale (e.g. `pl`, which has
// no `name_pl` column) falls through to the `?? row.name_en` fallback below
// via a missing lookup entry, rather than accidentally landing on `name_ru`
// the way a `locale === 'en' ? ... : locale === 'uk' ? ... : name_ru`
// ternary chain's final `else` branch would.
export function localizeExercise(
  row: ExerciseRow,
  locale: Locale = DEFAULT_LOCALE,
): LocalizedExercise {
  const nameByLocale: Partial<Record<string, string | null>> = {
    en: row.name_en,
    uk: row.name_uk,
    ru: row.name_ru,
  };
  const descriptionByLocale: Partial<Record<string, string | null>> = {
    en: row.description_en,
    uk: row.description_uk,
    ru: row.description_ru,
  };
  const secondaryByLocale: Partial<Record<string, string | null>> = {
    en: row.secondary_en,
    uk: row.secondary_uk,
    ru: row.secondary_ru,
  };

  const name = nameByLocale[locale] ?? row.name_en ?? '';
  const description = descriptionByLocale[locale] ?? row.description_en;
  const secondary = secondaryByLocale[locale] ?? row.secondary_en;

  return {
    id: row.id,
    name,
    description,
    secondary,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    type: row.type,
    muscleGroupId: row.muscle_group_id,
  };
}
