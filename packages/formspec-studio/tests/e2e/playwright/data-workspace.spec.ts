import { test, expect } from '@playwright/test';
import { waitForApp, switchTab, importDefinition } from './helpers';

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

/** Definition with a repeatable group (members) to test bug #33 */
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

test.describe('Data Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DATA_DEFINITION);
    await switchTab(page, 'Data');
  });

  test('response schema table shows fields with types', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // ResponseSchema renders a table with Key, Type, Label columns
    // It uses flatItems to show all items including nested ones
    await expect(workspace.getByText('firstName', { exact: true })).toBeVisible();
    // Multiple string-type fields exist; verify at least one type cell shows "string"
    await expect(workspace.getByRole('cell', { name: 'string' }).first()).toBeVisible();
    await expect(workspace.getByText('street', { exact: true })).toBeVisible();
    await expect(workspace.getByText('city', { exact: true })).toBeVisible();
  });

  test('data sources section shows instances', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // Click "Sources" filter button
    await workspace.getByRole('button', { name: 'Sources' }).click();
    // Should show the instance name and source
    await expect(workspace.getByText('countries', { exact: true })).toBeVisible();
    await expect(workspace.getByText('https://api.example.com/countries', { exact: true })).toBeVisible();
  });

  test('option sets section shows option set names and values', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // Click "Tables" filter button (covers Lookup Tables / Option Sets)
    await workspace.getByRole('button', { name: 'Tables' }).click();
    // Should show option set name
    await expect(workspace.getByText('statusValues')).toBeVisible();
    // Should show option labels
    await expect(workspace.getByText('Active', { exact: true })).toBeVisible();
    await expect(workspace.getByText('Inactive', { exact: true })).toBeVisible();
    await expect(workspace.getByText('Pending', { exact: true })).toBeVisible();
    // Should show usage count
    await expect(workspace.getByText(/Used by 1 field/)).toBeVisible();
  });
});

