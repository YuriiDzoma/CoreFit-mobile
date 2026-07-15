import { create } from 'zustand';

/**
 * Holds in-progress "Create Program" wizard data across its screens — the
 * exercise picker is a separate route, and this store is how it hands its
 * result back to the wizard rather than through route params (which only
 * flow parent → child, not back the other way) or a callback prop (which
 * doesn't survive a pushed route's screen boundary). Only the collected
 * data lives here, not the current step (that's local state in the wizard
 * screen itself — pure UI/navigation state, not data that needs to survive
 * a screen swap).
 *
 * Reset only on: starting a new Create Program flow, an explicit Cancel on
 * the wizard itself, or after a successful Create — never merely from
 * navigating between wizard screens or returning from the exercise picker.
 *
 * `days[dayIndex]` holds the confirmed exercise ids for that day. The
 * picker's own Cancel/Confirm boundary is a separate, narrower scope than
 * the wizard's: the picker keeps its in-progress selection in local
 * component state and only writes into `days` via `setDayExercises` on
 * Confirm — Cancel there never touches this store at all.
 */

interface ProgramWizardState {
  name: string;
  type: string | null;
  level: string | null;
  daysCount: number | null;
  days: string[][];
  setName: (name: string) => void;
  setType: (type: string) => void;
  setLevel: (level: string) => void;
  setDaysCount: (daysCount: number) => void;
  getDayExercises: (dayIndex: number) => string[];
  setDayExercises: (dayIndex: number, exerciseIds: string[]) => void;
  reset: () => void;
}

const EMPTY_DAY_EXERCISES: string[] = [];

const initialState = {
  name: '',
  type: null,
  level: null,
  daysCount: null,
  days: [] as string[][],
};

export const useProgramWizardStore = create<ProgramWizardState>((set, get) => ({
  ...initialState,
  setName: (name) => set({ name }),
  setType: (type) => set({ type }),
  setLevel: (level) => set({ level }),
  // Resizes `days` to match the new count, preserving already-picked
  // exercises for days that still exist (by index) rather than discarding
  // everything — mirrors how web preserves existing days' exercises by day
  // number when the day count changes.
  setDaysCount: (daysCount) =>
    set((state) => {
      const days = [...state.days];
      if (daysCount > days.length) {
        while (days.length < daysCount) {
          days.push([]);
        }
      } else if (daysCount < days.length) {
        days.length = daysCount;
      }
      return { daysCount, days };
    }),
  getDayExercises: (dayIndex) => get().days[dayIndex] ?? EMPTY_DAY_EXERCISES,
  setDayExercises: (dayIndex, exerciseIds) =>
    set((state) => {
      const days = [...state.days];
      days[dayIndex] = exerciseIds;
      return { days };
    }),
  reset: () => set(initialState),
}));
