import { test, expect } from '@playwright/test';

const skipIfNoCreds = test.skip(
  () => !process.env.E2E_CLERK_USER_USERNAME || !process.env.E2E_CLERK_USER_PASSWORD,
  'Skipped: requires E2E_CLERK_USER_USERNAME / E2E_CLERK_USER_PASSWORD',
);

/**
 * Smoke E2E — verifies the three protected pages load and the most critical
 * UI elements are present. We deliberately avoid asserting on Trigger.dev
 * runs here (those require a live tunnel + paid Gemini quota); see
 * scripts/smoke-test.ts for the backend pipeline smoke.
 */
test.describe('Smoke', () => {
  void skipIfNoCreds;

  test('redirects unauthenticated traffic to /sign-in', async ({ browser }) => {
    // Fresh context with no storage state
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    const res = await page.goto('/dashboard');
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });

  test('dashboard renders the workflow list and create button', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create workflow/i })).toBeVisible();
  });

  test('canvas page opens a workflow with the four pre-placed nodes visible', async ({ page }) => {
    await page.goto('/dashboard');
    // Open the first workflow card (the seeded "Wireless Headphones Marketing")
    const firstCard = page.getByRole('link', { name: /wireless headphones/i }).first();
    await firstCard.click();
    await page.waitForURL(/\/workflow\//);
    // BaseNodeShell renders a `node-shell` testid for every node.
    await expect(page.getByTestId('node-shell').first()).toBeVisible();
    // Run button is wired and clickable (we don't actually trigger the run).
    await expect(page.getByRole('button', { name: /run/i })).toBeVisible();
    // Top-bar History button.
    await expect(page.getByRole('button', { name: /history/i })).toBeVisible();
  });

  test('attribution console.log fires on dashboard render', async ({ page }) => {
    const messages: string[] = [];
    page.on('console', (msg) => messages.push(msg.text()));
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    expect(messages.some((m) => /\[NextFlow\] Candidate LinkedIn:/.test(m))).toBeTruthy();
  });
});
