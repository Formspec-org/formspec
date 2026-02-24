import { test, expect } from '@playwright/test';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';

test.describe('Components: Coverage Gap Closure', () => {
  test('repeatable group bindings resolve per-instance paths across add/remove', async ({ page }) => {
    await gotoHarness(page);

    await mountDefinition(page, {
      $formspec: '1.0',
      url: 'http://example.org/repeat-gap-test',
      version: '1.0.0',
      title: 'Repeat Gap Test',
      items: [
        {
          key: 'items',
          type: 'group',
          label: 'Items',
          repeatable: true,
          minRepeat: 1,
          children: [
            { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
          ],
        },
      ],
    });

    await page.evaluate(() => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.componentDocument = {
        $formspecComponent: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'http://example.org/repeat-gap-test' },
        tree: {
          component: 'Page',
          children: [
            {
              component: 'Stack',
              bind: 'items',
              children: [{ component: 'TextInput', bind: 'name' }],
            },
          ],
        },
      };
    });

    const firstInput = page.locator('input[name="items[0].name"]');
    await expect(firstInput).toBeVisible();
    await firstInput.fill('alpha');

    await page.locator('.formspec-repeat-add').click();
    const secondInput = page.locator('input[name="items[1].name"]');
    await expect(secondInput).toBeVisible();
    await secondInput.fill('beta');

    let response = await submitAndGetResponse<{ data: { items: Array<{ name: string }> } }>(page);
    expect(response.data.items).toEqual([{ name: 'alpha' }, { name: 'beta' }]);

    await page.evaluate(() => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.getEngine().removeRepeatInstance('items', 1);
    });

    await expect(page.locator('input[name="items[0].name"]')).toHaveValue('alpha');
    response = await submitAndGetResponse<{ data: { items: Array<{ name: string }> } }>(page);
    expect(response.data.items).toEqual([{ name: 'alpha' }]);
  });

  test('cross-tier interaction keeps component-tree choice while honoring when visibility', async ({ page }) => {
    await gotoHarness(page);

    await mountDefinition(page, {
      $formspec: '1.0',
      url: 'http://example.org/cross-tier-gap-test',
      version: '1.0.0',
      title: 'Cross Tier Gap Test',
      items: [
        { key: 'gate', type: 'field', dataType: 'boolean', label: 'Enable advanced' },
        {
          key: 'status',
          type: 'field',
          dataType: 'choice',
          label: 'Status',
          options: [
            { value: 'new', label: 'New' },
            { value: 'active', label: 'Active' },
          ],
        },
      ],
    });

    await page.evaluate(() => {
      const renderer: any = document.querySelector('formspec-render');
      renderer.themeDocument = {
        $formspecTheme: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'http://example.org/cross-tier-gap-test' },
        items: {
          status: { widget: 'RadioGroup' },
        },
      };
      renderer.componentDocument = {
        $formspecComponent: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'http://example.org/cross-tier-gap-test' },
        tree: {
          component: 'Page',
          children: [
            { component: 'Toggle', bind: 'gate' },
            { component: 'Select', bind: 'status', when: 'gate == true' },
          ],
        },
      };
    });

    const statusWhenWrapper = page.locator('.formspec-when:has(select[name="status"])');
    await expect(statusWhenWrapper).toHaveClass(/formspec-hidden/);
    await expect(page.locator('input[type="radio"][name="status"]')).toHaveCount(0);

    await page.locator('input[name="gate"]').click();
    await expect(statusWhenWrapper).not.toHaveClass(/formspec-hidden/);
    await expect(page.locator('select[name="status"]')).toBeVisible();
    await expect(page.locator('input[type="radio"][name="status"]')).toHaveCount(0);
  });

  test('core input compatibility matrix emits warnings only for unsupported dataType pairs', async ({ page }) => {
    await gotoHarness(page);

    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('Incompatible component')) {
        warnings.push(msg.text());
      }
    });

    const coreInputComponents = [
      'TextInput',
      'NumberInput',
      'DatePicker',
      'Select',
      'CheckboxGroup',
      'Toggle',
    ];
    const dataTypes = [
      'string',
      'text',
      'decimal',
      'integer',
      'boolean',
      'date',
      'dateTime',
      'time',
      'uri',
      'choice',
      'multiChoice',
      'attachment',
      'money',
    ];

    const compatibility: Record<string, string[]> = {
      string: ['TextInput', 'Select'],
      text: ['TextInput'],
      decimal: ['NumberInput', 'TextInput'],
      integer: ['NumberInput', 'TextInput'],
      boolean: ['Toggle'],
      date: ['DatePicker', 'TextInput'],
      dateTime: ['DatePicker', 'TextInput'],
      time: ['DatePicker', 'TextInput'],
      uri: ['TextInput'],
      choice: ['Select', 'TextInput'],
      multiChoice: ['CheckboxGroup'],
      attachment: ['FileUpload'],
      money: ['NumberInput', 'TextInput'],
    };

    for (const dataType of dataTypes) {
      for (const component of coreInputComponents) {
        const warningCountBefore = warnings.length;

        await page.evaluate(({ component, dataType }) => {
          const renderer: any = document.querySelector('formspec-render');
          renderer.definition = {
            $formspec: '1.0',
            url: 'http://example.org/matrix-gap-test',
            version: '1.0.0',
            title: 'Matrix Gap Test',
            items: [
              {
                key: 'field',
                type: 'field',
                dataType,
                label: 'Field',
                options: [
                  { value: 'a', label: 'A' },
                  { value: 'b', label: 'B' },
                ],
              },
            ],
          };
          renderer.componentDocument = {
            $formspecComponent: '1.0',
            version: '1.0.0',
            targetDefinition: { url: 'http://example.org/matrix-gap-test' },
            tree: {
              component: 'Page',
              children: [{ component, bind: 'field' }],
            },
          };
        }, { component, dataType });

        await expect(page.locator('.formspec-field').first()).toBeVisible();
        await page.waitForTimeout(20);

        const compatible = compatibility[dataType]?.includes(component) ?? false;
        const newWarnings = warnings.slice(warningCountBefore);
        const pairWarning = newWarnings.some((w) =>
          w.includes(`Incompatible component ${component} for dataType ${dataType}.`)
        );
        if (compatible) {
          expect(pairWarning).toBe(false);
        } else {
          expect(pairWarning).toBe(true);
        }
      }
    }
  });
});
