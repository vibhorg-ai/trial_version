import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../../../../lib/prisma', () => ({
  prisma: {
    workflow: { findFirst: vi.fn() },
    workflowRun: { findMany: vi.fn() },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../../../lib/prisma';
import { GET } from '../route';

describe('GET /api/workflows/[id]/runs', () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.workflow.findFirst).mockReset();
    vi.mocked(prisma.workflowRun.findMany).mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await GET(new Request('http://localhost/api/workflows/wf1/runs'), {
      params: Promise.resolve({ id: 'wf1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when workflow is missing or not owned', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findFirst).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/workflows/wf1/runs'), {
      params: Promise.resolve({ id: 'wf1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns runs ordered by startedAt desc', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findFirst).mockResolvedValue({ id: 'wf1' } as never);

    const older = new Date('2024-01-01T10:00:00.000Z');
    const newer = new Date('2024-01-02T10:00:00.000Z');

    vi.mocked(prisma.workflowRun.findMany).mockResolvedValue([
      {
        id: 'r_new',
        status: 'SUCCESS',
        scope: 'FULL',
        startedAt: newer,
        finishedAt: newer,
        selectedNodeIds: [],
      },
      {
        id: 'r_old',
        status: 'FAILED',
        scope: 'SINGLE',
        startedAt: older,
        finishedAt: older,
        selectedNodeIds: ['n1'],
      },
    ] as never);

    const res = await GET(new Request('http://localhost/api/workflows/wf1/runs'), {
      params: Promise.resolve({ id: 'wf1' }),
    });
    expect(res.status).toBe(200);

    expect(prisma.workflowRun.findMany).toHaveBeenCalledWith({
      where: { workflowId: 'wf1', userId: 'u1' },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        scope: true,
        startedAt: true,
        finishedAt: true,
        selectedNodeIds: true,
      },
    });

    const body = (await res.json()) as {
      runs: Array<{
        id: string;
        scope: string;
        startedAt: string;
      }>;
    };
    expect(body.runs.map((r) => r.id)).toEqual(['r_new', 'r_old']);
    expect(body.runs[0]?.scope).toBe('FULL');
    expect(body.runs[1]?.startedAt).toBe(older.toISOString());
  });

  it('limits history to 50 rows', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findFirst).mockResolvedValue({ id: 'wf1' } as never);
    vi.mocked(prisma.workflowRun.findMany).mockResolvedValue([]);

    await GET(new Request('http://localhost/api/workflows/wf1/runs'), {
      params: Promise.resolve({ id: 'wf1' }),
    });

    expect(prisma.workflowRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});
