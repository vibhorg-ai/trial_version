import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const genAiMocks = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn();
  function GoogleGenerativeAIMock() {
    return {
      getGenerativeModel: mockGetGenerativeModel,
    };
  }
  return {
    mockGenerateContent,
    mockGetGenerativeModel,
    MockGoogleAI: vi.fn(GoogleGenerativeAIMock),
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: genAiMocks.MockGoogleAI,
}));

vi.mock('@trigger.dev/sdk', () => ({
  task: <P, R>(opts: { id: string; run: (p: P, c: unknown) => Promise<R> }) => ({
    id: opts.id,
    run: opts.run,
  }),
  wait: { for: vi.fn() },
  tasks: { trigger: vi.fn(async () => ({ id: 'run_x' })) },
}));

import { geminiTask, parseRateLimitRetryDelay } from '../gemini';
import type { GeminiTaskPayload, GeminiTaskResult } from '../types';

type GeminiTaskWithRun = {
  run: (payload: GeminiTaskPayload, options: { ctx: unknown }) => Promise<GeminiTaskResult>;
};

const runGemini = geminiTask as unknown as GeminiTaskWithRun;

const basePayload: GeminiTaskPayload = {
  workflowRunId: 'wr1',
  nodeId: 'n1',
  model: 'gemini-2.5-flash-lite',
  prompt: 'Hello model',
  systemPrompt: 'You are helpful.',
  temperature: 0.4,
  maxOutputTokens: 512,
  topP: 0.9,
  visionImageUrls: [],
};

describe('parseRateLimitRetryDelay', () => {
  it('returns null for non-Error values', () => {
    expect(parseRateLimitRetryDelay('boom')).toBeNull();
    expect(parseRateLimitRetryDelay(null)).toBeNull();
  });

  it('returns null when the message is not a rate-limit error', () => {
    expect(parseRateLimitRetryDelay(new Error('400 invalid request'))).toBeNull();
  });

  it('parses retryDelay seconds from a Google RetryInfo payload', () => {
    const err = new Error(`429 RESOURCE_EXHAUSTED Quota exceeded {"retryDelay":"42s"}`);
    expect(parseRateLimitRetryDelay(err)).toBe(30_000); // capped at MAX_SINGLE_RETRY_DELAY_MS
  });

  it('honours short retryDelay values within the cap', () => {
    const err = new Error(`429 Too Many Requests retryDelay: "2s"`);
    expect(parseRateLimitRetryDelay(err)).toBe(2_000);
  });

  it('falls back to a sensible default when retryDelay is missing', () => {
    const err = new Error(`429 Too Many Requests RESOURCE_EXHAUSTED quota exceeded`);
    expect(parseRateLimitRetryDelay(err)).toBeGreaterThan(0);
  });
});

