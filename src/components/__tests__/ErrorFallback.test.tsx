import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback', () => {
  it('renders error messaging', () => {
    const err = new Error('test');
    const reset = vi.fn();
    render(<ErrorFallback error={err} reset={reset} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/we have logged the issue/i)).toBeInTheDocument();
  });

  it('renders trace digest when present', () => {
    const err = Object.assign(new Error('x'), { digest: 'abc123' });
    render(<ErrorFallback error={err} reset={vi.fn()} />);
    expect(screen.getByText(/trace: abc123/i)).toBeInTheDocument();
  });

  it('clicking Try again calls reset', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorFallback error={new Error('e')} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders Go to dashboard link', () => {
    render(<ErrorFallback error={new Error('e')} reset={vi.fn()} />);
    const link = screen.getByRole('link', { name: /go to dashboard/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});
