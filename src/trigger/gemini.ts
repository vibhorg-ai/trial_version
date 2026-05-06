import { GoogleGenerativeAI } from '@google/generative-ai';
import { task } from '@trigger.dev/sdk';

import type { GeminiTaskPayload, GeminiTaskResult } from './types';

/**
 * The canvas node is labeled "Gemini 3.1 Pro", but Google has not published a
 * `gemini-3.1-pro` model id. We call a real, current id server-side; swap when
 * Google ships an exact match.
 */
const GEMINI_MODEL_ID = 'gemini-2.0-flash-exp';

export const geminiTask = task({
  id: 'gemini',
  retry: { maxAttempts: 3 },
  run: async (payload: GeminiTaskPayload, _ctx): Promise<GeminiTaskResult> => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_ID,
      systemInstruction: payload.systemPrompt,
      generationConfig: {
        temperature: payload.temperature,
        maxOutputTokens: payload.maxOutputTokens,
        topP: payload.topP,
      },
    });

    const imageParts = await Promise.all(
      payload.visionImageUrls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch vision image (${res.status})`);
        }
        const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          inlineData: {
            mimeType,
            data: buf.toString('base64'),
          },
        };
      }),
    );

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: payload.prompt },
      ...imageParts,
    ];

    const result = await model.generateContent(parts);
    const text = result.response.text();
    return { kind: 'text', text };
  },
});
