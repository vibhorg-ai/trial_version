import { prisma } from '../../lib/prisma';

/**
 * Generates a unique user-id prefix for a test, of the form `test:<random>`.
 * Use this as the `userId` in any rows your test creates so cleanup is precise.
 */
export function makeTestUserId(): string {
  return `test:${crypto.randomUUID()}`;
}

/**
 * Removes every row created by a given test user. Cascades automatically
 * delete WorkflowRun and NodeRun children via the Prisma schema's onDelete.
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  await prisma.workflow.deleteMany({ where: { userId } });
  // Also remove any orphan WorkflowRun rows associated with this user (shouldn't exist
  // in normal flow but defensive cleanup).
  await prisma.workflowRun.deleteMany({ where: { userId } });
}

/**
 * Sweeping cleanup that removes every row whose userId starts with "test:".
 * Useful as a safety net before/after a test file runs to clear any
 * stragglers from a prior crash.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  await prisma.workflow.deleteMany({ where: { userId: { startsWith: 'test:' } } });
  await prisma.workflowRun.deleteMany({ where: { userId: { startsWith: 'test:' } } });
}
