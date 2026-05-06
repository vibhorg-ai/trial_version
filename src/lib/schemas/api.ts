import { z } from 'zod';
import { WorkflowGraphSchema } from './workflow';

const NameSchema = z.string().min(1, 'Name is required').max(200, 'Name too long');
const IsoDateString = z.string().datetime();

// ─── Workflow shapes ────────────────────────────────────────────────────
export const WorkflowSummarySchema = z.object({
  id: z.string().min(1),
  name: NameSchema,
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;

export const WorkflowDetailSchema = WorkflowSummarySchema.extend({
  graph: WorkflowGraphSchema,
});
export type WorkflowDetail = z.infer<typeof WorkflowDetailSchema>;

// ─── Request bodies ─────────────────────────────────────────────────────
export const CreateWorkflowRequestSchema = z.object({
  name: NameSchema,
  graph: WorkflowGraphSchema,
});
export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const UpdateWorkflowRequestSchema = z
  .object({
    name: NameSchema.optional(),
    graph: WorkflowGraphSchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.graph !== undefined,
    'At least one of `name` or `graph` must be provided',
  );
export type UpdateWorkflowRequest = z.infer<typeof UpdateWorkflowRequestSchema>;

/** Start a workflow run (`POST /api/workflows/[id]/runs`). `SELECTED` maps to Prisma `RunScope.PARTIAL`. */
export const RunStartRequestSchema = z
  .object({
    scope: z.enum(['FULL', 'SELECTED', 'SINGLE']),
    selectedNodeIds: z.array(z.string()),
    inputs: z.record(z.string(), z.unknown()),
  })
  .superRefine((data, ctx) => {
    if (data.scope !== 'FULL' && data.selectedNodeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'selectedNodeIds must be non-empty when scope is SELECTED or SINGLE',
        path: ['selectedNodeIds'],
      });
    }
  });
export type RunStartRequest = z.infer<typeof RunStartRequestSchema>;

// ─── Response bodies ────────────────────────────────────────────────────
export const ListWorkflowsResponseSchema = z.object({
  workflows: z.array(WorkflowSummarySchema),
});
export type ListWorkflowsResponse = z.infer<typeof ListWorkflowsResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string().min(1),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
