-- Replaces get_random_exercise_leaderboard() (20260816062432) with a
-- paginated, muscle-group-filterable version powering the redesigned
-- Records screen (mobile + web): a list of exercises (default 10, "show
-- more" loads 10 more), each with its own top-3 leaderboard, optionally
-- filtered to one muscle group.
--
-- Same weight-parsing approach as before: exercise_logs.weight is a
-- free-text "XXX/YYxZ" string, the leading digit run before the first
-- non-digit character is the weight; rows that don't start with a digit
-- are ignored. Same SECURITY DEFINER reasoning as before: a leaderboard is
-- inherently cross-user, and training_history (the Home activity feed) is
-- already cross-user-readable today.
--
-- Ordering is by name_en (not random) so pagination is stable: two calls
-- with offset=0 and offset=10 must not overlap or skip rows.
drop function if exists public.get_random_exercise_leaderboard();

create or replace function public.get_exercise_leaderboards(
  p_muscle_group_id uuid default null,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  exercise_id uuid,
  name_en text,
  name_uk text,
  name_ru text,
  image_url text,
  rank int,
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
$$;

grant execute on function public.get_exercise_leaderboards(uuid, int, int) to anon, authenticated;
