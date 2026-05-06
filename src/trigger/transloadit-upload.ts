import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildAuthParams, signParams } from '../lib/transloadit';
import {
  resolveAssemblyBody,
  resolveAssemblyUrl,
  type AssemblyShape,
} from '../lib/transloadit-assembly';

const ASSEMBLIES_URL = 'https://api2.transloadit.com/assemblies';

export interface ServerUploadOptions {
  /**
   * Optional logical category — used as a filename prefix on the resulting
   * CDN object so derived assets (e.g. cropped outputs) don't get filed
   * alongside user uploads. Galaxy parity calls this out explicitly.
   */
  category?: string;
}

/**
 * Re-uploads a local file via Transloadit (same assembly flow as the browser
 * `TransloaditUpload` helper, but server-side). Waits for the assembly to
 * reach `ASSEMBLY_COMPLETED` before returning the CDN URL. The polling +
 * URL-resolution logic lives in {@link import('../lib/transloadit-assembly')}
 * so the browser and server paths agree on shapes.
 */
export async function uploadFileToTransloadit(
  filePath: string,
  options: ServerUploadOptions = {},
): Promise<string> {
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
  const baseName = path.basename(filePath);
  const filename = options.category ? `${options.category}/${baseName}` : baseName;
  formData.set('file', new Blob([buf]), filename);

  const res = await fetch(ASSEMBLIES_URL, { method: 'POST', body: formData });
  if (!res.ok) {
    throw new Error(`Transloadit upload failed (${res.status})`);
  }

  const initial = (await res.json()) as AssemblyShape;
  const assembly = await resolveAssemblyBody(initial);

  const url = resolveAssemblyUrl(assembly);
  if (!url) {
    const reason = assembly.error ?? assembly.message ?? 'Transloadit returned no result URL';
    throw new Error(reason);
  }
  return url;
}
