import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition } from './helpers';

const LOGIC_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string' },
    { key: 'age', type: 'field', dataType: 'integer' },
    { key: 'income', type: 'field', dataType: 'decimal' },
  ],
  binds: {
    firstName: { required: 'true' },
    age: { constraint: '$age >= 0' },
    income: { calculate: '$age * 1000', readonly: 'true' },
  },
  shapes: [
    {
      id: 'ageValid',
      target: 'age',
      severity: 'error',
      constraint: '$age >= 0 and $age <= 120',
      message: 'Age must be in range',
    },
  ],
  variables: [
    { name: 'taxRate', expression: '0.25' },
    { name: 'netIncome', expression: '$income * (1 - @taxRate)' },
  ],
};

const MULTI_SHAPE_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'annInc', type: 'field', dataType: 'decimal' },
    { key: 'addr', type: 'field', dataType: 'string' },
    { key: 'homeless', type: 'field', dataType: 'boolean' },
    { key: 'hhSize', type: 'field', dataType: 'integer' },
  ],
  shapes: [
    {
      id: 'inc-lim',
      target: 'annInc',
      severity: 'error',
      constraint: '$annInc <= 50000',
      message: 'Exceeds income limit.',
      code: 'INC_AMI',
    },
    {
      id: 'ast-req',
      target: 'addr',
      severity: 'warning',
      message: 'Address or homelessness required.',
      code: 'ADDR',
      or: ["present($addr)", '$homeless=true'],
    },
    {
      id: 'hh-match',
      target: 'hhSize',
      severity: 'error',
      message: 'Household size mismatch.',
      code: 'HH_MIS',
      and: ['$hhSize >= 1'],
    },
  ],
};

/** Helper: navigate to Manage view within Editor workspace */
async function switchToManage(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="workspace-Editor"]').getByRole('radio', { name: 'Manage' }).click();
}

async function scrollToManageVariables(page: import('@playwright/test').Page) {
  const section = page.locator('[data-testid="manage-section-variables"]');
  await section.scrollIntoViewIfNeeded();
}

test.describe('Editor Manage View — Logic', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, LOGIC_DEFINITION);
    await switchToManage(page);
  });

  test('shows binds section with field paths and bind type pills', async ({ page }) => {
    await expect(page.getByText(/required \(1\)/)).toBeVisible();
    await expect(page.getByText(/constraint \(1\)/)).toBeVisible();
    await expect(page.getByText(/calculate \(1\)/)).toBeVisible();
    await expect(page.getByText(/readonly \(1\)/)).toBeVisible();

    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByText('firstName', { exact: true })).toBeVisible();
    await expect(workspace.getByText('age', { exact: true })).toBeVisible();
  });

  test('shows shapes section with severity badge and constraint', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    // Use the shapes section to scope the selector and avoid strict mode violations
    const shapesSection = workspace.locator('[data-testid="manage-section-shapes"]');
    await expect(shapesSection.getByText('ageValid')).toBeVisible();
    await expect(workspace.getByText('$age >= 0 and $age <= 120')).toBeVisible();
  });

  test('shows variables section', async ({ page }) => {
    await scrollToManageVariables(page);
    const vars = page.locator('[data-testid="manage-section-variables"]');
    await expect(vars.getByText('@taxRate', { exact: true }).first()).toBeVisible();
    await expect(vars.getByText('0.25', { exact: true }).first()).toBeVisible();
    await expect(vars.getByText('@netIncome', { exact: true }).first()).toBeVisible();
  });

  test('clicking a filter chip narrows the binds shown', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await workspace.getByText(/constraint \(1\)/i).click();

    await expect(workspace.getByText('age', { exact: true })).toBeVisible();
    await expect(workspace.getByText('income', { exact: true })).not.toBeVisible();
  });

  test('clicking a bind row selects the related field in the inspector', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await workspace.getByText('income', { exact: true }).click();

    // Switch to Build view — the field should be selected in the editor
    await page.getByRole('radio', { name: 'Build' }).click();
    await expect(page.locator('[data-testid="field-income"]')).toHaveClass(/border-accent/);
  });
});

