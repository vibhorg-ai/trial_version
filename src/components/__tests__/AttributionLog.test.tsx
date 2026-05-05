import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { AttributionLog } from '../AttributionLog';

describe('AttributionLog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the exact attribution string once on mount', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<AttributionLog />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/harshuldhar',
    );
  });

  it('does not log a second time on re-render with same pathname', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { rerender } = render(<AttributionLog />);
    rerender(<AttributionLog />);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
