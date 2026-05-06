import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowCard } from '../WorkflowCard';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('../actions', () => ({
  renameWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

import { renameWorkflow, deleteWorkflow } from '../actions';

const baseWorkflow = {
  id: 'wf_1',
  name: 'Alpha Flow',
  updatedAt: new Date('2020-01-01T00:00:00.000Z'),
};

describe('WorkflowCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name and last-edited timestamp', () => {
    render(<WorkflowCard workflow={baseWorkflow} />);
    expect(screen.getByText('Alpha Flow')).toBeInTheDocument();
    expect(screen.getByText(/last edited/i)).toBeInTheDocument();
  });

  it('links workflow name to /workflow/[id]', () => {
    render(<WorkflowCard workflow={baseWorkflow} />);
    const link = screen.getByRole('link', { name: 'Alpha Flow' });
    expect(link).toHaveAttribute('href', '/workflow/wf_1');
  });

  it('reveals rename input prefilled when pencil is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    expect(screen.getByRole('textbox', { name: /workflow name/i })).toHaveDisplayValue(
      'Alpha Flow',
    );
  });

  it('calls renameWorkflow with trimmed name on save', async () => {
    vi.mocked(renameWorkflow).mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.clear(screen.getByRole('textbox', { name: /workflow name/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), '   Beta   ');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(renameWorkflow).toHaveBeenCalledWith({ id: 'wf_1', name: 'Beta' });
  });

  it('shows validation error for empty rename and does not call action', async () => {
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.clear(screen.getByRole('textbox', { name: /workflow name/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
    expect(renameWorkflow).not.toHaveBeenCalled();
  });

  it('cancel rename returns to view without calling action', async () => {
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'oops');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(renameWorkflow).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha Flow' })).toBeInTheDocument();
  });

  it('returns to view state after successful rename', async () => {
    vi.mocked(renameWorkflow).mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.queryByRole('textbox', { name: /workflow name/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename workflow/i })).toBeInTheDocument();
  });

  it('shows error alert when rename fails', async () => {
    vi.mocked(renameWorkflow).mockResolvedValue({ ok: false, error: 'nope' });
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/nope/i);
  });

  it('shows delete confirmation when trash is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /delete workflow/i }));
    expect(screen.getByText(/sure/i)).toBeInTheDocument();
  });

  it('delegates rename to onRename when provided', async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} onRename={onRename} />);
    await user.click(screen.getByRole('button', { name: /rename workflow/i }));
    await user.clear(screen.getByRole('textbox', { name: /workflow name/i }));
    await user.type(screen.getByRole('textbox', { name: /workflow name/i }), 'Delegated');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onRename).toHaveBeenCalledWith('Delegated');
    expect(renameWorkflow).not.toHaveBeenCalled();
  });

  it('delegates delete to onDelete when provided', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /delete workflow/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalled();
    expect(deleteWorkflow).not.toHaveBeenCalled();
  });

  it('calls deleteWorkflow when delete is confirmed', async () => {
    vi.mocked(deleteWorkflow).mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /delete workflow/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteWorkflow).toHaveBeenCalledWith({ id: 'wf_1' });
  });

  it('cancel delete returns to view without calling action', async () => {
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /delete workflow/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(deleteWorkflow).not.toHaveBeenCalled();
    expect(screen.queryByText(/sure/i)).not.toBeInTheDocument();
  });

  it('shows error alert when delete fails', async () => {
    vi.mocked(deleteWorkflow).mockResolvedValue({ ok: false, error: 'cannot' });
    const user = userEvent.setup();
    render(<WorkflowCard workflow={baseWorkflow} />);
    await user.click(screen.getByRole('button', { name: /delete workflow/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot/i);
  });
});
