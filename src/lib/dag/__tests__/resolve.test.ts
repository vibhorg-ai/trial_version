import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '../../schemas/node';
import type { WorkflowEdge } from '../../schemas/edge';
import { resolveInputs, OutputStore } from '../resolve';

function requestInputs(id: string): WorkflowNode {
  return {
    id,
    type: 'request-inputs',
    position: { x: 0, y: 0 },
    data: {
      fields: [
        { fieldType: 'text_field', name: 'title', value: '' },
        {
          fieldType: 'image_field',
          name: 'image_field',
          value: 'https://cdn.example.com/uploaded.jpg',
        },
      ],
    },
  };
}

type CropNodeData = Extract<WorkflowNode, { type: 'crop-image' }>['data'];
type GeminiNodeData = Extract<WorkflowNode, { type: 'gemini' }>['data'];

function crop(id: string, overrides?: Partial<CropNodeData>): WorkflowNode {
  return {
    id,
    type: 'crop-image',
    position: { x: 0, y: 0 },
    data: {
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      inputImageUrl: null,
      ...overrides,
    },
  };
}

function gemini(id: string, overrides?: Partial<GeminiNodeData>): WorkflowNode {
  return {
    id,
    type: 'gemini',
    position: { x: 0, y: 0 },
    data: {
      model: 'gemini-1.5-pro',
      prompt: 'manual-prompt',
      systemPrompt: 'manual-system',
      temperature: 0.5,
      maxOutputTokens: 1024,
      topP: 0.9,
      ...overrides,
    },
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

describe('resolveInputs', () => {
  it('request-inputs returns empty payload regardless of edges/outputs', () => {
    const node = requestInputs('ri');
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'other',
        target: 'ri',
        sourceHandle: 'out',
        targetHandle: 'nope',
      },
    ];
    const outputs = new OutputStore();
    outputs.set('other', 'out', 'x');
    expect(resolveInputs(node, { edges }, outputs)).toEqual({
      type: 'request-inputs',
      payload: {},
    });
  });

  it('crop-image: no edge uses data.inputImageUrl and crop fields', () => {
    const node = crop('c', { inputImageUrl: 'https://cdn.example.com/manual.jpg' });
    const outputs = new OutputStore();
    const got = resolveInputs(node, { edges: [] }, outputs);
    expect(got).toEqual({
      type: 'crop-image',
      payload: {
        inputImageUrl: 'https://cdn.example.com/manual.jpg',
        x: 10,
        y: 20,
        w: 30,
        h: 40,
      },
    });
  });

  it('crop-image: no edge and manual inputImageUrl null → null', () => {
    const node = crop('c', { inputImageUrl: null });
    const got = resolveInputs(node, { edges: [] }, new OutputStore());
    expect(got).toEqual({
      type: 'crop-image',
      payload: {
        inputImageUrl: null,
        x: 10,
        y: 20,
        w: 30,
        h: 40,
      },
    });
  });

  it('crop-image: incoming edge from request-inputs image_field uses upstream URL', () => {
    const node = crop('crop1');
    const edges: WorkflowEdge[] = [
      {
        id: 'e-ri-crop',
        source: 'ri1',
        target: 'crop1',
        sourceHandle: 'image_field',
        targetHandle: 'input-image',
      },
    ];
    const outputs = new OutputStore();
    outputs.set('ri1', 'image_field', 'https://cdn.example.com/from-form.jpg');
    const got = resolveInputs(node, { edges }, outputs);
    expect(got).toEqual({
      type: 'crop-image',
      payload: {
        inputImageUrl: 'https://cdn.example.com/from-form.jpg',
        x: 10,
        y: 20,
        w: 30,
        h: 40,
      },
    });
  });

  it('gemini: all manual — data prompt/system, empty vision', () => {
    const node = gemini('g1');
    const got = resolveInputs(node, { edges: [] }, new OutputStore());
    expect(got).toEqual({
      type: 'gemini',
      payload: {
        prompt: 'manual-prompt',
        system: 'manual-system',
        vision: [],
        temperature: 0.5,
        maxOutputTokens: 1024,
        topP: 0.9,
        model: 'gemini-1.5-pro',
      },
    });
  });

  it('gemini: prompt edge uses upstream stringified, system manual, empty vision', () => {
    const node = gemini('g1');
    const edges: WorkflowEdge[] = [
      {
        id: 'e-prompt',
        source: 'src1',
        target: 'g1',
        sourceHandle: 'title',
        targetHandle: 'prompt',
      },
    ];
    const outputs = new OutputStore();
    outputs.set('src1', 'title', 'from-upstream');
    const got = resolveInputs(node, { edges }, outputs);
    expect(got).toEqual({
      type: 'gemini',
      payload: {
        prompt: 'from-upstream',
        system: 'manual-system',
        vision: [],
        temperature: 0.5,
        maxOutputTokens: 1024,
        topP: 0.9,
        model: 'gemini-1.5-pro',
      },
    });
  });

  it('gemini: vision multi-edge stable order by source id then edge id', () => {
    const node = gemini('g1');
    const edges: WorkflowEdge[] = [
      {
        id: 'edge-second-source',
        source: 'm2',
        target: 'g1',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
      {
        id: 'edge-first-source',
        source: 'm1',
        target: 'g1',
        sourceHandle: 'output-image',
        targetHandle: 'vision',
      },
    ];
    const outputs = new OutputStore();
    outputs.set('m2', 'output-image', 'https://cdn.example.com/second.jpg');
    outputs.set('m1', 'output-image', 'https://cdn.example.com/first.jpg');
    const got = resolveInputs(node, { edges }, outputs);
    expect(got.type).toBe('gemini');
    if (got.type !== 'gemini') throw new Error('narrow');
    expect(got.payload.vision).toEqual([
      'https://cdn.example.com/first.jpg',
      'https://cdn.example.com/second.jpg',
    ]);
  });

  it('gemini: missing upstream output throws clear error', () => {
    const node = gemini('g1');
    const edges: WorkflowEdge[] = [
      {
        id: 'e-prompt',
        source: 'src1',
        target: 'g1',
        sourceHandle: 'title',
        targetHandle: 'prompt',
      },
    ];
    const outputs = new OutputStore();
    expect(() => resolveInputs(node, { edges }, outputs)).toThrow(
      /Upstream output missing for src1::title \(needed by g1::prompt\)/,
    );
  });

  it('gemini: copies temperature, maxOutputTokens, topP, model from data', () => {
    const node = gemini('g1', {
      temperature: 1.2,
      maxOutputTokens: 4096,
      topP: 0.33,
      model: 'gemini-custom',
    });
    const got = resolveInputs(node, { edges: [] }, new OutputStore());
    expect(got).toEqual({
      type: 'gemini',
      payload: {
        prompt: 'manual-prompt',
        system: 'manual-system',
        vision: [],
        temperature: 1.2,
        maxOutputTokens: 4096,
        topP: 0.33,
        model: 'gemini-custom',
      },
    });
  });

  it('response: edge connected captures upstream value as result', () => {
    const node = response('r1');
    const edges: WorkflowEdge[] = [
      {
        id: 'e-res',
        source: 'src1',
        target: 'r1',
        sourceHandle: 'response',
        targetHandle: 'result',
      },
    ];
    const outputs = new OutputStore();
    outputs.set('src1', 'response', 'final text');
    expect(resolveInputs(node, { edges }, outputs)).toEqual({
      type: 'response',
      payload: { result: 'final text' },
    });
  });

  it('response: no edge → result null', () => {
    const node = response('r1');
    expect(resolveInputs(node, { edges: [] }, new OutputStore())).toEqual({
      type: 'response',
      payload: { result: null },
    });
  });

  it('response: accepts arbitrary upstream shape (unknown)', () => {
    const node = response('r1');
    const edges: WorkflowEdge[] = [
      {
        id: 'e-res',
        source: 'src1',
        target: 'r1',
        sourceHandle: 'response',
        targetHandle: 'result',
      },
    ];
    const outputs = new OutputStore();
    const obj = { kind: 'structured', url: 'https://cdn.example.com/x.png' };
    outputs.set('src1', 'response', obj);
    const got = resolveInputs(node, { edges }, outputs);
    expect(got.type).toBe('response');
    if (got.type !== 'response') throw new Error('narrow');
    expect(got.payload.result).toEqual(obj);
    outputs.set('src1', 'response', 'https://cdn.example.com/img.jpg');
    expect(resolveInputs(node, { edges }, outputs).payload).toEqual({
      result: 'https://cdn.example.com/img.jpg',
    });
  });
});
