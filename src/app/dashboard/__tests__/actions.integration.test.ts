import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { createWorkflow, renameWorkflow, deleteWorkflow } from '../actions';
import { makeTestUserId, cleanupTestUser, cleanupAllTestUsers } from '../../../test/integration/db';
import { mockClerkAuth } from '../../../test/integration/clerk';
import { prisma } from '../../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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

describe('dashboard server actions', () => {
  describe('createWorkflow', () => {
    it("returns ok:false 'Unauthorized' when not logged in", async () => {
      mockClerkAuth(null);
      const result = await createWorkflow({ name: 'N' });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it('returns ok:false on empty name', async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);
      const result = await createWorkflow({ name: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it('returns ok:true, persists row with starter graph + user id, and revalidates dashboard', async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);

      const result = await createWorkflow({ name: 'My new workflow' });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      expect(typeof result.data.id).toBe('string');

      const row = await prisma.workflow.findUnique({ where: { id: result.data.id } });
      expect(row).not.toBeNull();
      expect(row!.userId).toBe(userId);
      expect(row!.name).toBe('My new workflow');
      expect(row!.graph).toEqual(starterGraph);
      const g = row!.graph as { nodes?: unknown[]; edges?: unknown[] };
      expect(Array.isArray(g.nodes)).toBe(true);
      expect(g.nodes).toHaveLength(2);
      expect(Array.isArray(g.edges)).toBe(true);
      expect(g.edges).toHaveLength(0);

      expect(vi.mocked(revalidatePath)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
    });

    it('two consecutive creates produce two distinct rows', async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);

      const a = await createWorkflow({ name: 'First' });
      const b = await createWorkflow({ name: 'Second' });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (!a.ok || !b.ok) throw new Error('expected ok');
      expect(a.data.id).not.toBe(b.data.id);

      const rowA = await prisma.workflow.findUnique({ where: { id: a.data.id } });
      const rowB = await prisma.workflow.findUnique({ where: { id: b.data.id } });
      expect(rowA).not.toBeNull();
      expect(rowB).not.toBeNull();
      expect(rowA!.name).toBe('First');
      expect(rowB!.name).toBe('Second');
    });
  });

  describe('renameWorkflow', () => {
    it("returns ok:false 'Unauthorized' when not logged in", async () => {
      mockClerkAuth(null);
      const result = await renameWorkflow({ id: 'clxxxxxxxxxxxxxxxxxxxx', name: 'X' });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it('returns ok:false on empty name', async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);
      const row = await prisma.workflow.create({
        data: {
          userId,
          name: 'Orig',
          graph: starterGraph as unknown as Prisma.InputJsonValue,
        },
      });

      const result = await renameWorkflow({ id: row.id, name: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);

      const unchanged = await prisma.workflow.findUnique({ where: { id: row.id } });
      expect(unchanged!.name).toBe('Orig');
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("returns ok:false 'Workflow not found' for non-existent id", async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);
      const fakeId = 'cl0000000000000000000000';
      const result = await renameWorkflow({ id: fakeId, name: 'N' });
      expect(result).toEqual({ ok: false, error: 'Workflow not found' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("returns ok:false 'Workflow not found' for another user's workflow; row not mutated", async () => {
      const userA = makeTestUserId();
      const userB = makeTestUserId();
      userIds.push(userA, userB);

      const row = await prisma.workflow.create({
        data: {
          userId: userA,
          name: 'Keep',
          graph: starterGraph as unknown as Prisma.InputJsonValue,
        },
      });

      mockClerkAuth(userB);
      const result = await renameWorkflow({ id: row.id, name: 'Hacked' });
      expect(result).toEqual({ ok: false, error: 'Workflow not found' });

      const still = await prisma.workflow.findUnique({ where: { id: row.id } });
      expect(still!.name).toBe('Keep');
      expect(still!.userId).toBe(userA);
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("owner rename: ok:true, name updated, updatedAt advanced, revalidatePath('/dashboard')", async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);

      const row = await prisma.workflow.create({
        data: {
          userId,
          name: 'Before',
          graph: starterGraph as unknown as Prisma.InputJsonValue,
        },
      });
      const beforeUpdatedAt = row.updatedAt;

      await new Promise((r) => setTimeout(r, 15));

      const result = await renameWorkflow({ id: row.id, name: 'After' });
      expect(result).toEqual({ ok: true, data: undefined });

      const after = await prisma.workflow.findUnique({ where: { id: row.id } });
      expect(after!.name).toBe('After');
      expect(after!.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('deleteWorkflow', () => {
    it("returns ok:false 'Unauthorized' when not logged in", async () => {
      mockClerkAuth(null);
      const result = await deleteWorkflow({ id: 'clxxxxxxxxxxxxxxxxxxxx' });
      expect(result).toEqual({ ok: false, error: 'Unauthorized' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("returns ok:false 'Workflow not found' for non-existent id", async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);
      const fakeId = 'cl0000000000000000000000';
      const result = await deleteWorkflow({ id: fakeId });
      expect(result).toEqual({ ok: false, error: 'Workflow not found' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("returns ok:false for another user's workflow; row still exists", async () => {
      const userA = makeTestUserId();
      const userB = makeTestUserId();
      userIds.push(userA, userB);

      const row = await prisma.workflow.create({
        data: {
          userId: userA,
          name: 'Stay',
          graph: starterGraph as unknown as Prisma.InputJsonValue,
        },
      });

      mockClerkAuth(userB);
      const result = await deleteWorkflow({ id: row.id });
      expect(result).toEqual({ ok: false, error: 'Workflow not found' });

      const stillThere = await prisma.workflow.findUnique({ where: { id: row.id } });
      expect(stillThere).not.toBeNull();
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });

    it("owner delete: ok:true, row removed, revalidatePath('/dashboard')", async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);

      const row = await prisma.workflow.create({
        data: {
          userId,
          name: 'Gone',
          graph: starterGraph as unknown as Prisma.InputJsonValue,
        },
      });

      const result = await deleteWorkflow({ id: row.id });
      expect(result).toEqual({ ok: true, data: undefined });

      const gone = await prisma.workflow.findUnique({ where: { id: row.id } });
      expect(gone).toBeNull();
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
    });

    it("returns ok:false 'Workflow not found' for malformed id (not thrown)", async () => {
      const userId = makeTestUserId();
      userIds.push(userId);
      mockClerkAuth(userId);
      const result = await deleteWorkflow({ id: 'not-a-cuid' });
      expect(result).toEqual({ ok: false, error: 'Workflow not found' });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    });
  });
});
