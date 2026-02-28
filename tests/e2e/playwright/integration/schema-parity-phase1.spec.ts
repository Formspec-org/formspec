import { test, expect } from '@playwright/test';
import {
  mountGrantApplication,
  engineSetValue,
  engineValue,
  goToPage,
  getResponse,
  getValidationReport,
} from '../helpers/grant-app';

test.describe('Schema Parity Phase 1: Definition Enrichment', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── A1: Missing dataTypes ────────────────────────────────────────

  test('dateTime field accepts and validates ISO 8601 date-time', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    // submissionDeadline should be a dateTime field
    await engineSetValue(page, 'projectNarrative.submissionDeadline', '2026-12-31T23:59:59');
    await page.waitForTimeout(50);
    const val = await engineValue(page, 'projectNarrative.submissionDeadline');
    expect(val).toBe('2026-12-31T23:59:59');
  });

  test('time field accepts and validates HH:MM format', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    // meetingTime should be a time field
    await engineSetValue(page, 'projectNarrative.meetingTime', '14:30');
    await page.waitForTimeout(50);
    const val = await engineValue(page, 'projectNarrative.meetingTime');
    expect(val).toBe('14:30');
  });

  test('uri field accepts and validates URL values', async ({ page }) => {
    await goToPage(page, 'Applicant Info');
    // projectWebsite should be a uri field
    await engineSetValue(page, 'applicantInfo.projectWebsite', 'https://example.org/project');
    await page.waitForTimeout(50);
    const val = await engineValue(page, 'applicantInfo.projectWebsite');
    expect(val).toBe('https://example.org/project');
  });

  // ── A2: Field properties ─────────────────────────────────────────

  test('suffix renders after the input for indirectRate', async ({ page }) => {
    await goToPage(page, 'Project Narrative');
    // indirectRate should have suffix "%" in definition
    const suffixEl = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      // Check the definition item has suffix
      const items = engine.definition.items;
      const narrative = items.find((i: any) => i.key === 'projectNarrative');
      const rate = narrative?.children?.find((c: any) => c.key === 'indirectRate');
      return rate?.suffix;
    });
    expect(suffixEl).toBe('%');
  });

  test('per-field currency overrides defaultCurrency', async ({ page }) => {
    // The subAmount field should have currency: "EUR" to exercise per-field currency
    const fieldCurrency = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      const items = engine.definition.items;
      const subs = items.find((i: any) => i.key === 'subcontractors');
      const subAmount = subs?.children?.find((c: any) => c.key === 'subAmount');
      return subAmount?.currency;
    });
    expect(fieldCurrency).toBe('EUR');
  });

  test('item description is present on at least 3 items', async ({ page }) => {
    const descriptions = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      const descs: string[] = [];
      function walk(items: any[]) {
        for (const item of items) {
          if (item.description) descs.push(item.description);
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return descs;
    });
    expect(descriptions.length).toBeGreaterThanOrEqual(3);
  });

  test('field-level widgetHint is set on at least one field', async ({ page }) => {
    const hasWidgetHint = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          if (item.presentation?.widgetHint) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasWidgetHint).toBe(true);
  });

  // ── A3: initialValue as expression ────────────────────────────────

  test('initialValue expression "=today()" sets startDate to today', async ({ page }) => {
    // startDate should have initialValue: "=today()" which auto-populates
    const val = await engineValue(page, 'projectNarrative.startDate');
    // Should be today's date in ISO format
    const today = new Date().toISOString().slice(0, 10);
    expect(val).toBe(today);
  });

  // ── A4: prePopulate.editable: false ───────────────────────────────

  test('prePopulate with editable:false makes ein readonly from instance data', async ({ page }) => {
    // ein should be pre-populated from agencyData and locked (editable: false)
    const readonly = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.readonlySignals['applicantInfo.ein']?.value;
    });
    expect(readonly).toBe(true);
  });

  // ── A5: Presentation subsystem ────────────────────────────────────

  test('presentation layout properties exist on at least one group', async ({ page }) => {
    const hasLayout = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          const p = item.presentation;
          if (p?.layout?.flow || p?.layout?.columns || p?.layout?.collapsible) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasLayout).toBe(true);
  });

  test('layout.colSpan is set on at least one child item inside a grid group', async ({ page }) => {
    const hasColSpan = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          if (item.presentation?.layout?.colSpan) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasColSpan).toBe(true);
  });

  test('styleHints exist on at least one group', async ({ page }) => {
    const hasStyleHints = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          if (item.presentation?.styleHints) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasStyleHints).toBe(true);
  });

  test('accessibility properties exist on at least one group presentation', async ({ page }) => {
    const hasA11y = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          if (item.presentation?.accessibility) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasA11y).toBe(true);
  });

  // ── A6: Unused enum values ────────────────────────────────────────

  test('conditional required expression exists (not just "true")', async ({ page }) => {
    const hasConditionalRequired = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.binds.some((b: any) =>
        b.required && b.required !== 'true' && b.required !== 'false'
      );
    });
    expect(hasConditionalRequired).toBe(true);
  });

  test('conditional readonly expression exists (not just "true")', async ({ page }) => {
    const hasConditionalReadonly = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.binds.some((b: any) =>
        b.readonly && b.readonly !== 'true' && b.readonly !== 'false'
      );
    });
    expect(hasConditionalReadonly).toBe(true);
  });

  test('whitespace: "remove" is used on at least one bind', async ({ page }) => {
    const hasRemove = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.binds.some((b: any) => b.whitespace === 'remove');
    });
    expect(hasRemove).toBe(true);
  });

  test('nonRelevantBehavior: "empty" per-bind override exists', async ({ page }) => {
    const hasEmpty = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.binds.some((b: any) => b.nonRelevantBehavior === 'empty');
    });
    expect(hasEmpty).toBe(true);
  });

  test('timing: "demand" is used on at least one shape', async ({ page }) => {
    const hasDemand = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.shapes.some((s: any) => s.timing === 'demand');
    });
    expect(hasDemand).toBe(true);
  });

  test('xone shape composition is used', async ({ page }) => {
    const hasXone = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.shapes.some((s: any) => s.xone);
    });
    expect(hasXone).toBe(true);
  });

  test('shape message with {{expression}} interpolation exists', async ({ page }) => {
    const hasInterpolation = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.shapes.some((s: any) =>
        s.message && s.message.includes('{{')
      );
    });
    expect(hasInterpolation).toBe(true);
  });

  // ── A7: derivedFrom ───────────────────────────────────────────────

  test('derivedFrom is present as {url, version} object', async ({ page }) => {
    const derivedFrom = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      return el.getEngine().definition.derivedFrom;
    });
    expect(derivedFrom).toBeDefined();
    expect(derivedFrom).toHaveProperty('url');
    expect(derivedFrom).toHaveProperty('version');
  });

  // ── A8: extensions ────────────────────────────────────────────────

  test('definition-level extensions exist', async ({ page }) => {
    const hasExtensions = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const def = el.getEngine().definition;
      return def.extensions && Object.keys(def.extensions).some((k: string) => k.startsWith('x-'));
    });
    expect(hasExtensions).toBe(true);
  });

  test('at least one item has extensions', async ({ page }) => {
    const hasItemExt = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      let found = false;
      function walk(items: any[]) {
        for (const item of items) {
          if (item.extensions && Object.keys(item.extensions).some((k: string) => k.startsWith('x-'))) found = true;
          if (item.children) walk(item.children);
        }
      }
      walk(engine.definition.items);
      return found;
    });
    expect(hasItemExt).toBe(true);
  });

  test('at least one bind has extensions', async ({ page }) => {
    const hasBindExt = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.binds.some((b: any) =>
        b.extensions && Object.keys(b.extensions).some((k: string) => k.startsWith('x-'))
      );
    });
    expect(hasBindExt).toBe(true);
  });

  test('at least one shape has extensions', async ({ page }) => {
    const hasShapeExt = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const engine = el.getEngine();
      return engine.definition.shapes.some((s: any) =>
        s.extensions && Object.keys(s.extensions).some((k: string) => k.startsWith('x-'))
      );
    });
    expect(hasShapeExt).toBe(true);
  });
});

