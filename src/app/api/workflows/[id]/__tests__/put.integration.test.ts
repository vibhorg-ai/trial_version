import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { PUT } from '../route';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../../test/integration/db';
import { mockClerkAuth } from '../../../../../test/integration/clerk';
import { prisma } from '../../../../../lib/prisma';
import { WorkflowDetailSchema, UpdateWorkflowRequestSchema } from '../../../../../lib/schemas/api';
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

const alternateGraph = {
  schemaVersion: 1,
  nodes: [
    ...validGraph.nodes,
    {
      id: 'response-2',
      type: 'response',
      position: { x: 900, y: 0 },
      data: { capturedValue: null },
    },
  ],
  edges: [],
};

/** Directed cycle between two Gemini nodes. */
const cyclicGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'g1',
      type: 'gemini',
      position: { x: 0, y: 0 },
      data: {
        model: 'gemini-1.5-pro',
        prompt: '',
        systemPrompt: '',
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    },
    {
      id: 'g2',
      type: 'gemini',
      position: { x: 200, y: 0 },
      data: {
        model: 'gemini-1.5-pro',
        prompt: '',
        systemPrompt: '',
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'g1', target: 'g2', sourceHandle: 'response', targetHandle: 'prompt' },
    { id: 'e2', source: 'g2', target: 'g1', sourceHandle: 'response', targetHandle: 'prompt' },
  ],
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

function putRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/workflows/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/workflows/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await PUT(putRequest('clxxxxxxxxxxxxxxxxxxxx', { name: 'X' }), {
      params: Promise.resolve({ id: 'clxxxxxxxxxxxxxxxxxxxx' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent id', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const fakeId = 'cl0000000000000000000000';
    const res = await PUT(putRequest(fakeId, { name: 'Renamed' }), {
      params: Promise.resolve({ id: fakeId }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Workflow not found' });
  });

  it("returns 404 for another user's row; row is unchanged in the database", async () => {
    const userA = makeTestUserId();
    const userB = makeTestUserId();
    userIds.push(userA, userB);

    const row = await prisma.workflow.create({
      data: {
        userId: userA,
        name: 'Owner-only',
        graph: validGraph as unknown as Prisma.InputJsonValue,
      },
    });

    const snapName = row.name;
    const snapGraph = row.graph;
    const snapUpdated = row.updatedAt;

    mockClerkAuth(userB);
    const res = await PUT(putRequest(row.id, { name: 'Hacked' }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Workflow not found' });

    const after = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(after).not.toBeNull();
    expect(after!.name).toBe(snapName);
    expect(after!.graph).toEqual(snapGraph);
    expect(after!.updatedAt.getTime()).toBe(snapUpdated.getTime());
  });

  it('returns 404 for malformed id', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const badId = 'not-a-cuid';
    const res = await PUT(putRequest(badId, { name: 'X' }), {
      params: Promise.resolve({ id: badId }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Workflow not found' });
  });

  it('returns 400 for invalid JSON body', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'W', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const res = await PUT(
      new Request(`http://localhost/api/workflows/${row.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'not-json{',
      }),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 for empty body {}', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'W', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const res = await PUT(putRequest(row.id, {}), { params: Promise.resolve({ id: row.id }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('returns 400 for cyclic graph in body', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'W', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const res = await PUT(putRequest(row.id, { graph: cyclicGraph }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Workflow graph contains a cycle' });
  });

  it('returns 200 and updates name only; graph and userId unchanged; updatedAt advances', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'Before', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const beforeUpdated = row.updatedAt.getTime();
    await new Promise((r) => setTimeout(r, 15));

    const res = await PUT(putRequest(row.id, { name: 'AfterName' }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(WorkflowDetailSchema.safeParse(json).success).toBe(true);
    expect(json).toMatchObject({ id: row.id, name: 'AfterName', graph: validGraph });

    const dbRow = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(dbRow!.name).toBe('AfterName');
    expect(dbRow!.graph).toEqual(validGraph as unknown as Prisma.InputJsonValue);
    expect(dbRow!.userId).toBe(userId);
    expect(dbRow!.updatedAt.getTime()).toBeGreaterThan(beforeUpdated);
  });

  it('returns 200 and updates graph only; name unchanged', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'StableName', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const res = await PUT(putRequest(row.id, { graph: alternateGraph }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('StableName');
    expect(json.graph).toEqual(alternateGraph);

    const dbRow = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(dbRow!.name).toBe('StableName');
    expect(dbRow!.graph).toEqual(alternateGraph as unknown as Prisma.InputJsonValue);
  });

  it('returns 200 when both name and graph are provided', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'Old', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const res = await PUT(putRequest(row.id, { name: 'Both', graph: alternateGraph }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ name: 'Both', graph: alternateGraph });

    const dbRow = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(dbRow!.name).toBe('Both');
    expect(dbRow!.graph).toEqual(alternateGraph as unknown as Prisma.InputJsonValue);
  });

  it('ignores userId in body; Zod strips it and DB userId stays owner', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const row = await prisma.workflow.create({
      data: { userId, name: 'Mine', graph: validGraph as unknown as Prisma.InputJsonValue },
    });

    const stripped = UpdateWorkflowRequestSchema.safeParse({
      name: 'New',
      userId: 'attacker-id',
    });
    expect(stripped.success).toBe(true);
    expect(stripped.data).toEqual({ name: 'New' });

    const res = await PUT(putRequest(row.id, { name: 'New', userId: 'attacker-id' }), {
      params: Promise.resolve({ id: row.id }),
    });
    expect(res.status).toBe(200);

    const dbRow = await prisma.workflow.findUnique({ where: { id: row.id } });
    expect(dbRow!.userId).toBe(userId);
    expect(dbRow!.name).toBe('New');
  });
});
