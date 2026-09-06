-- Project news/announcements feed (a third Home tab, alongside
-- Records/Trainings): app updates surfaced to every user, e.g. "we added
-- page X -- here's why" with an optional screenshot. Content is added
-- manually via the Supabase dashboard/SQL -- no in-app authoring UI -- so
-- this table is public-read-only, same precedent as the `cities` reference
-- table (20260818110000_add_cities_and_profile_location.sql): RLS enabled,
-- a single permissive SELECT policy, deliberately no INSERT/UPDATE/DELETE
-- policy since rows are never written by a client.
create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index news_published_at_idx on public.news (published_at desc);

alter table public.news enable row level security;

create policy "Allow reading news"
on public.news for select
using (true);
