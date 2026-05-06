import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeminiNode } from '../GeminiNode';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

vi.mock('reactflow', () => ({
  Handle: ({ id, type, position }: { id: string; type: string; position: string }) => (
    <div data-testid={`handle-${id}`} data-type={type} data-position={position} />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: 'Hello',
  systemPrompt: 'Be brief',
  temperature: 0.7,
  maxOutputTokens: 128,
  topP: 0.95,
};

function GeminiHarness({ id }: { id: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === id));
  if (!node || node.type !== 'gemini') return null;
  return (
    <GeminiNode
      id={node.id}
      type="gemini"
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
        id: 'gem-1',
        type: 'gemini',
        position: { x: 0, y: 0 },
        data: { ...geminiData },
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

describe('GeminiNode', () => {
  it('renders the prompt textarea', () => {
    render(<GeminiHarness id="gem-1" />);
    const ta = screen.getByLabelText('Gemini prompt');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta).toHaveValue('Hello');
  });

  it('updates the store when the prompt changes', async () => {
    const user = userEvent.setup();
    render(<GeminiHarness id="gem-1" />);
    const ta = screen.getByLabelText('Gemini prompt');
    await user.clear(ta);
    await user.type(ta, 'New prompt');
    const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'gem-1');
    expect(node?.type).toBe('gemini');
    if (node?.type === 'gemini') {
      expect(node.data.prompt).toBe('New prompt');
    }
  });

  it('disables and greys the prompt when the prompt handle is connected', () => {
    useWorkflowStore.setState({
      edges: [
        {
          id: 'e1',
          source: 'other',
          target: 'gem-1',
          sourceHandle: 'out',
          targetHandle: 'prompt',
        },
      ],
    });
    render(<GeminiHarness id="gem-1" />);
    const ta = screen.getByLabelText('Gemini prompt');
    expect(ta).toBeDisabled();
    expect(ta).toHaveClass('is-greyed');
  });

  it('collapses and expands the system prompt section', async () => {
    const user = userEvent.setup();
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByLabelText('Gemini system prompt')).toBeInTheDocument();
    await user.click(screen.getByTestId('toggle-system-prompt'));
    expect(screen.queryByLabelText('Gemini system prompt')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('toggle-system-prompt'));
    expect(screen.getByLabelText('Gemini system prompt')).toBeInTheDocument();
  });

  it('shows the count of edges targeting the vision handle', () => {
    useWorkflowStore.setState({
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'gem-1',
          sourceHandle: 'img',
          targetHandle: 'vision',
        },
        {
          id: 'e2',
          source: 'b',
          target: 'gem-1',
          sourceHandle: 'img2',
          targetHandle: 'vision',
        },
      ],
    });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('vision-count')).toHaveTextContent('2 images connected');
  });

  it('passes runStatus running to BaseNodeShell', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'gem-1': 'running' } });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('node-shell')).toHaveAttribute('data-run-status', 'running');
  });
});
