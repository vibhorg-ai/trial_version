import { describe, it, expect } from 'vitest';
import {
  ApiErrorSchema,
  CreateWorkflowRequestSchema,
  CreateWorkflowRequest,
  ListWorkflowsResponseSchema,
  UpdateWorkflowRequestSchema,
  WorkflowDetailSchema,
  WorkflowSummarySchema,
} from '../api';
import { WORKFLOW_SCHEMA_VERSION } from '../workflow';

const validGraph = {
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

const iso = '2024-06-15T12:30:00.000Z';

const validSummary = {
  id: 'wf_01',
  name: 'My Workflow',
  createdAt: iso,
  updatedAt: iso,
};

describe('CreateWorkflowRequestSchema', () => {
  it('accepts name and valid WorkflowGraph', () => {
    const input = { name: 'Wireless Headphones', graph: validGraph };
    expect(CreateWorkflowRequestSchema.safeParse(input).success).toBe(true);
  });

  it('rejects empty name', () => {
    const r = CreateWorkflowRequestSchema.safeParse({ name: '', graph: validGraph });
    expect(r.success).toBe(false);
  });

  it('rejects name longer than 200 chars', () => {
    const r = CreateWorkflowRequestSchema.safeParse({
      name: 'x'.repeat(201),
      graph: validGraph,
    });
    expect(r.success).toBe(false);
  });

  it('rejects graph that fails WorkflowGraphSchema', () => {
    const badGraph = {
      ...validGraph,
      nodes: [
        {
          id: 'n1',
          type: 'not-a-valid-node-type',
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
    };
    const r = CreateWorkflowRequestSchema.safeParse({
      name: 'Wireless Headphones',
      graph: badGraph,
    });
    expect(r.success).toBe(false);
  });

  it('requires name (no default)', () => {
    const r = CreateWorkflowRequestSchema.safeParse({ graph: validGraph });
    expect(r.success).toBe(false);
  });
});

describe('WorkflowSummarySchema', () => {
  it('accepts id, name, createdAt, updatedAt as ISO datetime strings', () => {
    expect(WorkflowSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(WorkflowSummarySchema.safeParse({ ...validSummary, id: undefined }).success).toBe(false);
    expect(WorkflowSummarySchema.safeParse({ ...validSummary, name: undefined }).success).toBe(
      false,
    );
    expect(WorkflowSummarySchema.safeParse({ ...validSummary, createdAt: undefined }).success).toBe(
      false,
    );
    expect(WorkflowSummarySchema.safeParse({ ...validSummary, updatedAt: undefined }).success).toBe(
      false,
    );
  });
});

describe('WorkflowDetailSchema', () => {
  it('includes all summary fields and graph', () => {
    const detail = { ...validSummary, graph: validGraph };
    expect(WorkflowDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('rejects detail missing graph', () => {
    expect(WorkflowSummarySchema.safeParse(validSummary).success).toBe(true);
    expect(WorkflowDetailSchema.safeParse(validSummary).success).toBe(false);
  });
});

describe('UpdateWorkflowRequestSchema', () => {
  it('accepts partial { name }', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
  });

  it('accepts partial { graph }', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ graph: validGraph }).success).toBe(true);
  });

  it('accepts both name and graph', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ name: 'Both', graph: validGraph }).success).toBe(
      true,
    );
  });

  it('rejects empty body (refine)', () => {
    const r = UpdateWorkflowRequestSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some(
          (i) =>
            i.message.includes('At least one of') &&
            i.message.includes('name') &&
            i.message.includes('graph'),
        ),
      ).toBe(true);
    }
  });

  it('rejects empty name when name is present', () => {
    expect(UpdateWorkflowRequestSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects invalid graph when graph is present', () => {
    const badGraph = {
      ...validGraph,
      nodes: [
        {
          id: 'n1',
          type: 'not-a-valid-node-type',
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
    };
    const r = UpdateWorkflowRequestSchema.safeParse({ graph: badGraph });
    expect(r.success).toBe(false);
  });
});

describe('ListWorkflowsResponseSchema', () => {
  it('accepts workflows array', () => {
    const r = ListWorkflowsResponseSchema.safeParse({ workflows: [validSummary] });
    expect(r.success).toBe(true);
  });

  it('accepts empty workflows array', () => {
    const r = ListWorkflowsResponseSchema.safeParse({ workflows: [] });
    expect(r.success).toBe(true);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts { error }', () => {
    expect(ApiErrorSchema.safeParse({ error: 'Something went wrong' }).success).toBe(true);
  });

  it('accepts optional details', () => {
    expect(ApiErrorSchema.safeParse({ error: 'Bad', details: { field: 'name' } }).success).toBe(
      true,
    );
  });

  it('rejects missing error', () => {
    expect(ApiErrorSchema.safeParse({ details: {} }).success).toBe(false);
  });

  it('rejects empty error string', () => {
    expect(ApiErrorSchema.safeParse({ error: '' }).success).toBe(false);
  });
});

describe('inferred types', () => {
  it('infers type-correct CreateWorkflowRequest', () => {
    const valid: CreateWorkflowRequest = {
      name: 'Test',
      graph: validGraph,
    };
    expect(CreateWorkflowRequestSchema.safeParse(valid).success).toBe(true);
  });
});
