import type { WorkflowGraph } from './schemas/workflow';
import { WORKFLOW_SCHEMA_VERSION } from './schemas/workflow';
import { DEFAULT_GEMINI_MODEL_ID } from './gemini-model';

export const SAMPLE_WORKFLOW_NAME = 'Wireless Headphones Marketing';

export const SAMPLE_WORKFLOW_GRAPH: WorkflowGraph = {
  schemaVersion: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: 'request-inputs',
      type: 'request-inputs',
      position: { x: 100, y: 200 },
      data: {
        fields: [
          {
            fieldType: 'text_field',
            name: 'topic',
            value: 'Wireless headphones for working out',
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
      id: 'crop-1',
      type: 'crop-image',
      position: { x: 400, y: 80 },
      data: { x: 0, y: 0, w: 50, h: 100, inputImageUrl: null },
    },
    {
      id: 'crop-2',
      type: 'crop-image',
      position: { x: 400, y: 320 },
      data: { x: 50, y: 0, w: 50, h: 100, inputImageUrl: null },
    },
    {
      id: 'gemini-1',
      type: 'gemini',
      position: { x: 720, y: 80 },
      data: {
        model: DEFAULT_GEMINI_MODEL_ID,
        prompt: "Describe this image's visual style in one sentence.",
        systemPrompt: 'You are a creative copywriter.',
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.95,
      },
    },
    {
      id: 'gemini-2',
      type: 'gemini',
      position: { x: 720, y: 320 },
      data: {
        model: DEFAULT_GEMINI_MODEL_ID,
        prompt: "Describe this image's visual style in one sentence.",
        systemPrompt: 'You are a creative copywriter.',
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.95,
      },
    },
    {
      id: 'gemini-final',
      type: 'gemini',
      position: { x: 1040, y: 200 },
      data: {
        model: DEFAULT_GEMINI_MODEL_ID,
        prompt: 'Write a punchy 10-word marketing tagline for: <topic injected via prompt edge>',
        systemPrompt: 'You are a creative copywriter.',
        temperature: 0.9,
        maxOutputTokens: 512,
        topP: 0.95,
      },
    },
    {
      id: 'response',
      type: 'response',
      position: { x: 1340, y: 200 },
      data: { capturedValue: null },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'request-inputs',
      target: 'crop-1',
      sourceHandle: 'product_image',
      targetHandle: 'input-image',
    },
    {
      id: 'e2',
      source: 'request-inputs',
      target: 'crop-2',
      sourceHandle: 'product_image',
      targetHandle: 'input-image',
    },
    {
      id: 'e3',
      source: 'crop-1',
      target: 'gemini-1',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
    {
      id: 'e4',
      source: 'crop-2',
      target: 'gemini-2',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
    {
      id: 'e5',
      source: 'crop-1',
      target: 'gemini-final',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
    {
      id: 'e6',
      source: 'crop-2',
      target: 'gemini-final',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    },
    {
      id: 'e7',
      source: 'request-inputs',
      target: 'gemini-final',
      sourceHandle: 'topic',
      targetHandle: 'prompt',
    },
    {
      id: 'e8',
      source: 'gemini-final',
      target: 'response',
      sourceHandle: 'response',
      targetHandle: 'result',
    },
  ],
};
