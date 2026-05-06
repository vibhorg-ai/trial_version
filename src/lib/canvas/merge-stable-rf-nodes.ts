import type { Node } from 'reactflow';
import type { WorkflowNode } from '../schemas/node';

/**
 * Builds the React Flow `nodes` array while **reusing previous `Node` object
 * references** whenever `{ id, type, position, data, selected }` are unchanged.
 *
 * Without this, every `dragOverrides` tick recreates *all* nodes; React Flow
 * then reconciles the whole graph each frame → every card flickers during drag.
 */
export function mergeStableRfNodes(
  prevRfNodes: readonly Node[],
  domainNodes: readonly WorkflowNode[],
  dragOverrides: ReadonlyMap<string, { x: number; y: number }>,
  selectedNodeId: string | null,
): Node[] {
  const prevById = new Map(prevRfNodes.map((n) => [n.id, n]));
  return domainNodes.map((n) => {
    const override = dragOverrides.get(n.id);
    const position = override ?? n.position;
    const selected = selectedNodeId === n.id;
    const prev = prevById.get(n.id);
    if (
      prev &&
      prev.position.x === position.x &&
      prev.position.y === position.y &&
      prev.selected === selected &&
      prev.data === n.data &&
      prev.type === n.type
    ) {
      return prev;
    }
    return {
      id: n.id,
      type: n.type,
      position: { x: position.x, y: position.y },
      data: n.data,
      selected,
    } satisfies Node;
  });
}
