import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, seedDefinition } from './helpers';

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
    { name: 'ageValid', severity: 'error', constraint: '$age >= 0 and $age <= 120' },
  ],
  variables: [
    { name: 'taxRate', expression: '0.25' },
    { name: 'netIncome', expression: '$income * (1 - @taxRate)' },
  ],
};

// Multi-shape definition used for bug #50 — verifies ALL shapes expose full detail.
// Mirrors the real demo data structure: one shape uses `constraint` (a string), the others
// use `or` / `and` arrays — which is what causes inconsistent detail rendering in practice.
const MULTI_SHAPE_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'annInc', type: 'field', dataType: 'decimal' },
    { key: 'addr', type: 'field', dataType: 'string' },
    { key: 'homeless', type: 'field', dataType: 'boolean' },
    { key: 'hhSize', type: 'field', dataType: 'integer' },
  ],
  shapes: [
    // Has a direct `constraint` string — renders correctly today
    {
      id: 'inc-lim',
      severity: 'error',
      constraint: '$annInc <= 50000',
      message: 'Exceeds income limit.',
      code: 'INC_AMI',
    },
    // Uses `or` array instead of `constraint` — FEL expression missing from card today
    {
      id: 'ast-req',
      severity: 'warning',
      message: 'Address or homelessness required.',
      code: 'ADDR',
      or: ["present($addr)", '$homeless=true'],
    },
    // Uses `and` array instead of `constraint` — FEL expression missing from card today
    {
      id: 'hh-match',
      severity: 'error',
      message: 'Household size mismatch.',
      code: 'HH_MIS',
      and: ['$hhSize >= 1'],
    },
  ],
};

test.describe('Logic Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, LOGIC_DEFINITION);
    await switchTab(page, 'Logic');
  });

  test('shows binds section with field paths and bind type pills', async ({ page }) => {
    // The FilterBar shows pills with counts like "required (1)", "constraint (1)", "calculate (1)"
    await expect(page.getByText(/required \(1\)/)).toBeVisible();
    await expect(page.getByText(/constraint \(1\)/)).toBeVisible();
    await expect(page.getByText(/calculate \(1\)/)).toBeVisible();
    await expect(page.getByText(/readonly \(1\)/)).toBeVisible();

    // Binds section shows field paths
    // BindsSection renders field paths like "firstName", "age", "income"
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    await expect(workspace.getByText('firstName', { exact: true })).toBeVisible();
    await expect(workspace.getByText('age', { exact: true })).toBeVisible();
  });

  test('shows shapes section with severity badge and constraint', async ({ page }) => {
    // ShapeCard renders the name and constraint
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    await expect(workspace.getByText('ageValid')).toBeVisible();
    // The shape constraint expression should be visible
    await expect(workspace.getByText('$age >= 0 and $age <= 120')).toBeVisible();
  });

  test('shows variables section', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    // Variables show name and expression
    await expect(workspace.getByText('taxRate', { exact: true })).toBeVisible();
    await expect(workspace.getByText('0.25', { exact: true })).toBeVisible();
    await expect(workspace.getByText('netIncome', { exact: true })).toBeVisible();
  });

  test('clicking a filter chip narrows the binds shown in the workspace', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    await workspace.getByText(/constraint \(1\)/i).click();

    await expect(workspace.getByText('age', { exact: true })).toBeVisible();
    await expect(workspace.getByText('income', { exact: true })).not.toBeVisible();
  });

  test('clicking a bind row selects the related field in the inspector', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');
    await workspace.getByText('income', { exact: true }).click();

    const properties = page.locator('[data-testid="properties"]');
    await expect(properties.locator('input[type="text"]').first()).toHaveValue('income');
  });
});

// Bug #50 — Shapes inconsistent detail
// All shape cards must show severity badge, key/name, AND FEL constraint expression.
// Currently only the first shape card reliably shows all three fields; subsequent cards
// may omit severity or the constraint expression depending on render order.
test.describe('Logic Workspace — shapes show full detail for every card (#50)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, MULTI_SHAPE_DEFINITION);
    await switchTab(page, 'Logic');
  });

  test('every shape card shows its severity badge', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // Two error shapes and one warning — each must render its severity pill
    const errorBadges = workspace.getByText('error', { exact: true });
    const warningBadges = workspace.getByText('warning', { exact: true });

    await expect(errorBadges).toHaveCount(2);
    await expect(warningBadges).toHaveCount(1);
  });

  test('every shape card shows its key / code', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // ShapeCard renders `code || name` — all three codes must be visible
    await expect(workspace.getByText('INC_AMI', { exact: true })).toBeVisible();
    await expect(workspace.getByText('ADDR', { exact: true })).toBeVisible();
    await expect(workspace.getByText('HH_MIS', { exact: true })).toBeVisible();
  });

  test('every shape card shows its FEL constraint expression — including shapes with or/and arrays', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // inc-lim has a direct `constraint` string — this one renders today
    await expect(workspace.getByText('$annInc <= 50000', { exact: true })).toBeVisible();

    // ast-req uses an `or` array — the reconstructed FEL expression must be visible.
    // Expected display: the joined condition, e.g. "present($addr) or $homeless=true"
    await expect(workspace.getByText(/present\(\$addr\)/, { exact: false })).toBeVisible();

    // hh-match uses an `and` array — the reconstructed FEL expression must be visible.
    await expect(workspace.getByText(/\$hhSize >= 1/, { exact: false })).toBeVisible();
  });
});

