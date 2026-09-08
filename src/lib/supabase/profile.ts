import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `profiles` table live here.
 * Callers never touch `supabase.from('profiles')` directly.
 *
 * Schema mirrors the live `public.profiles` table (confirmed against the
 * Supabase project directly, not inferred from client code): every column
 * besides `id` is nullable, and a DB trigger (`handle_new_user`) inserts a
 * row for every new auth user, defaulting `username` to their email and
 * leaving `avatar_url` null when no `full_name`/`avatar_url` was supplied
 * at sign-up — both are expected, valid states here.
 */

const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  created_at: z.string().nullable(),
  email: z.string().nullable(),
  dark: z.boolean().nullable(),
  language: z.string().nullable(),
  is_trainer: z.boolean().nullable(),
  // Program Detail's I/II/III view-density tab — mobile-only, web's own
  // `ProgramTabs` doesn't persist it at all. Null until the user picks a
  // density at least once; callers default that to `2` themselves.
  program_view_density: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  // Denormalized plain text, not a FK into `cities` — set together,
  // always from a `City` the user picked (typed autocomplete) or the
  // nearest-city RPC result, never typed freely.
  city: z.string().nullable(),
  country: z.string().nullable(),
  // Heartbeat written roughly every 60s while the app is foregrounded
  // (see auth-provider.tsx) -- drives the "Онлайн"/last-seen line on the
  // profile screen. Null for any row that predates this column, or that
  // simply hasn't opened the app since.
  last_active_at: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

// `email` is intentionally excluded — email changes belong in the auth
// flow, not this table. `is_trainer` *was* excluded too (backend/admin-
// managed, gating only web's global-program authoring) until Sprint 47's
// trainer/client relationships gave it a second, user-facing meaning:
// only a self-declared trainer can receive a "be my trainer" request, and
// only a non-trainer can send one — both enforced server-side too (see
// the trainer_clients INSERT policy in docs/decisions.md), this is just
// the self-service toggle for it (Settings), same instant-apply shape as
// the existing `dark` toggle there.
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'username'
    | 'avatar_url'
    | 'language'
    | 'dark'
    | 'is_trainer'
    | 'program_view_density'
    | 'city'
    | 'country'
    | 'last_active_at'
  >
>;

const PROFILE_COLUMNS =
  'id, username, avatar_url, created_at, email, dark, language, is_trainer, program_view_density, city, country, last_active_at';

export async function getProfileById(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
}

// Whole-table read, same shape getProfileById already validates — used by
// the Users screen to browse every profile. Ordered by username since
// there's no natural row order worth exposing for a browse-all list
// (unlike global_program_exercises's deliberate no-ORDER-BY decision).
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('username', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return z.array(profileSchema).parse(data);
}

export async function updateProfileById(id: string, updates: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
}
