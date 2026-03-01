import { test, expect } from '@playwright/test';

// ADR-0023 Exception: These tests cover component prop variants (card elevation,
// alert dismissible, grid rowGap) that require getComputedStyle or click interactions
// not replicable in happy-dom.

test.describe('Components: Core Props and Regression Fixes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('formspec-render', { state: 'attached' });
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

});
