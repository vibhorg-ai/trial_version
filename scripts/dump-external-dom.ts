/**
 * Opens a URL in a headed browser, waits for you to complete sign-in (e.g. Google),
 * then writes document HTML to disk. Run locally only; output may contain sensitive UI.
 *
 * Google often blocks Playwright's **bundled Chromium** ("This browser or app may not be secure").
 * Prefer **installed Chrome/Edge** (`--channel`) or **attach to your own Chrome** (`--cdp`).
 *
 * Usage:
 *   npx tsx scripts/dump-external-dom.ts
 *   npx tsx scripts/dump-external-dom.ts --channel=msedge
 *   npx tsx scripts/dump-external-dom.ts "https://example.com/app"
 *   npx tsx scripts/dump-external-dom.ts --url="https://example.com" --out=./my-dom.html
 *
 * CDP (most reliable for Google): start Chrome yourself, then connect:
 *   PowerShell:
 *     & "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
 *       --remote-debugging-port=9222 `
 *       --user-data-dir="$env:TEMP\chrome-playwright-debug"
 *   Then:
 *     npx tsx scripts/dump-external-dom.ts --cdp=http://127.0.0.1:9222
 *
 * Bundled browser (only if you need it): `npm run test:e2e:install` then `--channel=chromium`
 */
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const DEFAULT_URL = 'https://app.galaxy.ai/workflows/cmou87hp90000kv04w3km1dol/canvas';

type Channel = 'chrome' | 'msedge' | 'chromium';

function parseArgs(): {
  url: string;
  out?: string;
  channel: Channel;
  cdp?: string;
} {
  const argv = process.argv.slice(2);
  let url = DEFAULT_URL;
  let out: string | undefined;
  let channel: Channel = 'chrome';
  let cdp: string | undefined;

  for (const a of argv) {
    if (a.startsWith('--out=')) {
      out = a.slice('--out='.length);
    } else if (a.startsWith('--url=')) {
      url = a.slice('--url='.length);
    } else if (a.startsWith('--channel=')) {
      const v = a.slice('--channel='.length) as Channel;
      if (v === 'chrome' || v === 'msedge' || v === 'chromium') {
        channel = v;
      }
    } else if (a.startsWith('--cdp=')) {
      cdp = a.slice('--cdp='.length);
    } else if (!a.startsWith('-')) {
      url = a;
    }
  }
  return { url, out, channel, cdp };
}

function waitForEnter(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function getPageFromLaunchedBrowser(
  url: string,
  channel: Channel,
): Promise<{ browser: Browser; page: Page; launchedByUs: boolean }> {
  const launchOptions =
    channel === 'chromium'
      ? { headless: false as const }
      : { headless: false as const, channel: channel as 'chrome' | 'msedge' };

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();

  console.error(`Opening:\n  ${url}\n`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  return { browser, page, launchedByUs: true };
}

async function getPageOverCDP(
  cdpUrl: string,
  url: string,
): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    await browser.close();
    throw new Error(
      'No browser contexts from CDP. Is Chrome running with --remote-debugging-port?',
    );
  }
  const context = contexts[0];
  const existing = context.pages()[0];
  const page = existing ?? (await context.newPage());

  console.error(`Attached over CDP. Navigating:\n  ${url}\n`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  return { browser, page };
}

async function main(): Promise<void> {
  const { url, out, channel, cdp } = parseArgs();
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const outPath =
    out ?? path.join(process.cwd(), 'scripts', '.playwright-dumps', `dom-${stamp}.html`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  let browser: Browser;
  let page: Page;
  let launchedByUs: boolean;

  if (cdp) {
    ({ browser, page } = await getPageOverCDP(cdp, url));
    launchedByUs = false;
  } else {
    ({ browser, page, launchedByUs } = await getPageFromLaunchedBrowser(url, channel));

    console.error(`Using channel: ${channel === 'chromium' ? 'bundled Chromium' : channel}\n`);
  }

  await waitForEnter(
    'Finish sign-in in the browser and navigate to the view you want.\nThen press Enter here to capture the DOM...\n',
  );

  await new Promise((r) => setTimeout(r, 1500));
  const html = await page.content();
  fs.writeFileSync(outPath, html, 'utf8');

  console.error(`Wrote ${html.length} characters to:\n  ${outPath}\n`);

  await browser.close();
  if (!launchedByUs) {
    console.error('(CDP) Playwright disconnected; your Chrome window stays open.\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
