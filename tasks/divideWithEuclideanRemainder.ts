import fc from 'fast-check';
import { INTEGER_LIMIT, integerIn, isArgumentList, isIntegerInRange, withoutNegativeZero } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

export interface DivisionResult {
  readonly quotient: number;
  readonly remainder: number;
}

/**
 * Integer division with a Euclidean remainder: dividend = quotient * divisor + remainder and
 * 0 <= remainder < |divisor|, for any signs of the operands.
 *
 * @param dividend - Integer to divide.
 * @param divisor - Nonzero integer.
 * @returns The unique quotient and remainder satisfying the equations above; neither is -0.
 * @example divideWithEuclideanRemainder(-7, 2); // { quotient: -4, remainder: 1 }
 */
export function divideWithEuclideanRemainder(dividend: number, divisor: number): DivisionResult {
  const divisorMagnitude = Math.abs(divisor);
  const remainder = ((dividend % divisorMagnitude) + divisorMagnitude) % divisorMagnitude;
  const quotient = (dividend - remainder) / divisor;
  return { quotient: withoutNegativeZero(quotient), remainder: withoutNegativeZero(remainder) };
}

type DivideArgs = [dividend: number, divisor: number];

function isValidDivideInput(args: unknown): args is DivideArgs {
  if (!isArgumentList(args, 2)) {
    return false;
  }
  const [dividend, divisor] = args;
  return (
    isIntegerInRange(dividend, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(divisor, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    divisor !== 0
  );
}

export const divideWithEuclideanRemainderTask: TaskDefinition<DivideArgs, DivisionResult> = {
  spec: {
    id: 'divideWithEuclideanRemainder',
    specVersion: 1,
    functionName: 'divideWithEuclideanRemainder',
    signature: 'function divideWithEuclideanRemainder(dividend: number, divisor: number): DivisionResult',
    supportingTypes: ['interface DivisionResult { quotient: number; remainder: number }'],
    description: 'Divide integers, returning the quotient and the Euclidean (never negative) remainder.',
    contract: {
      validInputs: [
        `dividend: an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        `divisor: an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}] other than 0.`,
      ],
      expectedOutput: [
        'Return { quotient, remainder }: the unique integers with dividend === quotient * divisor + remainder and 0 <= remainder < |divisor|.',
        'Neither field is ever -0.',
      ],
      boundaries: [
        'Negative dividend: (-7, 2) gives { quotient: -4, remainder: 1 }.',
        'Negative divisor: (7, -2) gives { quotient: -3, remainder: 1 }; both negative: (-7, -2) gives { quotient: 4, remainder: 1 }.',
        'Exact division gives remainder 0; dividend 0 gives { quotient: 0, remainder: 0 } for every divisor.',
      ],
      exceptions: [],
      example: { args: [-7, 2], expected: { kind: 'returned', value: { quotient: -4, remainder: 1 } } },
    },
  },
  reference: divideWithEuclideanRemainder,
  hooks: {
    isValidInput: isValidDivideInput,
    // Reviewed for specVersion 1. The divisor is a full-range integer filtered to exclude 0. Filtered shrinks are not emitted.
    inputArbitrary: fc.tuple(
      integerIn(),
      integerIn().filter((divisor) => divisor !== 0),
    ),
  },
  baselineCases: [
    { args: [-7, 2], expected: { kind: 'returned', value: { quotient: -4, remainder: 1 } } },
    { args: [7, -2], expected: { kind: 'returned', value: { quotient: -3, remainder: 1 } } },
    { args: [-7, -2], expected: { kind: 'returned', value: { quotient: 4, remainder: 1 } } },
    { args: [7, 2], expected: { kind: 'returned', value: { quotient: 3, remainder: 1 } } },
    { args: [8, 2], expected: { kind: 'returned', value: { quotient: 4, remainder: 0 } } },
    { args: [0, 5], expected: { kind: 'returned', value: { quotient: 0, remainder: 0 } } },
    { args: [0, -5], expected: { kind: 'returned', value: { quotient: 0, remainder: 0 } } },
    { args: [-1, 5], expected: { kind: 'returned', value: { quotient: -1, remainder: 4 } } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: division by zero stays outside the domain, and no throw is specified. A zero quotient or remainder is +0. That follows the shared numeric rule, and the reference normalises -0. No contract text was changed.',
    'Resolved, specVersion 1: kept integerIn for both operands and filter(divisor !== 0). The filter does not yield 0 during shrinking. Both operands otherwise cover [-1000, 1000].',
    'Resolved, specVersion 1: baselines cover every sign combination named in the contract, exact division, a zero dividend with either divisor sign, and a negative dividend whose Euclidean remainder is not the JavaScript remainder. They were not thinned.',
  ],
};
