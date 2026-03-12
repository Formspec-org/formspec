/**
 * Blueprint Sidebar E2E tests — Cluster L (6 bugs)
 *
 * These tests document KNOWN BUGS. They are intentionally RED on first run.
 * Do NOT fix these tests — fix the underlying implementation.
 *
 * Bug list:
 *  #14 Component tree count=0    — countFn for "Component Tree" always returns 0
 *  #27 Settings read-only        — clicking a Settings value does not show an editable input
 *  #28 Title truncated no tooltip — Settings TITLE value has no `title` attribute
 *  #30 Variables inert           — clicking a variable row does not navigate to Logic workspace
 *  #37 Screener badge inert      — clicking the "Disabled" badge does not toggle/configure screener
 *  #47 Collapse arrow frozen     — Section ▶ button arrow does not rotate on expand/collapse
 */
import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition, dispatch } from './helpers';

// ─── Shared seed definitions ────────────────────────────────────────────────

/** Definition with fields so the Component Tree can have nodes added to it. */
const COMPONENT_TREE_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
};

/** Definition with a title long enough to potentially truncate in the narrow sidebar. */
const SETTINGS_DEFINITION = {
  $formspec: '1.0',
  title: 'This Is A Very Long Form Title That May Get Truncated In The Narrow Sidebar Column',
  name: 'Test Form',
  url: 'urn:formspec:test',
  version: '1.0.0',
  items: [{ key: 'field1', type: 'field', dataType: 'string' }],
};

/** Definition with named variables. */
const VARIABLES_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'age', type: 'field', dataType: 'integer' },
    { key: 'income', type: 'field', dataType: 'decimal' },
  ],
  variables: [
    { name: 'taxRate', expression: '0.25' },
    { name: 'netIncome', expression: '$income * (1 - @taxRate)' },
  ],
};

/** Definition without a screener so the badge shows "Disabled". */
const SCREENER_DISABLED_DEFINITION = {
  $formspec: '1.0',
  items: [{ key: 'age', type: 'field', dataType: 'integer' }],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Click a Blueprint sidebar nav button to activate that section. */
async function openBlueprintSection(page: import('@playwright/test').Page, sectionName: string) {
  const btn = page.locator(`[data-testid="blueprint-section-${sectionName}"]`);
  await btn.waitFor({ state: 'visible' });
  await btn.click();
}

// ─── Bug #14 — Component Tree count badge ────────────────────────────────────

test.describe('Bug #14 — Component Tree count badge is always 0', () => {
  test('count badge on the "Component Tree" nav row reflects actual node count (non-zero)', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, COMPONENT_TREE_DEFINITION);
    await page.waitForSelector('[data-testid="field-firstName"]', { timeout: 5000 });

    // Add two nodes to the component tree via dispatch so the tree is non-empty.
    // The root 'Stack' node with nodeId='root' is created on first ensureTree() call.
    await dispatch(page, {
      type: 'component.addNode',
      payload: {
        parent: { nodeId: 'root' },
        component: 'TextInput',
        bind: 'firstName',
      },
    });
    await dispatch(page, {
      type: 'component.addNode',
      payload: {
        parent: { nodeId: 'root' },
        component: 'TextInput',
        bind: 'lastName',
      },
    });

    // The "Component Tree" nav row should now display a count badge > 0.
    // Bug root cause: Blueprint.tsx line 16 hardcodes `countFn: () => 0` for
    // "Component Tree", so `hasData` is always false and the badge is never rendered.
    const sectionBtn = page.locator('[data-testid="blueprint-section-Component Tree"]');
    await expect(sectionBtn).toBeVisible();

    // The count badge is a <span> with tabular-nums class that only renders when count > 0.
    // This assertion FAILS on the bug: the badge is absent because count is always 0.
    const badge = sectionBtn.locator('span.tabular-nums');
    await expect(badge).toBeVisible();

    const badgeText = (await badge.textContent()) ?? '';
    expect(Number(badgeText.trim())).toBeGreaterThan(0);
  });
});

// ─── Bug #27 — Settings section values are read-only ─────────────────────────

test.describe('Bug #27 — Settings TITLE value is not editable', () => {
  test('clicking the Title value in the Settings section reveals an editable input', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Settings');
    await page.waitForSelector('text=Definition Metadata', { timeout: 5000 });

    // The sidebar shows the form title as a static text node inside a PropertyRow.
    // Clicking it should switch the value into an editable <input>.
    const titleText = page.getByText(SETTINGS_DEFINITION.title).first();
    await expect(titleText).toBeVisible();
    await titleText.click();

    // After clicking, the sidebar should contain an <input> whose value is the title.
    // This is the assertion that FAILS on the bug: SettingsSection renders read-only
    // PropertyRow spans — there is no inline-edit behaviour implemented.
    const sidebar = page.locator('aside').first();
    await expect(
      sidebar.locator(`input[value="${SETTINGS_DEFINITION.title}"]`)
    ).toBeVisible({ timeout: 3000 });
  });
});

// ─── Bug #28 — Title value has no tooltip when truncated ─────────────────────

