import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  createPublicToken: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({
  tasks: { trigger: mocks.trigger },
  auth: { createPublicToken: mocks.createPublicToken },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../../../../lib/prisma', () => ({
  prisma: {
    workflow: { findUnique: vi.fn() },
    workflowRun: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '../../../../../../lib/prisma';
import { POST } from '../route';

const validGraph = {
  schemaVersion: 1 as const,
  nodes: [
    {
      id: 'n1',
      type: 'request-inputs' as const,
      position: { x: 0, y: 0 },
      data: { fields: [] },
    },
  ],
  edges: [],
};

describe('POST /api/workflows/[id]/runs', () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(prisma.workflow.findUnique).mockReset();
    vi.mocked(prisma.workflowRun.findMany).mockReset();
    vi.mocked(prisma.workflowRun.create).mockReset();
    vi.mocked(prisma.workflowRun.update).mockReset();
    mocks.trigger.mockReset();
    mocks.createPublicToken.mockReset();

    mocks.trigger.mockResolvedValue({ id: 'tr_run_1' } as never);
    mocks.createPublicToken.mockResolvedValue('pat_mock');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'FULL',
        selectedNodeIds: [],
        inputs: {},
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when workflow is missing or owned by another user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(null);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'FULL',
        selectedNodeIds: [],
        inputs: {},
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf_missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body shape', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'FULL' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when selectedNodeIds reference unknown nodes', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
      id: 'wf1',
      userId: 'u1',
      name: 'w',
      graph: validGraph,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'SELECTED',
        selectedNodeIds: ['ghost'],
        inputs: {},
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf1' }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Unknown node id/);
  });

  it('returns 200 with workflowRunId, triggerRunId, publicAccessToken', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
      id: 'wf1',
      userId: 'u1',
      name: 'w',
      graph: validGraph,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(prisma.workflowRun.create).mockResolvedValue({
      id: 'wr_new',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: {},
      startedAt: new Date(),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
    } as never);

    vi.mocked(prisma.workflowRun.update).mockResolvedValue({} as never);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'FULL',
        selectedNodeIds: [],
        inputs: { topic: 'x' },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf1' }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      workflowRunId: string;
      triggerRunId: string;
      publicAccessToken: string;
    };
    expect(body.workflowRunId).toBe('wr_new');
    expect(body.triggerRunId).toBe('tr_run_1');
    expect(body.publicAccessToken).toBe('pat_mock');

    expect(mocks.trigger).toHaveBeenCalledWith(
      'workflow-run',
      { workflowRunId: 'wr_new' },
      expect.objectContaining({ tags: expect.any(Array) }),
    );
    expect(mocks.createPublicToken).toHaveBeenCalledWith({
      scopes: { read: { runs: ['tr_run_1'] } },
      expirationTime: '1h',
    });
  });

  it('idempotency: same Idempotency-Key returns existing run without triggering again', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'u1' } as never);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
      id: 'wf1',
      userId: 'u1',
      name: 'w',
      graph: validGraph,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(prisma.workflowRun.findMany).mockResolvedValue([
      {
        id: 'wr_existing',
        triggerRunId: 'tr_old',
        inputsSnapshot: { fields: {}, __idempotencyKey: 'k1' },
        startedAt: new Date(),
      } as never,
    ]);

    const req = new Request('http://localhost/api/workflows/wf/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'k1',
      },
      body: JSON.stringify({
        scope: 'FULL',
        selectedNodeIds: [],
        inputs: {},
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'wf1' }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      workflowRunId: string;
      triggerRunId: string;
      publicAccessToken: string;
    };
    expect(body.workflowRunId).toBe('wr_existing');
    expect(body.triggerRunId).toBe('tr_old');
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.createPublicToken).toHaveBeenCalledWith({
      scopes: { read: { runs: ['tr_old'] } },
      expirationTime: '1h',
    });
  });
});
