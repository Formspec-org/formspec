// ADR-0023 Exception: Tests Modal, Popover, Signature, Rating, Slider, Accordion, and
// ProgressBar display/interactive components that have no natural home in a grant application.
import { test, expect } from '@playwright/test';

test.describe('Components: Progressive Component Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('formspec-render', { state: 'attached' });
    });

    test('should render unlabeled and labeled dividers when Divider components are configured', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Divider Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "Divider" },
                        { "component": "Divider", "label": "Section Break" }
                    ]
                }
            };
        });

        const dividers = page.locator('.formspec-divider');
        await expect(dividers).toHaveCount(2);
        // Second divider has label
        await expect(dividers.nth(1).locator('.formspec-divider-label')).toHaveText('Section Break');
    });

    test('should render collapsible content as open when defaultOpen is true', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Collapsible Test",
                "items": [{ "key": "x", "type": "field", "dataType": "string", "label": "X" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        {
                            "component": "Collapsible",
                            "title": "More Details",
                            "defaultOpen": true,
                            "children": [{ "component": "TextInput", "bind": "x" }]
                        }
                    ]
                }
            };
        });

        const details = page.locator('.formspec-collapsible');
        await expect(details).toHaveCount(1);
        // Should be open by default
        await expect(details).toHaveAttribute('open', '');
        await expect(details.locator('summary')).toHaveText('More Details');
        // Content should contain the text input
        await expect(details.locator('.formspec-collapsible-content input')).toHaveCount(1);
    });

    test('should render a grid with the configured column count when using Columns', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Columns Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Columns",
                    "columnCount": 3,
                    "children": [
                        { "component": "Text", "text": "A" },
                        { "component": "Text", "text": "B" },
                        { "component": "Text", "text": "C" }
                    ]
                }
            };
        });

        const columns = page.locator('.formspec-columns');
        const display = await columns.evaluate(el => getComputedStyle(el).display);
        expect(display).toBe('grid');
        const colCount = await columns.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(colCount).toBe(3);
    });

    test('should render panel chrome and title when Panel content is mounted', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Panel Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Panel",
                    "title": "Important Info",
                    "children": [{ "component": "Text", "text": "Panel content" }]
                }
            };
        });

        const panel = page.locator('.formspec-panel');
        await expect(panel.locator('.formspec-panel-header')).toHaveText('Important Info');
        await expect(panel.locator('.formspec-panel-body')).toContainText('Panel content');
    });

    test('should open only the default section when Accordion is initialized', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Accordion Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Accordion",
                    "labels": ["Section 1", "Section 2", "Section 3"],
                    "defaultOpen": 0,
                    "children": [
                        { "component": "Text", "text": "Content 1" },
                        { "component": "Text", "text": "Content 2" },
                        { "component": "Text", "text": "Content 3" }
                    ]
                }
            };
        });

        const items = page.locator('.formspec-accordion-item');
        await expect(items).toHaveCount(3);
        // First should be open by default
        await expect(items.nth(0)).toHaveAttribute('open', '');
        await expect(items.nth(0).locator('summary')).toHaveText('Section 1');
    });

    test('should open and close modal content when trigger and close controls are used', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Modal Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        {
                            "component": "Modal",
                            "triggerLabel": "Open Modal",
                            "size": "small",
                            "children": [{ "component": "Text", "text": "Modal content" }]
                        }
                    ]
                }
            };
        });

        const trigger = page.locator('.formspec-modal-trigger');
        await expect(trigger).toHaveText('Open Modal');

        // Open modal
        await trigger.click();
        const dialog = page.locator('.formspec-modal');
        await expect(dialog).toBeVisible();

        // Close via close button
        await dialog.locator('.formspec-modal-close').click();
        await expect(dialog).not.toBeVisible();
    });

    test('should render popover content and support triggerBind-driven label updates', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Popover Test",
                "items": [{ "key": "name", "type": "field", "dataType": "string", "label": "Name" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "TextInput", "bind": "name" },
                        {
                            "component": "Popover",
                            "triggerBind": "name",
                            "triggerLabel": "Open Details",
                            "placement": "right",
                            "children": [{ "component": "Text", "text": "Popover content" }]
                        }
                    ]
                }
            };
        });

        const nameInput = page.locator('input[name="name"]');
        await nameInput.fill('Alice');

        const trigger = page.locator('.formspec-popover-trigger');
        await expect(trigger).toHaveText('Alice');
        await trigger.click();

        const popover = page.locator('.formspec-popover-content');
        await expect(popover).toContainText('Popover content');
        await expect(popover).toBeVisible();
    });

    test('should update the bound numeric value when Slider input changes', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Slider Test",
                "items": [{ "key": "vol", "type": "field", "dataType": "integer", "label": "Volume" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Slider", "bind": "vol", "min": 0, "max": 100, "step": 5, "showValue": true }
                    ]
                }
            };
        });

        const slider = page.locator('.formspec-slider input[type="range"]');
        await expect(slider).toHaveAttribute('min', '0');
        await expect(slider).toHaveAttribute('max', '100');
        await expect(slider).toHaveAttribute('step', '5');

        // Set value and check display
        await slider.fill('75');
        const value = await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            return el.getEngine().signals['vol'].value;
        });
        expect(value).toBe(75);

        await expect(page.locator('.formspec-slider-value')).toHaveText('75');
    });

    test('should set rating value and star styling when a star is clicked', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Rating Test",
                "items": [{ "key": "score", "type": "field", "dataType": "integer", "label": "Score" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Rating", "bind": "score", "max": 5 }
                    ]
                }
            };
        });

        const stars = page.locator('.formspec-rating-star');
        await expect(stars).toHaveCount(5);

        // Click 3rd star
        await stars.nth(2).click();
        const value = await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            return el.getEngine().signals['score'].value;
        });
        expect(value).toBe(3);

        // First 3 stars should be selected, last 2 should be unselected
        await expect(stars.nth(2)).toHaveClass(/formspec-rating-star--selected/);
        await expect(stars.nth(3)).not.toHaveClass(/formspec-rating-star--selected/);
    });

    test('should render drop zone and accept filters when FileUpload dragDrop and accept are configured', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "FileUpload Test",
                "items": [{ "key": "doc", "type": "field", "dataType": "attachment", "label": "Document" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "FileUpload", "bind": "doc", "accept": ".pdf,.doc", "dragDrop": true }
                    ]
                }
            };
        });

        // Drop zone should be visible
        const dropZone = page.locator('.formspec-drop-zone');
        await expect(dropZone).toBeVisible();
        await expect(dropZone).toContainText('Drop files here');

        // Hidden file input should have accept attribute
        const fileInput = page.locator('.formspec-file-upload input[type="file"]');
        await expect(fileInput).toHaveAttribute('accept', '.pdf,.doc');
    });

    test('should render signature canvas and clear control when Signature is mounted', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "Signature Test",
                "items": [{ "key": "sig", "type": "field", "dataType": "attachment", "label": "Signature" }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Signature", "bind": "sig", "height": 150, "strokeColor": "#0000ff" }
                    ]
                }
            };
        });

        const canvas = page.locator('.formspec-signature-canvas');
        await expect(canvas).toBeVisible();
        await expect(canvas).toHaveAttribute('height', '150');

        const clearBtn = page.locator('.formspec-signature-clear');
        await expect(clearBtn).toHaveText('Clear');
    });

    test('should render progress value and percentage text when ProgressBar showPercent is enabled', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "ProgressBar Test", "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "ProgressBar", "value": 65, "max": 100, "showPercent": true }
                    ]
                }
            };
        });

        const progress = page.locator('.formspec-progress-bar progress');
        await expect(progress).toHaveAttribute('max', '100');
        await expect(progress).toHaveJSProperty('value', 65);

        const percent = page.locator('.formspec-progress-percent');
        await expect(percent).toHaveText('65%');
    });

    test('should update ProgressBar percentage when its bound field value changes', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0", "url": "http://example.org/test",
                "version": "1.0.0", "title": "ProgressBar Bind Test",
                "items": [{ "key": "progress", "type": "field", "dataType": "integer", "label": "Progress", "initialValue": 25 }]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "ProgressBar", "bind": "progress", "max": 100, "showPercent": true }
                    ]
                }
            };
        });

        const percent = page.locator('.formspec-progress-percent');
        await expect(percent).toHaveText('25%');

        // Update value via engine
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.getEngine().setValue('progress', 75);
        });
        await expect(percent).toHaveText('75%');
    });
});
