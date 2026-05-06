'use client';

/* eslint-disable react-hooks/refs -- mergeStableRfNodes needs the prior RF nodes/edges array inside useMemo so sibling node objects stay referentially stable across drag ticks; deferring the cache to an effect would lag one frame behind dragOverrides. */
import { useMemo, useCallback, useState, useRef, useEffect, type MouseEvent } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
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
import { mergeStableRfNodes } from '../../../lib/canvas/merge-stable-rf-nodes';
import { RequestInputsNode } from '../../../components/canvas/nodes/RequestInputsNode';
import { CropImageNode } from '../../../components/canvas/nodes/CropImageNode';
import { GeminiNode } from '../../../components/canvas/nodes/GeminiNode';
import { ResponseNode } from '../../../components/canvas/nodes/ResponseNode';
import { CanvasFooter } from '../../../components/canvas/CanvasFooter';

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

function toRFEdge(e: WorkflowEdge, animated: boolean): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'default',
    animated,
    className: animated ? 'workflow-edge workflow-edge--animated' : 'workflow-edge',
    style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.8 },
  };
}

/** Stable identity: React Flow's StoreUpdater syncs these via `useEffect([value])` — new refs every parent render re-run all updaters and thrash the RF store (visible as every node flickering during drag). */
const CANVAS_FIT_VIEW_OPTIONS = { padding: 0.2, duration: 0 } as const;
const CANVAS_PRO_OPTIONS = { hideAttribution: false } as const;

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
  const [backgroundVariant, setBackgroundVariant] = useState(BackgroundVariant.Dots);
  const [minimapOpen, setMinimapOpen] = useState(true);
  /** When false, edges omit `workflow-edge--animated` so CSS does not run the dash keyframes. */
  const [suspendEdgeAnimation, setSuspendEdgeAnimation] = useState(false);
  const suspendEdgeAnimationRef = useRef(false);
  const setSuspendEdgeAnimationStable = useCallback((next: boolean) => {
    if (suspendEdgeAnimationRef.current === next) return;
    suspendEdgeAnimationRef.current = next;
    setSuspendEdgeAnimation(next);
  }, []);

  useEffect(() => {
    return () => {
      if (connectErrorClearRef.current !== null) {
        clearTimeout(connectErrorClearRef.current);
      }
    };
  }, []);

  /** Pause dash animation for presses inside nodes (sliders, etc.). Defer resume until after RF clears `.dragging` so we never re-enable animation one frame early. */
  const pointersDownInNode = useRef(new Set<number>());
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.react-flow__node')) {
        pointersDownInNode.current.add(e.pointerId);
        setSuspendEdgeAnimationStable(true);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointersDownInNode.current.delete(e.pointerId);
      if (pointersDownInNode.current.size > 0) return;
      queueMicrotask(() => {
        if (
          typeof document !== 'undefined' &&
          document.querySelector('.react-flow__node.dragging')
        ) {
          return;
        }
        setSuspendEdgeAnimationStable(false);
      });
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
    };
  }, [setSuspendEdgeAnimationStable]);

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

  /** Reuse prior `Node` instances so React Flow does not reconcile every card on each drag frame. */
  const rfNodesCacheRef = useRef<Node[]>([]);
  const rfNodes = useMemo(() => {
    const prevArr = rfNodesCacheRef.current;
    const next = mergeStableRfNodes(prevArr, nodes, dragOverrides, selectedNodeId);
    const sameLength = prevArr.length === next.length;
    const sameElements =
      sameLength && (next.length === 0 || next.every((n, i) => n === prevArr[i]!));
    const out = sameElements ? prevArr : next;
    rfNodesCacheRef.current = out;
    return out;
  }, [nodes, selectedNodeId, dragOverrides]);

  /** Same idea for edges — avoid new object identities when only unrelated state changes. */
  const rfEdgesCacheRef = useRef<Edge[]>([]);
  const rfEdges = useMemo(() => {
    const animated = !suspendEdgeAnimation;
    const prev = rfEdgesCacheRef.current;
    const prevById = new Map(prev.map((e) => [e.id, e]));
    const next = edges.map((e) => {
      const p = prevById.get(e.id);
      if (
        p &&
        p.source === e.source &&
        p.target === e.target &&
        p.sourceHandle === e.sourceHandle &&
        p.targetHandle === e.targetHandle &&
        p.animated === animated
      ) {
        return p;
      }
      return toRFEdge(e, animated);
    });
    const sameLength = prev.length === next.length;
    const sameElements = sameLength && (next.length === 0 || next.every((e, i) => e === prev[i]!));
    const out = sameElements ? prev : next;
    rfEdgesCacheRef.current = out;
    return out;
  }, [edges, suspendEdgeAnimation]);

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

      // Commit final positions to the store **before** clearing drag overrides so any
      // synchronous zustand re-render never briefly shows stale `nodes.position`.
      for (const change of positionChanges) {
        if (change.dragging === false) {
          setNodePosition(change.id, change.position);
        }
      }

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

  const onNodeDragStart = useCallback(() => {
    setSuspendEdgeAnimationStable(true);
  }, [setSuspendEdgeAnimationStable]);

  const onNodeDragStop = useCallback(() => {
    setSuspendEdgeAnimationStable(false);
  }, [setSuspendEdgeAnimationStable]);

  const onSelectionDragStart = useCallback(() => {
    setSuspendEdgeAnimationStable(true);
  }, [setSuspendEdgeAnimationStable]);

  const onSelectionDragStop = useCallback(() => {
    setSuspendEdgeAnimationStable(false);
  }, [setSuspendEdgeAnimationStable]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      if (selNodes.length > 1) {
        setMultiSelection(selNodes.map((n) => n.id));
      } else if (selNodes.length === 0) {
        setMultiSelection([]);
      }
    },
    [setMultiSelection],
  );

  const minimapNodeColor = useCallback((n: Node) => {
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
  }, []);

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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDragStop={onSelectionDragStop}
        onSelectionChange={onSelectionChange}
        multiSelectionKeyCode="Shift"
        /** Default `true` pans the viewport when a dragged node nears an edge — feels like the whole screen “fluctuates”. */
        autoPanOnNodeDrag={false}
        minZoom={0.05}
        maxZoom={4}
        fitView
        fitViewOptions={CANVAS_FIT_VIEW_OPTIONS}
        attributionPosition="bottom-left"
        proOptions={CANVAS_PRO_OPTIONS}
      >
        <Background variant={backgroundVariant} gap={19} size={1.54} color="#cacaca" />
        {/* MiniMap mirrors every node move; hiding it while a drag override is active removes a heavy per-frame SVG pass. */}
        {minimapOpen && dragOverrides.size === 0 ? (
          <MiniMap
            position="bottom-right"
            style={{ width: 104, height: 72 }}
            maskColor="rgba(244, 244, 245, 0.6)"
            nodeColor={minimapNodeColor}
            nodeStrokeColor="#e4e4e7"
            nodeStrokeWidth={1}
            pannable={false}
            zoomable={false}
            className="rf-minimap"
          />
        ) : null}
        <CanvasFooter
          backgroundVariant={backgroundVariant}
          onToggleBackground={() =>
            setBackgroundVariant((v) =>
              v === BackgroundVariant.Dots ? BackgroundVariant.Lines : BackgroundVariant.Dots,
            )
          }
          minimapOpen={minimapOpen}
          onToggleMinimap={() => setMinimapOpen((m) => !m)}
        />
      </ReactFlow>
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
