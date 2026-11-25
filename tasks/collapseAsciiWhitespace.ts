import fc from 'fast-check';
import { MAX_TEXT_LENGTH, asciiStringOf, charFrom, isArgumentList, isAsciiString } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** A run of the four characters this task treats as whitespace: space, tab, carriage return, line feed. */
const ASCII_WHITESPACE_RUN = /[ \t\r\n]+/;

/**
 * Collapses each run of ASCII whitespace (space, tab, carriage return, line feed) into one space and removes
 * such whitespace from both ends. All other characters, including vertical tab and form feed, are kept.
 *
 * @param text - ASCII text of at most 64 characters.
 * @returns The collapsed text; "" when `text` is empty or contains only whitespace.
 * @example collapseAsciiWhitespace('  a\t\tb\r\n c '); // 'a b c'
 */
export function collapseAsciiWhitespace(text: string): string {
  return text
    .split(ASCII_WHITESPACE_RUN)
    .filter((word) => word.length > 0)
    .join(' ');
}

type CollapseAsciiWhitespaceArgs = [text: string];

export const collapseAsciiWhitespaceTask: TaskDefinition<CollapseAsciiWhitespaceArgs, string> = {
  spec: {
    id: 'collapseAsciiWhitespace',
    specVersion: 1,
    functionName: 'collapseAsciiWhitespace',
    signature: 'function collapseAsciiWhitespace(text: string): string',
    supportingTypes: [],
    description: 'Collapse every run of ASCII whitespace into a single space and remove whitespace at both ends.',
    contract: {
      validInputs: [`text: an ASCII string of 0 to ${MAX_TEXT_LENGTH} characters.`],
      expectedOutput: [
        'Whitespace means exactly four characters: space (U+0020), tab (U+0009), carriage return (U+000D), and line feed (U+000A).',
        'Every maximal run of whitespace between two non-whitespace characters becomes one space (U+0020).',
        'Whitespace at the start and at the end is removed entirely.',
        'All other characters are kept unchanged and in their original order.',
      ],
      boundaries: [
        'Empty text, and text containing only whitespace, return "".',
        'Vertical tab (U+000B), form feed (U+000C), and all other control characters are not whitespace here; they are kept as ordinary characters.',
      ],
      exceptions: [],
      example: { args: ['  a\t\tb\r\n c '], expected: { kind: 'returned', value: 'a b c' } },
    },
  },
  reference: collapseAsciiWhitespace,
  hooks: {
    isValidInput: (args: unknown): args is CollapseAsciiWhitespaceArgs =>
      isArgumentList(args, 1) && isAsciiString(args[0], 0, MAX_TEXT_LENGTH),
    // Reviewed for specVersion 1. Equal weight: a whitespace-heavy alphabet that includes VT and FF, or any ASCII character. Both stay inside 0..64.
    inputArbitrary: fc.tuple(
      fc.oneof(
        asciiStringOf(0, MAX_TEXT_LENGTH, charFrom(' ', '\t', '\r', '\n', '\v', '\f', 'a', 'b')),
        asciiStringOf(0, MAX_TEXT_LENGTH),
      ),
    ),
  },
  baselineCases: [
    { args: ['  a\t\tb\r\n c '], expected: { kind: 'returned', value: 'a b c' } },
    { args: [''], expected: { kind: 'returned', value: '' } },
    { args: [' \t\r\n'], expected: { kind: 'returned', value: '' } },
    { args: ['abc'], expected: { kind: 'returned', value: 'abc' } },
    { args: ['a b c'], expected: { kind: 'returned', value: 'a b c' } },
    { args: ['a\v\fb \f c'], expected: { kind: 'returned', value: 'a\v\fb \f c' } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: vertical tab and form feed stay ordinary characters. The written contract already says so, and the reference splits only on space, tab, CR, and LF. No contract text was changed.',
    'Resolved, specVersion 1: the domain remains every ASCII character, controls included. The arbitrary still draws half of its strings from a small alphabet that contains the four whitespace characters plus VT and FF, and half from binary-ascii. That bias was kept.',
    'Resolved, specVersion 1: baselines cover empty text, whitespace-only text, text with no whitespace, an already-single space, a mixed whitespace run, and a string that keeps VT and FF. They were not thinned so that a trim-based implementation would pass.',
  ],
};
