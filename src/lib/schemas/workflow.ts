import { z } from 'zod';
import {
  WorkflowNodeSchema,
  getWorkflowNodeInputHandles,
  getWorkflowNodeOutputHandles,
} from './node';
import { WorkflowEdgeSchema } from './edge';

export const WORKFLOW_SCHEMA_VERSION = 1 as const;

// The on-disk / in-DB / over-wire shape of a workflow's graph payload.
// This is exactly what gets stored in `Workflow.graph` (Postgres JSON) and
// what import/export uses.
const WorkflowGraphBaseSchema = z.object({
  schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export const WorkflowGraphSchema = WorkflowGraphBaseSchema.superRefine((graph, ctx) => {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  graph.edges.forEach((edge, edgeIndex) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown source node "${edge.source}"`,
        path: ['edges', edgeIndex, 'source'],
      });
      return;
    }
    if (!target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown target node "${edge.target}"`,
        path: ['edges', edgeIndex, 'target'],
      });
      return;
    }
    const outs = getWorkflowNodeOutputHandles(source);
    const ins = getWorkflowNodeInputHandles(target);
    if (!outs.includes(edge.sourceHandle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid source handle "${edge.sourceHandle}" for node type "${source.type}"`,
        path: ['edges', edgeIndex, 'sourceHandle'],
      });
    }
    if (!ins.includes(edge.targetHandle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid target handle "${edge.targetHandle}" for node type "${target.type}"`,
        path: ['edges', edgeIndex, 'targetHandle'],
      });
    }
  });
});

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
