import { tasks } from '@trigger.dev/sdk';
import type { Prisma } from '../generated/prisma';
import type { NodeStatus, RunStatus } from '../generated/prisma';
import { prisma } from '../lib/prisma';
import type { WorkflowNode } from '../lib/schemas/node';

import type { cropImageTask } from './crop-image';
import type { geminiTask } from './gemini';
import type { CropTaskPayload, GeminiTaskPayload } from './types';

/**
 * Upserts a `NodeRun` row keyed on `(workflowRunId, nodeId)` using find-first +
 * create/update. The schema already defines `@@unique([workflowRunId, nodeId])`;
 * migrating to Prisma `upsert` with that compound key is a follow-up cleanup.
 */
export async function markNodeRun(args: {
  workflowRunId: string;
  nodeId: string;
  /** Required when creating a new row; optional on updates. */
  nodeType?: string;
  status: NodeStatus;
  inputSnapshot?: Prisma.InputJsonValue;
  output?: Prisma.InputJsonValue;
  error?: string;
}): Promise<void> {
  const existing = await prisma.nodeRun.findFirst({
    where: { workflowRunId: args.workflowRunId, nodeId: args.nodeId },
  });

  const terminal: NodeStatus[] = ['SUCCESS', 'FAILED', 'SKIPPED'];

  if (!existing) {
    await prisma.nodeRun.create({
      data: {
        workflowRunId: args.workflowRunId,
        nodeId: args.nodeId,
        nodeType: args.nodeType ?? 'unknown',
        status: args.status,
        inputs: args.inputSnapshot ?? undefined,
        output: args.output ?? undefined,
        errorMessage: args.error ?? undefined,
        startedAt: args.status === 'RUNNING' ? new Date() : undefined,
        finishedAt: terminal.includes(args.status) ? new Date() : undefined,
      },
    });
    return;
  }

  await prisma.nodeRun.update({
    where: { id: existing.id },
    data: {
      status: args.status,
      ...(args.inputSnapshot !== undefined ? { inputs: args.inputSnapshot } : {}),
      ...(args.output !== undefined ? { output: args.output } : {}),
      ...(args.error !== undefined ? { errorMessage: args.error } : {}),
      ...(args.status === 'RUNNING' && !existing.startedAt ? { startedAt: new Date() } : {}),
      ...(terminal.includes(args.status) ? { finishedAt: new Date() } : {}),
    },
  });
}

export async function fireChildTask(args: {
  workflowRunId: string;
  node: WorkflowNode;
  payload: unknown;
}): Promise<{ runId: string }> {
  const tags = [`nodeId:${args.node.id}`, `workflowRunId:${args.workflowRunId}`];

  switch (args.node.type) {
    case 'crop-image': {
      const handle = await tasks.trigger<typeof cropImageTask>(
        'crop-image',
        args.payload as CropTaskPayload,
        { tags },
      );
      return { runId: handle.id };
    }
    case 'gemini': {
      const handle = await tasks.trigger<typeof geminiTask>(
        'gemini',
        args.payload as GeminiTaskPayload,
        { tags },
      );
      return { runId: handle.id };
    }
    default:
      throw new Error(`No Trigger task for node type: ${String((args.node as WorkflowNode).type)}`);
  }
}

export function computeFinalStatus(nodeStatuses: ReadonlyArray<NodeStatus>): RunStatus {
  if (nodeStatuses.some((s) => s === 'RUNNING' || s === 'PENDING')) {
    return 'RUNNING';
  }

  const allSuccessOrSkipped = nodeStatuses.every((s) => s === 'SUCCESS' || s === 'SKIPPED');
  if (allSuccessOrSkipped) {
    return 'SUCCESS';
  }

  const allFailed = nodeStatuses.every((s) => s === 'FAILED');
  if (allFailed) {
    return 'FAILED';
  }

  const anyFailed = nodeStatuses.some((s) => s === 'FAILED');
  const anySuccess = nodeStatuses.some((s) => s === 'SUCCESS');
  if (anyFailed && anySuccess) {
    return 'PARTIAL';
  }

  if (anyFailed) {
    return 'FAILED';
  }

  return 'RUNNING';
}
