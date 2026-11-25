import fc from 'fast-check';
import { asciiStringOf, charFrom, isArgumentList } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** Maximum number of digits in one version component, leading zeros included. */
export const MAX_VERSION_COMPONENT_DIGITS = 6;

const VERSION_COMPONENT = `[0-9]{1,${MAX_VERSION_COMPONENT_DIGITS}}`;
/** Exactly three components of 1 to 6 ASCII digits, separated by single dots. */
const VERSION_TRIPLE = new RegExp(`^${VERSION_COMPONENT}\\.${VERSION_COMPONENT}\\.${VERSION_COMPONENT}$`);

/**
 * Compares two `major.minor.patch` versions numerically, component by component.
 *
 * @param leftVersion - Three dot-separated components of 1 to 6 digits each, leading zeros allowed.
 * @param rightVersion - Same format as `leftVersion`.
 * @returns -1 if left < right, 1 if left > right, and 0 if all three numeric components are equal.
 * @example compareVersionTriples('1.10.0', '1.9.12'); // 1
 */
export function compareVersionTriples(leftVersion: string, rightVersion: string): -1 | 0 | 1 {
  const left = leftVersion.split('.').map(Number);
  const right = rightVersion.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] < right[index] ? -1 : 1;
    }
  }
  return 0;
}

type CompareVersionTriplesArgs = [leftVersion: string, rightVersion: string];

function isVersionTriple(value: unknown): value is string {
  return typeof value === 'string' && VERSION_TRIPLE.test(value);
}

/** Biased: a small digit alphabet makes leading zeros, "10" vs "9", and equal components common. */
const versionComponent = asciiStringOf(1, MAX_VERSION_COMPONENT_DIGITS, charFrom('0', '1', '2', '9'));
const versionTriple = fc
  .tuple(versionComponent, versionComponent, versionComponent)
  .map((components) => components.join('.'));

/** Full domain: every digit 0-9 in each of the 1..6-digit components. */
const fullVersionComponent = asciiStringOf(1, MAX_VERSION_COMPONENT_DIGITS, charFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'));
const fullVersionTriple = fc
  .tuple(fullVersionComponent, fullVersionComponent, fullVersionComponent)
  .map((components) => components.join('.'));

export const compareVersionTriplesTask: TaskDefinition<CompareVersionTriplesArgs, -1 | 0 | 1> = {
  spec: {
    id: 'compareVersionTriples',
    specVersion: 1,
    functionName: 'compareVersionTriples',
    signature: 'function compareVersionTriples(leftVersion: string, rightVersion: string): -1 | 0 | 1',
    supportingTypes: [],
    description: 'Compare two major.minor.patch version strings numerically, component by component.',
    contract: {
      validInputs: [
        `leftVersion, rightVersion: each exactly three components separated by single dots, each component 1 to ${MAX_VERSION_COMPONENT_DIGITS} ASCII digits (leading zeros allowed), i.e. the pattern ${VERSION_TRIPLE.source}.`,
        'Nothing else is valid: no "v" prefix, prerelease ("-alpha"), build metadata ("+build"), whitespace, or a different number of components.',
      ],
      expectedOutput: [
        'Compare the numeric values of major, then minor, then patch; the first component that differs decides.',
        'Return -1 if leftVersion is lower, 1 if it is higher, and 0 if all three numeric values are equal. No other return values.',
      ],
      boundaries: [
        'Leading zeros do not matter: "01.2.3" and "1.2.3" compare equal (0).',
        'Comparison is numeric, not lexicographic: "1.10.0" is higher than "1.9.0".',
        '"0.0.0" is valid. Component values range from 0 to 999999.',
      ],
      exceptions: [],
      example: { args: ['1.10.0', '1.9.12'], expected: { kind: 'returned', value: 1 } },
    },
  },
  reference: compareVersionTriples,
  hooks: {
    isValidInput: (args: unknown): args is CompareVersionTriplesArgs =>
      isArgumentList(args, 2) && isVersionTriple(args[0]) && isVersionTriple(args[1]),
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // The two triples stay independent in both branches. Branch 1 keeps the {0,1,2,9} digit bias (so "10" vs "9"
    // is common); branch 2 uses every digit 0-9 across 1..6-digit components. Every draw matches the version-triple
    // pattern, so it is valid; shrinking stays inside each branch's digit alphabet and component length.
    inputArbitrary: fc.oneof(
      fc.tuple(versionTriple, versionTriple),
      fc.tuple(fullVersionTriple, fullVersionTriple),
    ),
  },
  baselineCases: [
    { args: ['1.10.0', '1.9.12'], expected: { kind: 'returned', value: 1 } },
    { args: ['1.2.3', '1.2.3'], expected: { kind: 'returned', value: 0 } },
    { args: ['01.2.3', '1.2.3'], expected: { kind: 'returned', value: 0 } },
    { args: ['1.9.0', '1.10.0'], expected: { kind: 'returned', value: -1 } },
    { args: ['1.2.3', '1.2.4'], expected: { kind: 'returned', value: -1 } },
    { args: ['2.0.0', '1.9.9'], expected: { kind: 'returned', value: 1 } },
    { args: ['0.0.0', '0.0.1'], expected: { kind: 'returned', value: -1 } },
    { args: ['999999.0.0', '999998.0.0'], expected: { kind: 'returned', value: 1 } },
    { args: ['001.000.000', '1.0.0'], expected: { kind: 'returned', value: 0 } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: the 6-digit cap counts leading zeros, so seven digits are outside the domain even when the numeric value would fit. Malformed version strings stay outside the domain, and no throw is specified. The only legal results are -1, 0, and 1. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: the two versions stay independent. The generator mixes two equally weighted branches: branch 1 draws digits from {0, 1, 2, 9} (so "10" vs "9" and equal components are common), and branch 2 draws every digit 0-9. Components are 1..6 digits in both. Equal triples remain uncommon because the two sides are independent; equality is also covered by the baselines. Digits 3 through 8 are now generated (full domain); shrinking stays inside each branch.',
    'Resolved, specVersion 1: baselines cover a higher left side, equality, leading zeros, a lower left side, a patch difference, a major difference, a zero component, the 6-digit extreme, and padded zeros. They were not thinned.',
  ],
};
