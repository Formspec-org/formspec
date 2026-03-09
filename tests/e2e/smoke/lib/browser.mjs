/**
 * Shared browser launch helper for reference-app smoke tests.
 * Returns { browser, context, page, consoleErrors }.
 */
import { chromium } from 'playwright';

/**
 * @param {object} [opts]
 * @param {boolean} [opts.headless=true]
 * @param {{ width: number, height: number }} [opts.viewport]
 * @returns {Promise<{ browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page, consoleErrors: string[] }>}
 */
export async function launchBrowser(opts = {}) {
  const { headless = true, viewport = { width: 1280, height: 900 } } = opts;

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      console.log(`[browser error] ${text.slice(0, 200)}`);
    }
  });

  page.on('pageerror', (err) => {
    const text = err.message;
    consoleErrors.push(text);
    console.log(`[page error] ${text.slice(0, 200)}`);
  });

  return { browser, context, page, consoleErrors };
}
