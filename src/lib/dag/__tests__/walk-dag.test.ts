import { describe, expect, it, vi } from 'vitest';

import type { WorkflowGraph } from '../../schemas/workflow';
import type { WorkflowNode } from '../../schemas/node';
import { WORKFLOW_SCHEMA_VERSION } from '../../schemas/workflow';
import { OutputStore } from '../resolve';
import type { ResolvedInputs } from '../resolve';
import { walkDag, type DagFireOutput } from '../walk-dag';

function gemini(id: string): WorkflowNode {
  return {
    id,
    type: 'gemini',
    position: { x: 0, y: 0 },
    data: {
      model: 'gemini-1.5-pro',
      prompt: 'p',
      systemPrompt: '',
      temperature: 0.7,
      maxOutputTokens: 128,
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

const graph = (nodes: WorkflowNode[], edges: WorkflowGraph['edges']): WorkflowGraph => ({
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  nodes,
  edges,
});

async function passthroughFire(
  _node: WorkflowNode,
  _inputs: ResolvedInputs,
): Promise<DagFireOutput> {
  if (_node.type === 'crop-image') {
    return { kind: 'image', url: 'https://example.com/out.jpg' };
  }
  return { kind: 'text', text: 'ok' };
}

describe('walkDag', () => {
  it('returns an empty map for an empty graph', async () => {
    const store = new OutputStore();
    const g = graph([], []);
    const m = await walkDag({ graph: g, store, fireFn: passthroughFire });
    expect(m.size).toBe(0);
  });

  it('runs a linear chain a→b→c with all SUCCESS', async () => {
    const store = new OutputStore();
    store.set('a', 'output-image', 'https://x/a.jpg');
    const g = graph(
      [crop('a'), gemini('b'), gemini('c'), response('r')],
      [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        { id: 'e2', source: 'b', target: 'c', sourceHandle: 'response', targetHandle: 'prompt' },
        {
          id: 'e3',
          source: 'c',
          target: 'r',
          sourceHandle: 'response',
          targetHandle: 'result',
        },
      ],
    );
    const m = await walkDag({
      graph: g,
      store,
      fireFn: passthroughFire,
      initialStatusOverrides: new Map([['a', 'success']]),
      onResponseDetail: async () => {},
    });
    expect(m.get('a')).toBe('SUCCESS');
    expect(m.get('b')).toBe('SUCCESS');
    expect(m.get('c')).toBe('SUCCESS');
    expect(m.get('r')).toBe('SUCCESS');
  });

  it('runs diamond branches in parallel (wall-clock ~50ms, not ~100ms)', async () => {
    vi.useFakeTimers();
    const store = new OutputStore();
    store.set('a', 'output-image', 'https://x/a.jpg');
    const started: Record<string, number> = {};
    const g = graph(
      [crop('a'), gemini('b'), gemini('c'), gemini('d')],
      [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        {
          id: 'e2',
          source: 'a',
          target: 'c',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        { id: 'e3', source: 'b', target: 'd', sourceHandle: 'response', targetHandle: 'prompt' },
        { id: 'e4', source: 'c', target: 'd', sourceHandle: 'response', targetHandle: 'system' },
      ],
    );

    const fireFn = async (node: WorkflowNode) => {
      started[node.id] = Date.now();
      await new Promise<void>((r) => setTimeout(r, 50));
      return passthroughFire(node, {} as ResolvedInputs);
    };

    const p = walkDag({
      graph: g,
      store,
      fireFn,
      initialStatusOverrides: new Map([['a', 'success']]),
    });

    await vi.advanceTimersByTimeAsync(1);
    expect(started.b).toBeDefined();
    expect(started.c).toBeDefined();
    const delta = Math.abs(started.b! - started.c!);
    expect(delta).toBeLessThan(15);

    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(50);
    await vi.runAllTimersAsync();
    const m = await p;
    expect(m.get('b')).toBe('SUCCESS');
    expect(m.get('c')).toBe('SUCCESS');
    expect(m.get('d')).toBe('SUCCESS');

    vi.useRealTimers();
  });

  it('marks downstream SKIPPED when middle node fails in a→b→c', async () => {
    const store = new OutputStore();
    store.set('a', 'output-image', 'https://x/a.jpg');
    const g = graph(
      [crop('a'), gemini('b'), gemini('c')],
      [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        { id: 'e2', source: 'b', target: 'c', sourceHandle: 'response', targetHandle: 'prompt' },
      ],
    );
    const m = await walkDag({
      graph: g,
      store,
      fireFn: async (node) => {
        if (node.id === 'b') {
          throw new Error('boom');
        }
        return { kind: 'text', text: 'x' };
      },
      initialStatusOverrides: new Map([['a', 'success']]),
    });
    expect(m.get('b')).toBe('FAILED');
    expect(m.get('c')).toBe('SKIPPED');
  });

  it('skips nodes outside scoped whitelist', async () => {
    const store = new OutputStore();
    const g = graph([gemini('x'), gemini('y')], []);
    const m = await walkDag({
      graph: g,
      store,
      fireFn: passthroughFire,
      scopedNodeIds: new Set(['y']),
    });
    expect(m.get('x')).toBe('SKIPPED');
    expect(m.get('y')).toBe('SUCCESS');
  });

  it('fires two ready roots concurrently', async () => {
    vi.useFakeTimers();
    const store = new OutputStore();
    const g = graph([crop('a'), crop('b')], []);
    const starts: number[] = [];
    const fireFn = async (node: WorkflowNode) => {
      starts.push(Date.now());
      await new Promise<void>((r) => setTimeout(r, 20));
      return { kind: 'image' as const, url: `https://x/${node.id}.jpg` };
    };
    const p = walkDag({ graph: g, store, fireFn });
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    await p;
    expect(starts.length).toBe(2);
    vi.useRealTimers();
  });

  it('starts a dependent as soon as its predecessor finishes (Gemini-after-Gemini)', async () => {
    const store = new OutputStore();
    store.set('root', 'output-image', 'https://x/r.jpg');
    const g = graph(
      [crop('root'), gemini('slow'), gemini('fast'), gemini('chain')],
      [
        {
          id: 'e1',
          source: 'root',
          target: 'slow',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        {
          id: 'e2',
          source: 'root',
          target: 'fast',
          sourceHandle: 'output-image',
          targetHandle: 'vision',
        },
        {
          id: 'e3',
          source: 'fast',
          target: 'chain',
          sourceHandle: 'response',
          targetHandle: 'prompt',
        },
      ],
    );

    let chainStart = 0;
    let fastEnd = 0;

    await walkDag({
      graph: g,
      store,
      fireFn: async (node) => {
        if (node.id === 'slow') {
          await new Promise<void>((r) => setTimeout(r, 80));
          return { kind: 'text', text: 'slow' };
        }
        if (node.id === 'fast') {
          await new Promise<void>((r) => setTimeout(r, 5));
          const out = { kind: 'text' as const, text: 'fast' };
          fastEnd = Date.now();
          return out;
        }
        if (node.id === 'chain') {
          chainStart = Date.now();
          return { kind: 'text', text: 'ch' };
        }
        return passthroughFire(node, {} as ResolvedInputs);
      },
      initialStatusOverrides: new Map([['root', 'success']]),
    });

    expect(chainStart).toBeGreaterThan(0);
    expect(fastEnd).toBeGreaterThan(0);
    expect(chainStart - fastEnd).toBeLessThan(40);
  });

  it('invokes onResponseDetail with resolved result', async () => {
    const store = new OutputStore();
    store.set('g', 'response', 'hello');
    const g = graph(
      [gemini('g'), response('r')],
      [{ id: 'e', source: 'g', target: 'r', sourceHandle: 'response', targetHandle: 'result' }],
    );
    const initial = new Map([['g', 'success' as const]]);
    const spy = vi.fn();
    const m = await walkDag({
      graph: g,
      store,
      fireFn: passthroughFire,
      initialStatusOverrides: initial,
      onResponseDetail: spy,
    });
    expect(m.get('r')).toBe('SUCCESS');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'r', type: 'response' }), {
      ok: true,
      result: 'hello',
    });
  });
});
