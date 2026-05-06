import { writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { task, wait } from '@trigger.dev/sdk';

import { removeTmpDir } from './fs-tmp';
import type { CropTaskPayload, CropTaskResult } from './types';
import { spawnFfmpegProcess } from './spawn-ffmpeg';
import { uploadFileToTransloadit } from './transloadit-upload';

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Build an ffmpeg `crop` filter expression that interprets w/h/x/y as
 * percentages (0-100) of the input image's dimensions. We use ffmpeg's
 * built-in `iw` / `ih` variables so that we don't need a separate ffprobe
 * step to discover the source size; ffmpeg's expression evaluator
 * substitutes them per-frame at filter time.
 *
 * The values are clamped to [0,1] after dividing by 100 so a malformed
 * input like `w=120` cannot produce a negative or out-of-bounds crop
 * region (which ffmpeg would otherwise reject with `Invalid too big or
 * non positive size for width '...' or height '...'`).
 */
export function buildCropFilter(w: number, h: number, x: number, y: number): string {
  const wp = clamp01(w / 100);
  const hp = clamp01(h / 100);
  const xp = clamp01(x / 100);
  const yp = clamp01(y / 100);
  // Guard against zero-size crops (e.g. user enters w=0): fall back to 1px
  // to keep ffmpeg happy; the upstream UI prevents this in practice.
  const wExpr = wp <= 0 ? '1' : `iw*${wp}`;
  const hExpr = hp <= 0 ? '1' : `ih*${hp}`;
  return `crop=${wExpr}:${hExpr}:iw*${xp}:ih*${yp}`;
}

function runFfmpegCrop(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  w: number,
  h: number,
  x: number,
  y: number,
): Promise<void> {
  const vf = buildCropFilter(w, h, x, y);
  const args = ['-y', '-i', inputPath, '-vf', vf, outputPath];
  return new Promise((resolve, reject) => {
    const child = spawnFfmpegProcess(ffmpegPath, args);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export const cropImageTask = task({
  id: 'crop-image',
  retry: { maxAttempts: 3 },
  run: async (payload: CropTaskPayload, _ctx): Promise<CropTaskResult> => {
    await wait.for({ seconds: 30 });

    const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;
    const authKey = process.env.TRANSLOADIT_AUTH_KEY;
    if (!authSecret || !authKey) {
      throw new Error(
        'Transloadit env vars TRANSLOADIT_AUTH_SECRET and TRANSLOADIT_AUTH_KEY must be set',
      );
    }

    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'nextflow-crop-'));
    const inputPath = path.join(tmpRoot, 'input');
    const outputPath = path.join(tmpRoot, 'cropped.jpg');

    try {
      const inputRes = await fetch(payload.inputImageUrl);
      if (!inputRes.ok) {
        throw new Error(`Failed to download input image (${inputRes.status})`);
      }
      const inputBuf = Buffer.from(await inputRes.arrayBuffer());
      await writeFile(inputPath, inputBuf);

      await runFfmpegCrop(
        ffmpegPath,
        inputPath,
        outputPath,
        payload.w,
        payload.h,
        payload.x,
        payload.y,
      );

      const url = await uploadFileToTransloadit(outputPath, { category: 'crop-output' });
      return { url };
    } finally {
      await removeTmpDir(tmpRoot);
    }
  },
});
