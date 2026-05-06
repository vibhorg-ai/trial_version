'use client';

import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import type { WorkflowNode } from '../../../lib/schemas/node';
import type { WorkflowEdge } from '../../../lib/schemas/edge';

/**
 * Maps our domain `WorkflowNode` (discriminated union) to React Flow's
 * generic `Node` type. We pass our `data` object through unchanged; node
 * type-specific rendering lives in custom node renderers (Phase 7).
 *
 * For now we use React Flow's "default" node type with a label that names
 * the domain type so each one is visually distinguishable.
 */
function toRFNode(n: WorkflowNode): Node {
  return {
    id: n.id,
    type: 'default',
    position: n.position,
    data: { label: n.type, original: n.data },
  };
}

function toRFEdge(e: WorkflowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'default',
  };
}

export function Canvas() {
  // Read once, then derive React Flow shape via useMemo.
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodePosition = useWorkflowStore((s) => s.setNodePosition);

  const rfNodes = useMemo(() => nodes.map(toRFNode), [nodes]);
  const rfEdges = useMemo(() => edges.map(toRFEdge), [edges]);

  /**
   * Handle React Flow's internal change events. We only act on POSITION
   * changes — dragging a node updates the store's position. Other changes
   * (selection, dimensions) are RF-internal and we let RF manage them.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          // `dragging: false` means the user has released — commit position.
          setNodePosition(change.id, change.position);
        }
      }
      // Note: We don't apply changes to local state because rfNodes is
      // derived from the store (memoized). The store is the source of truth.
      // If we needed live drag preview we'd need a local hover state — but
      // RF's internal handling already provides smooth dragging.
    },
    [setNodePosition],
  );

  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {
    // Phase 6 doesn't allow editing edges via the canvas yet (deletion/connection
    // happens in 6.5–6.7). We swallow the changes to avoid React warnings.
  }, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 0 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            // Color-code by node type for the minimap.
            switch (n.data?.label) {
              case 'request-inputs':
                return '#a78bfa'; // violet-400
              case 'crop-image':
                return '#34d399'; // emerald-400
              case 'gemini':
                return '#60a5fa'; // blue-400
              case 'response':
                return '#fb923c'; // orange-400
              default:
                return '#a1a1aa'; // zinc-400
            }
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
