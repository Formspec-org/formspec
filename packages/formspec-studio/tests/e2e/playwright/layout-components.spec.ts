import { test, expect } from '@playwright/test';
import { waitForApp, seedDefinition } from './helpers';

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

/** Click a palette button by label, scoped to the palette overlay. */
async function addFromPalette(page: import('@playwright/test').Page, label: string) {
  await page.click('[data-testid="add-item"]');
  const palette = page.locator('[data-testid="add-item-palette"]');
  await palette.waitFor();
  await palette.getByRole('button', { name: new RegExp(`^${label}\\b`) }).click();
}

/**
 * Right-click the layout container's pill (the component type label area),
 * NOT the children area where child field blocks intercept the event.
 */
async function rightClickLayoutPill(page: import('@playwright/test').Page) {
  // The pill is a direct-child <span> of the [data-item-type="layout"] div
  const pill = page.locator('[data-item-type="layout"] > span').first();
  await pill.click({ button: 'right' });
}

test.describe('Layout Components', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await seedDefinition(page, SEED_DEF);
    await page.waitForSelector('[data-testid="field-name"]', { timeout: 5000 });
  });

  // ── Adding layout containers from the palette ───────────────────

  test.describe('Add from palette', () => {
    test('adds a Card layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Palette closes
      await expect(page.locator('[data-testid="add-item-palette"]')).not.toBeVisible();

      // A layout block appears on the canvas
      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=CARD')).toBeVisible();
    });

    test('adds a Stack layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Stack');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=STACK')).toBeVisible();
    });

    test('adds a Columns layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Columns');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=COLUMNS')).toBeVisible();
    });

    test('adds a Collapsible layout container to the canvas', async ({ page }) => {
      await addFromPalette(page, 'Collapsible');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=COLLAPSIBLE')).toBeVisible();
    });

    test('auto-selects the new layout container after adding', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Properties panel should show layout properties
      const properties = page.locator('[data-testid="properties"]');
      await expect(properties.locator('text=Layout')).toBeVisible();
      await expect(properties.locator('text=Card')).toBeVisible();
    });

    test('can add multiple layout containers', async ({ page }) => {
      await addFromPalette(page, 'Card');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

      await addFromPalette(page, 'Stack');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(2);
    });
  });

  // ── Adding content sub-types from the palette ───────────────────

  test.describe('Content sub-types', () => {
    test('adds a Heading display item', async ({ page }) => {
      await addFromPalette(page, 'Heading');

      const display = page.locator('[data-item-type="display"]');
      await expect(display).toHaveCount(1);
      await expect(display.locator('text=Heading')).toBeVisible();
    });

    test('adds a Divider display item', async ({ page }) => {
      await addFromPalette(page, 'Divider');

      const display = page.locator('[data-item-type="display"]');
      await expect(display).toHaveCount(1);
      await expect(display.locator('text=Divider')).toBeVisible();
    });

    test('adds a Spacer display item', async ({ page }) => {
      await addFromPalette(page, 'Spacer');

      const display = page.locator('[data-item-type="display"]');
      await expect(display).toHaveCount(1);
      await expect(display.locator('text=Spacer')).toBeVisible();
    });
  });

  // ── Wrap via context menu ───────────────────────────────────────

  test.describe('Wrap in layout container', () => {
    test('context menu offers wrap options on a field', async ({ page }) => {
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      await expect(page.locator('[data-testid="ctx-wrapInCard"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-wrapInStack"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-wrapInCollapsible"]')).toBeVisible();
    });

    test('wrapping a field in a Card creates a layout container around it', async ({ page }) => {
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=CARD')).toBeVisible();

      // The field should still be visible (now inside the Card)
      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    });

    test('wrapping a field in a Stack creates a layout container around it', async ({ page }) => {
      await page.click('[data-testid="field-email"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInStack"]');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=STACK')).toBeVisible();
      await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
    });

    test('wrapping a field in a Collapsible creates a layout container around it', async ({ page }) => {
      await page.click('[data-testid="field-age"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCollapsible"]');

      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('text=COLLAPSIBLE')).toBeVisible();
      await expect(page.locator('[data-testid="field-age"]')).toBeVisible();
    });

    test('the wrapper is auto-selected after wrapping and shows layout properties', async ({ page }) => {
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');

      const properties = page.locator('[data-testid="properties"]');
      await expect(properties.locator('text=Layout')).toBeVisible();
      await expect(properties.locator('text=Card')).toBeVisible();
      await expect(properties.locator('text=Unwrap')).toBeVisible();
      await expect(properties.locator('text=Delete')).toBeVisible();
    });
  });

  // ── Unwrap via context menu ─────────────────────────────────────

  test.describe('Unwrap layout container', () => {
    test('right-clicking a layout container pill shows Unwrap and Delete', async ({ page }) => {
      // Wrap a field in a Card
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');

      // Right-click the layout container's pill (not the child area)
      await rightClickLayoutPill(page);

      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-unwrap"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-deleteLayout"]')).toBeVisible();
    });

    test('unwrapping removes the container and keeps the child', async ({ page }) => {
      // Wrap a field
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

      // Use the properties panel Unwrap button (more reliable than context menu)
      const properties = page.locator('[data-testid="properties"]');
      await properties.locator('button:has-text("Unwrap")').click();

      // Layout container is gone
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(0);

      // Field is still on the canvas
      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
    });
  });

  // ── Layout properties panel ─────────────────────────────────────

  test.describe('Layout properties panel', () => {
    test('clicking a layout block shows layout properties in the inspector', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Click it to select (empty Card, so clicking it is unambiguous)
      const layoutBlock = page.locator('[data-item-type="layout"]');
      await layoutBlock.click();

      const properties = page.locator('[data-testid="properties"]');
      await expect(properties.locator('h2:has-text("Layout")')).toBeVisible();
      await expect(properties.locator('text=Card')).toBeVisible();
      await expect(properties.locator('text=Node ID')).toBeVisible();
    });

    test('unwrap button in properties panel removes the layout container', async ({ page }) => {
      // Wrap a field in a Card
      await page.click('[data-testid="field-email"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(1);

      // The wrapper should be auto-selected; click Unwrap in properties
      const properties = page.locator('[data-testid="properties"]');
      await properties.locator('button:has-text("Unwrap")').click();

      // Layout gone, field preserved
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
    });

    test('delete button in properties panel removes the layout container', async ({ page }) => {
      await addFromPalette(page, 'Card');

      // Click the Delete button in properties
      const properties = page.locator('[data-testid="properties"]');
      await properties.locator('button:has-text("Delete")').click();

      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(0);
    });

    test('switching between field and layout selection updates properties panel', async ({ page }) => {
      await addFromPalette(page, 'Card');

      const properties = page.locator('[data-testid="properties"]');

      // Properties show Layout for the Card
      await expect(properties.locator('h2:has-text("Layout")')).toBeVisible();

      // Click the name field
      await page.click('[data-testid="field-name"]');

      // Properties should now show field properties
      await expect(properties.locator('h2:has-text("Layout")')).not.toBeVisible();
      await expect(properties.locator('input[value="name"]')).toBeVisible();

      // Click back to layout (empty Card, unambiguous)
      await page.locator('[data-item-type="layout"]').click();
      await expect(properties.locator('h2:has-text("Layout")')).toBeVisible();
    });
  });

  // ── Palette search ──────────────────────────────────────────────

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

  test.describe('Definition integrity', () => {
    test('all definition fields remain on canvas after adding a Card', async ({ page }) => {
      await addFromPalette(page, 'Card');

      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="field-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="field-age"]')).toBeVisible();
    });

    test('wrapping and unwrapping preserves the field', async ({ page }) => {
      // Wrap
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');

      // Verify field is inside Card
      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock.locator('[data-testid="field-name"]')).toBeVisible();

      // Unwrap via properties panel (wrapper is auto-selected)
      const properties = page.locator('[data-testid="properties"]');
      await properties.locator('button:has-text("Unwrap")').click();

      // Field still on canvas, no layout containers
      await expect(page.locator('[data-testid="field-name"]')).toBeVisible();
      await expect(page.locator('[data-item-type="layout"]')).toHaveCount(0);
    });

    test('adding a new field after wrapping does not break the wrapper', async ({ page }) => {
      // Wrap name field
      await page.click('[data-testid="field-name"]', { button: 'right' });
      await page.click('[data-testid="ctx-wrapInCard"]');

      // Add a new Integer field via palette
      await addFromPalette(page, 'Integer');

      // The Card should still exist with the wrapped field inside
      const layoutBlock = page.locator('[data-item-type="layout"]');
      await expect(layoutBlock).toHaveCount(1);
      await expect(layoutBlock.locator('[data-testid="field-name"]')).toBeVisible();

      // The new field should be at the root (not inside the Card)
      await expect(page.locator('[data-testid^="field-"]')).toHaveCount(4); // name, email, age, + new
    });
  });
});
