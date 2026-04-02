import { test, expect } from '@playwright/test';
import { addFromLayoutPalette, addFromPalette, importDefinition, propertiesPanel, switchTab, waitForApp } from './helpers';

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
 * Layout containers are now added from the Layout workspace chrome via
 * `layout-add-*` buttons, not the Editor palette.
 */

test.describe('Layout Components', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEF);
    await page.waitForSelector('[data-testid="field-name"]', { timeout: 5000 });
  });

  // ── Adding layout containers from the Layout workspace chrome ───────────

  test.describe('Add from palette', () => {
    test('adds a Card layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Stack layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-stack"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Grid layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-grid"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Grid' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Panel layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-panel"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Panel' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('auto-selects the new layout container after adding', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');

      const properties = propertiesPanel(page);
      await expect(properties.getByRole('heading', { name: 'Component' })).toBeVisible();
      await expect(properties).toContainText('Card');
    });

    test('can add multiple layout containers', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');
      await page.click('[data-testid="layout-add-stack"]');

      await expect(page.locator('[data-testid^="layout-container-"]')).toHaveCount(2);
    });
  });

  // ── Adding content sub-types from the palette ───────────────────
  // These are definition-level items and are added via the Editor tab palette.

  test.describe('Content sub-types', () => {
    test('adds a Heading display item', async ({ page }) => {
      await addFromLayoutPalette(page, 'Heading');

      await expect(page.locator('[data-testid^="layout-display-"]')).toHaveCount(1);
    });

    test('adds a Divider display item', async ({ page }) => {
      await addFromLayoutPalette(page, 'Divider');

      await expect(page.locator('[data-testid^="layout-display-"]')).toHaveCount(1);
    });

    // Spacer is itemType: 'layout' (Component Spec §5.5) — excluded from
    // the editor palette which only shows inputs, groups, and display items.
    // Spacer is added via the Layout workspace, not the Editor palette.
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

    test('wrapping a field in a Card creates a layout container around it', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });

    test('wrapping a field in a Stack creates a layout container around it', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInStack"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' });
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });

    test('the wrapper is auto-selected after wrapping and shows layout properties', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const properties = propertiesPanel(page);
      await expect(properties.getByRole('heading', { name: 'Component' })).toBeVisible();
      await expect(properties).toContainText('Card');
    });
  });

  // ── Unwrap via context menu ─────────────────────────────────────
  // SKIPPED: Unwrap is a Layout-tier operation. These tests depended on the old
  // combined EditorCanvas with layout-aware context menus and properties panel.

  test.describe('Unwrap layout container', () => {
    test('right-clicking a layout container shows Unwrap and Remove from Tree', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /card/i }).click({ button: 'right' });

      await expect(page.locator('[data-testid="layout-ctx-unwrap"]')).toBeVisible();
      await expect(page.locator('[data-testid="layout-ctx-removeFromTree"]')).toBeVisible();
    });

    test('unwrapping removes the container and keeps the child', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /card/i }).click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-unwrap"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
      await expect(page.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });
  });

  // ── Layout properties panel ─────────────────────────────────────
  // SKIPPED: Layout properties panel (ComponentProperties) is only shown when
  // the Layout tab is active. These tests relied on the old combined workspace.

  test.describe('Layout properties panel', () => {
    test('clicking a layout block shows layout properties in the inspector', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');
      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /card/i }).click();

      const properties = propertiesPanel(page);
      await expect(properties.getByRole('heading', { name: 'Component' })).toBeVisible();
      await expect(properties).toContainText('Card');
    });

    test('unwrap button in properties panel removes the layout container', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-field-name"]', { button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      await expect(propertiesPanel(page)).toContainText('Card');
      await page.click('[data-testid="layout-properties-unwrap"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
      await expect(page.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });

    test('delete button in properties panel removes the layout container', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');
      await expect(propertiesPanel(page)).toContainText('Card');

      await page.click('[data-testid="layout-properties-delete"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
    });

    test('switching between field and layout selection updates properties panel', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /card/i }).click();
      await expect(propertiesPanel(page)).toContainText('Card');

      await page.click('[data-testid="layout-field-name"]');
      await expect(propertiesPanel(page)).toContainText('Full Name');
    });
  });

  // ── Palette search ──────────────────────────────────────────────
  // The editor-scoped palette intentionally filters out layout items.
  // Search should only surface definition-level items there.

  test.describe('Palette search for layout items', () => {
    test('searching "card" in the editor palette does not surface layout-only options', async ({ page }) => {
      await page.click('[data-testid="add-item"]');
      const palette = page.locator('[data-testid="add-item-palette"]');
      await palette.locator('input').fill('card');

      await expect(palette).toContainText('No field types match');
      await expect(palette.locator('[data-testid="add-item-grid"]')).toHaveCount(0);
    });

    test('searching "heading" in the editor palette does not surface display items', async ({ page }) => {
      await page.click('[data-testid="add-item"]');
      const palette = page.locator('[data-testid="add-item-palette"]');
      await palette.locator('input').fill('heading');

      await expect(palette).toContainText('No field types match');
      await expect(palette.locator('[data-testid="add-item-grid"]')).toHaveCount(0);
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

    test('wrapping and unwrapping preserves the field', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-field-name"]', { button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /card/i }).click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-unwrap"]');

      await switchTab(page, 'Editor');
      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    });

    test('adding a new field after wrapping does not break the wrapper', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-field-name"]', { button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      await switchTab(page, 'Editor');
      await addFromPalette(page, 'Text');

      await switchTab(page, 'Layout');
      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(1);
    });
  });
});
