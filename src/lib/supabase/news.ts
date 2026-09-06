import { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `news` table live here.
 *
 * `news` is the project's own update/announcement feed (a third Home tab,
 * alongside Records/Trainings) — public read-only, no in-app authoring UI.
 * Rows are added directly via the Supabase dashboard/SQL, never a client
 * write, matching this table's RLS (SELECT-only policy, no INSERT/UPDATE/
 * DELETE policy at all — see `supabase/migrations/20260906120000_add_news.sql`).
 */

const newsRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  image_url: z.string().nullable(),
  published_at: z.string(),
});

export type NewsRow = z.infer<typeof newsRowSchema>;

export async function getNewsFeed(): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, title, description, image_url, published_at')
    .order('published_at', { ascending: false });
  if (error) throw error;

  return z.array(newsRowSchema).parse(data);
}
