/**
 * @module Studio project state model and initializers.
 * Defines the canonical in-memory shape used by the editor.
 */
import { signal, type Signal } from '@preact/signals';
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';
import { rebuildComponentTreeFromDefinition, type GeneratedComponentNode } from './wiring';
import type { FormspecChangelogDocument } from './versioning';

/** Component artifact persisted by Studio. */
export interface FormspecComponentDocument {
  $formspecComponent: '1.0';
  version: string;
  targetDefinition: {
    url: string;
    compatibleVersions?: string;
  };
  breakpoints?: Record<string, number>;
  tree: GeneratedComponentNode;
  name?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/** Supported selector `type` values for theme selector rules. */
export type ThemeSelectorType = FormspecItem['type'];
/** Supported selector `dataType` values for theme selector rules. */
export type ThemeSelectorDataType = Exclude<FormspecItem['dataType'], undefined>;

/** Rule matcher used by theme selector rules. */
export interface ThemeSelectorMatch {
  type?: ThemeSelectorType;
  dataType?: ThemeSelectorDataType;
}

/** Theme selector rule that applies a presentation block when matched. */
export interface ThemeSelectorRule {
  match: ThemeSelectorMatch;
  apply: Record<string, unknown>;
}

/** Theme artifact persisted by Studio. */
export interface FormspecThemeDocument {
  $formspecTheme: '1.0';
  version: string;
  targetDefinition: {
    url: string;
    compatibleVersions?: string;
  };
  breakpoints?: Record<string, number>;
  tokens?: Record<string, string | number>;
  selectors?: ThemeSelectorRule[];
  items?: Record<string, Record<string, unknown>>;
  name?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/** Direction support for mapping execution. */
export type MappingDirection = 'forward' | 'reverse' | 'both';
/** Feature-level conformance class for a mapping document. */
export type MappingConformanceLevel = 'core' | 'bidirectional' | 'extended';
/** Supported mapping transformation operators. */
export type MappingTransformType =
  | 'preserve'
  | 'drop'
  | 'expression'
  | 'coerce'
  | 'valueMap'
  | 'flatten'
  | 'nest'
  | 'constant'
  | 'concat'
  | 'split';

/** Target schema metadata used by mapping rules. */
export interface MappingTargetSchema {
  format: string;
  name?: string;
  url?: string;
  rootElement?: string;
  namespaces?: Record<string, string>;
}

/** Single mapping rule row in the mapping document. */
export interface MappingRule {
  sourcePath?: string;
  targetPath?: string | null;
  transform: MappingTransformType;
  expression?: string;
  coerce?: string | Record<string, unknown>;
  valueMap?: Record<string, unknown>;
  reverse?: Record<string, unknown>;
  bidirectional?: boolean;
  condition?: string;
  default?: unknown;
  separator?: string;
  description?: string;
  priority?: number;
  reversePriority?: number;
}

/** Mapping artifact persisted by Studio. */
export interface FormspecMappingDocument {
  $schema?: string;
  version: string;
  definitionRef: string;
  definitionVersion: string;
  targetSchema: MappingTargetSchema;
  direction?: MappingDirection;
  defaults?: Record<string, unknown>;
  autoMap?: boolean;
  conformanceLevel?: MappingConformanceLevel;
  rules: MappingRule[];
  adapters?: Record<string, unknown>;
}

/** Registry entry category recognized by Studio extension tooling. */
export type ExtensionEntryCategory =
  | 'dataType'
  | 'function'
  | 'constraint'
  | 'property'
  | 'namespace';

/** Lifecycle status for extension registry entries. */
export type ExtensionEntryStatus = 'draft' | 'stable' | 'deprecated' | 'retired';

/** Registry publisher metadata. */
export interface ExtensionPublisher {
  name: string;
  url: string;
  contact?: string;
}

/** Compatibility constraints for a registry entry. */
export interface ExtensionEntryCompatibility {
  formspecVersion: string;
  mappingDslVersion?: string;
}

/** Signature metadata for extension functions and constraints. */
export interface ExtensionEntryParameter {
  name: string;
  type: string;
  description?: string;
}

/** Single extension entry exposed by a registry document. */
export interface ExtensionRegistryEntry {
  name: string;
  category: ExtensionEntryCategory;
  version: string;
  status: ExtensionEntryStatus;
  description: string;
  compatibility: ExtensionEntryCompatibility;
  publisher?: ExtensionPublisher;
  specUrl?: string;
  schemaUrl?: string;
  license?: string;
  deprecationNotice?: string;
  examples?: unknown[];
  extensions?: Record<string, unknown>;
  baseType?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  parameters?: ExtensionEntryParameter[];
  returns?: string;
  members?: string[];
}

/** Registry document loaded by Studio. */
export interface ExtensionRegistryDocument {
  $formspecRegistry: string;
  $schema?: string;
  publisher: ExtensionPublisher;
  published: string;
  entries: ExtensionRegistryEntry[];
  extensions?: Record<string, unknown>;
}

/** A registry plus source metadata tracked by Studio state. */
export interface LoadedExtensionRegistry {
  id: string;
  sourceType: 'url' | 'file' | 'inline';
  sourceLabel: string;
  loadedAt: string;
  document: ExtensionRegistryDocument;
}

/** Extension subsystem state. */
export interface ProjectExtensionsState {
  registries: LoadedExtensionRegistry[];
}

/** Published release snapshot recorded by the Studio versioning flow. */
export interface VersionRelease {
  version: string;
  publishedAt: string;
  changelog: FormspecChangelogDocument;
}

/** Versioning subsystem state. */
export interface ProjectVersioningState {
  baselineDefinition: FormspecDefinition;
  releases: VersionRelease[];
}

/** Editor-only UI state persisted alongside artifacts. */
export interface ProjectUIState {
  inspectorSections: Record<string, boolean>;
  viewMode: 'edit' | 'preview' | 'split';
  structurePanelOpen: boolean;
  diagnosticsOpen: boolean;
  mobilePanel: 'none' | 'structure' | 'inspector';
  previewWidth: number;
  activeBreakpoint: string;
  jsonEditorOpen: boolean;
  jsonEditorTab: 'definition' | 'component' | 'theme';
}

/** Top-level Studio project state. */
export interface ProjectState {
  definition: FormspecDefinition;
  component: FormspecComponentDocument;
  theme: FormspecThemeDocument;
  mapping: FormspecMappingDocument;
  extensions: ProjectExtensionsState;
  versioning: ProjectVersioningState;
  selection: string | null;
  uiState: ProjectUIState;
}

const DEFAULT_DEFINITION_URL = 'https://example.org/forms/untitled';
/** Default breakpoint map used for preview and responsive editors. */
export const DEFAULT_THEME_BREAKPOINTS: Record<string, number> = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280
};
/** Default preview width used on project initialization. */
export const DEFAULT_PREVIEW_WIDTH = 768;

/** Creates a valid baseline Formspec definition for a new Studio project. */
export function createInitialDefinition(overrides: Partial<FormspecDefinition> = {}): FormspecDefinition {
  return {
    $formspec: '1.0',
    url: DEFAULT_DEFINITION_URL,
    version: '1.0.0',
    status: 'draft',
    title: 'Untitled Form',
    items: [],
    binds: [],
    ...overrides
  };
}

/** Creates the default component artifact synchronized to a definition. */
export function createInitialComponent(definition: FormspecDefinition): FormspecComponentDocument {
  return {
    $formspecComponent: '1.0',
    version: '1.0.0',
    targetDefinition: {
      url: definition.url
    },
    tree: rebuildComponentTreeFromDefinition(definition)
  };
}

/** Creates the default theme artifact synchronized to a definition. */
export function createInitialTheme(definition: FormspecDefinition): FormspecThemeDocument {
  return {
    $formspecTheme: '1.0',
    version: '1.0.0',
    targetDefinition: {
      url: definition.url
    },
    breakpoints: { ...DEFAULT_THEME_BREAKPOINTS },
    tokens: {},
    selectors: [],
    items: {}
  };
}

/** Creates the default mapping artifact synchronized to a definition. */
export function createInitialMapping(definition: FormspecDefinition): FormspecMappingDocument {
  const firstFieldPath = findFirstFieldPath(definition.items);
  const fallbackPath = firstFieldPath ?? 'response';
  const definitionVersion =
    typeof definition.version === 'string' && definition.version.trim().length > 0
      ? definition.version
      : '1.0.0';

  return {
    $schema: 'https://formspec.org/schemas/mapping/v1',
    version: '1.0.0',
    definitionRef: definition.url,
    definitionVersion,
    targetSchema: {
      format: 'json'
    },
    direction: 'both',
    rules: [
      {
        sourcePath: fallbackPath,
        targetPath: fallbackPath,
        transform: 'preserve',
        bidirectional: true
      }
    ]
  };
}

/** Initializes versioning state with the definition as baseline and no releases. */
export function createInitialVersioningState(definition: FormspecDefinition): ProjectVersioningState {
  return {
    baselineDefinition: structuredClone(definition),
    releases: []
  };
}

/**
 * Builds a normalized, self-consistent project state.
 * Repairs companion artifacts (component/theme/mapping/versioning) when partially seeded.
 */
export function createInitialProjectState(seed: Partial<ProjectState> = {}): ProjectState {
  const definition = structuredClone(seed.definition ?? createInitialDefinition());
  const component = structuredClone(seed.component ?? createInitialComponent(definition));
  const theme = structuredClone(seed.theme ?? createInitialTheme(definition));
  const mapping = structuredClone(seed.mapping ?? createInitialMapping(definition));
  const extensions = structuredClone(seed.extensions ?? { registries: [] });
  const versioning = structuredClone(seed.versioning ?? createInitialVersioningState(definition));
  const seedUiState = seed.uiState;

  component.targetDefinition = {
    ...component.targetDefinition,
    url: definition.url
  };

  theme.targetDefinition = {
    ...theme.targetDefinition,
    url: definition.url
  };

  mapping.definitionRef = definition.url;
  if (!mapping.definitionVersion || typeof mapping.definitionVersion !== 'string') {
    mapping.definitionVersion =
      typeof definition.version === 'string' && definition.version.trim().length > 0
        ? definition.version
        : '1.0.0';
  }
  if (!mapping.version || typeof mapping.version !== 'string') {
    mapping.version = '1.0.0';
  }
  if (!mapping.targetSchema || typeof mapping.targetSchema !== 'object') {
    mapping.targetSchema = { format: 'json' };
  }
  if (!mapping.targetSchema.format || typeof mapping.targetSchema.format !== 'string') {
    mapping.targetSchema.format = 'json';
  }
  if (!Array.isArray(mapping.rules) || mapping.rules.length === 0) {
    mapping.rules = createInitialMapping(definition).rules;
  }

  const baselineDefinition = isRecord(versioning.baselineDefinition)
    ? (versioning.baselineDefinition as FormspecDefinition)
    : definition;
  versioning.baselineDefinition = structuredClone(baselineDefinition);
  if (!Array.isArray(versioning.releases)) {
    versioning.releases = [];
  }

  const breakpoints = normalizeBreakpoints(theme.breakpoints);
  theme.breakpoints = breakpoints;
  component.breakpoints = breakpoints;

  const previewWidth = clampPreviewWidth(seedUiState?.previewWidth ?? DEFAULT_PREVIEW_WIDTH);
  const activeBreakpoint =
    seedUiState?.activeBreakpoint && breakpoints[seedUiState.activeBreakpoint] !== undefined
      ? seedUiState.activeBreakpoint
      : resolveActiveBreakpointName(breakpoints, previewWidth);
  const jsonEditorTab =
    seedUiState?.jsonEditorTab === 'component' || seedUiState?.jsonEditorTab === 'theme'
      ? seedUiState.jsonEditorTab
      : 'definition';

  return {
    definition,
    component,
    theme,
    mapping,
    extensions: {
      registries: Array.isArray(extensions.registries) ? extensions.registries : []
    },
    versioning,
    selection: seed.selection ?? null,
    uiState: {
      inspectorSections: seedUiState?.inspectorSections ?? {},
      viewMode: seedUiState?.viewMode ?? 'edit',
      structurePanelOpen: seedUiState?.structurePanelOpen ?? false,
      diagnosticsOpen: seedUiState?.diagnosticsOpen ?? false,
      mobilePanel: seedUiState?.mobilePanel ?? 'none',
      previewWidth,
      activeBreakpoint,
      jsonEditorOpen: seedUiState?.jsonEditorOpen ?? false,
      jsonEditorTab
    }
  };
}

/** Creates a writable project signal from an initial project state. */
export function createProjectSignal(initialState = createInitialProjectState()): Signal<ProjectState> {
  return signal(initialState);
}

/** Shared singleton project signal used by the Studio runtime. */
export const projectSignal = createProjectSignal();

/** Normalizes breakpoint input into a compact `{ name: minWidth }` map. */
export function normalizeBreakpoints(
  breakpoints: Record<string, unknown> | undefined,
  fallback = DEFAULT_THEME_BREAKPOINTS
): Record<string, number> {
  const normalized = Object.entries(breakpoints ?? {})
    .filter(([name, value]) => name.trim().length > 0 && Number.isFinite(value))
    .map(([name, value]) => [name, Math.max(0, Math.round(Number(value)))]);

  if (normalized.length === 0) {
    return { ...fallback };
  }

  return Object.fromEntries(normalized);
}

/** Resolves the active breakpoint name for a preview width. */
export function resolveActiveBreakpointName(
  breakpoints: Record<string, number>,
  previewWidth: number
): string {
  const entries = getSortedBreakpointEntries(breakpoints);
  if (!entries.length) {
    return 'base';
  }

  let activeName = entries[0][0];
  for (const [name, width] of entries) {
    if (previewWidth >= width) {
      activeName = name;
    }
  }

  return activeName;
}

/** Returns breakpoint entries sorted by ascending min width. */
export function getSortedBreakpointEntries(
  breakpoints: Record<string, number>
): Array<[string, number]> {
  return Object.entries(breakpoints).sort((left, right) => left[1] - right[1]);
}

/** Clamps preview width to the supported Studio viewport range. */
export function clampPreviewWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREVIEW_WIDTH;
  }

  if (value < 320) {
    return 320;
  }
  if (value > 1600) {
    return 1600;
  }
  return Math.round(value);
}

function findFirstFieldPath(items: FormspecItem[], parentPath: string | null = null): string | undefined {
  for (const item of items) {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    if (item.type === 'field') {
      return path;
    }
    if (item.type === 'group' && item.children?.length) {
      const childPath = findFirstFieldPath(item.children, path);
      if (childPath) {
        return childPath;
      }
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
