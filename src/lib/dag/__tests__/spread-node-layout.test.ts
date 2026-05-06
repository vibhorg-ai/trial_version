import { describe, it, expect } from 'vitest';
import { layoutHorizontalWorkflowTree } from '../spread-node-layout';
import type { WorkflowNode } from '../../schemas/node';
import type { WorkflowEdge } from '../../schemas/edge';

const geminiData = {
  model: 'gemini-2.5-flash-lite',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

/** Must match `estimateNodeHeight` in spread-node-layout for these types. */
const H = {
  request: 280,
  gemini: 900,
  response: 240,
  crop: 380,
} as const;

describe('layoutHorizontalWorkflowTree', () => {
  it('lays a linear chain in separate columns with vertically aligned workflow spine', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'a',
        type: 'request-inputs',
        position: { x: 0, y: 0 },
        data: { fields: [] },
      },
      {
        id: 'b',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      },
      {
        id: 'c',
        type: 'response',
        position: { x: 0, y: 0 },
        data: { capturedValue: null },
      },
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'x', targetHandle: 'prompt' },
      { id: 'e2', source: 'b', target: 'c', sourceHandle: 'response', targetHandle: 'result' },
    ];
    const out = layoutHorizontalWorkflowTree(nodes, edges);
    const pa = out.find((n) => n.id === 'a')!.position;
    const pb = out.find((n) => n.id === 'b')!.position;
    const pc = out.find((n) => n.id === 'c')!.position;

    expect(pa.x).toBeLessThan(pb.x);
    expect(pb.x).toBeLessThan(pc.x);

    const center = (y: number, h: number) => y + h / 2;
    // Start, middle, and end share the same vertical midline (no “last column riding high”).
    const midA = center(pa.y, H.request);
    const midB = center(pb.y, H.gemini);
    const midC = center(pc.y, H.response);
    expect(Math.abs(midA - midB)).toBeLessThan(2);
    expect(Math.abs(midB - midC)).toBeLessThan(2);
  });

  it('stacks parallel children in one column and centers parent on their combined span', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'root',
        type: 'request-inputs',
        position: { x: 0, y: 0 },
        data: { fields: [] },
      },
      {
        id: 'z',
        type: 'crop-image',
        position: { x: 0, y: 0 },
        data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
      },
      {
        id: 'm',
        type: 'crop-image',
        position: { x: 0, y: 0 },
        data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
      },
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'root', target: 'z', sourceHandle: 'i', targetHandle: 'input-image' },
      { id: 'e2', source: 'root', target: 'm', sourceHandle: 'i', targetHandle: 'input-image' },
    ];
    const out = layoutHorizontalWorkflowTree(nodes, edges);
    const root = out.find((n) => n.id === 'root')!.position;
    const pm = out.find((n) => n.id === 'm')!.position;
    const pz = out.find((n) => n.id === 'z')!.position;

    expect(pm.x).toBe(pz.x);
    expect(pm.x).toBeGreaterThan(root.x);
    expect(pm.y).toBeLessThan(pz.y);
    const blockTop = pm.y;
    const blockBottom = pz.y + H.crop;
    const blockCenter = (blockTop + blockBottom) / 2;
    const rootCenter = root.y + H.request / 2;
    expect(Math.abs(rootCenter - blockCenter)).toBeLessThan(2);
  });

  it('offsets siblings that share the same child so they do not overlap', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'g1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      },
      {
        id: 'g2',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      },
      {
        id: 'r',
        type: 'response',
        position: { x: 0, y: 0 },
        data: { capturedValue: null },
      },
    ];
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'g1', target: 'r', sourceHandle: 'response', targetHandle: 'result' },
      { id: 'e2', source: 'g2', target: 'r', sourceHandle: 'response', targetHandle: 'result' },
    ];
    const out = layoutHorizontalWorkflowTree(nodes, edges);
    const y1 = out.find((n) => n.id === 'g1')!.position.y;
    const y2 = out.find((n) => n.id === 'g2')!.position.y;
    expect(Math.abs(y1 - y2)).toBeGreaterThanOrEqual(42);
  });
});
