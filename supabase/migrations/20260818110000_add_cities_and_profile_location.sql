-- Place-of-residence field: a self-hosted reference table of major world
-- cities (not an external geocoding API -- explicit user decision, no API
-- keys, autocomplete and nearest-city lookup both resolve entirely against
-- this table) plus two new denormalized columns on `profiles`.
--
-- pg_trgm backs a prefix/substring search on `cities.name` via a GIN
-- index; no PostGIS is needed since the only geo operation is nearest-
-- neighbor over a small (~1000-1500 row) table, cheap enough as a plain
-- haversine ORDER BY without an index-accelerated distance search.
create extension if not exists pg_trgm;

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  country_code text not null,
  lat double precision not null,
  lng double precision not null,
  population integer not null default 0
);

create index cities_name_trgm_idx on public.cities using gin (name gin_trgm_ops);
create index cities_population_idx on public.cities (population desc);

alter table public.cities enable row level security;

-- Reference table, no personal data -- public SELECT, and deliberately no
-- INSERT/UPDATE/DELETE policy at all: rows only ever come from a
-- migration/service-role seed, never a client write (same "start scoped"
-- reasoning docs/decisions.md already recorded for trainer_clients'
-- SELECT policy, taken a step further here since there's no legitimate
-- client write case at all).
create policy "Allow reading cities"
on public.cities for select
using (true);

-- Denormalized plain text, no FK to cities.id -- matches this schema's
-- existing pattern of avoiding joins in profile reads (no other
-- `profiles` column is a foreign key into a reference table either).
alter table public.profiles add column city text;
alter table public.profiles add column country text;

-- Proper haversine distance, not naive squared-degree distance -- at
-- Ukraine/Russia/Poland's mid-to-high latitudes (this app's primary user
-- base, per its 4 supported languages) a degree of longitude covers
-- noticeably less real-world distance than a degree of latitude, so the
-- naive approach would measurably mis-rank nearby cities.
create or replace function public.nearest_city(target_lat double precision, target_lng double precision)
returns table (id uuid, name text, country text, country_code text)
language sql stable
as $$
  select id, name, country, country_code
  from public.cities
  order by (
    2 * 6371 * asin(sqrt(
      sin(radians(lat - target_lat) / 2) ^ 2 +
      cos(radians(target_lat)) * cos(radians(lat)) *
      sin(radians(lng - target_lng) / 2) ^ 2
    ))
  )
  limit 1;
$$;

grant execute on function public.nearest_city(double precision, double precision) to authenticated, anon;
