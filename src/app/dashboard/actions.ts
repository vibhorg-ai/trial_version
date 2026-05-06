'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import type { Prisma } from '../../generated/prisma';

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── createWorkflow ────────────────────────────────────────────────────
const CreateInputSchema = z.object({
  name: z.string().min(1).max(200),
});

/**
 * Creates a new workflow with the given name and a starter graph
 * (Request-Inputs + Response, no edges). Returns the new workflow id on
 * success. Caller should redirect to /workflow/[id] after.
 *
 * Auth: required.
 */
export async function createWorkflow(
  input: z.infer<typeof CreateInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const parsed = CreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  // Starter graph: Request-Inputs + Response, undeletable per the brief.
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

  try {
    const row = await prisma.workflow.create({
      data: {
        userId,
        name: parsed.data.name,
        graph: starterGraph as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath('/dashboard');
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    logger.error({ err, userId }, 'createWorkflow failed');
    return { ok: false, error: 'Failed to create workflow' };
  }
}

// ─── renameWorkflow ─────────────────────────────────────────────────────
const RenameInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
});

/**
 * Renames a workflow owned by the current user. Returns ok on success;
 * returns ok:false on auth/ownership/validation failures.
 *
 * Auth: required. Ownership: required.
 */
export async function renameWorkflow(
  input: z.infer<typeof RenameInputSchema>,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const parsed = RenameInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  try {
    const row = await prisma.workflow.findUnique({
      where: { id: parsed.data.id },
      select: { userId: true },
    });
    if (!row || row.userId !== userId) {
      return { ok: false, error: 'Workflow not found' };
    }
    await prisma.workflow.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    });
    revalidatePath('/dashboard');
    return { ok: true, data: undefined };
  } catch (err) {
    logger.error({ err, userId, workflowId: parsed.data.id }, 'renameWorkflow failed');
    return { ok: false, error: 'Failed to rename workflow' };
  }
}

// ─── deleteWorkflow ─────────────────────────────────────────────────────
const DeleteInputSchema = z.object({ id: z.string().min(1) });

/**
 * Deletes a workflow owned by the current user. Cascades runs/node-runs.
 *
 * Auth: required. Ownership: required.
 */
export async function deleteWorkflow(
  input: z.infer<typeof DeleteInputSchema>,
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Unauthorized' };

  const parsed = DeleteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  try {
    const row = await prisma.workflow.findUnique({
      where: { id: parsed.data.id },
      select: { userId: true },
    });
    if (!row || row.userId !== userId) {
      return { ok: false, error: 'Workflow not found' };
    }
    await prisma.workflow.delete({ where: { id: parsed.data.id } });
    revalidatePath('/dashboard');
    return { ok: true, data: undefined };
  } catch (err) {
    if (
      (err as { code?: string }).code === 'P2023' ||
      (err as { code?: string }).code === 'P2025'
    ) {
      return { ok: false, error: 'Workflow not found' };
    }
    logger.error({ err, userId, workflowId: parsed.data.id }, 'deleteWorkflow failed');
    return { ok: false, error: 'Failed to delete workflow' };
  }
}
