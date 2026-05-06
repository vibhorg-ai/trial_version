import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasShell } from '../CanvasShell';
import { useWorkflowStore } from '../../../../lib/store/workflowStore';

// Mock the Canvas to avoid React Flow.
vi.mock('../Canvas', () => ({
  Canvas: () => <div data-testid="canvas-mock">canvas</div>,
}));

// Mock next/link to a plain anchor.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
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
  });
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
});
