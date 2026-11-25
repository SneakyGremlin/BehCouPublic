import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isIntegerArray, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Rotates an array right by a positive offset or left by a negative offset. Offsets larger than the array length
 * wrap around.
 *
 * @param values - Integers to rotate. Not modified.
 * @param offset - Integer rotation amount; positive moves elements toward higher indices.
 * @returns A new rotated array; [] when `values` is empty.
 * @example rotateArray([1, 2, 3, 4, 5], 2); // [4, 5, 1, 2, 3]
 */
export function rotateArray(values: readonly number[], offset: number): number[] {
  const length = values.length;
  if (length === 0) {
    return [];
  }
  const rightShift = ((offset % length) + length) % length;
  return [...values.slice(length - rightShift), ...values.slice(0, length - rightShift)];
}

type RotateArrayArgs = [values: readonly number[], offset: number];

function isValidRotateArrayInput(args: unknown): args is RotateArrayArgs {
  if (!isArgumentList(args, 2)) {
    return false;
  }
  const [values, offset] = args;
  return (
    isIntegerArray(values, MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(offset, -INTEGER_LIMIT, INTEGER_LIMIT)
  );
}

export const rotateArrayTask: TaskDefinition<RotateArrayArgs, number[]> = {
  spec: {
    id: 'rotateArray',
    specVersion: 1,
    functionName: 'rotateArray',
    signature: 'function rotateArray(values: readonly number[], offset: number): number[]',
    supportingTypes: [],
    description: 'Rotate an array right by a positive offset or left by a negative offset, wrapping large offsets.',
    contract: {
      validInputs: [
        `values: an array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        `offset: an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'For nonempty values of length n, let k = ((offset mod n) + n) mod n, the right-rotation amount in [0, n). The element at index i moves to index (i + k) mod n.',
        'Positive offsets move elements toward higher indices (right rotation) with wraparound; negative offsets move them toward lower indices (left rotation).',
        'Return a new array; the input array is not modified.',
      ],
      boundaries: [
        '[] returns [] for every offset.',
        'offset 0, or any multiple of the length, returns a copy of values.',
        'offset 1 moves the last element to the front; offset -1 moves the first element to the end.',
        'Offsets with absolute value larger than the length wrap: rotating [1, 2, 3] by 7 equals rotating it by 1.',
      ],
      exceptions: [],
      example: { args: [[1, 2, 3, 4, 5], 2], expected: { kind: 'returned', value: [4, 5, 1, 2, 3] } },
    },
  },
  reference: rotateArray,
  hooks: {
    isValidInput: isValidRotateArrayInput,
    // Reviewed for specVersion 1. Values and offset both use the full contract ranges.
    inputArbitrary: fc.tuple(arrayUpTo(integerIn(), MAX_ARRAY_LENGTH), integerIn()),
  },
  baselineCases: [
    { args: [[1, 2, 3, 4, 5], 2], expected: { kind: 'returned', value: [4, 5, 1, 2, 3] } },
    { args: [[], 4], expected: { kind: 'returned', value: [] } },
    { args: [[], -2], expected: { kind: 'returned', value: [] } },
    { args: [[1, 2, 3], 0], expected: { kind: 'returned', value: [1, 2, 3] } },
    { args: [[1, 2, 3], 6], expected: { kind: 'returned', value: [1, 2, 3] } },
    { args: [[1, 2, 3], -3], expected: { kind: 'returned', value: [1, 2, 3] } },
    { args: [[1, 2, 3], 1], expected: { kind: 'returned', value: [3, 1, 2] } },
    { args: [[1, 2, 3], -1], expected: { kind: 'returned', value: [2, 3, 1] } },
    { args: [[1, 2, 3], 7], expected: { kind: 'returned', value: [3, 1, 2] } },
    { args: [[1, 2, 3], -4], expected: { kind: 'returned', value: [2, 3, 1] } },
    { args: [[9], -1000], expected: { kind: 'returned', value: [9] } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: offsets stay in [-1000, 1000]. That range is wider than the maximum length of 32, so wraparound is part of the contract. Running time is not. No contract text was changed.',
    'Resolved, specVersion 1: the arbitrary already uses the full integer range for both the elements and the offset, with array length 0..32 and size "max". It was kept.',
    'Resolved, specVersion 1: baselines cover a right rotation, empty arrays at both offset signs, offset 0, positive and negative multiples of the length, offset 1, offset -1, offsets whose absolute value exceeds the length, and a one-element array at the offset bound. They were not thinned.',
  ],
};
