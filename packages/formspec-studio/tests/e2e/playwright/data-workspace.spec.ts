import { test, expect } from '@playwright/test';
import { waitForApp, importDefinition } from './helpers';

const DATA_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'firstName', type: 'field', dataType: 'string', label: 'First Name' },
    { key: 'status', type: 'field', dataType: 'select1', optionSet: 'statusValues' },
    { key: 'address', type: 'group', children: [
      { key: 'street', type: 'field', dataType: 'string', label: 'Street' },
      { key: 'city', type: 'field', dataType: 'string', label: 'City' },
    ]},
  ],
  instances: [
    { name: 'countries', source: 'https://api.example.com/countries' },
  ],
  optionSets: {
    statusValues: {
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending' },
      ],
    },
  },
};

const REPEATABLE_DEFINITION = {
  $formspec: '1.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
    {
      key: 'members',
      type: 'group',
      label: 'Members',
      repeatable: true,
      minRepeat: 0,
      maxRepeat: 10,
      children: [
        { key: 'mName', type: 'field', label: 'Member Name', dataType: 'string' },
      ],
    },
  ],
};

/** Helper: navigate to Manage view within Editor workspace */
async function switchToManage(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: 'Manage' }).click();
}

test.describe('Editor Manage View — Data Sections', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DATA_DEFINITION);
    await switchToManage(page);
  });

  test('data sources section shows instances', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByText('countries', { exact: true })).toBeVisible();
    await expect(workspace.getByText('https://api.example.com/countries', { exact: true })).toBeVisible();
  });

  test('option sets section shows option set names and values', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByText('statusValues')).toBeVisible();
    await workspace.locator('[data-testid="option-set-statusValues"]').click();
    await expect(workspace.getByRole('textbox', { name: 'key' }).first()).toBeVisible();
    await expect(workspace.locator('tbody tr').first().locator('input').first()).toHaveValue('active');
    await expect(workspace.locator('tbody tr').first().locator('input').nth(1)).toHaveValue('Active');
    await expect(workspace.locator('tbody tr').nth(1).locator('input').first()).toHaveValue('inactive');
    await expect(workspace.locator('tbody tr').nth(2).locator('input').first()).toHaveValue('pending');
    await expect(workspace.getByText(/1 Ref/)).toBeVisible();
  });

  test('empty data sources state stays informational without a fake creation button', async ({ page }) => {
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
    });

    await switchToManage(page);
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByText('No external sources connected.')).toBeVisible();
    await expect(workspace.getByRole('button', { name: /add data source/i })).toHaveCount(0);
  });

  test('option set cards are informational panels, not misleading buttons', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await expect(workspace.getByText('statusValues')).toBeVisible();

    const optionSetCard = workspace.locator('[data-testid="option-set-statusValues"]');
    await expect(optionSetCard).toBeVisible();
    await expect(workspace.getByRole('button', { name: /statusValues/i })).toHaveCount(0);
  });
});

test.describe('Form Health Panel — Response Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DATA_DEFINITION);
  });

  test('response schema tree shows fields with types', async ({ page }) => {
    const panel = page.locator('[data-testid="output-blueprint"]');
    await expect(panel.getByText('"firstName"', { exact: true })).toBeVisible();
    await expect(panel.getByText('string', { exact: true }).first()).toBeVisible();
    await expect(panel.getByText('"street"', { exact: true })).toBeVisible();
    await expect(panel.getByText('"city"', { exact: true })).toBeVisible();
  });

  test('repeatable group shows "array" type in Response Schema, not "object" [BUG-033]', async ({ page }) => {
    await importDefinition(page, REPEATABLE_DEFINITION);

    const panel = page.locator('[data-testid="output-blueprint"]');
    await expect(panel.getByText('"members"', { exact: true })).toBeVisible();

    const membersKeySpan = panel.getByText('"members"', { exact: true });
    const membersRow = membersKeySpan.locator('xpath=ancestor::div[contains(@class,"flex") and contains(@class,"items-center")][1]');
    await expect(membersRow).toBeVisible();
    await expect(membersRow.getByText('array', { exact: true })).toBeVisible();
  });
});

test.describe('Form Health Panel — Bug Tests', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DATA_DEFINITION);
  });

  test('response schema tree borders use light-theme token, not dark neutral [BUG-002]', async ({ page }) => {
    const panel = page.locator('[data-testid="output-blueprint"]');
    await expect(panel.getByText('"firstName"', { exact: true })).toBeVisible();

    const edge = panel.locator('.border-l').first();
    const borderLeftColor = await edge.evaluate((el) => window.getComputedStyle(el).borderLeftColor);
    const rgbMatch = borderLeftColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      expect(r).toBeGreaterThan(200);
      expect(g).toBeGreaterThan(200);
      expect(b).toBeGreaterThan(200);
    } else {
      const width = await edge.evaluate((el) => parseFloat(window.getComputedStyle(el).borderLeftWidth));
      expect(width).toBeGreaterThan(0);
    }
  });

  test('option label text has accessible contrast ratio (WCAG 4.5:1) [BUG-054]', async ({ page }) => {
    await page.getByRole('radio', { name: 'Manage' }).click();
    const workspace = page.locator('[data-testid="workspace-Editor"]');
    await workspace.locator('[data-testid="option-set-statusValues"]').click();

    await expect(workspace.locator('tbody tr').first()).toBeVisible();
    await expect(workspace.locator('tbody tr').first().locator('input').nth(1)).toHaveValue('Active');

    const rowColors = await workspace.locator('tbody tr').first().locator('input').nth(1).evaluate((el) => {
      function parseColor(colorStr: string): [number, number, number, number] | null {
        const m = colorStr.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        if (!m) return null;
        return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
      }

      const style = window.getComputedStyle(el);
      const fgColor = style.color;

      let compositeR = 255, compositeG = 255, compositeB = 255;
      let node: Element | null = el;
      const layers: [number, number, number, number][] = [];

      while (node) {
        const bg = window.getComputedStyle(node).backgroundColor;
        const parsed = parseColor(bg);
        if (parsed && parsed[3] > 0) {
          layers.unshift(parsed);
          if (parsed[3] >= 1) { break; }
        }
        node = node.parentElement;
      }

      if (layers.length > 0) {
        for (const [r, g, b, a] of layers) {
          compositeR = Math.round(r * a + compositeR * (1 - a));
          compositeG = Math.round(g * a + compositeG * (1 - a));
          compositeB = Math.round(b * a + compositeB * (1 - a));
        }
      }

      return {
        color: fgColor,
        backgroundColor: `rgb(${compositeR}, ${compositeG}, ${compositeB})`,
      };
    });

    function parseRgb(colorStr: string): [number, number, number] | null {
      const m = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) return null;
      return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    }

    function relativeLuminance(r: number, g: number, b: number): number {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    function contrastRatio(l1: number, l2: number): number {
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const fgRgb = parseRgb(rowColors.color);
    const bgRgb = parseRgb(rowColors.backgroundColor);

    expect(fgRgb).not.toBeNull();
    expect(bgRgb).not.toBeNull();

    const fgLum = relativeLuminance(...fgRgb!);
    const bgLum = relativeLuminance(...bgRgb!);
    const ratio = contrastRatio(fgLum, bgLum);

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
