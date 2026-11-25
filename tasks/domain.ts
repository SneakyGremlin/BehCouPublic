import fc from 'fast-check';

// Shared bounds. Each contract restates the bounds it uses in its own text, built from these constants,
// so that contract text, validators, and arbitraries cannot silently drift apart.

/** Maximum length of the main text argument of string tasks. */
export const MAX_TEXT_LENGTH = 64;
/** Maximum length of short string arguments: separators, needles, and suffixes. */
export const MAX_SHORT_TEXT_LENGTH = 8;
/** Maximum number of elements in array arguments. */
export const MAX_ARRAY_LENGTH = 32;
/** Integers lie in [-INTEGER_LIMIT, INTEGER_LIMIT] unless a contract states other bounds. */
export const INTEGER_LIMIT = 1000;

/** Rules shared by every contract. They are public and are included in every generation prompt. */
export const GENERAL_CONTRACT_RULES: readonly string[] = [
  'Inputs and outputs are JSON-compatible: strings, finite numbers, booleans, null, arrays, and plain objects.',
  'An "integer" is a finite JavaScript number with no fractional part. Inputs never contain -0, NaN, or Infinity, and numeric outputs must never be -0.',
  'An "ASCII string" contains only characters U+0000 to U+007F, control characters included. Lengths count characters.',
  'Implementations are deterministic, do not modify their arguments, and perform no I/O.',
  'Behaviour on inputs outside the stated valid inputs is unspecified; such inputs are never tested.',
];

// ---- Validator helpers --------------------------------------------------------------------------------------

export function isArgumentList(value: unknown, count: number): value is readonly unknown[] {
  return Array.isArray(value) && value.length === count;
}

/** A safe integer in [min, max]. Negative zero is rejected because JSON cannot represent it. */
export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max;
}

/** A string of minLength..maxLength characters, each in U+0000..U+007F. */
export function isAsciiString(value: unknown, minLength: number, maxLength: number): value is string {
  if (typeof value !== 'string' || value.length < minLength || value.length > maxLength) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }
  return true;
}

/** An array of at most maxLength elements, each accepted by `isElement`. Holes in sparse arrays are rejected. */
export function isArrayOf(value: unknown, maxLength: number, isElement: (element: unknown) => boolean): value is unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value) || !isElement(value[index])) {
      return false;
    }
  }
  return true;
}

export function isIntegerArray(value: unknown, maxLength: number, min: number, max: number): value is number[] {
  return isArrayOf(value, maxLength, (element) => isIntegerInRange(element, min, max));
}

/** A plain object (prototype Object.prototype or null) whose own enumerable keys are exactly `keys`. */
export function isPlainRecordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

// ---- Arbitrary helpers (fast-check 4.10.2; behaviour below was checked in the installed source) ------------

/** Integers in [min, max]; by default the shared range. fast-check's integer arbitrary never produces -0. */
export function integerIn(min = -INTEGER_LIMIT, max = INTEGER_LIMIT): fc.Arbitrary<number> {
  return fc.integer({ min, max });
}

/**
 * Arrays of 0..maxLength elements. `size: 'max'` matters: with the default size ('small'), fast-check 4.10.2
 * never generates more than min(maxLength, 10) elements, so longer valid inputs would never be tried.
 */
export function arrayUpTo<T>(element: fc.Arbitrary<T>, maxLength: number): fc.Arbitrary<T[]> {
  return fc.array(element, { maxLength, size: 'max' });
}

/**
 * Strings of minLength..maxLength characters drawn from `unit`.
 *
 * Checked against fast-check 4.10.2's installed types and `lib/fast-check.js`:
 * - `unit: 'grapheme-ascii'` (the library default) is printable ASCII U+0020..U+007E.
 * - `unit: 'binary-ascii'` is implemented as `asciiAlphabetRanges = [[0, 127]]`, i.e. U+0000..U+007F including
 *   controls. The `.d.ts` comment that says `0000-00FF` does not match this build; we follow the implementation.
 * - A custom `unit` must produce exactly one ASCII character per value.
 */
export function asciiStringOf(
  minLength: number,
  maxLength: number,
  unit: 'binary-ascii' | 'grapheme-ascii' | fc.Arbitrary<string> = 'binary-ascii',
): fc.Arbitrary<string> {
  return fc.string({ unit, minLength, maxLength, size: 'max' });
}

/** One character chosen from `characters`; use as a custom `unit` to make particular characters frequent. */
export function charFrom(...characters: string[]): fc.Arbitrary<string> {
  return fc.constantFrom(...characters);
}

// ---- Output helper -------------------------------------------------------------------------------------------

/** Returns +0 for -0 and leaves every other number unchanged. */
export function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}
