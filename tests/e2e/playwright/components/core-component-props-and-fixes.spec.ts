import { test, expect } from '@playwright/test';

test.describe('Components: Core Props and Regression Fixes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('formspec-render', { state: 'attached' });
    });

    test('should update the bound value when a RadioGroup option is selected', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "RadioGroup Test",
                "items": [
                    {
                        "key": "color",
                        "type": "field",
                        "dataType": "choice",
                        "label": "Color",
                        "options": [
                            { "value": "red", "label": "Red" },
                            { "value": "blue", "label": "Blue" },
                            { "value": "green", "label": "Green" }
                        ]
                    }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "RadioGroup", "bind": "color" }
                    ]
                }
            };
        });

        // Should render radio inputs, not a text input
        const radios = page.locator('input[type="radio"]');
        await expect(radios).toHaveCount(3);

        // Click blue
        await radios.nth(1).click();

        const value = await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            return el.getEngine().signals['color'].value;
        });
        expect(value).toBe('blue');
    });

    test('should navigate between steps when wizard next and previous actions are used', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Wizard Test",
                "items": [
                    { "key": "name", "type": "field", "dataType": "string", "label": "Name" },
                    { "key": "email", "type": "field", "dataType": "string", "label": "Email" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Wizard",
                    "showProgress": true,
                    "children": [
                        {
                            "component": "Page",
                            "title": "Step 1",
                            "children": [{ "component": "TextInput", "bind": "name" }]
                        },
                        {
                            "component": "Page",
                            "title": "Step 2",
                            "children": [{ "component": "TextInput", "bind": "email" }]
                        }
                    ]
                }
            };
        });

        // Progress indicator should be visible
        const progress = page.locator('.formspec-wizard-steps');
        await expect(progress).toBeVisible();

        // Step 1 panel visible, Step 2 hidden
        const panels = page.locator('.formspec-wizard-panel');
        await expect(panels.nth(0)).toBeVisible();
        await expect(panels.nth(1)).toBeHidden();

        // Click Next
        await page.locator('.formspec-wizard-next').click();

        // Step 2 should now be visible
        await expect(panels.nth(0)).toBeHidden();
        await expect(panels.nth(1)).toBeVisible();

        // Click Previous
        await page.locator('.formspec-wizard-prev').click();
        await expect(panels.nth(0)).toBeVisible();
        await expect(panels.nth(1)).toBeHidden();
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

    test('should apply alignment and wrap styles when Stack layout props are set', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Stack Props Test",
                "items": []
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Stack",
                    "direction": "horizontal",
                    "align": "center",
                    "wrap": true,
                    "children": [
                        { "component": "Text", "text": "Hello" }
                    ]
                }
            };
        });

        const stack = page.locator('.formspec-stack');
        const alignItems = await stack.evaluate(el => getComputedStyle(el).alignItems);
        const flexWrap = await stack.evaluate(el => getComputedStyle(el).flexWrap);
        expect(alignItems).toBe('center');
        expect(flexWrap).toBe('wrap');
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

    test('should render row numbers and row controls when DataTable add remove options are enabled', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "DataTable Props Test",
                "items": [
                    {
                        "key": "people",
                        "type": "group",
                        "label": "People",
                        "repeatable": true,
                        "minRepeat": 2,
                        "children": [
                            { "key": "name", "type": "field", "dataType": "string", "label": "Name" }
                        ]
                    }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        {
                            "component": "DataTable",
                            "bind": "people",
                            "showRowNumbers": true,
                            "allowAdd": true,
                            "allowRemove": true,
                            "columns": [{ "header": "Name", "bind": "name" }]
                        }
                    ]
                }
            };
        });

        // Header should have # column and empty column for remove
        const headerCells = page.locator('thead th');
        await expect(headerCells).toHaveCount(3); // #, Name, (remove)

        // Should have 2 rows (minRepeat)
        const rows = page.locator('tbody tr');
        await expect(rows).toHaveCount(2);

        // Row numbers should be present
        await expect(rows.nth(0).locator('.formspec-row-number')).toHaveText('1');
        await expect(rows.nth(1).locator('.formspec-row-number')).toHaveText('2');

        // Add row button
        const addBtn = page.locator('.formspec-datatable-add');
        await expect(addBtn).toBeVisible();
        await addBtn.click();
        await expect(page.locator('tbody tr')).toHaveCount(3);

        // Remove row button
        const removeBtn = page.locator('.formspec-datatable-remove').first();
        await expect(removeBtn).toBeVisible();
    });

    test('should allow editing DataTable cells and update calculated totals when row controls are enabled', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "DataTable Editable Test",
                "items": [
                    {
                        "key": "lineItems",
                        "type": "group",
                        "label": "Line Items",
                        "repeatable": true,
                        "minRepeat": 1,
                        "children": [
                            { "key": "lineQty", "type": "field", "dataType": "integer", "label": "Qty" },
                            { "key": "linePrice", "type": "field", "dataType": "decimal", "label": "Price" },
                            { "key": "lineSubtotal", "type": "field", "dataType": "decimal", "label": "Subtotal" }
                        ]
                    },
                    { "key": "grandTotal", "type": "field", "dataType": "decimal", "label": "Grand Total" }
                ],
                "binds": [
                    { "path": "lineItems.lineSubtotal", "calculate": "lineQty * linePrice", "readonly": "true" },
                    { "path": "grandTotal", "calculate": "sum(lineItems.lineSubtotal)", "readonly": "true" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        {
                            "component": "DataTable",
                            "bind": "lineItems",
                            "showRowNumbers": true,
                            "allowAdd": true,
                            "allowRemove": true,
                            "columns": [
                                { "header": "Qty", "bind": "lineQty" },
                                { "header": "Price", "bind": "linePrice" },
                                { "header": "Subtotal", "bind": "lineSubtotal" }
                            ]
                        },
                        { "component": "NumberInput", "bind": "grandTotal" }
                    ]
                }
            };
        });

        await page.fill('input[name="lineItems[0].lineQty"]', '2');
        await page.fill('input[name="lineItems[0].linePrice"]', '100');

        await page.locator('.formspec-datatable-add').click();
        await page.fill('input[name="lineItems[1].lineQty"]', '1');
        await page.fill('input[name="lineItems[1].linePrice"]', '50');

        await expect(page.locator('input[name="lineItems[0].lineSubtotal"]')).toBeDisabled();
        await expect(page.locator('input[name="lineItems[1].lineSubtotal"]')).toBeDisabled();
        await expect(page.locator('input[name="grandTotal"]')).toHaveValue('250');
    });

    test('should swap on and off labels when Toggle state changes', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Toggle Labels Test",
                "items": [
                    { "key": "active", "type": "field", "dataType": "boolean", "label": "Active" }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "Toggle", "bind": "active", "onLabel": "Active", "offLabel": "Inactive" }
                    ]
                }
            };
        });

        const toggleLabel = page.locator('.formspec-toggle-label');
        await expect(toggleLabel).toHaveText('Inactive');

        // Click the checkbox
        await page.locator('.formspec-toggle input[type="checkbox"]').click();
        await expect(toggleLabel).toHaveText('Active');
    });

    test('should render multi-column layout and select-all control when CheckboxGroup props are enabled', async ({ page }) => {
        await page.evaluate(() => {
            const el = document.querySelector('formspec-render') as any;
            el.definition = {
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "CheckboxGroup Props Test",
                "items": [
                    {
                        "key": "fruits",
                        "type": "field",
                        "dataType": "multiChoice",
                        "label": "Fruits",
                        "options": [
                            { "value": "apple", "label": "Apple" },
                            { "value": "banana", "label": "Banana" },
                            { "value": "cherry", "label": "Cherry" },
                            { "value": "date", "label": "Date" }
                        ]
                    }
                ]
            };
            el.componentDocument = {
                "$formspecComponent": "1.0",
                "tree": {
                    "component": "Page",
                    "children": [
                        { "component": "CheckboxGroup", "bind": "fruits", "columns": 2, "selectAll": true }
                    ]
                }
            };
        });

        const group = page.locator('.formspec-checkbox-group');
        // columns=2 → should have grid display
        const display = await group.evaluate(el => getComputedStyle(el).display);
        expect(display).toBe('grid');
        // Computed gridTemplateColumns resolves 1fr to px values — just check there are 2 columns
        const gridCols = await group.evaluate(el => getComputedStyle(el).gridTemplateColumns);
        const colCount = gridCols.split(' ').length;
        expect(colCount).toBe(2);

        // selectAll checkbox should exist (first checkbox in the group)
        const allCheckboxes = group.locator('input[type="checkbox"]');
        // 1 selectAll + 4 options = 5
        await expect(allCheckboxes).toHaveCount(5);
    });

    test('should shift remaining row values when removeRepeatInstance deletes a middle row', async ({ page }) => {
        const result = await page.evaluate(() => {
            const FormEngine = (window as any).FormEngine;
            const engine = new FormEngine({
                "$formspec": "1.0",
                "url": "http://example.org/test",
                "version": "1.0.0",
                "title": "Remove Instance Test",
                "items": [
                    {
                        "key": "items",
                        "type": "group",
                        "label": "Items",
                        "repeatable": true,
                        "minRepeat": 3,
                        "children": [
                            { "key": "name", "type": "field", "dataType": "string", "label": "Name" }
                        ]
                    }
                ]
            });

            engine.setValue('items[0].name', 'A');
            engine.setValue('items[1].name', 'B');
            engine.setValue('items[2].name', 'C');

            const before = {
                count: engine.repeats['items'].value,
                v0: engine.signals['items[0].name'].value,
                v1: engine.signals['items[1].name'].value,
                v2: engine.signals['items[2].name'].value
            };

            // Remove middle item (index 1)
            engine.removeRepeatInstance('items', 1);

            const after = {
                count: engine.repeats['items'].value,
                v0: engine.signals['items[0].name'].value,
                v1: engine.signals['items[1].name'].value
            };

            return { before, after };
        });

        expect(result.before.count).toBe(3);
        expect(result.before.v0).toBe('A');
        expect(result.before.v1).toBe('B');
        expect(result.before.v2).toBe('C');

        expect(result.after.count).toBe(2);
        expect(result.after.v0).toBe('A');
        expect(result.after.v1).toBe('C'); // B was removed, C shifted down
    });
});
