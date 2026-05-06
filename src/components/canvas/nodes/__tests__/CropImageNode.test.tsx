import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CropImageNode } from '../CropImageNode';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

vi.mock('reactflow', () => ({
  Handle: ({ id, type, position }: { id: string; type: string; position: string }) => (
    <div data-testid={`handle-${id}`} data-type={type} data-position={position} />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const cropData = {
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  inputImageUrl: null as string | null,
};

function CropHarness({ id }: { id: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === id));
  if (!node || node.type !== 'crop-image') return null;
  return (
    <CropImageNode
      id={node.id}
      type="crop-image"
      data={node.data}
      selected={false}
      isConnectable
      zIndex={0}
      xPos={0}
      yPos={0}
      dragging={false}
    />
  );
}

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf',
    name: 'T',
    updatedAt: '',
    nodes: [
      {
        id: 'crop-1',
        type: 'crop-image',
        position: { x: 0, y: 0 },
        data: { ...cropData },
      },
    ],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    ...createRunSliceInitial(),
  });
});

describe('CropImageNode', () => {
  it('renders X/Y/W/H with defaults 0/0/100/100 and matching sliders', () => {
    render(<CropHarness id="crop-1" />);
    expect(screen.getByRole('spinbutton', { name: 'X Position (%)' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Y Position (%)' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Width (%)' })).toHaveValue(100);
    expect(screen.getByRole('spinbutton', { name: 'Height (%)' })).toHaveValue(100);
    expect(screen.getByRole('slider', { name: /X Position \(%\) — slider/ })).toHaveValue('0');
    expect(screen.getByRole('slider', { name: /Width \(%\) — slider/ })).toHaveValue('100');
  });

  it('updates the store when a dimension input changes', async () => {
    const user = userEvent.setup();
    render(<CropHarness id="crop-1" />);
    const x = screen.getByRole('spinbutton', { name: 'X Position (%)' });
    await user.clear(x);
    await user.type(x, '12');
    const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'crop-1');
    expect(node?.type).toBe('crop-image');
    if (node?.type === 'crop-image') {
      expect(node.data.x).toBe(12);
    }
  });

  it('clamps dimension values into 0–100', async () => {
    const user = userEvent.setup();
    render(<CropHarness id="crop-1" />);
    const w = screen.getByRole('spinbutton', { name: 'Width (%)' });
    await user.clear(w);
    await user.type(w, '150');
    const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'crop-1');
    expect(node?.type).toBe('crop-image');
    if (node?.type === 'crop-image') {
      expect(node.data.w).toBe(100);
    }
  });

  it('greys out and disables crop inputs when input-image handle is connected', () => {
    useWorkflowStore.setState({
      edges: [
        {
          id: 'e1',
          source: 'src',
          target: 'crop-1',
          sourceHandle: 'out',
          targetHandle: 'input-image',
        },
      ],
    });
    render(<CropHarness id="crop-1" />);
    const grid = screen.getByTestId('crop-params');
    expect(grid).toHaveClass('is-greyed');
    const inputs = screen.getAllByRole('spinbutton');
    for (const input of inputs) {
      expect(input).toBeDisabled();
      expect(input).toHaveClass('is-greyed');
    }
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toBeDisabled();
    }
  });

  it('renders input-image on the left and output-image on the right', () => {
    render(<CropHarness id="crop-1" />);
    expect(screen.getByTestId('handle-input-image')).toHaveAttribute('data-type', 'target');
    expect(screen.getByTestId('handle-input-image')).toHaveAttribute('data-position', 'left');
    expect(screen.getByTestId('handle-output-image')).toHaveAttribute('data-type', 'source');
    expect(screen.getByTestId('handle-output-image')).toHaveAttribute('data-position', 'right');
  });

  it('passes runStatus running to BaseNodeShell', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'crop-1': 'running' } });
    render(<CropHarness id="crop-1" />);
    expect(screen.getByTestId('node-shell')).toHaveAttribute('data-run-status', 'running');
  });

  it('marks BaseNodeShell selected when store selectedNodeId matches this node', () => {
    useWorkflowStore.setState({ selectedNodeId: 'crop-1' });
    render(<CropHarness id="crop-1" />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-selected');
  });

  it('renders the cropped image preview when nodeRunOutput has a url', () => {
    useWorkflowStore.setState({
      nodeRunOutput: {
        'crop-1': { url: 'https://cdn.example/cropped.png' } as unknown as {
          kind: 'image';
          url: string;
        },
      },
      nodeRunStatus: { 'crop-1': 'success' },
    });
    render(<CropHarness id="crop-1" />);
    const out = screen.getByTestId('crop-output').querySelector('img')!;
    expect(out).toHaveAttribute('src', 'https://cdn.example/cropped.png');
  });

  it('renders an error message when the crop run failed', () => {
    useWorkflowStore.setState({
      nodeRunStatus: { 'crop-1': 'failed' },
      nodeRunError: { 'crop-1': 'Missing input image URL' },
    });
    render(<CropHarness id="crop-1" />);
    expect(screen.getByTestId('crop-output-error')).toHaveTextContent('Missing input image URL');
  });
});
