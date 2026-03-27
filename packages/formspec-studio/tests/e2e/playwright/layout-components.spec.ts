import { test, expect } from '@playwright/test';
import { addFromPalette, importDefinition, switchTab, waitForApp } from './helpers';

const SEED_DEF = {
  $formspec: '1.0',
  url: 'urn:layout-e2e',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

/*
 * Editor/Layout workspace split:
 *
 * The Editor tab is now a pure definition-tree editor (no layout containers,
 * no wrap-in-Card/Stack/Collapsible context menu, no page tabs).
 *
 * Layout containers live in the Layout tab, which renders the component tree.
 * The Layout canvas uses different test IDs:
 *   - layout-field-{key} (not field-{key})
 *   - layout-container-{nodeId} (not [data-item-type="layout"])
 *   - layout-context-menu / layout-ctx-{action} (not context-menu / ctx-{action})
 *
 * The Layout canvas context menu offers: Wrap in Card, Wrap in Stack, Wrap in
 * Grid, Wrap in Panel, Unwrap, Remove from Tree — but only on existing nodes.
 *
 * Adding layout containers from the AddItemPalette is not yet wired in the
 * Layout workspace. The palette "Add Item" button lives in Editor and does not
 * handle layout items. These tests will be re-enabled once the Layout workspace
 * has its own add-container affordance.
 */

test.describe('Layout Components', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEF);
    await page.waitForSelector('[data-testid="field-name"]', { timeout: 5000 });
  });

  // ── Adding layout containers from the palette ───────────────────
  // SKIPPED: Layout containers cannot be added from the palette after the
  // Editor/Layout split. The AddItemPalette in Editor does not dispatch
  // layout items and the Layout canvas has no palette yet.

  test.describe('Add from palette', () => {
    test.skip('adds a Card layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Palette closes
      await expect(page.locator('[data-testid="add-item-palette"]')).not.toBeVisible();

      // A layout block appears on the canvas
      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=CARD')).toBeVisible();
    });

    test.skip('adds a Stack layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Stack');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=STACK')).toBeVisible();
    });

    test.skip('adds a Columns layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Columns');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=COLUMNS')).toBeVisible();
    });

    test.skip('adds a Collapsible layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Collapsible');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=COLLAPSIBLE')).toBeVisible();
    });

    test.skip('auto-selects the new layout container after adding', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Properties panel should show layout properties
      const properties = page.locator('[data-testid="properties"]');
      await expect(properties.locator('text=Layout')).toBeVisible();
      await expect(properties.locator('text=Card')).toBeVisible();
    });

    test.skip('can add multiple layout containers', async ({ page }) => {
      await addFromPalette(page, 'Card');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

      await addFromPalette(page, 'Stack');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(2);
    });
  });

  // ── Adding content sub-types from the palette ───────────────────
  // These are definition-level items and are added via the Editor tab palette.

  test.describe('Content sub-types', () => {
    test('adds a Heading display item', async ({ page }) => {
      await addFromPalette(page, 'Heading');

      const display = page.locator('[data-testid^="display-"]');
      await expect(display).toHaveCount(1);
    });

    test('adds a Divider display item', async ({ page }) => {
      await addFromPalette(page, 'Divider');

      const display = page.locator('[data-testid^="display-"]');
      await expect(display).toHaveCount(1);
    });

    test('adds a Spacer display item', async ({ page }) => {
      await addFromPalette(page, 'Spacer');

      const display = page.locator('[data-testid^="display-"]');
      await expect(display).toHaveCount(1);
    });
  });

  // ── Wrap via context menu ───────────────────────────────────────
  // SKIPPED: Wrap-in-layout context menu actions (Card, Stack, Collapsible) are
  // now on the Layout tab's context menu (layout-ctx-wrapInCard, etc.), not the
  // Editor tab. The Editor context menu only offers Wrap in Group.
  // These tests need rewriting to navigate to Layout and use layout-ctx-* IDs.

  test.describe('Wrap in layout container', () => {
    test('Editor context menu offers Wrap in Group (not layout wrap options)', async ({ page }) => {
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Editor only has definition-level actions
      await expect(page.locator('[data-testid="ctx-wrapInGroup"]')).toBeVisible();
      // Layout wrap actions no longer in Editor
      await expect(page.locator('[data-testid="ctx-wrapInCard"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="ctx-wrapInStack"]')).not.toBeVisible();
    });

    test('Layout context menu offers wrap options on a field', async ({ page }) => {
      await switchTab(page, 'Layout');

      // Right-click a field in the layout canvas
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await expect(layoutField).toBeVisible({ timeout: 5000 });
      await layoutField.click({ button: 'right' });
      await expect(page.locator('[data-testid="layout-context-menu"]')).toBeVisible();

      await expect(page.locator('[data-testid="layout-ctx-wrapInCard"]')).toBeVisible();
      await expect(page.locator('[data-testid="layout-ctx-wrapInStack"]')).toBeVisible();
    });

    test.skip('wrapping a field in a Card creates a layout container around it', async () => {
      // Needs rewrite: navigate to Layout, right-click layout-field-name,
      // click layout-ctx-wrapInCard, verify layout-container-* appears
    });

    test.skip('wrapping a field in a Stack creates a layout container around it', async () => {
      // Needs rewrite for Layout tab
    });

    test.skip('wrapping a field in a Collapsible creates a layout container around it', async () => {
      // Needs rewrite for Layout tab
    });

    test.skip('the wrapper is auto-selected after wrapping and shows layout properties', async () => {
      // Needs rewrite for Layout tab + ComponentProperties panel
    });
  });

  // ── Unwrap via context menu ─────────────────────────────────────
  // SKIPPED: Unwrap is a Layout-tier operation. These tests depended on the old
  // combined EditorCanvas with layout-aware context menus and properties panel.

  test.describe('Unwrap layout container', () => {
    test.skip('right-clicking a layout container shows Unwrap and Remove from Tree', async () => {
      // Needs rewrite: navigate to Layout, wrap via layout-ctx, then right-click
      // the container to get layout-ctx-unwrap / layout-ctx-removeFromTree
    });

    test.skip('unwrapping removes the container and keeps the child', async () => {
      // Needs rewrite for Layout tab
    });
  });

  // ── Layout properties panel ─────────────────────────────────────
  // SKIPPED: Layout properties panel (ComponentProperties) is only shown when
  // the Layout tab is active. These tests relied on the old combined workspace.

  test.describe('Layout properties panel', () => {
    test.skip('clicking a layout block shows layout properties in the inspector', async () => {
      // Needs rewrite: navigate to Layout, click a layout-container-* node
    });

    test.skip('unwrap button in properties panel removes the layout container', async () => {
      // Needs rewrite for Layout tab
    });

    test.skip('delete button in properties panel removes the layout container', async () => {
      // Needs rewrite for Layout tab
    });

    test.skip('switching between field and layout selection updates properties panel', async () => {
      // Needs rewrite for Layout tab
    });
  });

  // ── Palette search ──────────────────────────────────────────────
  // The palette still shows all item types (including layout) for search.
  // The palette catalog is shared — only the Editor's handler ignores layout items.

  test.describe('Palette search for layout items', () => {
    test('searching "card" in palette filters to the Card option', async ({ page }) => {
      await page.click('[data-testid="add-item"]');
      const palette = page.locator('[data-testid="add-item-palette"]');
      await palette.locator('input').fill('card');

      const grid = palette.locator('[data-testid="add-item-grid"]');
      const buttons = grid.locator('button');
      await expect(buttons).toHaveCount(1);
      await expect(buttons.first()).toContainText('Card');
    });

    test('searching "heading" in palette filters to the Heading option', async ({ page }) => {
      await page.click('[data-testid="add-item"]');
      const palette = page.locator('[data-testid="add-item-palette"]');
      await palette.locator('input').fill('heading');

      const grid = palette.locator('[data-testid="add-item-grid"]');
      const buttons = grid.locator('button');
      await expect(buttons).toHaveCount(1);
      await expect(buttons.first()).toContainText('Heading');
    });
  });

  // ── Definition items survive layout operations ──────────────────
  // SKIPPED: These relied on layout operations (add Card, wrap/unwrap) in the
  // Editor tab. Layout operations are now in the Layout tab with different
  // selectors. The definition-tree Editor always shows all fields.

  test.describe('Definition integrity', () => {
    test('all definition fields are visible in the Editor tree', async ({ page }) => {
      // In the new Editor, all fields are always visible regardless of layout
      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="field-age"]')).toBeVisible();
    });

    test.skip('wrapping and unwrapping preserves the field', async () => {
      // Needs rewrite: wrap/unwrap are Layout-tab operations
    });

    test.skip('adding a new field after wrapping does not break the wrapper', async () => {
      // Needs rewrite: wrap is a Layout-tab operation
    });
  });
});
