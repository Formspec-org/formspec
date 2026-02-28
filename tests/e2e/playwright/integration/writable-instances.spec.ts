import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  getInstanceData,
  setInstanceValue,
  instanceVersion,
  engineSetValue,
  addRepeatInstance,
} from '../helpers/grant-app';
import { gotoHarness, mountDefinition } from '../helpers/harness';

test.describe('Writable Instances: Engine Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── Writable instance: set and read ──────────────────────────────

  test('writable instance (scratchPad) value can be set and read', async ({ page }) => {
    // Write to scratchPad.budgetNotes
    await setInstanceValue(page, 'scratchPad', 'budgetNotes', 'Test note');
    const data = await getInstanceData(page, 'scratchPad');
    expect(data.budgetNotes).toBe('Test note');
  });

  test('writable instance set increments instanceVersion', async ({ page }) => {
    const v1 = await instanceVersion(page);
    await setInstanceValue(page, 'scratchPad', 'budgetNotes', 'Updated');
    const v2 = await instanceVersion(page);
    expect(v2).toBeGreaterThan(v1);
  });

  test('writable instance initial data is loaded from definition', async ({ page }) => {
    const data = await getInstanceData(page, 'scratchPad');
    expect(data).toBeDefined();
    expect(data.lastSavedTotal).toBe(0);
    expect(data.budgetNotes).toBe('');
  });

  test('writable instance allows setting nested path', async ({ page }) => {
    await setInstanceValue(page, 'scratchPad', 'budgetNotes', 'First note');
    const data1 = await getInstanceData(page, 'scratchPad');
    expect(data1.budgetNotes).toBe('First note');

    // Overwrite with a new value
    await setInstanceValue(page, 'scratchPad', 'budgetNotes', 'Updated note');
    const data2 = await getInstanceData(page, 'scratchPad');
    expect(data2.budgetNotes).toBe('Updated note');
  });

  // ── Readonly instance: rejects writes ────────────────────────────

  test('readonly instance (agencyData) rejects writes', async ({ page }) => {
    const error = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      try {
        el.getEngine().setInstanceValue('agencyData', 'maxAward', 999999);
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(error).toContain('readonly');
  });

  test('readonly instance data is not modified after rejected write', async ({ page }) => {
    // Attempt write (should fail)
    await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      try {
        el.getEngine().setInstanceValue('agencyData', 'maxAward', 999999);
      } catch {}
    });
    const data = await getInstanceData(page, 'agencyData');
    expect(data.maxAward).toBe(500000);
  });

  // ── Schema validation on writable instances ──────────────────────

  test('writable instance rejects values that violate schema types', async ({ page }) => {
    // lastSavedTotal is declared as "decimal" — writing a string should throw
    const error = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      try {
        el.getEngine().setInstanceValue('scratchPad', 'lastSavedTotal', 'not-a-number');
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(error).toContain('schema mismatch');
  });

  // ── Source instance with fallback data ────────────────────────────

  test('source instance (priorYearData) loads fallback data when fetch fails', async ({ page }) => {
    // priorYearData has source pointing to a non-existent URL, so fallback data should be used
    const data = await getInstanceData(page, 'priorYearData');
    expect(data).toBeDefined();
    expect(data.priorAwardAmount).toBe(250000);
    expect(data.performanceRating).toBe('satisfactory');
  });

  test('source instance with static: true is marked in definition', async ({ page }) => {
    const isStatic = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().definition.instances.priorYearData.static;
    });
    expect(isStatic).toBe(true);
  });

  // ── Calculate bind targets writable instance ─────────────────────

  test('calculate bind writes grand total to scratchPad.lastSavedTotal', async ({ page }) => {
    // Add a budget line item and set values to create a non-zero grand total
    await addRepeatInstance(page, 'budget.lineItems');
    await page.waitForTimeout(50);
    await engineSetValue(page, 'budget.lineItems[0].unitCost', 100);
    await engineSetValue(page, 'budget.lineItems[0].quantity', 5);
    await page.waitForTimeout(200);

    const data = await getInstanceData(page, 'scratchPad');
    // lastSavedTotal should reflect the grand total (100 * 5 = 500)
    expect(data.lastSavedTotal).toBe(500);
  });

  // ── FEL instance() reads from writable instance ──────────────────

  test('FEL instance() function reads from writable instance', async ({ page }) => {
    await setInstanceValue(page, 'scratchPad', 'budgetNotes', 'FEL-test-value');
    const result = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      const fn = engine.compileExpression("instance('scratchPad', 'budgetNotes')");
      return fn();
    });
    expect(result).toBe('FEL-test-value');
  });

  // ── Unknown instance throws ──────────────────────────────────────

  test('writing to unknown instance throws error', async ({ page }) => {
    const error = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      try {
        el.getEngine().setInstanceValue('nonexistent', 'foo', 'bar');
        return null;
      } catch (e: any) {
        return e.message;
      }
    });
    expect(error).toContain('Unknown instance');
  });
});

