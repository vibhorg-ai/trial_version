import { GoogleGenerativeAI } from '@google/generative-ai';
import { task } from '@trigger.dev/sdk';

import type { GeminiTaskPayload, GeminiTaskResult } from './types';

/** Floor we apply to `maxOutputTokens` regardless of node config — gives the
 *  model enough room to produce a usable answer even if a workflow JSON was
 *  authored with a tiny budget. The node UI still controls the upper bound. */
const MIN_MAX_OUTPUT_TOKENS = 256;

/** Hard cap for total wall time spent retrying a single 429. Beyond this we
 *  surface the error to the user — they're better off authoring around it
 *  (e.g. running fewer parallel siblings) than waiting another minute. */
const MAX_RATE_LIMIT_RETRY_MS = 90_000;
/** Floor for any single sleep between retries — even when Google says
 *  retryDelay=0 we still want a tiny pause to avoid spamming. */
const MIN_RETRY_DELAY_MS = 750;
/** Upper bound on a single sleep — Google sometimes returns multi-minute
 *  retryDelay values which would blow our overall budget. */
const MAX_SINGLE_RETRY_DELAY_MS = 30_000;
/** How many times we'll retry a 429 before giving up regardless of total
 *  elapsed time. Three attempts after the first call usually clears a burst. */
const MAX_RATE_LIMIT_ATTEMPTS = 3;

/**
 * Inspect a `generateContent` failure and decide whether it's worth retrying.
 * Google's SDK throws an Error whose `.message` is the raw JSON response body
 * (or a `[GoogleGenerativeAI Error]:` prefixed string containing it). We pull
 * out the `code` and any `RetryInfo.retryDelay` ("42s") so we can sleep
 * exactly long enough for the per-minute window to roll over.
 *
 * Returns the recommended sleep in ms, or null if the error is not a 429
 * (caller should rethrow immediately).
 */
export function parseRateLimitRetryDelay(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const msg = err.message;
  // Heuristic: 429s mention either the HTTP status or the gRPC status.
  const looksRateLimited =
    /\b429\b/.test(msg) ||
    /Too Many Requests/i.test(msg) ||
    /RESOURCE_EXHAUSTED/.test(msg) ||
    /quota/i.test(msg);
  if (!looksRateLimited) return null;

  // Try to find `retryDelay: "42s"` (or `42.5s`) inside the embedded JSON.
  // The SDK stringifies the body so we can regex it directly.
  const m = msg.match(/retryDelay["'\s:]+["']?(\d+(?:\.\d+)?)s/i);
  if (m) {
    const seconds = Number(m[1]);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(MIN_RETRY_DELAY_MS, Math.min(MAX_SINGLE_RETRY_DELAY_MS, seconds * 1000));
    }
  }
  // Quota error without an explicit retryDelay — fall back to a default.
  return MIN_RETRY_DELAY_MS * 4;
}

/**
 * Call generateContent with bounded retries on 429 / RESOURCE_EXHAUSTED. All
 * other errors are rethrown immediately (we don't want to mask 400s as
 * transient). Honors the `retryDelay` Google returns in the error body so we
 * sleep just long enough for the per-minute quota window to open back up.
 */
async function generateContentWithRateLimitRetry<T>(
  call: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  const startedAt = Date.now();
  let attempt = 0;
  for (;;) {
    try {
      return await call();
    } catch (err) {
      const delay = parseRateLimitRetryDelay(err);
      if (delay === null) throw err;
      attempt += 1;
      const elapsed = Date.now() - startedAt;
      if (attempt > MAX_RATE_LIMIT_ATTEMPTS || elapsed + delay > MAX_RATE_LIMIT_RETRY_MS) {
        // Out of budget — surface a clearer message to the orchestrator.
        const baseMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Gemini rate-limited (429) after ${attempt} retry attempt(s) over ${Math.round(
            elapsed / 1000,
          )}s. Last error: ${baseMsg.split('\n')[0]}`,
        );
      }
      await sleep(delay);
    }
  }
}

/**
 * Fetch a vision image with bounded retries. Transloadit's CDN occasionally
 * fails with low-level "fetch failed" (TLS handshake / dropped connection)
 * even when the URL is valid — usually right after the assembly was posted
 * because the file is still propagating to the edge. Retrying with a short
 * backoff lets the run succeed without bothering the user. Throws after
 * `maxAttempts` so the orchestrator marks the node failed with a clear msg.
 */
async function fetchVisionImage(url: string, maxAttempts = 4): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url);
    } catch (err) {
      // Low-level network/TLS failure (Node fetch surfaces this as a
      // TypeError with cause). Always retryable up to maxAttempts.
      lastErr = err;
      if (attempt === maxAttempts) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to fetch vision image after ${maxAttempts} attempts (${msg}) from ${url}`,
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      continue;
    }
    if (res.ok) return res;
    // 5xx and 408/429 are retryable; everything else (404, 403, 400…) is permanent.
    const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Failed to fetch vision image (${res.status}) from ${url}`);
    }
    lastErr = new Error(`HTTP ${res.status}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('Unknown fetch error');
}

export const geminiTask = task({
  id: 'gemini',
  retry: { maxAttempts: 3 },
  run: async (payload: GeminiTaskPayload, _ctx): Promise<GeminiTaskResult> => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const effectiveMaxTokens = Math.max(payload.maxOutputTokens, MIN_MAX_OUTPUT_TOKENS);
    const model = genAI.getGenerativeModel({
      model: payload.model,
      systemInstruction: payload.systemPrompt,
      generationConfig: {
        temperature: payload.temperature,
        maxOutputTokens: effectiveMaxTokens,
        topP: payload.topP,
      },
    });

    const imageParts = await Promise.all(
      payload.visionImageUrls.map(async (url) => {
        const res = await fetchVisionImage(url);
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

    const result = await generateContentWithRateLimitRetry(() => model.generateContent(parts));
    const text = result.response.text();
    const finishReason = result.response.candidates?.[0]?.finishReason;

    // If the model ran out of tokens before completing, surface a clear error
    // instead of returning a partial sentence that downstream nodes will then
    // misinterpret. The user sees "Gemini hit MAX_TOKENS — bump
    // maxOutputTokens." in the failure pill.
    if (!text && finishReason === 'MAX_TOKENS') {
      throw new Error(
        `Gemini stopped at MAX_TOKENS without producing any text (limit=${effectiveMaxTokens}). ` +
          `Increase the node's maxOutputTokens or switch to a non-thinking model.`,
      );
    }

    return { kind: 'text', text };
  },
});
