import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransloaditUpload } from '../TransloaditUpload';

describe('TransloaditUpload', () => {
  const uploadUrl = expect.stringContaining('api2.transloadit.com/assemblies');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Choose file when value is null', () => {
    render(<TransloaditUpload value={null} onUpload={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByTestId('transloadit-choose-file')).toHaveTextContent(/choose file/i);
  });

  it('renders thumbnail and Remove when value is set', () => {
    const url = 'https://cdn.example.com/folder/photo.png';
    render(<TransloaditUpload value={url} onUpload={vi.fn()} onClear={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', url);
    expect(screen.getByTestId('transloadit-remove')).toBeInTheDocument();
  });

  it('calls onClear when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <TransloaditUpload
        value="https://cdn.example.com/a.png"
        onUpload={vi.fn()}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByTestId('transloadit-remove'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('requests a signature then posts the assembly after choosing a file', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ params: '{"x":1}', signature: 'sha384:dead' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: { import: [{ ssl_url: 'https://cdn.example.com/up.png' }] },
          }),
          { status: 200 },
        ),
      );

    render(<TransloaditUpload value={null} onUpload={vi.fn()} onClear={vi.fn()} />);
    const input = screen.getByLabelText('Choose image file');
    await user.upload(input, new File(['bytes'], 'shot.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/transloadit/sign', { method: 'POST' });
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        uploadUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('calls onUpload with ssl_url on success', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ params: '{}', signature: 'sha384:ab' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: { step_a: [{ ssl_url: 'https://cdn.example.com/final.jpg' }] },
          }),
          { status: 200 },
        ),
      );

    render(<TransloaditUpload value={null} onUpload={onUpload} onClear={vi.fn()} />);
    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
    );

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith('https://cdn.example.com/final.jpg');
    });
  });

  it('shows an error when signing fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('err', { status: 500 }));

    render(<TransloaditUpload value={null} onUpload={vi.fn()} onClear={vi.fn()} />);
    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['x'], 'a.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/upload failed:/i);
    });
  });
});
