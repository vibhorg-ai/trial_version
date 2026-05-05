import { describe, it, expect } from 'vitest';
import { WorkflowGraphSchema, WORKFLOW_SCHEMA_VERSION } from '../workflow';

const minimalValidGraph = {
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs' as const,
      position: { x: 0, y: 0 },
      data: { fields: [] },
    },
    {
      id: 'response',
      type: 'response' as const,
      position: { x: 800, y: 0 },
      data: { capturedValue: null },
    },
  ],
  edges: [] as Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>,
};

const richGraph = {
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs' as const,
      position: { x: 10, y: 20 },
      data: {
        fields: [
          {
            fieldType: 'text_field' as const,
            name: 'topic',
            value: 'hello',
          },
          {
            fieldType: 'image_field' as const,
            name: 'photo',
            value: 'https://example.com/a.png',
          },
        ],
      },
    },
    {
      id: 'crop1',
      type: 'crop-image' as const,
      position: { x: 100, y: 200 },
      data: {
        x: 5,
        y: 10,
        w: 90,
        h: 80,
        inputImageUrl: 'https://example.com/in.png',
      },
    },
    {
      id: 'gem1',
      type: 'gemini' as const,
      position: { x: 300, y: 400 },
      data: {
        model: 'gemini-2.0-flash',
        prompt: 'Do the thing',
        systemPrompt: 'You are helpful',
        temperature: 0.5,
        maxOutputTokens: 1024,
        topP: 0.9,
      },
    },
    {
      id: 'response',
      type: 'response' as const,
      position: { x: 900, y: 0 },
      data: { capturedValue: { nested: [1, 2, false] } },
    },
  ],
  edges: [
    {
      id: 'e-topic',
      source: 'request-inputs',
      target: 'gem1',
      sourceHandle: 'topic',
      targetHandle: 'prompt',
    },
    {
      id: 'e-crop',
      source: 'crop1',
      target: 'gem1',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
  ],
};

describe('WorkflowGraphSchema', () => {
  it('accepts a minimal valid graph', () => {
    const result = WorkflowGraphSchema.safeParse(minimalValidGraph);
    expect(result.success).toBe(true);
  });

  it('rejects unknown node-type', () => {
    const bad = {
      ...minimalValidGraph,
      nodes: [{ ...minimalValidGraph.nodes[0], type: 'unicorn' }],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects schemaVersion mismatch', () => {
    const bad = { ...minimalValidGraph, schemaVersion: 99 };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects node missing required fields', () => {
    const bad = {
      ...minimalValidGraph,
      nodes: [{ id: 'response', type: 'response' }],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects edge missing handles', () => {
    const bad = {
      ...minimalValidGraph,
      nodes: [
        {
          id: 'crop1',
          type: 'crop-image' as const,
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
        },
        ...minimalValidGraph.nodes,
      ],
      edges: [{ id: 'e1', source: 'crop1', target: 'response' }],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects non-existent source or target handle id on an edge', () => {
    const bad = {
      ...minimalValidGraph,
      nodes: [
        {
          id: 'crop1',
          type: 'crop-image' as const,
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
        },
        ...minimalValidGraph.nodes.filter((n) => n.id !== 'request-inputs'),
      ],
      edges: [
        {
          id: 'e-bad',
          source: 'crop1',
          target: 'response',
          sourceHandle: 'output-image',
          targetHandle: 'not-a-real-handle',
        },
      ],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects edge referencing unknown node id', () => {
    const bad = {
      ...minimalValidGraph,
      edges: [
        {
          id: 'e-missing',
          source: 'ghost',
          target: 'response',
          sourceHandle: 'x',
          targetHandle: 'result',
        },
      ],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('round-trips parse → serialize → parse (preserves all fields)', () => {
    const parsed1 = WorkflowGraphSchema.parse(richGraph);
    const serialized = JSON.stringify(parsed1);
    const parsed2 = WorkflowGraphSchema.parse(JSON.parse(serialized));
    expect(parsed2).toEqual(parsed1);
  });

  it('rejects invalid Crop Image x/y/w/h ranges', () => {
    const bad = {
      ...minimalValidGraph,
      nodes: [
        {
          id: 'crop1',
          type: 'crop-image' as const,
          position: { x: 0, y: 0 },
          data: { x: 150, y: 0, w: 100, h: 100, inputImageUrl: null },
        },
        ...minimalValidGraph.nodes,
      ],
    };
    const result = WorkflowGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
