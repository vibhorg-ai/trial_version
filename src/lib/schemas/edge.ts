import { z } from 'zod';

// Handle type — what kind of value flows through this connection point.
// Image handles carry CDN URLs of images; text handles carry strings.
// Vision handles on Gemini accept image URLs only (multiple connections allowed).
export const HandleTypeSchema = z.enum(['text', 'image', 'vision']);
export type HandleType = z.infer<typeof HandleTypeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().min(1),
  targetHandle: z.string().min(1),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
