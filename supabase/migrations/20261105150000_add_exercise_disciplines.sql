-- Exercise disciplines (Sprint 153): strength / cardio / crossfit.
--
-- An array, not a single value: many movements belong to more than one
-- (a deadlift is strength and CrossFit, a rowing machine is cardio and
-- CrossFit). Separate from `type`, which is compound/isolation.

alter table public.exercises
  add column disciplines text[] not null default '{strength}'
  constraint exercises_disciplines_valid check (
    cardinality(disciplines) > 0
    and disciplines <@ array['strength', 'cardio', 'crossfit']::text[]
  );

-- Every existing exercise is a gym strength exercise (the default above);
-- these are also standard CrossFit movements.
update public.exercises
set disciplines = array['strength', 'crossfit']
where name_en in (
  'Barbell Back Squat Overview',
  'Barbell Front Squat',
  'Conventional Deadlift',
  'Sumo Deadlift',
  'Romanian Deadlift',
  'Military Press (Overhead Press)',
  'Push Press',
  'Barbell Bench Press',
  'Barbell Row',
  'Pull Up',
  'Pull Up with a Supinated Grip',
  'Inverted Row',
  'Medium-Grip Push-Up',
  'Chest Dip',
  'Tricep Dip',
  'Barbell Lunge',
  'Dumbbell Lunge',
  'Dumbbell Reverse Lunge',
  'Dumbbell Step-Up',
  'Goblet Squat',
  'Kettlebell Swing',
  'Farmer''s Walk',
  'Hanging Knee Raise',
  'Hanging Leg Raise',
  'Plank',
  'Hollow Body Hold',
  'V-Up',
  'Back Extension (Hyperextension)',
  'Good Morning'
);

-- Mountain climbers are also a cardio staple.
update public.exercises
set disciplines = array['strength', 'crossfit', 'cardio']
where name_en = 'Mountain Climber';

-- Movements without one main muscle group (burpees, cardio machines,
-- Olympic lifts, thrusters) go here rather than being forced into the
-- nearest one.
insert into public.muscle_groups (name) values ('FullBody');
