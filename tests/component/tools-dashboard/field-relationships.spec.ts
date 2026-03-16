import { test, expect } from '@playwright/test';

const TOOLS_URL = 'http://localhost:8082/tools.html';

const MOCK_DEPS = {
  'lineItemTotal': {
    depends_on: ['unitCost', 'quantity'],
    expression: '$unitCost * $quantity',
  },
  'projectedEndDate': {
    depends_on: ['startDate', 'duration'],
    expression: "dateAdd($startDate, $duration, 'months')",
  },
  'displayName': {
    depends_on: ['orgName'],
    expression: 'upper($orgName)',
  },
};

test.describe('Field Relationships Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/dependencies**', (route) =>
      route.fulfill({ json: MOCK_DEPS })
    );
    await page.goto(TOOLS_URL);
    await page.locator('.tools-tab[data-tab="dependencies"]').click();
  });

  test('loads dependency graph with SVG nodes', async ({ page }) => {
    // Wait for d3 to render nodes (may take a moment for CDN load)
    // 8 unique fields: lineItemTotal, unitCost, quantity, projectedEndDate, startDate, duration, displayName, orgName
    await expect(page.locator('#deps-svg .graph-node')).toHaveCount(8, { timeout: 10000 });
  });

  test('graph has correct number of edges', async ({ page }) => {
    // Wait for nodes first — proves d3 loaded and simulation is ticking
    await expect(page.locator('#deps-svg .graph-node')).toHaveCount(8, { timeout: 10000 });
    // lineItemTotal has 2 deps, projectedEndDate has 2, displayName has 1 = 5 edges
    await expect(page.locator('#deps-svg .edge')).toHaveCount(5, { timeout: 10000 });
  });

  test('clicking a node shows detail panel', async ({ page }) => {
    // Wait for nodes to render
    await expect(page.locator('#deps-svg .graph-node')).toHaveCount(8, { timeout: 10000 });

    // Click the first graph node
    await page.locator('#deps-svg .graph-node').first().click({ force: true });

    // Detail panel should show
    await expect(page.locator('#deps-detail-content')).toBeVisible();
    await expect(page.locator('#deps-detail-field')).not.toBeEmpty();
  });

  test('detail panel shows placeholder before clicking', async ({ page }) => {
    await expect(page.locator('#deps-placeholder')).toBeVisible();
    await expect(page.locator('#deps-placeholder')).toContainText('Click a node');
  });
});
