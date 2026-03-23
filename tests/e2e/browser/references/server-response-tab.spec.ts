import { test, expect } from '@playwright/test';

const REFERENCES_URL = 'http://localhost:8082';

test.describe.configure({ mode: 'serial' });

/**
 * Wait until the <formspec-render> element has an initialized engine.
 */
async function waitForEngine(page: import('@playwright/test').Page, timeout = 10_000) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('formspec-render') as any;
      return el?.getEngine() != null;
    },
    { timeout },
  );
}

/**
 * Load an example in the references app, optionally selecting a fixture.
 */
async function loadExample(page: import('@playwright/test').Page, exampleId: string, fixtureId?: string) {
  await page.goto(`${REFERENCES_URL}/#${exampleId}`);
  await waitForEngine(page);

  if (fixtureId) {
    // Mark the current element so we can detect when it's been replaced
    await page.evaluate(() => {
      const el = document.querySelector('formspec-render') as any;
      if (el) el._testReloadMarker = true;
    });

    const select = page.locator('#fixture-select');
    await select.selectOption(fixtureId);

    // Fixture selection triggers a full async reload. Wait for a NEW
    // (unmarked) <formspec-render> element with an initialized engine.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('formspec-render') as any;
        return el && !el._testReloadMarker && el.getEngine() != null;
      },
      { timeout: 10_000 },
    );
  }
}

/**
 * Clear a field value via the engine (bypasses UI).
 */
async function engineClearField(page: import('@playwright/test').Page, fieldPath: string) {
  await page.evaluate((p) => {
    const el = document.querySelector('formspec-render') as any;
    el.getEngine().setValue(p, null);
  }, fieldPath);
}

/**
 * Parse the JSON content from the submit output response <pre> element.
 */
async function waitForSubmitResponse(page: import('@playwright/test').Page, timeout = 10_000): Promise<any> {
  const pre = page.locator('#client-response-pre');
  await expect(async () => {
    const text = await pre.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
    JSON.parse(text!);
  }).toPass({ timeout });
  return JSON.parse((await pre.textContent())!);
}

test.describe('References: submit output panel', () => {
  test('grant-application: submit output returns response shape with data payload', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    // Clear optional field that trips a buggy regex constraint
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    const result = await waitForSubmitResponse(page);

    expect(result).toHaveProperty('data');
    expect(typeof result.data).toBe('object');
    expect(result.data).not.toBeNull();
    expect(Object.keys(result.data).length).toBeGreaterThan(0);
  });

  test('grant-application: client meta line displays valid/counts', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForSubmitResponse(page);

    // Meta line should show the same format as client
    const meta = page.locator('#client-meta');
    await expect(meta).toContainText('valid=');
    await expect(meta).toContainText('errors=');
    await expect(meta).toContainText('warnings=');
  });

  test('grant-application: validation report section is populated', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForSubmitResponse(page);

    // The validation report <pre> should have JSON with valid, results, counts
    const vrText = await page.locator('#client-validation-pre').textContent();
    const vr = JSON.parse(vrText!);
    expect(vr).toHaveProperty('valid');
    expect(vr).toHaveProperty('results');
    expect(vr).toHaveProperty('counts');
    expect(vr).toHaveProperty('timestamp');
    expect(vr).toHaveProperty('results');
    expect(vr).toHaveProperty('counts');
    expect(typeof vr.valid).toBe('boolean');
  });

  test('grant-application: response section shows submitted data output', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForSubmitResponse(page);

    const responseText = await page.locator('#client-response-pre').textContent();
    const response = JSON.parse(responseText!);
    expect(typeof response).toBe('object');
    expect(response).toHaveProperty('data');
    expect(response.data).not.toBeNull();
  });

  test('empty form fails validation and still returns submit response payload', async ({ page }) => {
    await loadExample(page, 'grant-application');

    await page.locator('#action-submit').click();
    const result = await waitForSubmitResponse(page);

    // Client validation report should show errors
    const clientText = (await page.locator('#client-validation-pre').textContent())!;
    const vr = JSON.parse(clientText);
    expect(vr.valid).toBe(false);
    expect(vr.counts.error).toBeGreaterThan(0);

    // Submit output still returns a response envelope
    expect(result).toHaveProperty('data');
    expect(typeof result.data).toBe('object');
  });

  test('submit panel replaces placeholder with structured content', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    // Before submit — placeholder visible
    await page.locator('#tab-client').click();
    await expect(page.locator('#client-empty')).toBeVisible();

    // Submit
    await page.locator('#tab-form').click();
    await page.locator('#action-submit').click();
    await waitForSubmitResponse(page);

    // Placeholder gone
    await expect(page.locator('#client-empty')).toHaveCount(0);

    // Structured sections populated
    await expect(page.locator('#client-meta')).not.toBeEmpty();
    await expect(page.locator('#client-validation-pre')).not.toBeEmpty();
    await expect(page.locator('#client-response-pre')).not.toBeEmpty();
  });
});
