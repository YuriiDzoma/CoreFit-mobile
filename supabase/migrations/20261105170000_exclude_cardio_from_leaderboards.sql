-- Records (Sprint 153): cardio exercises are logged as time/distance
-- ("30/5" = 30 min, 5 km), not weight/reps, so the leaderboard's "max
-- weight" would rank minutes. Leave out every exercise tagged cardio
-- (rowing and the air bike are cardio + CrossFit and are logged the same
-- way). Otherwise identical to 20260816080011.
create or replace function public.get_exercise_leaderboards(
  p_muscle_group_id uuid default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  exercise_id uuid, name_en text, name_uk text, name_ru text, image_url text,
  rank integer, user_id uuid, username text, avatar_url text, weight integer
)
language sql
security definer
set search_path to 'public'
as $function$
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
  ranked as (
    select
      logged.*,
      row_number() over (partition by exercise_id order by max_weight desc) as rn
    from logged
  ),
  paged_exercises as (
    select e.id, e.name_en, e.name_uk, e.name_ru, e.image_url
    from exercises e
    where e.id in (select distinct exercise_id from logged)
      and (p_muscle_group_id is null or e.muscle_group_id = p_muscle_group_id)
      and not ('cardio' = any(e.disciplines))
    order by e.name_en
    limit p_limit offset p_offset
  )
  select
    pex.id,
    pex.name_en, pex.name_uk, pex.name_ru,
    pex.image_url,
    r.rn::int,
    r.user_id, p.username, p.avatar_url,
    r.max_weight
  from paged_exercises pex
  join ranked r on r.exercise_id = pex.id and r.rn <= 3
  join profiles p on p.id = r.user_id
  order by pex.name_en, r.rn;
$function$;
