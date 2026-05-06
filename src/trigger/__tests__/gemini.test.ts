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

import { geminiTask } from '../gemini';
import type { GeminiTaskPayload, GeminiTaskResult } from '../types';

type GeminiTaskWithRun = {
  run: (payload: GeminiTaskPayload, options: { ctx: unknown }) => Promise<GeminiTaskResult>;
};

const runGemini = geminiTask as unknown as GeminiTaskWithRun;

const basePayload: GeminiTaskPayload = {
  workflowRunId: 'wr1',
  nodeId: 'n1',
  prompt: 'Hello model',
  systemPrompt: 'You are helpful.',
  temperature: 0.4,
  maxOutputTokens: 512,
  topP: 0.9,
  visionImageUrls: [],
};

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
      model: 'gemini-2.0-flash-exp',
      systemInstruction: 'You are helpful.',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
        topP: 0.9,
      },
    });
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
});
