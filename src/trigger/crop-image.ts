import { writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { task, wait } from '@trigger.dev/sdk';

import { removeTmpDir } from './fs-tmp';
import type { CropTaskPayload, CropTaskResult } from './types';
import { spawnFfmpegProcess } from './spawn-ffmpeg';
import { uploadFileToTransloadit } from './transloadit-upload';

function runFfmpegCrop(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  w: number,
  h: number,
  x: number,
  y: number,
): Promise<void> {
  const vf = `crop=${w}:${h}:${x}:${y}`;
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

      const url = await uploadFileToTransloadit(outputPath);
      return { url };
    } finally {
      await removeTmpDir(tmpRoot);
    }
  },
});
