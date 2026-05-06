'use client';

import { useMemo, useCallback, useState, useRef, useEffect, type MouseEvent } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import type { WorkflowEdge } from '../../../lib/schemas/edge';
import { canConnectByIds, type CanConnectResult } from '../../../lib/dag/handles';
import { hasCycle } from '../../../lib/dag/cycle';
import { RequestInputsNode } from '../../../components/canvas/nodes/RequestInputsNode';
import { CropImageNode } from '../../../components/canvas/nodes/CropImageNode';
import { GeminiNode } from '../../../components/canvas/nodes/GeminiNode';
import { ResponseNode } from '../../../components/canvas/nodes/ResponseNode';
import { BottomToolbar } from '../../../components/canvas/BottomToolbar';

const NODE_TYPES = {
  'request-inputs': RequestInputsNode,
  'crop-image': CropImageNode,
  gemini: GeminiNode,
  response: ResponseNode,
} as const;

type ConnectFailureReason = Extract<CanConnectResult, { ok: false }>['reason'];

function humanizeReason(reason: ConnectFailureReason): string {
  switch (reason) {
    case 'unknown-source-handle':
      return 'Cannot connect: source handle not found';
    case 'unknown-target-handle':
      return 'Cannot connect: target handle not found';
    case 'type-mismatch':
      return 'Cannot connect: handle types are incompatible';
    case 'cannot-target-output-side':
      return 'Cannot connect: target must be an input handle';
    case 'cannot-source-from-input-side':
      return 'Cannot connect: source must be an output handle';
  }
}

function toRFEdge(e: WorkflowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'default',
    // The original spec mandates animated edges; we keep the animation but
    // recolour to indigo-500 (#6366f1) so it matches Galaxy's brand accent
    // (`workflow-accent-500`) instead of the violet we used previously.
    animated: true,
    className: 'workflow-edge workflow-edge--animated',
    style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.8 },
  };
}

export function Canvas() {
  // Read once, then derive React Flow shape via useMemo.
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setNodePosition = useWorkflowStore((s) => s.setNodePosition);
  const setSelection = useWorkflowStore((s) => s.setSelection);
  const setMultiSelection = useWorkflowStore((s) => s.setMultiSelection);
  const addEdge = useWorkflowStore((s) => s.addEdge);

  const [connectError, setConnectError] = useState<string | null>(null);
  const connectErrorClearRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (connectErrorClearRef.current !== null) {
        clearTimeout(connectErrorClearRef.current);
      }
    };
  }, []);

  // Override map for in-progress drags: nodeId -> live position. We can't
  // write the dragged position into the store on every frame (that would
  // create a 60Hz autosave storm) and we can't omit it (React Flow re-renders
  // from the `nodes` prop, so the node would snap back on every drag tick).
  // Instead, we hold transient positions in component state and merge them
  // over the store-derived list in `rfNodes` below. On drag-end we commit to
  // the store and clear the override.
  const [dragOverrides, setDragOverrides] = useState<ReadonlyMap<string, { x: number; y: number }>>(
    () => new Map(),
  );

  const rfNodes = useMemo(
    () =>
      nodes.map((n) => {
        const override = dragOverrides.get(n.id);
        return {
          id: n.id,
          type: n.type,
          position: override ?? n.position,
          data: n.data,
          selected: selectedNodeId === n.id,
        } satisfies Node;
      }),
    [nodes, selectedNodeId, dragOverrides],
  );

  const rfEdges = useMemo(() => edges.map(toRFEdge), [edges]);

  /**
   * Handle React Flow's internal change events.
   *
   * - Position changes with `dragging: true` populate the override map so the
   *   node follows the cursor in real time.
   * - Position changes with `dragging: false` (release) commit the final
   *   position to the store and clear the override.
   * - Selection / dimension changes are RF-internal and we let RF manage
   *   them; our `selected` flag is recomputed from `selectedNodeId`.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positionChanges = changes.filter(
        (
          c,
        ): c is Extract<NodeChange, { type: 'position' }> & {
          position: { x: number; y: number };
        } => c.type === 'position' && !!c.position,
      );
      if (positionChanges.length === 0) return;

      setDragOverrides((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const change of positionChanges) {
          if (change.dragging === false) {
            if (next.has(change.id)) {
              next.delete(change.id);
              changed = true;
            }
          } else {
            next.set(change.id, change.position);
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      for (const change of positionChanges) {
        if (change.dragging === false) {
          setNodePosition(change.id, change.position);
        }
      }
    },
    [setNodePosition],
  );

  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {
    // Phase 6 doesn't allow editing edges via the canvas yet (deletion/connection
    // happens in 6.5–6.7). We swallow the changes to avoid React warnings.
  }, []);

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      setSelection({ nodeId: node.id, edgeId: null });
    },
    [setSelection],
  );

  const onEdgeClick = useCallback(
    (_e: MouseEvent, edge: Edge) => {
      setSelection({ nodeId: null, edgeId: edge.id });
    },
    [setSelection],
  );

  const onPaneClick = useCallback(() => {
    setSelection({ nodeId: null, edgeId: null });
  }, [setSelection]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) {
        return;
      }
      const sourceNode = nodes.find((n) => n.id === conn.source);
      const targetNode = nodes.find((n) => n.id === conn.target);
      if (!sourceNode || !targetNode) return;

      const result = canConnectByIds(sourceNode, conn.sourceHandle, targetNode, conn.targetHandle);
      if (!result.ok) {
        const reason = humanizeReason(result.reason);
        setConnectError(reason);
        if (connectErrorClearRef.current !== null) {
          clearTimeout(connectErrorClearRef.current);
        }
        connectErrorClearRef.current = globalThis.setTimeout(() => {
          setConnectError(null);
          connectErrorClearRef.current = null;
        }, 3000);
        return;
      }

      const candidateEdge = {
        id: `edge-${conn.source}-${conn.sourceHandle}__${conn.target}-${conn.targetHandle}-${Date.now()}`,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
      };

      if (hasCycle([...edges, candidateEdge])) {
        setConnectError('Cannot connect: workflow cycles are not allowed');
        if (connectErrorClearRef.current !== null) {
          clearTimeout(connectErrorClearRef.current);
        }
        connectErrorClearRef.current = globalThis.setTimeout(() => {
          setConnectError(null);
          connectErrorClearRef.current = null;
        }, 3000);
        return;
      }

      addEdge(candidateEdge);
    },
    [nodes, edges, addEdge],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onSelectionChange={({ nodes: selNodes }) => {
          if (selNodes.length > 1) {
            setMultiSelection(selNodes.map((n) => n.id));
          } else if (selNodes.length === 0) {
            setMultiSelection([]);
          }
        }}
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.2, duration: 0 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={19} size={0.8} color="#cacaca" />
        <Controls position="bottom-left" showInteractive={false} className="rf-controls" />
        <MiniMap
          position="bottom-right"
          maskColor="rgba(244, 244, 245, 0.6)"
          nodeColor={(n) => {
            switch (n.type) {
              case 'request-inputs':
                return '#a78bfa';
              case 'crop-image':
                return '#34d399';
              case 'gemini':
                return '#60a5fa';
              case 'response':
                return '#fb923c';
              default:
                return '#a1a1aa';
            }
          }}
          nodeStrokeColor="#e4e4e7"
          nodeStrokeWidth={1}
          pannable
          zoomable
          className="rf-minimap"
        />
      </ReactFlow>
      <BottomToolbar />
      {connectError ? (
        <div
          role="alert"
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-red-600/95 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {connectError}
        </div>
      ) : null}
    </div>
  );
}
