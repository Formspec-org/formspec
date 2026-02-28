// ADR-0023 Exception: This suite requires a synthetic fixture because it covers
// TypeScript ↔ Python FEL parity (requires a deterministic event trace and known
// Python evaluator output snapshots), screener routing, and form assembly — none
// of which are representable through the grant application.
// Portable conformance checks (engine identity, validation report shape, response
// contract, non-relevant behaviour) live in grant-app-conformance.spec.ts instead.
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { gotoHarness, mountDefinition, submitAndGetResponse } from '../helpers/harness';
import { ConformanceRecorder } from '../helpers/conformance';

type ParityCase = {
  id: string;
  expression: string;
  comparator: 'exact' | 'normalized' | 'tolerant-decimal';
  fields: Array<{ key: string; dataType?: string; value: unknown }>;
};

type ParityResult = { id: string; ok: boolean; value?: unknown; error?: string };

const FIXTURE_DIR = path.resolve(__dirname, '../../fixtures/kitchen-sink-holistic');
const DEFINITION_V1 = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'definition.v1.json'), 'utf8'));
const THEME = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'theme.json'), 'utf8'));
const COMPONENT = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'component.json'), 'utf8'));
const PARITY_CASES = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'parity-cases.json'), 'utf8')).cases as ParityCase[];
const PLAYWRIGHT_REPORT = '/tmp/formspec-kitchen-sink-playwright-report.json';

function normalizeDefinitionForEngine(definition: any): any {
  const normalized = JSON.parse(JSON.stringify(definition));
  if (normalized.optionSets && typeof normalized.optionSets === 'object') {
    for (const [key, value] of Object.entries(normalized.optionSets as Record<string, any>)) {
      if (value && typeof value === 'object' && Array.isArray((value as any).options)) {
        normalized.optionSets[key] = (value as any).options;
      }
    }
  }
  return normalized;
}

const DEFINITION_V1_RUNTIME = normalizeDefinitionForEngine(DEFINITION_V1);

