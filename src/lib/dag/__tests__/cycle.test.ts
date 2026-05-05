import { describe, it, expect } from 'vitest';
import type { WorkflowEdge } from '../../schemas/edge';
import { hasCycle } from '../cycle';

const edge = (id: string, source: string, target: string): WorkflowEdge => ({
  id,
  source,
  target,
  sourceHandle: 'out',
  targetHandle: 'in',
});

describe('hasCycle', () => {
  it('no edges → no cycle', () => {
    expect(hasCycle([])).toBe(false);
  });

  it('linear chain → no cycle', () => {
    expect(hasCycle([edge('e1', 'A', 'B'), edge('e2', 'B', 'C')])).toBe(false);
  });

  it('tree (fan-out) → no cycle', () => {
    expect(hasCycle([edge('e1', 'A', 'B'), edge('e2', 'A', 'C')])).toBe(false);
  });

  it('diamond (join) → no cycle', () => {
    expect(
      hasCycle([
        edge('e1', 'A', 'B'),
        edge('e2', 'A', 'C'),
        edge('e3', 'B', 'D'),
        edge('e4', 'C', 'D'),
      ]),
    ).toBe(false);
  });

  it('self-loop → cycle', () => {
    expect(hasCycle([edge('e1', 'A', 'A')])).toBe(true);
  });

  it('direct 2-node cycle → cycle', () => {
    expect(hasCycle([edge('e1', 'A', 'B'), edge('e2', 'B', 'A')])).toBe(true);
  });

  it('triangle cycle → cycle', () => {
    expect(hasCycle([edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')])).toBe(true);
  });

  it('cycle in larger graph → cycle', () => {
    expect(
      hasCycle([
        edge('e1', 'A', 'B'),
        edge('e2', 'B', 'C'),
        edge('e3', 'C', 'D'),
        edge('e4', 'D', 'B'),
      ]),
    ).toBe(true);
  });

  it('disconnected components, one acyclic + one cyclic → cycle', () => {
    expect(hasCycle([edge('e1', 'P', 'Q'), edge('e2', 'X', 'Y'), edge('e3', 'Y', 'X')])).toBe(true);
  });

  it('disconnected components, both acyclic → no cycle', () => {
    expect(hasCycle([edge('e1', 'P', 'Q'), edge('e2', 'R', 'S')])).toBe(false);
  });
});
