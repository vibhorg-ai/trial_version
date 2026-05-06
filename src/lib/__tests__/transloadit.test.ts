import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { formatExpires, buildAuthParams, signParams } from '../transloadit';

describe('transloadit helpers', () => {
  beforeEach(() => {
    vi.stubEnv('TRANSLOADIT_AUTH_KEY', 'test-auth-key');
    vi.stubEnv('TRANSLOADIT_TEMPLATE_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formatExpires uses Transloadit UTC format', () => {
    expect(formatExpires(new Date('2026-05-06T15:30:00Z'))).toBe('2026/05/06 15:30:00+00:00');
  });

  it('buildAuthParams sets auth.key from env and expires ttlSeconds ahead', () => {
    vi.stubEnv('TRANSLOADIT_AUTH_KEY', 'from-env');
    const now = new Date('2020-06-15T12:00:00Z');
    const p = buildAuthParams(now, 90);
    expect(p.auth.key).toBe('from-env');
    expect(p.auth.expires).toBe('2020/06/15 12:01:30+00:00');
  });

  it('buildAuthParams includes template_id when env var is set', () => {
    vi.stubEnv('TRANSLOADIT_TEMPLATE_ID', ' tmpl-123 ');
    const p = buildAuthParams(new Date('2020-01-01T00:00:00Z'), 0);
    expect(p.template_id).toBe('tmpl-123');
  });

  it('buildAuthParams omits template_id when env var is not set', () => {
    vi.stubEnv('TRANSLOADIT_TEMPLATE_ID', '');
    const p = buildAuthParams(new Date('2020-01-01T00:00:00Z'), 0);
    expect(p).not.toHaveProperty('template_id');
  });

  it('signParams returns sha384:<hex> matching HMAC-SHA384', () => {
    const secret = 'hush';
    const paramsJson = '{"auth":{"key":"k","expires":"2026/05/06 15:30:00+00:00"}}';
    const expectedHex = createHmac('sha384', secret).update(paramsJson, 'utf8').digest('hex');
    expect(signParams(paramsJson, secret)).toBe(`sha384:${expectedHex}`);
  });
});
