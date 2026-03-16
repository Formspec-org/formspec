import { FormEngine, type FormspecDefinition, type ValidationReport } from 'formspec-engine';
import type { Project } from './project.js';

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

  // Apply scenario values
  if (scenario) {
    for (const [path, value] of Object.entries(scenario)) {
      engine.setValue(path, value);
    }
  }

  // Collect field visibility, values, required state
  const visibleFields: string[] = [];
  const hiddenFields: { path: string; hiddenBy?: string }[] = [];
  const currentValues: Record<string, unknown> = {};
  const requiredFields: string[] = [];

  for (const [path, signal] of Object.entries(engine.signals)) {
    currentValues[path] = signal.value;
  }

  for (const [path, relSignal] of Object.entries(engine.relevantSignals)) {
    if (relSignal.value) {
      visibleFields.push(path);
    } else {
      hiddenFields.push({ path });
    }
  }

  for (const [path, reqSignal] of Object.entries(engine.requiredSignals)) {
    if (reqSignal.value) {
      requiredFields.push(path);
    }
  }

  // Collect validation state
  const validationState: Record<string, { severity: 'error' | 'warning' | 'info'; message: string }> = {};
  for (const [path, valSignal] of Object.entries(engine.validationResults)) {
    const results = valSignal.value;
    if (results?.length > 0) {
      validationState[path] = {
        severity: results[0].severity ?? 'error',
        message: results[0].message,
      };
    }
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
    validationState,
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

  // Set all response values
  for (const [path, value] of Object.entries(response)) {
    engine.setValue(path, value);
  }

  return engine.getValidationReport({ mode: 'submit' });
}
