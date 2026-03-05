/**
 * @module Studio import/export helpers.
 * Handles bundle/template serialization and resilient payload import parsing.
 */
import type { FormspecDefinition } from 'formspec-engine';
import {
  createInitialComponent,
  createInitialMapping,
  createInitialProjectState,
  createInitialTheme,
  createInitialVersioningState,
  type FormspecComponentDocument,
  type FormspecMappingDocument,
  type FormspecThemeDocument,
  type ProjectExtensionsState,
  type ProjectState,
  type ProjectVersioningState
} from './project';

/** Current Studio bundle export format version. */
export const STUDIO_BUNDLE_VERSION = '1.0';
/** Current Studio template export format version. */
export const STUDIO_TEMPLATE_VERSION = '1.0';

/** Snapshot of Studio-managed artifacts. */
export interface StudioArtifactsSnapshot {
  definition: FormspecDefinition;
  component: FormspecComponentDocument;
  theme: FormspecThemeDocument;
  mapping: FormspecMappingDocument;
}

/** Full export bundle including artifacts and optional editor metadata. */
export interface StudioBundleDocument {
  $formspecStudioBundle: typeof STUDIO_BUNDLE_VERSION;
  exportedAt: string;
  artifacts: StudioArtifactsSnapshot;
  extensions?: ProjectExtensionsState;
  versioning?: ProjectVersioningState;
}

/** Reusable template export used for quick-start authoring flows. */
export interface StudioTemplateDocument {
  $formspecStudioTemplate: typeof STUDIO_TEMPLATE_VERSION;
  name: string;
  description?: string;
  createdAt: string;
  artifacts: StudioArtifactsSnapshot;
}

/** Normalized import payload kind recognized by Studio. */
export type ImportedPayloadKind = 'bundle' | 'template' | 'definition' | 'component' | 'theme' | 'mapping';

/** Parsed import payload normalized to Studio's internal import contract. */
export interface ImportedProjectPayload {
  kind: ImportedPayloadKind;
  artifacts: Partial<StudioArtifactsSnapshot>;
  templateName?: string;
  extensions?: ProjectExtensionsState;
  versioning?: ProjectVersioningState;
}

/** Builds a bundle document from the current project state. */
export function buildStudioBundleDocument(
  state: ProjectState,
  exportedAt = new Date().toISOString()
): StudioBundleDocument {
  return {
    $formspecStudioBundle: STUDIO_BUNDLE_VERSION,
    exportedAt,
    artifacts: {
      definition: structuredClone(state.definition),
      component: structuredClone(state.component),
      theme: structuredClone(state.theme),
      mapping: structuredClone(state.mapping)
    },
    extensions: structuredClone(state.extensions),
    versioning: structuredClone(state.versioning)
  };
}

/** Builds a named template document from the current project state. */
export function buildStudioTemplateDocument(
  state: ProjectState,
  input: { name: string; description?: string; createdAt?: string }
): StudioTemplateDocument {
  return {
    $formspecStudioTemplate: STUDIO_TEMPLATE_VERSION,
    name: input.name,
    description: normalizeOptionalString(input.description),
    createdAt: input.createdAt ?? new Date().toISOString(),
    artifacts: {
      definition: structuredClone(state.definition),
      component: structuredClone(state.component),
      theme: structuredClone(state.theme),
      mapping: structuredClone(state.mapping)
    }
  };
}

/**
 * Parses supported import payloads:
 * bundle/template wrappers, raw artifact documents, or mixed artifact objects.
 */
export function parseImportedProjectPayload(payload: unknown): ImportedProjectPayload {
  if (!isRecord(payload)) {
    throw new Error('Imported payload must be a JSON object.');
  }

  if (payload.$formspecStudioTemplate === STUDIO_TEMPLATE_VERSION) {
    const name = normalizeOptionalString(payload.name);
    const artifacts = extractArtifacts(payload.artifacts);
    if (!name) {
      throw new Error('Template payload must include a name.');
    }
    return {
      kind: 'template',
      artifacts,
      templateName: name
    };
  }

  if (payload.$formspecStudioBundle === STUDIO_BUNDLE_VERSION) {
    return {
      kind: 'bundle',
      artifacts: extractArtifacts(payload.artifacts),
      extensions: normalizeExtensions(payload.extensions),
      versioning: normalizeVersioning(payload.versioning)
    };
  }

  const maybeBundleArtifacts = extractArtifacts(payload);
  if (
    maybeBundleArtifacts.definition ||
    maybeBundleArtifacts.component ||
    maybeBundleArtifacts.theme ||
    maybeBundleArtifacts.mapping
  ) {
    return {
      kind: 'bundle',
      artifacts: maybeBundleArtifacts,
      extensions: normalizeExtensions(payload.extensions),
      versioning: normalizeVersioning(payload.versioning)
    };
  }

  if (isDefinitionDocument(payload)) {
    return {
      kind: 'definition',
      artifacts: {
        definition: payload as FormspecDefinition
      }
    };
  }

  if (isComponentDocument(payload)) {
    return {
      kind: 'component',
      artifacts: {
        component: payload as FormspecComponentDocument
      }
    };
  }

  if (isThemeDocument(payload)) {
    return {
      kind: 'theme',
      artifacts: {
        theme: payload as FormspecThemeDocument
      }
    };
  }

  if (isMappingDocument(payload)) {
    return {
      kind: 'mapping',
      artifacts: {
        mapping: payload as FormspecMappingDocument
      }
    };
  }

  throw new Error('Unsupported import payload. Provide a bundle, template, or known artifact document.');
}

