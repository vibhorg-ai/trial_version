import { describe, expect, it, vi } from 'vitest';

import { pollAssembly, resolveAssemblyBody, resolveAssemblyUrl } from '../transloadit-assembly';

describe('resolveAssemblyUrl', () => {
  it('returns the first results step ssl_url', () => {
    const url = resolveAssemblyUrl({
      results: { my_step: [{ ssl_url: 'https://cdn/x.png' }] },
    });
    expect(url).toBe('https://cdn/x.png');
  });

  it('falls back to the first results step url when ssl_url is missing', () => {
    const url = resolveAssemblyUrl({
      results: { my_step: [{ url: 'http://cdn/x.png' }] },
    });
    expect(url).toBe('http://cdn/x.png');
  });

  it('walks past empty result steps to find a populated one', () => {
    const url = resolveAssemblyUrl({
      results: {
        empty_step: [],
        another_empty: [{}],
        good_step: [{ ssl_url: 'https://cdn/found.png' }],
      },
    });
    expect(url).toBe('https://cdn/found.png');
  });

  it('falls back to uploads[0].ssl_url when results has no URL', () => {
    const url = resolveAssemblyUrl({
      results: {},
      uploads: [{ ssl_url: 'https://cdn/raw.png' }],
    });
    expect(url).toBe('https://cdn/raw.png');
  });

  it('returns null when neither results nor uploads contains a URL', () => {
    expect(resolveAssemblyUrl({})).toBeNull();
    expect(resolveAssemblyUrl({ results: {}, uploads: [] })).toBeNull();
    expect(resolveAssemblyUrl({ uploads: [{}] })).toBeNull();
  });
});

describe('pollAssembly', () => {
  it('returns the body once ok is ASSEMBLY_COMPLETED', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: 'ASSEMBLY_EXECUTING' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: 'ASSEMBLY_COMPLETED',
            uploads: [{ ssl_url: 'https://cdn/ok.png' }],
          }),
          { status: 200 },
        ),
      );

    const body = await pollAssembly('https://api/assemblies/abc', {
      fetchFn: fetchFn as unknown as typeof fetch,
      intervalMs: 1,
    });
    expect(body.ok).toBe('ASSEMBLY_COMPLETED');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws when ok is a terminal failure state', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: 'ASSEMBLY_CANCELED',
          message: 'user cancelled',
        }),
        { status: 200 },
      ),
    );

    await expect(
      pollAssembly('https://api/assemblies/abc', {
        fetchFn: fetchFn as unknown as typeof fetch,
        intervalMs: 1,
      }),
    ).rejects.toThrow(/user cancelled/);
  });

  it('throws when polling fetch returns a non-200 status', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(
      pollAssembly('https://api/assemblies/abc', {
        fetchFn: fetchFn as unknown as typeof fetch,
        intervalMs: 1,
      }),
    ).rejects.toThrow(/polling failed \(500\)/);
  });

  it('respects the timeout', async () => {
    // Use a factory so each call gets a fresh Response (body can only be consumed once).
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ ok: 'ASSEMBLY_EXECUTING' }), { status: 200 }),
    );

    await expect(
      pollAssembly('https://api/assemblies/abc', {
        fetchFn: fetchFn as unknown as typeof fetch,
        intervalMs: 5,
        timeoutMs: 30,
      }),
    ).rejects.toThrow(/did not complete within/);
  });
});

describe('resolveAssemblyBody', () => {
  it('returns the input directly when already completed', async () => {
    const body = await resolveAssemblyBody({
      ok: 'ASSEMBLY_COMPLETED',
      results: { s: [{ ssl_url: 'https://cdn/x.png' }] },
    });
    expect(body.ok).toBe('ASSEMBLY_COMPLETED');
  });

  it('polls when initial response is still executing', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: 'ASSEMBLY_COMPLETED',
            uploads: [{ ssl_url: 'https://cdn/poll.png' }],
          }),
          { status: 200 },
        ),
      );

    const body = await resolveAssemblyBody(
      {
        ok: 'ASSEMBLY_EXECUTING',
        assembly_ssl_url: 'https://api/assemblies/abc',
      },
      { fetchFn: fetchFn as unknown as typeof fetch, intervalMs: 1 },
    );
    expect(body.ok).toBe('ASSEMBLY_COMPLETED');
    expect(fetchFn).toHaveBeenCalledWith('https://api/assemblies/abc');
  });

  it('throws using error/message when no assembly URL is available to poll', async () => {
    await expect(
      resolveAssemblyBody({ ok: 'ASSEMBLY_EXECUTING', message: 'still going' }),
    ).rejects.toThrow(/still going/);
  });

  it('throws a generic error when no assembly URL and no message', async () => {
    await expect(resolveAssemblyBody({ ok: 'ASSEMBLY_EXECUTING' })).rejects.toThrow(
      /no assembly URL/i,
    );
  });
});
