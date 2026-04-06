import { test, expect, type Page, type Locator } from '@playwright/test';
import {
  addFromLayoutPalette,
  addFromPalette,
  importDefinition,
  importProject,
  layoutContainerHeaderSelectRow,
  switchTab,
  waitForApp,
} from './helpers';

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

const GRID_PROJECT = {
  definition: {
    $formspec: '1.0',
    url: 'urn:layout-grid-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'single' },
    items: [
      { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
      { key: 'lastName', type: 'field', dataType: 'string', label: 'Last Name' },
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
    ],
  },
  component: {
    $formspecComponent: '0.1',
    version: '0.1.0',
    targetDefinition: { url: 'urn:layout-grid-e2e' },
    tree: {
      component: 'Form',
      children: [
        {
          component: 'Page',
          nodeId: 'page-main',
          title: 'Main',
          _layout: true,
          children: [
            {
              component: 'Grid',
              nodeId: 'grid-main',
              _layout: true,
              columns: 2,
              children: [
                { component: 'TextInput', bind: 'firstName' },
                { component: 'TextInput', bind: 'lastName' },
              ],
            },
            {
              component: 'Stack',
              nodeId: 'stack-secondary',
              _layout: true,
              direction: 'column',
              children: [
                { component: 'TextInput', bind: 'email' },
              ],
            },
          ],
        },
      ],
    },
  },
};

async function dragSelectorToSelector(page: Page, sourceSelector: string, targetSelector: string) {
  const source = page.locator(sourceSelector);
  const target = page.locator(targetSelector);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error(`Source not visible: ${sourceSelector}`);
  }

  const startX = sourceBox.x + (sourceBox.width / 2);
  const startY = sourceBox.y + (sourceBox.height / 2);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY + 10, { steps: 3 });
  await expect(target).toBeVisible({ timeout: 5000 });

  const targetBox = await target.boundingBox();
  if (!targetBox) {
    throw new Error(`Target not visible: ${targetSelector}`);
  }

  await page.mouse.move(targetBox.x + (targetBox.width / 2), targetBox.y + (targetBox.height / 2), { steps: 8 });
  await page.mouse.up();
}

async function dragSelectorByOffset(page: Page, sourceSelector: string, xOffset: number, yOffset = 0) {
  const source = page.locator(sourceSelector);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error(`Source not visible: ${sourceSelector}`);
  }

  const startX = sourceBox.x + (sourceBox.width / 2);
  const startY = sourceBox.y + (sourceBox.height / 2);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY + 10, { steps: 3 });
  await page.mouse.move(startX + xOffset, startY + yOffset, { steps: 12 });
  await page.mouse.up();
}

async function openLayoutContainerMenu(page: Page) {
  await page.locator('[data-testid="layout-add-container-menu"]').click();
  await expect(page.locator('[data-testid="layout-add-card"]')).toBeVisible();
}

