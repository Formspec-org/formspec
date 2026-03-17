/** @filedesc Low-level Playwright harness: navigate, mount, submit, and inspect formspec-render. */
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
    const renderer: any = document.querySelector('formspec-render');
    if (!renderer || typeof renderer.submit !== 'function') {
      throw new Error('formspec-render.submit() is unavailable');
    }
    const detail = renderer.submit({ emitEvent: false, mode: 'submit' });
    if (!detail) {
      throw new Error('submit() returned null');
    }
    return detail.response;
  }) as T;
}
