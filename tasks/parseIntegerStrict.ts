import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_TEXT_LENGTH, asciiStringOf, isArgumentList, isAsciiString, isIntegerInRange, withoutNegativeZero } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** Optional sign followed by one or more ASCII digits, and nothing else. */
const STRICT_DECIMAL_INTEGER = /^[+-]?[0-9]+$/;

/**
 * Parses a strict decimal integer: an optional sign followed by digits (leading zeros allowed), nothing else.
 *
 * @param text - Any ASCII text of at most 64 characters, including malformed text.
 * @param minValue - Inclusive lower bound, a safe integer.
 * @param maxValue - Inclusive upper bound, a safe integer with minValue <= maxValue.
 * @returns The exact integer value; zero is always returned as +0.
 * @throws {SyntaxError} If `text` is not an optional sign followed by one or more digits. Checked first.
 * @throws {RangeError} If the exact value is not a safe integer or lies outside [minValue, maxValue].
 * @example parseIntegerStrict('-0042', -100, 100); // -42
 */
export function parseIntegerStrict(text: string, minValue: number, maxValue: number): number {
  if (!STRICT_DECIMAL_INTEGER.test(text)) {
    throw new SyntaxError(`Not a strict decimal integer: ${JSON.stringify(text)}`);
  }
  // BigInt keeps the exact value of long digit strings; Number(text) would round them.
  const exactValue = BigInt(text);
  if (exactValue < BigInt(Number.MIN_SAFE_INTEGER) || exactValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${text} is outside the safe-integer range`);
  }
  const value = withoutNegativeZero(Number(exactValue));
  if (value < minValue || value > maxValue) {
    throw new RangeError(`${text} is outside [${minValue}, ${maxValue}]`);
  }
  return value;
}

type ParseIntegerStrictArgs = [text: string, minValue: number, maxValue: number];

function isValidParseIntegerStrictInput(args: unknown): args is ParseIntegerStrictArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [text, minValue, maxValue] = args;
  return (
    isAsciiString(text, 0, MAX_TEXT_LENGTH) &&
    isIntegerInRange(minValue, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) &&
    isIntegerInRange(maxValue, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) &&
    minValue <= maxValue
  );
}

const MIN_SAFE = Number.MIN_SAFE_INTEGER;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
/** Sign plus 16 digits of MAX_SAFE still fits in 64 characters. */
const MAX_LEADING_ZEROS = 47;

const PARSE_BRACKETS = ['inside', 'below', 'above', 'at-min', 'at-max', 'equal'] as const;
type ParseBracket = (typeof PARSE_BRACKETS)[number];

/**
 * Malformed strings named by the contract boundaries, plus the hook's "0x10" / " 1" / "1 " near-misses.
 * Every entry is ASCII and at most 64 characters.
 */
const MALFORMED_NEAR_MISSES = ['', '+', '-', ' 1', '1 ', ' 7', '7 ', '1.0', '1e3', '0x10', '0x1F', '+-1', '1_000'] as const;

function subtractWithinSafe(value: number, delta: number): number {
  if (value <= MIN_SAFE + delta) {
    return MIN_SAFE;
  }
  return value - delta;
}

function addWithinSafe(value: number, delta: number): number {
  if (value >= MAX_SAFE - delta) {
    return MAX_SAFE;
  }
  return value + delta;
}

/** Inclusive bounds. Four of the six modes contain `value`; below and above miss it when that is representable. */
function boundsAround(value: number, bracket: ParseBracket, slackBelow: number, slackAbove: number): [number, number] {
  if (bracket === 'inside') {
    return [subtractWithinSafe(value, slackBelow), addWithinSafe(value, slackAbove)];
  }
  if (bracket === 'at-min') {
    return [value, addWithinSafe(value, slackAbove)];
  }
  if (bracket === 'at-max') {
    return [subtractWithinSafe(value, slackBelow), value];
  }
  if (bracket === 'equal') {
    return [value, value];
  }
  if (bracket === 'below') {
    if (value === MIN_SAFE) {
      return [value, value];
    }
    const upper = subtractWithinSafe(value, 1);
    return [subtractWithinSafe(upper, slackBelow), upper];
  }
  if (value === MAX_SAFE) {
    return [value, value];
  }
  const lower = addWithinSafe(value, 1);
  return [lower, addWithinSafe(lower, slackAbove)];
}

function formatStrictInteger(value: number, leadingZeros: number, plusSign: boolean, negativeZero: boolean): string {
  const minus = value < 0 || (value === 0 && negativeZero);
  const body = `${'0'.repeat(leadingZeros)}${String(Math.abs(value))}`;
  if (minus) {
    return `-${body}`;
  }
  if (plusSign) {
    return `+${body}`;
  }
  return body;
}

function orderPair(left: number, right: number): [number, number] {
  return left <= right ? [left, right] : [right, left];
}

const parsedValue = fc.oneof(
  fc.integer({ min: -20, max: 20 }),
  fc.integer({ min: -INTEGER_LIMIT, max: INTEGER_LIMIT }),
  fc.integer({ min: MAX_SAFE - 30, max: MAX_SAFE }),
  fc.integer({ min: MIN_SAFE, max: MIN_SAFE + 30 }),
  fc.maxSafeInteger(),
);

const biasedEndpoint = fc.oneof(
  fc.integer({ min: -INTEGER_LIMIT, max: INTEGER_LIMIT }),
  fc.integer({ min: MAX_SAFE - INTEGER_LIMIT, max: MAX_SAFE }),
  fc.integer({ min: MIN_SAFE, max: MIN_SAFE + INTEGER_LIMIT }),
  fc.maxSafeInteger(),
);

const orderedBounds = fc.tuple(biasedEndpoint, biasedEndpoint).map(([left, right]) => orderPair(left, right));

/**
 * Equal-weight mix decided before candidate generation:
 * well-formed numerals, the fixed malformed near-misses, and any ASCII string.
 * Each branch maps every source value to a contract-valid argument list, so shrinking stays valid.
 * On well-formed text, four of the six bracket modes contain the denoted value.
 */
export const parseIntegerStrictInputArbitrary: fc.Arbitrary<ParseIntegerStrictArgs> = fc.oneof(
  fc
    .tuple(
      parsedValue,
      fc.integer({ min: 0, max: MAX_LEADING_ZEROS }),
      fc.boolean(),
      fc.boolean(),
      fc.constantFrom(...PARSE_BRACKETS),
      fc.integer({ min: 0, max: 40 }),
      fc.integer({ min: 0, max: 40 }),
    )
    .map(([value, leadingZeros, plusSign, negativeZero, bracket, slackBelow, slackAbove]): ParseIntegerStrictArgs => {
      const text = formatStrictInteger(value, leadingZeros, plusSign, negativeZero);
      const [minValue, maxValue] = boundsAround(value, bracket, slackBelow, slackAbove);
      return [text, minValue, maxValue];
    }),
  fc.tuple(fc.constantFrom(...MALFORMED_NEAR_MISSES), orderedBounds).map(([text, bounds]): ParseIntegerStrictArgs => [text, bounds[0], bounds[1]]),
  fc.tuple(asciiStringOf(0, MAX_TEXT_LENGTH), orderedBounds).map(([text, bounds]): ParseIntegerStrictArgs => [text, bounds[0], bounds[1]]),
);

const MIN_SAFE_TEXT = String(MIN_SAFE);
const BELOW_MIN_SAFE_TEXT = `-${MAX_SAFE + 1}`;
const ABOVE_MAX_SAFE_TEXT = String(MAX_SAFE + 1);

export const parseIntegerStrictTask: TaskDefinition<ParseIntegerStrictArgs, number> = {
  spec: {
    id: 'parseIntegerStrict',
    specVersion: 1,
    functionName: 'parseIntegerStrict',
    signature: 'function parseIntegerStrict(text: string, minValue: number, maxValue: number): number',
    supportingTypes: [],
    description: 'Parse a strict decimal integer (optional sign and digits only) and check it against inclusive bounds.',
    contract: {
      validInputs: [
        `text: any ASCII string of 0 to ${MAX_TEXT_LENGTH} characters. Malformed text is a valid input; it must raise SyntaxError.`,
        'minValue, maxValue: safe integers (Number.isSafeInteger) with minValue <= maxValue.',
      ],
      expectedOutput: [
        'Well-formed text is an optional single "+" or "-" followed by one or more ASCII digits 0-9, and nothing else (the pattern ^[+-]?[0-9]+$). Leading zeros are allowed.',
        'For well-formed text, return the exact integer it denotes when that integer is a safe integer within [minValue, maxValue], bounds included.',
        'A zero result is always +0: "-0" and "-000" return 0, never -0.',
      ],
      boundaries: [
        '"", "+", and "-" are malformed, as are text with whitespace anywhere (" 7", "7 "), "1.0", "1e3", "0x1F", "1_000", and "+-1".',
        '"9007199254740991" (Number.MAX_SAFE_INTEGER) is within the safe range; "9007199254740992" is not. Range checks use the exact decimal value, never a rounded Number.',
        'Values equal to minValue or maxValue are accepted.',
      ],
      exceptions: [
        'SyntaxError when text is not well-formed. This check comes first, regardless of the bounds.',
        'RangeError when text is well-formed but its exact value is outside the safe-integer range or outside [minValue, maxValue].',
      ],
      example: { args: ['-0042', -100, 100], expected: { kind: 'returned', value: -42 } },
    },
  },
  reference: parseIntegerStrict,
  hooks: {
    isValidInput: isValidParseIntegerStrictInput,
    inputArbitrary: parseIntegerStrictInputArbitrary,
  },
  baselineCases: [
    { args: ['-0042', -100, 100], expected: { kind: 'returned', value: -42 } },
    { args: ['42', 0, 100], expected: { kind: 'returned', value: 42 } },
    { args: ['+7', -10, 10], expected: { kind: 'returned', value: 7 } },
    { args: ['-0', -5, 5], expected: { kind: 'returned', value: 0 } },
    { args: ['-000', -1, 1], expected: { kind: 'returned', value: 0 } },
    { args: ['', -10, 10], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['+', 0, 10], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['-', 0, 10], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: [' 7', -100, 100], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['7 ', -100, 100], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['1.0', 0, 10], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['1e3', 0, 2000], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['0x1F', 0, 100], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['1_000', 0, 2000], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: ['+-1', -10, 10], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: [' 9', 0, 1], expected: { kind: 'threw', errorName: 'SyntaxError' } },
    { args: [String(MAX_SAFE), MIN_SAFE, MAX_SAFE], expected: { kind: 'returned', value: MAX_SAFE } },
    { args: [ABOVE_MAX_SAFE_TEXT, MIN_SAFE, MAX_SAFE], expected: { kind: 'threw', errorName: 'RangeError' } },
    { args: [MIN_SAFE_TEXT, MIN_SAFE, MAX_SAFE], expected: { kind: 'returned', value: MIN_SAFE } },
    { args: [BELOW_MIN_SAFE_TEXT, MIN_SAFE, MAX_SAFE], expected: { kind: 'threw', errorName: 'RangeError' } },
    { args: ['5', 0, 5], expected: { kind: 'returned', value: 5 } },
    { args: ['0', 0, 5], expected: { kind: 'returned', value: 0 } },
    { args: ['6', 0, 5], expected: { kind: 'threw', errorName: 'RangeError' } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: SyntaxError is required before RangeError. Whitespace around digits is SyntaxError even when those digits would fall outside the bounds.',
    'Resolved, specVersion 1: a value outside the safe-integer range and a value outside [minValue, maxValue] both use RangeError. The comparison reads the error name only.',
    'Resolved, specVersion 1: minValue and maxValue stay on the whole safe-integer range so the safe limits are part of the contract. Text stays ASCII of length 0 to 64. The pattern is the definition of well-formed text; the named malformed strings are examples, not an exhaustive list.',
    'Resolved, specVersion 1: zero from "-0" or "-000" is +0. No contract text was changed.',
    'Resolved, specVersion 1: the arbitrary is an equal-weight mix of well-formed text, the fixed malformed near-misses, and binary-ascii text. Well-formed values sit near 0, near +/-1000, near the safe limits, or anywhere in the safe range, with signs and leading zeros. Four of the six bracket modes contain the denoted value. Endpoint pairs are ordered safe integers. Every mapper result is valid for every source value, so shrinking stays inside the validator.',
  ],
};
