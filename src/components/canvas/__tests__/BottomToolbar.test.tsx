import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomToolbar } from '../BottomToolbar';
import { useWorkflowStore } from '../../../lib/store/workflowStore';

beforeEach(() => {
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
});

describe('BottomToolbar', () => {
  it('renders the + button', () => {
    render(<BottomToolbar />);
    expect(screen.getByTestId('bottom-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add node' })).toBeInTheDocument();
  });

  it('clicking + opens the picker dialog', async () => {
    const user = userEvent.setup();
    render(<BottomToolbar />);
    expect(screen.queryByRole('dialog', { name: 'Add a node' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    expect(screen.getByRole('dialog', { name: 'Add a node' })).toBeInTheDocument();
  });

  it('picking Crop Image adds a crop-image node via addNode', async () => {
    const user = userEvent.setup();
    render(<BottomToolbar />);
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    const before = useWorkflowStore.getState().nodes.length;
    await user.click(screen.getByTestId('catalog-card-crop-image'));
    const after = useWorkflowStore.getState().nodes;
    expect(after).toHaveLength(before + 1);
    const added = after[after.length - 1];
    expect(added.type).toBe('crop-image');
  });

  it('picking Gemini adds a gemini node via addNode', async () => {
    const user = userEvent.setup();
    render(<BottomToolbar />);
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.click(screen.getByRole('tab', { name: 'LLMs' }));
    const before = useWorkflowStore.getState().nodes.length;
    await user.click(screen.getByTestId('catalog-card-gemini-3.1-pro'));
    const after = useWorkflowStore.getState().nodes;
    expect(after).toHaveLength(before + 1);
    const added = after[after.length - 1];
    expect(added.type).toBe('gemini');
    expect(added.data).toMatchObject({
      model: 'gemini-3.1-pro',
      prompt: '',
      systemPrompt: '',
    });
  });
});
