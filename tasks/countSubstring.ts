import fc from 'fast-check';
import { MAX_SHORT_TEXT_LENGTH, MAX_TEXT_LENGTH, asciiStringOf, charFrom, isArgumentList, isAsciiString } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/**
 * Counts occurrences of a nonempty needle in text. With `allowOverlap`, every start position counts; without it,
 * matches are taken greedily from left to right and the search resumes after the end of each match.
 *
 * @param text - ASCII text of at most 64 characters.
 * @param needle - Nonempty ASCII string of at most 8 characters, matched exactly (case-sensitive).
 * @param allowOverlap - Whether matches may share characters.
 * @returns The number of matches, 0 or more.
 * @example countSubstring('aaaa', 'aa', true); // 3 (and 2 when allowOverlap is false)
 */
export function countSubstring(text: string, needle: string, allowOverlap: boolean): number {
  const step = allowOverlap ? 1 : needle.length;
  let count = 0;
  let matchIndex = text.indexOf(needle);
  while (matchIndex !== -1) {
    count += 1;
    matchIndex = text.indexOf(needle, matchIndex + step);
  }
  return count;
}

type CountSubstringArgs = [text: string, needle: string, allowOverlap: boolean];

function isValidCountSubstringInput(args: unknown): args is CountSubstringArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [text, needle, allowOverlap] = args;
  return (
    isAsciiString(text, 0, MAX_TEXT_LENGTH) &&
    isAsciiString(needle, 1, MAX_SHORT_TEXT_LENGTH) &&
    typeof allowOverlap === 'boolean'
  );
}

export const countSubstringTask: TaskDefinition<CountSubstringArgs, number> = {
  spec: {
    id: 'countSubstring',
    specVersion: 1,
    functionName: 'countSubstring',
    signature: 'function countSubstring(text: string, needle: string, allowOverlap: boolean): number',
    supportingTypes: [],
    description: 'Count occurrences of a nonempty needle in text, either allowing overlapping matches or not.',
    contract: {
      validInputs: [
        `text: an ASCII string of 0 to ${MAX_TEXT_LENGTH} characters.`,
        `needle: an ASCII string of 1 to ${MAX_SHORT_TEXT_LENGTH} characters.`,
        'allowOverlap: a boolean.',
      ],
      expectedOutput: [
        'Matching is exact and case-sensitive.',
        'allowOverlap true: return the number of indices i at which text contains needle starting at i.',
        'allowOverlap false: scan from left to right; count the leftmost match, then continue searching at the index just after that match ends.',
      ],
      boundaries: [
        'A needle longer than text, and empty text, give 0.',
        'A needle equal to text gives 1.',
        'countSubstring("aaaa", "aa", false) is 2, while the overlapping count is 3.',
      ],
      exceptions: [],
      example: { args: ['aaaa', 'aa', true], expected: { kind: 'returned', value: 3 } },
    },
  },
  reference: countSubstring,
  hooks: {
    isValidInput: isValidCountSubstringInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // Branch 1 keeps the {a, b} alphabet and needle length 1..4 so overlapping matches stay common. Branch 2 draws
    // any ASCII text and any nonempty ASCII needle up to 8 characters. Every draw is valid (needle length >= 1),
    // and shrinking stays inside each branch.
    inputArbitrary: fc.oneof(
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, charFrom('a', 'b')),
        asciiStringOf(1, 4, charFrom('a', 'b')),
        fc.boolean(),
      ),
      fc.tuple(
        asciiStringOf(0, MAX_TEXT_LENGTH, 'binary-ascii'),
        asciiStringOf(1, MAX_SHORT_TEXT_LENGTH, 'binary-ascii'),
        fc.boolean(),
      ),
    ),
  },
  baselineCases: [
    { args: ['aaaa', 'aa', true], expected: { kind: 'returned', value: 3 } },
    { args: ['aaaa', 'aa', false], expected: { kind: 'returned', value: 2 } },
    { args: ['', 'a', true], expected: { kind: 'returned', value: 0 } },
    { args: ['ab', 'abcd', false], expected: { kind: 'returned', value: 0 } },
    { args: ['abc', 'abc', true], expected: { kind: 'returned', value: 1 } },
    { args: ['abcabc', 'abc', false], expected: { kind: 'returned', value: 2 } },
    { args: ['aaa', 'aa', true], expected: { kind: 'returned', value: 2 } },
    { args: ['AaA', 'A', false], expected: { kind: 'returned', value: 2 } },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: allowOverlap false is the greedy left-to-right scan in the contract. Matches of one needle have equal length, so that scan also counts the maximum number of disjoint matches. The two readings cannot disagree. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: the generator mixes two equally weighted branches. Branch 1 keeps the two-letter alphabet with needle length 1..4. Branch 2 spans the full domain: any ASCII text and any nonempty ASCII needle of length 1..8. The full domain is now reachable; shrinking stays inside each branch.',
    'Resolved, specVersion 1: baselines cover overlapping and non-overlapping counts, empty text, a needle longer than the text, a needle equal to the text, a repeated non-overlapping needle, and case sensitivity. They were not thinned.',
  ],
};
