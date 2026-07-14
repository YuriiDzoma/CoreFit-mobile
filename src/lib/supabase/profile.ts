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
});

export type Profile = z.infer<typeof profileSchema>;

// `email` and `is_trainer` are intentionally excluded: `email` changes belong
// in the auth flow, not this table, and `is_trainer` is backend/admin-managed
// even though the table's RLS update policy doesn't itself restrict it.
export type ProfileUpdate = Partial<Pick<Profile, 'username' | 'avatar_url' | 'language' | 'dark'>>;

const PROFILE_COLUMNS = 'id, username, avatar_url, created_at, email, dark, language, is_trainer';

export async function getProfileById(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
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
