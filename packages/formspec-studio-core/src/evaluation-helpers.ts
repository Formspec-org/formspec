import { FormEngine, type FormspecDefinition, type ValidationReport } from 'formspec-engine';
import type { Project } from './project.js';

/**
 * Flatten a nested/mixed data object into engine signal paths.
 *
 * Handles three input shapes:
 * - Flat dot-path keys: `{ "expenses[0].amount": 100 }` -- passed through
 * - Nested objects: `{ patient: { first_name: "John" } }` -> `{ "patient.first_name": "John" }`
 * - Nested arrays (repeat groups): `{ expenses: [{ amount: 100 }] }` -> `{ "expenses[0].amount": 100 }`
 */
function flattenToSignalPaths(data: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          Object.assign(result, flattenToSignalPaths(item as Record<string, unknown>, `${path}[${i}]`));
        } else {
          result[`${path}[${i}]`] = item;
        }
      }
    } else if (value !== null && typeof value === 'object') {
      Object.assign(result, flattenToSignalPaths(value as Record<string, unknown>, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}

/**
 * Load data into an engine, handling nested objects, arrays, and repeat instance expansion.
 *
 * The engine initializes signals for repeat instances up to minRepeat (default 1).
 * This function detects higher indices in the data, calls addRepeatInstance to expand
 * signals, then sets all values.
 */
function loadDataIntoEngine(engine: FormEngine, data: Record<string, unknown>): void {
  // Separate already-flat signal paths (contain dots or brackets) from nested objects/arrays.
  let flatData = data;
  const hasNestedValues = Object.values(data).some(
    v => v !== null && typeof v === 'object',
  );
  if (hasNestedValues) {
    const flat: Record<string, unknown> = {};
    const nested: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && !key.includes('.') && !key.includes('[')) {
        nested[key] = value;
      } else {
        flat[key] = value;
      }
    }
    flatData = { ...flat, ...flattenToSignalPaths(nested) };
  }

  // Determine required repeat instance counts from indexed paths.
  const repeatCounts = new Map<string, number>();
  for (const path of Object.keys(flatData)) {
    const match = path.match(/^(.+?)\[(\d+)\]/);
    if (match) {
      const groupPath = match[1];
      const needed = parseInt(match[2], 10) + 1;
      const current = repeatCounts.get(groupPath) ?? 0;
      if (needed > current) {
        repeatCounts.set(groupPath, needed);
      }
    }
  }

  // Expand repeat instances beyond what the engine initialized
  for (const [groupPath, needed] of repeatCounts) {
    const currentCount = engine.repeats[groupPath]?.value ?? 0;
    for (let i = currentCount; i < needed; i++) {
      engine.addRepeatInstance(groupPath);
    }
  }

  for (const [path, value] of Object.entries(flatData)) {
    engine.setValue(path, value);
  }
}

/**
 * Walk ancestor paths to find the first one whose own relevantSignal is false.
 * Returns the ancestor path, or undefined if the path itself is the hidden one.
 */
function findHidingAncestor(engine: FormEngine, path: string): string | undefined {
  const parts = path.split(/[\[\].]/).filter(Boolean);
  let currentPath = '';
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const isIndex = /^\d+$/.test(part);
    if (isIndex) {
      currentPath += `[${part}]`;
    } else {
      currentPath += (currentPath ? '.' : '') + part;
    }
    if (engine.relevantSignals[currentPath] && !engine.relevantSignals[currentPath].value) {
      return currentPath;
    }
  }
  return undefined;
}

/**
 * Preview — simulate respondent experience.
 * Creates a FormEngine from the project's exported definition,
 * optionally replays scenario values, and returns a snapshot.
 */
export function previewForm(
  project: Project,
  scenario?: Record<string, unknown>,
): {
  visibleFields: string[];
  hiddenFields: { path: string; hiddenBy?: string }[];
  currentValues: Record<string, unknown>;
  requiredFields: string[];
  pages: { id: string; title: string; status: 'active' | 'complete' | 'incomplete' | 'unreachable' }[];
  validationState: Record<string, { severity: 'error' | 'warning' | 'info'; message: string }>;
} {
  const bundle = project.export();
  // Bridge studio-core's FormDefinition → engine's FormspecDefinition at the boundary
  const engine = new FormEngine(bundle.definition as unknown as FormspecDefinition);

  if (scenario) {
    loadDataIntoEngine(engine, scenario);
  }

  // Collect field visibility, values, required state
  const visibleFields: string[] = [];
  const hiddenFields: { path: string; hiddenBy?: string }[] = [];
  const currentValues: Record<string, unknown> = {};
  const requiredFields: string[] = [];

  for (const [path, signal] of Object.entries(engine.signals)) {
    currentValues[path] = signal.value;
  }

  for (const [path] of Object.entries(engine.relevantSignals)) {
    if (engine.isPathRelevant(path)) {
      visibleFields.push(path);
    } else {
      hiddenFields.push({ path, hiddenBy: findHidingAncestor(engine, path) });
    }
  }

  for (const [path, reqSignal] of Object.entries(engine.requiredSignals)) {
    if (reqSignal.value) {
      requiredFields.push(path);
    }
  }

  // Build validation state from the full report (submit mode) so all shapes — including
  // submit-timing ones — are included. When multiple results target the same field:
  //   1. Error severity beats warning/info
  //   2. Among same severity, "required" constraintKind wins outright
  //   3. Among same severity, shape source beats bind source (custom messages override defaults)
  //   4. Otherwise first result at the winning severity wins
  type Entry = { severity: 'error' | 'warning' | 'info'; message: string; constraintKind?: string; source?: string };
  const validationState: Record<string, Entry> = {};
  const report = engine.getValidationReport({ mode: 'submit' });

  const severityRank = { error: 2, warning: 1, info: 0 } as const;

  for (const result of report.results) {
    const severity = result.severity ?? 'error';
    const existing = validationState[result.path];
    if (!existing) {
      validationState[result.path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      continue;
    }
    const newRank = severityRank[severity];
    const existingRank = severityRank[existing.severity];
    if (newRank > existingRank) {
      // Higher severity always wins
      validationState[result.path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
    } else if (newRank === existingRank) {
      // Among same severity: required > shape > first-wins
      if (result.constraintKind === 'required' && existing.constraintKind !== 'required') {
        validationState[result.path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      } else if (result.source === 'shape' && existing.source !== 'shape' && existing.constraintKind !== 'required') {
        validationState[result.path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      }
    }
  }

  // Strip internal tracking properties before returning
  const cleanState: Record<string, { severity: 'error' | 'warning' | 'info'; message: string }> = {};
  for (const [path, entry] of Object.entries(validationState)) {
    cleanState[path] = { severity: entry.severity, message: entry.message };
  }

  // Pages from theme
  const pages = (bundle.theme?.pages ?? []).map((p: any) => ({
    id: p.id,
    title: p.title ?? '',
    status: 'active' as const,
  }));

  return {
    visibleFields,
    hiddenFields,
    currentValues,
    requiredFields,
    pages,
    validationState: cleanState,
  };
}

/**
 * Validate a response document against the current form definition.
 * Returns a ValidationReport from formspec-engine.
 */
export function validateResponse(
  project: Project,
  response: Record<string, unknown>,
): ValidationReport {
  const bundle = project.export();
  // Bridge studio-core's FormDefinition → engine's FormspecDefinition at the boundary
  const engine = new FormEngine(bundle.definition as unknown as FormspecDefinition);

  loadDataIntoEngine(engine, response);

  return engine.getValidationReport({ mode: 'submit' });
}
