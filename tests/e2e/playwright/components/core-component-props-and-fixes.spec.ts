import { test, expect } from '@playwright/test';

// ADR-0023 Exception: These tests cover component prop variants (adornments,
// card elevation, alert dismissible, etc.) that have no natural equivalent
// in a real-world business form. They intentionally use inline fixtures.

test.describe('Components: Core Props and Regression Fixes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('formspec-render', { state: 'attached' });
    });

    test('should apply min max and step attributes when rendering NumberInput', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "NumberInput Props Test",
                "items": [
                    { "key": "qty", "type": "field", "dataType": "integer", "label": "Quantity" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "NumberInput", "bind": "qty", "min": 1, "max": 100, "step": 5 }
                    ]
                }
            };
        });

        const input = page.locator('input[type="number"]');
        await expect(input).toHaveAttribute('min', '1');
        await expect(input).toHaveAttribute('max', '100');
        await expect(input).toHaveAttribute('step', '5');
    });

    test('should render placeholder and clear options when Select is configured as clearable', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Select Props Test",
                "items": [
                    {
                        "key": "size",
                        "type": "field",
                        "dataType": "choice",
                        "label": "Size",
                        "options": [
                            { "value": "s", "label": "Small" },
                            { "value": "m", "label": "Medium" },
                            { "value": "l", "label": "Large" }
                        ]
                    }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Select", "bind": "size", "placeholder": "Choose a size", "clearable": true }
                    ]
                }
            };
        });

        const select = page.locator('select');
        // Placeholder option + clear option + 3 real options = 5
        const options = select.locator('option');
        await expect(options).toHaveCount(5);
        // First option is placeholder and disabled
        await expect(options.first()).toHaveText('Choose a size');
        await expect(options.first()).toBeDisabled();
        // Second is clear option
        await expect(options.nth(1)).toHaveText('— Clear —');
    });

    test('should apply min and max date attributes when rendering DatePicker', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "DatePicker Props Test",
                "items": [
                    { "key": "dob", "type": "field", "dataType": "date", "label": "DOB" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "DatePicker", "bind": "dob", "minDate": "1900-01-01", "maxDate": "2025-12-31" }
                    ]
                }
            };
        });

        const input = page.locator('input[type="date"]');
        await expect(input).toHaveAttribute('min', '1900-01-01');
        await expect(input).toHaveAttribute('max', '2025-12-31');
    });

    test('should render prefix and suffix wrappers when TextInput adornments are configured', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "TextInput Prefix/Suffix",
                "items": [
                    { "key": "amount", "type": "field", "dataType": "string", "label": "Amount" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "TextInput", "bind": "amount", "prefix": "$", "suffix": "USD" }
                    ]
                }
            };
        });

        await expect(page.locator('.formspec-prefix')).toHaveText('$');
        await expect(page.locator('.formspec-suffix')).toHaveText('USD');
    });

    test('should render subtitle and elevation styling when Card props are provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Card Props Test",
                "items": [
                    { "key": "x", "type": "field", "dataType": "string", "label": "X" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        {
                            "component": "Card",
                            "title": "Details",
                            "subtitle": "Enter your details",
                            "elevation": 3,
                            "children": [{ "component": "TextInput", "bind": "x" }]
                        }
                    ]
                }
            };
        });

        const card = page.locator('.formspec-card');
        await expect(card.locator('h3')).toHaveText('Details');
        await expect(card.locator('.formspec-card-subtitle')).toHaveText('Enter your details');
        // elevation 3 → box-shadow should be set
        const boxShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
        expect(boxShadow).not.toBe('none');
    });

    test('should remove alert content when the dismissible Alert close button is clicked', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Alert Dismiss Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Alert", "text": "Warning!", "severity": "warning", "dismissible": true }
                    ]
                }
            };
        });

        const alert = page.locator('.formspec-alert');
        await expect(alert).toBeVisible();
        await expect(alert.locator('.formspec-alert-close')).toBeVisible();

        // Click close
        await alert.locator('.formspec-alert-close').click();
        await expect(alert).toHaveCount(0);
    });

    test('should activate the configured default tab when Tabs defaultTab is provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Tabs Props Test",
                "items": [
                    { "key": "a", "type": "field", "dataType": "string", "label": "A" },
                    { "key": "b", "type": "field", "dataType": "string", "label": "B" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Tabs",
                    "tabLabels": ["First", "Second"],
                    "defaultTab": 1,
                    "children": [
                        { "component": "Stack", "children": [{ "component": "TextInput", "bind": "a" }] },
                        { "component": "Stack", "children": [{ "component": "TextInput", "bind": "b" }] }
                    ]
                }
            };
        });

        const panels = page.locator('.formspec-tab-panel');
        // defaultTab=1 means second panel should be visible
        await expect(panels.nth(0)).toBeHidden();
        await expect(panels.nth(1)).toBeVisible();

        // Tab button for second should be active
        const buttons = page.locator('.formspec-tab');
        await expect(buttons.nth(1)).toHaveClass(/active/);
    });

    test('should apply row-gap styling when Grid rowGap is provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Grid Props Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Grid",
                    "columns": 3,
                    "rowGap": "2rem",
                    "children": [
                        { "component": "Text", "text": "A" },
                        { "component": "Text", "text": "B" }
                    ]
                }
            };
        });

        const grid = page.locator('.formspec-grid');
        const rowGap = await grid.evaluate(el => getComputedStyle(el).rowGap);
        expect(rowGap).toBe('32px'); // 2rem = 32px at default font size
    });

    test('should render description text when Page description is provided', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Page Desc Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "title": "Welcome",
                    "description": "Please fill out this form carefully.",
                    "children": []
                }
            };
        });

        await expect(page.locator('.formspec-page-description')).toHaveText('Please fill out this form carefully.');
    });

});
