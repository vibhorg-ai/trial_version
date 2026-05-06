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

  // Request-Inputs field names must be unique within each node — they become
  // the source-handle ids and the property keys when the run inputs snapshot
  // is built. Duplicates would silently shadow each other in the DAG walk.
  graph.nodes.forEach((node, nodeIndex) => {
    if (node.type !== 'request-inputs') return;
    const seen = new Map<string, number>();
    node.data.fields.forEach((field, fieldIndex) => {
      const prev = seen.get(field.name);
      if (prev !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field name "${field.name}" in Request Inputs node`,
          path: ['nodes', nodeIndex, 'data', 'fields', fieldIndex, 'name'],
        });
      } else {
        seen.set(field.name, fieldIndex);
      }
    });
  });

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
