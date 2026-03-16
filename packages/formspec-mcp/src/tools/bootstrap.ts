/**
 * Bootstrap-phase tools (consolidated):
 *
 * - formspec_draft: Submit a raw JSON artifact (definition, component, or theme)
 *   for schema validation. Replaces the old draft_definition/component/theme trio.
 *
 * - formspec_load: Auto-validates all drafts, then transitions to authoring.
 *   Replaces the old validate_draft + load_draft pair.
 */

import { HelperError, createProject } from 'formspec-studio-core';
import type { DocumentType } from 'formspec-engine';
import { ProjectRegistry } from '../registry.js';
import { getValidator } from '../schemas.js';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

// ── Helpers ──────────────────────────────────────────────────────────

type ArtifactType = 'definition' | 'component' | 'theme';

function getDraftSafe(registry: ProjectRegistry, projectId: string) {
  try {
    return { draft: registry.getDraft(projectId), error: null };
  } catch (err) {
    if (err instanceof HelperError) {
      return {
        draft: null,
        error: errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>)),
      };
    }
    throw err;
  }
}

// ── Public handlers ──────────────────────────────────────────────────

/**
 * Submit a raw JSON artifact for schema validation during bootstrap.
 * type: 'definition' | 'component' | 'theme'
 */
export function handleDraft(
  registry: ProjectRegistry,
  projectId: string,
  type: ArtifactType,
  json: unknown,
) {
  const { draft, error } = getDraftSafe(registry, projectId);
  if (error) return error;

  // Store the JSON on the draft regardless of validation result
  draft![type] = json;

  // Validate against schema
  const validator = getValidator();
  const result = validator.validate(json, type as DocumentType);

  if (result.errors.length > 0) {
    draft!.errors.set(type, result.errors);
    return errorResponse(
      formatToolError('DRAFT_SCHEMA_ERROR', `${type} has ${result.errors.length} schema error(s)`, {
        artifactType: type,
        errors: result.errors.map((e) => ({ path: e.path, message: e.message })),
      }),
    );
  }

  // Valid — clear any previous errors for this artifact type
  draft!.errors.delete(type);
  return successResponse({ stored: type, valid: true });
}

/**
 * Auto-validates all drafts, then transitions to authoring phase.
 * Returns validation errors instead of transitioning if any exist.
 */
export function handleLoad(
  registry: ProjectRegistry,
  projectId: string,
) {
  const { draft, error } = getDraftSafe(registry, projectId);
  if (error) return error;

  // When no definition has been drafted, create a blank project directly —
  // no seed to validate, nothing to load.
  if (!draft!.definition) {
    const project = createProject();
    registry.transitionToAuthoring(projectId, project);
    const statistics = project.statistics();
    const diagnostics = project.diagnose();
    return successResponse({ phase: 'authoring', statistics, diagnostics: diagnostics.counts });
  }

  // Check for unresolved schema errors
  if (draft!.errors.size > 0) {
    const allErrors: Array<{ artifactType: string; path: string; message: string }> = [];
    for (const [artifactType, errors] of draft!.errors) {
      for (const e of errors) {
        allErrors.push({ artifactType, path: e.path, message: e.message });
      }
    }
    return errorResponse(
      formatToolError('DRAFT_INVALID', `Cannot load draft: ${allErrors.length} unresolved schema error(s)`, {
        errors: allErrors,
      }),
    );
  }

  // Build the seed bundle from submitted drafts
  const seed: Record<string, unknown> = {
    definition: draft!.definition,
  };
  if (draft!.component) seed.component = draft!.component;
  if (draft!.theme) seed.theme = draft!.theme;

  // Create project and load the bundle
  const project = createProject();
  project.loadBundle(seed);

  // Transition to authoring phase
  registry.transitionToAuthoring(projectId, project);

  const statistics = project.statistics();
  const diagnostics = project.diagnose();

  return successResponse({
    phase: 'authoring',
    statistics,
    diagnostics: diagnostics.counts,
  });
}
