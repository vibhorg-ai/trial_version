import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { POST } from '../route';
import { mockClerkAuth } from '../../../../../test/integration/clerk';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

function postRequest(): Request {
  return new Request('http://localhost/api/transloadit/sign', { method: 'POST' });
}

describe('POST /api/transloadit/sign', () => {
  beforeEach(() => {
    vi.stubEnv('TRANSLOADIT_AUTH_KEY', 'route-test-key');
    vi.stubEnv('TRANSLOADIT_AUTH_SECRET', 'route-test-secret');
    vi.stubEnv('TRANSLOADIT_TEMPLATE_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(auth).mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockClerkAuth(null);
    const res = await POST(postRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with params and signature when authenticated', async () => {
    mockClerkAuth('user_123');
    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { params: string; signature: string };
    expect(typeof body.params).toBe('string');
    expect(body.params.length).toBeGreaterThan(0);
    expect(typeof body.signature).toBe('string');
    expect(body.signature.startsWith('sha384:')).toBe(true);
  });

  it('returns 500 when TRANSLOADIT_AUTH_KEY is missing', async () => {
    mockClerkAuth('user_123');
    vi.stubEnv('TRANSLOADIT_AUTH_KEY', '');
    const res = await POST(postRequest());
    expect(res.status).toBe(500);
  });

  it('returns 500 when TRANSLOADIT_AUTH_SECRET is missing', async () => {
    mockClerkAuth('user_123');
    vi.stubEnv('TRANSLOADIT_AUTH_SECRET', '');
    const res = await POST(postRequest());
    expect(res.status).toBe(500);
  });

  it('returns a signature that matches HMAC-SHA384 of params', async () => {
    mockClerkAuth('user_123');
    vi.stubEnv('TRANSLOADIT_AUTH_SECRET', 'sig-check-secret');
    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { params: string; signature: string };
    const expectedHex = createHmac('sha384', 'sig-check-secret')
      .update(body.params, 'utf8')
      .digest('hex');
    expect(body.signature).toBe(`sha384:${expectedHex}`);
  });
});
