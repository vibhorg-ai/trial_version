import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '../../schemas/node';
import type { HandleSpec } from '../handles';
import { canConnect, canConnectByIds, getHandleSpec } from '../handles';

const cropNode: WorkflowNode = {
  id: 'crop1',
  type: 'crop-image',
  position: { x: 0, y: 0 },
  data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
};

const geminiNode: WorkflowNode = {
  id: 'gem1',
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

const responseNode: WorkflowNode = {
  id: 'resp1',
  type: 'response',
  position: { x: 0, y: 0 },
  data: { capturedValue: null },
};

const requestInputsNode: WorkflowNode = {
  id: 'req1',
  type: 'request-inputs',
  position: { x: 0, y: 0 },
  data: {
    fields: [
      { fieldType: 'text_field', name: 'topic', value: '' },
      { fieldType: 'image_field', name: 'photo', value: null },
    ],
  },
};

function spec(
  partial: Pick<HandleSpec, 'kind' | 'multi'> & Partial<Pick<HandleSpec, 'id' | 'side'>>,
): HandleSpec {
  return {
    id: partial.id ?? 'h',
    side: partial.side ?? 'output',
    kind: partial.kind,
    multi: partial.multi,
  };
}

describe('getHandleSpec', () => {
  it('returns crop-image input spec', () => {
    const h = getHandleSpec(cropNode, 'input-image', 'input');
    expect(h).toEqual({
      id: 'input-image',
      side: 'input',
      kind: 'image',
      multi: false,
    });
  });

  it('returns crop-image output spec', () => {
    const h = getHandleSpec(cropNode, 'output-image', 'output');
    expect(h).toEqual({
      id: 'output-image',
      side: 'output',
      kind: 'image',
      multi: false,
    });
  });

  it('returns null for unknown handle ids', () => {
    expect(getHandleSpec(cropNode, 'nope', 'input')).toBeNull();
    expect(getHandleSpec(cropNode, 'nope', 'output')).toBeNull();
  });

  it('derives request-inputs output kinds from fields', () => {
    expect(getHandleSpec(requestInputsNode, 'topic', 'output')).toEqual({
      id: 'topic',
      side: 'output',
      kind: 'text',
      multi: false,
    });
    expect(getHandleSpec(requestInputsNode, 'photo', 'output')).toEqual({
      id: 'photo',
      side: 'output',
      kind: 'image',
      multi: false,
    });
    expect(getHandleSpec(requestInputsNode, 'unknown', 'output')).toBeNull();
  });
});

describe('canConnect', () => {
  it('allows text output to text input', () => {
    expect(
      canConnect(
        spec({ kind: 'text', side: 'output', multi: false }),
        spec({ kind: 'text', side: 'input', multi: false }),
      ),
    ).toBe(true);
  });

  it('rejects text to image', () => {
    expect(
      canConnect(
        spec({ kind: 'text', side: 'output', multi: false }),
        spec({ kind: 'image', side: 'input', multi: false }),
      ),
    ).toBe(false);
  });

  it('allows image to image', () => {
    expect(
      canConnect(
        spec({ kind: 'image', side: 'output', multi: false }),
        spec({ kind: 'image', side: 'input', multi: false }),
      ),
    ).toBe(true);
  });

  it('allows image output to vision-multi input', () => {
    expect(
      canConnect(
        spec({ kind: 'image', side: 'output', multi: false }),
        spec({ kind: 'vision-multi', side: 'input', multi: true }),
      ),
    ).toBe(true);
  });

  it('rejects text output to vision-multi input', () => {
    expect(
      canConnect(
        spec({ kind: 'text', side: 'output', multi: false }),
        spec({ kind: 'vision-multi', side: 'input', multi: true }),
      ),
    ).toBe(false);
  });

  it('allows any-accepting input for text and image', () => {
    expect(
      canConnect(
        spec({ kind: 'text', side: 'output', multi: false }),
        spec({ kind: 'any', side: 'input', multi: false }),
      ),
    ).toBe(true);
    expect(
      canConnect(
        spec({ kind: 'image', side: 'output', multi: false }),
        spec({ kind: 'any', side: 'input', multi: false }),
      ),
    ).toBe(true);
  });
});

describe('canConnectByIds', () => {
  it('returns ok for valid connection', () => {
    expect(canConnectByIds(requestInputsNode, 'topic', geminiNode, 'prompt')).toEqual({ ok: true });
  });

  it('returns unknown-source-handle when source id missing', () => {
    expect(canConnectByIds(cropNode, 'missing', geminiNode, 'vision')).toEqual({
      ok: false,
      reason: 'unknown-source-handle',
    });
  });

  it('returns unknown-target-handle when target id missing', () => {
    expect(canConnectByIds(cropNode, 'output-image', responseNode, 'not-result')).toEqual({
      ok: false,
      reason: 'unknown-target-handle',
    });
  });

  it('returns type-mismatch when kinds are incompatible', () => {
    expect(canConnectByIds(requestInputsNode, 'topic', cropNode, 'input-image')).toEqual({
      ok: false,
      reason: 'type-mismatch',
    });
  });

  it('returns cannot-target-output-side when target handle is an output', () => {
    expect(canConnectByIds(cropNode, 'output-image', geminiNode, 'response')).toEqual({
      ok: false,
      reason: 'cannot-target-output-side',
    });
  });

  it('returns cannot-source-from-input-side when source handle is an input', () => {
    expect(canConnectByIds(cropNode, 'input-image', geminiNode, 'vision')).toEqual({
      ok: false,
      reason: 'cannot-source-from-input-side',
    });
  });
});