describe('geminiTask', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-key');
    genAiMocks.mockGenerateContent.mockReset();
    genAiMocks.mockGetGenerativeModel.mockReset();
    genAiMocks.mockGenerateContent.mockResolvedValue({
      response: { text: () => 'Model reply' },
    });
    genAiMocks.mockGetGenerativeModel.mockReturnValue({
      generateContent: genAiMocks.mockGenerateContent,
    });
    vi.stubGlobal('fetch', vi.fn() as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls getGenerativeModel with system instruction and generation config', async () => {
    await runGemini.run(basePayload, { ctx: {} } as never);

    expect(genAiMocks.MockGoogleAI).toHaveBeenCalledWith('test-key');
    expect(genAiMocks.mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: 'You are helpful.',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
        topP: 0.9,
      },
    });
  });

  it('prefers the workflow payload model over GEMINI_MODEL_ID env var', async () => {
    vi.stubEnv('GEMINI_MODEL_ID', 'gemini-2.5-flash');
    // Re-import to pick up new env value (module-level const)
    vi.resetModules();
    const { geminiTask: freshTask } = await import('../gemini');
    const fresh = freshTask as unknown as GeminiTaskWithRun;
    await fresh.run(basePayload, { ctx: {} } as never);
    expect(genAiMocks.mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash-lite' }),
    );
  });

  it('floors maxOutputTokens at 256 even if the node config asks for less', async () => {
    await runGemini.run({ ...basePayload, maxOutputTokens: 64 }, { ctx: {} } as never);
    expect(genAiMocks.mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({ maxOutputTokens: 256 }),
      }),
    );
  });

  it('throws a clear error if the model returns empty text with finishReason MAX_TOKENS', async () => {
    genAiMocks.mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => '',
        candidates: [{ finishReason: 'MAX_TOKENS' }],
      },
    });
    await expect(runGemini.run(basePayload, { ctx: {} } as never)).rejects.toThrow(/MAX_TOKENS/);
  });

  it('calls generateContent with a text part for the prompt', async () => {
    await runGemini.run(basePayload, { ctx: {} } as never);

    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledWith([{ text: 'Hello model' }]);
  });

  it('turns vision URLs into base64 inlineData parts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new Uint8Array([4, 5]).buffer,
      } as Response);

    await runGemini.run(
      { ...basePayload, visionImageUrls: ['https://img.test/a.png', 'https://img.test/b.jpg'] },
      { ctx: {} } as never,
    );

    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledWith([
      { text: 'Hello model' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from([1, 2, 3]).toString('base64'),
        },
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: Buffer.from([4, 5]).toString('base64'),
        },
      },
    ]);
  });

  it('returns { kind: text, text } from the model response', async () => {
    genAiMocks.mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'Final answer' },
    });

    const out = await runGemini.run(basePayload, { ctx: {} } as never);

    expect(out).toEqual({ kind: 'text', text: 'Final answer' });
  });

  it('retries a failing vision-image fetch and succeeds on the next attempt', async () => {
    // First fetch throws (simulate Node "fetch failed"), second succeeds.
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([7, 7]).buffer,
      } as Response);

    await runGemini.run({ ...basePayload, visionImageUrls: ['https://cdn.example/img.png'] }, {
      ctx: {},
    } as never);

    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledWith([
      { text: 'Hello model' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from([7, 7]).toString('base64'),
        },
      },
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error after exhausting vision-image fetch retries', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      runGemini.run({ ...basePayload, visionImageUrls: ['https://cdn.example/x.png'] }, {
        ctx: {},
      } as never),
    ).rejects.toThrow(/Failed to fetch vision image after 4 attempts/);
  });

  it('retries generateContent once on a 429 with retryDelay and then succeeds', async () => {
    const rateLimitErr = new Error(
      `[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your quota.\n` +
        `{"error":{"code":429,"status":"RESOURCE_EXHAUSTED",` +
        `"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"1s"}]}}`,
    );
    genAiMocks.mockGenerateContent
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce({ response: { text: () => 'recovered after backoff' } });

    const out = await runGemini.run(basePayload, { ctx: {} } as never);

    expect(out).toEqual({ kind: 'text', text: 'recovered after backoff' });
    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-rate-limit errors immediately without retry', async () => {
    const fatal = new Error('[GoogleGenerativeAI Error]: [400 Bad Request] Invalid prompt.');
    genAiMocks.mockGenerateContent.mockRejectedValue(fatal);

    await expect(runGemini.run(basePayload, { ctx: {} } as never)).rejects.toThrow(/400/);
    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('gives up after max rate-limit retry attempts and surfaces a clear message', async () => {
    const rateLimitErr = new Error(`429 Too Many Requests RESOURCE_EXHAUSTED retryDelay: "0s"`);
    genAiMocks.mockGenerateContent.mockRejectedValue(rateLimitErr);

    await expect(runGemini.run(basePayload, { ctx: {} } as never)).rejects.toThrow(
      /Gemini rate-limited \(429\) after \d+ retry attempt/,
    );
    // 1 initial + MAX_RATE_LIMIT_ATTEMPTS (3) retries
    expect(genAiMocks.mockGenerateContent).toHaveBeenCalledTimes(4);
  }, 15_000);

  it('does not retry on non-retryable 4xx responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    await expect(
      runGemini.run({ ...basePayload, visionImageUrls: ['https://cdn.example/missing.png'] }, {
        ctx: {},
      } as never),
    ).rejects.toThrow(/\(404\)/);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
