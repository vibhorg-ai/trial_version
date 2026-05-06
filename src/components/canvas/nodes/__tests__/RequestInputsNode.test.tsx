import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestInputsNode } from '../RequestInputsNode';
import { useWorkflowStore } from '../../../../lib/store/workflowStore';
import type { WorkflowGraph } from '../../../../lib/schemas/workflow';

vi.mock('reactflow', () => ({
  Handle: ({ id, type, position }: { id: string; type: string; position: string }) => (
    <div data-testid={`handle-${id}`} data-type={type} data-position={position} />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const graphFieldSample: WorkflowGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'req-1',
      type: 'request-inputs',
      position: { x: 0, y: 0 },
      data: {
        fields: [
          { fieldType: 'text_field', name: 'topic', value: 'hello' },
          { fieldType: 'image_field', name: 'product_image', value: null },
        ],
      },
    },
  ],
  edges: [],
};

function RequestInputsHarness({ id }: { id: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === id));
  if (!node || node.type !== 'request-inputs') return null;
  return (
    <RequestInputsNode
      id={node.id}
      type="request-inputs"
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
  useWorkflowStore.getState().hydrate({
    workflowId: 'wf-test',
    name: 'Test',
    graph: graphFieldSample,
    updatedAt: new Date().toISOString(),
  });
});

describe('RequestInputsNode', () => {
  it('maps nodeRunStatus running to BaseNodeShell', () => {
    useWorkflowStore.setState({ nodeRunStatus: { 'req-1': 'running' } });
    render(<RequestInputsHarness id="req-1" />);
    expect(screen.getByTestId('node-shell')).toHaveAttribute('data-run-status', 'running');
  });

  it('renders one row per field', () => {
    render(<RequestInputsHarness id="req-1" />);
    expect(screen.getByTestId('request-field-row-topic')).toBeInTheDocument();
    expect(screen.getByTestId('request-field-row-product_image')).toBeInTheDocument();
  });

  it('updates the store when the field name is edited', async () => {
    const user = userEvent.setup();
    render(<RequestInputsHarness id="req-1" />);
    const row = screen.getByTestId('request-field-row-topic');
    const nameInput = within(row).getByLabelText('Field name');
    await user.clear(nameInput);
    await user.type(nameInput, 'headline');
    const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'req-1');
    expect(node?.type).toBe('request-inputs');
    if (node?.type === 'request-inputs') {
      expect(node.data.fields[0].name).toBe('headline');
    }
  });

  it('renders a textarea for text_field values', () => {
    render(<RequestInputsHarness id="req-1" />);
    const ta = screen.getByLabelText('Value for topic');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta).toHaveValue('hello');
  });

  it('renders Transloadit upload for image_field rows', () => {
    render(<RequestInputsHarness id="req-1" />);
    const row = screen.getByTestId('request-field-row-product_image');
    expect(within(row).getByTestId('transloadit-image-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('image-field-placeholder')).toBeNull();
  });

  it('updates image field value in the store after a successful upload', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ params: '{"a":1}', signature: 'sha384:aa' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: { ':original': [{ ssl_url: 'https://cdn.example.com/out.png' }] },
            }),
            { status: 200 },
          ),
        ),
    );

    render(<RequestInputsHarness id="req-1" />);
    const row = screen.getByTestId('request-field-row-product_image');
    const input = within(row).getByLabelText('Choose image file');
    await user.upload(input, new File(['x'], 'pic.png', { type: 'image/png' }));

    await waitFor(() => {
      const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'req-1');
      expect(node?.type).toBe('request-inputs');
      if (node?.type === 'request-inputs') {
        const imgField = node.data.fields.find((f) => f.name === 'product_image');
        expect(imgField?.fieldType).toBe('image_field');
        if (imgField?.fieldType === 'image_field') {
          expect(imgField.value).toBe('https://cdn.example.com/out.png');
        }
      }
    });

    vi.unstubAllGlobals();
  });

  it('appends a text field when Add text field is chosen', async () => {
    const user = userEvent.setup();
    render(<RequestInputsHarness id="req-1" />);
    await user.click(screen.getByRole('button', { name: /add field/i }));
    await user.click(screen.getByTestId('add-text-field'));
    const node = useWorkflowStore.getState().nodes.find((n) => n.id === 'req-1');
    expect(node?.type).toBe('request-inputs');
    if (node?.type === 'request-inputs') {
      expect(node.data.fields.length).toBe(3);
      const added = node.data.fields[2];
      expect(added?.fieldType).toBe('text_field');
      if (added?.fieldType === 'text_field') {
        expect(added.value).toBe('');
      }
    }
  });

  it('renders output handles for each field name', () => {
    render(<RequestInputsHarness id="req-1" />);
    expect(screen.getByTestId('handle-topic')).toHaveAttribute('data-type', 'source');
    expect(screen.getByTestId('handle-product_image')).toHaveAttribute('data-type', 'source');
  });

  it('disables removing the last remaining field', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'req-1',
          type: 'request-inputs',
          position: { x: 0, y: 0 },
          data: { fields: [{ fieldType: 'text_field', name: 'only', value: '' }] },
        },
      ],
      edges: [],
    });
    render(<RequestInputsHarness id="req-1" />);
    expect(screen.getByRole('button', { name: /remove field only/i })).toBeDisabled();
  });
});
