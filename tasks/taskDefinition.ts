import type { Arbitrary } from 'fast-check';

/** What a correct implementation does on one input: return a value, or throw an error with a given `name`. */
export type ExpectedOutcome<Result> =
  | { readonly kind: 'returned'; readonly value: Result }
  | { readonly kind: 'threw'; readonly errorName: string };

/** One concrete input with its expected outcome. Used for contract examples and for baseline cases. */
export interface TaskCase<Args extends readonly unknown[], Result> {
  readonly args: Args;
  readonly expected: ExpectedOutcome<Result>;
}

/**
 * The behavioural contract of a task. Every statement is public and may be shown to a model.
 * Inputs outside `validInputs` are never generated, compared, or reported.
 */
export interface TaskContract<Args extends readonly unknown[], Result> {
  /** The valid input domain, with exact bounds. */
  readonly validInputs: readonly string[];
  /** The required result for every valid input. */
  readonly expectedOutput: readonly string[];
  /** Boundary cases, stated explicitly. */
  readonly boundaries: readonly string[];
  /** Exceptions a correct implementation throws on valid inputs. Empty means it never throws. */
  readonly exceptions: readonly string[];
  /** One illustrative call. The test suite checks that the reference agrees with it. */
  readonly example: TaskCase<Args, Result>;
}

/** Everything about a task that may be shown to a model. Reference source code never goes here. */
export interface TaskSpec<Args extends readonly unknown[], Result> {
  /** Stable task identifier; always equal to `functionName`. */
  readonly id: string;
  /**
   * Version of the public contract. `0` means it has not been frozen for research generation.
   * Increment it when the public contract changes. Saved candidates stay tied to the version that was sent.
   */
  readonly specVersion: number;
  readonly functionName: string;
  /** TypeScript signature. Candidates are written in plain JavaScript; the types document the contract. */
  readonly signature: string;
  /** Declarations of supporting types named in the signature (empty if there are none). */
  readonly supportingTypes: readonly string[];
  readonly description: string;
  readonly contract: TaskContract<Args, Result>;
}

/** Marks a hook that has not been written. A task with an unfinished hook can never be run. */
export interface UnfinishedHook {
  readonly unfinished: true;
  /** What is missing, and what to consider when writing it. */
  readonly todo: string;
}

export function unfinished(todo: string): UnfinishedHook {
  return { unfinished: true, todo };
}

export function isUnfinished(hook: unknown): hook is UnfinishedHook {
  return typeof hook === 'object' && hook !== null && (hook as Partial<UnfinishedHook>).unfinished === true;
}

/** Shared marker for tasks whose baseline cases have not been written yet. */
export const BASELINE_CASES_TODO = unfinished(
  'Write the fixed baseline cases for this task before generating any candidate for it (docs/GETTING_STARTED.md, "Next steps").',
);

/** Returns true exactly when `args`, the whole argument list, lies inside the contract's valid input domain. */
export type InputValidator<Args extends readonly unknown[]> = (args: unknown) => args is Args;

export interface TaskHooks<Args extends readonly unknown[]> {
  /** Runtime check of the valid input domain. The differential check applies it to every input via `fc.pre`. */
  readonly isValidInput: InputValidator<Args> | UnfinishedHook;
  /** fast-check arbitrary for whole argument lists. It must only produce inputs that `isValidInput` accepts. */
  readonly inputArbitrary: Arbitrary<Args> | UnfinishedHook;
}

/**
 * - `connected`: the contract and baselines are frozen, and the validator and arbitrary have been reviewed.
 *   `requireRunnableTask` accepts the task. The batch pilot runner is still uniqueStable-only.
 * - `draft`: reference and contract are written; hooks are drafts or unfinished and have never been run.
 */
export type TaskStatus = 'connected' | 'draft';

export interface TaskDefinition<Args extends readonly unknown[], Result> {
  readonly spec: TaskSpec<Args, Result>;
  /** Trusted reference implementation. Its source must never appear in a prompt. */
  reference(...args: Args): Result;
  readonly hooks: TaskHooks<Args>;
  /** Example-based tests fixed before any candidate is generated: the "existing tests" a candidate may pass. */
  readonly baselineCases: readonly TaskCase<Args, Result>[] | UnfinishedHook;
  readonly status: TaskStatus;
  /** Decisions made while writing this contract that the researcher should confirm. Never shown to a model. */
  readonly reviewNotes: readonly string[];
}

/** Element type of the task registry, which holds tasks with different argument and result types. */
export type AnyTaskDefinition = TaskDefinition<readonly unknown[], unknown>;

/** A connected task with implemented hooks. Only these are accepted by the comparison helpers. */
export interface RunnableTask<Args extends readonly unknown[], Result> {
  readonly spec: TaskSpec<Args, Result>;
  reference(...args: Args): Result;
  readonly isValidInput: InputValidator<Args>;
  readonly inputArbitrary: Arbitrary<Args>;
}

/** Lists what stops a task from being runnable. An empty list means the task is runnable. */
export function notRunnableReasons<Args extends readonly unknown[], Result>(task: TaskDefinition<Args, Result>): string[] {
  const reasons: string[] = [];
  if (task.status !== 'connected') {
    reasons.push(`status is '${task.status}': review its hooks, then set status to 'connected'`);
  }
  if (isUnfinished(task.hooks.isValidInput)) {
    reasons.push(`isValidInput is unfinished: ${task.hooks.isValidInput.todo}`);
  }
  if (isUnfinished(task.hooks.inputArbitrary)) {
    reasons.push(`inputArbitrary is unfinished: ${task.hooks.inputArbitrary.todo}`);
  }
  return reasons;
}

/** Returns the task in runnable form, or throws an error explaining why it is not runnable yet. */
export function requireRunnableTask<Args extends readonly unknown[], Result>(
  task: TaskDefinition<Args, Result>,
): RunnableTask<Args, Result> {
  const { isValidInput, inputArbitrary } = task.hooks;
  if (task.status !== 'connected' || isUnfinished(isValidInput) || isUnfinished(inputArbitrary)) {
    const reasons = notRunnableReasons(task).map((reason) => `  - ${reason}`);
    throw new Error(`Task "${task.spec.id}" is not runnable yet:\n${reasons.join('\n')}`);
  }
  return { spec: task.spec, reference: task.reference, isValidInput, inputArbitrary };
}
