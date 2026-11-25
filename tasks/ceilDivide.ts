import fc from 'fast-check';
import { INTEGER_LIMIT, integerIn, isArgumentList, isIntegerInRange, withoutNegativeZero } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Returns the mathematical ceiling of numerator / positiveDenominator, computed with exact integer arithmetic.
 *
 * @param numerator - Integer of either sign.
 * @param positiveDenominator - Positive integer.
 * @returns The smallest integer q with q * positiveDenominator >= numerator; a zero result is +0.
 * @example ceilDivide(-7, 2); // -3
 */
export function ceilDivide(numerator: number, positiveDenominator: number): number {
  const remainder = numerator % positiveDenominator;
  const truncatedQuotient = (numerator - remainder) / positiveDenominator;
  return withoutNegativeZero(remainder > 0 ? truncatedQuotient + 1 : truncatedQuotient);
}

type CeilDivideArgs = [numerator: number, positiveDenominator: number];

function isValidCeilDivideInput(args: unknown): args is CeilDivideArgs {
  if (!isArgumentList(args, 2)) {
    return false;
  }
  const [numerator, positiveDenominator] = args;
  return isIntegerInRange(numerator, -INTEGER_LIMIT, INTEGER_LIMIT) && isIntegerInRange(positiveDenominator, 1, INTEGER_LIMIT);
}

export const ceilDivideTask: TaskDefinition<CeilDivideArgs, number> = {
  spec: {
    id: 'ceilDivide',
    specVersion: 1,
    functionName: 'ceilDivide',
    signature: 'function ceilDivide(numerator: number, positiveDenominator: number): number',
    supportingTypes: [],
    description: 'Divide a signed integer by a positive integer and round the exact quotient up (toward +infinity).',
    contract: {
      validInputs: [
        `numerator: an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        `positiveDenominator: an integer in [1, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'Return the smallest integer q such that q * positiveDenominator >= numerator, i.e. the ceiling of the exact quotient.',
        'A zero result is +0, never -0.',
      ],
      boundaries: [
        'Exact division returns the exact quotient.',
        'Negative numerators round toward +infinity: ceilDivide(-7, 2) is -3.',
        'ceilDivide(-1, 2) is 0 (not -0). A numerator of 0 gives 0. A denominator of 1 returns the numerator.',
      ],
      exceptions: [],
      example: { args: [7, 2], expected: { kind: 'returned', value: 4 } },
    },
  },
  reference: ceilDivide,
  hooks: {
    isValidInput: isValidCeilDivideInput,
    // Reviewed for specVersion 1. The numerator uses the full integer range and the denominator uses 1..1000.
    inputArbitrary: fc.tuple(integerIn(), fc.integer({ min: 1, max: INTEGER_LIMIT })),
  },
  baselineCases: [
    { args: [7, 2], expected: { kind: 'returned', value: 4 } },
    { args: [8, 2], expected: { kind: 'returned', value: 4 } },
    { args: [-7, 2], expected: { kind: 'returned', value: -3 } },
    { args: [-8, 2], expected: { kind: 'returned', value: -4 } },
    { args: [-1, 2], expected: { kind: 'returned', value: 0 } },
    { args: [0, 5], expected: { kind: 'returned', value: 0 } },
    { args: [-4, 1], expected: { kind: 'returned', value: -4 } },
    { args: [1, 2], expected: { kind: 'returned', value: 1 } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: a zero result is +0. Math.ceil of a small negative quotient can be -0, and that value disagrees with this contract. No contract text was changed.',
    'Resolved, specVersion 1: kept the full numerator range and denominators 1..1000. That is the whole valid-input domain. Shrinking stays inside those bounds.',
    'Resolved, specVersion 1: baselines cover a positive ceiling, exact division of either sign, a negative ceiling, the -1/2 case whose result is +0, a zero numerator, a denominator of 1, and a positive non-exact quotient. They were not thinned.',
  ],
};
