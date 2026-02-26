// ADR-0023 Exception (test 3 only): DataTable+Summary tab-sync requires a Tabs component,
// which is absent from the grant application (Wizard is used instead). Tests 1-2 use
// the real grant application; test 3 is kept as an inline synthetic fixture.
import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  goToPage,
} from '../helpers/grant-app';

test.describe('Components: Component Tree Rendering', () => {
  test('should render bound TextInput components on the grant application first wizard page', async ({ page }) => {
    await mountGrantApplication(page);

    // Wizard renders the active page title as an h2 heading
    const heading = page.locator('.formspec-wizard-panel:not(.formspec-hidden) h2').first();
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Applicant Info');

    // Bound TextInputs are visible on page 1 without any navigation
    await expect(page.locator('input[name="applicantInfo.orgName"]')).toBeVisible();
    await expect(page.locator('input[name="applicantInfo.contactEmail"]')).toBeVisible();
  });

  test('should show and hide ConditionalGroup content when its when-expression changes', async ({ page }) => {
    await mountGrantApplication(page);

    // The Subcontractors page has ConditionalGroup with when: "$budget.usesSubcontractors"
    await goToPage(page, 'Subcontractors');

    // Default: usesSubcontractors is null/false — conditional content is hidden
    const activePanel = page.locator('.formspec-wizard-panel:not(.formspec-hidden)');
    const wrapper = activePanel.locator('.formspec-when').first();
    await expect(wrapper).toHaveClass(/formspec-hidden/);

    // Enable subcontractors via engine
    await engineSetValue(page, 'budget.usesSubcontractors', true);
    await page.waitForTimeout(50);

    // Content should now be visible
    await expect(wrapper).not.toHaveClass(/formspec-hidden/);
  });

  // ADR-0023 Exception: DataTable+Summary tab-sync requires a Tabs component. The grant
  // application uses Wizard navigation; adding a Tabs page would distort the UX model.
  test('should keep DataTable and Summary synchronized when switching between tabs', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    const definition = {
      "$formspec": "1.0",
      "url": "http://example.org/form-complex",
      "version": "1.0.0",
      "status": "active",
      "title": "Complex Test",
      "items": [
        { "key": "projectName", "type": "field", "dataType": "string", "label": "Project Name" },
        {
          "key": "lineItems",
          "type": "group",
          "repeatable": true,
          "label": "Line Items",
          "children": [
            { "key": "desc", "type": "field", "dataType": "string", "label": "Description" },
            { "key": "amount", "type": "field", "dataType": "number", "label": "Amount" }
          ]
        }
      ]
    };

    const componentDocument = {
      "$formspecComponent": "1.0",
      "version": "1.0.0",
      "targetDefinition": { "url": "http://example.org/form-complex" },
      "tree": {
        "component": "Tabs",
        "tabLabels": ["Input", "Review"],
        "children": [
          {
            "component": "Stack",
            "children": [
              { "component": "TextInput", "bind": "projectName" },
              {
                "component": "DataTable",
                "bind": "lineItems",
                "columns": [
                  { "header": "Description", "bind": "desc" },
                  { "header": "Amount", "bind": "amount" }
                ]
              }
            ]
          },
          {
            "component": "Summary",
            "items": [
              { "label": "Project Name", "bind": "projectName" }
            ]
          }
        ]
      }
    };

    await page.evaluate(({ def, comp }) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = def;
      renderer.componentDocument = comp;
    }, { def: definition, comp: componentDocument });

    // Verify Tab 1 is active
    await expect(page.locator('input[name="projectName"]')).toBeVisible();

    // Set values for the first (default) line item via engine
    await page.evaluate(() => {
        const renderer: any = document.querySelector('formspec-render');
        renderer.getEngine().setValue('lineItems[0].desc', 'Item 1');
        renderer.getEngine().setValue('lineItems[0].amount', 100);
    });

    // Verify DataTable has one row
    const table = page.locator('table');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody td').first()).toHaveText('Item 1');

    // Switch to Tab 2 (Review)
    await page.locator('button', { hasText: 'Review' }).click();

    // Verify Summary has Project Name
    const summary = page.locator('.formspec-summary');
    await expect(summary).toBeVisible();
    await expect(summary.locator('dt')).toHaveText('Project Name');

    // Update Project Name in Tab 1 (though hidden, engine signal should update)
    await page.evaluate(() => {
        const renderer: any = document.querySelector('formspec-render');
        renderer.getEngine().setValue('projectName', 'New Project');
    });

    // Summary should update
    await expect(summary.locator('dd')).toHaveText('New Project');
  });
});
