import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isArrayOf, isIntegerInRange, isPlainRecordWithKeys } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** A closed integer interval [start, end] with start <= end. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/**
 * Merges closed intervals that overlap or share an endpoint, and returns the merged intervals sorted by start.
 * Integer adjacency alone ([1, 2] and [3, 4]) does not merge.
 *
 * @param intervals - Intervals in any order. Neither the array nor its objects are modified.
 * @returns New `{ start, end }` objects, sorted by start, with previous.end < next.start for consecutive pairs.
 * @example mergeClosedIntervals([{ start: 5, end: 7 }, { start: 1, end: 3 }, { start: 3, end: 4 }]);
 *   // [{ start: 1, end: 4 }, { start: 5, end: 7 }]
 */
export function mergeClosedIntervals(intervals: readonly Interval[]): Interval[] {
  const byStart = [...intervals].sort((left, right) => left.start - right.start);
  const merged: Interval[] = [];
  for (const interval of byStart) {
    const last = merged[merged.length - 1];
    if (last !== undefined && interval.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }
  return merged;
}

type MergeClosedIntervalsArgs = [intervals: readonly Interval[]];

function isInterval(value: unknown): value is Interval {
  return (
    isPlainRecordWithKeys(value, ['start', 'end']) &&
    isIntegerInRange(value.start, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(value.end, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    value.start <= value.end
  );
}

/** Biased: short intervals over a narrow range make overlaps, shared endpoints, and plain adjacency all common. */
const shortInterval = fc
  .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 5 }))
  .map(([start, length]): Interval => ({ start, end: start + length }));

/**
 * Full domain: two full-range integers ordered so start <= end, so every valid closed interval in
 * [-1000, 1000] is reachable. Shrinking the drawn pair re-applies min/max, so it stays valid.
 */
const fullInterval = fc
  .tuple(integerIn(), integerIn())
  .map(([first, second]): Interval => ({ start: Math.min(first, second), end: Math.max(first, second) }));

export const mergeClosedIntervalsTask: TaskDefinition<MergeClosedIntervalsArgs, Interval[]> = {
  spec: {
    id: 'mergeClosedIntervals',
    specVersion: 1,
    functionName: 'mergeClosedIntervals',
    signature: 'function mergeClosedIntervals(intervals: readonly Interval[]): Interval[]',
    supportingTypes: ['interface Interval { start: number; end: number }'],
    description: 'Merge closed integer intervals that overlap or share an endpoint, and return them sorted by start.',
    contract: {
      validInputs: [
        `intervals: an array of 0 to ${MAX_ARRAY_LENGTH} plain objects, each with exactly the properties start and end, both integers in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}] with start <= end.`,
        'The array may be in any order and may contain duplicate, nested, or overlapping intervals.',
      ],
      expectedOutput: [
        'Each interval [start, end] is closed: it contains both endpoints.',
        'Two intervals merge exactly when they overlap or share an endpoint (the later-starting one starts at or before the other one ends). Merging repeats until no such pair remains.',
        'Return new { start, end } objects sorted by ascending start; consecutive results satisfy previous.end < next.start.',
        'The union of the returned intervals equals the union of the input intervals. The input array and its objects are not modified.',
      ],
      boundaries: [
        '[] returns [].',
        '[1, 3] and [3, 5] merge into [1, 5] (shared endpoint).',
        '[1, 2] and [3, 4] stay separate: integer adjacency alone does not merge.',
        'Single-point intervals such as [2, 2] are valid. An interval contained in another disappears into it.',
      ],
      exceptions: [],
      example: {
        args: [[{ start: 5, end: 7 }, { start: 1, end: 3 }, { start: 3, end: 4 }, { start: 8, end: 9 }]],
        expected: {
          kind: 'returned',
          value: [
            { start: 1, end: 4 },
            { start: 5, end: 7 },
            { start: 8, end: 9 },
          ],
        },
      },
    },
  },
  reference: mergeClosedIntervals,
  hooks: {
    isValidInput: (args: unknown): args is MergeClosedIntervalsArgs =>
      isArgumentList(args, 1) && isArrayOf(args[0], MAX_ARRAY_LENGTH, isInterval),
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // Each element is an equally weighted mix of a short interval (start in [-50, 50], length 0..5, so overlaps,
    // shared endpoints, and adjacency all occur) and a full-range interval (start <= end anywhere in [-1000, 1000]).
    // Both construct valid intervals, so every draw and every shrink satisfies the validator.
    inputArbitrary: fc.tuple(arrayUpTo(fc.oneof(shortInterval, fullInterval), MAX_ARRAY_LENGTH)),
  },
  baselineCases: [
    {
      args: [[{ start: 5, end: 7 }, { start: 1, end: 3 }, { start: 3, end: 4 }, { start: 8, end: 9 }]],
      expected: {
        kind: 'returned',
        value: [
          { start: 1, end: 4 },
          { start: 5, end: 7 },
          { start: 8, end: 9 },
        ],
      },
    },
    { args: [[]], expected: { kind: 'returned', value: [] } },
    {
      args: [[{ start: 1, end: 2 }, { start: 3, end: 4 }]],
      expected: { kind: 'returned', value: [{ start: 1, end: 2 }, { start: 3, end: 4 }] },
    },
    {
      args: [[{ start: 1, end: 3 }, { start: 3, end: 5 }]],
      expected: { kind: 'returned', value: [{ start: 1, end: 5 }] },
    },
    {
      args: [[{ start: 5, end: 6 }, { start: 1, end: 2 }]],
      expected: { kind: 'returned', value: [{ start: 1, end: 2 }, { start: 5, end: 6 }] },
    },
    {
      args: [[{ start: 1, end: 10 }, { start: 2, end: 3 }, { start: 4, end: 4 }]],
      expected: { kind: 'returned', value: [{ start: 1, end: 10 }] },
    },
    { args: [[{ start: 2, end: 2 }]], expected: { kind: 'returned', value: [{ start: 2, end: 2 }] } },
    {
      args: [[{ start: -5, end: -1 }, { start: -3, end: 0 }]],
      expected: { kind: 'returned', value: [{ start: -5, end: 0 }] },
    },
    {
      args: [[{ start: 1, end: 4 }, { start: 1, end: 4 }]],
      expected: { kind: 'returned', value: [{ start: 1, end: 4 }] },
    },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: a valid interval has start <= end. start > end is outside the domain, and no throw is specified. Results are fresh objects with exactly start and end. Structural comparison ignores property order. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: each interval is an equally weighted mix of the short-interval bias (start in [-50, 50], length 0..5) and a full-range interval built from two ordered integers in [-1000, 1000]. Both keep start <= end inside the range, so draws and shrinks stay valid. The full numeric interval domain is now reachable.',
    'Remaining limitation, sampling.v1 (not a contract change): the validator also accepts interval objects with a null prototype, but neither method generates them. The intervals are built as object literals (Object.prototype), and the harness clones every input with structuredClone, which does not preserve a null prototype. Null-prototype inputs are therefore documented as excluded rather than silently claimed covered.',
    'Resolved, specVersion 1: baselines cover a mixed merge, an empty list, integer adjacency that does not merge, a shared endpoint, unsorted input, a contained interval, a single point, a negative overlap, and a duplicate. They were not thinned.',
  ],
};
