import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poll: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({
  runs: { poll: mocks.poll },
}));

import { DEFAULT_CHILD_RUN_POLL_INTERVAL_MS, pollRunUntilDone } from '../poll-run';

describe('pollRunUntilDone', () => {
  beforeEach(() => {
    mocks.poll.mockReset();
  });

  it('returns ok with output when the run is a success', async () => {
    mocks.poll.mockResolvedValueOnce({
      isSuccess: true,
      status: 'COMPLETED',
      output: { hello: 'world' },
    });

    const result = await pollRunUntilDone('run_x');
    expect(result).toEqual({ ok: true, output: { hello: 'world' } });
    expect(mocks.poll).toHaveBeenCalledWith('run_x', {
      pollIntervalMs: DEFAULT_CHILD_RUN_POLL_INTERVAL_MS,
    });
    expect(DEFAULT_CHILD_RUN_POLL_INTERVAL_MS).toBeLessThanOrEqual(400);
  });

  it('forwards a custom poll interval', async () => {
    mocks.poll.mockResolvedValueOnce({
      isSuccess: true,
      status: 'COMPLETED',
      output: null,
    });
    await pollRunUntilDone('run_x', { pollIntervalMs: 500 });
    expect(mocks.poll).toHaveBeenCalledWith('run_x', { pollIntervalMs: 500 });
  });

  it('returns failure with error message when run failed', async () => {
    mocks.poll.mockResolvedValueOnce({
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
    mocks.poll.mockResolvedValueOnce({
      isSuccess: false,
      status: 'CANCELED',
    });

    const result = await pollRunUntilDone('run_x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('CANCELED');
    }
  });
});
