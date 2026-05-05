import type { WorkflowEdge } from '../schemas/edge';

/**
 * Returns true if the directed graph (defined by an array of edges) contains
 * any cycle. A self-loop (source === target) counts as a cycle.
 *
 * Implementation: iterative DFS with three colors (white/gray/black) to detect
 * back-edges. Runs in O(V+E) where V is the number of distinct node ids
 * appearing in edges.
 *
 * Note: nodes that are never referenced by any edge are not visited (they
 * trivially can't participate in a cycle). The caller is responsible for
 * ensuring the graph is well-formed (edges reference declared nodes); see
 * `WorkflowGraphSchema.superRefine` for that validation.
 */
export function hasCycle(edges: ReadonlyArray<WorkflowEdge>): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  type Color = 0 | 1 | 2; // 0=white, 1=gray, 2=black
  const color = new Map<string, Color>();

  // Initialize every node id mentioned by any edge as white.
  for (const edge of edges) {
    color.set(edge.source, 0);
    color.set(edge.target, 0);
  }

  for (const startNode of color.keys()) {
    if (color.get(startNode) !== 0) continue;

    // Iterative DFS with an explicit stack of (node, neighborIndex).
    const stack: { node: string; i: number }[] = [{ node: startNode, i: 0 }];
    color.set(startNode, 1);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.node) ?? [];

      if (frame.i < neighbors.length) {
        const next = neighbors[frame.i];
        frame.i += 1;
        const c = color.get(next) ?? 0;
        if (c === 1) return true; // back-edge → cycle
        if (c === 0) {
          color.set(next, 1);
          stack.push({ node: next, i: 0 });
        }
      } else {
        color.set(frame.node, 2);
        stack.pop();
      }
    }
  }

  return false;
}
