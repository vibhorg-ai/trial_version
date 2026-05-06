import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';
import { useWorkflowStore } from '../../../../lib/store/workflowStore';

// Mock reactflow before any other imports that use it.
vi.mock('reactflow', () => {
  return {
    __esModule: true,
    default: ({
      children,
      nodes,
      edges,
      onNodesChange: _onNodesChange,
      ..._rest
    }: {
      children?: React.ReactNode;
      nodes: unknown[];
      edges: unknown[];
      onNodesChange?: unknown;
    }) => (
      <div
        data-testid="rf-root"
        data-nodes={JSON.stringify(nodes)}
        data-edges={JSON.stringify(edges)}
      >
        {children}
      </div>
    ),
    Background: ({ variant, gap, size }: { variant?: string; gap?: number; size?: number }) => (
      <div data-testid="rf-background" data-variant={variant} data-gap={gap} data-size={size} />
    ),
    BackgroundVariant: { Dots: 'dots', Lines: 'lines' },
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    applyNodeChanges: (changes: unknown, nodes: unknown[]) => nodes,
    applyEdgeChanges: (changes: unknown, edges: unknown[]) => edges,
  };
});

// CSS import
vi.mock('reactflow/dist/style.css', () => ({}));

const baseGraph = {
  schemaVersion: 1 as const,
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
  edges: [],
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf1',
    name: 'Test',
    updatedAt: '',
    nodes: baseGraph.nodes,
    edges: baseGraph.edges,
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
  });
});

describe('Canvas', () => {
  it('renders the React Flow shell with Background, Controls, MiniMap', () => {
    render(<Canvas />);
    expect(screen.getByTestId('rf-root')).toBeInTheDocument();
    expect(screen.getByTestId('rf-background')).toHaveAttribute('data-variant', 'dots');
    expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
    expect(screen.getByTestId('rf-minimap')).toBeInTheDocument();
  });

  it('passes the store nodes and edges to React Flow', () => {
    render(<Canvas />);
    const root = screen.getByTestId('rf-root');
    const passedNodes = JSON.parse(root.getAttribute('data-nodes')!);
    const passedEdges = JSON.parse(root.getAttribute('data-edges')!);
    expect(passedNodes).toHaveLength(2);
    expect(passedEdges).toHaveLength(0);
    // Confirm our shape transform: data.label is the domain type.
    expect(passedNodes[0].data.label).toBe('request-inputs');
    expect(passedNodes[1].data.label).toBe('response');
    // Confirm position passes through.
    expect(passedNodes[1].position).toEqual({ x: 800, y: 0 });
  });

  it('uses dot variant Background with gap=20 size=1.5', () => {
    render(<Canvas />);
    const bg = screen.getByTestId('rf-background');
    expect(bg).toHaveAttribute('data-gap', '20');
    expect(bg).toHaveAttribute('data-size', '1.5');
  });

  it('reflects subsequent store updates', () => {
    const { rerender } = render(<Canvas />);
    let root = screen.getByTestId('rf-root');
    expect(JSON.parse(root.getAttribute('data-nodes')!)).toHaveLength(2);

    useWorkflowStore.getState().addNode({
      id: 'gem1',
      type: 'gemini',
      position: { x: 400, y: 0 },
      data: {
        model: 'gemini-1.5-pro',
        prompt: '',
        systemPrompt: '',
        temperature: 0.7,
        maxOutputTokens: 256,
        topP: 0.95,
      },
    });

    rerender(<Canvas />);
    root = screen.getByTestId('rf-root');
    expect(JSON.parse(root.getAttribute('data-nodes')!)).toHaveLength(3);
  });
});
