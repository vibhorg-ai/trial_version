import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardWorkflowShell } from '../DashboardWorkflowShell';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  renameWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  createWorkflow: vi.fn(),
}));

import { renameWorkflow, deleteWorkflow } from '../actions';

const t0 = new Date('2020-01-01T00:00:00.000Z');

describe('WorkflowList (DashboardWorkflowShell)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies optimistic rename before the server action resolves', async () => {
    vi.mocked(renameWorkflow).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: undefined }), 80)),
    );
    const user = userEvent.setup();
    render(
      <DashboardWorkflowShell
        initialWorkflows={[{ id: 'wf_1', name: 'Alpha Flow', updatedAt: t0 }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.clear(screen.getByRole('textbox', { name: /workflow name/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'Beta Flow');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Beta Flow' })).toBeInTheDocument();
    });
    await waitFor(() => expect(renameWorkflow).toHaveBeenCalled());
  });

  it('removes a card optimistically on delete', async () => {
    vi.mocked(deleteWorkflow).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: undefined }), 80)),
    );
    const user = userEvent.setup();
    render(
      <DashboardWorkflowShell
        initialWorkflows={[
          { id: 'wf_1', name: 'Keep', updatedAt: t0 },
          { id: 'wf_2', name: 'Trash', updatedAt: t0 },
        ]}
      />,
    );
    const deleteButtonsWF2 = screen.getAllByRole('button', { name: /delete workflow/i });
    await user.click(deleteButtonsWF2[1]);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Trash' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Keep' })).toBeInTheDocument();
    expect(deleteWorkflow).toHaveBeenCalledWith({ id: 'wf_2' });
  });

  it('reverts optimistic rename when the action returns ok:false', async () => {
    vi.mocked(renameWorkflow).mockResolvedValue({ ok: false, error: 'nope' });
    const user = userEvent.setup();
    render(
      <DashboardWorkflowShell
        initialWorkflows={[{ id: 'wf_1', name: 'Alpha Flow', updatedAt: t0 }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.clear(screen.getByRole('textbox', { name: /workflow name/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'Broken');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Alpha Flow' })).toBeInTheDocument();
    });
  });
});
