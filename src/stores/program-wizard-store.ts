import { create } from 'zustand';

/**
 * Holds in-progress "Create Program" wizard data across its screens —
 * Sprint 19's exercise picker will be a separate route, and this store is
 * how it hands its result back to the wizard rather than through route
 * params (which only flow parent → child, not back the other way). Only
 * the collected data lives here, not the current step (that's local state
 * in the wizard screen itself — pure UI/navigation state, not data that
 * needs to survive a screen swap).
 *
 * Reset only on: starting a new Create Program flow, an explicit Cancel,
 * or after a successful Create — never merely from navigating between
 * wizard screens or returning from the exercise picker.
 */

interface ProgramWizardState {
  name: string;
  type: string | null;
  level: string | null;
  daysCount: number | null;
  setName: (name: string) => void;
  setType: (type: string) => void;
  setLevel: (level: string) => void;
  setDaysCount: (daysCount: number) => void;
  reset: () => void;
}

const initialState = {
  name: '',
  type: null,
  level: null,
  daysCount: null,
};

export const useProgramWizardStore = create<ProgramWizardState>((set) => ({
  ...initialState,
  setName: (name) => set({ name }),
  setType: (type) => set({ type }),
  setLevel: (level) => set({ level }),
  setDaysCount: (daysCount) => set({ daysCount }),
  reset: () => set(initialState),
}));
