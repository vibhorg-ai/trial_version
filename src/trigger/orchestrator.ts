import { task, tasks } from '@trigger.dev/sdk';
import { z } from 'zod';

import type { Prisma } from '../generated/prisma';
import { prisma } from '../lib/prisma';
import { OutputStore } from '../lib/dag/resolve';
import type { ResolvedInputs } from '../lib/dag/resolve';
import { WorkflowGraphSchema } from '../lib/schemas/workflow';
import type { WorkflowNode } from '../lib/schemas/node';
import { walkDag, type DagFireOutput } from '../lib/dag/walk-dag';
import type { NodeRunStatus } from '../lib/dag/ready';

import { computeFinalStatus, markNodeRun } from './helpers';
import type { cropImageTask } from './crop-image';
import type { geminiTask } from './gemini';
import type { CropTaskPayload, GeminiTaskPayload, OrchestratorPayload } from './types';

/**
 * Snapshotted run inputs + optional idempotency metadata (see POST /runs).
 * Prefer a dedicated `WorkflowRun.idempotencyKey` column in production.
 */
const RunInputsSnapshotSchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
  __idempotencyKey: z.string().optional(),
});

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Child work is awaited with {@link tasks.triggerAndWait} so the DAG can chain
 * outputs. {@link import('./helpers').fireChildTask} stays trigger-only for
 * fire-and-forget call sites.
 */
async function fireExecutableNode(
  workflowRunId: string,
  node: WorkflowNode,
  inputs: ResolvedInputs,
): Promise<DagFireOutput> {
  const tags = [`nodeId:${node.id}`, `workflowRunId:${workflowRunId}`];

  if (node.type === 'crop-image') {
    if (inputs.type !== 'crop-image') {
      throw new Error(`Expected crop-image resolved inputs for ${node.id}`);
    }
    const { inputImageUrl, x, y, w, h } = inputs.payload;
    if (inputImageUrl === null || inputImageUrl === '') {
      await markNodeRun({
        workflowRunId,
        nodeId: node.id,
        nodeType: 'crop-image',
        status: 'FAILED',
        inputSnapshot: jsonSnapshot(inputs),
        error: 'Missing input image URL',
      });
      throw new Error('Missing input image URL');
    }

    await markNodeRun({
      workflowRunId,
      nodeId: node.id,
      nodeType: 'crop-image',
      status: 'RUNNING',
      inputSnapshot: jsonSnapshot(inputs),
    });

    const payload: CropTaskPayload = { workflowRunId, nodeId: node.id, inputImageUrl, x, y, w, h };
    const runResult = await tasks.triggerAndWait<typeof cropImageTask>('crop-image', payload, {
      tags,
    });

    if (!runResult.ok) {
      const msg = toErrorMessage(runResult.error);
      await markNodeRun({
        workflowRunId,
        nodeId: node.id,
        status: 'FAILED',
        error: msg,
      });
      throw new Error(msg);
    }

    await markNodeRun({
      workflowRunId,
      nodeId: node.id,
      status: 'SUCCESS',
      output: jsonSnapshot(runResult.output),
    });
    return { kind: 'image', url: runResult.output.url };
  }

  if (node.type === 'gemini') {
    if (inputs.type !== 'gemini') {
      throw new Error(`Expected gemini resolved inputs for ${node.id}`);
    }
    const p = inputs.payload;

    await markNodeRun({
      workflowRunId,
      nodeId: node.id,
      nodeType: 'gemini',
      status: 'RUNNING',
      inputSnapshot: jsonSnapshot(inputs),
    });

    const payload: GeminiTaskPayload = {
      workflowRunId,
      nodeId: node.id,
      prompt: p.prompt,
      systemPrompt: p.system || undefined,
      temperature: p.temperature,
      maxOutputTokens: p.maxOutputTokens,
      topP: p.topP,
      visionImageUrls: p.vision,
    };

    const runResult = await tasks.triggerAndWait<typeof geminiTask>('gemini', payload, { tags });

    if (!runResult.ok) {
      const msg = toErrorMessage(runResult.error);
      await markNodeRun({
        workflowRunId,
        nodeId: node.id,
        status: 'FAILED',
        error: msg,
      });
      throw new Error(msg);
    }

    await markNodeRun({
      workflowRunId,
      nodeId: node.id,
      status: 'SUCCESS',
      output: jsonSnapshot(runResult.output),
    });
    return { kind: 'text', text: runResult.output.text };
  }

  throw new Error(`No executable Trigger task for node type: ${node.type}`);
}