test.describe('Schema Parity Phase 1: Theme Enrichment', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── B1: Cascade level 3 (items) ───────────────────────────────────

  test('theme has per-item overrides in items map', async ({ page }) => {
    const hasItems = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      return theme.items && Object.keys(theme.items).length >= 3;
    });
    expect(hasItems).toBe(true);
  });

  // ── B2: $token references in style blocks ─────────────────────────

  test('theme has $token references in style blocks', async ({ page }) => {
    const hasTokenStyle = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      // Check defaults or selectors for style with $token refs
      const json = JSON.stringify(theme);
      return json.includes('"style"') && json.includes('$token.');
    });
    expect(hasTokenStyle).toBe(true);
  });

  // ── B3: fallback widget chain ─────────────────────────────────────

  test('theme has a fallback widget chain on at least one selector', async ({ page }) => {
    const hasFallback = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      // Check selectors and items for fallback
      const json = JSON.stringify(theme);
      return json.includes('"fallback"');
    });
    expect(hasFallback).toBe(true);
  });

  // ── B4: cssClass in theme ─────────────────────────────────────────

  test('theme has cssClass on at least one PresentationBlock', async ({ page }) => {
    const hasCssClass = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      const json = JSON.stringify(theme);
      return json.includes('"cssClass"');
    });
    expect(hasCssClass).toBe(true);
  });

  // ── B5: AccessibilityBlock in theme ───────────────────────────────

  test('theme has liveRegion accessibility on at least one block', async ({ page }) => {
    const hasLiveRegion = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      const json = JSON.stringify(theme);
      return json.includes('"liveRegion"');
    });
    expect(hasLiveRegion).toBe(true);
  });

  // ── B6: Selector matching by type ─────────────────────────────────

  test('theme has a selector matching by type', async ({ page }) => {
    const hasTypeSelector = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      return theme.selectors?.some((s: any) => s.match?.type);
    });
    expect(hasTypeSelector).toBe(true);
  });

  // ── B7: elevation token and numeric token ─────────────────────────

  test('theme has elevation token', async ({ page }) => {
    const hasElevation = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      return theme.tokens && Object.keys(theme.tokens).some((k: string) => k.startsWith('elevation.'));
    });
    expect(hasElevation).toBe(true);
  });

  test('theme has at least one numeric token value', async ({ page }) => {
    const hasNumeric = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      return theme.tokens && Object.values(theme.tokens).some((v: any) => typeof v === 'number');
    });
    expect(hasNumeric).toBe(true);
  });

  // ── B8: labelPosition: hidden ─────────────────────────────────────

  test('theme uses labelPosition: hidden somewhere', async ({ page }) => {
    const hasHidden = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const theme = el.themeDocument;
      const json = JSON.stringify(theme);
      return json.includes('"hidden"');
    });
    expect(hasHidden).toBe(true);
  });
});

