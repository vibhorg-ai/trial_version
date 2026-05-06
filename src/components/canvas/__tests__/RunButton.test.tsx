import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunButton } from '../RunButton';
import { createRunSliceInitial, useWorkflowStore } from '../../../lib/store/workflowStore';

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf1',
    name: 'T',
    updatedAt: '',
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    multiSelectedNodeIds: [],
    ...createRunSliceInitial(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RunButton', () => {
  it('renders the Run control', () => {
    render(<RunButton />);
    expect(screen.getByRole('button', { name: /run workflow/i })).toBeInTheDocument();
  });

  it('toolbar variant runs full workflow from the icon button', async () => {
    const user = userEvent.setup();
    const startRun = vi
      .spyOn(useWorkflowStore.getState(), 'startRun')
      .mockResolvedValue({ ok: true });
    render(<RunButton variant="toolbar" />);
    await user.click(screen.getByRole('button', { name: /run workflow/i }));
    expect(startRun).toHaveBeenCalledWith({ scope: 'FULL', selectedNodeIds: [] });
  });

  it('clicking the main button calls startRun with FULL scope', async () => {
    const user = userEvent.setup();
    const startRun = vi
      .spyOn(useWorkflowStore.getState(), 'startRun')
      .mockResolvedValue({ ok: true });
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run workflow/i }));
    expect(startRun).toHaveBeenCalledWith({ scope: 'FULL', selectedNodeIds: [] });
  });

  it('disables the main button when runStatus is running', () => {
    useWorkflowStore.setState({ runStatus: 'running' });
    render(<RunButton />);
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled();
  });

  it('shows Run Single Node disabled when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run options/i }));
    const item = screen.getByRole('menuitem', { name: /run single node/i });
    expect(item).toBeDisabled();
  });

  it('enables Run Single Node when one node is selected and calls startRun', async () => {
    const user = userEvent.setup();
    const startRun = vi
      .spyOn(useWorkflowStore.getState(), 'startRun')
      .mockResolvedValue({ ok: true });
    useWorkflowStore.setState({ selectedNodeId: 'node-a' });
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run options/i }));
    const item = screen.getByRole('menuitem', { name: /run single node/i });
    expect(item).toBeEnabled();
    await user.click(item);
    expect(startRun).toHaveBeenCalledWith({ scope: 'SINGLE', selectedNodeIds: ['node-a'] });
  });

  it('shows Running… on the main button while busy', () => {
    useWorkflowStore.setState({ runStatus: 'starting' });
    render(<RunButton />);
    expect(screen.getByRole('button', { name: /running/i })).toHaveTextContent('Running…');
  });

  it('sets a title on disabled Run Single Node when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run options/i }));
    const item = screen.getByRole('menuitem', { name: /run single node/i });
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute('title', 'Select a single node first');
  });

  it('enables Run Selected when 2+ nodes are multi-selected and dispatches SELECTED scope', async () => {
    const user = userEvent.setup();
    const startRun = vi
      .spyOn(useWorkflowStore.getState(), 'startRun')
      .mockResolvedValue({ ok: true });
    useWorkflowStore.setState({ multiSelectedNodeIds: ['n1', 'n2'] });
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run options/i }));
    const item = screen.getByRole('menuitem', { name: /run selected/i });
    expect(item).toBeEnabled();
    expect(item).toHaveTextContent('2 nodes');
    await user.click(item);
    expect(startRun).toHaveBeenCalledWith({
      scope: 'SELECTED',
      selectedNodeIds: ['n1', 'n2'],
    });
  });

  it('disables Run Selected when fewer than 2 nodes are multi-selected', async () => {
    const user = userEvent.setup();
    render(<RunButton />);
    await user.click(screen.getByRole('button', { name: /run options/i }));
    const item = screen.getByRole('menuitem', { name: /run selected/i });
    expect(item).toBeDisabled();
  });
});