test.describe('Data Workspace — Bug Tests', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await importDefinition(page, DATA_DEFINITION);
    await switchTab(page, 'Data');
  });

  // BUG #2: Dark borders in light shell
  // ResponseSchema uses border-neutral-700 and border-neutral-800 (dark Tailwind colors)
  // in a light-mode shell. The correct token for light-mode borders is border-border
  // (mapped to --color-border: #e2e8f0 in index.css).
  // RED: The computed border color will be a dark neutral (~#374151 or #1f2937)
  // instead of the expected light theme border (#e2e8f0).
  test('response schema table borders use light-theme token, not dark neutral [BUG-002]', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // Wait for the table to be visible
    await expect(workspace.getByRole('table')).toBeVisible();

    // Get the computed border color of the first data row
    // border-neutral-700 in Tailwind v3/v4 resolves to approximately #374151
    // The correct light-mode border token resolves to #e2e8f0
    const borderColor = await workspace.locator('tbody tr').first().evaluate((el) => {
      return window.getComputedStyle(el).borderBottomColor;
    });

    // Parse the RGB components. Light border #e2e8f0 has high RGB values (>200).
    // Dark neutral-700 (#374151) has low RGB values (<80).
    // We assert the border is NOT dark (i.e., not a dark neutral color).
    const rgbMatch = borderColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(rgbMatch).not.toBeNull();
    const [, r, g, b] = rgbMatch!.map(Number);
    // All three channels should be high (light color) for a correct light-mode border.
    // BUG: border-neutral-800 gives ~rgb(31,41,55) where r,g,b are all <60.
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });

  // BUG #2 (continued): DataSources and OptionSets also use border-neutral-700
  test('data sources card borders use light-theme token, not dark neutral [BUG-002]', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    // Navigate to the Sources section via the "Sources" filter button
    await workspace.getByRole('button', { name: 'Sources' }).click();

    // The card wrapping the instance uses border-neutral-700
    const card = workspace.locator('.border').first();
    await expect(card).toBeVisible();

    const borderColor = await card.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });

    const rgbMatch = borderColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(rgbMatch).not.toBeNull();
    const [, r, g, b] = rgbMatch!.map(Number);
    // BUG: border-neutral-700 resolves to ~rgb(55,65,81) — all channels below 100.
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });

  // BUG #33: Repeatable groups show "object" instead of "array" in Response Schema.
  // ResponseSchema.tsx line: item.type === 'group' ? 'object' : (item.dataType || item.type)
  // A repeatable group (repeatable: true) should display "array" not "object".
  // RED: The current implementation does not check item.repeatable — it always
  // shows "object" for any group, including repeatable ones.
  test('repeatable group shows "array" type in Response Schema, not "object" [BUG-033]', async ({ page }) => {
    // Re-seed with a definition that has a repeatable group
    await importDefinition(page, REPEATABLE_DEFINITION);

    const workspace = page.locator('[data-testid="workspace-Data"]');
    // Wait for the table to be visible (Response Schema is default tab)
    await expect(workspace.getByRole('table')).toBeVisible();
    await expect(workspace.getByText('members', { exact: true })).toBeVisible();

    // Find the type cell for the "members" row
    // The members group is repeatable, so it should show "array"
    const membersRow = workspace.locator('tbody tr').filter({ hasText: 'members' });
    await expect(membersRow).toBeVisible();

    // BUG: Currently shows "object" — should show "array" for repeatable groups
    await expect(membersRow.getByRole('cell', { name: 'array' })).toBeVisible();
  });

  test('empty data sources state stays informational without a fake creation button', async ({ page }) => {
    // Seed with a definition that has no instances
    await importDefinition(page, {
      $formspec: '1.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
    });

    const workspace = page.locator('[data-testid="workspace-Data"]');
    await workspace.getByRole('button', { name: 'Sources' }).click();

    await expect(workspace.getByText('No data sources defined.')).toBeVisible();
    await expect(workspace.getByRole('button', { name: /add data source/i })).toHaveCount(0);
  });

  test('Simulation section shows an explicit not-yet-implemented state without fake controls', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    await workspace.getByRole('button', { name: 'Simulation' }).click();

    await expect(workspace.getByText('Test Response is not yet implemented.')).toBeVisible();
    await expect(
      workspace.getByRole('button', { name: /run test|generate response|validate response/i })
    ).toHaveCount(0);
  });

  test('option set cards are informational panels, not misleading buttons', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    await workspace.getByRole('button', { name: 'Tables' }).click();

    await expect(workspace.getByText('statusValues')).toBeVisible();

    const optionSetCard = workspace.locator('[data-testid="option-set-statusValues"]');
    await expect(optionSetCard).toBeVisible();
    await expect(workspace.getByRole('button', { name: /statusValues/i })).toHaveCount(0);
  });

  // BUG #54: Option chips in OptionSets use bg-neutral-800 (dark background)
  // in a light-mode shell, creating insufficient contrast for text.
  // WCAG 4.5:1 contrast ratio is required for normal text.
  // bg-neutral-800 is approximately #1f2937 (very dark gray).
  // In a light shell, the chip text color is either the browser default (dark)
  // or text-muted (#64748b) — both would be unreadable on a dark background.
  // RED: The contrast ratio between chip text and chip background will fail WCAG 4.5:1.
  test('option chips have accessible contrast ratio (WCAG 4.5:1) [BUG-054]', async ({ page }) => {
    const workspace = page.locator('[data-testid="workspace-Data"]');
    await workspace.getByRole('button', { name: 'Tables' }).click();

    // Wait for chips to be visible
    await expect(workspace.getByText('Active', { exact: true })).toBeVisible();

    // Get the computed colors of the first option chip
    const chipColors = await workspace.getByText('Active', { exact: true }).evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    // Helper: parse rgb() string to [r, g, b]
    function parseRgb(colorStr: string): [number, number, number] | null {
      const m = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) return null;
      return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    }

    // Helper: compute relative luminance per WCAG 2.1
    function relativeLuminance(r: number, g: number, b: number): number {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    }

    // Helper: compute contrast ratio between two luminances
    function contrastRatio(l1: number, l2: number): number {
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const fgRgb = parseRgb(chipColors.color);
    const bgRgb = parseRgb(chipColors.backgroundColor);

    expect(fgRgb).not.toBeNull();
    expect(bgRgb).not.toBeNull();

    const fgLum = relativeLuminance(...fgRgb!);
    const bgLum = relativeLuminance(...bgRgb!);
    const ratio = contrastRatio(fgLum, bgLum);

    // WCAG AA requires 4.5:1 for normal text.
    // BUG: bg-neutral-800 (#1f2937 ≈ rgb(31,41,55)) is a very dark background.
    // If the text color is also dark (e.g., text-ink #0f172a = rgb(15,23,42)),
    // the contrast ratio dark-on-dark will be very low (< 2:1).
    // Even with light text, the chip is styled without explicit text-white,
    // so the contrast may fail.
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
