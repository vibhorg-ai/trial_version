import { spawn, type ChildProcess } from 'node:child_process';

/** Separated for unit tests (reliable `vi.mock` vs `node:child_process` ESM). */
export function spawnFfmpegProcess(ffmpegPath: string, args: string[]): ChildProcess {
  return spawn(ffmpegPath, args, { stdio: 'ignore' });
}
