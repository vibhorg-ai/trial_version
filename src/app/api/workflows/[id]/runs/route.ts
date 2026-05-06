import { auth } from '@clerk/nextjs/server';
import { auth as triggerAuth, tasks } from '@trigger.dev/sdk';
import { NextResponse } from 'next/server';

import { RunStartRequestSchema } from '../../../../../lib/schemas/api';
import { WorkflowGraphSchema } from '../../../../../lib/schemas/workflow';
import { prisma } from '../../../../../lib/prisma';
import { logger } from '../../../../../lib/logger';
import type { Prisma } from '../../../../../generated/prisma';
import { RunScope } from '../../../../../generated/prisma';

import type { orchestratorTask } from '../../../../../trigger/orchestrator';

export const runtime = 'nodejs';

const NOT_FOUND_BODY = { error: 'Workflow not found' } as const;

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

const RUN_HISTORY_LIMIT = 50;

function apiScopeToPrisma(scope: 'FULL' | 'SELECTED' | 'SINGLE'): RunScope {
  if (scope === 'SELECTED') return RunScope.PARTIAL;
  return scope === 'FULL' ? RunScope.FULL : RunScope.SINGLE;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workflowId } = await ctx.params;

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, userId },
  });
  if (!workflow) {
    return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
  }

  const rows = await prisma.workflowRun.findMany({
    where: { workflowId, userId },
    orderBy: { startedAt: 'desc' },
    take: RUN_HISTORY_LIMIT,
    select: {
      id: true,
      status: true,
      scope: true,
      startedAt: true,
      finishedAt: true,
      selectedNodeIds: true,
    },
  });

  return NextResponse.json({
    runs: rows.map((r) => ({
      id: r.id,
      status: r.status,
      scope: r.scope,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      selectedNodeIds: r.selectedNodeIds,
    })),
  });
}

export async function POST(
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

  const parsed = RunStartRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id: workflowId } = await ctx.params;

  try {
    const row = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!row || row.userId !== userId) {
      return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
    }

    const graphParsed = WorkflowGraphSchema.safeParse(row.graph);
    if (!graphParsed.success) {
      logger.error(
        { issues: graphParsed.error.issues, workflowId },
        'Stored workflow graph failed validation on run start',
      );
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const nodeIdSet = new Set(graphParsed.data.nodes.map((n) => n.id));
    for (const sid of parsed.data.selectedNodeIds) {
      if (!nodeIdSet.has(sid)) {
        return NextResponse.json(
          { error: `Unknown node id in selectedNodeIds: ${sid}` },
          { status: 400 },
        );
      }
    }

    const idempotencyKey = req.headers.get('Idempotency-Key')?.trim();
    if (idempotencyKey) {
      const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
      const candidates = await prisma.workflowRun.findMany({
        where: {
          workflowId,
          userId,
          startedAt: { gte: cutoff },
        },
        orderBy: { startedAt: 'desc' },
        take: RUN_HISTORY_LIMIT,
      });
      const hit = candidates.find((r) => {
        const snap = r.inputsSnapshot as { __idempotencyKey?: string };
        return snap?.__idempotencyKey === idempotencyKey;
      });
      if (hit?.triggerRunId) {
        const publicAccessToken = await triggerAuth.createPublicToken({
          scopes: { read: { runs: [hit.triggerRunId] } },
          expirationTime: '1h',
        });
        return NextResponse.json({
          workflowRunId: hit.id,
          triggerRunId: hit.triggerRunId,
          publicAccessToken,
        });
      }
    }

    const inputsSnapshot = JSON.parse(
      JSON.stringify({
        fields: parsed.data.inputs,
        ...(idempotencyKey ? { __idempotencyKey: idempotencyKey } : {}),
      }),
    ) as Prisma.InputJsonValue;

    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        userId,
        scope: apiScopeToPrisma(parsed.data.scope),
        selectedNodeIds: parsed.data.selectedNodeIds,
        status: 'PENDING',
        inputsSnapshot,
      },
    });

    const handle = await tasks.trigger<typeof orchestratorTask>(
      'workflow-run',
      { workflowRunId: run.id },
      { tags: [`workflowRunId:${run.id}`] },
    );

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { triggerRunId: handle.id },
    });

    const publicAccessToken = await triggerAuth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
      expirationTime: '1h',
    });

    return NextResponse.json({
      workflowRunId: run.id,
      triggerRunId: handle.id,
      publicAccessToken,
    });
  } catch (err) {
    logger.error({ err, userId, workflowId }, 'Failed to start workflow run');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
