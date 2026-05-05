import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { CreateWorkflowRequestSchema, type WorkflowDetail } from '../../../lib/schemas/api';
import { hasCycle } from '../../../lib/dag/cycle';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import type { Prisma } from '../../../generated/prisma';

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateWorkflowRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (hasCycle(parsed.data.graph.edges)) {
    return NextResponse.json({ error: 'Workflow graph contains a cycle' }, { status: 400 });
  }

  try {
    const row = await prisma.workflow.create({
      data: {
        userId,
        name: parsed.data.name,
        graph: parsed.data.graph as unknown as Prisma.InputJsonValue,
      },
    });

    const response: WorkflowDetail = {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      graph: parsed.data.graph,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to create workflow');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
