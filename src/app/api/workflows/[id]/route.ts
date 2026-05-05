import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { WorkflowDetail } from '../../../../lib/schemas/api';
import { WorkflowGraphSchema } from '../../../../lib/schemas/workflow';
import { prisma } from '../../../../lib/prisma';
import { logger } from '../../../../lib/logger';
import { Prisma } from '../../../../generated/prisma';

const NOT_FOUND_BODY = { error: 'Workflow not found' } as const;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const row = await prisma.workflow.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
    }

    const graphParsed = WorkflowGraphSchema.safeParse(row.graph);
    if (!graphParsed.success) {
      logger.error(
        { issues: graphParsed.error.issues, workflowId: id },
        'Stored workflow graph failed validation',
      );
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const response: WorkflowDetail = {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      graph: graphParsed.data,
    };
    return NextResponse.json(response);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2023' || err.code === 'P2025')
    ) {
      return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
    }
    logger.error({ err, userId, id }, 'Failed to fetch workflow');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
