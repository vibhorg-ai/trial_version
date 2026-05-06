import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Canvas } from '../Canvas';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

const rfHandlers: Record<string, unknown> = {};

// Mock reactflow before any other imports that use it.
vi.mock('reactflow', () => {
  return {
    __esModule: true,
    default: ({
      children,
      nodes,
      edges,
      nodeTypes,
      ...handlers
    }: Record<string, unknown> & {
      children?: React.ReactNode;
      nodes: unknown[];
      edges: unknown[];
      nodeTypes?: Record<string, unknown>;
    }) => {
      Object.assign(rfHandlers, handlers);
      const ntKeys =
        nodeTypes && typeof nodeTypes === 'object' ? Object.keys(nodeTypes).sort().join(',') : '';
      return (
        <div
          data-testid="rf-root"
          data-nodes={JSON.stringify(nodes)}
          data-edges={JSON.stringify(edges)}
          data-node-type-keys={ntKeys}
        >
          {children}
        </div>
      );
    },
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

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

const cropData = {
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  inputImageUrl: null as string | null,
};

beforeEach(() => {
  Object.keys(rfHandlers).forEach((k) => delete rfHandlers[k]);
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
    ...createRunSliceInitial(),
  });
});

afterEach(() => {
  vi.clearAllTimers();
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
    // Domain node `type` and `data` pass through to React Flow.
    expect(passedNodes[0].type).toBe('request-inputs');
    expect(passedNodes[1].type).toBe('response');
    expect(passedNodes[0].data).toEqual({ fields: [] });
    expect(passedNodes[1].data).toEqual({ capturedValue: null });
    // Confirm position passes through.
    expect(passedNodes[1].position).toEqual({ x: 800, y: 0 });
  });

  it('renders workflow edges as animated purple Galaxy-style edges', () => {
    useWorkflowStore.setState({
      edges: [
        {
          id: 'e1',
          source: 'request-inputs',
          target: 'response',
          sourceHandle: 'topic',
          targetHandle: 'result',
        },
      ],
    });

    render(<Canvas />);

    const root = screen.getByTestId('rf-root');
    const passedEdges = JSON.parse(root.getAttribute('data-edges')!);
    expect(passedEdges[0]).toEqual(
      expect.objectContaining({
        animated: true,
        className: 'workflow-edge workflow-edge--animated',
        // Galaxy's brand accent is indigo-500 (#6366f1); we apply opacity 0.8
        // exactly like Galaxy's edge paths.
        style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.8 },
      }),
    );
  });

  it('registers custom nodeTypes on React Flow', () => {
    render(<Canvas />);
    const root = screen.getByTestId('rf-root');
    expect(root.getAttribute('data-node-type-keys')).toBe(
      'crop-image,gemini,request-inputs,response',
    );
  });

  it('uses dot variant Background with Galaxy-style gap=19 size=0.8', () => {
    // Values lifted directly from the live Galaxy DOM dump:
    //   <pattern width="19.17" height="19.17">
    //     <circle r="0.77" class="fill-[#cacaca]"/>
    render(<Canvas />);
    const bg = screen.getByTestId('rf-background');
    expect(bg).toHaveAttribute('data-gap', '19');
    expect(bg).toHaveAttribute('data-size', '0.8');
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

  it('pane click clears selection', () => {
    useWorkflowStore.setState({ selectedNodeId: 'n1', selectedEdgeId: 'e1' });
    render(<Canvas />);
    const onPaneClick = rfHandlers.onPaneClick as () => void;
    onPaneClick();
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
    expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
  });

  it('node click sets node selection and clears edge selection', () => {
    useWorkflowStore.setState({ selectedEdgeId: 'e1' });
    render(<Canvas />);
    const onNodeClick = rfHandlers.onNodeClick as (e: unknown, node: { id: string }) => void;
    onNodeClick({}, { id: 'crop1' });
    expect(useWorkflowStore.getState().selectedNodeId).toBe('crop1');
    expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
  });

  it('edge click sets edge selection and clears node selection', () => {
    useWorkflowStore.setState({ selectedNodeId: 'n1' });
    render(<Canvas />);
    const onEdgeClick = rfHandlers.onEdgeClick as (e: unknown, edge: { id: string }) => void;
    onEdgeClick({}, { id: 'edge-1' });
    expect(useWorkflowStore.getState().selectedEdgeId).toBe('edge-1');
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
  });

  it('onConnect with valid types adds an edge', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'crop1',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: cropData,
        },
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 200, y: 0 },
          data: geminiData,
        },
      ],
      edges: [],
    });
    render(<Canvas />);
    const before = useWorkflowStore.getState().edges.length;
    const onConnect = rfHandlers.onConnect as (c: {
      source: string | null;
      target: string | null;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => void;
    onConnect({
      source: 'crop1',
      target: 'gem1',
      sourceHandle: 'output-image',
      targetHandle: 'vision',
    });
    expect(useWorkflowStore.getState().edges).toHaveLength(before + 1);
    const added = useWorkflowStore.getState().edges[before];
    expect(added.source).toBe('crop1');
    expect(added.target).toBe('gem1');
    expect(added.sourceHandle).toBe('output-image');
    expect(added.targetHandle).toBe('vision');
  });

  it('onConnect with invalid types does not add an edge and shows error', async () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: geminiData,
        },
        {
          id: 'crop1',
          type: 'crop-image',
          position: { x: 200, y: 0 },
          data: cropData,
        },
      ],
      edges: [],
    });
    render(<Canvas />);
    const before = useWorkflowStore.getState().edges.length;
    const onConnect = rfHandlers.onConnect as (c: {
      source: string | null;
      target: string | null;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => void;
    await act(() => {
      onConnect({
        source: 'gem1',
        target: 'crop1',
        sourceHandle: 'response',
        targetHandle: 'input-image',
      });
    });
    expect(useWorkflowStore.getState().edges).toHaveLength(before);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cannot connect: handle types are incompatible',
    );
  });

  it('onConnect blocks cycle-creating edges before adding them to the store', async () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: geminiData,
        },
      ],
      edges: [],
    });
    render(<Canvas />);

    const onConnect = rfHandlers.onConnect as (c: {
      source: string | null;
      target: string | null;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => void;

    await act(() => {
      onConnect({
        source: 'gem1',
        target: 'gem1',
        sourceHandle: 'response',
        targetHandle: 'prompt',
      });
    });

    expect(useWorkflowStore.getState().edges).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cannot connect: workflow cycles are not allowed',
    );
  });

  it('onNodesChange commits the final position to the store on drag-end', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 100, y: 100 },
          data: geminiData,
        },
      ],
      edges: [],
    });
    render(<Canvas />);
    const onNodesChange = rfHandlers.onNodesChange as (
      changes: Array<{
        id: string;
        type: string;
        position?: { x: number; y: number };
        dragging?: boolean;
      }>,
    ) => void;
    // Simulate a mid-drag move: position should NOT be committed yet.
    onNodesChange([{ id: 'gem1', type: 'position', position: { x: 250, y: 250 }, dragging: true }]);
    expect(useWorkflowStore.getState().nodes[0].position).toEqual({ x: 100, y: 100 });
    // Simulate drag release: position commits to store.
    onNodesChange([
      { id: 'gem1', type: 'position', position: { x: 300, y: 320 }, dragging: false },
    ]);
    expect(useWorkflowStore.getState().nodes[0].position).toEqual({ x: 300, y: 320 });
  });

  it('onConnect with missing source/target/handles is a no-op', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'crop1',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: cropData,
        },
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 200, y: 0 },
          data: geminiData,
        },
      ],
      edges: [],
    });
    render(<Canvas />);
    const before = useWorkflowStore.getState().edges.length;
    const onConnect = rfHandlers.onConnect as (c: {
      source: string | null;
      target: string | null;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => void;
    onConnect({
      source: 'crop1',
      target: 'gem1',
      sourceHandle: null,
      targetHandle: 'vision',
    });
    expect(useWorkflowStore.getState().edges).toHaveLength(before);
  });
});
