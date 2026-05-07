import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({
  runs: { retrieve: mocks.retrieve },
}));

import {
  DEFAULT_CHILD_RUN_MAX_POLL_MS,
  DEFAULT_CHILD_RUN_POLL_INTERVAL_MS,
  pollRunUntilDone,
} from '../poll-run';

describe('pollRunUntilDone', () => {
  beforeEach(() => {
    mocks.retrieve.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns ok with output when the run is a success', async () => {
    mocks.retrieve.mockResolvedValueOnce({
      isCompleted: true,
      isSuccess: true,
      status: 'COMPLETED',
      output: { hello: 'world' },
    });

    const result = await pollRunUntilDone('run_x');
    expect(result).toEqual({ ok: true, output: { hello: 'world' } });
    expect(mocks.retrieve).toHaveBeenCalledWith('run_x');
    expect(DEFAULT_CHILD_RUN_POLL_INTERVAL_MS).toBeLessThanOrEqual(400);
    expect(DEFAULT_CHILD_RUN_MAX_POLL_MS).toBeGreaterThan(500 * 200);
  });

  it('forwards a custom poll interval between incomplete polls', async () => {
    vi.useFakeTimers();

    mocks.retrieve
      .mockResolvedValueOnce({
        isCompleted: false,
        status: 'EXECUTING',
      })
      .mockResolvedValueOnce({
        isCompleted: true,
        isSuccess: true,
        status: 'COMPLETED',
        output: null,
      });

    const resultPromise = pollRunUntilDone('run_x', { pollIntervalMs: 500 });
    expect(mocks.retrieve).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(mocks.retrieve).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.retrieve).toHaveBeenCalledTimes(2);
    const result = await resultPromise;
    expect(result).toEqual({ ok: true, output: null });
  });

  it('returns failure with error message when run failed', async () => {
    mocks.retrieve.mockResolvedValueOnce({
      isCompleted: true,
      isSuccess: false,
      status: 'FAILED',
      error: { message: 'task blew up', name: 'Error' },
    });

    const result = await pollRunUntilDone('run_x');
    expect(result).toEqual({
      ok: false,
      error: { message: 'task blew up', name: 'Error' },
    });
  });

  it('returns failure with status fallback when there is no error object', async () => {
    mocks.retrieve.mockResolvedValueOnce({
      isCompleted: true,
      isSuccess: false,
      status: 'CANCELED',
    });

    const result = await pollRunUntilDone('run_x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('CANCELED');
    }
  });

  it('returns timeout when run never completes within maxPollMs', async () => {
    vi.useFakeTimers();

    mocks.retrieve.mockResolvedValue({
      isCompleted: false,
      status: 'EXECUTING',
    });

    const resultPromise = pollRunUntilDone('run_x', {
      pollIntervalMs: 100,
      maxPollMs: 250,
    });

    await vi.advanceTimersByTimeAsync(400);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Timed out');
      expect(result.error.message).toContain('run_x');
    }
    expect(mocks.retrieve.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
