import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function gotoStudio(page: Page): Promise<void> {
  await page.goto('/studio/');
  await expect(page.getByTestId('toolbar')).toBeVisible();
  
  // Ensure inspector is visible
  const shellGrid = page.locator('.shell-grid');
  const isHidden = await shellGrid.getAttribute('data-inspector-hidden');
  if (isHidden === 'true') {
    await page.getByTestId('toggle-inspector').click();
  }
  await expect(shellGrid).toHaveAttribute('data-inspector-hidden', 'false');

  // Ensure advanced mode is active for testing all features
  await page.getByTestId('inspector-mode-advanced').click();
}

async function insertTemplate(page: Page, templateId: string, insertionControlTestId: string): Promise<void> {
  await page.getByTestId(insertionControlTestId).click();
  await page.getByTestId(`slash-template-${templateId}`).click();
}

test.describe('Formspec Studio core workflows', () => {
  test('STUDIO-P0-001: creates a form using slash commands and inline label editing', async ({ page }) => {
    await gotoStudio(page);

    await page.getByTestId('form-title-input').fill('Grant Application');

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');
    await page.getByTestId('label-shortAnswer-input').fill('Organization Name');
    await page.keyboard.press('Tab');

    await insertTemplate(page, 'dropdown', 'add-between-root-1');
    await page.getByTestId('label-dropdown-input').fill('Organization Type');
    await page.keyboard.press('Tab');

    await expect(page.getByTestId('surface-item-shortAnswer')).toBeVisible();
    await expect(page.getByTestId('surface-item-dropdown')).toBeVisible();
    await expect(page.getByTestId('form-title-input')).toHaveValue('Grant Application');
    await expect(page.getByTestId('label-shortAnswer-display')).toContainText('Organization Name');
    await expect(page.getByTestId('label-dropdown-display')).toContainText('Organization Type');
  });

  test('STUDIO-P0-002: configures required + show-when and verifies conditional preview behavior', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');
    await page.getByTestId('label-shortAnswer-input').fill('Organization Name');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');

    await insertTemplate(page, 'dropdown', 'add-between-root-1');
    await page.getByTestId('label-dropdown-input').fill('Organization Type');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: '+ Add option' }).click();
    await page.getByLabel('Option label').first().fill('University');
    await page.getByLabel('Option label').first().press('Enter');
    await page.waitForTimeout(100);

    await insertTemplate(page, 'short-answer', 'add-between-root-2');
    await page.getByTestId('label-shortAnswer2-input').fill('Sub-type');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');

    // shortAnswer2 is selected because it was just added.
    await page.getByTestId('section-rules-header').click();
    await page.getByTestId('field-relevant-mode-fel').click();
    await page.getByTestId('field-relevant-input').fill("$dropdown = 'University'");

    await page.getByTestId('surface-item-shortAnswer').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('aria-live-region')).toContainText('Organization Name');
    
    // Ensure Rules section is open
    if (!(await page.getByTestId('field-required-toggle').isVisible())) {
        await page.getByTestId('section-rules-header').click();
    }
    
    await page.getByTestId('field-required-toggle').locator('..').click({ force: true });
    await expect(page.getByTestId('field-required-toggle')).toBeChecked();
    await page.waitForTimeout(500); // Wait for state sync

    await page.getByTestId('toggle-preview').click();
    await expect(page.getByTestId('preview-renderer')).toBeVisible();

    const preview = page.getByTestId('preview-renderer');
    const dependentField = preview.locator('.formspec-field[data-name="shortAnswer2"]');
    const orgTypeSelect = preview.locator('.formspec-field[data-name="dropdown"] select');
    
    // Dump options for debugging
    const optionsText = await orgTypeSelect.evaluate((el: HTMLSelectElement) => 
      Array.from(el.options).map(o => `${o.value}:${o.text}`).join(', ')
    );
    console.log(`DEBUG OPTIONS: ${optionsText}`);
    
    const orgNameInput = preview.locator('.formspec-field[data-name="shortAnswer"] input');

    await expect(orgTypeSelect).toBeVisible();
    await expect(dependentField).toHaveClass(/formspec-hidden/);
    await expect(orgNameInput).toHaveAttribute('aria-required', 'true');

    await orgTypeSelect.selectOption('University');
    await expect(dependentField).not.toHaveClass(/formspec-hidden/);
  });

  test('STUDIO-P0-007: exports and imports a studio bundle JSON', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');

    // Deselect current item to show form-level inspector
    await page.getByTestId('toggle-inspector').click();
    await page.getByTestId('section-form-import-export-header').click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('import-export-export-bundle').click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    const downloadedText = fs.readFileSync(downloadedPath as string, 'utf8');
    const downloadedBundle = JSON.parse(downloadedText) as Record<string, unknown>;
    expect(downloadedBundle.$formspecStudioBundle).toBe('1.0');

    const artifacts = (downloadedBundle as any).artifacts as {
      definition: Record<string, unknown>;
      component: Record<string, unknown>;
      theme: Record<string, unknown>;
      mapping: Record<string, unknown>;
    };
    const importPayload = {
      ...downloadedBundle,
      artifacts: {
        ...artifacts,
        definition: {
          ...artifacts.definition,
          title: 'Imported Bundle Title'
        }
      }
    };

    await page.getByTestId('import-export-json-input').fill(JSON.stringify(importPayload, null, 2));
    await page.getByTestId('import-export-json-apply').click();

    await expect(page.getByTestId('import-export-notice')).toContainText('Imported');
    await expect(page.getByTestId('form-title-input')).toHaveValue('Imported Bundle Title');
  });

  test('STUDIO-P1-003: edits mapping rules and runs the round-trip test UI', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');

    await page.getByTestId('toggle-inspector').click();
    await page.getByTestId('section-form-mapping-header').click();

    await page.getByTestId('mapping-direction-input').selectOption('both');
    await page.getByTestId('mapping-rule-add-button').click();
    await page.getByTestId('mapping-rule-source-1').fill('shortAnswer');
    await page.getByTestId('mapping-rule-target-1').fill('person.name');
    await page.getByTestId('mapping-rule-transform-1').selectOption('coerce');
    await page.getByTestId('mapping-rule-coerce-input').selectOption('string');

    await page.getByTestId('mapping-roundtrip-source-input').fill('{"shortAnswer":"Ada"}');
    await page.getByTestId('mapping-roundtrip-run-button').click();

    await expect(page.getByTestId('mapping-roundtrip-results')).toBeVisible();
    await expect(page.getByTestId('mapping-roundtrip-forward-output')).toContainText('person');
    await expect(page.getByTestId('mapping-roundtrip-forward-output')).toContainText('Ada');
  });

  test('STUDIO-P1-005: publishes a new version and records release metadata', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');

    await page.getByTestId('toggle-inspector').click();
    await page.getByTestId('section-form-version-header').click();

    await expect(page.getByTestId('version-impact')).toContainText('minor');
    await page.getByTestId('version-open-publish-dialog').click();
    await expect(page.getByTestId('publish-dialog')).toBeVisible();

    await page.getByTestId('publish-bump-input').selectOption('major');
    await page.getByTestId('publish-summary-input').fill('Publish first release candidate');

    const publishDownload = page.waitForEvent('download');
    await page.getByTestId('publish-confirm-button').click();
    await publishDownload;

    await expect(page.getByTestId('publish-dialog')).toHaveCount(0);
    await expect(page.getByTestId('version-current')).toContainText('2.0.0');
    await expect(page.getByTestId('version-last-published')).toContainText('v2.0.0');
  });

  test('STUDIO-P2-002: imports a linked sub-form and preserves linked metadata in bundle exports', async ({
    page
  }) => {
    await page.route('https://example.org/forms/budget', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          $formspec: '1.0',
          url: 'https://example.org/forms/budget',
          version: '2.0.0',
          title: 'Budget Module',
          items: [
            { type: 'field', key: 'amount', label: 'Amount', dataType: 'decimal' },
            { type: 'field', key: 'tax', label: 'Tax', dataType: 'decimal' }
          ],
          binds: [{ path: 'tax', calculate: '$amount * 0.1' }]
        })
      });
    });

    await gotoStudio(page);

    await page.getByTestId('section-form-subforms-header').click();

    await page.getByTestId('subform-group-key-input').fill('financials');
    await page.getByTestId('subform-group-label-input').fill('Financials');
    await page.getByTestId('subform-key-prefix-input').fill('budget_');
    await page.getByTestId('subform-url-input').fill('https://example.org/forms/budget');
    await page.getByTestId('subform-url-load').click();

    await expect(page.getByTestId('surface-item-financials')).toBeVisible();
    await expect(page.getByTestId('linked-subform-badge-financials')).toBeVisible();

    // Deselect the new group to see form-level inspector again
    await page.getByTestId('toggle-inspector').click();

    await page.getByTestId('section-form-import-export-header').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('import-export-export-bundle').click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    const downloadedText = fs.readFileSync(downloadedPath as string, 'utf8');
    const downloadedBundle = JSON.parse(downloadedText) as {
      artifacts?: {
        definition?: {
          items?: Array<Record<string, unknown>>;
          binds?: Array<Record<string, unknown>>;
        };
      };
    };

    const exportedDefinition = downloadedBundle.artifacts?.definition;
    const exportedItems = exportedDefinition?.items ?? [];
    const importedGroup = exportedItems.find((item) => item.key === 'financials');
    expect(importedGroup).toBeDefined();
    expect((importedGroup?.extensions as Record<string, unknown>)?.['x-linkedSubform']).toEqual(
      expect.objectContaining({
        ref: 'https://example.org/forms/budget|2.0.0',
        keyPrefix: 'budget_'
      })
    );
  });
});
