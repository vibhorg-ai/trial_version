import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WorkflowGraph } from '../schemas/workflow';
import type { WorkflowNode } from '../schemas/node';
import type { WorkflowEdge } from '../schemas/edge';
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
  undo: () => void;
  redo: () => void;
  startRun: (args: {
    scope: 'FULL' | 'SELECTED' | 'SINGLE';
    selectedNodeIds: string[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  ingestRealtimeUpdate: (update: RealtimeRunIngestPayload) => void;
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
    ...createRunSliceInitial(),

    hydrate: ({ workflowId, name, graph, updatedAt }) =>
      set((state) => {
        state.workflowId = workflowId;
        state.name = name;
        state.updatedAt = updatedAt;
        state.nodes = graph.nodes;
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
      const { workflowId } = get();
      if (!workflowId) return { ok: false, error: 'No workflow loaded' };

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
          body: JSON.stringify({ scope, selectedNodeIds, inputs: {} }),
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
