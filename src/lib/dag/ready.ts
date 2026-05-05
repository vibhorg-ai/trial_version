import type { WorkflowGraph } from '../schemas/workflow';

/**
 * Status of a single node within a workflow run.
 *
 * `pending` — has not started yet.
 * `running` — currently executing.
 * `success` — finished with output.
 * `failed`  — finished with error; downstream nodes are blocked.
 * `skipped` — explicitly excluded from this run; downstream nodes are blocked.
 */
export type NodeRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Returns the set of node ids that are eligible to fire NOW: their status is
 * `pending` AND every predecessor (sources of incoming edges) has status
 * `success`. Nodes blocked by a `failed`/`skipped` predecessor are not
 * returned (the orchestrator decides whether to mark them skipped).
 *
 * Result is stable: ids appear in the order they appear in `graph.nodes`.
 */
export function computeReady(
  graph: Pick<WorkflowGraph, 'nodes' | 'edges'>,
  statuses: ReadonlyMap<string, NodeRunStatus>,
): string[] {
  // Build predecessor map.
  const preds = new Map<string, string[]>();
  for (const node of graph.nodes) preds.set(node.id, []);
  for (const edge of graph.edges) {
    if (preds.has(edge.target)) {
      preds.get(edge.target)!.push(edge.source);
    }
  }

  const ready: string[] = [];
  for (const node of graph.nodes) {
    const status = statuses.get(node.id) ?? 'pending';
    if (status !== 'pending') continue;

    const predecessors = preds.get(node.id) ?? [];
    const allDone = predecessors.every((p) => statuses.get(p) === 'success');
    if (allDone) ready.push(node.id);
  }

  return ready;
}
