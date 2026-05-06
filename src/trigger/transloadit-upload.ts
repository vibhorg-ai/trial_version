import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildAuthParams, signParams } from '../lib/transloadit';

const ASSEMBLIES_URL = 'https://api2.transloadit.com/assemblies?expected=ASSEMBLY_COMPLETED';

function firstResultSslUrl(assembly: {
  results?: Record<string, Array<{ ssl_url?: string }>>;
}): string | null {
  const results = assembly.results ?? {};
  const stepKey = Object.keys(results)[0];
  if (!stepKey) return null;
  const first = results[stepKey]?.[0];
  return first?.ssl_url ?? null;
}

/**
 * Re-uploads a local file via Transloadit (same assembly flow as the browser
 * `TransloaditUpload` helper, but server-side).
 */
export async function uploadFileToTransloadit(filePath: string): Promise<string> {
  const secret = process.env.TRANSLOADIT_AUTH_SECRET;
  if (!secret) {
    throw new Error('TRANSLOADIT_AUTH_SECRET is not set');
  }

  const paramsObj = buildAuthParams(new Date(), 3600);
  const paramsJson = JSON.stringify(paramsObj);
  const signature = signParams(paramsJson, secret);

  const formData = new FormData();
  formData.set('params', paramsJson);
  formData.set('signature', signature);
  const buf = await readFile(filePath);
  formData.set('file', new Blob([buf]), path.basename(filePath));

  const res = await fetch(ASSEMBLIES_URL, { method: 'POST', body: formData });
  if (!res.ok) {
    throw new Error(`Transloadit upload failed (${res.status})`);
  }

  const assembly = (await res.json()) as {
    error?: string;
    message?: string;
    results?: Record<string, Array<{ ssl_url?: string }>>;
  };

  const url = firstResultSslUrl(assembly);
  if (!url) {
    const reason = assembly.error ?? assembly.message ?? 'Transloadit returned no result URL';
    throw new Error(reason);
  }
  return url;
}
