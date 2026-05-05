import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { GET } from '../route';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../test/integration/db';
import { mockClerkAuth } from '../../../../test/integration/clerk';
import { prisma } from '../../../../lib/prisma';
import {
  ListWorkflowsResponseSchema,
  WorkflowSummarySchema,
  WorkflowDetailSchema,
} from '../../../../lib/schemas/api';
import type { Prisma } from '../../../../generated/prisma';

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

function listRequest(): Request {
  return new Request('http://localhost/api/workflows', { method: 'GET' });
}

describe('GET /api/workflows', () => {
  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await GET(listRequest());
    expect(res.status).toBe(401);
  });

  it('returns empty list for a new user with no workflows', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(ListWorkflowsResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({ workflows: [] });
  });

  it('lists only the current user workflows (no cross-user leakage)', async () => {
    const userA = makeTestUserId();
    const userB = makeTestUserId();
    userIds.push(userA, userB);

    await prisma.workflow.create({
      data: {
        userId: userA,
        name: 'A1',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.workflow.create({
      data: {
        userId: userA,
        name: 'A2',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });
    const bRow = await prisma.workflow.create({
      data: {
        userId: userB,
        name: 'B1',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    mockClerkAuth(userA);
    const resA = await GET(listRequest());
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.workflows).toHaveLength(2);
    expect(bodyA.workflows.every((w: { name: string }) => w.name === 'A1' || w.name === 'A2')).toBe(
      true,
    );
    expect(bodyA.workflows.some((w: { id: string }) => w.id === bRow.id)).toBe(false);

    mockClerkAuth(userB);
    const resB = await GET(listRequest());
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.workflows).toHaveLength(1);
    expect(bodyB.workflows[0].name).toBe('B1');
  });

  it('orders workflows by updatedAt descending', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);

    const rowA = await prisma.workflow.create({
      data: {
        userId,
        name: 'A',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    await prisma.workflow.create({
      data: {
        userId,
        name: 'B',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    await prisma.workflow.update({
      where: { id: rowA.id },
      data: { name: 'A-renamed' },
    });

    mockClerkAuth(userId);
    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflows).toHaveLength(2);
    expect(body.workflows[0].name).toBe('A-renamed');
    expect(body.workflows[1].name).toBe('B');
  });

  it('does not include graph on summary items', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);

    await prisma.workflow.create({
      data: {
        userId,
        name: 'One',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    mockClerkAuth(userId);
    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflows).toHaveLength(1);
    expect(WorkflowSummarySchema.safeParse(body.workflows[0]).success).toBe(true);
    expect(WorkflowDetailSchema.safeParse(body.workflows[0]).success).toBe(false);
    expect(body.workflows[0].graph).toBeUndefined();
  });
});
