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
  model: 'gemini-2.5-flash-lite',
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

  it('renders thumbnail <img> for each upstream crop-image vision input', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem-1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: { ...geminiData },
        },
        {
          id: 'crop-a',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
        },
        {
          id: 'crop-b',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 50, h: 50, inputImageUrl: null },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'crop-a',
          target: 'gem-1',
          sourceHandle: 'output',
          targetHandle: 'vision',
        },
        {
          id: 'e2',
          source: 'crop-b',
          target: 'gem-1',
          sourceHandle: 'output',
          targetHandle: 'vision',
        },
      ],
      nodeRunOutput: {
        'crop-a': { kind: 'image', url: 'https://cdn/a.png' },
        'crop-b': { kind: 'image', url: 'https://cdn/b.png' },
      },
    });
    render(<GeminiHarness id="gem-1" />);
    const thumbs = screen.getAllByTestId('gemini-vision-thumb');
    expect(thumbs).toHaveLength(2);
    const imgs = thumbs.flatMap((t) => Array.from(t.querySelectorAll('img')));
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([
      'https://cdn/a.png',
      'https://cdn/b.png',
    ]);
  });

  it('renders a pending placeholder while an upstream vision input has no output yet', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem-1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: { ...geminiData },
        },
        {
          id: 'crop-a',
          type: 'crop-image',
          position: { x: 0, y: 0 },
          data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'crop-a',
          target: 'gem-1',
          sourceHandle: 'output',
          targetHandle: 'vision',
        },
      ],
      nodeRunOutput: {},
    });
    render(<GeminiHarness id="gem-1" />);
    const thumb = screen.getByTestId('gemini-vision-thumb');
    expect(thumb.querySelector('img')).toBeNull();
    expect(thumb).toHaveTextContent('pending');
  });

  it('resolves an image_field on a request-inputs node into a thumbnail', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem-1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: { ...geminiData },
        },
        {
          id: 'req',
          type: 'request-inputs',
          position: { x: 0, y: 0 },
          data: {
            fields: [
              { fieldType: 'image_field', name: 'photo', value: null },
              { fieldType: 'text_field', name: 'topic', value: '' },
            ],
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'req',
          target: 'gem-1',
          sourceHandle: 'photo',
          targetHandle: 'vision',
        },
      ],
      // The runtime store also accepts `{fields:{...}}` for request-inputs
      // (orchestrator writes that shape) even though the static NodeOutput
      // type is text|image — cast to satisfy TS in the test fixture.
      nodeRunOutput: {
        req: { fields: { photo: 'https://cdn/photo.jpg', topic: '' } } as unknown as never,
      } as never,
    });
    render(<GeminiHarness id="gem-1" />);
    const thumb = screen.getByTestId('gemini-vision-thumb');
    const img = thumb.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://cdn/photo.jpg');
  });

  it('passes runStatus running to BaseNodeShell', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'gem-1': 'running' } });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('node-shell')).toHaveAttribute('data-run-status', 'running');
  });

  it('marks BaseNodeShell selected when store selectedNodeId matches this node', () => {
    useWorkflowStore.setState({ selectedNodeId: 'gem-1' });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-selected');
  });

  it('renders the live text output from nodeRunOutput when available', () => {
    useWorkflowStore.setState({
      nodeRunOutput: { 'gem-1': { kind: 'text', text: 'Hello from Gemini' } },
      nodeRunStatus: { 'gem-1': 'success' },
    });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('gemini-output')).toHaveTextContent('Hello from Gemini');
    expect(screen.queryByTestId('gemini-output-placeholder')).toBeNull();
  });

  it('renders an error message when the gemini run failed', () => {
    useWorkflowStore.setState({
      nodeRunStatus: { 'gem-1': 'failed' },
      nodeRunError: { 'gem-1': 'API quota exhausted' },
    });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('gemini-output-error')).toHaveTextContent('API quota exhausted');
  });

  it('shows a Generating placeholder while running', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'gem-1': 'running' } });
    render(<GeminiHarness id="gem-1" />);
    expect(screen.getByTestId('gemini-output-placeholder')).toHaveTextContent('Generating');
  });

  it('shows the effective Gemini model in the settings dropdown', async () => {
    const user = userEvent.setup();
    render(<GeminiHarness id="gem-1" />);

    await user.click(screen.getByTestId('toggle-settings'));

    expect(screen.getByLabelText('Gemini model')).toHaveValue('gemini-2.5-flash-lite');
    expect(screen.getByRole('option', { name: 'gemini-2.5-flash-lite' })).toBeInTheDocument();
  });
});
