import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { ensureDefaultWorkflow } from '../seed-default-workflow';
import { prisma } from '../prisma';
import { makeTestUserId, cleanupTestUser, cleanupAllTestUsers } from '../../test/integration/db';
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
