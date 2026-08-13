import type { TFunction } from 'i18next';

/**
 * Translated display strings for backend enum values (`programs.type`/
 * `.level`, `exercises.type`) — consolidates what used to be three separate
 * switch-statements (`formatProgramType`/`formatProgramLevel` in
 * `lib/supabase/programs.ts`, plus a near-identical local
 * `formatExerciseType` in `programs/wiki/[id].tsx`) into one place. The enum
 * values themselves (`'aerobic'`, `'beginner'`, `'compound'`, ...) are
 * backend-defined; the display strings are app copy and belong here, not in
 * the data-layer files that fetch the rows.
 */

export function formatProgramType(t: TFunction, type: string | null): string {
  switch (type) {
    case 'aerobic':
      return t('enums.programType.aerobic');
    case 'anaerobic':
      return t('enums.programType.anaerobic');
    case 'crossfit':
      return t('enums.programType.crossfit');
    default:
      return t('enums.programType.notSpecified');
  }
}

export function formatProgramLevel(t: TFunction, level: string | null): string {
  switch (level) {
    case 'beginner':
      return t('enums.programLevel.beginner');
    case 'intermediate':
      return t('enums.programLevel.intermediate');
    case 'advanced':
      return t('enums.programLevel.advanced');
    case 'expert':
      return t('enums.programLevel.expert');
    case 'professional':
      return t('enums.programLevel.professional');
    default:
      return t('enums.programLevel.notSpecified');
  }
}

export function formatExerciseType(t: TFunction, type: string | null): string {
  switch (type) {
    case 'compound':
      return t('enums.exerciseType.compound');
    case 'isolation':
      return t('enums.exerciseType.isolation');
    default:
      return t('enums.exerciseType.notSpecified');
  }
}
