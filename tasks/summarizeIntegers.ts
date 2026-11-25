import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isIntegerArray } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

export interface IntegerSummary {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Summarises a list of integers.
 *
 * @param values - At most 32 integers in [-1000, 1000], so |sum| <= 32000 and every sum is a safe integer.
 * @returns null for an empty list; otherwise the count, sum, minimum, and maximum.
 * @example summarizeIntegers([3, -1, 4]); // { count: 3, sum: 6, min: -1, max: 4 }
 */
export function summarizeIntegers(values: readonly number[]): IntegerSummary | null {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    sum += value;
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }
  return { count: values.length, sum, min, max };
}

type SummarizeIntegersArgs = [values: readonly number[]];

export const summarizeIntegersTask: TaskDefinition<SummarizeIntegersArgs, IntegerSummary | null> = {
  spec: {
    id: 'summarizeIntegers',
    specVersion: 1,
    functionName: 'summarizeIntegers',
    signature: 'function summarizeIntegers(values: readonly number[]): IntegerSummary | null',
    supportingTypes: ['interface IntegerSummary { count: number; sum: number; min: number; max: number }'],
    description: 'Return the count, sum, minimum, and maximum of a list of integers, or null for an empty list.',
    contract: {
      validInputs: [
        `values: an array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}]. Every possible sum is therefore a safe integer.`,
      ],
      expectedOutput: [
        'Return null when values is empty.',
        'Otherwise return { count, sum, min, max }: the number of elements, their exact sum, the smallest element, and the largest element.',
      ],
      boundaries: [
        '[] returns null, not an object with zeros or infinities.',
        'A single element v gives { count: 1, sum: v, min: v, max: v }.',
        'All-negative and all-positive lists are handled; min and max come from the elements, not from 0.',
      ],
      exceptions: [],
      example: { args: [[3, -1, 4]], expected: { kind: 'returned', value: { count: 3, sum: 6, min: -1, max: 4 } } },
    },
  },
  reference: summarizeIntegers,
  hooks: {
    isValidInput: (args: unknown): args is SummarizeIntegersArgs =>
      isArgumentList(args, 1) && isIntegerArray(args[0], MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT),
    // Reviewed for specVersion 1. The array uses the full contract range, length 0..32, size "max".
    inputArbitrary: fc.tuple(arrayUpTo(integerIn(), MAX_ARRAY_LENGTH)),
  },
  baselineCases: [
    { args: [[3, -1, 4]], expected: { kind: 'returned', value: { count: 3, sum: 6, min: -1, max: 4 } } },
    { args: [[]], expected: { kind: 'returned', value: null } },
    { args: [[7]], expected: { kind: 'returned', value: { count: 1, sum: 7, min: 7, max: 7 } } },
    { args: [[-4]], expected: { kind: 'returned', value: { count: 1, sum: -4, min: -4, max: -4 } } },
    { args: [[-5, -1, -3]], expected: { kind: 'returned', value: { count: 3, sum: -9, min: -5, max: -1 } } },
    { args: [[2, 2, 2]], expected: { kind: 'returned', value: { count: 3, sum: 6, min: 2, max: 2 } } },
    { args: [[0, 0]], expected: { kind: 'returned', value: { count: 2, sum: 0, min: 0, max: 0 } } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: at most 32 values in [-1000, 1000] makes every sum a safe integer, so the contract is about the empty list and about min/max coming from the elements. No contract text was changed.',
    'Resolved, specVersion 1: the arbitrary already covers that domain, including the empty array. It was kept.',
    'Resolved, specVersion 1: baselines cover a mixed list, an empty list, one positive element, one negative element, an all-negative list, an all-equal positive list, and zeros. They were not thinned.',
  ],
};
