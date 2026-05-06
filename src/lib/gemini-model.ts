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
