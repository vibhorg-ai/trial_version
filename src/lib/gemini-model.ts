/**
 * Default Gemini model id for the entire app — UI default, schema default,
 * orchestrator payload, sample workflow, and the Trigger.dev task all read
 * from this single constant.
 *
 * Why `gemini-2.5-flash-lite`?
 *   - Stable GA model (not a "-preview" alias that Google can rotate under us).
 *   - Generous free-tier limits (15 RPM / 1,000 RPD as of 2026-05) which is
 *     critical for the 3-Gemini sample workflow that fires siblings in
 *     parallel.
 *   - Supports vision (multimodal image input) which the workflow needs.
 *
 * Earlier we used `gemini-flash-latest`, but that alias currently maps to the
 * `gemini-3-flash-preview` model whose free tier is only ~5 RPM, causing
 * 429 RESOURCE_EXHAUSTED on parallel sibling fires. If you want to swap
 * models, update only this constant + run `npm run db:migrate-gemini`.
 */
export const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash-lite';

/**
 * Models used **after** the workflow node's chosen `payload.model`, when that
 * model keeps returning 429 / RESOURCE_EXHAUSTED even after bounded retries.
 *
 * Picks align with Google AI Studio free-tier **separate quota buckets**:
 * - `gemini-3.1-flash-lite` — higher daily headroom on many accounts (~500 RPD).
 * - `gemini-2.5-flash` — distinct pool from `-flash-lite` (not the same RPD counter).
 *
 * Override entirely (still after primary): set `GEMINI_FALLBACK_MODEL_IDS` to a
 * comma-separated list, e.g. `gemini-3-flash,gemma-3-4b-it`.
 */
export const GEMINI_FALLBACK_MODEL_IDS_AFTER_PRIMARY: readonly string[] = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

/**
 * Unique attempt order: always `primaryModelId` first, then fallbacks from env
 * or {@link GEMINI_FALLBACK_MODEL_IDS_AFTER_PRIMARY}, deduped.
 */
export function buildGeminiModelAttemptOrder(primaryModelId: string): string[] {
  const fromEnv = parseGeminiFallbackModelIdsFromEnv();
  const tail = fromEnv ?? [...GEMINI_FALLBACK_MODEL_IDS_AFTER_PRIMARY];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primaryModelId, ...tail]) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseGeminiFallbackModelIdsFromEnv(): string[] | null {
  const raw = process.env.GEMINI_FALLBACK_MODEL_IDS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}
