import { test, expect } from '@playwright/test';
import { editorFieldRows, editorGroupRows, importDefinition, waitForApp } from './helpers';

const SEED_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'myField', type: 'field', dataType: 'string', label: 'My Field' },
  ],
};

test.describe('Interaction Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, SEED_DEFINITION);
    await page.waitForSelector('[data-testid="field-myField"]', { timeout: 5000 });
  });

  test.describe('Context Menu', () => {
    test('right-click on field block shows context menu with all actions', async ({ page }) => {
      // Right-click the field block
      await page.click('[data-testid="field-myField"]', { button: 'right' });

      // Context menu appears
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Verify all expected menu items
      await expect(page.locator('[data-testid="ctx-duplicate"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-delete"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-moveUp"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-moveDown"]')).toBeVisible();
      await expect(page.locator('[data-testid="ctx-wrapInGroup"]')).toBeVisible();
    });

    test('clicking Duplicate in context menu duplicates the field', async ({ page }) => {
      // Right-click the field
      await page.click('[data-testid="field-myField"]', { button: 'right' });
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Click Duplicate
      await page.click('[data-testid="ctx-duplicate"]');

      // Context menu should close
      await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();

      // There should now be 2 field blocks in the canvas
      await expect(editorFieldRows(page)).toHaveCount(2);
    });

    test('pressing Escape closes the context menu', async ({ page }) => {
      // Right-click to open context menu
      await page.click('[data-testid="field-myField"]', { button: 'right' });
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Context menu should close
      await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
    });

    test('clicking Wrap in Group wraps the selected field in a new group', async ({ page }) => {
      await page.click('[data-testid="field-myField"]', { button: 'right' });
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      await page.click('[data-testid="ctx-wrapInGroup"]');
      await page.getByLabel('Group Key').fill('wrappedGroup');
      await page.getByLabel('Group Label').fill('Wrapped Group');
      await page.getByRole('button', { name: 'Create Group' }).click();

      await expect(editorGroupRows(page)).toHaveCount(1);
      await expect(page.locator('[data-testid="field-myField"]')).toBeVisible();
    });

    test('clicking Move Down changes the field order', async ({ page }) => {
      await importDefinition(page, {
        $formspec: '1.0',
        items: [
          { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
          { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
        ],
      });
      await page.waitForSelector('[data-testid="field-firstField"]');
      await page.waitForSelector('[data-testid="field-secondField"]');

      await page.click('[data-testid="field-firstField"]', { button: 'right' });
      await page.click('[data-testid="ctx-moveDown"]');

      const canvas = editorFieldRows(page);
      await expect(canvas.nth(0)).toHaveAttribute('data-testid', 'field-secondField');
      await expect(canvas.nth(1)).toHaveAttribute('data-testid', 'field-firstField');
    });

    test('right-clicking empty canvas does not show the field context menu', async ({ page }) => {
      await page.click('[data-testid="workspace-Editor"]', { button: 'right', position: { x: 10, y: 10 } });
      await expect(page.locator('[data-testid="context-menu"]')).not.toBeVisible();
    });

    test('context menu stays within viewport when right-clicking near bottom-right edge', async ({ page }) => {
      // Use a small viewport so fields are easily near the edge
      await page.setViewportSize({ width: 800, height: 500 });

      // Seed a single field — we will trigger the context menu via a synthetic
      // event fired right at the bottom-right corner of the viewport so the
      // un-clamped placement would overflow.
      await page.waitForSelector('[data-testid="field-myField"]', { timeout: 5000 });

      // Scroll to the bottom of the canvas so the field is visible
      await page.locator('[data-testid="field-myField"]').scrollIntoViewIfNeeded();

      const viewport = page.viewportSize()!;

      // Fire a synthetic contextmenu event on the field element at coordinates
      // that are near the bottom-right of the viewport.  The menu is ~160px
      // wide and ~170px tall; clicking within 20px of the right/bottom edge
      // should guarantee overflow if the implementation does not clamp.
      const clickX = viewport.width - 10;   // 10px from right edge
      const clickY = viewport.height - 10;  // 10px from bottom edge

      // Dispatch a contextmenu event directly on the field element so the
      // React handler receives it with clientX/clientY at the edge coords.
      await page.evaluate(
        ({ x, y }) => {
          const el = document.querySelector('[data-testid="field-myField"]');
          if (!el) throw new Error('field-myField not found');
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          });
          el.dispatchEvent(evt);
        },
        { x: clickX, y: clickY },
      );

      // The context menu must be visible
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Assert: the context menu bounding box must be fully within the viewport.
      // This is the assertion that catches the bug — currently the menu is
      // positioned at raw clientX/clientY with no clamping, so it overflows.
      const menuBox = await page.locator('[data-testid="context-menu"]').boundingBox();
      expect(menuBox).not.toBeNull();

      const menuRight = menuBox!.x + menuBox!.width;
      const menuBottom = menuBox!.y + menuBox!.height;

      // Bug: the menu is anchored at (clickX, clickY) = (790, 490) with no
      // clamping.  A 160px-wide, ~170px-tall menu placed there will extend to
      // (950, 660) — well outside the 800×500 viewport.
      expect(menuRight).toBeLessThanOrEqual(viewport.width);
      expect(menuBottom).toBeLessThanOrEqual(viewport.height);
    });

    test('field cards expose a drag handle or draggable affordance for reorder', async ({ page }) => {
      const dragHandle = page.locator('[data-testid="field-myField"] [data-testid="drag-handle"]');
      await expect(dragHandle).toHaveCount(1);
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Delete key removes the selected field', async ({ page }) => {
      // Click to select the field
      await page.click('[data-testid="field-myField"]');

      // Press Delete
      await page.keyboard.press('Delete');

      // Field should be removed
      await expect(page.locator('[data-testid="field-myField"]')).not.toBeVisible();
    });

    test('Backspace key removes the selected field', async ({ page }) => {
      // Seed a second field to delete via Backspace
      await importDefinition(page, {
        $formspec: '1.0',
        items: [
          { key: 'toRemove', type: 'field', dataType: 'string', label: 'To Remove' },
        ],
      });
      await page.waitForSelector('[data-testid="field-toRemove"]', { timeout: 5000 });

      // Click to select the field
      await page.click('[data-testid="field-toRemove"]');

      // Press Backspace
      await page.keyboard.press('Backspace');

      // Field should be removed
      await expect(page.locator('[data-testid="field-toRemove"]')).not.toBeVisible();
    });

    test('Escape closes command palette', async ({ page }) => {
      // Open command palette
      await page.keyboard.press('Meta+k');
      await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Palette closes
      await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
    });

    test('Tab from the select button moves focus to the next field card', async ({ page }) => {
      await importDefinition(page, {
        $formspec: '1.0',
        items: [
          { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
          { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
        ],
      });
      await page.waitForSelector('[data-testid="field-firstField"]');
      await page.waitForSelector('[data-testid="field-secondField"]');

      // Focus the select button directly (the ItemRow select button handles Tab via onKeyDown)
      await page.locator('[data-testid="field-firstField-select"]').focus();
      await page.keyboard.press('Tab');

      await expect(page.locator('[data-testid="field-secondField-select"]')).toBeFocused();
    });
  });

  test.describe('Keyboard Autofocus', () => {
    test('Meta+k opens command palette and focuses search input', async ({ page }) => {
      // Press Meta+k to open palette
      await page.keyboard.press('Meta+k');
      await page.waitForSelector('[data-testid="command-palette"]');

      // Search input should be focused
      const searchInput = page.locator('[data-testid="command-palette"] input');
      await expect(searchInput).toBeFocused();
    });

    test('typing after Meta+k flows into search input', async ({ page }) => {
      // Open palette
      await page.keyboard.press('Meta+k');
      await page.waitForSelector('[data-testid="command-palette"]');

      // Type without clicking
      await page.keyboard.type('myF');

      // Characters appear in the input
      const searchInput = page.locator('[data-testid="command-palette"] input');
      await expect(searchInput).toHaveValue('myF');
    });
  });
});
