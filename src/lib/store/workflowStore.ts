import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WorkflowGraph } from '../schemas/workflow';
import type { WorkflowNode } from '../schemas/node';
import type { WorkflowEdge } from '../schemas/edge';
import { layoutCompactPipeline } from '../dag/spread-node-layout';
import type { NodeOutput } from '../../trigger/types';

const HISTORY_LIMIT = 50;

/** UI-level workflow run status (not Prisma `WorkflowRun.status`). */
export type WorkflowRunUiStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'success'
  | 'failed'
  | 'partial';

/** Per-node execution status from realtime child runs. */
export type NodeRunUiStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

export type RealtimeRunIngestPayload = {
  id: string;
  taskIdentifier: string;
  status: string;
  tags?: string[];
  output?: unknown;
  error?: { message?: string };
};

interface GraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowState {
  // metadata
  workflowId: string | null;
  name: string;
  updatedAt: string | null;
  // graph slice
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  // history slice
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  // ui slice
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /**
   * Set of nodes the user has explicitly multi-selected (e.g. shift-click in
   * React Flow, drag-select). Used by Run Selected. Always a superset of
   * `selectedNodeId` when non-empty so the canvas can highlight consistently.
   */
  multiSelectedNodeIds: string[];
  // run slice (Trigger.dev realtime + POST /runs)
  activeRunId: string | null;
  triggerRunId: string | null;
  publicAccessToken: string | null;
  runStatus: WorkflowRunUiStatus;
  nodeRunStatus: Record<string, NodeRunUiStatus>;
  nodeRunOutput: Record<string, NodeOutput>;
  nodeRunError: Record<string, string>;
  // actions
  hydrate: (payload: {
    workflowId: string;
    name: string;
    graph: WorkflowGraph;
    updatedAt: string;
  }) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, partialData: Record<string, unknown>) => void;
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
  setSelection: (selection: { nodeId?: string | null; edgeId?: string | null }) => void;
  setMultiSelection: (nodeIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  startRun: (args: {
    scope: 'FULL' | 'SELECTED' | 'SINGLE';
    selectedNodeIds: string[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  ingestRealtimeUpdate: (update: RealtimeRunIngestPayload) => void;
  hydrateRunFromServer: (workflowRunId: string) => Promise<void>;
  clearRun: () => void;
  // export helpers
  toGraph: () => WorkflowGraph;
}

/** Fresh run-slice fields for tests that fully reset store state (avoids shared `{}` refs). */
export function createRunSliceInitial(): Pick<
  WorkflowState,
  | 'activeRunId'
  | 'triggerRunId'
  | 'publicAccessToken'
  | 'runStatus'
  | 'nodeRunStatus'
  | 'nodeRunOutput'
  | 'nodeRunError'
> {
  return {
    activeRunId: null,
    triggerRunId: null,
    publicAccessToken: null,
    runStatus: 'idle',
    nodeRunStatus: {},
    nodeRunOutput: {},
    nodeRunError: {},
  };
}

function snapshot(state: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): GraphSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)) as WorkflowNode[],
    edges: JSON.parse(JSON.stringify(state.edges)) as WorkflowEdge[],
  };
}

