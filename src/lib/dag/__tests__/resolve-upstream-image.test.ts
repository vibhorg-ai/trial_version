import { describe, it, expect } from 'vitest';
import { resolveUpstreamImageUrl, resolveIncomingImages } from '../resolve-upstream-image';
import type { WorkflowNode } from '../../schemas/node';
import type { WorkflowEdge } from '../../schemas/edge';

describe('resolveUpstreamImageUrl', () => {
  it('returns the field value for an image_field on a request-inputs node', () => {
    const upstream: WorkflowNode = {
      id: 'req',
      type: 'request-inputs',
      position: { x: 0, y: 0 },
      data: {
        fields: [
          { fieldType: 'image_field', name: 'photo', value: null },
          { fieldType: 'text_field', name: 'topic', value: 'hello' },
        ],
      },
    };
    const output = { fields: { photo: 'https://cdn/x.png', topic: 'hello' } };
    expect(resolveUpstreamImageUrl(upstream, output, 'photo')).toBe('https://cdn/x.png');
  });

  it('returns null for a text_field even if its value happens to be an http string', () => {
    const upstream: WorkflowNode = {
      id: 'req',
      type: 'request-inputs',
      position: { x: 0, y: 0 },
      data: {
        fields: [{ fieldType: 'text_field', name: 'topic', value: 'http://looks-like-url' }],
      },
    };
    const output = { fields: { topic: 'http://looks-like-url' } };
    expect(resolveUpstreamImageUrl(upstream, output, 'topic')).toBeNull();
  });

  it('returns the url for a crop-image node output (kind:image envelope)', () => {
    const upstream: WorkflowNode = {
      id: 'crop',
      type: 'crop-image',
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
    };
    const output = { kind: 'image', url: 'https://cdn/cropped.png' };
    expect(resolveUpstreamImageUrl(upstream, output, 'output')).toBe('https://cdn/cropped.png');
  });

  it('returns the url for a crop-image node persisted as bare {url} (DB hydration shape)', () => {
    // The orchestrator persists the raw CropTaskResult `{url}` to NodeRun.output;
    // /api/runs/[id]/nodes returns that shape verbatim. The resolver must
    // accept it without the `kind:'image'` envelope or the Vision section
    // stays "pending…" forever after a page reload.
    const upstream: WorkflowNode = {
      id: 'crop',
      type: 'crop-image',
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
    };
    const output = { url: 'https://cdn/persisted-crop.png' };
    expect(resolveUpstreamImageUrl(upstream, output, 'output')).toBe(
      'https://cdn/persisted-crop.png',
    );
  });

  it('returns null for a crop-image upstream with empty url string', () => {
    const upstream: WorkflowNode = {
      id: 'crop',
      type: 'crop-image',
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
    };
    expect(resolveUpstreamImageUrl(upstream, { url: '' }, 'output')).toBeNull();
  });

  it('returns null when the upstream output is still undefined (running)', () => {
    const upstream: WorkflowNode = {
      id: 'crop',
      type: 'crop-image',
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
    };
    expect(resolveUpstreamImageUrl(upstream, undefined, 'output')).toBeNull();
  });

  it('returns null for a gemini text output (no image to surface)', () => {
    const upstream: WorkflowNode = {
      id: 'g',
      type: 'gemini',
      position: { x: 0, y: 0 },
      data: {
        prompt: 'p',
        systemPrompt: '',
        model: 'gemini-2.5-flash-lite',
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.9,
      },
    };
    const output = { kind: 'text', text: 'hello' };
    expect(resolveUpstreamImageUrl(upstream, output, 'response')).toBeNull();
  });

  it('drills into a Response capturedValue that holds an image', () => {
    const upstream: WorkflowNode = {
      id: 'resp',
      type: 'response',
      position: { x: 0, y: 0 },
      data: { capturedValue: null },
    };
    const output = { capturedValue: { kind: 'image', url: 'https://cdn/y.png' } };
    expect(resolveUpstreamImageUrl(upstream, output, 'result')).toBe('https://cdn/y.png');
  });
});

describe('resolveIncomingImages', () => {
  it('resolves every vision edge into [edgeId, sourceId, url] in edge order', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'crop1',
        type: 'crop-image',
        position: { x: 0, y: 0 },
        data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
      },
      {
        id: 'crop2',
        type: 'crop-image',
        position: { x: 0, y: 0 },
        data: { x: 0, y: 0, w: 50, h: 50, inputImageUrl: null },
      },
      {
        id: 'g',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: {
          prompt: '',
          systemPrompt: '',
          model: 'gemini-2.5-flash-lite',
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      },
    ];
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'crop1',
        target: 'g',
        sourceHandle: 'output',
        targetHandle: 'vision',
      },
      {
        id: 'e2',
        source: 'crop2',
        target: 'g',
        sourceHandle: 'output',
        targetHandle: 'vision',
      },
    ];
    const outputs: Record<string, unknown> = {
      crop1: { kind: 'image', url: 'https://cdn/1.png' },
      // crop2 still running â€” no entry yet
    };
    const result = resolveIncomingImages(nodes, edges, outputs, 'g', 'vision');
    expect(result).toEqual([
      {
        edgeId: 'e1',
        sourceNodeId: 'crop1',
        sourceHandleId: 'output',
        url: 'https://cdn/1.png',
      },
      {
        edgeId: 'e2',
        sourceNodeId: 'crop2',
        sourceHandleId: 'output',
        url: null,
      },
    ]);
  });

  it('ignores edges that target a different handle', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'g',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: {
          prompt: '',
          systemPrompt: '',
          model: 'gemini-2.5-flash-lite',
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      },
    ];
    const edges: WorkflowEdge[] = [
      {
        id: 'e-prompt',
        source: 'x',
        target: 'g',
        sourceHandle: 'response',
        targetHandle: 'prompt',
      },
    ];
    expect(resolveIncomingImages(nodes, edges, {}, 'g', 'vision')).toEqual([]);
  });
});
