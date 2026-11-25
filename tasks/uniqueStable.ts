import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, isArgumentList, isIntegerArray } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Removes duplicate values, keeping the first occurrence of each value and the order in which values first appear.
 *
 * @param values - Integers to deduplicate. Not modified.
 * @returns A newly allocated array containing each distinct value exactly once, in order of first occurrence.
 * @example uniqueStable([3, 1, 3, 2, 1]); // [3, 1, 2]
 */
export function uniqueStable(values: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

/** The argument list of uniqueStable, as one tuple. */
export type UniqueStableArgs = [values: readonly number[]];

/**
 * Contract domain: exactly one argument, a JSON array of at most 32 integers, each in [-1000, 1000].
 * The array is dense, uses Array.prototype, and has no own properties besides its indexes and length.
 */
export function isValidUniqueStableInput(args: unknown): args is UniqueStableArgs {
  return isArgumentList(args, 1) && isContractIntegerArray(args[0]);
}

function isContractIntegerArray(value: unknown): value is number[] {
  return (
    isIntegerArray(value, MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    Object.getPrototypeOf(value) === Array.prototype &&
    hasOnlyDenseIndexes(value)
  );
}

function hasOnlyDenseIndexes(value: readonly unknown[]): boolean {
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    return false;
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1) {
    return false;
  }
  const allowed = new Set<string>(['length']);
  for (let index = 0; index < value.length; index += 1) {
    allowed.add(String(index));
  }
  return names.every((name) => allowed.has(name));
}

/**
 * Bounded-array arbitrary for uniqueStable. Each element comes, with equal probability, from a tiny pool
 * ([-3, 3], so repeated values are common) or from the whole contract range. Both pools lie inside the domain,
 * so every generated input, and every input fast-check produces while shrinking, satisfies the validator.
 *
 * `size: 'max'` lets lengths reach the contract bound of 32; with fast-check 4.10.2's default size, generated
 * arrays never exceed 10 elements.
 */
export const uniqueStableInputArbitrary: fc.Arbitrary<UniqueStableArgs> = fc.tuple(
  fc.array(
    fc.oneof(
      fc.integer({ min: -3, max: 3 }),
      fc.integer({ min: -INTEGER_LIMIT, max: INTEGER_LIMIT }),
    ),
    { minLength: 0, maxLength: MAX_ARRAY_LENGTH, size: 'max' },
  ),
);

export const uniqueStableTask: TaskDefinition<UniqueStableArgs, number[]> = {
  spec: {
    id: 'uniqueStable',
    specVersion: 1,
    functionName: 'uniqueStable',
    signature: 'function uniqueStable(values: readonly number[]): number[]',
    supportingTypes: [],
    description: 'Remove duplicate numbers, keeping the first occurrence of each value and preserving encounter order.',
    contract: {
      validInputs: [
        `values: a JSON array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        'The array is dense: indexes 0 through length - 1 exist, and it has no other own properties.',
      ],
      expectedOutput: [
        'Return a newly allocated array containing each distinct value of `values` exactly once.',
        'Values are the same when they are the same number. On this domain that is ordinary numeric equality.',
        'Keep the first occurrence of each value, in the order those first occurrences appear. Do not sort the result.',
        'Do not return the `values` argument itself. Do not change the input array, its length, or its elements.',
      ],
      boundaries: [
        '[] returns [].',
        'An array without duplicates is returned with the same elements in the same order.',
        'An array that repeats a single value returns that value once.',
      ],
      exceptions: [],
      example: { args: [[3, 1, 3, 2, 1]], expected: { kind: 'returned', value: [3, 1, 2] } },
    },
  },
  reference: uniqueStable,
  hooks: {
    isValidInput: isValidUniqueStableInput,
    inputArbitrary: uniqueStableInputArbitrary,
  },
  // Frozen before generation. Both inputs are already sorted, so dedupe-then-sort still passes.
  // They are not model outputs, and they are not the unsorted public example.
  baselineCases: [
    { args: [[]], expected: { kind: 'returned', value: [] } },
    { args: [[1, 1, 2]], expected: { kind: 'returned', value: [1, 2] } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: freeze the domain at 0..32 integers in [-1000, 1000]. Order does not depend on magnitude inside that domain. Inputs outside it stay unspecified and are not generated.',
    'Resolved, specVersion 1: keep the equal-weight draw from [-3, 3] and the full domain. That only makes duplicates more common. It is not part of the contract and it is not shown to the model.',
    'Resolved, specVersion 1: freeze exactly two baseline cases, [] -> [] and [1, 1, 2] -> [1, 2]. Both are sorted, so dedupe-then-sort passes them. They were chosen before any model output. The unsorted public example [3, 1, 3, 2, 1] -> [3, 1, 2] stays an illustration, not a baseline.',
    'Resolved, specVersion 1: equality is numeric equality on this domain (no -0, NaN, or non-integers, so === and SameValueZero agree). The result is a new array of first occurrences in encounter order, not a sort. The input object, its length, and its elements stay unchanged. Valid arrays are ordinary Array instances: Array.prototype, dense indexes, and no extra own properties or symbols.',
    'Unresolved adjudication, not an open result sequence: the differential checker compares indexed elements only. It does not check that the result is a different object from the input, that the candidate left its argument unchanged, or that the result has no extra own properties. Those clauses remain required and have to be judged from the source when the sequences agree.',
  ],
};
