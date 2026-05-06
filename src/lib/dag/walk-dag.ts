import type { NodeStatus } from '../../generated/prisma';
import type { WorkflowGraph } from '../schemas/workflow';
import type { WorkflowNode } from '../schemas/node';
import type { ResolvedInputs } from './resolve';
import { OutputStore, resolveInputs } from './resolve';
import { computeReady, type NodeRunStatus } from './ready';

/** Task output written to the shared {@link import('./resolve').OutputStore} after success. */
export type DagFireOutput = { kind: 'text'; text: string } | { kind: 'image'; url: string };

function toPrismaNodeStatus(s: NodeRunStatus): NodeStatus {
  switch (s) {
    case 'pending':
      return 'PENDING';
    case 'running':
      return 'RUNNING';
    case 'success':
      return 'SUCCESS';
    case 'failed':
      return 'FAILED';
    case 'skipped':
      return 'SKIPPED';
    default: {
      const _ex: never = s;
      return _ex;
    }
  }
}

function writeNodeOutputToStore(
  node: WorkflowNode,
  store: OutputStore,
  output: DagFireOutput,
): void {
  if (node.type === 'crop-image') {
    if (output.kind !== 'image') {
      throw new Error(`crop-image node ${node.id} expected image output`);
    }
    store.set(node.id, 'output-image', output.url);
    return;
  }
  if (node.type === 'gemini') {
    if (output.kind !== 'text') {
      throw new Error(`gemini node ${node.id} expected text output`);
    }
    store.set(node.id, 'response', output.text);
    return;
  }
  throw new Error(`Cannot write task output for node type: ${(node as WorkflowNode).type}`);
}

export type ResponseResolutionDetail = { ok: true; result: unknown } | { ok: false; error: string };

export interface WalkDagArgs {
  graph: WorkflowGraph;
  store: OutputStore;
  /**
   * Invoked for `crop-image` and `gemini` only. Request-inputs and response are
   * handled by the walker itself (or pre-seeded by the caller).
   */
  fireFn: (node: WorkflowNode, inputs: ResolvedInputs) => Promise<DagFireOutput>;
  /**
   * When set (non-empty), every node not in this set is marked `skipped` before
   * walking begins (PARTIAL / SINGLE scope).
   */
  scopedNodeIds?: ReadonlySet<string> | null;
  /**
   * Optional status overrides applied after initializing pending/skipped from
   * scope (e.g. mark `request-inputs` as `success` once the OutputStore is seeded).
   */
  initialStatusOverrides?: ReadonlyMap<string, NodeRunStatus>;
  /** Persist response node completion (e.g. NodeRun rows). */
  onResponseDetail?: (node: WorkflowNode, detail: ResponseResolutionDetail) => Promise<void>;
}

type Completion = {
  nodeId: string;
  result: 'success' | 'failed';
  output?: DagFireOutput;
  error?: string;
};

/**
 * Orchestrates a DAG run with maximal concurrency: whenever any in-flight node
 * completes, ready nodes are recomputed so independent branches proceed without
 * waiting for unrelated siblings.
 */
export async function walkDag(args: WalkDagArgs): Promise<Map<string, NodeStatus>> {
  const { graph, store, fireFn, scopedNodeIds, initialStatusOverrides, onResponseDetail } = args;

  const statuses = new Map<string, NodeRunStatus>();
  for (const node of graph.nodes) {
    statuses.set(node.id, 'pending');
  }

  if (scopedNodeIds && scopedNodeIds.size > 0) {
    for (const node of graph.nodes) {
      if (!scopedNodeIds.has(node.id)) {
        statuses.set(node.id, 'skipped');
      }
    }
  }

  if (initialStatusOverrides) {
    for (const [nodeId, st] of initialStatusOverrides) {
      statuses.set(nodeId, st);
    }
  }

  const inflight = new Map<string, Promise<Completion>>();

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  async function completeResponseNode(nodeId: string): Promise<Completion> {
    const node = nodeById.get(nodeId);
    if (!node || node.type !== 'response') {
      throw new Error(`Expected response node at ${nodeId}`);
    }
    statuses.set(nodeId, 'running');
    try {
      const resolved = resolveInputs(node, graph, store);
      if (resolved.type !== 'response') {
        throw new Error(`resolveInputs type mismatch for response node ${nodeId}`);
      }
      statuses.set(nodeId, 'success');
      if (onResponseDetail) {
        await onResponseDetail(node, { ok: true, result: resolved.payload.result });
      }
      return { nodeId, result: 'success' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      statuses.set(nodeId, 'failed');
      if (onResponseDetail) {
        await onResponseDetail(node, { ok: false, error: msg });
      }
      return { nodeId, result: 'failed', error: msg };
    }
  }

  while (true) {
    const ready = computeReady(graph, statuses).filter((id) => !inflight.has(id));

    for (const nodeId of ready) {
      const node = nodeById.get(nodeId);
      if (!node) continue;

      if (node.type === 'response') {
        inflight.set(nodeId, completeResponseNode(nodeId));
        continue;
      }

      if (node.type === 'request-inputs') {
        statuses.set(nodeId, 'running');
        const resolved = resolveInputs(node, graph, store);
        if (resolved.type !== 'request-inputs') {
          throw new Error(`resolveInputs type mismatch for request-inputs node ${nodeId}`);
        }
        statuses.set(nodeId, 'success');
        continue;
      }

      statuses.set(nodeId, 'running');
      const inputs = resolveInputs(node, graph, store);
      const promise = fireFn(node, inputs)
        .then((output) => ({ nodeId, result: 'success' as const, output }))
        .catch((err) => ({
          nodeId,
          result: 'failed' as const,
          error: err instanceof Error ? err.message : String(err),
        }));
      inflight.set(nodeId, promise);
    }

    if (inflight.size === 0) {
      break;
    }

    const settled = await Promise.race(inflight.values());
    inflight.delete(settled.nodeId);

    if (settled.result === 'success' && settled.output) {
      const node = nodeById.get(settled.nodeId);
      if (!node) continue;
      writeNodeOutputToStore(node, store, settled.output);
      statuses.set(settled.nodeId, 'success');
    } else if (settled.result === 'failed') {
      statuses.set(settled.nodeId, 'failed');
    }
  }

  for (const [nodeId, status] of statuses) {
    if (status === 'pending') {
      statuses.set(nodeId, 'skipped');
    }
  }

  const out = new Map<string, NodeStatus>();
  for (const [id, s] of statuses) {
    out.set(id, toPrismaNodeStatus(s));
  }
  return out;
}
