import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import path from 'node:path';

/**
 * Clerk auth setup — runs once before the chromium project.
 *
 * Uses Clerk's testing tokens (no real password) to sign in a deterministic
 * test user, then stores the session cookies in `tests/e2e/.auth/user.json`
 * so that all subsequent tests start authenticated.
 *
 * Required env vars (only when running E2E locally — CI uses Vercel preview
 * deployments where these are configured per-environment):
 *   - CLERK_SECRET_KEY (already in .env.local)
 *   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (already in .env.local)
 *   - E2E_CLERK_USER_USERNAME — a Clerk testing username (e.g. `test+clerk_test@example.com`)
 *   - E2E_CLERK_USER_PASSWORD — the password Clerk assigns to that user (or the testing token literal)
 *
 * If these aren't present we skip — the spec-level tests handle that case
 * by also being skippable with `test.skip(!process.env.E2E_CLERK_USER_USERNAME, ...)`.
 */
const STORAGE_STATE = path.join(__dirname, '.auth/user.json');

setup('authenticate via Clerk testing token', async ({ page }) => {
  const username = process.env.E2E_CLERK_USER_USERNAME;
  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (!username || !password) {
    setup.skip(
      true,
      'Set E2E_CLERK_USER_USERNAME and E2E_CLERK_USER_PASSWORD to run authenticated E2E tests',
    );
    return;
  }

  await clerkSetup();

  await page.goto('/');
  await clerk.signIn({
    page,
    signInParams: { strategy: 'password', identifier: username, password },
  });
  // Confirm we landed on the dashboard before persisting cookies.
  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard/);

  await page.context().storageState({ path: STORAGE_STATE });
});
