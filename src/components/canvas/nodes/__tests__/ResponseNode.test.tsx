import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponseNode } from '../ResponseNode';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

vi.mock('reactflow', () => ({
  Handle: ({ id, type, position }: { id: string; type: string; position: string }) => (
    <div data-testid={`handle-${id}`} data-type={type} data-position={position} />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const staticProps = {
  id: 'resp-1',
  type: 'response' as const,
  selected: false,
  isConnectable: true,
  zIndex: 0,
  xPos: 0,
  yPos: 0,
  dragging: false,
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf',
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
});

describe('ResponseNode', () => {
  it('renders a single result input handle and no outputs', () => {
    render(<ResponseNode {...staticProps} data={{ capturedValue: null }} />);
    const handles = screen.getAllByTestId(/^handle-/);
    expect(handles).toHaveLength(1);
    expect(screen.getByTestId('handle-result')).toHaveAttribute('data-type', 'target');
    expect(screen.getByTestId('handle-result')).toHaveAttribute('data-position', 'left');
  });

  it('shows placeholder when there is no captured value', () => {
    render(<ResponseNode {...staticProps} data={{ capturedValue: null }} />);
    expect(screen.getByTestId('response-body')).toHaveTextContent('Awaiting workflow run…');
  });

  it('shows captured string value when present', () => {
    render(<ResponseNode {...staticProps} data={{ capturedValue: 'Done!' }} />);
    expect(screen.getByTestId('response-body')).toHaveTextContent('Done!');
  });

  it('passes runStatus running to BaseNodeShell', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'resp-1': 'running' } });
    render(<ResponseNode {...staticProps} data={{ capturedValue: null }} />);
    expect(screen.getByTestId('node-shell')).toHaveAttribute('data-run-status', 'running');
  });

  it('marks BaseNodeShell selected when store selectedNodeId matches this node', () => {
    useWorkflowStore.setState({ selectedNodeId: 'resp-1' });
    render(<ResponseNode {...staticProps} data={{ capturedValue: null }} />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-selected');
  });
});
