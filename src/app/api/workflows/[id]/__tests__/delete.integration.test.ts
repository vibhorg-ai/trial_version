import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { DELETE } from '../route';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../../test/integration/db';
import { mockClerkAuth } from '../../../../../test/integration/clerk';
import { prisma } from '../../../../../lib/prisma';
import type { Prisma } from '../../../../../generated/prisma';
import { RunScope, RunStatus, NodeStatus } from '../../../../../generated/prisma';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

const validGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs',
      position: { x: 0, y: 0 },
      data: { fields: [] },
    },
    { id: 'response', type: 'response', position: { x: 800, y: 0 }, data: { capturedValue: null } },
  ],
  edges: [],
};

const userIds: string[] = [];

beforeAll(async () => {
  await cleanupAllTestUsers();
});

afterEach(async () => {
  for (const id of userIds.splice(0)) await cleanupTestUser(id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/workflows/${id}`, { method: 'DELETE' });
}

describe('DELETE /api/workflows/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await DELETE(deleteRequest('clxxxxxxxxxxxxxxxxxxxx'), {
      params: Promise.resolve({ id: 'clxxxxxxxxxxxxxxxxxxxx' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent id', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const fakeId = 'cl0000000000000000000000';
    const res = await DELETE(deleteRequest(fakeId), { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Workflow not found' });
  });

  it("returns 404 for another user's row; workflow still exists", async () => {
    const userA = makeTestUserId();
    const userB = makeTestUserId();
    userIds.push(userA, userB);

    const row = await prisma.workflow.create({
      data: {
        userId: userA,
        name: 'Keep me',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    mockClerkAuth(userB);
    const res = await DELETE(deleteRequest(row.id), { params: Promise.resolve({ id: row.id }) });
    expect(res.status).toBe(404);

    const stillThere = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.userId).toBe(userA);
  });

  it('returns 404 for malformed id', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const badId = 'not-a-cuid';
    const res = await DELETE(deleteRequest(badId), { params: Promise.resolve({ id: badId }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Workflow not found' });
  });

  it('returns 204 and removes the row for the owner', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: {
        userId,
        name: 'Gone',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    const res = await DELETE(deleteRequest(row.id), { params: Promise.resolve({ id: row.id }) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    const gone = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(gone).toBeNull();
  });

  it('cascade-deletes WorkflowRun and NodeRun children when the workflow is deleted', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const wf = await prisma.workflow.create({
      data: {
        userId,
        name: 'With runs',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: wf.id,
        userId,
        scope: RunScope.FULL,
        selectedNodeIds: [],
        inputsSnapshot: {} as Prisma.InputJsonValue,
        status: RunStatus.PENDING,
      },
    });

    const nodeRun = await prisma.nodeRun.create({
      data: {
        workflowRunId: run.id,
        nodeId: 'response',
        nodeType: 'response',
        status: NodeStatus.PENDING,
      },
    });

    const res = await DELETE(deleteRequest(wf.id), { params: Promise.resolve({ id: wf.id }) });
    expect(res.status).toBe(204);

    expect(await prisma.workflow.findUnique({ where: { id: wf.id } })).toBeNull();
    expect(await prisma.workflowRun.findUnique({ where: { id: run.id } })).toBeNull();
    expect(await prisma.nodeRun.findUnique({ where: { id: nodeRun.id } })).toBeNull();
  });
});
