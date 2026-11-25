import fc from 'fast-check';
import { MAX_SHORT_TEXT_LENGTH, MAX_TEXT_LENGTH, asciiStringOf, isArgumentList, isAsciiString, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Shortens text to at most `maxLength` characters. Text that fits is returned unchanged. Longer text is cut so
 * that it ends with `suffix`; if the suffix alone does not fit, the suffix itself is cut to `maxLength`.
 *
 * @param text - ASCII text of at most 64 characters.
 * @param maxLength - Integer limit in [0, 64].
 * @param suffix - ASCII marker of at most 8 characters, possibly empty.
 * @returns A string of at most `maxLength` characters.
 * @example truncateText('hello world', 8, '...'); // 'hello...'
 */
export function truncateText(text: string, maxLength: number, suffix: string): string {
  if (text.length <= maxLength) {
    return text;
  }
  if (suffix.length >= maxLength) {
    return suffix.slice(0, maxLength);
  }
  return text.slice(0, maxLength - suffix.length) + suffix;
}

type TruncateTextArgs = [text: string, maxLength: number, suffix: string];

function isValidTruncateTextInput(args: unknown): args is TruncateTextArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [text, maxLength, suffix] = args;
  return (
    isAsciiString(text, 0, MAX_TEXT_LENGTH) &&
    isIntegerInRange(maxLength, 0, MAX_TEXT_LENGTH) &&
    isAsciiString(suffix, 0, MAX_SHORT_TEXT_LENGTH)
  );
}

export const truncateTextTask: TaskDefinition<TruncateTextArgs, string> = {
  spec: {
    id: 'truncateText',
    specVersion: 1,
    functionName: 'truncateText',
    signature: 'function truncateText(text: string, maxLength: number, suffix: string): string',
    supportingTypes: [],
    description: 'Shorten text to at most maxLength characters, ending shortened text with a suffix.',
    contract: {
      validInputs: [
        `text: an ASCII string of 0 to ${MAX_TEXT_LENGTH} characters.`,
        `maxLength: an integer in [0, ${MAX_TEXT_LENGTH}].`,
        `suffix: an ASCII string of 0 to ${MAX_SHORT_TEXT_LENGTH} characters (it may be empty).`,
      ],
      expectedOutput: [
        'If text.length <= maxLength, return text unchanged, without a suffix.',
        'Otherwise, if suffix.length < maxLength, return the first (maxLength - suffix.length) characters of text followed by suffix.',
        'Otherwise (suffix.length >= maxLength), return the first maxLength characters of suffix and no characters of text.',
        'The result never exceeds maxLength characters; a shortened result has exactly maxLength characters.',
      ],
      boundaries: [
        'maxLength 0 always returns "".',
        'Text whose length equals maxLength fits and is returned unchanged.',
        'If text is too long and suffix.length equals maxLength, the result is exactly suffix.',
        'An empty suffix gives plain truncation to maxLength characters.',
      ],
      exceptions: [],
      example: { args: ['hello world', 8, '...'], expected: { kind: 'returned', value: 'hello...' } },
    },
  },
  reference: truncateText,
  hooks: {
    isValidInput: isValidTruncateTextInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // Branch 1 keeps the printable-ASCII bias so counterexamples stay readable; branch 2 covers every ASCII
    // character U+0000..U+007F (controls included) in both string arguments. maxLength already uses 0..64.
    // Each branch produces only valid argument lists, and shrinking stays inside its string unit and integer bounds.
    inputArbitrary: fc.oneof(
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, 'grapheme-ascii'),
        fc.integer({ min: 0, max: MAX_TEXT_LENGTH }),
        asciiStringOf(0, MAX_SHORT_TEXT_LENGTH, 'grapheme-ascii'),
      ),
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, 'binary-ascii'),
        fc.integer({ min: 0, max: MAX_TEXT_LENGTH }),
        asciiStringOf(0, MAX_SHORT_TEXT_LENGTH, 'binary-ascii'),
      ),
    ),
  },
  baselineCases: [
    { args: ['hello world', 8, '...'], expected: { kind: 'returned', value: 'hello...' } },
    { args: ['hello', 0, '...'], expected: { kind: 'returned', value: '' } },
    { args: ['hello', 5, '...'], expected: { kind: 'returned', value: 'hello' } },
    { args: ['hello', 3, '...'], expected: { kind: 'returned', value: '...' } },
    { args: ['hello', 2, '...'], expected: { kind: 'returned', value: '..' } },
    { args: ['hello world', 5, ''], expected: { kind: 'returned', value: 'hello' } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: an empty suffix is plain truncation. When the suffix length equals maxLength, cutting the suffix and keeping no text characters are the same string, so that boundary is unambiguous.',
    'Resolved, specVersion 1: lengths count UTF-16 code units. For ASCII text that is the character count. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: the generator now mixes two equally weighted branches, printable-ASCII (bias) and binary-ascii (full U+0000..U+007F including controls), for both the text and the suffix. maxLength already covered 0..64. The full ASCII domain is now reachable; shrinking stays inside each branch.',
    'Resolved, specVersion 1: baselines cover the ordinary shorten, maxLength 0, an exact fit, suffix length equal to maxLength, suffix length greater than maxLength, and an empty suffix. They were not thinned.',
  ],
};
