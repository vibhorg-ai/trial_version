import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '../../schemas/node';
import type { WorkflowEdge } from '../../schemas/edge';
import { computeReady, type NodeRunStatus } from '../ready';

function gemini(id: string): WorkflowNode {
  return {
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
  };
}

function crop(id: string): WorkflowNode {
  return {
    id,
    type: 'crop-image',
    position: { x: 0, y: 0 },
    data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
  };
}

function response(id: string): WorkflowNode {
  return {
    id,
    type: 'response',
    position: { x: 0, y: 0 },
    data: { capturedValue: null },
  };
}

function statuses(entries: [string, NodeRunStatus][]): ReadonlyMap<string, NodeRunStatus> {
  return new Map(entries);
}

describe('computeReady', () => {
  it('empty graph → empty ready set', () => {
    expect(computeReady({ nodes: [], edges: [] }, new Map())).toEqual([]);
  });

  it('all nodes PENDING (including default when missing from map), no edges → all nodes ready', () => {
    const nodes = [crop('a'), crop('b')];
    expect(computeReady({ nodes, edges: [] }, new Map())).toEqual(['a', 'b']);
  });

  it('linear chain A→B→C, all PENDING → only A ready', () => {
    const a = crop('A');
    const b = crop('B');
    const c = crop('C');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e2',
        source: 'B',
        target: 'C',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(computeReady({ nodes: [a, b, c], edges }, new Map())).toEqual(['A']);
  });

  it('A SUCCESS, B and C PENDING in chain A→B→C → B ready, C not', () => {
    const a = crop('A');
    const b = crop('B');
    const c = crop('C');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e2',
        source: 'B',
        target: 'C',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    const st = statuses([
      ['A', 'success'],
      ['B', 'pending'],
      ['C', 'pending'],
    ]);
    expect(computeReady({ nodes: [a, b, c], edges }, st)).toEqual(['B']);
  });

  it('A RUNNING, B PENDING in chain A→B → no nodes ready', () => {
    const a = crop('A');
    const b = crop('B');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(computeReady({ nodes: [a, b], edges }, statuses([['A', 'running']]))).toEqual([]);
  });

  it('A FAILED, B PENDING in chain A→B → no nodes ready (B blocked)', () => {
    const a = crop('A');
    const b = crop('B');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(computeReady({ nodes: [a, b], edges }, statuses([['A', 'failed']]))).toEqual([]);
  });

  it('A SUCCESS, B SUCCESS in chain A→B→C → C ready', () => {
    const a = crop('A');
    const b = crop('B');
    const c = crop('C');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e2',
        source: 'B',
        target: 'C',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(
      computeReady(
        { nodes: [a, b, c], edges },
        statuses([
          ['A', 'success'],
          ['B', 'success'],
        ]),
      ),
    ).toEqual(['C']);
  });

  it('diamond: A,B,C SUCCESS, D PENDING → D ready', () => {
    const nodes = [crop('A'), crop('B'), crop('C'), crop('D')];
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e2',
        source: 'A',
        target: 'C',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e3',
        source: 'B',
        target: 'D',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e4',
        source: 'C',
        target: 'D',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(
      computeReady(
        { nodes, edges },
        statuses([
          ['A', 'success'],
          ['B', 'success'],
          ['C', 'success'],
        ]),
      ),
    ).toEqual(['D']);
  });

  it('diamond: A,B SUCCESS, C RUNNING, D PENDING → no nodes ready', () => {
    const nodes = [crop('A'), crop('B'), crop('C'), crop('D')];
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e2',
        source: 'A',
        target: 'C',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e3',
        source: 'B',
        target: 'D',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      {
        id: 'e4',
        source: 'C',
        target: 'D',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(
      computeReady(
        { nodes, edges },
        statuses([
          ['A', 'success'],
          ['B', 'success'],
          ['C', 'running'],
        ]),
      ),
    ).toEqual([]);
  });

  it('excludes already-finished nodes: A,B SUCCESS, C PENDING, no edges → only C', () => {
    const nodes = [crop('A'), crop('B'), crop('C')];
    expect(
      computeReady(
        { nodes, edges: [] },
        statuses([
          ['A', 'success'],
          ['B', 'success'],
        ]),
      ),
    ).toEqual(['C']);
  });

  it('Gemini vision: two image sources both to vision — both SUCCESS → Gemini ready', () => {
    const img1 = crop('img1');
    const img2 = crop('img2');
    const g = gemini('gem');
    const nodes = [img1, img2, g];
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'img1',
        target: 'gem',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
      {
        id: 'e2',
        source: 'img2',
        target: 'gem',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
    ];
    expect(
      computeReady(
        { nodes, edges },
        statuses([
          ['img1', 'success'],
          ['img2', 'success'],
        ]),
      ),
    ).toEqual(['gem']);
  });

  it('Gemini vision: two sources — only one SUCCESS → Gemini not ready (other roots may still be ready)', () => {
    const img1 = crop('img1');
    const img2 = crop('img2');
    const g = gemini('gem');
    const nodes = [img1, img2, g];
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'img1',
        target: 'gem',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
      {
        id: 'e2',
        source: 'img2',
        target: 'gem',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
    ];
    const ready = computeReady({ nodes, edges }, statuses([['img1', 'success']]));
    expect(ready).not.toContain('gem');
    expect(ready).toEqual(['img2']);
  });

  it('A SKIPPED blocks downstream like FAILED', () => {
    const a = crop('A');
    const b = crop('B');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'A',
        target: 'B',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
    ];
    expect(computeReady({ nodes: [a, b], edges }, statuses([['A', 'skipped']]))).toEqual([]);
  });

  it('returns ready ids in stable graph.nodes order when multiple are ready', () => {
    const nodes: WorkflowNode[] = [response('third'), crop('first'), crop('second')];
    expect(computeReady({ nodes, edges: [] }, new Map())).toEqual(['third', 'first', 'second']);
  });
});
