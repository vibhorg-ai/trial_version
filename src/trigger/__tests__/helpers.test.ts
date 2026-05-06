import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
}));

vi.mock('@trigger.dev/sdk', () => ({
  task: <P, R>(opts: { id: string; run: (p: P, c: unknown) => Promise<R> }) => ({
    id: opts.id,
    run: opts.run,
  }),
  wait: { for: vi.fn() },
  tasks: { trigger: mocks.trigger },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    nodeRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import type { WorkflowNode } from '../../lib/schemas/node';
import { computeFinalStatus, fireChildTask, markNodeRun } from '../helpers';

const cropNode = {
  id: 'c1',
  type: 'crop-image',
  position: { x: 0, y: 0 },
  data: { x: 0, y: 0, w: 50, h: 50, inputImageUrl: null },
} satisfies WorkflowNode;

const geminiNode = {
  id: 'g1',
  type: 'gemini',
  position: { x: 0, y: 0 },
  data: {
    model: 'gemini-1.5-pro',
    prompt: 'hi',
    systemPrompt: '',
    temperature: 0.7,
    maxOutputTokens: 100,
    topP: 0.95,
  },
} satisfies WorkflowNode;

describe('markNodeRun', () => {
  beforeEach(() => {
    vi.mocked(prisma.nodeRun.findFirst).mockReset();
    vi.mocked(prisma.nodeRun.create).mockReset();
    vi.mocked(prisma.nodeRun.update).mockReset();
  });

  it('creates a row with startedAt when marking RUNNING', async () => {
    vi.mocked(prisma.nodeRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nodeRun.create).mockResolvedValue({} as never);

    await markNodeRun({
      workflowRunId: 'wr1',
      nodeId: 'n1',
      nodeType: 'crop-image',
      status: 'RUNNING',
    });

    expect(prisma.nodeRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RUNNING',
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('updates an existing row with finishedAt and output on SUCCESS', async () => {
    vi.mocked(prisma.nodeRun.findFirst).mockResolvedValue({
      id: 'nr1',
      startedAt: new Date('2020-01-01'),
    } as never);
    vi.mocked(prisma.nodeRun.update).mockResolvedValue({} as never);

    await markNodeRun({
      workflowRunId: 'wr1',
      nodeId: 'n1',
      status: 'SUCCESS',
      output: { kind: 'image', url: 'https://x' },
    });

    expect(prisma.nodeRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'nr1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          output: { kind: 'image', url: 'https://x' },
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('sets errorMessage and finishedAt on FAILED', async () => {
    vi.mocked(prisma.nodeRun.findFirst).mockResolvedValue({
      id: 'nr2',
      startedAt: new Date(0),
    } as never);
    vi.mocked(prisma.nodeRun.update).mockResolvedValue({} as never);

    await markNodeRun({
      workflowRunId: 'wr1',
      nodeId: 'n1',
      status: 'FAILED',
      error: 'boom',
    });

    expect(prisma.nodeRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'nr2' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'boom',
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('fireChildTask', () => {
  beforeEach(() => {
    mocks.trigger.mockReset();
    mocks.trigger.mockResolvedValue({ id: 'run_crop_1' });
  });

  it('triggers crop-image for a crop-image node', async () => {
    const payload = {
      workflowRunId: 'wr1',
      nodeId: 'c1',
      inputImageUrl: 'https://i',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };
    const out = await fireChildTask({ workflowRunId: 'wr1', node: cropNode, payload });
    expect(mocks.trigger).toHaveBeenCalledWith('crop-image', payload, {
      tags: ['nodeId:c1', 'workflowRunId:wr1'],
    });
    expect(out).toEqual({ runId: 'run_crop_1' });
  });

  it('triggers gemini for a gemini node', async () => {
    mocks.trigger.mockResolvedValue({ id: 'run_g_1' });
    const payload = {
      workflowRunId: 'wr1',
      nodeId: 'g1',
      prompt: 'p',
      temperature: 0.1,
      maxOutputTokens: 10,
      topP: 0.2,
      visionImageUrls: [] as string[],
    };
    const out = await fireChildTask({ workflowRunId: 'wr1', node: geminiNode, payload });
    expect(mocks.trigger).toHaveBeenCalledWith('gemini', payload, {
      tags: ['nodeId:g1', 'workflowRunId:wr1'],
    });
    expect(out).toEqual({ runId: 'run_g_1' });
  });

  it('tags with nodeId and workflowRunId', async () => {
    await fireChildTask({
      workflowRunId: 'wxyz',
      node: cropNode,
      payload: {
        workflowRunId: 'wxyz',
        nodeId: 'c1',
        inputImageUrl: 'https://i',
        w: 1,
        h: 1,
        x: 0,
        y: 0,
      },
    });
    expect(mocks.trigger).toHaveBeenCalledWith(
      'crop-image',
      expect.anything(),
      expect.objectContaining({
        tags: expect.arrayContaining(['nodeId:c1', 'workflowRunId:wxyz']),
      }),
    );
  });
});

describe('computeFinalStatus', () => {
  it('returns SUCCESS when all SUCCESS or SKIPPED', () => {
    expect(computeFinalStatus(['SUCCESS', 'SUCCESS', 'SKIPPED'])).toBe('SUCCESS');
  });

  it('returns PARTIAL when any FAILED and any SUCCESS', () => {
    expect(computeFinalStatus(['SUCCESS', 'FAILED'])).toBe('PARTIAL');
  });

  it('returns FAILED when all FAILED', () => {
    expect(computeFinalStatus(['FAILED', 'FAILED'])).toBe('FAILED');
  });

  it('returns RUNNING when any node is still RUNNING', () => {
    expect(computeFinalStatus(['SUCCESS', 'RUNNING'])).toBe('RUNNING');
  });

  it('returns RUNNING when any node is PENDING', () => {
    expect(computeFinalStatus(['PENDING'])).toBe('RUNNING');
  });
});