test.describe('Bug #28 — Settings Title row missing tooltip', () => {
  test('the element displaying the Title value carries a title attribute with the full string', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Settings');
    await page.waitForSelector('text=Definition Metadata', { timeout: 5000 });

    // Find the element that renders the title value.
    // It is a <span class="... truncate ..."> inside a PropertyRow.
    // The `title` HTML attribute is required so the browser shows a native tooltip
    // when the text overflows.
    const titleElement = page.getByText(SETTINGS_DEFINITION.title).first();
    await expect(titleElement).toBeVisible();

    // This assertion FAILS on the bug: PropertyRow renders a plain <span> with no
    // `title` attribute, so the full text is inaccessible when the sidebar clips it.
    await expect(titleElement).toHaveAttribute('title', SETTINGS_DEFINITION.title);
  });
});

// ─── Bug #30 — Variables sidebar rows are inert ──────────────────────────────

test.describe('Variables sidebar rows are informational', () => {
  test('clicking a variable row does not pretend to navigate anywhere', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, VARIABLES_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Variables');
    await page.waitForSelector('text=@taxRate', { timeout: 5000 });

    // Confirm the Logic workspace is not yet active
    await expect(page.locator('[data-testid="workspace-Logic"]')).not.toBeVisible();

    await page.getByText('@taxRate').click();

    await expect(page.locator('[data-testid="workspace-Logic"]')).not.toBeVisible();
  });

  test('each variable row is rendered as read-only text, not a button', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, VARIABLES_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Variables');
    await page.waitForSelector('text=@taxRate', { timeout: 5000 });

    await expect(page.getByText('@taxRate')).toBeVisible();
    await expect(page.getByRole('button', { name: /@taxRate/i })).toHaveCount(0);
  });
});

// ─── Bug #37 — Screener "Disabled" badge is inert ────────────────────────────

test.describe('Bug #37 — Screener Disabled badge cannot be interacted with', () => {
  test('clicking the "Disabled" badge toggles the screener on or opens a config flow', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SCREENER_DISABLED_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Screener');
    await page.waitForSelector('text=Disabled', { timeout: 5000 });

    // Click the "Disabled" pill.
    // Bug: the Pill component renders a <span>, not a <button>, with no onClick.
    await page.getByText('Disabled').click();

    // After clicking, the screener should either have been enabled (badge → "Enabled")
    // or a configuration dialog/panel should have appeared.
    //
    // FAILS on the bug: the click is a no-op on a static <span>.
    const screenerEnabled = await page.getByText('Enabled').isVisible().catch(() => false);
    const configSurface = await page
      .locator('[role="dialog"], [data-testid*="screener"]')
      .first()
      .isVisible()
      .catch(() => false);

    expect(screenerEnabled || configSurface, 'Screener should toggle or open config after clicking Disabled badge').toBe(true);
  });

  test('"Disabled" badge in Screener section has button role', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SCREENER_DISABLED_DEFINITION);
    await page.waitForSelector('[data-testid="field-age"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Screener');
    await page.waitForSelector('text=Disabled', { timeout: 5000 });

    // The "Disabled" indicator must be a button so it is keyboard-accessible and
    // conveys interactivity to screen readers.
    // FAILS on the bug: Pill renders a <span>.
    await expect(page.getByRole('button', { name: /disabled/i })).toBeVisible();
  });
});

// ─── Bug #47 — Section collapse arrow does not reflect open/closed state ─────

test.describe('Bug #47 — Section collapse arrow is frozen', () => {
  test('▶ arrow on a Section header rotates when the section is collapsed then expanded', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Settings');
    await page.waitForSelector('text=Definition Metadata', { timeout: 5000 });

    // The "DEFINITION METADATA" Section header is a <button> containing two spans:
    //   1. The title label
    //   2. The ▶ arrow, which gets class `rotate-90` when the section is open
    const sectionBtn = page.getByRole('button', { name: /definition metadata/i });
    await expect(sectionBtn).toBeVisible();

    // The arrow indicator is the last <span> inside the header button.
    // Section.tsx: `<span className={`... ${open ? 'rotate-90' : ''}`}>▶</span>`
    const arrowSpan = sectionBtn.locator('span').last();

    // Section starts open (defaultOpen=true), so arrow should have rotate-90.
    // NOTE: if this first assertion FAILS, the rotate-90 class is missing even
    // when expanded — that itself is the bug.
    await expect(arrowSpan).toHaveClass(/rotate-90/);

    // Collapse the section
    await sectionBtn.click();

    // After collapsing, rotate-90 must be absent.
    // FAILS on the bug if arrow class is never toggled.
    await expect(arrowSpan).not.toHaveClass(/rotate-90/);

    // Re-expand
    await sectionBtn.click();

    // rotate-90 must reappear.
    await expect(arrowSpan).toHaveClass(/rotate-90/);
  });

  test('collapsing a Section hides its child rows', async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SETTINGS_DEFINITION);
    await page.waitForSelector('[data-testid="field-field1"]', { timeout: 5000 });

    await openBlueprintSection(page, 'Settings');
    await page.waitForSelector('text=Definition Metadata', { timeout: 5000 });

    // Locate the $formspec value row — it is inside "Definition Metadata" section
    // and visible while the section is expanded.
    // Section.tsx conditionally renders `{open && <div ...>{children}</div>}` so
    // the children are removed from the DOM (not just hidden) when collapsed.
    const formspecRow = page.getByText('$formspec', { exact: false }).first();
    await expect(formspecRow).toBeVisible();

    const sectionBtn = page.getByRole('button', { name: /definition metadata/i });
    await sectionBtn.click();

    // After collapsing, the $formspec row must be absent from the DOM.
    // FAILS on the bug if the Section never toggles its open state.
    await expect(formspecRow).not.toBeVisible({ timeout: 3000 });
  });
});