// Bug #55 — FEL ref function click has no action
// Clicking a function entry inside the FEL Reference popup (after expanding a category)
// should either copy the function signature to the clipboard OR open a detail panel showing
// full signature + description. Currently the function rows are plain non-interactive divs
// with no click handler, so nothing happens.
test.describe('Logic Workspace — FEL reference popup function click (#55)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, LOGIC_DEFINITION);
    await switchTab(page, 'Logic');
  });

  test('clicking a function entry in the FEL reference popup copies its signature to the clipboard', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // Open the FEL reference popup via the "?" button on a bind card
    const felButton = workspace.locator('button[aria-label="FEL Reference"]').first();
    await felButton.click();

    // The popup should be visible
    await expect(page.getByText('FEL Reference').first()).toBeVisible();

    // Expand the Aggregate category
    await page.getByText('Aggregate', { exact: true }).click();

    // The "sum" function entry should now be visible
    const sumEntry = page.getByText('sum', { exact: true }).first();
    await expect(sumEntry).toBeVisible();

    // Grant clipboard permissions so we can read back the written value
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click the "sum" function entry — this should copy the signature
    await sumEntry.click();

    // The clipboard should now contain the sum function signature
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('sum');
  });

  test('clicking a function entry shows a detail panel or highlight for that function', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    const felButton = workspace.locator('button[aria-label="FEL Reference"]').first();
    await felButton.click();

    // Expand Aggregate
    await page.getByText('Aggregate', { exact: true }).click();

    const sumEntry = page.getByText('sum', { exact: true }).first();
    await expect(sumEntry).toBeVisible();
    await sumEntry.click();

    // After clicking, the function row should have an active/selected state
    // OR a detail panel should appear. Either a [data-active] attribute, an
    // aria-selected attribute, or a visible detail element.
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

// Bug #60 — FEL expressions in Variables section are read-only
// Double-clicking a variable's expression text should open an inline expression editor
// (an <input> or <textarea>) pre-populated with the current expression value.
// Currently the expression is a plain <div> with no double-click handler, so no editor
// appears and the expression cannot be edited from the Logic workspace.
test.describe('Logic Workspace — variable expression inline editing (#60)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, LOGIC_DEFINITION);
    await switchTab(page, 'Logic');
  });

  test('double-clicking a variable expression opens an inline editor', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // Locate the expression text for "taxRate" variable
    const expressionText = workspace.getByText('0.25', { exact: true });
    await expect(expressionText).toBeVisible();

    // Double-click to trigger inline edit mode
    await expressionText.dblclick();

    // An editable input or textarea should now appear, pre-filled with the expression
    const inlineEditor = workspace.locator('input[type="text"], textarea').filter({ hasText: '' });
    const inputWithValue = workspace.locator('input[value="0.25"], textarea');

    const editorVisible =
      (await inputWithValue.isVisible().catch(() => false)) ||
      (await inlineEditor.count().then((n) => n > 0).catch(() => false));

    expect(editorVisible).toBe(true);
  });

  test('double-clicking a complex variable expression opens an inline editor with the expression pre-filled', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Logic"]');

    // Locate the expression text for "netIncome" variable
    const expressionText = workspace.getByText('$income * (1 - @taxRate)', { exact: true });
    await expect(expressionText).toBeVisible();

    // Double-click to trigger inline edit mode
    await expressionText.dblclick();

    // An input or textarea must appear and contain the original expression
    const inputEditor = workspace.locator('input[type="text"]');
    const textareaEditor = workspace.locator('textarea');

    const inputVisible = await inputEditor.isVisible().catch(() => false);
    const textareaVisible = await textareaEditor.isVisible().catch(() => false);

    expect(inputVisible || textareaVisible).toBe(true);

    if (inputVisible) {
      await expect(inputEditor.first()).toHaveValue('$income * (1 - @taxRate)');
    } else {
      await expect(textareaEditor.first()).toHaveValue('$income * (1 - @taxRate)');
    }
  });
});
