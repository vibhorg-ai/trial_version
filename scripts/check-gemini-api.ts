/**
 * One-shot check: loads .env.local / .env, calls Gemini once with a trivial prompt.
 * Does not print the API key. Exit 0 = OK, 1 = missing key / hard failure.
 *
 * Usage: npx tsx scripts/check-gemini-api.ts
 *
 * For multi-model fallback (same as Trigger `gemini` task), set in `.env.local`:
 * `GEMINI_FALLBACK_MODEL_IDS=gemini-3-flash,gemini-2.5-flash` — overrides defaults in `src/lib/gemini-model.ts`.
 */
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
for (const name of ['.env.local', '.env']) {
  const p = resolve(root, name);
  if (existsSync(p)) dotenvConfig({ path: p });
}

const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
const modelId = process.env.GEMINI_MODEL_ID?.trim() || 'gemini-2.5-flash-lite';

async function main(): Promise<void> {
  if (!apiKey) {
    console.error('[gemini-check] GOOGLE_AI_API_KEY is missing or empty.');
    process.exit(1);
  }

  console.log(`[gemini-check] Using model: ${modelId}`);
  console.log('[gemini-check] Calling generateContent (tiny prompt)…');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  try {
    const result = await model.generateContent('Reply with exactly one word: OK');
    const text = result.response.text()?.trim() ?? '';
    console.log('[gemini-check] SUCCESS — API responded.');
    console.log(`[gemini-check] Response snippet: ${text.slice(0, 120)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini-check] FAILED — request error:');
    console.error(msg.split('\n')[0]);
    // Second line often has JSON with quota / 429 hints
    const lines = msg.split('\n');
    if (lines.length > 1) console.error(lines.slice(1, 4).join('\n'));
    process.exit(1);
  }
}

void main();
