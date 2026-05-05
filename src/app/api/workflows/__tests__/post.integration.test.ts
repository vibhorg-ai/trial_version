import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { POST } from '../route';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../test/integration/db';
import { mockClerkAuth } from '../../../../test/integration/clerk';
import { prisma } from '../../../../lib/prisma';

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

/** Valid graph with a directed cycle (two Gemini nodes); response nodes cannot form self-loops (no outputs). */
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

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workflows', () => {
  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await POST(jsonRequest({ name: 'X', graph: validGraph }));
    expect(res.status).toBe(401);
  });

  it('creates a workflow for an authenticated user', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);

    const res = await POST(jsonRequest({ name: 'My WF', graph: validGraph }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe('My WF');
    expect(body.graph).toEqual(validGraph);
    expect(typeof body.id).toBe('string');
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.updatedAt).toBe('string');

    // Verify it's actually in the DB.
    const row = await prisma.workflow.findUnique({ where: { id: body.id } });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(userId);
    expect(row!.name).toBe('My WF');
  });

  it('returns 400 for invalid JSON body', async () => {
    mockClerkAuth(makeTestUserId());
    const res = await POST(
      new Request('http://localhost/api/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json{',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for schema validation failure', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);
    const res = await POST(jsonRequest({ name: '', graph: validGraph }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for cyclic graph', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);
    const res = await POST(jsonRequest({ name: 'C', graph: cyclicGraph }));
    expect(res.status).toBe(400);
  });

  it('does not bleed userIds between calls (different users see different rows)', async () => {
    const userA = makeTestUserId();
    const userB = makeTestUserId();
    userIds.push(userA, userB);

    mockClerkAuth(userA);
    const ra = await POST(jsonRequest({ name: 'A', graph: validGraph }));
    const ba = await ra.json();

    mockClerkAuth(userB);
    const rb = await POST(jsonRequest({ name: 'B', graph: validGraph }));
    const bb = await rb.json();

    // Both succeeded.
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(ba.id).not.toBe(bb.id);

    const rowA = await prisma.workflow.findUnique({ where: { id: ba.id } });
    const rowB = await prisma.workflow.findUnique({ where: { id: bb.id } });
    expect(rowA!.userId).toBe(userA);
    expect(rowB!.userId).toBe(userB);
  });
});
