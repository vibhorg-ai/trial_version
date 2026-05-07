import { runs } from '@trigger.dev/sdk';

/**
 * Result returned by {@link pollRunUntilDone}, mirroring `tasks.triggerAndWait`
 * so the orchestrator's call site stays close to the original implementation.
 *
 * We use plain {@link tasks.trigger} + this poll helper instead of
 * `tasks.triggerAndWait` because Trigger.dev v4 forbids parallel waits within
 * a single parent run (firing two `triggerAndWait`s in parallel emits a
 * "Parallel waits are not supported" warning and stalls one of them). Polling
 * the public Runs API does not use the wait checkpoint mechanism, so any
 * number of fire-and-poll children can run truly concurrently from a single
 * orchestrator process.
 *
 * Note: `@trigger.dev/sdk`'s `runs.poll` caps attempts at 500 regardless of
 * interval (~100s at 200ms), which is shorter than worst-case Gemini retries.
 * This module uses `runs.retrieve` in a loop with a generous wall-clock budget.
 */
export type PollRunResult<T> =
  | { ok: true; output: T }
  | { ok: false; error: { message: string; name?: string } };

export interface PollRunOptions {
  /** Sleep between polls in ms. */
  pollIntervalMs?: number;
  /**
   * Max wall-clock time to wait for the child run (ms).
   * Override via env `TRIGGER_CHILD_POLL_MAX_MS` when unset here.
   */
  maxPollMs?: number;
}

/** Default interval for awaiting child runs. Tight enough to keep tail latency low after each Trigger task completes; `runs.retrieve` is a cheap GET so 200ms is comfortable. */
export const DEFAULT_CHILD_RUN_POLL_INTERVAL_MS = 200;

/** Aligns with long-running children (Gemini multi-model + 429 backoff, crop + upload). */
export const DEFAULT_CHILD_RUN_MAX_POLL_MS = 45 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMaxPollMs(opts: PollRunOptions): number {
  if (opts.maxPollMs != null && opts.maxPollMs > 0) {
    return opts.maxPollMs;
  }
  const raw = process.env.TRIGGER_CHILD_POLL_MAX_MS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return DEFAULT_CHILD_RUN_MAX_POLL_MS;
}

/**
 * Awaits a Trigger.dev child run by polling its status via the public Runs API.
 * Returns a {@link PollRunResult} discriminated union to keep the call site
 * shape identical in spirit to `tasks.triggerAndWait`.
 */
export async function pollRunUntilDone<T = unknown>(
  runId: string,
  opts: PollRunOptions = {},
): Promise<PollRunResult<T>> {
  const interval = opts.pollIntervalMs ?? DEFAULT_CHILD_RUN_POLL_INTERVAL_MS;
  const maxPollMs = resolveMaxPollMs(opts);
  /** Wall-clock budget via sleep count (works under Vitest fake timers without mocking Date). */
  const maxSleeps = Math.max(0, Math.ceil(maxPollMs / interval));
  let sleepsDone = 0;

  for (;;) {
    const run = await runs.retrieve(runId);
    if (run.isCompleted) {
      if (run.isSuccess) {
        return { ok: true, output: run.output as T };
      }
      const errMsg = run.error?.message ?? `Run ended with status ${run.status}`;
      return {
        ok: false,
        error: {
          message: errMsg,
          name: run.error?.name,
        },
      };
    }
    if (sleepsDone >= maxSleeps) {
      break;
    }
    await sleep(interval);
    sleepsDone += 1;
  }

  return {
    ok: false,
    error: {
      message: `Timed out after ~${maxPollMs}ms (${maxSleeps} poll intervals) waiting for Trigger run ${runId}. Long-running steps (e.g. Gemini quota retries) need a higher budget — set TRIGGER_CHILD_POLL_MAX_MS or pass maxPollMs.`,
    },
  };
}