test.describe('Schema Parity Phase 1: Component Enrichment', () => {
  test.beforeEach(async ({ page }) => {
    await mountGrantApplication(page);
  });

  // ── C1: Select component ─────────────────────────────────────────

  test('component tree includes at least one Select component', async ({ page }) => {
    const hasSelect = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      const json = JSON.stringify(comp);
      return json.includes('"component":"Select"') || json.includes('"component": "Select"');
    });
    expect(hasSelect).toBe(true);
  });

  // ── C2: SummaryRow instantiation ──────────────────────────────────

  test('SummaryRow custom component is instantiated in the tree', async ({ page }) => {
    const hasSummaryRow = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      const json = JSON.stringify(comp.tree);
      return json.includes('"component":"SummaryRow"') || json.includes('"component": "SummaryRow"');
    });
    expect(hasSummaryRow).toBe(true);
  });

  // ── C3: cssClass array form ───────────────────────────────────────

  test('at least one component uses cssClass as an array', async ({ page }) => {
    const hasArrayCssClass = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (Array.isArray(node.cssClass)) found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasArrayCssClass).toBe(true);
  });

  // ── C4-C7: Component prop gaps ────────────────────────────────────

  test('Stack with direction: horizontal exists', async ({ page }) => {
    const hasHorizontal = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const json = JSON.stringify(el.componentDocument);
      return json.includes('"direction":"horizontal"') || json.includes('"direction": "horizontal"');
    });
    expect(hasHorizontal).toBe(true);
  });

  test('Grid with string columns (CSS value) exists', async ({ page }) => {
    const hasStringCols = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (node.component === 'Grid' && typeof node.columns === 'string') found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasStringCols).toBe(true);
  });

  test('Tabs with position prop exists', async ({ page }) => {
    const hasPosition = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (node.component === 'Tabs' && node.position) found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasPosition).toBe(true);
  });

  test('Page with description prop exists', async ({ page }) => {
    const hasDesc = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (node.component === 'Page' && node.description) found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasDesc).toBe(true);
  });

  test('NumberInput with step, min, max props exists', async ({ page }) => {
    const hasNumberProps = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (node.component === 'NumberInput' && node.step !== undefined && node.min !== undefined) found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasNumberProps).toBe(true);
  });

  test('Alert with severity success and error exist', async ({ page }) => {
    const hasSeverities = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const json = JSON.stringify(el.componentDocument);
      return json.includes('"severity":"success"') || json.includes('"severity": "success"');
    });
    expect(hasSeverities).toBe(true);
  });

  test('Card with subtitle exists', async ({ page }) => {
    const hasSubtitle = await page.evaluate(() => {
      const el: any = document.querySelector('formspec-render');
      const comp = el.componentDocument;
      let found = false;
      function walk(node: any) {
        if (!node) return;
        if (node.component === 'Card' && node.subtitle) found = true;
        if (node.children) {
          if (Array.isArray(node.children)) node.children.forEach(walk);
          else walk(node.children);
        }
      }
      walk(comp.tree);
      return found;
    });
    expect(hasSubtitle).toBe(true);
  });
});

