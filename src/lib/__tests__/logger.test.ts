import { describe, it, expect } from 'vitest';
import { logger, withRoute } from '../logger';

describe('logger', () => {
  it('exposes standard log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('withRoute returns a child logger', () => {
    const child = withRoute('GET /test');
    expect(typeof child.info).toBe('function');
    expect(child.bindings()).toMatchObject({ route: 'GET /test', service: 'nextflow' });
  });
});
