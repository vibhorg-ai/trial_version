import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const captureExceptionMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: captureExceptionMock,
}));

const ORIGINAL_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

describe('reportError', () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
  });

  it('is a no-op when NEXT_PUBLIC_SENTRY_DSN is not set', async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { reportError } = await import('../reportError');
    reportError(new Error('boom'));
    // Allow microtasks to flush in case the function did something async.
    await new Promise((r) => setTimeout(r, 0));
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('forwards the error to Sentry when DSN is configured', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/0';
    const { reportError } = await import('../reportError');
    const err = new Error('boom');
    reportError(err);
    // Wait for the dynamic import to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });
});
