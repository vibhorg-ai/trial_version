import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '../../../../lib/prisma';
import {
  makeTestUserId,
  cleanupTestUser,
  cleanupAllTestUsers,
} from '../../../../test/integration/db';
import { mockClerkAuth } from '../../../../test/integration/clerk';
import type { Prisma } from '../../../../generated/prisma';
import WorkflowPage from '../page';
import { CanvasShell } from '../CanvasShell';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

const starterGraph = {
  schemaVersion: 1 as const,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs' as const,
      position: { x: 100, y: 200 },
      data: { fields: [] },
    },
    {
      id: 'response',
      type: 'response' as const,
      position: { x: 800, y: 200 },
      data: { capturedValue: null },
    },
  ],
  edges: [],
};

const userIds: string[] = [];

beforeAll(async () => {
  await cleanupAllTestUsers();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  for (const id of userIds.splice(0)) await cleanupTestUser(id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('WorkflowPage', () => {
  it('returns CanvasShell with workflow props when user owns the workflow', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);
    const name = `Integration WF ${crypto.randomUUID().slice(0, 8)}`;
    const row = await prisma.workflow.create({
      data: {
        userId,
        name,
        graph: starterGraph as Prisma.InputJsonValue,
      },
    });

    const element = await WorkflowPage({ params: Promise.resolve({ id: row.id }) });

    expect(element.type).toBe(CanvasShell);
    expect(element.props.workflowId).toBe(row.id);
    expect(element.props.workflowName).toBe(name);
    expect(element.props.initialGraph).toEqual(starterGraph);
    expect(typeof element.props.updatedAt).toBe('string');
  });

  it('calls notFound when workflow belongs to another user', async () => {
    const ownerId = makeTestUserId();
    const otherId = makeTestUserId();
    userIds.push(ownerId, otherId);
    const row = await prisma.workflow.create({
      data: {
        userId: ownerId,
        name: 'Other user wf',
        graph: starterGraph as Prisma.InputJsonValue,
      },
    });

    mockClerkAuth(otherId);
    await expect(WorkflowPage({ params: Promise.resolve({ id: row.id }) })).rejects.toThrow();
  });

  it('redirects to sign-in when unauthenticated', async () => {
    mockClerkAuth(null);
    await expect(WorkflowPage({ params: Promise.resolve({ id: 'any-id' }) })).rejects.toThrow();
  });

  it('calls notFound when workflow id does not exist', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    mockClerkAuth(userId);
    await expect(
      WorkflowPage({ params: Promise.resolve({ id: 'nonexistent_workflow_id_cuid_like' }) }),
    ).rejects.toThrow();
  });
});
