import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { GET } from '../route';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../../test/integration/db';
import { mockClerkAuth } from '../../../../../test/integration/clerk';
import { prisma } from '../../../../../lib/prisma';
import { WorkflowDetailSchema } from '../../../../../lib/schemas/api';
import type { Prisma } from '../../../../../generated/prisma';

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

function detailRequest(id: string): Request {
  return new Request(`http://localhost/api/workflows/${id}`, { method: 'GET' });
}

describe('GET /api/workflows/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await GET(detailRequest('clxxxxxxxxxxxxxxxxxxxx'), {
      params: Promise.resolve({ id: 'clxxxxxxxxxxxxxxxxxxxx' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with full graph for the owner', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: {
        userId,
        name: 'Test WF',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    const res = await GET(detailRequest(row.id), { params: Promise.resolve({ id: row.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(WorkflowDetailSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      id: row.id,
      name: 'Test WF',
      graph: validGraph,
    });
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.updatedAt).toBe('string');
  });

  it('returns 404 for another user workflow (not 403); row remains for owner', async () => {
    const userA = makeTestUserId();
    const userB = makeTestUserId();
    userIds.push(userA, userB);

    const row = await prisma.workflow.create({
      data: {
        userId: userA,
        name: 'A-only',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    mockClerkAuth(userB);
    const res = await GET(detailRequest(row.id), { params: Promise.resolve({ id: row.id }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Workflow not found' });

    const stillThere = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.userId).toBe(userA);
  });

  it('returns 404 for a non-existent id', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const fakeId = 'cl0000000000000000000000';
    const res = await GET(detailRequest(fakeId), { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Workflow not found' });
  });

  it('returns 404 for malformed id (not 500)', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const badId = 'not-a-cuid';
    const res = await GET(detailRequest(badId), { params: Promise.resolve({ id: badId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Workflow not found' });
  });
});