async function dispatchResizeDrag(page: Page, sourceSelector: string | Locator, xOffset: number, yOffset = 0) {
  const source = typeof sourceSelector === 'string' ? page.locator(sourceSelector) : sourceSelector;
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error(`Source not visible`);
  }

  const startX = sourceBox.x + (sourceBox.width / 2);
  const startY = sourceBox.y + (sourceBox.height / 2);
  const targetX = startX + xOffset;
  const targetY = startY + yOffset;

  await source.dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: startX,
    clientY: startY,
    buttons: 1,
  });
  await source.dispatchEvent('pointermove', {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: targetX,
    clientY: targetY,
    buttons: 1,
  });
  await source.dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: targetX,
    clientY: targetY,
    buttons: 0,
  });
}

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
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Stack layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-stack"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Stack' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Grid layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-grid"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Grid' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('adds a Panel layout container to the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-panel"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Panel' });
      await expect(layoutBlock).toHaveCount(1);
    });

    test('auto-selects the new layout container after adding', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');

      const cardHeader = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' }).getByRole('button', { name: /^Card$/ });
      await expect(cardHeader).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' }).locator('[data-testid="toolbar-overflow"]')).toBeVisible();
    });

    test('can add multiple layout containers', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-stack"]');

      await expect(page.locator('[data-testid^="layout-container-"]')).toHaveCount(2);
    });
  });

  // ── Adding content sub-types from the palette ───────────────────
  // These are definition-level items and are added via the Editor tab palette.

  test.describe('Content sub-types', () => {
    test('adds a Heading display item', async ({ page }) => {
      await addFromLayoutPalette(page, 'Heading');

      const layoutWs = page.locator('[data-testid="workspace-Layout"]');
      // Root display nodes only — inner controls also use data-testid^="layout-display-".
      await expect(layoutWs.locator('[data-layout-node-type="display"]')).toHaveCount(1);
    });

    test('adds a Divider display item', async ({ page }) => {
      await addFromLayoutPalette(page, 'Divider');

      const layoutWs = page.locator('[data-testid="workspace-Layout"]');
      await expect(layoutWs.locator('[data-layout-node-type="display"]')).toHaveCount(1);
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

    test('the wrapper is auto-selected after wrapping', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      const cardHeader = layoutBlock.getByRole('button', { name: /^Card$/ });
      await expect(cardHeader).toHaveAttribute('aria-pressed', 'true');
      await expect(layoutBlock.locator('[data-testid="toolbar-overflow"]')).toBeVisible();
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
      await layoutContainerHeaderSelectRow(layoutBlock).click({ button: 'right' });

      await expect(page.locator('[data-testid="layout-ctx-unwrap"]')).toBeVisible();
      await expect(page.locator('[data-testid="layout-ctx-removeFromTree"]')).toBeVisible();
    });

    test('unwrapping removes the container and keeps the child', async ({ page }) => {
      await switchTab(page, 'Layout');
      const layoutField = page.locator('[data-testid="layout-field-name"]');
      await layoutField.click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutContainerHeaderSelectRow(layoutBlock).click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-unwrap"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
      await expect(page.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });
  });

  // ── Layout selection and popover actions ───────────────────────

  test.describe('Layout selection and popover actions', () => {
    test('clicking a layout block selects it in the canvas', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      const cardHeader = layoutBlock.getByRole('button', { name: /^Card$/ });
      await cardHeader.click();

      await expect(cardHeader).toHaveAttribute('aria-pressed', 'true');
      await expect(layoutBlock.locator('[data-testid="toolbar-overflow"]')).toBeVisible();
    });

    test('unwrap button in the popover removes the layout container', async ({ page }) => {
      await switchTab(page, 'Layout');
      await page.click('[data-testid="layout-field-name"]', { button: 'right' });
      await page.click('[data-testid="layout-ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      const cardHeader = layoutBlock.getByRole('button', { name: /^Card$/ });
      await cardHeader.click();
      await layoutBlock.locator('[data-testid="toolbar-overflow"]').click();

      await expect(page.locator('[data-testid="property-popover"]')).toBeVisible();
      await page.click('[data-testid="popover-unwrap"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
      await expect(page.locator('[data-testid="layout-field-name"]')).toBeVisible();
    });

    test('delete button in the popover removes the layout container', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      await layoutBlock.getByRole('button', { name: /^Card$/ }).click();
      await layoutBlock.locator('[data-testid="toolbar-overflow"]').click();

      await expect(page.locator('[data-testid="property-popover"]')).toBeVisible();
      await page.click('[data-testid="popover-remove"]');

      await expect(page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' })).toHaveCount(0);
    });

    test('switching between field and layout selection updates selection state', async ({ page }) => {
      await switchTab(page, 'Layout');
      await openLayoutContainerMenu(page);
      await page.click('[data-testid="layout-add-card"]');

      const layoutBlock = page.locator('[data-testid^="layout-container-"]').filter({ hasText: 'Card' });
      const cardHeader = layoutBlock.getByRole('button', { name: /^Card$/ });
      const fieldEmail = page.locator('[data-testid="layout-field-email"]');

      await cardHeader.click();
      await expect(cardHeader).toHaveAttribute('aria-pressed', 'true');

      await fieldEmail.click({ force: true });
      await expect(fieldEmail.locator('[data-testid="toolbar-widget"]')).toBeVisible();
      await expect(cardHeader).toHaveAttribute('aria-pressed', 'false');
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
      await layoutContainerHeaderSelectRow(layoutBlock).click({ button: 'right' });
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

  test.describe('Grid interactions and preview', () => {
    test.beforeEach(async ({ page }) => {
      await waitForApp(page);
      await importProject(page, GRID_PROJECT);
      await switchTab(page, 'Layout');
      await page.waitForSelector('[data-testid="layout-field-firstName"]', { timeout: 5000 });
    });

    test('drag-resizes a field column span', async ({ page }) => {
      const field = page.locator('[data-testid="layout-container-grid-main"] [data-testid="layout-field-firstName"]').first();
      const resizeHandle = field.locator('[data-testid="resize-handle-col-touch-zone"]').first();
      await expect(resizeHandle).toBeVisible();

      await dispatchResizeDrag(page, resizeHandle, 320, 0);

      await expect.poll(async () => field.evaluate((el: HTMLElement) => el.style.gridColumn)).toBe('span 2');
    });

    test('increments the Grid column count from the toolbar', async ({ page }) => {
      const grid = page.locator('[data-testid="layout-container-grid-main"]');
      await grid.getByRole('button', { name: /^Grid$/ }).click();

      await expect(page.locator('[data-testid="toolbar-columns-value"]')).toHaveText('2');
      await page.click('[data-testid="toolbar-columns-inc"]');
      await expect(page.locator('[data-testid="toolbar-columns-value"]')).toHaveText('3');

      const content = grid.locator('[data-layout-content]');
      await expect.poll(async () => content.evaluate((el: HTMLElement) => el.style.gridTemplateColumns)).toBe('repeat(3, 1fr)');
    });

    test('reorders fields within the Grid using a spatial insert slot', async ({ page }) => {
      // Drag activator is the grip only (FieldBlock useDraggable handle), not the whole block.
      const source = '[data-testid="layout-field-lastName"] [data-testid="drag-handle"]';
      const target = '[data-testid="insert-slot-grid-main-0"]';

      await dragSelectorToSelector(page, source, target);

      const gridFields = page.locator('[data-testid="layout-container-grid-main"] [data-testid^="layout-field-"]');
      await expect(gridFields.nth(0)).toHaveAttribute('data-testid', 'layout-field-lastName');
      await expect(gridFields.nth(1)).toHaveAttribute('data-testid', 'layout-field-firstName');
    });

    test('drags an unassigned tray item back onto the canvas', async ({ page }) => {
      await page.locator('[data-testid="layout-field-email"]').click({ button: 'right' });
      await page.click('[data-testid="layout-ctx-removeFromTree"]');

      await expect(page.locator('[data-testid="unassigned-email"]')).toBeVisible();
      await dragSelectorToSelector(page, '[data-testid="unassigned-email"]', '[data-testid="layout-container-grid-main"]');

      await expect(page.locator('[data-testid="layout-field-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="unassigned-email"]')).toHaveCount(0);
    });

    test('changes a Stack direction via the toolbar', async ({ page }) => {
      const stack = page.locator('[data-testid="layout-container-stack-secondary"]');
      await stack.getByRole('button', { name: /^Stack$/ }).click();

      await page.click('[data-testid="toolbar-direction-row"]');

      const content = stack.locator('[data-layout-content]');
      await expect(page.locator('[data-testid="toolbar-direction-row"]')).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => content.evaluate((el: HTMLElement) => el.style.flexDirection)).toBe('row');
    });

    test('updates the inline live preview when a new layout item is added', async ({ page }) => {
      const previewHost = page.locator('[data-testid="formspec-preview-host"]');

      await page.click('[data-testid="layout-add-item"]');
      await page.getByRole('button', { name: /Text Short text/i }).click();

      await expect(previewHost.getByRole('textbox', { name: /Text/i })).toBeVisible({ timeout: 5000 });
    });
  });
});
