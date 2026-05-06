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
import type { WorkflowNode } from '../../../lib/schemas/node';
import type { WorkflowEdge } from '../../../lib/schemas/edge';
import { canConnectByIds, type CanConnectResult } from '../../../lib/dag/handles';
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

/**
 * Maps our domain `WorkflowNode` to React Flow's `Node`. Custom renderers
 * are registered via `nodeTypes`; `type` and `data` pass through unchanged.
 */
function toRFNode(n: WorkflowNode, selectedNodeId: string | null): Node {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    selected: selectedNodeId === n.id,
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
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setNodePosition = useWorkflowStore((s) => s.setNodePosition);
  const setSelection = useWorkflowStore((s) => s.setSelection);
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

  const rfNodes = useMemo(
    () => nodes.map((n) => toRFNode(n, selectedNodeId)),
    [nodes, selectedNodeId],
  );
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

      const id = `edge-${conn.source}-${conn.sourceHandle}__${conn.target}-${conn.targetHandle}-${Date.now()}`;
      addEdge({
        id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
      });
    },
    [nodes, addEdge],
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
            switch (n.type) {
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
