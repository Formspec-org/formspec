/** @filedesc Sample response generation and definition pruning for preview helpers. */
import { createFormEngine, type FormspecDefinition, type IFormEngine } from '@formspec-org/engine/render';
import type { FormItem } from '../types.js';
import { sampleFieldValue } from '../mapping-sample-data.js';

/** Default sample values by data type. Uses today's date for date/dateTime. */
export function sampleValues(): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  return {
    string: 'Sample text',
    text: 'Sample paragraph text',
    integer: 42,
    decimal: 3.14,
    boolean: true,
    date: today,
    time: '09:00:00',
    dateTime: `${today}T09:00:00Z`,
    uri: 'https://example.com',
    attachment: 'sample-file.pdf',
    money: { amount: 100, currency: 'USD' },
    multiChoice: ['option1'],
  };
}

/** Generate a context-aware sample value for a field. */
export function sampleValueForField(item: FormItem, fieldIndex: number): unknown {
  const dt = item.dataType ?? 'string';
  const opts = item.options
    ? { firstOptionValue: item.options[0]?.value as string | undefined, secondOptionValue: item.options[1]?.value as string | undefined }
    : undefined;

  if (dt === 'choice' || dt === 'multiChoice') {
    return sampleFieldValue(item.key, dt, opts);
  }

  if (dt === 'money') {
    return sampleValues().money;
  }

  if (dt === 'integer' || dt === 'decimal') {
    return sampleFieldValue(item.key, dt, {
      ...opts,
      min: typeof item.min === 'number' ? item.min : undefined,
      max: typeof item.max === 'number' ? item.max : undefined,
    });
  }

  return sampleFieldValue(item.key, dt, opts);
}

/**
 * Load sample data into a FormEngine and strip fields whose
 * show_when/relevant condition evaluates to false.
 */
export function filterByRelevance(
  definition: unknown,
  data: Record<string, unknown>,
): Record<string, unknown> {
  let engine: IFormEngine;
  try {
    engine = createFormEngine(definition as FormspecDefinition);
  } catch {
    return data;
  }

  for (const [path, value] of Object.entries(data)) {
    if (value !== undefined) {
      engine.setValue(path, value);
    }
  }

  const filtered: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(data)) {
    if (engine.isPathRelevant(path)) {
      filtered[path] = value;
    }
  }
  return filtered;
}

/** Recursively prune null values, empty arrays, and empty objects from a value. */
export function pruneObject(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    const pruned = value.map((v) => pruneObject(v)).filter((v) => v !== undefined);
    return pruned.length === 0 ? undefined : pruned;
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    let hasKeys = false;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pruned = pruneObject(v);
      if (pruned !== undefined) {
        result[k] = pruned;
        hasKeys = true;
      }
    }
    return hasKeys ? result : undefined;
  }
  return value;
}
