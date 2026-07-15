import { useEffect, useMemo, useState } from 'react';

import {
  getExercises,
  getMuscleGroups,
  localizeExercise,
  type ExerciseRow,
  type LocalizedExercise,
  type MuscleGroupRow,
} from '@/lib/supabase/exercises';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; exercises: ExerciseRow[]; muscleGroups: MuscleGroupRow[] }
  | { state: 'error'; message: string };

/**
 * Fetches the exercise/muscle-group catalog once and applies client-side
 * muscle-group + search filtering — the shared logic behind both the
 * Explore screen and the Program Wizard's exercise picker. Extracted here
 * once a second real consumer needed it, not preemptively.
 */
export function useExerciseBrowser() {
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = () => {
    Promise.all([getExercises(), getMuscleGroups()])
      .then(([exercises, muscleGroups]) =>
        setLoadState({ state: 'success', exercises, muscleGroups }),
      )
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const retry = () => {
    setLoadState({ state: 'loading' });
    fetchData();
  };

  const localizedExercises = useMemo<LocalizedExercise[]>(() => {
    if (loadState.state !== 'success') return [];
    const byMuscleGroup = selectedMuscleGroup
      ? loadState.exercises.filter((exercise) => exercise.muscle_group_id === selectedMuscleGroup)
      : loadState.exercises;
    const localized = byMuscleGroup.map((exercise) => localizeExercise(exercise));
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) return localized;
    return localized.filter((exercise) => exercise.name.toLowerCase().includes(trimmedQuery));
  }, [loadState, selectedMuscleGroup, searchQuery]);

  return {
    loadState,
    selectedMuscleGroup,
    setSelectedMuscleGroup,
    searchQuery,
    setSearchQuery,
    localizedExercises,
    retry,
  };
}
