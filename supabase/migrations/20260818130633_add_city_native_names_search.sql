-- The original `cities` seed only stored an English/Latin `name` (e.g.
-- "Khmelnytskyi"), and `searchCities`/`citiesData.ts` matched only that
-- column via `ilike`. This meant a Ukrainian- or Russian-speaking user
-- typing their own city's name in Cyrillic (e.g. "Хмельницький") could
-- never match it -- not a missing-city problem, a script-mismatch
-- problem affecting every Cyrillic-script query on either platform.
--
-- Adds native-name columns used for search only (display/storage still
-- uses the canonical English `name`, unchanged) and a `search_cities`
-- RPC that matches across all three -- centralizing the OR-across-
-- columns logic server-side (parameterized, no client-built filter
-- string) rather than duplicating it in both `cities.ts` and
-- `citiesData.ts`.
alter table public.cities add column name_uk text;
alter table public.cities add column name_ru text;

create index cities_name_uk_trgm_idx on public.cities using gin (name_uk gin_trgm_ops);
create index cities_name_ru_trgm_idx on public.cities using gin (name_ru gin_trgm_ops);

create or replace function public.search_cities(query text)
returns table (id uuid, name text, country text, country_code text)
language sql stable
as $$
  select id, name, country, country_code
  from public.cities
  where name ilike query || '%'
     or name_uk ilike query || '%'
     or name_ru ilike query || '%'
  order by population desc
  limit 20;
$$;

grant execute on function public.search_cities(text) to authenticated, anon;
