import { z } from 'zod';

/** Reject control chars and angle brackets in user-facing text. */
const SAFE_TEXT = /^[^\x00-\x1F<>]+$/u;

/** Names, titles — letters, numbers, common punctuation (no-only-whitespace). */
const NAME_TEXT = /^[\p{L}\p{N}\s\-'.,&()/+#=]+$/u;

export const zRequiredText = (max = 200, label = 'Field') =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max)
    .regex(SAFE_TEXT, `${label} contains invalid characters`)
    .regex(NAME_TEXT, `${label} may only contain letters, numbers, and common punctuation`);

export const zOptionalText = (max = 2000) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return null;
      const t = v.trim();
      return t === '' ? null : t;
    })
    .refine((v) => v == null || SAFE_TEXT.test(v), 'Invalid characters');

export const zEmail = () =>
  z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(320);

export const zOptionalEmail = () =>
  z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(320)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v));

export const zPositiveNumber = () =>
  z.coerce.number({ invalid_type_error: 'Enter a valid number' }).positive();

export const zNonNegativeNumber = () =>
  z.coerce
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0, 'Must be zero or greater');

export const zUuid = () => z.string().uuid('Invalid id');

/** Strip non-text characters for live input (names, labels). */
export function filterNameTextInput(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s\-'.,&()/+#=]/gu, '');
}

/** Digits and single decimal for price fields. */
export function filterDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}
