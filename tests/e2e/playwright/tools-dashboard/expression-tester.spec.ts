import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

test.describe('Expression Tester Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the /evaluate endpoint
    await page.route('**/evaluate', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.expression === '1 + 2') {
        await route.fulfill({ json: { value: 3, type: 'number', diagnostics: [] } });
      } else if (body.expression === '$price * $qty') {
        await route.fulfill({ json: { value: 30, type: 'number', diagnostics: [] } });
      } else if (body.expression === 'bad syntax !!!') {
        await route.fulfill({ status: 400, json: { detail: { error: 'Unexpected token' } } });
      } else {
        await route.fulfill({ json: { value: null, type: 'null', diagnostics: [] } });
      }
    });
    await page.goto(TOOLS_URL);
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
    await page.locator('#eval-expression').fill('bad syntax !!!');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-error')).toBeVisible();
    await expect(page.locator('#eval-error')).toContainText('Unexpected token');
    await expect(page.locator('#eval-result')).toBeHidden();
  });

  test('shows error for invalid JSON data', async ({ page }) => {
    await page.locator('#eval-data').fill('{not valid json}');
    await page.click('#btn-evaluate');

    await expect(page.locator('#eval-error')).toBeVisible();
    await expect(page.locator('#eval-error')).toContainText('Invalid JSON');
  });
});
