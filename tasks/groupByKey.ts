import fc from 'fast-check';
import {
  INTEGER_LIMIT,
  MAX_ARRAY_LENGTH,
  arrayUpTo,
  asciiStringOf,
  integerIn,
  isArgumentList,
  isArrayOf,
  isAsciiString,
  isIntegerInRange,
  isPlainRecordWithKeys,
} from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** Long enough for keys such as "__proto__", "constructor", and "hasOwnProperty". */
export const MAX_GROUP_KEY_LENGTH = 16;

export interface KeyedItem {
  readonly key: string;
  readonly value: number;
}

export interface Group {
  readonly key: string;
  readonly items: KeyedItem[];
}

/**
 * Groups items by key. Groups appear in the order their keys are first seen; items keep their input order within
 * each group. Any string is an ordinary key, including "__proto__" and "constructor".
 *
 * @param items - Items to group. Neither the array nor its objects are modified.
 * @returns One `{ key, items }` group per distinct key, containing new `{ key, value }` objects.
 * @example groupByKey([{ key: 'b', value: 1 }, { key: 'a', value: 2 }, { key: 'b', value: 3 }]);
 *   // [{ key: 'b', items: [{ key: 'b', value: 1 }, { key: 'b', value: 3 }] }, { key: 'a', items: [{ key: 'a', value: 2 }] }]
 */
export function groupByKey(items: readonly KeyedItem[]): Group[] {
  const itemsByKey = new Map<string, KeyedItem[]>();
  for (const item of items) {
    const copy = { key: item.key, value: item.value };
    const group = itemsByKey.get(item.key);
    if (group === undefined) {
      itemsByKey.set(item.key, [copy]);
    } else {
      group.push(copy);
    }
  }
  return Array.from(itemsByKey, ([key, groupItems]) => ({ key, items: groupItems }));
}

type GroupByKeyArgs = [items: readonly KeyedItem[]];

function isKeyedItem(value: unknown): value is KeyedItem {
  return (
    isPlainRecordWithKeys(value, ['key', 'value']) &&
    isAsciiString(value.key, 0, MAX_GROUP_KEY_LENGTH) &&
    isIntegerInRange(value.value, -INTEGER_LIMIT, INTEGER_LIMIT)
  );
}

/**
 * Keys are an equally weighted mix of (1) named keys that repeat often, including keys that break plain-object
 * maps, (2) printable ASCII, and (3) binary-ascii (every ASCII character U+0000..U+007F, controls included).
 * Together these reach the full key domain of 0..16 ASCII characters; shrinking stays inside each branch.
 */
const groupKey = fc.oneof(
  fc.constantFrom('a', 'b', '', '__proto__', 'constructor', 'toString', 'hasOwnProperty'),
  asciiStringOf(0, MAX_GROUP_KEY_LENGTH, 'grapheme-ascii'),
  asciiStringOf(0, MAX_GROUP_KEY_LENGTH, 'binary-ascii'),
);
const keyedItem = fc.record({ key: groupKey, value: integerIn() }, { noNullPrototype: true });

