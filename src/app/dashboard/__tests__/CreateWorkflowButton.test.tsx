import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateWorkflowButton } from '../CreateWorkflowButton';

const { mockPush, useRouterMock } = vi.hoisted(() => {
  const mockPush = vi.fn();
  return {
    mockPush,
    useRouterMock: vi.fn(() => ({ push: mockPush })),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: useRouterMock,
}));

vi.mock('../actions', () => ({
  createWorkflow: vi.fn(),
}));

import { useRouter } from 'next/navigation';
import { createWorkflow } from '../actions';

describe('CreateWorkflowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockImplementation(() => ({ push: mockPush }));
  });

  it('starts collapsed showing the create button', () => {
    render(<CreateWorkflowButton />);
    expect(screen.getByRole('button', { name: /create new workflow/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('expands to show name input when clicked', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    expect(screen.getByRole('textbox', { name: /workflow name/i })).toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name is required/i);
    expect(createWorkflow).not.toHaveBeenCalled();
  });

  it('invokes optimistic create hooks before navigation on success', async () => {
    const onOptimisticCreate = vi.fn(() => 'pending-id');
    const onResolveCreate = vi.fn();
    vi.mocked(createWorkflow).mockResolvedValue({ ok: true, data: { id: 'wf_real' } });
    const user = userEvent.setup();
    render(
      <CreateWorkflowButton
        onOptimisticCreate={onOptimisticCreate}
        onResolveCreate={onResolveCreate}
      />,
    );
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'Optimistic');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onOptimisticCreate).toHaveBeenCalledWith('Optimistic');
    expect(createWorkflow).toHaveBeenCalledWith({ name: 'Optimistic' });
    expect(onResolveCreate).toHaveBeenCalledWith('pending-id', 'wf_real');
  });

  it('calls createWorkflow and navigates on success', async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(createWorkflow).mockResolvedValue({ ok: true, data: { id: 'wf_123' } });

    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'My Wf');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(createWorkflow).toHaveBeenCalledWith({ name: 'My Wf' });
    expect(push).toHaveBeenCalledWith('/workflow/wf_123');
  });

  it('shows error from server action and stays expanded', async () => {
    vi.mocked(createWorkflow).mockResolvedValue({ ok: false, error: 'DB unavailable' });
    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'X');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/db unavailable/i);
    expect(screen.getByRole('textbox', { name: /workflow name/i })).toBeInTheDocument();
  });

  it('cancel button collapses back to default state', async () => {
    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'oops');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new workflow/i })).toBeInTheDocument();
  });

  it('trims whitespace before submitting', async () => {
    vi.mocked(createWorkflow).mockResolvedValue({ ok: true, data: { id: 'x' } });
    const user = userEvent.setup();
    render(<CreateWorkflowButton />);
    await user.click(screen.getByRole('button', { name: /create new workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), '   Whitespace   ');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(createWorkflow).toHaveBeenCalledWith({ name: 'Whitespace' });
  });
});
