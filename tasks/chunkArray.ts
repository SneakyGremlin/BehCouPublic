import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isIntegerArray, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Splits an array into consecutive chunks of `chunkSize` elements. Only the last chunk may be shorter.
 *
 * @param values - Integers to split. Not modified.
 * @param chunkSize - Positive integer chunk length.
 * @returns New arrays whose concatenation equals `values`; [] when `values` is empty.
 * @example chunkArray([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
 */
export function chunkArray(values: readonly number[], chunkSize: number): number[][] {
  const chunks: number[][] = [];
  for (let start = 0; start < values.length; start += chunkSize) {
    chunks.push(values.slice(start, start + chunkSize));
  }
  return chunks;
}

type ChunkArrayArgs = [values: readonly number[], chunkSize: number];

function isValidChunkArrayInput(args: unknown): args is ChunkArrayArgs {
  if (!isArgumentList(args, 2)) {
    return false;
  }
  const [values, chunkSize] = args;
  return isIntegerArray(values, MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT) && isIntegerInRange(chunkSize, 1, INTEGER_LIMIT);
}

export const chunkArrayTask: TaskDefinition<ChunkArrayArgs, number[][]> = {
  spec: {
    id: 'chunkArray',
    specVersion: 1,
    functionName: 'chunkArray',
    signature: 'function chunkArray(values: readonly number[], chunkSize: number): number[][]',
    supportingTypes: [],
    description: 'Split an array into consecutive chunks of chunkSize elements, keeping a shorter final chunk.',
    contract: {
      validInputs: [
        `values: an array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        `chunkSize: an integer in [1, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'Return consecutive slices of values, in order: every chunk except the last has exactly chunkSize elements, and the last has between 1 and chunkSize elements.',
        'Concatenating the chunks gives values. No chunk is empty. The input array is not modified.',
      ],
      boundaries: [
        '[] returns [].',
        'chunkSize >= values.length (with values nonempty) returns one chunk containing all elements.',
        'chunkSize 1 returns one single-element chunk per value.',
      ],
      exceptions: [],
      example: { args: [[1, 2, 3, 4, 5], 2], expected: { kind: 'returned', value: [[1, 2], [3, 4], [5]] } },
    },
  },
  reference: chunkArray,
  hooks: {
    isValidInput: isValidChunkArrayInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // The value array already covers the full [-1000, 1000] integer domain with length 0..32. chunkSize now mixes
    // two equally weighted branches: the small 1..34 bias (which already exercises every distinct result for these
    // array lengths) and the full 1..1000 range. Every draw is valid; shrinking stays inside the chosen branch.
    inputArbitrary: fc.tuple(
      arrayUpTo(integerIn(), MAX_ARRAY_LENGTH),
      fc.oneof(fc.integer({ min: 1, max: MAX_ARRAY_LENGTH + 2 }), fc.integer({ min: 1, max: INTEGER_LIMIT })),
    ),
  },
  baselineCases: [
    { args: [[1, 2, 3, 4, 5], 2], expected: { kind: 'returned', value: [[1, 2], [3, 4], [5]] } },
    { args: [[], 3], expected: { kind: 'returned', value: [] } },
    { args: [[1, 2, 3], 5], expected: { kind: 'returned', value: [[1, 2, 3]] } },
    { args: [[8, 9], 2], expected: { kind: 'returned', value: [[8, 9]] } },
    { args: [[4, 5], 1], expected: { kind: 'returned', value: [[4], [5]] } },
    { args: [[1, 2, 3, 4], 2], expected: { kind: 'returned', value: [[1, 2], [3, 4]] } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: chunkSize may be as large as 1000. Any size greater than or equal to the array length returns one chunk. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: integer elements already use the full [-1000, 1000] range with length 0..32. chunkSize now mixes the 1..34 bias (sizes 33 and 34 already cover the "one chunk" behaviour for every array this task allows) with the full 1..1000 range, equally weighted. The full chunkSize domain is now reachable; shrinking stays inside the chosen branch.',
    'Resolved, specVersion 1: baselines cover a short final chunk, an empty array, chunkSize greater than the length, chunkSize equal to the length, chunkSize 1, and an exact multiple with no empty trailing chunk. They were not thinned.',
  ],
};