async function runCheck(
  recorder: ConformanceRecorder,
  opts: {
    checkId: string;
    phase: string;
    matrixSections: string[];
    ksIds: string[];
    detail: string;
  },
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
    recorder.pass(opts.checkId, opts.phase, opts.matrixSections, opts.ksIds, opts.detail);
  } catch (error) {
    recorder.fail(opts.checkId, opts.phase, opts.matrixSections, opts.ksIds, opts.detail, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function canonicalizeResponse(response: any): any {
  const clone = JSON.parse(JSON.stringify(response));
  delete clone.authored;
  if (Array.isArray(clone.validationResults)) {
    clone.validationResults.sort((a: any, b: any) => {
      const ap = `${a.path}|${a.code}|${a.severity}`;
      const bp = `${b.path}|${b.code}|${b.severity}`;
      return ap.localeCompare(bp);
    });
  }
  return clone;
}

function compareParity(
  comparator: ParityCase['comparator'],
  tsValue: unknown,
  pyValue: unknown
): { ok: boolean; detail: string } {
  if (comparator === 'tolerant-decimal') {
    const tsNum = typeof tsValue === 'number' ? tsValue : Number(tsValue);
    const pyNum = typeof pyValue === 'number' ? pyValue : Number(pyValue);
    if (Number.isFinite(tsNum) && Number.isFinite(pyNum)) {
      const diff = Math.abs(tsNum - pyNum);
      return { ok: diff <= 1e-9, detail: `diff=${diff}` };
    }
    return {
      ok: JSON.stringify(tsValue) === JSON.stringify(pyValue),
      detail: 'fallback-json-compare',
    };
  }

  if (comparator === 'normalized') {
    const tsNorm = JSON.stringify(tsValue);
    const pyNorm = JSON.stringify(pyValue);
    return { ok: tsNorm === pyNorm, detail: 'normalized-json-compare' };
  }

  return {
    ok: JSON.stringify(tsValue) === JSON.stringify(pyValue),
    detail: 'exact-json-compare',
  };
}

test.describe('Integration: Kitchen Sink Holistic Conformance', () => {
  test('should execute ADR-0021 browser phases and parity replay', async ({ page }) => {
    test.setTimeout(120000);
    const recorder = new ConformanceRecorder();

    await page.addInitScript(() => {
      const fixed = new Date('2026-02-24T12:00:00.000Z').valueOf();
      const RealDate = Date;
      class MockDate extends RealDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixed);
          } else {
            super(...args);
          }
        }
        static now() {
          return fixed;
        }
      }
      // @ts-ignore
      window.Date = MockDate;
    });

    try {
      await gotoHarness(page);
      await mountDefinition(page, DEFINITION_V1_RUNTIME);
      // Skip the screener to go directly to the main form for conformance checks
      await page.evaluate(() => {
        const renderer: any = document.querySelector('formspec-render');
        renderer.skipScreener();
      });
      await page.evaluate((themeDoc) => {
        const renderer: any = document.querySelector('formspec-render');
        renderer.themeDocument = themeDoc;
      }, THEME);

      await runCheck(
        recorder,
        {
          checkId: 'P2-IDENTITY-PINNING',
          phase: 'phase_2',
          matrixSections: ['1.1', '2'],
          ksIds: ['KS-001'],
          detail: 'Engine exposes pinned definition identity',
        },
        async () => {
          const identity = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            const engine = renderer.getEngine();
            const def = engine.getDefinition();
            return { url: def.url, version: def.version };
          });
          expect(identity.url).toBe('https://example.org/forms/kitchen-sink-holistic');
          expect(identity.version).toBe('1.0.0');
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P2-INITIAL-HYDRATION',
          phase: 'phase_2',
          matrixSections: ['1.4'],
          ksIds: ['KS-002'],
          detail: 'Initial values hydrate into rendered inputs',
        },
        async () => {
          await expect(page.locator('input[name="fullName"]')).toHaveValue('  Alice Example  ');
          await expect(page.locator('input[name="budget"]')).toHaveValue('0');
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P2-DATA-ENTRY-MIXED-TYPES',
          phase: 'phase_2',
          matrixSections: ['1.4', '4.5'],
          ksIds: ['KS-005', 'KS-006', 'KS-007', 'KS-008', 'KS-009', 'KS-011', 'KS-012'],
          detail: 'User can fill mixed field types and trigger MIP transitions',
        },
        async () => {
          await page.fill('input[name="fullName"]', '  Shelley Agent  ');
          await page.fill('input[name="notes"]', 'alpha    beta    gamma');

          await page.fill('input[name="website"]', 'http://invalid.example');

          await page.selectOption('select[name="profileMode"]', 'advanced');
          await expect(page.locator('select[name="contactMethod"]')).toBeVisible();
          await page.selectOption('select[name="contactMethod"]', 'sms');

          await page.locator('input[name="tags"][value="priority"]').check();
          await page.locator('input[name="tags"][value="followup"]').check();

          await page.fill('input[name="startDate"]', '2026-01-01');
          await page.fill('input[name="endDate"]', '2026-01-15');
          await page.fill('input[name="visitTime"]', '09:30');
          await page.fill('input[name="visitDateTime"]', '2026-01-16T10:00');

          await page.fill('input[name="budget"]', '300');

          await page.fill('input[name="lineItems[0].lineName"]', 'Laptop');
          await page.fill('input[name="lineItems[0].lineQty"]', '2');
          await page.fill('input[name="lineItems[0].linePrice"]', '100');

          await page.locator('button.formspec-repeat-add').first().click();
          await page.fill('input[name="lineItems[1].lineName"]', 'Monitor');
          await page.fill('input[name="lineItems[1].lineQty"]', '1');
          await page.fill('input[name="lineItems[1].linePrice"]', '50');

          await page.locator('input[name="vipEnabled"]').check();
          await expect(page.locator('input[name="vipCode"]')).toHaveValue('AUTO-VIP');
          await page.fill('input[name="vipCode"]', 'VIP-007');

          await page.fill('input[name="salary__amount"]', '1234.56');
          await page.fill('input[name="salary__currency"]', 'USD');

          await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            renderer.getEngine().setValue('upload', {
              url: 'https://example.org/files/doc.pdf',
              contentType: 'application/pdf',
              size: 2048,
            });
          });

          await page.fill('input[name="website"]', 'https://valid.example');

          await expect(page.locator('input[name="grandTotal"]')).toHaveValue('250');
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P3-SHAPE-AND-BIND-VALIDATION',
          phase: 'phase_3',
          matrixSections: ['1.5', '1.6', '3', '4.5'],
          ksIds: ['KS-028', 'KS-029', 'KS-030', 'KS-032'],
          detail: 'Validation report contains bind + shape severities and timing behavior',
        },
        async () => {
          const report = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            const engine = renderer.getEngine();
            return {
              continuous: engine.getValidationReport({ mode: 'continuous' }),
              submit: engine.getValidationReport({ mode: 'submit' }),
              demand: engine.evaluateShape('demand_name_present'),
            };
          });

          expect(report.continuous.counts.warning).toBeGreaterThanOrEqual(1);
          expect(report.continuous.counts.info).toBeGreaterThanOrEqual(1);
          expect(report.continuous.results.some((r: any) => r.constraintKind === 'shape')).toBeTruthy();
          expect(report.submit.results.some((r: any) => r.message.includes('Grand total must be positive'))).toBeFalsy();
          expect(Array.isArray(report.demand)).toBeTruthy();
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P3-NONRELEVANT-BEHAVIORS',
          phase: 'phase_3',
          matrixSections: ['1.5', '2'],
          ksIds: ['KS-034', 'KS-035', 'KS-036'],
          detail: 'Non-relevant behavior remove/keep/empty is reflected in response data',
        },
        async () => {
          await page.selectOption('select[name="profileMode"]', 'basic');

          const snapshot = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            return renderer.getEngine().getResponse({ mode: 'submit' }).data;
          });

          expect(snapshot.contactMethod).toBeUndefined();
          expect(snapshot.tags).toBeDefined();
          expect(snapshot.hiddenMirror).toBeNull();
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P4-RESPONSE-AND-REPORT-CONTRACT',
          phase: 'phase_4',
          matrixSections: ['2', '3'],
          ksIds: ['KS-047', 'KS-048', 'KS-049', 'KS-050', 'KS-051', 'KS-070', 'KS-071'],
          detail: 'Submit emits response contract with expected lifecycle and validation semantics',
        },
        async () => {
          await page.selectOption('select[name="profileMode"]', 'advanced');
          const response = await submitAndGetResponse<any>(page);

          expect(response.definitionUrl).toBe('https://example.org/forms/kitchen-sink-holistic');
          expect(response.definitionVersion).toBe('1.0.0');
          expect(['completed', 'in-progress']).toContain(response.status);
          expect(response.data.fullName).toBe('Shelley Agent');
          expect(response.data.notes).toBe('alpha beta gamma');
          expect(response.data.salary).toEqual({ amount: 1234.56, currency: 'USD' });
          expect(response.data.upload).toEqual({
            url: 'https://example.org/files/doc.pdf',
            contentType: 'application/pdf',
            size: 2048,
          });
          expect(response.data.lineItems).toHaveLength(2);
          expect(response.data.grandTotal).toBe(250);

          const errorCount = response.validationResults.filter((r: any) => r.severity === 'error').length;
          if (response.status === 'completed') {
            expect(errorCount).toBe(0);
          } else {
            expect(errorCount).toBeGreaterThan(0);
          }
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P2-SCREENER-AND-ASSEMBLY',
          phase: 'phase_2',
          matrixSections: ['1.3', '1.9'],
          ksIds: ['KS-067', 'KS-068'],
          detail: 'Screener routing and modular assembly behaviors are available in engine utilities',
        },
        async () => {
          const result = await page.evaluate(() => {
            const { FormEngine, assembleDefinitionSync } = window as any;

            const def: any = {
              $formspec: '1.0',
              url: 'https://example.org/forms/screener',
              version: '1.0.0',
              status: 'active',
              title: 'Screener',
              items: [
                { key: 'triageScore', type: 'field', dataType: 'integer', label: 'Score' },
              ],
              screener: {
                items: [
                  { key: 'triageScore', type: 'field', dataType: 'integer', label: 'Score' },
                ],
                routes: [
                  { condition: 'triageScore >= 50', target: 'https://example.org/forms/high' },
                  { condition: 'true', target: 'https://example.org/forms/low' },
                ],
              },
            };

            const screenerEngine = new FormEngine(def);
            const screener = screenerEngine.evaluateScreener({ triageScore: 55 });

            const imported = {
              $formspec: '1.0',
              url: 'https://example.org/forms/fragment',
              version: '1.0.0',
              status: 'active',
              title: 'Fragment',
              items: [
                {
                  key: 'income',
                  type: 'field',
                  dataType: 'decimal',
                  label: 'Income',
                },
              ],
            };

            const host = {
              $formspec: '1.0',
              url: 'https://example.org/forms/host',
              version: '1.0.0',
              status: 'active',
              title: 'Host',
              items: [
                {
                  key: 'financial',
                  type: 'group',
                  label: 'Financial',
                  $ref: 'https://example.org/forms/fragment|1.0.0',
                  keyPrefix: 'loan_'
                },
              ],
            };

            const assembled = assembleDefinitionSync(host, (url: string) => {
              if (url === 'https://example.org/forms/fragment') return imported;
              throw new Error(`Unexpected resolver URL: ${url}`);
            });

            return {
              screenerTarget: screener?.target,
              assembledKey: assembled.definition.items[0].children?.[0]?.key,
            };
          });

          expect(result.screenerTarget).toBe('https://example.org/forms/high');
          expect(result.assembledKey).toBe('loan_income');
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P2-COMPONENT-THEME-RUNTIME',
          phase: 'phase_2',
          matrixSections: ['5', '6'],
          ksIds: ['KS-039', 'KS-040', 'KS-041', 'KS-042'],
          detail: 'Theme + component documents render and interact through wizard/data-table flow',
        },
        async () => {
          await gotoHarness(page);
          await mountDefinition(page, DEFINITION_V1_RUNTIME);
          await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            renderer.skipScreener();
          });
          await page.evaluate(
            ({ themeDoc, componentDoc }) => {
              const renderer: any = document.querySelector('formspec-render');
              renderer.themeDocument = themeDoc;
              renderer.componentDocument = componentDoc;
            },
            { themeDoc: THEME, componentDoc: COMPONENT }
          );

          await expect(page.locator('.formspec-wizard')).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
          await page.fill('input[name="fullName"]', 'Component User');

          await page.locator('.formspec-wizard-next').click();
          await expect(page.locator('h2', { hasText: 'Financial' })).toBeVisible();
          await page.locator('button.formspec-datatable-add').click();

          const repeatCount = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            return renderer.getEngine().repeats.lineItems.value;
          });
          expect(repeatCount).toBeGreaterThanOrEqual(2);
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P2-COMPONENT-WHEN-VS-RELEVANT',
          phase: 'phase_2',
          matrixSections: ['6'],
          ksIds: ['KS-044'],
          detail: '`when` visual behavior remains distinct from core `relevant` behavior',
        },
        async () => {
          const componentDoc = JSON.parse(JSON.stringify(COMPONENT));
          const profileChildren = componentDoc?.tree?.children?.[0]?.children?.[0]?.children;
          if (!Array.isArray(profileChildren)) {
            throw new Error('Unexpected component fixture shape for KS-044');
          }
          const conditionalGroup = profileChildren.find((node: any) => node?.component === 'ConditionalGroup');
          if (!conditionalGroup) {
            throw new Error('ConditionalGroup fixture not found for KS-044');
          }

          // Separate component-level `when` from definition-level `relevant` bind for this check.
          conditionalGroup.when = "profileMode = 'advanced'";

          await gotoHarness(page);
          await mountDefinition(page, DEFINITION_V1_RUNTIME);
          await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            renderer.skipScreener();
          });
          await page.evaluate(
            ({ themeDoc, componentDoc: nextComponentDoc }) => {
              const renderer: any = document.querySelector('formspec-render');
              renderer.themeDocument = themeDoc;
              renderer.componentDocument = nextComponentDoc;
            },
            { themeDoc: THEME, componentDoc }
          );

          // Case A: when=false + relevant=true => hidden UI, data still participates.
          await page.selectOption('select[name="profileMode"]', 'basic');
          await page.locator('input[name="vipEnabled"]').check();
          await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            renderer.getEngine().setValue('vipCode', 'WHEN-HIDDEN');
          });
          await expect(page.locator('input[name="vipCode"]')).toBeHidden();

          const whenFalseRelevantTrue = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            const engine = renderer.getEngine();
            const input = document.querySelector('input[name="vipCode"]') as HTMLInputElement | null;
            const fieldWrapper = input?.closest('.formspec-field');
            const whenWrapper = input?.closest('.formspec-when');
            const response = engine.getResponse({ mode: 'submit' });
            return {
              whenHidden: whenWrapper?.classList.contains('formspec-hidden') ?? null,
              fieldHidden: fieldWrapper?.classList.contains('formspec-hidden') ?? null,
              relevant: engine.relevantSignals.vipCode?.value ?? null,
              hasVipCode: Object.prototype.hasOwnProperty.call(response.data, 'vipCode'),
              vipCode: response.data.vipCode,
            };
          });

          expect(whenFalseRelevantTrue.whenHidden).toBe(true);
          expect(whenFalseRelevantTrue.fieldHidden).toBe(false);
          expect(whenFalseRelevantTrue.relevant).toBe(true);
          expect(whenFalseRelevantTrue.hasVipCode).toBe(true);
          expect(whenFalseRelevantTrue.vipCode).toBe('WHEN-HIDDEN');

          // Case B: when=true + relevant=false => definition semantics suppress data participation.
          await page.selectOption('select[name="profileMode"]', 'advanced');
          await page.locator('input[name="vipEnabled"]').uncheck();
          await expect(page.locator('input[name="vipCode"]')).toBeHidden();

          const whenTrueRelevantFalse = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            const engine = renderer.getEngine();
            const input = document.querySelector('input[name="vipCode"]') as HTMLInputElement | null;
            const fieldWrapper = input?.closest('.formspec-field');
            const whenWrapper = input?.closest('.formspec-when');
            const response = engine.getResponse({ mode: 'submit' });
            return {
              whenHidden: whenWrapper?.classList.contains('formspec-hidden') ?? null,
              fieldHidden: fieldWrapper?.classList.contains('formspec-hidden') ?? null,
              relevant: engine.relevantSignals.vipCode?.value ?? null,
              hasVipCode: Object.prototype.hasOwnProperty.call(response.data, 'vipCode'),
            };
          });

          expect(whenTrueRelevantFalse.whenHidden).toBe(false);
          expect(whenTrueRelevantFalse.fieldHidden).toBe(true);
          expect(whenTrueRelevantFalse.relevant).toBe(false);
          expect(whenTrueRelevantFalse.hasVipCode).toBe(false);
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P8-TS-PY-FEL-PARITY',
          phase: 'phase_8',
          matrixSections: ['4.5', '11'],
          ksIds: ['KS-064', 'KS-065', 'KS-075'],
          detail: 'TS and Python FEL evaluators agree under comparator policy',
        },
        async () => {
          const py = spawnSync('python3', ['tests/e2e/kitchen_sink/python_fel_eval.py'], {
            cwd: path.resolve(__dirname, '../../../..'),
            input: JSON.stringify({ cases: PARITY_CASES }),
            encoding: 'utf8',
            env: { ...process.env, PYTHONPATH: 'src' },
          });

          if (py.status !== 0) {
            throw new Error(`Python parity evaluator failed: ${py.stderr || py.stdout}`);
          }

          const pyResults = JSON.parse(py.stdout).results as ParityResult[];

          const tsResults = await page.evaluate((cases: ParityCase[]) => {
            const normalize = (value: any): any => {
              if (value === undefined) return null;
              if (value === null) return null;
              if (value instanceof Date) return value.toISOString();
              if (Array.isArray(value)) return value.map(normalize);
              if (typeof value === 'object') {
                const out: Record<string, any> = {};
                for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
                return out;
              }
              return value;
            };

            const FormEngine = (window as any).FormEngine;
            return cases.map((c) => {
              try {
                const fields = c.fields.length > 0
                  ? c.fields
                  : [{ key: 'dummy', dataType: 'integer', value: 0 }];

                const definition = {
                  $formspec: '1.0',
                  url: `https://example.org/forms/parity/${c.id}`,
                  version: '1.0.0',
                  status: 'active',
                  title: 'Parity',
                  items: fields.map((f) => ({
                    key: f.key,
                    type: 'field',
                    dataType: f.dataType || 'string',
                    label: f.key,
                  })),
                };

                const engine = new FormEngine(definition);
                for (const field of c.fields) {
                  engine.setValue(field.key, field.value);
                }

                const fn = engine.compileExpression(c.expression, '');
                const value = normalize(fn());
                return { id: c.id, ok: true, value };
              } catch (error: any) {
                return { id: c.id, ok: false, error: String(error?.message || error) };
              }
            });
          }, PARITY_CASES);

          const byId = new Map(pyResults.map((r) => [r.id, r]));
          const failures: Array<Record<string, unknown>> = [];

          for (const tsCase of tsResults) {
            const pyCase = byId.get(tsCase.id);
            const caseMeta = PARITY_CASES.find((c) => c.id === tsCase.id);
            if (!pyCase || !caseMeta) {
              failures.push({ id: tsCase.id, reason: 'missing-python-or-meta' });
              continue;
            }
            if (!tsCase.ok || !pyCase.ok) {
              failures.push({ id: tsCase.id, reason: 'runtime-error', ts: tsCase, py: pyCase });
              continue;
            }
            const compared = compareParity(caseMeta.comparator, tsCase.value, pyCase.value);
            if (!compared.ok) {
              failures.push({
                id: tsCase.id,
                comparator: caseMeta.comparator,
                reason: compared.detail,
                tsValue: tsCase.value,
                pyValue: pyCase.value,
              });
            }
          }

          expect(failures).toEqual([]);
        }
      );

      await runCheck(
        recorder,
        {
          checkId: 'P8-DETERMINISTIC-RESPONSES',
          phase: 'phase_8',
          matrixSections: ['11'],
          ksIds: ['KS-073', 'KS-074'],
          detail: 'Canonicalized response artifacts are stable across repeated reads',
        },
        async () => {
          const [respA, respB] = await page.evaluate(() => {
            const renderer: any = document.querySelector('formspec-render');
            const engine = renderer.getEngine();
            return [engine.getResponse({ mode: 'submit' }), engine.getResponse({ mode: 'submit' })];
          });
          const canonA = canonicalizeResponse(respA);
          const canonB = canonicalizeResponse(respB);
          expect(canonA).toEqual(canonB);
        }
      );
    } finally {
      recorder.writeReport(PLAYWRIGHT_REPORT, 'playwright-kitchen-sink-conformance');
    }

    expect(recorder.failureCount()).toBe(0);
  });
});
