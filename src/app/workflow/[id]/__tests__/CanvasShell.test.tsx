import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasShell } from '../CanvasShell';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

vi.mock('../useAutoSave', () => ({
  useAutoSave: () => 'idle',
}));

vi.mock('../../../../components/canvas/RunButton', () => ({
  RunButton: () => null,
}));

vi.mock('../../../../components/canvas/RealtimeBridge', () => ({
  RealtimeBridge: () => null,
}));

let lastHistoryPanelProps: { open: boolean; workflowId: string; onClose: () => void } | null = null;
vi.mock('../../../../components/history/HistoryPanel', () => ({
  HistoryPanel: (props: { open: boolean; workflowId: string; onClose: () => void }) => {
    lastHistoryPanelProps = props;
    return props.open ? <div data-testid="history-panel-open" /> : null;
  },
}));

// Mock the Canvas to avoid React Flow.
vi.mock('../Canvas', () => ({
  Canvas: () => <div data-testid="canvas-mock">canvas</div>,
}));

// Mock next/link to a plain anchor (forward aria-label etc. for a11y queries).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const baseGraph = {
  schemaVersion: 1 as const,
  nodes: [],
  edges: [],
};

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

beforeEach(() => {
  lastHistoryPanelProps = null;
  useWorkflowStore.setState({
    workflowId: 'wf1',
    name: 'Test Workflow',
    updatedAt: '',
    nodes: baseGraph.nodes,
    edges: baseGraph.edges,
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    ...createRunSliceInitial(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CanvasShell', () => {
  it('renders the workflow name and Canvas placeholder', () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('canvas-mock')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-tools-sidebar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import workflow from json/i })).toBeInTheDocument();
  });

  it('toggles the left workflow tools panel', async () => {
    const user = userEvent.setup();
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    const toggle = screen.getByRole('button', { name: /close workflow tools panel/i });
    await user.click(toggle);
    expect(screen.getByTestId('workflow-tools-sidebar')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: /open workflow tools panel/i }));
    expect(screen.getByTestId('workflow-tools-sidebar')).toHaveAttribute('aria-hidden', 'false');
  });

  it('shows a History toggle control', () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByRole('button', { name: /toggle run history/i })).toBeInTheDocument();
  });

  it('opens the history panel when History is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await user.click(screen.getByRole('button', { name: /toggle run history/i }));
    expect(screen.getByTestId('history-panel-open')).toBeInTheDocument();
    expect(lastHistoryPanelProps?.open).toBe(true);
    expect(lastHistoryPanelProps?.workflowId).toBe('wf1');
  });

  it('disables delete when nothing is selected', () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeDisabled();
  });

  it('enables delete when a deletable node is selected', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'crop1',
            type: 'crop-image',
            position: { x: 0, y: 0 },
            data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
          },
        ],
        selectedNodeId: 'crop1',
      });
    });
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeEnabled();
  });

  it('disables delete when request-inputs is selected', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'ri1',
            type: 'request-inputs',
            position: { x: 0, y: 0 },
            data: { fields: [] },
          },
        ],
        selectedNodeId: 'ri1',
      });
    });
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeDisabled();
  });

  it('disables delete when response is selected', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'resp1',
            type: 'response',
            position: { x: 0, y: 0 },
            data: { capturedValue: null },
          },
        ],
        selectedNodeId: 'resp1',
      });
    });
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeDisabled();
  });

  it('enables delete when an edge is selected', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        selectedEdgeId: 'e1',
      });
    });
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeEnabled();
  });

  it('clicking delete with a selected edge calls removeEdge', async () => {
    const user = userEvent.setup();
    const removeEdge = vi.spyOn(useWorkflowStore.getState(), 'removeEdge');
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        edges: [
          {
            id: 'e-del',
            source: 'a',
            target: 'b',
            sourceHandle: 'out',
            targetHandle: 'in',
          },
        ],
        selectedEdgeId: 'e-del',
      });
    });
    await user.click(screen.getByRole('button', { name: /delete selected/i }));
    expect(removeEdge).toHaveBeenCalledWith('e-del');
  });

  it('clicking delete with a selected deletable node calls removeNode', async () => {
    const user = userEvent.setup();
    const removeNode = vi.spyOn(useWorkflowStore.getState(), 'removeNode');
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'gem1',
            type: 'gemini',
            position: { x: 0, y: 0 },
            data: geminiData,
          },
        ],
        selectedNodeId: 'gem1',
      });
    });
    await user.click(screen.getByRole('button', { name: /delete selected/i }));
    expect(removeNode).toHaveBeenCalledWith('gem1');
  });

  it('export creates a JSON blob matching the current graph', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));
    await act(() => {
      useWorkflowStore.setState({
        nodes: [
          {
            id: 'gem-export',
            type: 'gemini',
            position: { x: 0, y: 0 },
            data: geminiData,
          },
        ],
      });
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /export workflow as json/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const firstCall = createObjectURL.mock.calls[0] as unknown as [Blob];
    expect(firstCall).toBeDefined();
    const blob = firstCall[0] as Blob;
    const text = await blob.text();
    expect(JSON.parse(text)).toEqual(useWorkflowStore.getState().toGraph());

    clickSpy.mockRestore();
  });

  it('import button triggers the hidden file input click', async () => {
    const user = userEvent.setup();
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));

    await user.click(screen.getByRole('button', { name: /import workflow from json/i }));
    expect(inputClickSpy).toHaveBeenCalled();

    inputClickSpy.mockRestore();
  });

  it('import applies valid JSON graph via hydrate', async () => {
    const imported = {
      schemaVersion: 1 as const,
      nodes: [
        {
          id: 'imp-node',
          type: 'gemini' as const,
          position: { x: 10, y: 20 },
          data: geminiData,
        },
      ],
      edges: [] as typeof baseGraph.edges,
    };

    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));

    const input = screen.getByLabelText(/import workflow json file/i);
    const file = new File([JSON.stringify(imported)], 'wf.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(useWorkflowStore.getState().nodes).toHaveLength(1);
      expect(useWorkflowStore.getState().nodes[0]?.id).toBe('imp-node');
    });
  });

  it('import shows error toast on JSON parse failure', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));

    const input = screen.getByLabelText(/import workflow json file/i);
    const file = new File(['{ not valid json'], 'bad.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/^Import failed:/);
    });
  });

  it('import shows error toast when schema validation fails', async () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    await waitFor(() => expect(useWorkflowStore.getState().workflowId).toBe('wf1'));

    const input = screen.getByLabelText(/import workflow json file/i);
    const bad = { schemaVersion: 1, nodes: [{ id: 'x' }], edges: [] };
    const file = new File([JSON.stringify(bad)], 'bad.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid workflow JSON: schema validation failed',
      );
    });
  });
});
