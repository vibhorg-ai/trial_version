import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowCardSkeleton } from '../WorkflowCardSkeleton';
import { HistoryListSkeleton } from '../HistoryListSkeleton';
import { CanvasSkeleton } from '../CanvasSkeleton';

describe('skeletons', () => {
  it('WorkflowCardSkeleton exposes loading semantics', () => {
    render(<WorkflowCardSkeleton />);
    const el = screen.getByLabelText(/loading workflow card/i);
    expect(el).toHaveAttribute('aria-busy', 'true');
  });

  it('HistoryListSkeleton exposes loading semantics', () => {
    render(<HistoryListSkeleton />);
    const el = screen.getByLabelText(/loading run history/i);
    expect(el).toHaveAttribute('aria-busy', 'true');
  });

  it('CanvasSkeleton exposes loading semantics', () => {
    render(<CanvasSkeleton />);
    const el = screen.getByLabelText(/loading workflow canvas/i);
    expect(el).toHaveAttribute('aria-busy', 'true');
  });
});