function applyRunIngest(state: WorkflowState, update: RealtimeRunIngestPayload): void {
  if (update.taskIdentifier === 'workflow-run') {
    if (update.status === 'COMPLETED') {
      state.runStatus = 'success';
    } else if (
      update.status === 'FAILED' ||
      update.status === 'CRASHED' ||
      update.status === 'SYSTEM_FAILURE' ||
      update.status === 'TIMED_OUT' ||
      update.status === 'CANCELED' ||
      update.status === 'EXPIRED'
    ) {
      state.runStatus = 'failed';
    }
    return;
  }

  const nodeIdTag = update.tags?.find((t) => t.startsWith('nodeId:'));
  if (!nodeIdTag) return;
  const nodeId = nodeIdTag.slice('nodeId:'.length);

  const runningLike = new Set(['EXECUTING', 'DEQUEUED', 'WAITING']);
  const idleLike = new Set(['PENDING_VERSION', 'QUEUED', 'DELAYED']);
  const failedLike = new Set(['FAILED', 'CRASHED', 'SYSTEM_FAILURE', 'TIMED_OUT']);
  const skippedLike = new Set(['CANCELED', 'EXPIRED']);

  if (runningLike.has(update.status)) {
    state.nodeRunStatus[nodeId] = 'running';
  } else if (update.status === 'COMPLETED') {
    state.nodeRunStatus[nodeId] = 'success';
    if (update.output !== undefined) {
      state.nodeRunOutput[nodeId] = update.output as NodeOutput;
    }
  } else if (failedLike.has(update.status)) {
    state.nodeRunStatus[nodeId] = 'failed';
    state.nodeRunError[nodeId] = update.error?.message ?? 'Task failed';
  } else if (skippedLike.has(update.status)) {
    state.nodeRunStatus[nodeId] = 'skipped';
  } else if (idleLike.has(update.status)) {
    state.nodeRunStatus[nodeId] = 'idle';
  }
}

