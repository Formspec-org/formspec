import { expect, test, type Page } from '@playwright/test';

async function gotoStudio(page: Page): Promise<void> {
  await page.goto('/studio/');
  await expect(page.getByTestId('toolbar')).toBeVisible();

  const shellGrid = page.locator('.shell-grid');
  const inspectorHidden = await shellGrid.getAttribute('data-inspector-hidden');
  if (inspectorHidden === 'true') {
    await page.getByTestId('toggle-inspector').click();
  }

  await expect(shellGrid).toHaveAttribute('data-inspector-hidden', 'false');
  await page.getByTestId('inspector-mode-advanced').click();
}

async function insertTemplate(page: Page, templateId: string, insertionControlTestId: string): Promise<void> {
  const insertionControl = page.getByTestId(insertionControlTestId);
  await insertionControl.hover({ force: true });
  await insertionControl.click({ force: true });
  await expect(page.getByTestId(`slash-template-${templateId}`)).toBeVisible();
  await page.getByTestId(`slash-template-${templateId}`).click();
}

async function openFormInspector(page: Page): Promise<void> {
  const inspectorHeader = page.locator('[data-testid="inspector-panel"] .shell-panel__header');
  if ((await inspectorHeader.textContent()) !== 'Form') {
    await page.getByTestId('toggle-inspector').click();
    await expect(inspectorHeader).toHaveText('Form');
  }
}

async function switchToWizardMode(page: Page): Promise<void> {
  await openFormInspector(page);
  await page.getByTestId('form-page-mode-input').selectOption('wizard');
}

async function addSecondWizardPageWithShortAnswer(page: Page): Promise<void> {
  await switchToWizardMode(page);
  await page.getByTestId('toggle-structure').click();
  await page.getByTestId('pages-bar-add').click();
  await insertTemplate(page, 'short-answer', 'surface-add-first-item');
}

async function openJsonEditor(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+J');
  await expect(page.getByTestId('json-editor-pane')).toBeVisible();
}

test.describe('Formspec Studio regressions', () => {
  test('STUDIO-REG-001: required toggle does not create structural AJV diagnostics', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');
    await page.getByTestId('required-toggle-shortAnswer').click();
    await page.getByTestId('toggle-diagnostics').click();

    await expect(page.getByTestId('diagnostics-section-ajv')).toHaveCount(0);
  });

  test('STUDIO-REG-002: wizard pages scope duplicate field keys in definition binds', async ({ page }) => {
    await gotoStudio(page);

    await insertTemplate(page, 'short-answer', 'surface-add-first-item');
    await page.getByTestId('required-toggle-shortAnswer').click();
    await addSecondWizardPageWithShortAnswer(page);

    await openJsonEditor(page);

    const definitionJson = await page.getByTestId('json-editor-textarea').inputValue();
    expect(definitionJson).toContain('"path": "page_1.shortAnswer"');
    expect(definitionJson).not.toContain('"path": "shortAnswer"');
  });

  test('STUDIO-REG-003: JSON editor surfaces schema-invalid drafts instead of valid state', async ({ page }) => {
    await gotoStudio(page);

    await openJsonEditor(page);
    const editor = page.getByTestId('json-editor-textarea');
    const originalJson = await editor.inputValue();
    const invalidJson = originalJson.replace('"status": "draft"', '"status": 1');

    await editor.fill(invalidJson);

    await expect(page.getByTestId('json-editor-valid-state')).toHaveCount(0);
    await expect(page.getByTestId('json-editor-schema-errors').or(page.getByTestId('json-editor-apply-error'))).toBeVisible();
  });

  test('STUDIO-REG-004: surface drag lanes expose a hittable drop box for reordering', async ({ page }) => {
    await gotoStudio(page);

    await openJsonEditor(page);
    await page.getByTestId('json-editor-tab-definition').click();
    const originalDefinition = JSON.parse(await page.getByTestId('json-editor-textarea').inputValue()) as Record<string, unknown>;
    const definitionJson = JSON.stringify(
      {
        ...originalDefinition,
        title: 'Drag regression',
        items: [
          { type: 'field', key: 'shortAnswer', label: 'Short answer', dataType: 'string' },
          { type: 'field', key: 'shortAnswer2', label: 'Short answer 2', dataType: 'string' },
          { type: 'field', key: 'shortAnswer3', label: 'Short answer 3', dataType: 'string' }
        ]
      },
      null,
      2
    );

    await page.getByTestId('json-editor-textarea').evaluate((element, value) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.value = value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, definitionJson);

    await expect(page.getByTestId('json-editor-valid-state')).toBeVisible();
    await expect(page.getByTestId('surface-item-shortAnswer3')).toBeVisible();

    const topLane = page.getByTestId('add-between-slot-root-0');
    const box = await topLane.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(0);

    await page.getByTestId('drag-handle-shortAnswer3').dragTo(topLane);

    const orderedSurfaceItems = page.locator('[data-testid^="surface-item-"]');
    await expect(orderedSurfaceItems.first()).toHaveAttribute('data-testid', 'surface-item-shortAnswer3');
  });
});
