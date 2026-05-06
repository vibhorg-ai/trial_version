import { describe, it, expect } from 'vitest';
import { DEMO_WORKFLOW_GRAPH, DEMO_WORKFLOW_NAME } from '../demo-workflow';
import { WorkflowGraphSchema } from '../schemas/workflow';
import { hasCycle } from '../dag/cycle';
import { topoOrder } from '../dag/topo';
import { canConnectByIds } from '../dag/handles';
import { DEFAULT_GEMINI_MODEL_ID } from '../gemini-model';

describe('DEMO_WORKFLOW_GRAPH', () => {
  it('has the expected name constant', () => {
    expect(DEMO_WORKFLOW_NAME).toBe('Demo — Walkthrough');
  });

  it('passes WorkflowGraphSchema validation', () => {
    const result = WorkflowGraphSchema.safeParse(DEMO_WORKFLOW_GRAPH);
    expect(result.success).toBe(true);
  });

  it('is a compact linear pipeline (4 nodes, 4 edges)', () => {
    expect(DEMO_WORKFLOW_GRAPH.nodes).toHaveLength(4);
    expect(DEMO_WORKFLOW_GRAPH.edges).toHaveLength(4);
  });

  it('uses the default Gemini model id', () => {
    const gemini = DEMO_WORKFLOW_GRAPH.nodes.find((n) => n.type === 'gemini');
    expect(gemini?.type).toBe('gemini');
    if (gemini?.type === 'gemini') {
      expect(gemini.data.model).toBe(DEFAULT_GEMINI_MODEL_ID);
    }
  });

  it('is acyclic', () => {
    expect(hasCycle(DEMO_WORKFLOW_GRAPH.edges)).toBe(false);
  });

  it('has every edge type-compatible per canConnectByIds', () => {
    const nodeById = new Map(DEMO_WORKFLOW_GRAPH.nodes.map((n) => [n.id, n]));
    for (const edge of DEMO_WORKFLOW_GRAPH.edges) {
      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);
      expect(sourceNode).toBeDefined();
      expect(targetNode).toBeDefined();
      const result = canConnectByIds(
        sourceNode!,
        edge.sourceHandle,
        targetNode!,
        edge.targetHandle,
      );
      expect(result).toEqual({ ok: true });
    }
  });

  it('topologically sorts request-inputs → crop → gemini → response', () => {
    const order = topoOrder(DEMO_WORKFLOW_GRAPH);
    expect(order).toEqual(['demo-request-inputs', 'demo-crop', 'demo-gemini', 'demo-response']);
  });
});
