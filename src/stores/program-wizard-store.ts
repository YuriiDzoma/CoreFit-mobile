import { create } from 'zustand';

/**
 * Holds in-progress "Create/Edit Program" wizard data across its screens —
 * the exercise picker is a separate route, and this store is how it hands
 * its result back to the wizard rather than through route params (which
 * only flow parent → child) or a callback prop (which doesn't survive a
 * pushed route's screen boundary). Only the collected data lives here, not
 * the current step (that's local state in the wizard screen itself).
 *
 * Reset only on: starting a new Create/Edit flow, an explicit Cancel on the
 * wizard itself, or after a successful save — never merely from navigating
 * between wizard steps or returning from the exercise picker.
 *
 * `id: null` on a day or exercise slot means "not yet persisted" — this is
 * what lets Sprint 32's structural diff tell new rows from existing ones
 * without a separate parallel representation. Create mode is simply the
 * case where every `id` stays `null` throughout; edit mode's prefill
 * (`hydrateDays`) is the only thing that ever populates real ids.
 */

export interface WizardExerciseSlot {
  /** `program_exercises.id` if this slot already exists in the database,
   * `null` if it was just added in this session. */
  id: string | null;
  exerciseId: string;
}

export interface WizardDay {
  /** `program_days.id` if this day already exists, `null` if new. */
  id: string | null;
  exercises: WizardExerciseSlot[];
}

interface ProgramWizardState {
  name: string;
  type: string | null;
  level: string | null;
  daysCount: number | null;
  days: WizardDay[];
  setName: (name: string) => void;
  setType: (type: string) => void;
  setLevel: (level: string) => void;
  setDaysCount: (daysCount: number) => void;
  getDayExercises: (dayIndex: number) => WizardExerciseSlot[];
  setDayExercises: (dayIndex: number, exercises: WizardExerciseSlot[]) => void;
  /** Edit-mode-only: seeds `days` (and `daysCount`) directly from an
   * existing program's fetched structure, preserving real row ids. Never
   * used by Create, which only ever grows `days` via `setDaysCount`. */
  hydrateDays: (days: WizardDay[]) => void;
  reset: () => void;
}

const EMPTY_DAY_EXERCISES: WizardExerciseSlot[] = [];

const initialState = {
  name: '',
  type: null,
  level: null,
  daysCount: null,
  days: [] as WizardDay[],
};

export const useProgramWizardStore = create<ProgramWizardState>((set, get) => ({
  ...initialState,
  setName: (name) => set({ name }),
  setType: (type) => set({ type }),
  setLevel: (level) => set({ level }),
  // Resizes `days` to match the new count. Growing appends brand-new
  // (`id: null`) days; shrinking truncates from the end — the only day
  // mutation this app's UI supports (no reorder, no arbitrary-position
  // removal), which is also why kept days never need their identity
  // recomputed here: array-splice truncation/padding leaves every
  // remaining day's object (including its `id`) untouched.
  setDaysCount: (daysCount) =>
    set((state) => {
      const days = [...state.days];
      if (daysCount > days.length) {
        while (days.length < daysCount) {
          days.push({ id: null, exercises: [] });
        }
      } else if (daysCount < days.length) {
        days.length = daysCount;
      }
      return { daysCount, days };
    }),
  getDayExercises: (dayIndex) => get().days[dayIndex]?.exercises ?? EMPTY_DAY_EXERCISES,
  setDayExercises: (dayIndex, exercises) =>
    set((state) => {
      const days = [...state.days];
      const existing = days[dayIndex] ?? { id: null, exercises: [] };
      days[dayIndex] = { ...existing, exercises };
      return { days };
    }),
  hydrateDays: (days) => set({ daysCount: days.length, days }),
  reset: () => set(initialState),
}));
