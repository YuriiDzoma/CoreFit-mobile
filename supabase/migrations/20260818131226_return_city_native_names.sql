-- Exposes `name_uk`/`name_ru` (added in the previous migration for search
-- matching only) through both city-lookup RPCs too, so the app can
-- display/persist a city's name in whichever of the 4 app languages is
-- currently active instead of always the canonical English name. Return
-- signature changes, so `CREATE OR REPLACE` isn't enough -- both
-- functions must be dropped and recreated.
drop function if exists public.search_cities(text);

create function public.search_cities(query text)
returns table (id uuid, name text, name_uk text, name_ru text, country text, country_code text)
language sql stable
as $$
  select id, name, name_uk, name_ru, country, country_code
  from public.cities
  where name ilike query || '%'
     or name_uk ilike query || '%'
     or name_ru ilike query || '%'
  order by population desc
  limit 20;
$$;

grant execute on function public.search_cities(text) to authenticated, anon;

drop function if exists public.nearest_city(double precision, double precision);

create function public.nearest_city(target_lat double precision, target_lng double precision)
returns table (id uuid, name text, name_uk text, name_ru text, country text, country_code text)
language sql stable
as $$
  select id, name, name_uk, name_ru, country, country_code
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