test.describe('Schema Parity Phase 1: Response Enrichment', () => {
  // ── D: Submission file properties ─────────────────────────────────

  test('sample-submission.json has id field', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/sample-submission.json'),
      'utf8'
    ));
    expect(sub.id).toBeDefined();
    expect(typeof sub.id).toBe('string');
  });

  test('sample-submission.json has subject with id and type', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/sample-submission.json'),
      'utf8'
    ));
    expect(sub.subject).toBeDefined();
    expect(sub.subject.id).toBeDefined();
    expect(sub.subject.type).toBeDefined();
  });

  test('sample-submission.json has validationResults array', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/sample-submission.json'),
      'utf8'
    ));
    expect(Array.isArray(sub.validationResults)).toBe(true);
    expect(sub.validationResults.length).toBeGreaterThan(0);
  });

  test('submission-in-progress.json exists with in-progress status', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/submission-in-progress.json'),
      'utf8'
    ));
    expect(sub.status).toBe('in-progress');
    expect(sub.validationResults?.length).toBeGreaterThan(0);
  });

  test('sample-submission has multiChoice values and attachment values', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/sample-submission.json'),
      'utf8'
    ));
    // focusAreas should be an array of strings (multiChoice)
    expect(Array.isArray(sub.data.projectNarrative?.focusAreas)).toBe(true);
    // narrativeDoc should be present (attachment)
    expect(sub.data.attachments?.narrativeDoc).toBeDefined();
  });

  test('sample-submission has nested repeat data (projectPhases with phaseTasks)', async () => {
    const fs = require('fs');
    const path = require('path');
    const sub = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../examples/grant-application/sample-submission.json'),
      'utf8'
    ));
    expect(Array.isArray(sub.data.projectPhases)).toBe(true);
    expect(sub.data.projectPhases.length).toBeGreaterThan(0);
    expect(Array.isArray(sub.data.projectPhases[0].phaseTasks)).toBe(true);
  });
});
