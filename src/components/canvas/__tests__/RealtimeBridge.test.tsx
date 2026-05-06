import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RealtimeBridge } from '../RealtimeBridge';
import { createRunSliceInitial, useWorkflowStore } from '../../../lib/store/workflowStore';

const rtMocks = vi.hoisted(() => ({
  useRealtimeRun: vi.fn(() => ({ run: undefined, error: undefined, stop: vi.fn() })),
  useRealtimeRunsWithTag: vi.fn(() => ({ runs: [], error: undefined, stop: vi.fn() })),
}));

vi.mock('@trigger.dev/react-hooks', () => ({
  useRealtimeRun: rtMocks.useRealtimeRun,
  useRealtimeRunsWithTag: rtMocks.useRealtimeRunsWithTag,
}));

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf1',
    name: '',
    updatedAt: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    ...createRunSliceInitial(),
  });
  rtMocks.useRealtimeRun.mockReturnValue({
    run: undefined,
    error: undefined,
    stop: vi.fn(),
  });
  rtMocks.useRealtimeRunsWithTag.mockReturnValue({
    runs: [],
    error: undefined,
    stop: vi.fn(),
  });
});

describe('RealtimeBridge', () => {
  it('returns null when publicAccessToken is missing', () => {
    useWorkflowStore.setState({
      triggerRunId: 'tr1',
      publicAccessToken: null,
      activeRunId: 'wr1',
    });
    const { container } = render(<RealtimeBridge />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when triggerRunId is missing', () => {
    useWorkflowStore.setState({
      triggerRunId: null,
      publicAccessToken: 'tok',
      activeRunId: 'wr1',
    });
    const { container } = render(<RealtimeBridge />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when activeRunId is missing', () => {
    useWorkflowStore.setState({
      triggerRunId: 'tr1',
      publicAccessToken: 'tok',
      activeRunId: null,
    });
    const { container } = render(<RealtimeBridge />);
    expect(container.firstChild).toBeNull();
  });

  it('applies orchestrator run updates via ingestRealtimeUpdate', async () => {
    const fakeRun = {
      id: 'orch',
      taskIdentifier: 'workflow-run',
      status: 'COMPLETED',
      tags: ['workflowRunId:wr1'],
    };
    rtMocks.useRealtimeRun.mockReturnValue({
      run: fakeRun,
      error: undefined,
      stop: vi.fn(),
    } as unknown as ReturnType<typeof rtMocks.useRealtimeRun>);

    useWorkflowStore.setState({
      triggerRunId: 'tr1',
      publicAccessToken: 'tok',
      activeRunId: 'wr1',
      runStatus: 'running',
    });

    render(<RealtimeBridge />);

    await waitFor(() => {
      expect(useWorkflowStore.getState().runStatus).toBe('success');
    });
  });

  it('applies child runs from useRealtimeRunsWithTag via ingestRealtimeUpdate', async () => {
    const r1 = {
      id: 'c1',
      taskIdentifier: 'crop-image',
      status: 'COMPLETED',
      tags: ['nodeId:n1', 'workflowRunId:wr1'],
      output: { kind: 'image' as const, url: 'https://x' },
    };
    const r2 = {
      id: 'g1',
      taskIdentifier: 'gemini',
      status: 'EXECUTING',
      tags: ['nodeId:n2', 'workflowRunId:wr1'],
    };
    rtMocks.useRealtimeRunsWithTag.mockReturnValue({
      runs: [r1, r2],
      error: undefined,
      stop: vi.fn(),
    } as unknown as ReturnType<typeof rtMocks.useRealtimeRunsWithTag>);

    useWorkflowStore.setState({
      triggerRunId: 'tr1',
      publicAccessToken: 'tok',
      activeRunId: 'wr1',
    });

    render(<RealtimeBridge />);

    await waitFor(() => {
      const s = useWorkflowStore.getState();
      expect(s.nodeRunStatus.n1).toBe('success');
      expect(s.nodeRunOutput.n1).toEqual({ kind: 'image', url: 'https://x' });
      expect(s.nodeRunStatus.n2).toBe('running');
    });
  });
});
