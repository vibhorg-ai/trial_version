import { rm } from 'node:fs/promises';

/** Isolated wrapper so tests can `vi.mock` temp cleanup reliably under ESM. */
export async function removeTmpDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}
