import { describe, it, expect } from 'vitest';
import { SAMPLE_WORKFLOW_GRAPH, SAMPLE_WORKFLOW_NAME } from '../sample-workflow';
import { WorkflowGraphSchema } from '../schemas/workflow';
import { hasCycle } from '../dag/cycle';
import { topoOrder } from '../dag/topo';
import { canConnectByIds } from '../dag/handles';

describe('SAMPLE_WORKFLOW_GRAPH', () => {
  it('has the expected name', () => {
    expect(SAMPLE_WORKFLOW_NAME).toBe('Wireless Headphones Marketing');
  });

  it('passes WorkflowGraphSchema validation', () => {
    const result = WorkflowGraphSchema.safeParse(SAMPLE_WORKFLOW_GRAPH);
    expect(result.success).toBe(true);
  });

  it('has exactly 7 nodes and 8 edges', () => {
    expect(SAMPLE_WORKFLOW_GRAPH.nodes).toHaveLength(7);
    expect(SAMPLE_WORKFLOW_GRAPH.edges).toHaveLength(8);
  });

  it('contains the four expected node types', () => {
    const types = SAMPLE_WORKFLOW_GRAPH.nodes.map((n) => n.type).sort();
    expect(types).toEqual([
      'crop-image',
      'crop-image',
      'gemini',
      'gemini',
      'gemini',
      'request-inputs',
      'response',
    ]);
  });

  it('uses the effective Gemini model for every Gemini node', () => {
    const geminiNodes = SAMPLE_WORKFLOW_GRAPH.nodes.filter((n) => n.type === 'gemini');
    expect(geminiNodes).toHaveLength(3);
    expect(geminiNodes.every((n) => n.data.model === 'gemini-2.5-flash-lite')).toBe(true);
  });

  it('is acyclic', () => {
    expect(hasCycle(SAMPLE_WORKFLOW_GRAPH.edges)).toBe(false);
  });

  it('has every edge type-compatible per canConnectByIds', () => {
    const nodeById = new Map(SAMPLE_WORKFLOW_GRAPH.nodes.map((n) => [n.id, n]));
    for (const edge of SAMPLE_WORKFLOW_GRAPH.edges) {
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

  it('topologically sorts cleanly', () => {
    const order = topoOrder(SAMPLE_WORKFLOW_GRAPH);
    expect(order).toHaveLength(7);
    expect(order[0]).toBe('request-inputs');
    expect(order[order.length - 1]).toBe('response');
  });
});