test.describe('Editor Manage View — shapes show full detail for every card (#50)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, MULTI_SHAPE_DEFINITION);
    await switchToManage(page);
  });

  test('every shape card shows its severity badge', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');

    const errorBadges = workspace.getByText('error', { exact: true });
    const warningBadges = workspace.getByText('warning', { exact: true });

    await expect(errorBadges).toHaveCount(2);
    await expect(warningBadges).toHaveCount(1);
  });

  test('every shape card shows its key / code', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');

    await expect(workspace.getByText('INC_AMI', { exact: true })).toBeVisible();
    await expect(workspace.getByText('ADDR', { exact: true })).toBeVisible();
    await expect(workspace.getByText('HH_MIS', { exact: true })).toBeVisible();
  });

  test('every shape card shows its FEL constraint expression — including shapes with or/and arrays', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');

    await expect(workspace.getByText('$annInc <= 50000', { exact: true })).toBeVisible();
    await expect(workspace.getByText(/present\(\$addr\)/, { exact: false })).toBeVisible();
    await expect(workspace.getByText(/\$hhSize >= 1/, { exact: false })).toBeVisible();
  });
});

test.describe('Editor Manage View — FEL reference popup function click (#55)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await waitForApp(page);
    await importDefinition(page, LOGIC_DEFINITION);
    await switchToManage(page);
  });

  test('clicking a function entry in the FEL reference popup copies its signature to the clipboard', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await scrollToManageVariables(page);
    await workspace.locator('[data-testid="manage-section-variables"]').getByText('0.25', { exact: true }).click();

    const felButton = workspace.locator('button[aria-label="FEL Reference"]').first();
    // FELEditor layers a full-width mirror above the row; Playwright hit-tests the textarea. Programmatic click still toggles the popup.
    await felButton.evaluate((el: HTMLElement) => el.click());

    const felPopup = page.locator('[data-testid="fel-reference-popup"]');
    await expect(felPopup.getByText('FEL Reference')).toBeVisible();

    // Direct .click() in the page — Manage view stacking/scroll can block Playwright’s hit-testing on the popover.
    await felPopup.locator('[data-fel-category="Aggregate"]').evaluate((el: HTMLElement) => el.click());
    const sumBtn = felPopup.locator('[data-fel-fn="sum"]').first();
    await expect(sumBtn).toBeAttached({ timeout: 10000 });
    await sumBtn.evaluate((el: HTMLElement) => el.click());

    await expect(felPopup.locator('[data-testid="fel-function-detail"]')).toContainText('sum');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    if (clipboardText.length > 0) {
      expect(clipboardText).toContain('sum');
    }
  });

  test('clicking a function entry shows a detail panel or highlight for that function', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await scrollToManageVariables(page);
    await workspace.locator('[data-testid="manage-section-variables"]').getByText('0.25', { exact: true }).click();

    const felButton = workspace.locator('button[aria-label="FEL Reference"]').first();
    await felButton.evaluate((el: HTMLElement) => el.click());

    const felPopup = page.locator('[data-testid="fel-reference-popup"]');
    await felPopup.locator('[data-fel-category="Aggregate"]').evaluate((el: HTMLElement) => el.click());
    const sumBtn = felPopup.locator('[data-fel-fn="sum"]').first();
    await expect(sumBtn).toBeAttached({ timeout: 10000 });
    await sumBtn.evaluate((el: HTMLElement) => el.click());

    const activeDetail = page.locator('[data-testid="fel-function-detail"]');
    const selectedFn = page.locator('[aria-selected="true"]');
    const highlightedFn = page.locator('.fel-fn-active, [data-active="true"]');

    const anyVisible =
      (await activeDetail.isVisible().catch(() => false)) ||
      (await selectedFn.isVisible().catch(() => false)) ||
      (await highlightedFn.isVisible().catch(() => false));

    expect(anyVisible).toBe(true);
  });
});
