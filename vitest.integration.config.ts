import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local before vitest runs so DATABASE_URL etc. are available.
const root = process.cwd();
for (const name of ['.env.local', '.env']) {
  const path = resolve(root, name);
  if (existsSync(path)) loadEnv({ path });
}

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    environment: 'node', // not happy-dom — we're testing API handlers, not React
    setupFiles: ['./vitest.integration.setup.ts'],
    globals: true,
    css: false,
    include: ['src/**/*.integration.test.ts'],
    // Integration tests are slower; allow more time.
    testTimeout: 30_000,
    // Run sequentially because they share a DB.
    fileParallelism: false,
  },
});
