import { test, expect } from '@playwright/test';

const REFERENCES_URL = 'http://localhost:8082';

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
 * Parse the JSON content from the hidden server response <pre> element.
 */
async function waitForServerResponse(page: import('@playwright/test').Page, timeout = 10_000): Promise<any> {
  const pre = page.locator('#server-response-pre');
  await expect(async () => {
    const text = await pre.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
    JSON.parse(text!);
  }).toPass({ timeout });
  return JSON.parse((await pre.textContent())!);
}

test.describe('References: engine revalidation (WASM)', () => {
  test('grant-application: engine returns canonical ValidationReport shape with mapped data', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    // Clear optional field that trips a buggy regex constraint
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    const result = await waitForServerResponse(page);

    // Canonical ValidationReport fields
    expect(result).toHaveProperty('definitionUrl');
    expect(typeof result.definitionUrl).toBe('string');
    expect(result.definitionUrl.length).toBeGreaterThan(0);

    expect(result).toHaveProperty('definitionVersion');
    expect(typeof result.definitionVersion).toBe('string');

    expect(result).toHaveProperty('valid');
    expect(typeof result.valid).toBe('boolean');

    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);

    expect(result).toHaveProperty('counts');
    expect(result.counts).toHaveProperty('error');
    expect(result.counts).toHaveProperty('warning');
    expect(result.counts).toHaveProperty('info');
    expect(typeof result.counts.error).toBe('number');

    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
    // Should be a valid ISO 8601 timestamp
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();

    // Mapped output + static lint diagnostics
    expect(result).toHaveProperty('mapped');
    expect(typeof result.mapped).toBe('object');
    expect(Object.keys(result.mapped).length).toBeGreaterThan(0);

    expect(result).toHaveProperty('diagnostics');
    expect(Array.isArray(result.diagnostics)).toBe(true);

    // Invariant: valid = (counts.error === 0)
    expect(result.valid).toBe(result.counts.error === 0);
  });

  test('grant-application: engine meta line displays valid/counts', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForServerResponse(page);

    // Meta line should show the same format as client
    const meta = page.locator('#server-meta');
    await expect(meta).toContainText('valid=');
    await expect(meta).toContainText('errors=');
    await expect(meta).toContainText('warnings=');
  });

  test('grant-application: engine validation report section is populated', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForServerResponse(page);

    // The validation report <pre> should have JSON with valid, results, counts
    const vrText = await page.locator('#server-validation-pre').textContent();
    const vr = JSON.parse(vrText!);
    expect(vr).toHaveProperty('valid');
    expect(vr).toHaveProperty('results');
    expect(vr).toHaveProperty('counts');
    expect(vr).toHaveProperty('timestamp');
  });

  test('grant-application: mapped data section shows real transform output', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    await page.locator('#action-submit').click();
    await waitForServerResponse(page);

    const mappedText = await page.locator('#server-mapped-pre').textContent();
    const mapped = JSON.parse(mappedText!);
    expect(typeof mapped).toBe('object');
    expect(Object.keys(mapped).length).toBeGreaterThan(0);
  });

  test('empty form fails client validation but still runs engine revalidation', async ({ page }) => {
    await loadExample(page, 'grant-application');

    await page.locator('#action-submit').click();
    const result = await waitForServerResponse(page);

    // Client validation report should show errors
    const clientText = (await page.locator('#client-validation-pre').textContent())!;
    const vr = JSON.parse(clientText);
    expect(vr.valid).toBe(false);
    expect(vr.counts.error).toBeGreaterThan(0);

    // Engine still ran and returned a report
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('counts');
  });

  test('engine panel replaces placeholder with structured content', async ({ page }) => {
    await loadExample(page, 'grant-application', 'sample-submission');
    await engineClearField(page, 'applicantInfo.projectWebsite');

    // Before submit — placeholder visible
    await page.locator('#tab-server').click();
    await expect(page.locator('#server-empty')).toBeVisible();

    // Submit
    await page.locator('#tab-form').click();
    await page.locator('#action-submit').click();
    await waitForServerResponse(page);

    // Placeholder gone
    await expect(page.locator('#server-empty')).toHaveCount(0);

    // Structured sections populated
    await expect(page.locator('#server-meta')).not.toBeEmpty();
    await expect(page.locator('#server-validation-pre')).not.toBeEmpty();
    await expect(page.locator('#server-mapped-pre')).not.toBeEmpty();
  });
});
