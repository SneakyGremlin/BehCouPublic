import fc from 'fast-check';
import { isArgumentList, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

/**
 * Decides whether a year is a leap year in the (proleptic) Gregorian calendar.
 *
 * @param year - Integer year in [1, 9999].
 * @returns true when the year is divisible by 4, except century years not divisible by 400.
 * @example isGregorianLeapYear(1900); // false
 */
export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

type IsGregorianLeapYearArgs = [year: number];

export const isGregorianLeapYearTask: TaskDefinition<IsGregorianLeapYearArgs, boolean> = {
  spec: {
    id: 'isGregorianLeapYear',
    specVersion: 1,
    functionName: 'isGregorianLeapYear',
    signature: 'function isGregorianLeapYear(year: number): boolean',
    supportingTypes: [],
    description: 'Decide whether a year is a Gregorian leap year.',
    contract: {
      validInputs: [`year: an integer in [${MIN_YEAR}, ${MAX_YEAR}].`],
      expectedOutput: [
        'Return true exactly when year is divisible by 4 and either not divisible by 100 or divisible by 400.',
        'The Gregorian rule is applied to every year in the range, including years before 1582 (proleptic calendar).',
      ],
      boundaries: [
        '1900 and 2100 are not leap years; 1600 and 2000 are.',
        '2024 is a leap year; 2023 is not. Year 4 is a leap year; year 1 is not.',
      ],
      exceptions: [],
      example: { args: [1900], expected: { kind: 'returned', value: false } },
    },
  },
  reference: isGregorianLeapYear,
  hooks: {
    isValidInput: (args: unknown): args is IsGregorianLeapYearArgs =>
      isArgumentList(args, 1) && isIntegerInRange(args[0], MIN_YEAR, MAX_YEAR),
    // Reviewed for specVersion 1. Equal weight: any year in 1..9999, or a century year 100, 200, ..., 9900. Both lie in range, and shrinking a century index stays inside it.
    inputArbitrary: fc.tuple(
      fc.oneof(
        fc.integer({ min: MIN_YEAR, max: MAX_YEAR }),
        fc.integer({ min: 1, max: 99 }).map((century) => century * 100),
      ),
    ),
  },
  baselineCases: [
    { args: [1900], expected: { kind: 'returned', value: false } },
    { args: [2100], expected: { kind: 'returned', value: false } },
    { args: [1600], expected: { kind: 'returned', value: true } },
    { args: [2000], expected: { kind: 'returned', value: true } },
    { args: [2024], expected: { kind: 'returned', value: true } },
    { args: [2023], expected: { kind: 'returned', value: false } },
    { args: [4], expected: { kind: 'returned', value: true } },
    { args: [1], expected: { kind: 'returned', value: false } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: every year from 1 through 9999 uses the proleptic Gregorian rule, including years before 1582. The Julian calendar is not part of the contract. No contract text was changed.',
    'Resolved, specVersion 1: kept the equal-weight mix of a uniform year and a century year. Century indexes 1..99 map to 100..9900, all inside 1..9999. Shrinking the index toward 1 stays inside the domain. Year 10000 is outside the domain and is not generated.',
    'Resolved, specVersion 1: baselines are the years named in the contract boundaries: 1900, 2100, 1600, 2000, 2024, 2023, 4, and 1. They were not thinned.',
  ],
};
