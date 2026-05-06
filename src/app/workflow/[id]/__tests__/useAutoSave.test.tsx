import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';
import { useWorkflowStore } from '../../../../lib/store/workflowStore';

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

function StatusHost() {
  const status = useAutoSave();
  return <span data-testid="save-status">{status}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  useWorkflowStore.setState({
    workflowId: null,
    name: '',
    updatedAt: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true } as Response)),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useAutoSave', () => {
  it('stays idle until the graph changes', () => {
    useWorkflowStore.setState({ workflowId: 'wf1' });
    render(<StatusHost />);
    expect(screen.getByTestId('save-status')).toHaveTextContent('idle');
  });

  it('debounces PUT with graph payload then shows saved', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    useWorkflowStore.setState({ workflowId: 'wf1' });
    render(<StatusHost />);

    act(() => {
      useWorkflowStore.getState().hydrate({
        workflowId: 'wf1',
        name: 'N',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      useWorkflowStore.getState().addNode({
        id: 'n1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      });
    });
    expect(screen.getByTestId('save-status')).toHaveTextContent('saving');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflows/wf1',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const fetchCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(fetchCall).toBeDefined();
    const init = fetchCall[1];
    expect(init.body).toBeDefined();
    const body = JSON.parse(init.body as string);
    expect(body.graph).toEqual(useWorkflowStore.getState().toGraph());

    expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
  });

  it('coalesces rapid graph changes into one fetch after debounce', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    useWorkflowStore.setState({ workflowId: 'wf1' });
    render(<StatusHost />);

    act(() => {
      useWorkflowStore.getState().hydrate({
        workflowId: 'wf1',
        name: 'N',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    act(() => {
      useWorkflowStore.getState().addNode({
        id: 'a',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      });
      useWorkflowStore.getState().addNode({
        id: 'b',
        type: 'gemini',
        position: { x: 1, y: 1 },
        data: geminiData,
      });
      useWorkflowStore.getState().addNode({
        id: 'c',
        type: 'gemini',
        position: { x: 2, y: 2 },
        data: geminiData,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sets error when fetch response is not ok', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false } as Response));
    vi.stubGlobal('fetch', fetchMock);

    useWorkflowStore.setState({ workflowId: 'wf1' });
    render(<StatusHost />);

    act(() => {
      useWorkflowStore.getState().hydrate({
        workflowId: 'wf1',
        name: 'N',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    act(() => {
      useWorkflowStore.getState().addNode({
        id: 'n1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('save-status')).toHaveTextContent('error');
  });

  it('does not save on initial hydrate then saves on later mutation', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<StatusHost />);

    act(() => {
      useWorkflowStore.getState().hydrate({
        workflowId: 'wf1',
        name: 'N',
        graph: { schemaVersion: 1, nodes: [], edges: [] },
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('save-status')).toHaveTextContent('idle');

    act(() => {
      useWorkflowStore.getState().addNode({
        id: 'after',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: geminiData,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
