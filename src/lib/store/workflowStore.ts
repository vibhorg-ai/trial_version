import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WorkflowGraph } from '../schemas/workflow';
import type { WorkflowNode } from '../schemas/node';
import type { WorkflowEdge } from '../schemas/edge';

const HISTORY_LIMIT = 50;

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
  // export helpers
  toGraph: () => WorkflowGraph;
}

function snapshot(state: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): GraphSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)) as WorkflowNode[],
    edges: JSON.parse(JSON.stringify(state.edges)) as WorkflowEdge[],
  };
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
  })),
);
