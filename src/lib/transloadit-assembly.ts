/**
 * Shared helpers for handling Transloadit assembly responses.
 *
 * Both the browser-side {@link import('../components/canvas/nodes/TransloaditUpload').TransloaditUpload}
 * and the server-side {@link import('../trigger/transloadit-upload').uploadFileToTransloadit}
 * use these helpers to:
 *   1. Wait for the assembly to reach `ASSEMBLY_COMPLETED` (the initial POST
 *      can return `ASSEMBLY_EXECUTING` while the file is still being processed).
 *   2. Resolve the CDN URL from the assembly body, supporting two template
 *      shapes: templates with `results` steps (e.g. a crop step) and
 *      upload-only templates that produce no `results` and instead populate
 *      `uploads[]` directly.
 *
 * Keeping this in a single module guarantees that both code paths agree on the
 * "what's the final URL?" logic.
 */

export interface AssemblyShape {
  ok?: string;
  error?: string;
  message?: string;
  assembly_ssl_url?: string;
  assembly_url?: string;
  results?: Record<string, Array<{ ssl_url?: string; url?: string }>>;
  uploads?: Array<{ ssl_url?: string; url?: string }>;
}

const TERMINAL_OK = new Set([
  'ASSEMBLY_COMPLETED',
  'ASSEMBLY_CANCELED',
  'REQUEST_ABORTED',
  'ASSEMBLY_FAILED',
]);

/**
 * Resolves the CDN URL for the uploaded asset from a *completed* assembly. We
 * first look at every `results` step (the first one with a URL wins), then
 * fall back to the first `uploads[]` entry which contains the same `ssl_url`
 * for upload-only templates.
 */
export function resolveAssemblyUrl(assembly: AssemblyShape): string | null {
  const results = assembly.results ?? {};
  for (const stepKey of Object.keys(results)) {
    const first = results[stepKey]?.[0];
    if (first?.ssl_url) return first.ssl_url;
    if (first?.url) return first.url;
  }
  const firstUpload = assembly.uploads?.[0];
  if (firstUpload?.ssl_url) return firstUpload.ssl_url;
  if (firstUpload?.url) return firstUpload.url;
  return null;
}

export interface PollAssemblyOptions {
  /** Sleep between polls in ms. */
  intervalMs?: number;
  /** Hard cap on total wait. */
  timeoutMs?: number;
  /** Injectable for testing. */
  fetchFn?: typeof fetch;
}

const DEFAULT_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Polls the assembly URL until it reaches a terminal state. Returns the final
 * assembly body. Throws when the assembly fails or polling times out.
 */
export async function pollAssembly(
  assemblyUrl: string,
  opts: PollAssemblyOptions = {},
): Promise<AssemblyShape> {
  const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const f = opts.fetchFn ?? fetch;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const res = await f(assemblyUrl);
    if (!res.ok) {
      throw new Error(`Transloadit assembly polling failed (${res.status})`);
    }
    const body = (await res.json()) as AssemblyShape;
    if (body.ok === 'ASSEMBLY_COMPLETED') {
      return body;
    }
    if (body.ok && TERMINAL_OK.has(body.ok) && body.ok !== 'ASSEMBLY_COMPLETED') {
      throw new Error(body.error ?? body.message ?? `Assembly ended with ${body.ok}`);
    }
    if (body.error) {
      throw new Error(body.error);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Transloadit assembly did not complete within ${timeout}ms`);
}

/**
 * Given the response body of the initial assembly POST, returns the final
 * assembly body — polling if the initial response is still executing.
 */
export async function resolveAssemblyBody(
  initial: AssemblyShape,
  opts: PollAssemblyOptions = {},
): Promise<AssemblyShape> {
  if (initial.ok === 'ASSEMBLY_COMPLETED') {
    return initial;
  }
  const pollUrl = initial.assembly_ssl_url ?? initial.assembly_url;
  if (!pollUrl) {
    const reason =
      initial.error ?? initial.message ?? 'Transloadit returned no assembly URL to poll';
    throw new Error(reason);
  }
  return pollAssembly(pollUrl, opts);
}
