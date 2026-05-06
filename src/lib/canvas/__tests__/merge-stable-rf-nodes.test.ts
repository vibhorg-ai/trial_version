import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import { mergeStableRfNodes } from '../merge-stable-rf-nodes';
import type { WorkflowNode } from '../../schemas/node';

const geminiData = {
  model: 'gemini-2.5-flash-lite',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

function wf(
  id: string,
  x: number,
  y: number,
  type: 'request-inputs' | 'gemini' = 'gemini',
): WorkflowNode {
  if (type === 'request-inputs') {
    return { id, type: 'request-inputs', position: { x, y }, data: { fields: [] } };
  }
  return { id, type: 'gemini', position: { x, y }, data: geminiData };
}

describe('mergeStableRfNodes', () => {
  it('reuses the same Node instance for siblings when only one drag override moves', () => {
    const domain: WorkflowNode[] = [
      wf('a', 0, 0, 'request-inputs'),
      wf('b', 100, 0),
      wf('c', 200, 0),
    ];
    const prev: Node[] = [
      {
        id: 'a',
        type: 'request-inputs',
        position: { x: 0, y: 0 },
        data: domain[0]!.data,
        selected: false,
      },
      {
        id: 'b',
        type: 'gemini',
        position: { x: 100, y: 0 },
        data: domain[1]!.data,
        selected: false,
      },
      {
        id: 'c',
        type: 'gemini',
        position: { x: 200, y: 0 },
        data: domain[2]!.data,
        selected: false,
      },
    ];

    const overrides = new Map<string, { x: number; y: number }>([['b', { x: 120, y: 5 }]]);
    const next = mergeStableRfNodes(prev, domain, overrides, null);

    expect(next[0]).toBe(prev[0]);
    expect(next[2]).toBe(prev[2]);
    expect(next[1]).not.toBe(prev[1]);
    expect(next[1]!.position).toEqual({ x: 120, y: 5 });
  });

  it('creates fresh nodes when prev is empty', () => {
    const domain: WorkflowNode[] = [wf('b', 10, 20)];
    const next = mergeStableRfNodes([], domain, new Map(), null);
    expect(next).toHaveLength(1);
    expect(next[0]!.position).toEqual({ x: 10, y: 20 });
  });
});
