// ADR-0023 Exception: Tests platform-level a11y attribute plumbing and custom component
// recursive detection — framework concerns not representable in a real-world business form.
import { test, expect } from '@playwright/test';

test.describe('Components: Accessibility, Responsive Overrides, and Custom Components', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('formspec-render', { state: 'attached' });
    });

    test('should set aria-required, aria-invalid, and aria-readonly attributes when rendering required and readonly inputs', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "A11y Test",
                "items": [
                    { "key": "name", "type": "field", "dataType": "string", "label": "Name" },
                    { "key": "email", "type": "field", "dataType": "string", "label": "Email" }
                ],
                "binds": [
                    { "path": "name", "required": true },
                    { "path": "email", "readonly": true }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "TextInput", "bind": "name" },
                        { "component": "TextInput", "bind": "email" }
                    ]
                }
            };
        });

        const nameInput = page.locator('#field-name');
        const emailInput = page.locator('#field-email');

        // name is required
        await expect(nameInput).toHaveAttribute('aria-required', 'true');
        // email is readonly
        await expect(emailInput).toHaveAttribute('aria-readonly', 'true');
        // name starts empty but untouched -> aria-invalid is false (errors hidden until interaction)
        await expect(nameInput).toHaveAttribute('aria-invalid', 'false');

        // Click into name, then blur without filling -> now touched and invalid
        await nameInput.click();
        await emailInput.click(); // blur name by focusing another field
        await expect(nameInput).toHaveAttribute('aria-invalid', 'true');

        // Fill name -> aria-invalid should become false
        await nameInput.fill('John');
        await expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    });

    test('should link label and description attributes correctly when rendering hinted inputs', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "A11y Describedby Test",
                "items": [
                    { "key": "age", "type": "field", "dataType": "integer", "label": "Age", "hint": "Enter your age" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "NumberInput", "bind": "age" }
                    ]
                }
            };
        });

        const label = page.locator('label[for="field-age"]');
        await expect(label).toBeVisible();

        const input = page.locator('#field-age');
        const describedBy = await input.getAttribute('aria-describedby');
        expect(describedBy).toContain('field-age-hint');
        expect(describedBy).toContain('field-age-error');

        // Hint element exists
        const hint = page.locator('#field-age-hint');
        await expect(hint).toHaveText('Enter your age');
    });

    test('should set role and live-region semantics when rendering validation errors', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Error A11y Test",
                "items": [
                    { "key": "x", "type": "field", "dataType": "string", "label": "X" }
                ],
                "binds": [{ "path": "x", "required": true }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [{ "component": "TextInput", "bind": "x" }]
                }
            };
        });

        const errorEl = page.locator('#field-x-error');
        await expect(errorEl).toHaveAttribute('role', 'alert');
        await expect(errorEl).toHaveAttribute('aria-live', 'polite');
    });

    test('should apply role and aria-description attributes when accessibility metadata is provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "A11y Block Test",
                "items": [
                    { "key": "search", "type": "field", "dataType": "string", "label": "Search" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        {
                            "component": "TextInput",
                            "bind": "search",
                            "accessibility": {
                                "role": "search",
                                "description": "Search for items"
                            }
                        }
                    ]
                }
            };
        });

        const field = page.locator('.formspec-field');
        await expect(field).toHaveAttribute('role', 'search');
        await expect(field).toHaveAttribute('aria-description', 'Search for items');
    });

    test('should expand custom component templates when parameter values are provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Custom Component Test",
                "items": [
                    { "key": "firstName", "type": "field", "dataType": "string", "label": "First Name" },
                    { "key": "lastName", "type": "field", "dataType": "string", "label": "Last Name" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "components": {
                    "LabeledInput": {
                        "tree": {
                            "component": "Stack",
                            "children": [
                                { "component": "Heading", "text": "{title}", "level": 4 },
                                { "component": "TextInput", "bind": "{field}" }
                            ]
                        }
                    }
                },
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "LabeledInput", "title": "Your First Name", "field": "firstName" },
                        { "component": "LabeledInput", "title": "Your Last Name", "field": "lastName" }
                    ]
                }
            };
        });

        // Custom components should be expanded: 2 headings and 2 inputs
        const headings = page.locator('h4');
        await expect(headings).toHaveCount(2);
        await expect(headings.first()).toHaveText('Your First Name');
        await expect(headings.nth(1)).toHaveText('Your Last Name');

        const inputs = page.locator('input[type="text"]');
        await expect(inputs).toHaveCount(2);

        // Should bind correctly
        await inputs.first().fill('John');
        const value = await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            return el.getEngine().signals['firstName'].value;
        });
        expect(value).toBe('John');
    });

    test('should warn and prevent recursive expansion when a custom component references itself', async ({ page }) => {
        const logs: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'warning') logs.push(msg.text());
        });

        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Recursive Custom Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "components": {
                    "Recursive": {
                        "tree": {
                            "component": "Recursive"
                        }
                    }
                },
                "tree": {
                    "component": "Recursive"
                }
            };
        });

        // Should warn about recursive component
        expect(logs.some(l => l.includes('Recursive custom component detected'))).toBe(true);
    });

    test('should merge responsive props when the active viewport breakpoint changes', async ({ page }) => {
        // Set viewport to a wide size first
        await page.setViewportSize({ width: 1200, height: 800 });

        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Responsive Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "breakpoints": {
                    "mobile": "(max-width: 600px)",
                    "tablet": "(max-width: 900px)",
                    "desktop": "(min-width: 901px)"
                },
                "tree": {
                    "component": "Grid",
                    "columns": 4,
                    "responsive": {
                        "mobile": { "columns": 1 },
                        "tablet": { "columns": 2 }
                    },
                    "children": [
                        { "component": "Text", "text": "A" },
                        { "component": "Text", "text": "B" },
                        { "component": "Text", "text": "C" },
                        { "component": "Text", "text": "D" }
                    ]
                }
            };
        });

        // At 1200px width, desktop breakpoint -> should use base columns=4
        const grid = page.locator('.formspec-grid').first();
        let colCount = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(colCount).toBe(4);

        // Resize to tablet
        await page.setViewportSize({ width: 800, height: 800 });
        await page.waitForTimeout(200); // wait for matchMedia to fire

        colCount = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(colCount).toBe(2);
    });
});
