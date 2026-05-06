import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseNodeShell } from '../BaseNodeShell';
import type { HandleSpec } from '../../../../lib/dag/handles';

vi.mock('reactflow', () => ({
  Handle: ({ id, type, position }: { id: string; type: string; position: string }) => (
    <div data-testid={`handle-${id}`} data-type={type} data-position={position} />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const handles: HandleSpec[] = [
  { id: 'in1', side: 'input', kind: 'text', multi: false },
  { id: 'out1', side: 'output', kind: 'image', multi: false },
];

describe('BaseNodeShell', () => {
  it('renders title and tooltip and body', () => {
    render(
      <BaseNodeShell title="Test Node" tooltip="A helpful tooltip" handles={[]}>
        <span>body</span>
      </BaseNodeShell>,
    );
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    // Tooltip is exposed via aria-label / title, not visible text — Galaxy
    // shows it on hover only.
    expect(screen.getByLabelText('A helpful tooltip')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('applies is-running when runStatus is running', () => {
    render(<BaseNodeShell title="T" handles={[]} runStatus="running" />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-running');
  });

  it('applies is-success when runStatus is success', () => {
    render(<BaseNodeShell title="T" handles={[]} runStatus="success" />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-success');
  });

  it('applies is-failed when runStatus is failed', () => {
    render(<BaseNodeShell title="T" handles={[]} runStatus="failed" />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-failed');
  });

  it('applies is-idle when runStatus is omitted', () => {
    render(<BaseNodeShell title="T" handles={[]} />);
    const shell = screen.getByTestId('node-shell');
    expect(shell).toHaveClass('is-idle');
    expect(shell).toHaveAttribute('data-run-status', 'idle');
  });

  it('renders one Handle per handle spec with correct React Flow types', () => {
    render(<BaseNodeShell title="T" handles={handles} />);
    expect(screen.getByTestId('handle-in1')).toHaveAttribute('data-type', 'target');
    expect(screen.getByTestId('handle-in1')).toHaveAttribute('data-position', 'left');
    expect(screen.getByTestId('handle-out1')).toHaveAttribute('data-type', 'source');
    expect(screen.getByTestId('handle-out1')).toHaveAttribute('data-position', 'right');
  });

  it('applies is-selected when selected', () => {
    render(<BaseNodeShell title="T" handles={[]} selected />);
    expect(screen.getByTestId('node-shell')).toHaveClass('is-selected');
  });
});
