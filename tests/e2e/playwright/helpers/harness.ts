// ADR-0023: Low-level harness used only by tests that require synthetic inline fixtures
// (compatibility matrices, Tab-based layouts, and other non-grant-app scenarios).
import type { Page } from '@playwright/test';

const DEFAULT_HARNESS_URL = 'http://127.0.0.1:8080/';

export async function gotoHarness(page: Page, url = DEFAULT_HARNESS_URL): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('formspec-render', { state: 'attached' });
}

export async function mountDefinition(page: Page, definition: unknown): Promise<void> {
  await page.evaluate((data) => {
    const renderer: any = document.querySelector('formspec-render');
    renderer.definition = data;
  }, definition);
}

export async function submitAndGetResponse<T = any>(page: Page): Promise<T> {
  return await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      document.addEventListener('formspec-submit', (e: any) => resolve(e.detail), { once: true });

      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn =
        buttons.find((b) => b.textContent?.trim() === 'Submit') ??
        (document.querySelector('button[type=\"button\"]') as HTMLButtonElement | null);

      if (!submitBtn) {
        reject(new Error('Submit button not found'));
        return;
      }

      submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }) as T;
}
