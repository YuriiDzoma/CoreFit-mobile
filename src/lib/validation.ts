import { z } from 'zod';

/**
 * Same rule as web (`lib/validations.tsx`'s `firstNameOptions`/
 * `lastNameOptions`): required, at least 3 characters, letters only.
 * Shared by `register-form.tsx` and Settings' profile name form — the
 * second real consumer is what makes this worth extracting rather than a
 * second inline copy.
 */
export const nameSchema = z
  .string()
  .min(3, 'Must be at least 3 characters')
  .regex(/^[A-Za-z]+$/i, 'Must contain letters only');
