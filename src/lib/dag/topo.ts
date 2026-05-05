import type { WorkflowGraph } from '../schemas/workflow';

/**
 * Returns nodes in topological order: every node appears after all of its
 * predecessors. Order among nodes with no relative ordering is determined
 * by the input `nodes` array (stable: same as Kahn's algorithm with a FIFO
 * queue seeded in input order).
 *
 * Throws if the graph contains a cycle.
 *
 * Implementation: Kahn's algorithm.
 *   - Compute in-degree for every node id (treats only the nodes listed in
 *     graph.nodes; edges referencing unknown ids are ignored at this layer
 *     because schema validation already catches that).
 *   - Seed a queue with all in-degree-0 nodes in their input-array order.
 *   - Pop, emit, decrement neighbors, push neighbors that drop to 0
 *     IN INPUT-ARRAY ORDER (i.e. iterate the original nodes array, not the
 *     adjacency list, when deciding what to enqueue this round).
 */
export function topoOrder(graph: Pick<WorkflowGraph, 'nodes' | 'edges'>): string[] {
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes) inDegree.set(node.id, 0);
  for (const edge of graph.edges) {
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
    }
  }

  // Adjacency list keyed by source id.
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Order nodes by their position in graph.nodes for stability.
  const positionOf = new Map<string, number>();
  graph.nodes.forEach((node, idx) => positionOf.set(node.id, idx));

  // Initial queue: in-degree-0 nodes in input-array order.
  const queue: string[] = graph.nodes
    .filter((node) => inDegree.get(node.id) === 0)
    .map((node) => node.id);

  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    const neighbors = (adjacency.get(id) ?? []).slice();
    // Sort neighbors that *just became* in-degree zero in input-array order
    // before enqueueing.
    const newlyReady: string[] = [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) newlyReady.push(neighbor);
    }
    newlyReady.sort((a, b) => (positionOf.get(a) ?? 0) - (positionOf.get(b) ?? 0));
    queue.push(...newlyReady);
  }

  if (result.length !== graph.nodes.length) {
    throw new Error('Workflow graph contains a cycle; cannot topologically sort.');
  }

  return result;
}
