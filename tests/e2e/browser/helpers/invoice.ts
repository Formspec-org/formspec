import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const INVOICE_DIR = path.join(ROOT, 'examples/invoice');

export function loadInvoiceArtifacts() {
  return {
    definition: JSON.parse(fs.readFileSync(path.join(INVOICE_DIR, 'invoice.definition.json'), 'utf8')),
    component:  JSON.parse(fs.readFileSync(path.join(INVOICE_DIR, 'invoice.component.json'),  'utf8')),
    theme:      JSON.parse(fs.readFileSync(path.join(INVOICE_DIR, 'invoice.theme.json'),       'utf8')),
    registry:   [JSON.parse(fs.readFileSync(path.join(ROOT, 'registries/formspec-common.registry.json'), 'utf8'))],
  };
}

export async function mountInvoice(page: Page): Promise<void> {
  const { definition, component, theme, registry } = loadInvoiceArtifacts();
  await page.goto('/');
  await page.waitForSelector('formspec-render', { state: 'attached' });
  await page.evaluate(({ def, comp, thm, reg }) => {
    const el: any = document.querySelector('formspec-render');
    el.registryDocuments = reg;
    el.definition        = def;
    el.componentDocument = comp;
    el.themeDocument     = thm;
  }, { def: definition, comp: component, thm: theme, reg: registry });
  await page.waitForTimeout(200);
}

/** Get raw field signal value from the engine. */
export async function engineValue(page: Page, fieldPath: string): Promise<any> {
  return page.evaluate((p) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().signals[p]?.value;
  }, fieldPath);
}

/** Set a field value via engine (bypasses UI). */
export async function engineSetValue(page: Page, fieldPath: string, value: any): Promise<void> {
  await page.evaluate(({ p, v }) => {
    const el: any = document.querySelector('formspec-render');
    el.getEngine().setValue(p, v);
  }, { p: fieldPath, v: value });
}

/** Programmatically add a repeat instance via engine. Returns new count. */
export async function addRepeatInstance(page: Page, itemName: string): Promise<number> {
  return page.evaluate((name) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().addRepeatInstance(name);
  }, itemName);
}

/** Get the current repeat count for a group. */
export async function getRepeatCount(page: Page, itemName: string): Promise<number> {
  return page.evaluate((name) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().repeats[name]?.value ?? 0;
  }, itemName);
}

/** Get the full validation report. */
export async function getValidationReport(
  page: Page,
  mode: 'continuous' | 'submit' | 'demand' = 'continuous'
) {
  return page.evaluate((m) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().getValidationReport({ mode: m });
  }, mode);
}

/** Get the full response object. */
export async function getResponse(page: Page, mode: 'continuous' | 'submit' = 'submit') {
  return page.evaluate((m) => {
    const el: any = document.querySelector('formspec-render');
    return el.getEngine().getResponse({ mode: m });
  }, mode);
}