export const useWorkflowStore = create<WorkflowState>()(
  immer((set, get) => ({
    workflowId: null,
    name: '',
    updatedAt: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    multiSelectedNodeIds: [],
    ...createRunSliceInitial(),

    hydrate: ({ workflowId, name, graph, updatedAt }) =>
      set((state) => {
        state.workflowId = workflowId;
        state.name = name;
        state.updatedAt = updatedAt;
        state.nodes = layoutCompactPipeline(graph.nodes, graph.edges);
        state.edges = graph.edges;
        state.past = [];
        state.future = [];
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        const fresh = createRunSliceInitial();
        state.activeRunId = fresh.activeRunId;
        state.triggerRunId = fresh.triggerRunId;
        state.publicAccessToken = fresh.publicAccessToken;
        state.runStatus = fresh.runStatus;
        state.nodeRunStatus = fresh.nodeRunStatus;
        state.nodeRunOutput = fresh.nodeRunOutput;
        state.nodeRunError = fresh.nodeRunError;
      }),

    addNode: (node) =>
      set((state) => {
        state.past.push(snapshot(state));
        state.future = [];
        state.nodes.push(node);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
      }),

    removeNode: (nodeId) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        if (node.type === 'request-inputs' || node.type === 'response') return;
        state.past.push(snapshot(state));
        state.future = [];
        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
        if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
      }),

    updateNodeData: (nodeId, partialData) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        state.past.push(snapshot(state));
        state.future = [];
        node.data = { ...node.data, ...partialData } as typeof node.data;
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
      }),

    setNodePosition: (nodeId, position) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        node.position = position;
      }),

    addEdge: (edge) =>
      set((state) => {
        state.past.push(snapshot(state));
        state.future = [];
        state.edges.push(edge);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
      }),

    removeEdge: (edgeId) =>
      set((state) => {
        if (!state.edges.some((e) => e.id === edgeId)) return;
        state.past.push(snapshot(state));
        state.future = [];
        state.edges = state.edges.filter((e) => e.id !== edgeId);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
        if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
      }),

    setSelection: ({ nodeId, edgeId }) =>
      set((state) => {
        if (nodeId !== undefined) state.selectedNodeId = nodeId;
        if (edgeId !== undefined) state.selectedEdgeId = edgeId;
        // Single-click selection clears any prior multi-select set so the
        // run-button "Run Selected" doesn't silently reuse a stale set.
        if (nodeId !== undefined && nodeId !== null) {
          state.multiSelectedNodeIds = [];
        }
      }),

    setMultiSelection: (nodeIds) =>
      set((state) => {
        state.multiSelectedNodeIds = [...nodeIds];
        if (nodeIds.length === 1) {
          state.selectedNodeId = nodeIds[0];
        } else if (nodeIds.length === 0) {
          // Don't auto-clear single-select on empty multi to avoid fighting
          // with React Flow's own selection-change events on each click.
        }
      }),

    undo: () =>
      set((state) => {
        const previous = state.past.pop();
        if (!previous) return;
        state.future.push(snapshot(state));
        state.nodes = previous.nodes;
        state.edges = previous.edges;
      }),

    redo: () =>
      set((state) => {
        const next = state.future.pop();
        if (!next) return;
        state.past.push(snapshot(state));
        state.nodes = next.nodes;
        state.edges = next.edges;
      }),

    toGraph: () => {
      const s = get();
      return {
        schemaVersion: 1 as const,
        nodes: s.nodes,
        edges: s.edges,
      };
    },

    startRun: async ({ scope, selectedNodeIds }) => {
      const { workflowId, nodes } = get();
      if (!workflowId) return { ok: false, error: 'No workflow loaded' };

      // Harvest current request-inputs values from the live graph so that the
      // most-recently-typed values flow to the orchestrator even before the
      // background autosave has flushed them to the server.
      const inputs: Record<string, string | null> = {};
      for (const n of nodes) {
        if (n.type !== 'request-inputs') continue;
        for (const f of n.data.fields) {
          if (f.fieldType === 'text_field') {
            inputs[f.name] = f.value;
          } else {
            inputs[f.name] = f.value;
          }
        }
      }

      set((state) => {
        state.runStatus = 'starting';
        state.nodeRunStatus = {};
        state.nodeRunOutput = {};
        state.nodeRunError = {};
        state.activeRunId = null;
        state.triggerRunId = null;
        state.publicAccessToken = null;
      });

      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, selectedNodeIds, inputs }),
        });
        if (!res.ok) {
          const text = await res.text();
          set((s) => {
            s.runStatus = 'failed';
          });
          return { ok: false, error: text };
        }
        const data = (await res.json()) as {
          workflowRunId: string;
          triggerRunId: string;
          publicAccessToken: string;
        };
        set((s) => {
          s.activeRunId = data.workflowRunId;
          s.triggerRunId = data.triggerRunId;
          s.publicAccessToken = data.publicAccessToken;
          s.runStatus = 'running';
        });
        return { ok: true };
      } catch (err) {
        set((s) => {
          s.runStatus = 'failed';
        });
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    },

    ingestRealtimeUpdate: (update) =>
      set((state) => {
        applyRunIngest(state, update);
      }),

    hydrateRunFromServer: async (workflowRunId) => {
      try {
        const res = await fetch(`/api/runs/${workflowRunId}/nodes`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          nodes: Array<{
            nodeId: string;
            status: string;
            output: unknown;
            errorMessage: string | null;
          }>;
        };
        set((state) => {
          for (const n of body.nodes) {
            // Don't downgrade an already-known terminal status; just fill in
            // any missing outputs/errors that realtime didn't deliver (notably
            // the response node, whose value is captured server-side only).
            if (n.output !== null && n.output !== undefined) {
              state.nodeRunOutput[n.nodeId] = n.output as NodeOutput;
            }
            if (n.errorMessage) {
              state.nodeRunError[n.nodeId] = n.errorMessage;
            }
            if (!state.nodeRunStatus[n.nodeId]) {
              if (n.status === 'SUCCESS') state.nodeRunStatus[n.nodeId] = 'success';
              else if (n.status === 'FAILED') state.nodeRunStatus[n.nodeId] = 'failed';
              else if (n.status === 'SKIPPED') state.nodeRunStatus[n.nodeId] = 'skipped';
              else if (n.status === 'RUNNING') state.nodeRunStatus[n.nodeId] = 'running';
            }
          }
        });
      } catch {
        // best-effort; realtime is the primary path
      }
    },

    clearRun: () =>
      set((state) => {
        const fresh = createRunSliceInitial();
        state.activeRunId = fresh.activeRunId;
        state.triggerRunId = fresh.triggerRunId;
        state.publicAccessToken = fresh.publicAccessToken;
        state.runStatus = fresh.runStatus;
        state.nodeRunStatus = fresh.nodeRunStatus;
        state.nodeRunOutput = fresh.nodeRunOutput;
        state.nodeRunError = fresh.nodeRunError;
      }),
  })),
);
