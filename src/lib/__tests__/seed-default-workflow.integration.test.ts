import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { ensureDefaultWorkflow, ensureDemoWorkflow } from '../seed-default-workflow';
import { prisma } from '../prisma';
import { makeTestUserId, cleanupTestUser, cleanupAllTestUsers } from '../../test/integration/db';
import { DEMO_WORKFLOW_NAME } from '../demo-workflow';
import { SAMPLE_WORKFLOW_NAME } from '../sample-workflow';

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

describe('ensureDefaultWorkflow', () => {
  it('creates the sample workflow when user has none', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await ensureDefaultWorkflow(userId);
    const rows = await prisma.workflow.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(SAMPLE_WORKFLOW_NAME);
  });

  it('is idempotent — calling twice produces only one row', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await ensureDefaultWorkflow(userId);
    await ensureDefaultWorkflow(userId);
    const count = await prisma.workflow.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it('does not seed if the user already has a different workflow', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await prisma.workflow.create({
      data: {
        userId,
        name: 'Pre-existing',
        graph: { schemaVersion: 1, nodes: [], edges: [] } as never,
      },
    });
    await ensureDefaultWorkflow(userId);
    const rows = await prisma.workflow.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Pre-existing');
  });
});

describe('ensureDemoWorkflow', () => {
  it('creates the demo workflow when missing', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await prisma.workflow.create({
      data: {
        userId,
        name: 'Other',
        graph: { schemaVersion: 1, nodes: [], edges: [] } as never,
      },
    });
    await ensureDemoWorkflow(userId);
    const demo = await prisma.workflow.findFirst({ where: { userId, name: DEMO_WORKFLOW_NAME } });
    expect(demo).not.toBeNull();
    expect(demo!.name).toBe(DEMO_WORKFLOW_NAME);
  });

  it('is idempotent when demo already exists', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await ensureDemoWorkflow(userId);
    await ensureDemoWorkflow(userId);
    const count = await prisma.workflow.count({ where: { userId, name: DEMO_WORKFLOW_NAME } });
    expect(count).toBe(1);
  });

  it('after default + demo seed, new users have both workflows', async () => {
    const userId = makeTestUserId();
    userIds.push(userId);
    await ensureDefaultWorkflow(userId);
    await ensureDemoWorkflow(userId);
    const names = (await prisma.workflow.findMany({ where: { userId }, select: { name: true } }))
      .map((r) => r.name)
      .sort();
    expect(names).toEqual([DEMO_WORKFLOW_NAME, SAMPLE_WORKFLOW_NAME].sort());
  });
});
