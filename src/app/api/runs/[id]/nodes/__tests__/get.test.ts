import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../../../../lib/prisma', () => ({
  prisma: {
    workflowRun: { findFirst: vi.fn() },
    nodeRun: { findMany: vi.fn() },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../../../lib/prisma';
import { GET } from '../route';

describe('GET /api/runs/[id]/nodes', () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.workflowRun.findFirst).mockReset();
    vi.mocked(prisma.nodeRun.findMany).mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await GET(new Request('http://localhost/api/runs/run1/nodes'), {
      params: Promise.resolve({ id: 'run1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when run is missing or not owned', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflowRun.findFirst).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/api/runs/run1/nodes'), {
      params: Promise.resolve({ id: 'run1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns node runs for the workflow run', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflowRun.findFirst).mockResolvedValue({
      id: 'run1',
      userId: 'u1',
    } as never);

    const started = new Date('2024-01-01T10:00:00.000Z');
    const finished = new Date('2024-01-01T10:00:05.000Z');

    vi.mocked(prisma.nodeRun.findMany).mockResolvedValue([
      {
        id: 'nr1',
        nodeId: 'n1',
        nodeType: 'gemini',
        status: 'SUCCESS',
        startedAt: started,
        finishedAt: finished,
        inputs: { x: 1 },
        output: { text: 'ok' },
        errorMessage: null,
      },
    ] as never);

    const res = await GET(new Request('http://localhost/api/runs/run1/nodes'), {
      params: Promise.resolve({ id: 'run1' }),
    });
    expect(res.status).toBe(200);

    expect(prisma.nodeRun.findMany).toHaveBeenCalledWith({
      where: { workflowRunId: 'run1' },
      orderBy: { id: 'asc' },
    });

    const body = (await res.json()) as {
      nodes: Array<{
        id: string;
        nodeId: string;
        status: string;
        startedAt: string;
        output: unknown;
      }>;
    };
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0]?.id).toBe('nr1');
    expect(body.nodes[0]?.startedAt).toBe(started.toISOString());
    expect(body.nodes[0]?.output).toEqual({ text: 'ok' });
  });

  it('returns an empty nodes array when none exist yet', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflowRun.findFirst).mockResolvedValue({
      id: 'run1',
      userId: 'u1',
    } as never);
    vi.mocked(prisma.nodeRun.findMany).mockResolvedValue([]);

    const res = await GET(new Request('http://localhost/api/runs/run1/nodes'), {
      params: Promise.resolve({ id: 'run1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nodes: unknown[] };
    expect(body.nodes).toEqual([]);
  });
});
