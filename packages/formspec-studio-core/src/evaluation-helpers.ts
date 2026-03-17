import { FormEngine, type FormspecDefinition, type ValidationReport } from 'formspec-engine';
import type { Project } from './project.js';

/**
 * Flatten a nested/mixed data object into engine signal paths.
 *
 * Handles three input shapes:
 * - Flat dot-path keys: `{ "expenses[0].amount": 100 }` -- passed through
 * - Nested objects: `{ patient: { first_name: "John" } }` -> `{ "patient.first_name": "John" }`
 * - Repeat group arrays: `{ expenses: [{ amount: 100 }] }` -> `{ "expenses[0].amount": 100 }`
 * - Array-valued fields (multichoice): `{ tags: ["a", "b"] }` -> `{ "tags": ["a", "b"] }` (preserved)
 *
 * @param repeatGroupPaths - Paths known to be repeat groups. Arrays at these paths
 *   are expanded into indexed signal paths. Arrays at all other paths are preserved
 *   as-is (e.g. multichoice field values).
 */
function flattenToSignalPaths(
  data: Record<string, unknown>,
  repeatGroupPaths: ReadonlySet<string>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    // Strip indices to match engine's base repeat group paths (e.g. sections[0].items → sections.items)
    const basePath = path.replace(/\[\d+\]/g, '');
    if (Array.isArray(value) && repeatGroupPaths.has(basePath)) {
      // Repeat group — expand array elements into indexed paths
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          Object.assign(result, flattenToSignalPaths(item as Record<string, unknown>, repeatGroupPaths, `${path}[${i}]`));
        } else {
          result[`${path}[${i}]`] = item;
        }
      }
    } else if (Array.isArray(value)) {
      // Non-repeat-group array (e.g. multichoice) — pass through as-is
      result[path] = value;
    } else if (value !== null && typeof value === 'object') {
      Object.assign(result, flattenToSignalPaths(value as Record<string, unknown>, repeatGroupPaths, path));
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
  // Derive repeat group paths from the engine's initialized repeat signals.
  // Strip indices so nested repeat groups match during recursive flattening
  // (engine stores "sections[0].items" but nested data arrives as "sections.items").
  const repeatGroupPaths = new Set(
    Object.keys(engine.repeats).map(k => k.replace(/\[\d+\]/g, '')),
  );

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
    flatData = { ...flat, ...flattenToSignalPaths(nested, repeatGroupPaths) };
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
 * Convert engine's 1-based external paths back to 0-based internal paths.
 * The engine's `toExternalPath` adds 1 to bracket indices for user-facing
 * validation reports, but previewForm uses 0-based paths everywhere else
 * (signals, relevance, required), so validation paths must match.
 */
function toInternalPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) - 1}]`);
}

/**
 * Preview — simulate respondent experience.
 * Creates a FormEngine from the project's exported definition,
 * optionally replays scenario values, and returns a snapshot.
 *
 * All paths in the returned object (visibleFields, hiddenFields, currentValues,
 * requiredFields, validationState keys) use 0-based indexing for repeat group
 * instances (e.g. `items[0].field`). Note that the engine's ValidationReport
 * uses 1-based indexing externally; this function normalizes those back to 0-based
 * for consistency.
 */
export function previewForm(
  project: Project,
  scenario?: Record<string, unknown>,
): {
  visibleFields: string[];
  hiddenFields: { path: string; hiddenBy?: string }[];
  currentValues: Record<string, unknown>;
  requiredFields: string[];
  pages: { id: string; title: string; validationErrors: number; validationWarnings: number; status: 'active' | 'complete' | 'incomplete' | 'unreachable' }[];
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
    if (reqSignal.value && engine.isPathRelevant(path)) {
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
    const path = toInternalPath(result.path);
    const existing = validationState[path];
    if (!existing) {
      validationState[path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      continue;
    }
    const newRank = severityRank[severity];
    const existingRank = severityRank[existing.severity];
    if (newRank > existingRank) {
      // Higher severity always wins
      validationState[path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
    } else if (newRank === existingRank) {
      // Among same severity: required > shape > first-wins
      if (result.constraintKind === 'required' && existing.constraintKind !== 'required') {
        validationState[path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      } else if (result.source === 'shape' && existing.source !== 'shape' && existing.constraintKind !== 'required') {
        validationState[path] = { severity, message: result.message, constraintKind: result.constraintKind, source: result.source };
      }
    }
  }

  // Strip internal tracking properties before returning
  const cleanState: Record<string, { severity: 'error' | 'warning' | 'info'; message: string }> = {};
  for (const [path, entry] of Object.entries(validationState)) {
    cleanState[path] = { severity: entry.severity, message: entry.message };
  }

  // Pages from theme — with per-page validation counts
  const themePages = bundle.theme?.pages ?? [];
  const visibleFieldSet = new Set(visibleFields);
  const pages = (themePages as any[]).map((p: any) => {
    // Collect group paths owned by this page via its regions
    const regionKeys: string[] = (p.regions ?? [])
      .map((r: any) => r.key)
      .filter(Boolean);

    // Count validation entries whose path falls under one of this page's groups
    // and whose field is visible (not hidden by a show_when condition)
    let errors = 0;
    let warnings = 0;
    for (const [fieldPath, entry] of Object.entries(cleanState)) {
      if (!regionKeys.some(rk => fieldPath === rk || fieldPath.startsWith(rk + '.') || fieldPath.startsWith(rk + '['))) {
        continue;
      }
      if (!visibleFieldSet.has(fieldPath)) continue;
      if (entry.severity === 'error') errors++;
      else if (entry.severity === 'warning') warnings++;
    }

    return {
      id: p.id,
      title: p.title ?? '',
      validationErrors: errors,
      validationWarnings: warnings,
      status: 'active' as const,
    };
  });

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

  const report = engine.getValidationReport({ mode: 'submit' });
  return {
    ...report,
    results: report.results.map(r => ({ ...r, path: toInternalPath(r.path) })),
  };
}
