import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workflowRunId } = await ctx.params;

  const run = await prisma.workflowRun.findFirst({
    where: { id: workflowRunId, userId },
  });
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const nodes = await prisma.nodeRun.findMany({
    where: { workflowRunId },
    orderBy: { id: 'asc' },
  });

  return NextResponse.json({
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeId: n.nodeId,
      nodeType: n.nodeType,
      status: n.status,
      startedAt: n.startedAt ? n.startedAt.toISOString() : null,
      finishedAt: n.finishedAt ? n.finishedAt.toISOString() : null,
      inputs: n.inputs,
      output: n.output,
      errorMessage: n.errorMessage,
    })),
  });
}
