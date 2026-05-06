import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL_ID,
  GEMINI_FALLBACK_MODEL_IDS_AFTER_PRIMARY,
  buildGeminiModelAttemptOrder,
} from '../gemini-model';

describe('buildGeminiModelAttemptOrder', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('puts primary first then default fallbacks, deduped', () => {
    expect(buildGeminiModelAttemptOrder(DEFAULT_GEMINI_MODEL_ID)).toEqual([
      DEFAULT_GEMINI_MODEL_ID,
      ...GEMINI_FALLBACK_MODEL_IDS_AFTER_PRIMARY,
    ]);
  });

  it('dedupes when primary equals a fallback entry', () => {
    expect(buildGeminiModelAttemptOrder('gemini-3.1-flash-lite')).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
    ]);
  });

  it('uses GEMINI_FALLBACK_MODEL_IDS env instead of defaults when set', () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL_IDS', 'gemini-3-flash, gemini-2.5-flash ');
    expect(buildGeminiModelAttemptOrder('gemini-2.5-flash-lite')).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-3-flash',
      'gemini-2.5-flash',
    ]);
  });
});