/**
 * Applies imported artifacts to current project state.
 * Companion artifacts are regenerated when importing a bare definition.
 */
export function buildProjectStateFromImport(
  current: ProjectState,
  imported: ImportedProjectPayload
): ProjectState {
  const importedDefinition = imported.artifacts.definition;
  const useFreshCompanions =
    imported.kind === 'definition' ||
    (imported.kind === 'template' && !imported.artifacts.component && !imported.artifacts.theme && !imported.artifacts.mapping);

  const definition = importedDefinition ? structuredClone(importedDefinition) : structuredClone(current.definition);
  const component = imported.artifacts.component
    ? structuredClone(imported.artifacts.component)
    : importedDefinition && useFreshCompanions
      ? createInitialComponent(definition)
      : structuredClone(current.component);
  const theme = imported.artifacts.theme
    ? structuredClone(imported.artifacts.theme)
    : importedDefinition && useFreshCompanions
      ? createInitialTheme(definition)
      : structuredClone(current.theme);
  const mapping = imported.artifacts.mapping
    ? structuredClone(imported.artifacts.mapping)
    : importedDefinition && useFreshCompanions
      ? createInitialMapping(definition)
      : structuredClone(current.mapping);
  const extensions = imported.extensions ? structuredClone(imported.extensions) : structuredClone(current.extensions);
  const versioning = imported.versioning
    ? structuredClone(imported.versioning)
    : importedDefinition && useFreshCompanions
      ? createInitialVersioningState(definition)
      : structuredClone(current.versioning);

  return createInitialProjectState({
    definition,
    component,
    theme,
    mapping,
    extensions,
    versioning,
    selection: null,
    uiState: {
      ...current.uiState,
      jsonEditorOpen: false
    }
  });
}

function extractArtifacts(value: unknown): Partial<StudioArtifactsSnapshot> {
  if (!isRecord(value)) {
    return {};
  }

  const artifacts: Partial<StudioArtifactsSnapshot> = {};
  if (isRecord(value.definition) && isDefinitionDocument(value.definition)) {
    artifacts.definition = value.definition as FormspecDefinition;
  }
  if (isRecord(value.component) && isComponentDocument(value.component)) {
    artifacts.component = value.component as FormspecComponentDocument;
  }
  if (isRecord(value.theme) && isThemeDocument(value.theme)) {
    artifacts.theme = value.theme as FormspecThemeDocument;
  }
  if (isRecord(value.mapping) && isMappingDocument(value.mapping)) {
    artifacts.mapping = value.mapping as FormspecMappingDocument;
  }
  return artifacts;
}

function normalizeExtensions(value: unknown): ProjectExtensionsState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (!Array.isArray(value.registries)) {
    return undefined;
  }
  return {
    registries: value.registries as ProjectExtensionsState['registries']
  };
}

function normalizeVersioning(value: unknown): ProjectVersioningState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (!isRecord(value.baselineDefinition) || !Array.isArray(value.releases)) {
    return undefined;
  }
  return {
    baselineDefinition: value.baselineDefinition as FormspecDefinition,
    releases: value.releases as ProjectVersioningState['releases']
  };
}

function isDefinitionDocument(value: Record<string, unknown>): value is FormspecDefinition {
  return Array.isArray(value.items) && typeof value.url === 'string';
}

function isComponentDocument(value: Record<string, unknown>): value is FormspecComponentDocument {
  return isRecord(value.tree) && typeof value.$formspecComponent === 'string';
}

function isThemeDocument(value: Record<string, unknown>): value is FormspecThemeDocument {
  return typeof value.$formspecTheme === 'string' || isRecord(value.tokens) || isRecord(value.items);
}

function isMappingDocument(value: Record<string, unknown>): value is FormspecMappingDocument {
  return Array.isArray(value.rules) && typeof value.definitionRef === 'string';
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
