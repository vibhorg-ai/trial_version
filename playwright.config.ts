import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Phase 10.5 — end-to-end smoke + happy-path tests.
 *
 * Strategy:
 * - Run against a locally-spawned `next dev` server (or pass the URL via
 *   `PLAYWRIGHT_BASE_URL` to point at a Vercel preview).
 * - Authentication uses Clerk's testing tokens (see `tests/e2e/auth.setup.ts`),
 *   which lets us bypass the interactive sign-in flow without storing dev
 *   credentials in plain text.
 * - We DON'T run a real Trigger.dev tunnel during E2E. Tests that need to
 *   exercise run-execution use the orchestrator's exposed task functions
 *   directly (see `scripts/smoke-test.ts`) — Playwright tests focus on the
 *   UI: dashboard CRUD, canvas editing, history panel rendering, etc.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // canvas tests share state via Clerk session
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
