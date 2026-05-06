import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
} as const;

const baseGraph = {
  schemaVersion: 1 as const,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs' as const,
      position: { x: 0, y: 0 },
      data: { fields: [] },
    },
    {
      id: 'response',
      type: 'response' as const,
      position: { x: 800, y: 0 },
      data: { capturedValue: null },
    },
  ],
  edges: [],
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: null,
    name: '',
    updatedAt: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
  });
});

describe('workflowStore', () => {
  describe('hydrate', () => {
    it('sets metadata and graph', () => {
      useWorkflowStore.getState().hydrate({
        workflowId: 'wf1',
        name: 'My WF',
        graph: baseGraph,
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
      const s = useWorkflowStore.getState();
      expect(s.workflowId).toBe('wf1');
      expect(s.name).toBe('My WF');
      expect(s.nodes).toHaveLength(2);
      expect(s.edges).toHaveLength(0);
      expect(s.past).toHaveLength(0);
      expect(s.future).toHaveLength(0);
    });
  });

  describe('addNode', () => {
    it('appends a node and pushes a history entry', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 100, y: 100 },
        data: { ...geminiData },
      });
      expect(useWorkflowStore.getState().nodes).toHaveLength(3);
      expect(useWorkflowStore.getState().past).toHaveLength(1);
    });

    it('clears future after a new addition', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'a',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: {
          model: 'm',
          prompt: '',
          systemPrompt: '',
          temperature: 0.7,
          maxOutputTokens: 256,
          topP: 0.95,
        },
      });
      s.undo();
      expect(useWorkflowStore.getState().future).toHaveLength(1);
      s.addNode({
        id: 'b',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: {
          model: 'm',
          prompt: '',
          systemPrompt: '',
          temperature: 0.7,
          maxOutputTokens: 256,
          topP: 0.95,
        },
      });
      expect(useWorkflowStore.getState().future).toHaveLength(0);
    });
  });

  describe('removeNode', () => {
    it('removes a node and its incident edges', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 100, y: 100 },
        data: { ...geminiData },
      });
      s.addEdge({
        id: 'e1',
        source: 'gem1',
        target: 'response',
        sourceHandle: 'response',
        targetHandle: 'result',
      });
      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      s.removeNode('gem1');
      expect(useWorkflowStore.getState().nodes.some((n) => n.id === 'gem1')).toBe(false);
      expect(useWorkflowStore.getState().edges).toHaveLength(0);
    });

    it('refuses to remove request-inputs', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().removeNode('request-inputs');
      expect(useWorkflowStore.getState().nodes.some((n) => n.id === 'request-inputs')).toBe(true);
    });

    it('refuses to remove response', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().removeNode('response');
      expect(useWorkflowStore.getState().nodes.some((n) => n.id === 'response')).toBe(true);
    });

    it('clears selection if removed node was selected', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      s.setSelection({ nodeId: 'gem1' });
      s.removeNode('gem1');
      expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('updateNodeData', () => {
    it('merges partial data into the node', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().updateNodeData('response', { capturedValue: 'foo' });
      const response = useWorkflowStore.getState().nodes.find((n) => n.id === 'response');
      expect(response?.type).toBe('response');
      if (response?.type === 'response') {
        expect(response.data.capturedValue).toBe('foo');
      }
    });

    it('pushes a history entry', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().updateNodeData('response', { capturedValue: 'foo' });
      expect(useWorkflowStore.getState().past).toHaveLength(1);
    });

    it('no-ops on unknown id', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      const before = useWorkflowStore.getState().nodes;
      useWorkflowStore.getState().updateNodeData('nope', { x: 1 });
      expect(useWorkflowStore.getState().nodes).toBe(before);
      expect(useWorkflowStore.getState().past).toHaveLength(0);
    });
  });

  describe('setNodePosition', () => {
    it('updates position WITHOUT pushing history', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      const pastBefore = useWorkflowStore.getState().past.length;
      useWorkflowStore.getState().setNodePosition('response', { x: 5, y: 5 });
      expect(useWorkflowStore.getState().past.length).toBe(pastBefore);
      const response = useWorkflowStore.getState().nodes.find((n) => n.id === 'response');
      expect(response?.position).toEqual({ x: 5, y: 5 });
    });
  });

  describe('addEdge', () => {
    it('appends edge and pushes history', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      const pastLen = useWorkflowStore.getState().past.length;
      s.addEdge({
        id: 'e1',
        source: 'gem1',
        target: 'response',
        sourceHandle: 'response',
        targetHandle: 'result',
      });
      expect(useWorkflowStore.getState().edges).toHaveLength(1);
      expect(useWorkflowStore.getState().past.length).toBe(pastLen + 1);
    });
  });

  describe('removeEdge', () => {
    it('removes edge by id', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      s.addEdge({
        id: 'e1',
        source: 'gem1',
        target: 'response',
        sourceHandle: 'response',
        targetHandle: 'result',
      });
      s.removeEdge('e1');
      expect(useWorkflowStore.getState().edges).toHaveLength(0);
    });

    it('clears selectedEdgeId if it matched', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      s.addEdge({
        id: 'e1',
        source: 'gem1',
        target: 'response',
        sourceHandle: 'response',
        targetHandle: 'result',
      });
      s.setSelection({ edgeId: 'e1' });
      s.removeEdge('e1');
      expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
    });
  });

  describe('undo / redo', () => {
    it('undo restores previous nodes/edges and moves current to future', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      expect(useWorkflowStore.getState().nodes).toHaveLength(3);
      s.undo();
      expect(useWorkflowStore.getState().nodes).toHaveLength(2);
      expect(useWorkflowStore.getState().future).toHaveLength(1);
    });

    it('redo replays future state', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
      });
      s.undo();
      s.redo();
      expect(useWorkflowStore.getState().nodes.some((n) => n.id === 'gem1')).toBe(true);
      expect(useWorkflowStore.getState().future).toHaveLength(0);
    });

    it('undo no-ops when past is empty', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      const snap = useWorkflowStore.getState().nodes;
      useWorkflowStore.getState().undo();
      expect(useWorkflowStore.getState().nodes).toEqual(snap);
      expect(useWorkflowStore.getState().future).toHaveLength(0);
    });

    it('redo no-ops when future is empty', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      const snap = useWorkflowStore.getState().nodes;
      useWorkflowStore.getState().redo();
      expect(useWorkflowStore.getState().nodes).toEqual(snap);
    });

    it('history is limited to HISTORY_LIMIT entries', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      for (let i = 0; i < 60; i++) {
        s.addNode({
          id: `gem-${i}`,
          type: 'gemini',
          position: { x: i, y: 0 },
          data: { ...geminiData },
        });
      }
      expect(useWorkflowStore.getState().past.length).toBe(50);
    });
  });

  describe('setSelection', () => {
    it('updates selectedNodeId only', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().setSelection({ edgeId: 'e0' });
      useWorkflowStore.getState().setSelection({ nodeId: 'response' });
      const st = useWorkflowStore.getState();
      expect(st.selectedNodeId).toBe('response');
      expect(st.selectedEdgeId).toBe('e0');
    });

    it('updates selectedEdgeId only', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().setSelection({ nodeId: 'response' });
      useWorkflowStore.getState().setSelection({ edgeId: 'e99' });
      const st = useWorkflowStore.getState();
      expect(st.selectedNodeId).toBe('response');
      expect(st.selectedEdgeId).toBe('e99');
    });

    it('updates both', () => {
      useWorkflowStore
        .getState()
        .hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      useWorkflowStore.getState().setSelection({ nodeId: 'n1', edgeId: 'e1' });
      const st = useWorkflowStore.getState();
      expect(st.selectedNodeId).toBe('n1');
      expect(st.selectedEdgeId).toBe('e1');
    });
  });

  describe('toGraph', () => {
    it('returns a WorkflowGraph with schemaVersion 1, current nodes, and edges', () => {
      const s = useWorkflowStore.getState();
      s.hydrate({ workflowId: 'wf1', name: '', graph: baseGraph, updatedAt: '' });
      s.addNode({
        id: 'gem1',
        type: 'gemini',
        position: { x: 1, y: 2 },
        data: { ...geminiData },
      });
      const g = useWorkflowStore.getState().toGraph();
      expect(g.schemaVersion).toBe(1);
      expect(g.nodes).toHaveLength(3);
      expect(g.edges).toEqual([]);
      expect(g.nodes[2]).toMatchObject({ id: 'gem1', type: 'gemini', position: { x: 1, y: 2 } });
    });
  });
});
