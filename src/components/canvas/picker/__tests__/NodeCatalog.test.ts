import { describe, it, expect } from 'vitest';
import { CATALOG } from '../NodeCatalog';
import { WorkflowNodeSchema } from '../../../../lib/schemas/node';

describe('NodeCatalog', () => {
  it('every enabled entry has a create factory', () => {
    for (const entry of CATALOG) {
      if (entry.enabled) {
        expect(entry.create).toBeDefined();
        expect(typeof entry.create).toBe('function');
      }
    }
  });

  it('Crop factory round-trips WorkflowNodeSchema.parse', () => {
    const entry = CATALOG.find((e) => e.id === 'crop-image');
    expect(entry?.create).toBeDefined();
    const node = entry!.create!('crop-test-id', { x: 100, y: 200 });
    const parsed = WorkflowNodeSchema.parse(node);
    expect(parsed.type).toBe('crop-image');
    expect(parsed.data).toMatchObject({
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      inputImageUrl: null,
    });
  });

  it('Gemini factory round-trips WorkflowNodeSchema.parse', () => {
    const entry = CATALOG.find((e) => e.id === 'gemini-3.1-pro');
    expect(entry?.create).toBeDefined();
    const node = entry!.create!('gem-test-id', { x: 50, y: 75 });
    const parsed = WorkflowNodeSchema.parse(node);
    expect(parsed.type).toBe('gemini');
    expect(parsed.data).toMatchObject({
      model: 'gemini-3.1-pro',
      prompt: '',
      systemPrompt: '',
    });
  });
});
