import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { UpdateWorkflowRequestSchema, type WorkflowDetail } from '../../../../lib/schemas/api';
import { WorkflowGraphSchema } from '../../../../lib/schemas/workflow';
import { hasCycle } from '../../../../lib/dag/cycle';
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

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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

  const parsed = UpdateWorkflowRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.graph !== undefined && hasCycle(parsed.data.graph.edges)) {
    return NextResponse.json({ error: 'Workflow graph contains a cycle' }, { status: 400 });
  }

  const { id } = await ctx.params;

  try {
    const row = await prisma.workflow.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
    }

    const data: { name?: string; graph?: Prisma.InputJsonValue } = {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.graph !== undefined && {
        graph: parsed.data.graph as unknown as Prisma.InputJsonValue,
      }),
    };

    const updated = await prisma.workflow.update({
      where: { id },
      data,
    });

    const graphParsed = WorkflowGraphSchema.safeParse(updated.graph);
    if (!graphParsed.success) {
      logger.error(
        { issues: graphParsed.error.issues, workflowId: id },
        'Stored workflow graph failed validation after update',
      );
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const response: WorkflowDetail = {
      id: updated.id,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
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
    logger.error({ err, userId, id }, 'Failed to update workflow');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    await prisma.workflow.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2023' || err.code === 'P2025')
    ) {
      return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
    }
    logger.error({ err, userId, id }, 'Failed to delete workflow');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
