import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasShell } from '../CanvasShell';

// Mock the Canvas to avoid React Flow.
vi.mock('../Canvas', () => ({
  Canvas: () => <div data-testid="canvas-mock">canvas</div>,
}));

// Mock next/link to a plain anchor.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseGraph = {
  schemaVersion: 1 as const,
  nodes: [],
  edges: [],
};

describe('CanvasShell', () => {
  it('renders the workflow name and Canvas placeholder', () => {
    render(
      <CanvasShell
        workflowId="wf1"
        workflowName="Test Workflow"
        initialGraph={baseGraph}
        updatedAt="2025-01-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('canvas-mock')).toBeInTheDocument();
  });
});
