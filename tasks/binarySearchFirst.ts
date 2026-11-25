import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isIntegerArray, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Finds the first index of `target` in a nondecreasing array that may contain duplicates.
 *
 * @param sortedValues - Integers in nondecreasing order. Not modified.
 * @param target - Integer to look for.
 * @returns The smallest index i with sortedValues[i] === target, or -1 if target does not occur.
 * @example binarySearchFirst([1, 2, 2, 2, 5], 2); // 1
 */
export function binarySearchFirst(sortedValues: readonly number[], target: number): number {
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sortedValues[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low < sortedValues.length && sortedValues[low] === target ? low : -1;
}

type BinarySearchFirstArgs = [sortedValues: readonly number[], target: number];

function isNondecreasing(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1] <= value);
}

function isValidBinarySearchFirstInput(args: unknown): args is BinarySearchFirstArgs {
  if (!isArgumentList(args, 2)) {
    return false;
  }
  const [sortedValues, target] = args;
  return (
    isIntegerArray(sortedValues, MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isNondecreasing(sortedValues) &&
    isIntegerInRange(target, -INTEGER_LIMIT, INTEGER_LIMIT)
  );
}

/** Biased: values from [-10, 10] make duplicates and hits common; the target range extends past both ends. */
const sortedSmallIntegers = arrayUpTo(fc.integer({ min: -10, max: 10 }), MAX_ARRAY_LENGTH).map((values) =>
  [...values].sort((left, right) => left - right),
);

/** Full domain: full-range values sorted on a copy, so every nondecreasing array in [-1000, 1000] is reachable. */
const sortedFullIntegers = arrayUpTo(integerIn(), MAX_ARRAY_LENGTH).map((values) =>
  [...values].sort((left, right) => left - right),
);

export const binarySearchFirstTask: TaskDefinition<BinarySearchFirstArgs, number> = {
  spec: {
    id: 'binarySearchFirst',
    specVersion: 1,
    functionName: 'binarySearchFirst',
    signature: 'function binarySearchFirst(sortedValues: readonly number[], target: number): number',
    supportingTypes: [],
    description: 'Return the index of the first occurrence of target in a nondecreasing array, or -1.',
    contract: {
      validInputs: [
        `sortedValues: an array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}], in nondecreasing order (duplicates allowed).`,
        `target: an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'Return the smallest index i such that sortedValues[i] === target, or -1 if target does not occur.',
        'Only the result is specified, not the algorithm or its running time.',
      ],
      boundaries: [
        '[] returns -1.',
        'A target smaller than every element, or larger than every element, returns -1.',
        'When target occurs several times, the first index is returned; if every element equals target, the result is 0.',
      ],
      exceptions: [],
      example: { args: [[1, 2, 2, 2, 5], 2], expected: { kind: 'returned', value: 1 } },
    },
  },
  reference: binarySearchFirst,
  hooks: {
    isValidInput: isValidBinarySearchFirstInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // Branch 1 keeps elements in [-10, 10] and the target in [-12, 12] (hits and duplicates common). Branch 2 uses
    // full-range elements and target. Both sort a copy, so the generated array is nondecreasing and the source is
    // not mutated; every draw and shrink satisfies the validator. The branches are equally weighted.
    inputArbitrary: fc.oneof(
      fc.tuple(sortedSmallIntegers, fc.integer({ min: -12, max: 12 })),
      fc.tuple(sortedFullIntegers, integerIn()),
    ),
  },
  baselineCases: [
    { args: [[1, 2, 2, 2, 5], 2], expected: { kind: 'returned', value: 1 } },
    { args: [[], 1], expected: { kind: 'returned', value: -1 } },
    { args: [[2, 4, 6], 1], expected: { kind: 'returned', value: -1 } },
    { args: [[2, 4, 6], 7], expected: { kind: 'returned', value: -1 } },
    { args: [[2, 4, 6], 3], expected: { kind: 'returned', value: -1 } },
    { args: [[2, 4, 6], 2], expected: { kind: 'returned', value: 0 } },
    { args: [[2, 4, 6], 6], expected: { kind: 'returned', value: 2 } },
    { args: [[5, 5, 5], 5], expected: { kind: 'returned', value: 0 } },
    { args: [[5, 5, 5], 4], expected: { kind: 'returned', value: -1 } },
    { args: [[3], 3], expected: { kind: 'returned', value: 0 } },
    { args: [[3], 4], expected: { kind: 'returned', value: -1 } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: only the index is specified. A linear scan that returns the first match agrees. Running time is not a contract clause. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: an equally weighted mix of branch 1 (values in [-10, 10], target in [-12, 12]) and branch 2 (full-range values and target). Both sort a copy, so arrays are nondecreasing and the source is not mutated; shrinking stays valid. The full value and target domain is now reachable.',
    'Resolved, specVersion 1: baselines cover the first duplicate, an empty array, a miss below, above, and between elements, hits at both ends, an array of equal hits, an equal-array miss, and a one-element hit and miss. They were not thinned.',
  ],
};
