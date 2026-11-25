import { binarySearchFirstTask } from './binarySearchFirst.js';
import { ceilDivideTask } from './ceilDivide.js';
import { chunkArrayTask } from './chunkArray.js';
import { clampIntegerTask } from './clampInteger.js';
import { collapseAsciiWhitespaceTask } from './collapseAsciiWhitespace.js';
import { compareVersionTriplesTask } from './compareVersionTriples.js';
import { countSubstringTask } from './countSubstring.js';
import { divideWithEuclideanRemainderTask } from './divideWithEuclideanRemainder.js';
import { groupByKeyTask } from './groupByKey.js';
import { isGregorianLeapYearTask } from './isGregorianLeapYear.js';
import { mergeClosedIntervalsTask } from './mergeClosedIntervals.js';
import { paginateTask } from './paginate.js';
import { parseIntegerStrictTask } from './parseIntegerStrict.js';
import { rotateArrayTask } from './rotateArray.js';
import { splitLiteralTask } from './splitLiteral.js';
import { summarizeIntegersTask } from './summarizeIntegers.js';
import type { AnyTaskDefinition } from './taskDefinition.js';
import { truncateTextTask } from './truncateText.js';
import { uniqueStableTask } from './uniqueStable.js';

/** All 18 reference tasks, in the order of the corpus list. */
export const TASKS: readonly AnyTaskDefinition[] = [
  collapseAsciiWhitespaceTask,
  truncateTextTask,
  splitLiteralTask,
  countSubstringTask,
  parseIntegerStrictTask,
  compareVersionTriplesTask,
  uniqueStableTask,
  chunkArrayTask,
  rotateArrayTask,
  mergeClosedIntervalsTask,
  groupByKeyTask,
  paginateTask,
  clampIntegerTask,
  divideWithEuclideanRemainderTask,
  ceilDivideTask,
  summarizeIntegersTask,
  binarySearchFirstTask,
  isGregorianLeapYearTask,
];

export function getTask(id: string): AnyTaskDefinition {
  const task = TASKS.find((candidate) => candidate.spec.id === id);
  if (task === undefined) {
    throw new Error(`Unknown task "${id}". Known tasks: ${TASKS.map((known) => known.spec.id).join(', ')}`);
  }
  return task;
}
