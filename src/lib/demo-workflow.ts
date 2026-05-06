import type { WorkflowGraph } from './schemas/workflow';
import { WORKFLOW_SCHEMA_VERSION } from './schemas/workflow';
import { DEFAULT_GEMINI_MODEL_ID } from './gemini-model';

/**
 * Shorter linear pipeline for screen recordings: one crop → one Gemini → response.
 * Kept separate from {@link SAMPLE_WORKFLOW_GRAPH} so both can coexist in the dashboard.
 */
export const DEMO_WORKFLOW_NAME = 'Demo — Walkthrough';

export const DEMO_WORKFLOW_GRAPH: WorkflowGraph = {
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: 'demo-request-inputs',
      type: 'request-inputs',
      position: { x: 120, y: 220 },
      data: {
        fields: [
          {
            fieldType: 'text_field',
            name: 'topic',
            value: 'Premium wireless earbuds for commuters',
          },
          {
            fieldType: 'image_field',
            name: 'product_image',
            value: null,
          },
        ],
      },
    },
    {
      id: 'demo-crop',
      type: 'crop-image',
      position: { x: 480, y: 220 },
      data: { x: 10, y: 10, w: 80, h: 80, inputImageUrl: null },
    },
    {
      id: 'demo-gemini',
      type: 'gemini',
      position: { x: 840, y: 220 },
      data: {
        model: DEFAULT_GEMINI_MODEL_ID,
        prompt:
          'In one short sentence, describe the product image and tie it to this topic: mention the topic naturally.',
        systemPrompt: 'You are a concise marketing assistant.',
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.95,
      },
    },
    {
      id: 'demo-response',
      type: 'response',
      position: { x: 1180, y: 220 },
      data: { capturedValue: null },
    },
  ],
  edges: [
    {
      id: 'demo-e1',
      source: 'demo-request-inputs',
      target: 'demo-crop',
      sourceHandle: 'product_image',
      targetHandle: 'input-image',
    },
    {
      id: 'demo-e2',
      source: 'demo-crop',
      target: 'demo-gemini',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
    {
      id: 'demo-e3',
      source: 'demo-request-inputs',
      target: 'demo-gemini',
      sourceHandle: 'topic',
      targetHandle: 'prompt',
    },
    {
      id: 'demo-e4',
      source: 'demo-gemini',
      target: 'demo-response',
      sourceHandle: 'response',
      targetHandle: 'result',
    },
  ],
};
