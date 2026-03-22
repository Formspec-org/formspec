import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

async function gotoToolsReady(page: import('@playwright/test').Page) {
  await page.goto(TOOLS_URL);
  await page.waitForSelector('html[data-formspec-wasm-ready="1"]', { timeout: 30_000 });
}

test.describe('Expression Tester Tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoToolsReady(page);
  });

  test('evaluates a simple expression and shows result', async ({ page }) => {
    const exprInput = page.locator('#eval-expression');
    await exprInput.fill('1 + 2');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-result-value')).toHaveText('3');
    await expect(page.locator('#eval-result-type')).toHaveText('number');
    await expect(page.locator('#eval-result')).toBeVisible();
  });

  test('evaluates expression with field references', async ({ page }) => {
    await page.locator('#eval-expression').fill('$price * $qty');
    await page.locator('#eval-data').fill('{"price": 10, "qty": 3}');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-result-value')).toHaveText('30');
  });

  test('shows error for syntax errors', async ({ page }) => {
    await page.locator('#eval-expression').fill('1 +');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-error')).toBeVisible();
    await expect(page.locator('#eval-error')).not.toBeEmpty();
    await expect(page.locator('#eval-result')).toBeHidden();
  });

  test('shows error for invalid JSON data', async ({ page }) => {
    await page.locator('#eval-data').fill('{not valid json}');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-error')).toBeVisible();
    await expect(page.locator('#eval-error')).toContainText('Invalid JSON');
  });
});
