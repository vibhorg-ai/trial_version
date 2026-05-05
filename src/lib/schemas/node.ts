import { z } from 'zod';

// XY position used by all React Flow nodes.
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// ─── Request-Inputs node ───────────────────────────────────────────────
// Each field has a name (becomes the output handle id), a type, and a value.
export const RequestInputFieldSchema = z.discriminatedUnion('fieldType', [
  z.object({
    fieldType: z.literal('text_field'),
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    value: z.string().default(''),
  }),
  z.object({
    fieldType: z.literal('image_field'),
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
    // CDN URL after Transloadit upload, or null if not yet uploaded.
    value: z.string().url().nullable().default(null),
  }),
]);

export const RequestInputsNodeDataSchema = z.object({
  fields: z.array(RequestInputFieldSchema).default([]),
});

// ─── Crop Image node ───────────────────────────────────────────────────
export const CropImageNodeDataSchema = z.object({
  // Manual values for X/Y/W/H (percentages 0-100). Used when input handle not connected.
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  w: z.number().min(0).max(100).default(100),
  h: z.number().min(0).max(100).default(100),
  // Manual fallback for the Input Image handle when not connected.
  inputImageUrl: z.string().url().nullable().default(null),
});

// ─── Gemini node ───────────────────────────────────────────────────────
export const GeminiNodeDataSchema = z.object({
  model: z.string().default('gemini-1.5-pro'),
  // Manual fallback values used when corresponding handle is not connected.
  prompt: z.string().default(''),
  systemPrompt: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxOutputTokens: z.number().int().min(1).max(8192).default(2048),
  topP: z.number().min(0).max(1).default(0.95),
});

// ─── Response node ─────────────────────────────────────────────────────
export const ResponseNodeDataSchema = z.object({
  // Captured final value. Populated at run time.
  capturedValue: z.unknown().nullable().default(null),
});

// ─── Discriminated node union ──────────────────────────────────────────
export const NodeTypeSchema = z.enum(['request-inputs', 'crop-image', 'gemini', 'response']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const WorkflowNodeSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('request-inputs'),
    position: PositionSchema,
    data: RequestInputsNodeDataSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('crop-image'),
    position: PositionSchema,
    data: CropImageNodeDataSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('gemini'),
    position: PositionSchema,
    data: GeminiNodeDataSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('response'),
    position: PositionSchema,
    data: ResponseNodeDataSchema,
  }),
]);

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

/** Output handle ids for a node (matches React Flow `sourceHandle` values). */
export function getWorkflowNodeOutputHandles(node: WorkflowNode): string[] {
  switch (node.type) {
    case 'request-inputs':
      return node.data.fields.map((f) => f.name);
    case 'crop-image':
      return ['output-image'];
    case 'gemini':
      return ['response'];
    case 'response':
      return [];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** Input handle ids for a node (matches React Flow `targetHandle` values). */
export function getWorkflowNodeInputHandles(node: WorkflowNode): string[] {
  switch (node.type) {
    case 'request-inputs':
      return [];
    case 'crop-image':
      return ['input-image'];
    case 'gemini':
      return ['prompt', 'system', 'vision', 'video', 'audio', 'file'];
    case 'response':
      return ['result'];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}
