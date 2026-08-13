import type { TFunction } from 'i18next';
import { z } from 'zod';

/**
 * Same rule as web (`lib/validations.tsx`'s `firstNameOptions`/
 * `lastNameOptions`): required, at least 3 characters, letters only.
 * Shared by `register-form.tsx` and Settings' profile name form — the
 * second real consumer is what makes this worth extracting rather than a
 * second inline copy. A factory rather than a module-scope constant since
 * the messages need `t`, which is only available inside a component;
 * callers build this via `useMemo(() => createNameSchema(t), [t])`.
 */
export function createNameSchema(t: TFunction) {
  return z
    .string()
    .min(3, t('validation.name.tooShort'))
    .regex(/^[A-Za-z]+$/i, t('validation.name.lettersOnly'));
}