export const orchestratorTask = task({
  id: 'workflow-run',
  retry: { maxAttempts: 2 },
  run: async (payload: OrchestratorPayload): Promise<void> => {
    const { workflowRunId } = payload;

    const run = await prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      include: { workflow: true },
    });

    if (!run) {
      throw new Error(`WorkflowRun not found: ${workflowRunId}`);
    }

    const graphParsed = WorkflowGraphSchema.safeParse(run.workflow.graph);
    if (!graphParsed.success) {
      throw new Error('Workflow graph failed validation');
    }
    const graph = graphParsed.data;

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { status: 'RUNNING' },
    });

    const store = new OutputStore();
    const snap = RunInputsSnapshotSchema.safeParse(run.inputsSnapshot);
    const fieldValues = snap.success ? snap.data.fields : {};

    const scopedNodeIds = run.scope === 'FULL' ? null : new Set(run.selectedNodeIds);

    const initialStatusOverrides = new Map<string, NodeRunStatus>();

    for (const node of graph.nodes) {
      if (node.type !== 'request-inputs') continue;
      if (scopedNodeIds && !scopedNodeIds.has(node.id)) continue;

      for (const field of node.data.fields) {
        const v = field.name in fieldValues ? fieldValues[field.name] : field.value;
        store.set(node.id, field.name, v);
      }

      await markNodeRun({
        workflowRunId,
        nodeId: node.id,
        nodeType: 'request-inputs',
        status: 'SUCCESS',
        inputSnapshot: jsonSnapshot({ fields: fieldValues }),
        output: jsonSnapshot({
          fields: Object.fromEntries(
            node.data.fields.map((f) => [
              f.name,
              f.name in fieldValues ? fieldValues[f.name] : f.value,
            ]),
          ),
        }),
      });
      initialStatusOverrides.set(node.id, 'success');
    }

    try {
      const nodeStatuses = await walkDag({
        graph,
        store,
        scopedNodeIds,
        initialStatusOverrides,
        fireFn: (node, inputs) => fireExecutableNode(workflowRunId, node, inputs),
        onResponseDetail: async (node, detail) => {
          if (detail.ok) {
            await markNodeRun({
              workflowRunId,
              nodeId: node.id,
              nodeType: 'response',
              status: 'SUCCESS',
              output: jsonSnapshot({ capturedValue: detail.result }),
            });
          } else {
            await markNodeRun({
              workflowRunId,
              nodeId: node.id,
              nodeType: 'response',
              status: 'FAILED',
              error: detail.error,
            });
          }
        },
      });

      for (const node of graph.nodes) {
        const st = nodeStatuses.get(node.id);
        if (st === 'SKIPPED') {
          await markNodeRun({
            workflowRunId,
            nodeId: node.id,
            nodeType: node.type,
            status: 'SKIPPED',
          });
        }
      }

      const orderedStatuses = graph.nodes.map((n) => nodeStatuses.get(n.id)!);
      const finalRunStatus = computeFinalStatus(orderedStatuses);
      const finishedAt = new Date();

      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: finalRunStatus,
          finishedAt,
          durationMs: finishedAt.getTime() - run.startedAt.getTime(),
        },
      });
    } catch (err) {
      const finishedAt = new Date();
      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: 'FAILED',
          errorMessage: toErrorMessage(err),
          finishedAt,
          durationMs: finishedAt.getTime() - run.startedAt.getTime(),
        },
      });
      throw err;
    }
  },
});
