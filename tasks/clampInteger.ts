import fc from 'fast-check';
import { INTEGER_LIMIT, integerIn, isArgumentList, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Restricts an integer to the inclusive range [minValue, maxValue].
 *
 * @param value - Integer to clamp.
 * @param minValue - Inclusive lower bound.
 * @param maxValue - Inclusive upper bound, with minValue <= maxValue (equal bounds allowed).
 * @returns minValue if value is below it, maxValue if value is above it, otherwise value.
 * @example clampInteger(15, 0, 10); // 10
 */
export function clampInteger(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

type ClampIntegerArgs = [value: number, minValue: number, maxValue: number];

function isValidClampIntegerInput(args: unknown): args is ClampIntegerArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [value, minValue, maxValue] = args;
  return (
    isIntegerInRange(value, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(minValue, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(maxValue, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    minValue <= maxValue
  );
}

export const clampIntegerTask: TaskDefinition<ClampIntegerArgs, number> = {
  spec: {
    id: 'clampInteger',
    specVersion: 1,
    functionName: 'clampInteger',
    signature: 'function clampInteger(value: number, minValue: number, maxValue: number): number',
    supportingTypes: [],
    description: 'Restrict an integer to an inclusive range given by ordered bounds.',
    contract: {
      validInputs: [
        `value, minValue, maxValue: integers in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}], with minValue <= maxValue.`,
      ],
      expectedOutput: ['Return minValue if value < minValue, maxValue if value > maxValue, and value otherwise.'],
      boundaries: [
        'A value equal to either bound is returned unchanged.',
        'When minValue === maxValue, that bound is returned for every value.',
      ],
      exceptions: [],
      example: { args: [15, 0, 10], expected: { kind: 'returned', value: 10 } },
    },
  },
  reference: clampInteger,
  hooks: {
    isValidInput: isValidClampIntegerInput,
    // Reviewed for specVersion 1. Three full-range integers are drawn, then the last two are ordered so minValue <= maxValue. Shrinking reorders the same way.
    inputArbitrary: fc
      .tuple(integerIn(), integerIn(), integerIn())
      .map(([value, first, second]): ClampIntegerArgs => [value, Math.min(first, second), Math.max(first, second)]),
  },
  baselineCases: [
    { args: [15, 0, 10], expected: { kind: 'returned', value: 10 } },
    { args: [-5, 0, 10], expected: { kind: 'returned', value: 0 } },
    { args: [4, 0, 10], expected: { kind: 'returned', value: 4 } },
    { args: [0, 0, 10], expected: { kind: 'returned', value: 0 } },
    { args: [10, 0, 10], expected: { kind: 'returned', value: 10 } },
    { args: [3, 5, 5], expected: { kind: 'returned', value: 5 } },
    { args: [5, 5, 5], expected: { kind: 'returned', value: 5 } },
    { args: [8, 5, 5], expected: { kind: 'returned', value: 5 } },
    { args: [-1, -10, -2], expected: { kind: 'returned', value: -2 } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: minValue > maxValue is outside the domain, and no throw is specified. Both bounds are inclusive. No contract text was changed.',
    'Resolved, specVersion 1: kept the order-after-draw construction. Every source triple becomes a valid argument list, and every shrink of that triple does too.',
    'Resolved, specVersion 1: baselines cover above the range, below the range, an interior value, both inclusive bounds, equal bounds from below, on, and above the single bound, and a negative range. They were not thinned.',
  ],
};
