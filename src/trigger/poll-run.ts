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
 */
export type PollRunResult<T> =
  | { ok: true; output: T }
  | { ok: false; error: { message: string; name?: string } };

export interface PollRunOptions {
  /** Sleep between polls in ms. Forwarded to `runs.poll`. */
  pollIntervalMs?: number;
}

/** Default interval for awaiting child runs — tighter than 1s reduces tail latency once each Trigger task completes. */
export const DEFAULT_CHILD_RUN_POLL_INTERVAL_MS = 400;

/**
 * Awaits a Trigger.dev child run by polling its status via the public Runs API.
 * Returns a {@link PollRunResult} discriminated union to keep the call site
 * shape identical in spirit to `tasks.triggerAndWait`.
 */
export async function pollRunUntilDone<T = unknown>(
  runId: string,
  opts: PollRunOptions = {},
): Promise<PollRunResult<T>> {
  const r = await runs.poll(runId, {
    pollIntervalMs: opts.pollIntervalMs ?? DEFAULT_CHILD_RUN_POLL_INTERVAL_MS,
  });

  if (r.isSuccess) {
    return { ok: true, output: r.output as T };
  }

  const errMsg = r.error?.message ?? `Run ended with status ${r.status}`;
  return {
    ok: false,
    error: {
      message: errMsg,
      name: r.error?.name,
    },
  };
}
