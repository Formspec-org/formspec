// ADR-0023 Exception: The compatibility-matrix test at the bottom of this file requires a
// synthetic fixture (all 13 dataType × 6 component permutations). No real-world form
// naturally exercises every incompatible pair, so it is kept as an inline fixture.
import { test, expect } from '@playwright/test';
import { gotoHarness } from '../helpers/harness';

test.describe('Components: Coverage Gap Closure', () => {
  // ADR-0023 Exception: This test requires a synthetic fixture because it exercises all
  // 13 dataType × 6 component permutations — a non-business scenario not representable
  // in a real-world application.
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
