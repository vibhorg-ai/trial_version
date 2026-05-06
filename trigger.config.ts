import { defineConfig } from '@trigger.dev/sdk';
import { ffmpeg } from '@trigger.dev/build/extensions/core';

/**
 * Trigger.dev v4 configuration. The `project` ref is set explicitly so that the
 * CLI/SDK use this project regardless of the dev's local environment.
 *
 * The `ffmpeg` build extension installs FFmpeg into the deployment image and
 * exposes `FFMPEG_PATH` / `FFPROBE_PATH` env vars to tasks. We use this in
 * `cropImageTask` (Phase 8.3).
 */
export default defineConfig({
  project: 'proj_npgbtkimjlmfnlnhzphg',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/trigger'],
  build: {
    extensions: [ffmpeg()],
  },
});