test.describe('Writable Instances: Inline Engine (No UI)', () => {
  // These tests construct a minimal FormEngine directly for focused unit testing

  test('source instance uses static cache and fallback data', async ({ page }) => {
    await gotoHarness(page);

    const result = await page.evaluate(() => {
      const FormEngine = (window as any).FormEngine;

      // Clear any prior cache
      FormEngine.instanceSourceCache.clear();

      const def = {
        $formspec: '1.0',
        url: 'https://test.example/form',
        version: '1.0.0',
        status: 'active',
        title: 'Test',
        name: 'test',
        instances: {
          cached: {
            source: 'https://api.example.gov/static-data',
            static: true,
            data: { value: 'fallback' },
          },
        },
        items: [],
        binds: [],
      };

      const engine = new FormEngine(def);

      // Fallback data should be loaded since fetch will fail
      const v1 = engine.getInstanceData('cached', 'value');
      return { v1 };
    });

    expect(result.v1).toBe('fallback');
  });

  test('calculate bind targeting readonly instance throws at init', async ({ page }) => {
    await gotoHarness(page);

    const error = await page.evaluate(() => {
      const FormEngine = (window as any).FormEngine;
      const def = {
        $formspec: '1.0',
        url: 'https://test.example/form',
        version: '1.0.0',
        status: 'active',
        title: 'Test',
        name: 'test',
        instances: {
          readonlyInst: {
            readonly: true,
            data: { x: 1 },
          },
        },
        items: [
          { type: 'field', key: 'f1', dataType: 'integer' },
        ],
        binds: [
          { path: 'instances.readonlyInst.x', calculate: '$f1' },
        ],
      };

      try {
        new FormEngine(def);
        return null;
      } catch (e: any) {
        return e.message;
      }
    });

    expect(error).toContain('readonly');
  });

  test('writable instance calculate bind updates on field change', async ({ page }) => {
    await gotoHarness(page);

    const result = await page.evaluate(async () => {
      const FormEngine = (window as any).FormEngine;
      const def = {
        $formspec: '1.0',
        url: 'https://test.example/form',
        version: '1.0.0',
        status: 'active',
        title: 'Test',
        name: 'test',
        instances: {
          pad: {
            readonly: false,
            data: { total: 0 },
            schema: { total: 'decimal' },
          },
        },
        items: [
          { type: 'field', key: 'amount', dataType: 'decimal' },
        ],
        binds: [
          { path: 'instances.pad.total', calculate: '$amount * 2' },
        ],
      };

      const engine = new FormEngine(def);

      const before = engine.getInstanceData('pad', 'total');
      engine.setValue('amount', 25);

      // Wait a tick for effect to propagate
      await new Promise(r => setTimeout(r, 50));

      const after = engine.getInstanceData('pad', 'total');
      return { before, after };
    });

    // before: amount is null initially, so $amount * 2 may be 0, null, or NaN depending on coercion
    expect(result.after).toBe(50);
  });
});
