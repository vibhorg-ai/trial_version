import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  triggerAndWait: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({
  task: (opts: { id: string; run: (p: unknown, c: unknown) => Promise<void> }) => opts,
  tasks: { triggerAndWait: mocks.triggerAndWait },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    workflowRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    nodeRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { WORKFLOW_SCHEMA_VERSION } from '../../lib/schemas/workflow';
import type { WorkflowGraph } from '../../lib/schemas/workflow';
import { orchestratorTask } from '../orchestrator';
import type { OrchestratorPayload } from '../types';

function runOrchestrator(payload: OrchestratorPayload): Promise<void> {
  const t = orchestratorTask as unknown as {
    run: (p: OrchestratorPayload, c: unknown) => Promise<void>;
  };
  return t.run(payload, {} as never);
}

function emptyWorkflowGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    nodes: [],
    edges: [],
  };
}

describe('orchestratorTask', () => {
  beforeEach(() => {
    vi.mocked(prisma.workflowRun.findUnique).mockReset();
    vi.mocked(prisma.workflowRun.update).mockReset();
    vi.mocked(prisma.nodeRun.findFirst).mockReset();
    vi.mocked(prisma.nodeRun.create).mockReset();
    vi.mocked(prisma.nodeRun.update).mockReset();
    mocks.triggerAndWait.mockReset();

    vi.mocked(prisma.nodeRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nodeRun.create).mockResolvedValue({} as never);
    vi.mocked(prisma.nodeRun.update).mockResolvedValue({} as never);
    vi.mocked(prisma.workflowRun.update).mockResolvedValue({} as never);
  });

  it('loads WorkflowRun + Workflow via prisma', async () => {
    const graph = emptyWorkflowGraph();
    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue({
      id: 'wr1',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: { fields: {} },
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflow: {
        id: 'wf1',
        userId: 'u1',
        name: 'n',
        graph,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    await runOrchestrator({ workflowRunId: 'wr1' });

    expect(prisma.workflowRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'wr1' },
      include: { workflow: true },
    });
  });

  it('marks request-inputs SUCCESS without calling triggerAndWait', async () => {
    const graph: WorkflowGraph = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: 'ri',
          type: 'request-inputs',
          position: { x: 0, y: 0 },
          data: {
            fields: [
              {
                fieldType: 'text_field',
                name: 'topic',
                value: 'default-topic',
              },
            ],
          },
        },
        {
          id: 'g',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: {
            model: 'gemini-1.5-pro',
            prompt: '',
            systemPrompt: '',
            temperature: 0.7,
            maxOutputTokens: 128,
            topP: 0.95,
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'ri',
          target: 'g',
          sourceHandle: 'topic',
          targetHandle: 'prompt',
        },
      ],
    };

    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue({
      id: 'wr1',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: { fields: { topic: 'from-run' } },
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflow: {
        id: 'wf1',
        userId: 'u1',
        name: 'n',
        graph,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    mocks.triggerAndWait.mockResolvedValue({
      ok: true,
      output: { kind: 'text', text: 'ai' },
    } as never);

    await runOrchestrator({ workflowRunId: 'wr1' });

    expect(mocks.triggerAndWait).toHaveBeenCalledTimes(1);
    expect(mocks.triggerAndWait).toHaveBeenCalledWith(
      'gemini',
      expect.objectContaining({ prompt: 'from-run' }),
      expect.anything(),
    );

    const riSuccess = [
      ...vi.mocked(prisma.nodeRun.create).mock.calls,
      ...vi.mocked(prisma.nodeRun.update).mock.calls,
    ].some(
      (call) =>
        (call[0] as { data?: { status?: string; nodeId?: string } })?.data?.status === 'SUCCESS' &&
        (call[0] as { data?: { nodeId?: string } })?.data?.nodeId === 'ri',
    );
    expect(riSuccess).toBe(true);
  });

  it('uses triggerAndWait for crop-image and records SUCCESS on WorkflowRun', async () => {
    const graph: WorkflowGraph = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: 'c',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 10, h: 10, inputImageUrl: 'https://example.com/in.jpg' },
        },
      ],
      edges: [],
    };

    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue({
      id: 'wr1',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: { fields: {} },
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflow: {
        id: 'wf1',
        userId: 'u1',
        name: 'n',
        graph,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    mocks.triggerAndWait.mockResolvedValue({
      ok: true,
      output: { url: 'https://example.com/out.jpg' },
    } as never);

    await runOrchestrator({ workflowRunId: 'wr1' });

    expect(mocks.triggerAndWait).toHaveBeenCalledWith(
      'crop-image',
      expect.objectContaining({
        workflowRunId: 'wr1',
        nodeId: 'c',
        inputImageUrl: 'https://example.com/in.jpg',
      }),
      expect.anything(),
    );

    const finalUpdate = vi
      .mocked(prisma.workflowRun.update)
      .mock.calls.find((c) => (c[0] as { data: { status?: string } }).data.status === 'SUCCESS');
    expect(finalUpdate).toBeDefined();
  });

  it('sets WorkflowRun.status to PARTIAL when one gemini fails and another succeeds', async () => {
    const graph: WorkflowGraph = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: 'a',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: {
            model: 'm',
            prompt: 'a',
            systemPrompt: '',
            temperature: 0.7,
            maxOutputTokens: 10,
            topP: 0.9,
          },
        },
        {
          id: 'b',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: {
            model: 'm',
            prompt: 'b',
            systemPrompt: '',
            temperature: 0.7,
            maxOutputTokens: 10,
            topP: 0.9,
          },
        },
      ],
      edges: [],
    };

    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue({
      id: 'wr1',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: { fields: {} },
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflow: {
        id: 'wf1',
        userId: 'u1',
        name: 'n',
        graph,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    mocks.triggerAndWait.mockImplementation(async (_id: string, payload: { nodeId: string }) => {
      if (payload.nodeId === 'a') {
        return { ok: true, output: { kind: 'text', text: 'ok' } };
      }
      return { ok: false, error: new Error('nope') };
    });

    await runOrchestrator({ workflowRunId: 'wr1' });

    const partial = vi
      .mocked(prisma.workflowRun.update)
      .mock.calls.find((c) => (c[0] as { data: { status?: string } }).data.status === 'PARTIAL');
    expect(partial).toBeDefined();
  });

  it('resolves response locally (no triggerAndWait for response)', async () => {
    const graph: WorkflowGraph = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: 'g',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: {
            model: 'm',
            prompt: 'p',
            systemPrompt: '',
            temperature: 0.7,
            maxOutputTokens: 10,
            topP: 0.9,
          },
        },
        {
          id: 'r',
          type: 'response',
          position: { x: 0, y: 0 },
          data: { capturedValue: null },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'g',
          target: 'r',
          sourceHandle: 'response',
          targetHandle: 'result',
        },
      ],
    };

    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue({
      id: 'wr1',
      workflowId: 'wf1',
      userId: 'u1',
      scope: 'FULL',
      selectedNodeIds: [],
      status: 'PENDING',
      triggerRunId: null,
      inputsSnapshot: { fields: {} },
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: null,
      durationMs: null,
      errorMessage: null,
      workflow: {
        id: 'wf1',
        userId: 'u1',
        name: 'n',
        graph,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);

    mocks.triggerAndWait.mockResolvedValue({
      ok: true,
      output: { kind: 'text', text: 'final-text' },
    } as never);

    await runOrchestrator({ workflowRunId: 'wr1' });

    expect(mocks.triggerAndWait).toHaveBeenCalledTimes(1);

    const responseCalls = vi
      .mocked(prisma.nodeRun.create)
      .mock.calls.filter(
        (call) => (call[0] as { data?: { nodeId?: string } }).data?.nodeId === 'r',
      );
    expect(responseCalls.length).toBeGreaterThan(0);
    const last = responseCalls[responseCalls.length - 1][0] as {
      data: { output?: { capturedValue?: string } };
    };
    expect(last.data.output?.capturedValue).toBe('final-text');
  });

  it('throws when WorkflowRun is missing', async () => {
    vi.mocked(prisma.workflowRun.findUnique).mockResolvedValue(null);

    await expect(runOrchestrator({ workflowRunId: 'missing' })).rejects.toThrow(
      'WorkflowRun not found',
    );
  });
});
