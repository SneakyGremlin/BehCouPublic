import fc from 'fast-check';
import { INTEGER_LIMIT, MAX_ARRAY_LENGTH, arrayUpTo, integerIn, isArgumentList, isIntegerArray, isIntegerInRange } from './domain.js';
import type { TaskDefinition } from './taskDefinition.js';

/** One page of a collection, with metadata about the request and the whole collection. */
export interface Page<T> {
  readonly items: T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/**
 * Returns one page of values using one-based page numbers. The requested page number is echoed, never clamped.
 *
 * @param values - Integers to paginate. Not modified.
 * @param pageNumber - One-based page number, a positive integer.
 * @param pageSize - Positive integer number of items per page.
 * @returns The page's items (possibly none) and page/total metadata.
 * @example paginate([10, 20, 30, 40, 50], 3, 2);
 *   // { items: [50], pageNumber: 3, pageSize: 2, totalItems: 5, totalPages: 3 }
 */
export function paginate(values: readonly number[], pageNumber: number, pageSize: number): Page<number> {
  const firstIndex = (pageNumber - 1) * pageSize;
  return {
    items: values.slice(firstIndex, firstIndex + pageSize),
    pageNumber,
    pageSize,
    totalItems: values.length,
    totalPages: Math.ceil(values.length / pageSize),
  };
}

type PaginateArgs = [values: readonly number[], pageNumber: number, pageSize: number];

function isValidPaginateInput(args: unknown): args is PaginateArgs {
  if (!isArgumentList(args, 3)) {
    return false;
  }
  const [values, pageNumber, pageSize] = args;
  return (
    isIntegerArray(values, MAX_ARRAY_LENGTH, -INTEGER_LIMIT, INTEGER_LIMIT) &&
    isIntegerInRange(pageNumber, 1, INTEGER_LIMIT) &&
    isIntegerInRange(pageSize, 1, INTEGER_LIMIT)
  );
}

export const paginateTask: TaskDefinition<PaginateArgs, Page<number>> = {
  spec: {
    id: 'paginate',
    specVersion: 1,
    functionName: 'paginate',
    signature: 'function paginate(values: readonly number[], pageNumber: number, pageSize: number): Page<number>',
    supportingTypes: [
      'interface Page<T> { items: T[]; pageNumber: number; pageSize: number; totalItems: number; totalPages: number }',
    ],
    description: 'Return one page of values (one-based page numbers) together with page and total metadata.',
    contract: {
      validInputs: [
        `values: an array of 0 to ${MAX_ARRAY_LENGTH} integers, each in [-${INTEGER_LIMIT}, ${INTEGER_LIMIT}].`,
        `pageNumber: an integer in [1, ${INTEGER_LIMIT}] (one-based).`,
        `pageSize: an integer in [1, ${INTEGER_LIMIT}].`,
      ],
      expectedOutput: [
        'Return an object with exactly the properties items, pageNumber, pageSize, totalItems, and totalPages.',
        'items: the elements of values at indices from (pageNumber - 1) * pageSize up to but excluding pageNumber * pageSize that exist, in order.',
        'pageNumber and pageSize: the requested values, unchanged (the page number is never clamped).',
        'totalItems: values.length. totalPages: ceil(totalItems / pageSize), which is 0 when values is empty.',
      ],
      boundaries: [
        'A page number beyond the last page returns items [] while still reporting the requested pageNumber and the totals.',
        'Empty values give items [], totalItems 0, and totalPages 0 for every page number.',
        'The last page may hold fewer than pageSize items.',
      ],
      exceptions: [],
      example: {
        args: [[10, 20, 30, 40, 50], 3, 2],
        expected: { kind: 'returned', value: { items: [50], pageNumber: 3, pageSize: 2, totalItems: 5, totalPages: 3 } },
      },
    },
  },
  reference: paginate,
  hooks: {
    isValidInput: isValidPaginateInput,
    // Reviewed for specVersion 1; sampling.v1 spans the full contract domain.
    // The value array already covers the full integer domain with length 0..32. pageNumber and pageSize each mix an
    // equally weighted 1..12 bias (so short pages and pages past the end stay common) with the full 1..1000 range.
    // Every draw is valid; shrinking stays inside the chosen branch.
    inputArbitrary: fc.tuple(
      arrayUpTo(integerIn(), MAX_ARRAY_LENGTH),
      fc.oneof(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: INTEGER_LIMIT })),
      fc.oneof(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: INTEGER_LIMIT })),
    ),
  },
  baselineCases: [
    {
      args: [[10, 20, 30, 40, 50], 3, 2],
      expected: { kind: 'returned', value: { items: [50], pageNumber: 3, pageSize: 2, totalItems: 5, totalPages: 3 } },
    },
    {
      args: [[10, 20, 30, 40, 50], 1, 2],
      expected: { kind: 'returned', value: { items: [10, 20], pageNumber: 1, pageSize: 2, totalItems: 5, totalPages: 3 } },
    },
    {
      args: [[10, 20, 30, 40, 50], 4, 2],
      expected: { kind: 'returned', value: { items: [], pageNumber: 4, pageSize: 2, totalItems: 5, totalPages: 3 } },
    },
    {
      args: [[], 1, 10],
      expected: { kind: 'returned', value: { items: [], pageNumber: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
    },
    {
      args: [[], 3, 2],
      expected: { kind: 'returned', value: { items: [], pageNumber: 3, pageSize: 2, totalItems: 0, totalPages: 0 } },
    },
    {
      args: [[1, 2, 3], 1, 10],
      expected: { kind: 'returned', value: { items: [1, 2, 3], pageNumber: 1, pageSize: 10, totalItems: 3, totalPages: 1 } },
    },
    {
      args: [[1, 2, 3, 4], 2, 2],
      expected: { kind: 'returned', value: { items: [3, 4], pageNumber: 2, pageSize: 2, totalItems: 4, totalPages: 2 } },
    },
  ],
  status: 'connected',
  reviewNotes: [
    'Resolved, specVersion 1: the result has exactly items, pageNumber, pageSize, totalItems, and totalPages. There is no hasNext or hasPrevious. An extra key disagrees under the structural comparison. pageNumber is echoed, and an empty collection has totalPages 0. No contract text was changed.',
    'Resolved, specVersion 1; sampling.v1: values use the full integer array domain. pageNumber and pageSize now each mix the 1..12 bias (page 12 already lands past the last page for these array lengths) with the full 1..1000 range, equally weighted. The full page-number and page-size domain is now reachable; shrinking stays inside the chosen branch.',
    'Resolved, specVersion 1: baselines cover a short last page, the first page, a page past the end, an empty collection at page 1 and at a later page, a page size larger than the collection, and an exact fit. They were not thinned.',
  ],
};
