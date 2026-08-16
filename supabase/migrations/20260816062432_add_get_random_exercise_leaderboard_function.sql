-- Powers the Records screen (mobile + web): picks one random exercise
-- among those with at least one valid logged weight, returns the top 3
-- users by max weight for it.
--
-- Weight is stored as a free-text "XXX/YYxZ" string (weight/reps x sets)
-- in exercise_logs.weight, not structured numeric columns -- the leading
-- digit run before the first non-digit character is the weight. Rows that
-- don't start with a digit (e.g. "bodyweight") are ignored.
--
-- SECURITY DEFINER deliberately bypasses RLS: a leaderboard is inherently
-- cross-user, and training_history (the Home activity feed) is already
-- cross-user-readable today -- this only exposes an aggregate (max weight
-- + username), not raw log rows.
create or replace function public.get_random_exercise_leaderboard()
returns table (
  exercise_id uuid,
  name_en text,
  name_uk text,
  name_ru text,
  image_url text,
  user_id uuid,
  username text,
  avatar_url text,
  weight int
)
language sql
security definer
set search_path = public
as $$
  with logged as (
    select
      pe.exercise_id,
      el.user_id,
      max((substring(trim(el.weight) from '^[0-9]+'))::int) as max_weight
    from exercise_logs el
    join program_exercises pe on pe.id = el.program_exercise_id
    where trim(el.weight) ~ '^[0-9]+'
    group by pe.exercise_id, el.user_id
  ),
  picked as (
    select exercise_id
    from logged
    group by exercise_id
    order by random()
    limit 1
  )
  select
    e.id,
    e.name_en, e.name_uk, e.name_ru,
    e.image_url,
    p.id, p.username, p.avatar_url,
    l.max_weight
  from picked pk
  join logged l on l.exercise_id = pk.exercise_id
  join exercises e on e.id = pk.exercise_id
  join profiles p on p.id = l.user_id
  order by l.max_weight desc
  limit 3;
$$;

grant execute on function public.get_random_exercise_leaderboard() to anon, authenticated;
