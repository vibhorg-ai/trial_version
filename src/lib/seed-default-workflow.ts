import { prisma } from './prisma';
import { DEMO_WORKFLOW_GRAPH, DEMO_WORKFLOW_NAME } from './demo-workflow';
import { SAMPLE_WORKFLOW_GRAPH, SAMPLE_WORKFLOW_NAME } from './sample-workflow';
import type { Prisma } from '../generated/prisma';

/**
 * Ensures the user has at least one workflow. If they have zero, creates the
 * sample "Wireless Headphones Marketing" workflow. Idempotent.
 */
export async function ensureDefaultWorkflow(userId: string): Promise<void> {
  const count = await prisma.workflow.count({ where: { userId } });
  if (count > 0) return;

  await prisma.workflow.create({
    data: {
      userId,
      name: SAMPLE_WORKFLOW_NAME,
      graph: SAMPLE_WORKFLOW_GRAPH as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Ensures a second, shorter demo pipeline exists for recordings. Does not
 * touch the original sample workflow. Idempotent by workflow name.
 */
export async function ensureDemoWorkflow(userId: string): Promise<void> {
  const exists = await prisma.workflow.findFirst({
    where: { userId, name: DEMO_WORKFLOW_NAME },
    select: { id: true },
  });
  if (exists) return;

  await prisma.workflow.create({
    data: {
      userId,
      name: DEMO_WORKFLOW_NAME,
      graph: DEMO_WORKFLOW_GRAPH as unknown as Prisma.InputJsonValue,
    },
  });
}
