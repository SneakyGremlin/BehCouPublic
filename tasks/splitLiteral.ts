import fc from 'fast-check';
import {
  INTEGER_LIMIT,
  MAX_SHORT_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
  asciiStringOf,
  charFrom,
  isArgumentList,
  isAsciiString,
  isIntegerInRange,
} from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Splits text on every occurrence of a literal separator, keeping empty fields, and returns at most `limit`
 * fields. Occurrences are found left to right without overlapping. Fields beyond `limit` are discarded.
 * The result equals `text.split(separator).slice(0, limit)` for a string separator.
 *
 * @param text - ASCII text of at most 64 characters.
 * @param separator - Nonempty ASCII separator of at most 8 characters, matched literally (not as a regex).
 * @param limit - Maximum number of fields to return, an integer in [0, 1000].
 * @returns The first `limit` fields, in order.
 * @example splitLiteral('a,b,,c', ',', 3); // ['a', 'b', '']
 */
export function splitLiteral(text: string, separator: string, limit: number): string[] {
  const fields: string[] = [];
  let fieldStart = 0;
  while (fields.length < limit) {
    const separatorIndex = text.indexOf(separator, fieldStart);
    if (separatorIndex === -1) {
      fields.push(text.slice(fieldStart));
      break;
    }
    fields.push(text.slice(fieldStart, separatorIndex));
    fieldStart = separatorIndex + separator.length;
  }
  return fields;
}

type SplitLiteralArgs = [text: string, separator: string, limit: number];

function isValidSplitLiteralInput(args: unknown): args is SplitLiteralArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [text, separator, limit] = args;
  return (
    isAsciiString(text, 0, MAX_TEXT_LENGTH) &&
    isAsciiString(separator, 1, MAX_SHORT_TEXT_LENGTH) &&
    isIntegerInRange(limit, 0, INTEGER_LIMIT)
  );
}

/** Small alphabet in which separators occur often; it includes regex metacharacters. */
const splitCharacter = charFrom('a', 'b', ',', '.', '|');

export const splitLiteralTask: TaskDefinition<SplitLiteralArgs, string[]> = {
  spec: {
    id: 'splitLiteral',
    specVersion: 1,
    functionName: 'splitLiteral',
    signature: 'function splitLiteral(text: string, separator: string, limit: number): string[]',
    supportingTypes: [],
    description: 'Split text on a literal separator, keeping empty fields, and return at most limit fields.',
    contract: {
      validInputs: [
        `text: an ASCII string of 0 to ${MAX_TEXT_LENGTH} characters.`,
        `separator: an ASCII string of 1 to ${MAX_SHORT_TEXT_LENGTH} characters, matched literally: characters such as ".", "*", and "|" have no special meaning.`,
        `limit: an integer in [0, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'Find occurrences of separator from left to right; after each match, the search continues at the end of that match, so occurrences never overlap.',
        'The fields are the text before the first occurrence, the text between consecutive occurrences, and the text after the last occurrence. Empty fields are kept.',
        'Return the first limit fields in order. Fields beyond limit are discarded; the last returned field is not extended with the remaining text.',
      ],
      boundaries: [
        'limit 0 returns [].',
        'Text that does not contain separator, including "", gives one field: [text]. So "" with limit >= 1 returns [""].',
        'A separator at the start or end of text, or two adjacent separators, produce empty fields.',
        'A limit larger than the number of fields returns all fields.',
      ],
      exceptions: [],
      example: { args: ['a,b,,c', ',', 3], expected: { kind: 'returned', value: ['a', 'b', ''] } },
    },
  },
  reference: splitLiteral,
  hooks: {
    isValidInput: isValidSplitLiteralInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // Branch 1 keeps the small alphabet (with regex metacharacters), short separators, and small limits so that
    // separators occur often. Branch 2 draws any ASCII text, any nonempty ASCII separator up to 8 characters, and
    // any limit in [0, 1000]. Every draw is valid (separator length >= 1), and shrinking stays inside each branch.
    inputArbitrary: fc.oneof(
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, splitCharacter),
        asciiStringOf(1, 3, splitCharacter),
        fc.integer({ min: 0, max: MAX_TEXT_LENGTH + 2 }),
      ),
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, 'binary-ascii'),
        asciiStringOf(1, MAX_SHORT_TEXT_LENGTH, 'binary-ascii'),
        fc.integer({ min: 0, max: INTEGER_LIMIT }),
      ),
    ),
  },
  baselineCases: [
    { args: ['a,b,,c', ',', 3], expected: { kind: 'returned', value: ['a', 'b', ''] } },
    { args: ['a,b', ',', 0], expected: { kind: 'returned', value: [] } },
    { args: ['', ',', 1], expected: { kind: 'returned', value: [''] } },
    { args: ['abc', ',', 5], expected: { kind: 'returned', value: ['abc'] } },
    { args: ['a,b', ',', 10], expected: { kind: 'returned', value: ['a', 'b'] } },
    { args: [',a,', ',', 10], expected: { kind: 'returned', value: ['', 'a', ''] } },
    { args: ['aaa', 'aa', 10], expected: { kind: 'returned', value: ['', 'a'] } },
    { args: ['a.b', '.', 5], expected: { kind: 'returned', value: ['a', 'b'] } },
    { args: ['a,b,c', ',', 1], expected: { kind: 'returned', value: ['a'] } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: empty text with limit >= 1 returns one empty field. Fields past limit are discarded and the last returned field is not extended with the remainder. Matching is a literal, non-overlapping, left-to-right search. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: the generator mixes two equally weighted branches. Branch 1 keeps the draft bias (alphabet a, b, comma, dot, pipe; separator length 1..3; limit 0..66). Branch 2 spans the full domain: any ASCII text, any nonempty ASCII separator of length 1..8, and limit 0..1000. The full domain is now reachable; shrinking stays inside each branch. (For a text of at most 64 characters every limit above 65 returns the same fields as limit 65, but those limits are still in-domain and are generated.)',
    'Resolved, specVersion 1: baselines cover limit 0, the empty-text field, a missing separator, a limit past the field count, separators at both ends, non-overlapping "aa", a literal dot, and a limit that drops the tail. They were not thinned.',
  ],
};
