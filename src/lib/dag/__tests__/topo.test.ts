import { describe, it, expect } from 'vitest';
import type { WorkflowEdge } from '../../schemas/edge';
import type { WorkflowGraph } from '../../schemas/workflow';
import type { WorkflowNode } from '../../schemas/node';
import { topoOrder } from '../topo';

/** Minimal gemini nodes — valid `WorkflowNode` with handles usable for text edges. */
const gemini = (id: string): WorkflowNode => ({
  id,
  type: 'gemini',
  position: { x: 0, y: 0 },
  data: {
    model: 'gemini-1.5-pro',
    prompt: '',
    systemPrompt: '',
    temperature: 0.7,
    maxOutputTokens: 2048,
    topP: 0.95,
  },
});

const geminiEdge = (id: string, source: string, target: string): WorkflowEdge => ({
  id,
  source,
  target,
  sourceHandle: 'response',
  targetHandle: 'prompt',
});

type GraphSlice = Pick<WorkflowGraph, 'nodes' | 'edges'>;

describe('topoOrder', () => {
  it('empty graph (no nodes, no edges) → []', () => {
    expect(topoOrder({ nodes: [], edges: [] })).toEqual([]);
  });

  it('single isolated node → [that id]', () => {
    const graph: GraphSlice = { nodes: [gemini('A')], edges: [] };
    expect(topoOrder(graph)).toEqual(['A']);
  });

  it('two isolated nodes → both in input-array order', () => {
    const graph: GraphSlice = {
      nodes: [gemini('A'), gemini('B')],
      edges: [],
    };
    expect(topoOrder(graph)).toEqual(['A', 'B']);
  });

  it('linear chain A → B → C → [A, B, C]', () => {
    const graph: GraphSlice = {
      nodes: [gemini('A'), gemini('B'), gemini('C')],
      edges: [geminiEdge('e1', 'A', 'B'), geminiEdge('e2', 'B', 'C')],
    };
    expect(topoOrder(graph)).toEqual(['A', 'B', 'C']);
  });

  it('diamond: A first, D last; B and C between in stable order', () => {
    const graph: GraphSlice = {
      nodes: [gemini('A'), gemini('B'), gemini('C'), gemini('D')],
      edges: [
        geminiEdge('e1', 'A', 'B'),
        geminiEdge('e2', 'A', 'C'),
        geminiEdge('e3', 'B', 'D'),
        geminiEdge('e4', 'C', 'D'),
      ],
    };
    expect(topoOrder(graph)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('throws on cycle (A ↔ B)', () => {
    const graph: GraphSlice = {
      nodes: [gemini('A'), gemini('B')],
      edges: [geminiEdge('e1', 'A', 'B'), geminiEdge('e2', 'B', 'A')],
    };
    expect(() => topoOrder(graph)).toThrow(/cycle/i);
  });

  it('stable order: equally-ready nodes follow input `nodes` array order', () => {
    const graph: GraphSlice = {
      nodes: [gemini('second'), gemini('first')],
      edges: [],
    };
    expect(topoOrder(graph)).toEqual(['second', 'first']);
  });
});