export const groupByKeyTask: TaskDefinition<GroupByKeyArgs, Group[]> = {
  spec: {
    id: 'groupByKey',
    specVersion: 1,
    functionName: 'groupByKey',
    signature: 'function groupByKey(items: readonly KeyedItem[]): Group[]',
    supportingTypes: [
      'interface KeyedItem { key: string; value: number }',
      'interface Group { key: string; items: KeyedItem[] }',
    ],
    description: 'Group items by key, preserving first-seen group order and the order of items within each group.',
    contract: {
      validInputs: [
        `items: an array of 0 to ${MAX_ARRAY_LENGTH} plain objects, each with exactly the properties key (an ASCII string of 0 to ${MAX_GROUP_KEY_LENGTH} characters) and value (an integer in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}]).`,
        'Any key string is allowed, including "", "__proto__", "constructor", "toString", and "hasOwnProperty".',
      ],
      expectedOutput: [
        'Return one group { key, items } per distinct key, ordered by the first appearance of that key in items.',
        'A group\'s items are all input items with that key, in input order, as { key, value } objects equal to the input items.',
        'Every input item appears in exactly one group. The input array and its objects are not modified.',
      ],
      boundaries: [
        '[] returns [].',
        'Items that all share one key give exactly one group.',
        'Keys such as "__proto__" and "constructor" behave like any other key: they are neither lost nor merged with other keys.',
        'The empty string is a valid key, distinct from every other key.',
      ],
      exceptions: [],
      example: {
        args: [
          [
            { key: 'b', value: 1 },
            { key: 'a', value: 2 },
            { key: 'b', value: 3 },
          ],
        ],
        expected: {
          kind: 'returned',
          value: [
            { key: 'b', items: [{ key: 'b', value: 1 }, { key: 'b', value: 3 }] },
            { key: 'a', items: [{ key: 'a', value: 2 }] },
          ],
        },
      },
    },
  },
  reference: groupByKey,
  hooks: {
    isValidInput: (args: unknown): args is GroupByKeyArgs =>
      isArgumentList(args, 1) && isArrayOf(args[0], MAX_ARRAY_LENGTH, isKeyedItem),
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain. Keys are the named special strings,
    // printable ASCII, or binary-ascii (controls included), length 0..16. noNullPrototype keeps Object.prototype, which the validator accepts.
    inputArbitrary: fc.tuple(arrayUpTo(keyedItem, MAX_ARRAY_LENGTH)),
  },
  baselineCases: [
    {
      args: [
        [
          { key: 'b', value: 1 },
          { key: 'a', value: 2 },
          { key: 'b', value: 3 },
        ],
      ],
      expected: {
        kind: 'returned',
        value: [
          { key: 'b', items: [{ key: 'b', value: 1 }, { key: 'b', value: 3 }] },
          { key: 'a', items: [{ key: 'a', value: 2 }] },
        ],
      },
    },
    { args: [[]], expected: { kind: 'returned', value: [] } },
    {
      args: [[{ key: 'a', value: 1 }, { key: 'a', value: 2 }]],
      expected: { kind: 'returned', value: [{ key: 'a', items: [{ key: 'a', value: 1 }, { key: 'a', value: 2 }] }] },
    },
    {
      args: [
        [
          { key: '__proto__', value: 1 },
          { key: 'a', value: 2 },
          { key: '__proto__', value: 3 },
        ],
      ],
      expected: {
        kind: 'returned',
        value: [
          { key: '__proto__', items: [{ key: '__proto__', value: 1 }, { key: '__proto__', value: 3 }] },
          { key: 'a', items: [{ key: 'a', value: 2 }] },
        ],
      },
    },
    {
      args: [[{ key: 'constructor', value: 1 }]],
      expected: { kind: 'returned', value: [{ key: 'constructor', items: [{ key: 'constructor', value: 1 }] }] },
    },
    {
      args: [[{ key: '', value: 4 }, { key: 'a', value: 5 }]],
      expected: {
        kind: 'returned',
        value: [
          { key: '', items: [{ key: '', value: 4 }] },
          { key: 'a', items: [{ key: 'a', value: 5 }] },
        ],
      },
    },
    {
      args: [[{ key: 'toString', value: 1 }, { key: 'hasOwnProperty', value: 2 }]],
      expected: {
        kind: 'returned',
        value: [
          { key: 'toString', items: [{ key: 'toString', value: 1 }] },
          { key: 'hasOwnProperty', items: [{ key: 'hasOwnProperty', value: 2 }] },
        ],
      },
    },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: keys may be 16 characters so the named prototype-sensitive strings fit. Output items are structural copies; object identity is not required. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: the special-key bias and printable ASCII are now joined by a binary-ascii branch (equal weight), so control characters and every other ASCII key of length 0..16 are generated. The full key domain is now reachable; shrinking stays inside each branch.',
    'Remaining limitation, sampling.v1 (not a contract change): the validator also accepts items whose object has a null prototype, but neither method generates them. fast-check record() uses noNullPrototype, and more fundamentally the harness clones every input with structuredClone before executing it, which produces an Object.prototype object and does not preserve a null prototype. Null-prototype inputs therefore cannot be exercised reliably and are documented as excluded rather than silently claimed covered.',
    'Resolved, specVersion 1: baselines cover first-seen order, an empty list, a single key, "__proto__", "constructor", the empty string, and "toString" distinct from "hasOwnProperty". They were not thinned.',
  ],
};
