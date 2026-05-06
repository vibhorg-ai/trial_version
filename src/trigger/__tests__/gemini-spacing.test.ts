import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// orchestrator imports prisma + trigger SDK at module load — mock both so the
// import succeeds in a unit-test environment without a running DB or worker.
vi.mock('@trigger.dev/sdk', () => ({
  task: (opts: { id: string; run: (p: unknown, c: unknown) => Promise<void> }) => opts,
  tasks: { trigger: vi.fn() },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    workflowRun: { findUnique: vi.fn(), update: vi.fn() },
    nodeRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../poll-run', () => ({
  pollRunUntilDone: vi.fn(),
}));

import { __resetGeminiSpacingForTests, nextGeminiSlot } from '../orchestrator';

describe('nextGeminiSlot', () => {
  beforeEach(() => {
    __resetGeminiSpacingForTests();
  });

  afterEach(() => {
    __resetGeminiSpacingForTests();
  });

  it('returns 0 wait for the first call (no spacing needed)', () => {
    expect(nextGeminiSlot(1_000_000)).toBe(0);
  });

  it('returns 750ms for the second call when fired at the same instant', () => {
    nextGeminiSlot(1_000_000);
    expect(nextGeminiSlot(1_000_000)).toBe(750);
  });

  it('returns 1500ms for the third call when fired at the same instant', () => {
    nextGeminiSlot(1_000_000);
    nextGeminiSlot(1_000_000);
    expect(nextGeminiSlot(1_000_000)).toBe(1500);
  });

  it('does not impose a wait when the caller is already past the previous slot', () => {
    nextGeminiSlot(1_000_000); // reserves slot at 1_000_000 + 750
    expect(nextGeminiSlot(1_002_000)).toBe(0);
  });

  it('imposes only the residual spacing when the caller is between slots', () => {
    nextGeminiSlot(1_000_000); // reserves 1_000_750
    // 200ms after the first call: previous slot lands at 1_000_750, so we
    // should still wait (1_000_750 - 1_000_200) = 550ms.
    expect(nextGeminiSlot(1_000_200)).toBe(550);
  });
});
