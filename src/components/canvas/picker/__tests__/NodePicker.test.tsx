import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodePicker } from '../NodePicker';

describe('NodePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when open=false', () => {
    const { container } = render(<NodePicker open={false} onClose={vi.fn()} onPick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open=true', () => {
    render(<NodePicker open onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Add a node' })).toBeInTheDocument();
  });

  it('renders all 6 tabs', () => {
    render(<NodePicker open onClose={vi.fn()} onPick={vi.fn()} />);
    for (const label of ['Recent', 'Image', 'Video', 'Audio', 'LLMs', 'Others']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('default tab is Image with Crop card; LLMs tab shows Gemini', async () => {
    const user = userEvent.setup();
    render(<NodePicker open onClose={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByTestId('catalog-card-crop-image')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-gemini-3.1-pro')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'LLMs' }));
    expect(screen.getByTestId('catalog-card-gemini-3.1-pro')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-crop-image')).not.toBeInTheDocument();
  });

  it('search filters cards by name on LLMs tab', async () => {
    const user = userEvent.setup();
    render(<NodePicker open onClose={vi.fn()} onPick={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'LLMs' }));
    const search = screen.getByRole('searchbox', { name: 'Search nodes' });
    await user.type(search, 'gem');
    expect(screen.getByTestId('catalog-card-gemini-3.1-pro')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'xyz');
    expect(screen.getByText(/No nodes matching "xyz"/)).toBeInTheDocument();
  });

  it('clicking Crop Image card calls onPick with the crop catalog entry', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<NodePicker open onClose={vi.fn()} onPick={onPick} />);
    await user.click(screen.getByTestId('catalog-card-crop-image'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].id).toBe('crop-image');
  });

  it('clicking a disabled placeholder card does not call onPick', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<NodePicker open onClose={vi.fn()} onPick={onPick} />);
    await user.click(screen.getByRole('tab', { name: 'Video' }));
    const card = screen.getByTestId('catalog-card-video-trim');
    expect(card).toBeDisabled();
    await user.click(card);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('clicking Close calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NodePicker open onClose={onClose} onPick={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop calls onClose; clicking inside the panel does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NodePicker open onClose={onClose} onPick={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Add a node' });
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    await user.click(screen.getByRole('searchbox', { name: 'Search nodes' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape calls onClose when open', () => {
    const onClose = vi.fn();
    render(<NodePicker open onClose={onClose} onPick={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
