import { test, expect } from '@playwright/test';

test.describe('Formspec Component Layer (Tier 3)', () => {
  test('rendering with basic component tree (Stack, Heading, TextInput)', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    const definition = {
      "$formspec": "1.0",
      "url": "http://example.org/form",
      "version": "1.0.0",
      "status": "active",
      "title": "Component Test",
      "items": [
        { "key": "firstName", "type": "field", "dataType": "string", "label": "First Name" },
        { "key": "lastName", "type": "field", "dataType": "string", "label": "Last Name" }
      ]
    };

    const componentDocument = {
      "$formspecComponent": "1.0",
      "version": "1.0.0",
      "targetDefinition": { "url": "http://example.org/form" },
      "tree": {
        "component": "Stack",
        "direction": "vertical",
        "children": [
          { "component": "Heading", "level": 1, "text": "My Custom Layout" },
          { "component": "TextInput", "bind": "firstName" },
          { "component": "TextInput", "bind": "lastName" }
        ]
      }
    };

    await page.evaluate(({ def, comp }) => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.definition = def;
      renderer.componentDocument = comp;
    }, { def: definition, comp: componentDocument });

    // Verify Heading is rendered
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('My Custom Layout');

    // Verify Inputs are rendered via their binding
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible();
    
    const lastNameInput = page.locator('input[name="lastName"]');
    await expect(lastNameInput).toBeVisible();
  });

  test('rendering with ConditionalGroup and when expressions', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('formspec-render', { state: 'attached' });

    const definition = {
      "$formspec": "1.0",
      "url": "http://example.org/form-conditional",
      "version": "1.0.0",
      "status": "active",
      "title": "Conditional Test",
      "items": [
        { "key": "showDetails", "type": "field", "dataType": "boolean", "label": "Show Details" },
        { "key": "details", "type": "field", "dataType": "string", "label": "Details" }
      ]
    };

    const componentDocument = {
      "$formspecComponent": "1.0",
      "version": "1.0.0",
      "targetDefinition": { "url": "http://example.org/form-conditional" },
      "tree": {
        "component": "Stack",
        "children": [
          { "component": "Toggle", "bind": "showDetails" },
          {
            "component": "Card",
            "title": "Details Section",
            "when": "$showDetails = true",
            "children": [
              { "component": "TextInput", "bind": "details" }
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

    // Card should be hidden initially
    const card = page.locator('.formspec-card');
    await expect(card).toBeHidden();

    // Toggle showDetails
    await page.locator('input[type="checkbox"]').click();

    // Card should be visible now
    await expect(card).toBeVisible();
    await expect(card.locator('h3')).toHaveText('Details Section');
    await expect(page.locator('input[name="details"]')).toBeVisible();
  });

  test('rendering with complex components (DataTable, Summary, Tabs)', async ({ page }) => {
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
