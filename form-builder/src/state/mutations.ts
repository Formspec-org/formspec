/**
 * @module Studio project mutations.
 * Each exported function applies an atomic update to `ProjectState` and keeps artifacts synchronized.
 */
import type { Signal } from '@preact/signals';
import type { FormspecBind, FormspecItem, FormspecShape, FormspecVariable } from 'formspec-engine';
import { assembleDefinitionSync, type FormspecDefinition } from 'formspec-engine';
import {
  clampPreviewWidth,
  createInitialVersioningState,
  normalizeBreakpoints,
  projectSignal,
  resolveActiveBreakpointName,
  type FormspecMappingDocument,
  type LoadedExtensionRegistry,
  type MappingRule,
  type MappingTransformType,
  type ProjectState,
  type ThemeSelectorDataType,
  type ThemeSelectorMatch,
  type ThemeSelectorRule,
  type ThemeSelectorType
} from './project';
import {
  buildComponentNodesForItems,
  collectFieldPaths,
  type GeneratedComponentNode,
  getLeafKey,
  joinPath,
  rewriteDefinitionPathReferences,
  rewritePathByMap,
  rebuildComponentTreeFromDefinition,
  toPathSegments,
  type PathRewriteMap
} from './wiring';
import { resolveFieldWidgetSelection } from './field-widgets';
import { createLoadedExtensionRegistry } from './extensions';
import {
  buildProjectStateFromImport,
  parseImportedProjectPayload,
  type ImportedPayloadKind
} from './import-export';
import {
  bumpSemverVersion,
  generateDefinitionChangelog,
  type FormspecChangelogDocument,
  type SemverImpact
} from './versioning';

/** Input contract for inserting an item into the definition tree. */
export interface AddItemInput {
  type: 'field' | 'group' | 'display';
  dataType?: FormspecItem['dataType'];
  key?: string;
  label?: string;
  parentPath?: string | null;
  index?: number;
}

/** Target position for `moveItem`. */
export interface MoveItemTarget {
  parentPath: string | null;
  index?: number;
}

/** Input contract for creating a variable definition entry. */
export interface AddVariableInput {
  name?: string;
  expression?: string;
  scope?: string;
}

/** Input contract for creating a mapping rule row. */
export interface AddMappingRuleInput extends Partial<MappingRule> {
  sourcePath?: string;
  targetPath?: string | null;
  transform?: MappingTransformType;
}

/** Input payload for loading a registry into extension state. */
export interface LoadExtensionRegistryInput {
  payload: unknown;
  sourceType: LoadedExtensionRegistry['sourceType'];
  sourceLabel: string;
}

/** Options used by the publish flow when generating changelog + version bump. */
export interface PublishVersionInput {
  bump?: SemverImpact;
  summary?: string;
  generatedAt?: string;
}

/** Input payload for sub-form import and insertion behavior. */
export interface ImportSubformInput {
  payload: unknown;
  parentPath?: string | null;
  index?: number;
  groupKey?: string;
  groupLabel?: string;
  keyPrefix?: string;
  fragment?: string;
  sourceLabel?: string;
}

/** Input payload accepted by artifact import mutations. */
export interface ImportArtifactsInput {
  payload: unknown;
}

/** Normalized result metadata from `importArtifacts`. */
export interface ImportArtifactsResult {
  kind: ImportedPayloadKind;
  templateName?: string;
}

const EMPTY_BIND_KEYS = new Set(['path']);
const SHAPE_COMPOSITION_KEYS = ['and', 'or', 'xone'] as const;
const THEME_SELECTOR_TYPES = new Set<ThemeSelectorType>(['field', 'group', 'display']);
const THEME_SELECTOR_DATA_TYPES = new Set<ThemeSelectorDataType>([
  'string',
  'text',
  'integer',
  'decimal',
  'boolean',
  'date',
  'dateTime',
  'time',
  'uri',
  'attachment',
  'choice',
  'multiChoice',
  'money'
]);
const MAPPING_TRANSFORM_TYPES = new Set<MappingTransformType>([
  'preserve',
  'drop',
  'expression',
  'coerce',
  'valueMap',
  'flatten',
  'nest',
  'constant',
  'concat',
  'split'
]);
const MAPPING_EXPRESSION_TRANSFORMS = new Set<MappingTransformType>([
  'expression',
  'constant',
  'concat',
  'split'
]);
const MAPPING_DIRECTIONS = new Set(['forward', 'reverse', 'both']);
const MAPPING_CONFORMANCE_LEVELS = new Set(['core', 'bidirectional', 'extended']);
const SUBFORM_KEY_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Adds an item to the definition tree, selects it, and rebuilds the component tree. */
export function addItem(
  project: Signal<ProjectState> = projectSignal,
  input: AddItemInput
): string {
  let insertedPath = '';

  commitProject(project, (state) => {
    const targetList = resolveItemArray(state.definition.items, input.parentPath ?? null);
    const key = ensureUniqueSiblingKey(targetList, input.key ?? defaultKeyForType(input.type));
    const item = buildItem(key, input);
    const index = clampInsertIndex(targetList, input.index);

    targetList.splice(index, 0, item);
    insertedPath = joinPath(input.parentPath ?? null, key);
    state.selection = insertedPath;

    return { rebuildComponentTree: true };
  });

  return insertedPath;
}

/** Deletes an item subtree and removes dependent binds/shapes/variables/theme item entries. */
export function deleteItem(project: Signal<ProjectState> = projectSignal, path: string): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      return {};
    }

    const [removed] = location.items.splice(location.index, 1);
    const removedPaths = collectItemPaths([removed], location.parentPath);
    const removedPrefixes = new Set(removedPaths);

    if (state.definition.binds?.length) {
      state.definition.binds = state.definition.binds.filter((bind) => !isPathRemoved(bind.path, removedPrefixes));
      if (state.definition.binds.length === 0) {
        state.definition.binds = undefined;
      }
    }

    if (state.definition.shapes?.length) {
      state.definition.shapes = state.definition.shapes.filter((shape) => {
        if (shape.target === '#') {
          return true;
        }
        return !isPathRemoved(shape.target, removedPrefixes);
      });
      if (state.definition.shapes.length === 0) {
        state.definition.shapes = undefined;
      }
    }

    if (state.definition.variables?.length) {
      state.definition.variables = state.definition.variables.filter((variable) => {
        if (!variable.scope || variable.scope === '#') {
          return true;
        }
        return !isPathRemoved(variable.scope, removedPrefixes);
      });
      if (state.definition.variables.length === 0) {
        state.definition.variables = undefined;
      }
    }

    if (state.theme.items) {
      for (const removedPath of removedPrefixes) {
        delete state.theme.items[getLeafKey(removedPath)];
      }
      if (Object.keys(state.theme.items).length === 0) {
        state.theme.items = {};
      }
    }

    if (state.selection && isPathRemoved(state.selection, removedPrefixes)) {
      state.selection = null;
    }

    return { rebuildComponentTree: true };
  });
}

/** Renames an item key and rewrites all affected path references across project artifacts. */
export function renameItem(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  newKey: string
): string {
  let nextPath = path;

  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot rename missing item at path: ${path}`);
    }

    const uniqueKey = ensureUniqueSiblingKey(location.items, newKey, location.index);
    const oldKey = location.item.key;

    if (oldKey === uniqueKey) {
      nextPath = path;
      return {};
    }

    location.item.key = uniqueKey;
    nextPath = joinPath(location.parentPath, uniqueKey);

    const rewriteMap: PathRewriteMap = {
      [path]: nextPath
    };

    state.definition = rewriteDefinitionPathReferences(state.definition, rewriteMap);

    if (state.selection) {
      state.selection = rewritePathByMap(state.selection, rewriteMap);
    }

    if (state.theme.items && oldKey in state.theme.items) {
      state.theme.items[uniqueKey] = state.theme.items[oldKey];
      delete state.theme.items[oldKey];
    }

    return { rebuildComponentTree: true };
  });

  return nextPath;
}

/** Moves an item to a new parent/index and rewrites downstream path references when needed. */
export function moveItem(
  project: Signal<ProjectState> = projectSignal,
  fromPath: string,
  target: MoveItemTarget | string
): string {
  let movedPath = fromPath;

  commitProject(project, (state) => {
    const source = findItemLocation(state.definition.items, fromPath);
    if (!source) {
      throw new Error(`Cannot move missing item at path: ${fromPath}`);
    }

    const destination = resolveMoveTarget(state.definition.items, target);
    if (destination.parentPath && isSubPath(destination.parentPath, fromPath)) {
      throw new Error(`Cannot move an item into its own descendant: ${fromPath} -> ${destination.parentPath}`);
    }

    const destinationList = resolveItemArray(state.definition.items, destination.parentPath);
    let destinationIndex = clampInsertIndex(destinationList, destination.index);
    if (source.items === destinationList && source.index < destinationIndex) {
      destinationIndex -= 1;
    }

    const [item] = source.items.splice(source.index, 1);

    destinationList.splice(destinationIndex, 0, item);

    movedPath = joinPath(destination.parentPath, item.key);
    if (movedPath !== fromPath) {
      const rewriteMap: PathRewriteMap = {
        [fromPath]: movedPath
      };
      state.definition = rewriteDefinitionPathReferences(state.definition, rewriteMap);
      if (state.selection) {
        state.selection = rewritePathByMap(state.selection, rewriteMap);
      }
    }

    return { rebuildComponentTree: true };
  });

  return movedPath;
}

/** Mutable bind keys supported by `setBind`. */
export type BindProperty = Exclude<keyof FormspecBind, 'path'>;

/** Sets or clears a bind property for a path and garbage-collects empty binds. */
export function setBind(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  property: BindProperty,
  value: FormspecBind[BindProperty] | null | undefined
): void {
  commitProject(project, (state) => {
    const binds = state.definition.binds ? [...state.definition.binds] : [];
    let bindIndex = binds.findIndex((entry) => entry.path === path);

    const shouldRemove = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

    if (bindIndex < 0 && shouldRemove) {
      return {};
    }

    if (bindIndex < 0) {
      binds.push({ path });
      bindIndex = binds.length - 1;
    }

    const nextBind: FormspecBind = { ...binds[bindIndex] };
    if (shouldRemove) {
      delete (nextBind as Record<string, unknown>)[property];
    } else {
      (nextBind as Record<string, unknown>)[property] = value;
    }

    if (isEmptyBind(nextBind)) {
      binds.splice(bindIndex, 1);
    } else {
      binds[bindIndex] = nextBind;
    }

    state.definition.binds = binds.length ? binds : undefined;
    return {};
  });
}

/** Sets presentation overrides on either the definition item or theme item map. */
export function setPresentation(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  block: Record<string, unknown> | null,
  target: 'theme' | 'definition' = 'theme'
): void {
  commitProject(project, (state) => {
    if (target === 'definition') {
      const location = findItemLocation(state.definition.items, path);
      if (!location) {
        throw new Error(`Cannot set presentation for missing item at path: ${path}`);
      }

      if (!block || Object.keys(block).length === 0) {
        delete location.item.presentation;
      } else {
        location.item.presentation = block;
      }
      return {};
    }

    const itemKey = getLeafKey(path);
    const nextItems = { ...(state.theme.items ?? {}) };
    if (!block || Object.keys(block).length === 0) {
      delete nextItems[itemKey];
    } else {
      nextItems[itemKey] = block;
    }
    state.theme.items = nextItems;

    return {};
  });
}

/** Sets the form title, falling back to `Untitled Form` when empty. */
export function setFormTitle(project: Signal<ProjectState> = projectSignal, title: string): void {
  commitProject(project, (state) => {
    const normalized = title.trim();
    state.definition.title = normalized.length > 0 ? normalized : 'Untitled Form';
    return {};
  });
}

/** Updates current selection path used by the surface and inspector. */
export function setSelection(project: Signal<ProjectState> = projectSignal, path: string | null): void {
  commitProject(project, (state) => {
    state.selection = path;
    return {};
  });
}

/** Toggles persisted inspector section expansion state. */
export function setInspectorSectionOpen(
  project: Signal<ProjectState> = projectSignal,
  sectionKey: string,
  open: boolean
): void {
  commitProject(project, (state) => {
    state.uiState.inspectorSections = {
      ...state.uiState.inspectorSections,
      [sectionKey]: open
    };
    return {};
  });
}

/** Sets label/description/hint text on an item with normalization rules. */
export function setItemText(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  property: 'label' | 'description' | 'hint',
  value: string
): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot set ${property} for missing item at path: ${path}`);
    }

    const normalized = value.trim();
    if (property === 'label') {
      location.item.label = normalized || fallbackLabelForType(location.item.type);
      return {};
    }

    if (!normalized) {
      delete location.item[property];
    } else {
      location.item[property] = normalized;
    }

    return {};
  });
}

/** Replaces normalized options for choice and multi-choice fields. */
export function setFieldOptions(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  options: Array<{ value: string; label: string }>
): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot set options for missing item at path: ${path}`);
    }
    if (location.item.type !== 'field') {
      throw new Error(`Cannot set options on non-field item at path: ${path}`);
    }
    if (location.item.dataType !== 'choice' && location.item.dataType !== 'multiChoice') {
      throw new Error(`Cannot set options on non-choice field at path: ${path}`);
    }

    const normalized = options
      .map((option) => ({
        value: option.value.trim(),
        label: option.label.trim()
      }))
      .filter((option) => option.value.length > 0 || option.label.length > 0)
      .map((option) => ({
        value: option.value || option.label,
        label: option.label || option.value
      }));

    if (normalized.length === 0) {
      delete location.item.options;
    } else {
      location.item.options = normalized;
    }
    return {};
  });
}

/** Sets or clears an arbitrary item property. */
export function setItemProperty(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  property: string,
  value: unknown
): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot set ${property} for missing item at path: ${path}`);
    }

    const normalized = normalizeOptionalValue(value);
    if (normalized === undefined) {
      delete (location.item as Record<string, unknown>)[property];
    } else {
      (location.item as Record<string, unknown>)[property] = normalized;
    }

    return {};
  });
}

/** Sets or clears an `x-*` extension entry on a definition item. */
export function setItemExtension(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  extensionName: string,
  value: unknown
): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot set extension for missing item at path: ${path}`);
    }

    const normalizedName = extensionName.trim();
    if (!normalizedName.startsWith('x-')) {
      throw new Error(`Invalid extension key: ${extensionName}`);
    }

    const extensions = {
      ...(location.item.extensions ?? {})
    };
    const normalizedValue = normalizeOptionalValue(value);
    if (normalizedValue === undefined) {
      delete extensions[normalizedName];
    } else {
      extensions[normalizedName] = normalizedValue;
    }

    if (Object.keys(extensions).length === 0) {
      delete location.item.extensions;
    } else {
      location.item.extensions = extensions;
    }

    return {};
  });
}

/** Sets or clears a top-level definition property. */
export function setDefinitionProperty(
  project: Signal<ProjectState> = projectSignal,
  property: string,
  value: unknown
): void {
  commitProject(project, (state) => {
    const normalized = normalizeOptionalValue(value);
    if (normalized === undefined) {
      delete (state.definition as Record<string, unknown>)[property];
    } else {
      (state.definition as Record<string, unknown>)[property] = normalized;
    }
    return {};
  });
}

/** Artifact tab identifier used by JSON editor mutations. */
export type JsonArtifactKey = ProjectState['uiState']['jsonEditorTab'];

/** Applies a full artifact document update from the JSON editor. */
export function setJsonDocument(
  project: Signal<ProjectState> = projectSignal,
  artifact: JsonArtifactKey,
  value: unknown
): void {
  commitProject(project, (state) => {
    if (!isRecord(value)) {
      throw new Error('JSON editor payload must be an object document.');
    }

    if (artifact === 'definition') {
      state.definition = value as ProjectState['definition'];
      if (state.selection && !findItemLocation(state.definition.items ?? [], state.selection)) {
        state.selection = null;
      }
      return {};
    }

    if (artifact === 'component') {
      state.component = value as ProjectState['component'];
      return {};
    }

    state.theme = value as ProjectState['theme'];
    return {};
  });
}

/** Parses import payload and applies resulting artifacts to project state. */
export function importArtifacts(
  project: Signal<ProjectState> = projectSignal,
  input: ImportArtifactsInput
): ImportArtifactsResult {
  const parsed = parseImportedProjectPayload(input.payload);
  project.value = buildProjectStateFromImport(project.value, parsed);
  return {
    kind: parsed.kind,
    templateName: parsed.templateName
  };
}

/** Creates changelog/release metadata, bumps version, and resets versioning baseline. */
export function publishVersion(
  project: Signal<ProjectState> = projectSignal,
  input: PublishVersionInput = {}
): FormspecChangelogDocument {
  let publishedChangelog: FormspecChangelogDocument | null = null;

  commitProject(project, (state) => {
    const versioningState = ensureVersioningState(state);
    const bump = input.bump ?? 'patch';
    const nextVersion = bumpSemverVersion(state.definition.version, bump);
    const nextDefinition = structuredClone(state.definition);
    nextDefinition.version = nextVersion;

    const changelog = generateDefinitionChangelog(
      versioningState.baselineDefinition,
      nextDefinition,
      nextDefinition.url,
      {
        summary: normalizeOptionalString(input.summary),
        generatedAt: normalizeOptionalString(input.generatedAt)
      }
    );

    state.definition.version = nextVersion;
    state.component.version = nextVersion;
    state.theme.version = nextVersion;
    state.mapping.definitionVersion = nextVersion;

    const publishedAt = changelog.generatedAt;
    versioningState.baselineDefinition = structuredClone(nextDefinition);
    versioningState.releases = [
      ...versioningState.releases,
      {
        version: nextVersion,
        publishedAt,
        changelog
      }
    ];

    publishedChangelog = changelog;
    return {};
  });

  if (!publishedChangelog) {
    throw new Error('Failed to publish version');
  }
  return publishedChangelog;
}

/** Validates and appends an extension registry to project state. */
export function loadExtensionRegistry(
  project: Signal<ProjectState> = projectSignal,
  input: LoadExtensionRegistryInput
): string {
  const loadedRegistry = createLoadedExtensionRegistry(input.payload, input.sourceType, input.sourceLabel);

  commitProject(project, (state) => {
    const registries = state.extensions.registries.filter((registry) => registry.id !== loadedRegistry.id);
    registries.push(loadedRegistry);
    state.extensions.registries = registries;
    return {};
  });

  return loadedRegistry.id;
}

/** Imports a group fragment and inserts it into the definition/component tree. */
export function importSubform(
  project: Signal<ProjectState> = projectSignal,
  input: ImportSubformInput
): string {
  const referencedDefinition = parseImportedDefinition(input.payload);
  let insertedPath = '';

  commitProject(project, (state) => {
    const targetList = resolveItemArray(state.definition.items, input.parentPath ?? null);
    const requestedGroupKey = input.groupKey?.trim() || deriveSubformGroupKey(referencedDefinition);
    const groupKey = ensureUniqueSiblingKey(targetList, requestedGroupKey);
    const groupLabel =
      normalizeOptionalString(input.groupLabel) ||
      normalizeOptionalString(referencedDefinition.title) ||
      'Imported sub-form';
    const fragment = normalizeSubformFragment(input.fragment);
    const keyPrefix = normalizeSubformKeyPrefix(input.keyPrefix, groupKey);
    const ref = buildSubformRef(referencedDefinition.url, referencedDefinition.version, fragment);
    const importedAt = new Date().toISOString();

    const draftDefinition = structuredClone(state.definition);
    const draftTargetList = resolveItemArray(draftDefinition.items, input.parentPath ?? null);
    const targetIndex = clampInsertIndex(draftTargetList, input.index);
    draftTargetList.splice(targetIndex, 0, {
      type: 'group',
      key: groupKey,
      label: groupLabel,
      $ref: ref,
      keyPrefix
    });

    const assembled = assembleDefinitionSync(draftDefinition, (url, version) => {
      if (url !== referencedDefinition.url) {
        throw new Error(
          `Unable to resolve nested sub-form reference "${url}". Import a fully assembled definition first.`
        );
      }
      if (version && version !== referencedDefinition.version) {
        throw new Error(
          `Sub-form version mismatch for "${url}". Expected ${referencedDefinition.version}, received ${version}.`
        );
      }
      return structuredClone(referencedDefinition);
    });

    insertedPath = joinPath(input.parentPath ?? null, groupKey);
    const insertedLocation = findItemLocation(assembled.definition.items, insertedPath);
    if (!insertedLocation || insertedLocation.item.type !== 'group') {
      throw new Error(`Failed to locate imported sub-form group at path: ${insertedPath}`);
    }

    const existingExtensions = isRecord(insertedLocation.item.extensions)
      ? { ...insertedLocation.item.extensions }
      : {};
    existingExtensions['x-linkedSubform'] = {
      ref,
      url: referencedDefinition.url,
      version: referencedDefinition.version,
      fragment,
      keyPrefix,
      sourceLabel: normalizeOptionalString(input.sourceLabel),
      importedAt
    };
    insertedLocation.item.extensions = existingExtensions;

    state.definition = assembled.definition;
    state.selection = insertedPath;
    return { rebuildComponentTree: true };
  });

  return insertedPath;
}

/** Removes a loaded extension registry by id. */
export function removeExtensionRegistry(project: Signal<ProjectState> = projectSignal, registryId: string): void {
  commitProject(project, (state) => {
    state.extensions.registries = state.extensions.registries.filter((registry) => registry.id !== registryId);
    return {};
  });
}

/** Sets or clears a `formPresentation` property on the definition. */
export function setFormPresentationProperty(
  project: Signal<ProjectState> = projectSignal,
  property: string,
  value: unknown
): void {
  commitProject(project, (state) => {
    const current = state.definition.formPresentation as Record<string, unknown> | undefined;
    const next = { ...(current ?? {}) };
    const normalized = normalizeOptionalValue(value);

    if (normalized === undefined) {
      delete next[property];
    } else {
      next[property] = normalized;
    }

    state.definition.formPresentation = Object.keys(next).length > 0 ? next : undefined;
    return {};
  });
}

/** Appends a new variable entry and returns its index. */
export function addVariable(
  project: Signal<ProjectState> = projectSignal,
  input: AddVariableInput = {}
): number {
  let variableIndex = -1;

  commitProject(project, (state) => {
    const variables = state.definition.variables ? [...state.definition.variables] : [];
    const requestedName = input.name?.trim() || 'variable';
    const variable: FormspecVariable = {
      name: ensureUniqueVariableName(variables, requestedName),
      expression: input.expression ?? 'null'
    };
    const normalizedScope = normalizeVariableScope(input.scope);
    if (normalizedScope !== undefined) {
      variable.scope = normalizedScope;
    }

    variables.push(variable);
    state.definition.variables = variables;
    variableIndex = variables.length - 1;
    return {};
  });

  return variableIndex;
}

/** Sets variable name at index. */
export function setVariableName(
  project: Signal<ProjectState> = projectSignal,
  variableIndex: number,
  name: string
): void {
  commitProject(project, (state) => {
    const variables = state.definition.variables ? [...state.definition.variables] : [];
    if (variableIndex < 0 || variableIndex >= variables.length) {
      return {};
    }

    const nextVariable = { ...variables[variableIndex], name: name.trim() };
    variables[variableIndex] = nextVariable;
    state.definition.variables = variables.length > 0 ? variables : undefined;
    return {};
  });
}

/** Sets variable FEL expression at index. */
export function setVariableExpression(
  project: Signal<ProjectState> = projectSignal,
  variableIndex: number,
  expression: string
): void {
  commitProject(project, (state) => {
    const variables = state.definition.variables ? [...state.definition.variables] : [];
    if (variableIndex < 0 || variableIndex >= variables.length) {
      return {};
    }

    const nextVariable = { ...variables[variableIndex], expression };
    variables[variableIndex] = nextVariable;
    state.definition.variables = variables.length > 0 ? variables : undefined;
    return {};
  });
}

/** Sets variable scope path (`#` for global) at index. */
export function setVariableScope(
  project: Signal<ProjectState> = projectSignal,
  variableIndex: number,
  scope: string
): void {
  commitProject(project, (state) => {
    const variables = state.definition.variables ? [...state.definition.variables] : [];
    if (variableIndex < 0 || variableIndex >= variables.length) {
      return {};
    }

    const nextVariable = { ...variables[variableIndex] };
    const normalizedScope = normalizeVariableScope(scope);
    if (normalizedScope === undefined) {
      delete nextVariable.scope;
    } else {
      nextVariable.scope = normalizedScope;
    }

    variables[variableIndex] = nextVariable;
    state.definition.variables = variables.length > 0 ? variables : undefined;
    return {};
  });
}

/** Deletes a variable entry by index. */
export function deleteVariable(
  project: Signal<ProjectState> = projectSignal,
  variableIndex: number
): void {
  commitProject(project, (state) => {
    const variables = state.definition.variables ? [...state.definition.variables] : [];
    if (variableIndex < 0 || variableIndex >= variables.length) {
      return {};
    }

    variables.splice(variableIndex, 1);
    state.definition.variables = variables.length > 0 ? variables : undefined;
    return {};
  });
}

/** Top-level mapping properties editable by `setMappingProperty`. */
export type MappingProperty = 'version' | 'definitionVersion' | 'direction' | 'conformanceLevel' | 'autoMap';
/** Target schema key editable by `setMappingTargetSchemaProperty`. */
export type MappingTargetSchemaProperty = keyof FormspecMappingDocument['targetSchema'];
/** Mapping rule key editable by `setMappingRuleProperty`. */
export type MappingRuleProperty = keyof MappingRule;

/** Sets or clears a top-level mapping document property. */
export function setMappingProperty(
  project: Signal<ProjectState> = projectSignal,
  property: MappingProperty,
  value: unknown
): void {
  commitProject(project, (state) => {
    if (property === 'autoMap') {
      state.mapping.autoMap = Boolean(value);
      return {};
    }

    const normalized = normalizeOptionalValue(value);
    if (normalized === undefined) {
      delete (state.mapping as Record<string, unknown>)[property];
      return {};
    }

    (state.mapping as Record<string, unknown>)[property] = normalized;
    return {};
  });
}

/** Sets or clears a mapping target-schema property. */
export function setMappingTargetSchemaProperty(
  project: Signal<ProjectState> = projectSignal,
  property: MappingTargetSchemaProperty,
  value: unknown
): void {
  commitProject(project, (state) => {
    const nextTargetSchema = { ...(state.mapping.targetSchema ?? { format: 'json' }) };
    if (property === 'namespaces') {
      if (isRecord(value)) {
        const namespaces = Object.fromEntries(
          Object.entries(value)
            .filter(([key, entry]) => key.trim().length > 0 && typeof entry === 'string' && entry.trim().length > 0)
            .map(([key, entry]) => [key.trim(), entry.trim()])
        );
        if (Object.keys(namespaces).length > 0) {
          nextTargetSchema.namespaces = namespaces;
        } else {
          delete nextTargetSchema.namespaces;
        }
      } else {
        delete nextTargetSchema.namespaces;
      }

      state.mapping.targetSchema = nextTargetSchema;
      return {};
    }

    const normalized = normalizeOptionalValue(value);
    if (normalized === undefined) {
      delete (nextTargetSchema as Record<string, unknown>)[property];
    } else {
      (nextTargetSchema as Record<string, unknown>)[property] = normalized;
    }

    state.mapping.targetSchema = nextTargetSchema;
    return {};
  });
}

/** Appends a mapping rule with defaults and returns its index. */
export function addMappingRule(
  project: Signal<ProjectState> = projectSignal,
  input: AddMappingRuleInput = {}
): number {
  let ruleIndex = -1;

  commitProject(project, (state) => {
    const rules = state.mapping.rules ? [...state.mapping.rules] : [];
    const defaultPath = collectFieldPaths(state.definition.items)[0] ?? 'response';
    const rule = normalizeMappingRule({
      sourcePath: input.sourcePath ?? defaultPath,
      targetPath: input.targetPath ?? input.sourcePath ?? defaultPath,
      transform: input.transform ?? 'preserve',
      bidirectional: input.bidirectional ?? true,
      ...input
    });

    rules.push(rule);
    state.mapping.rules = rules;
    ruleIndex = rules.length - 1;
    return {};
  });

  return ruleIndex;
}

/** Sets or clears a property on a mapping rule row. */
export function setMappingRuleProperty(
  project: Signal<ProjectState> = projectSignal,
  ruleIndex: number,
  property: MappingRuleProperty,
  value: unknown
): void {
  commitProject(project, (state) => {
    const rules = state.mapping.rules ? [...state.mapping.rules] : [];
    const currentRule = rules[ruleIndex];
    if (!currentRule) {
      return {};
    }

    const nextRule: MappingRule = { ...currentRule };

    if (property === 'transform') {
      nextRule.transform = normalizeMappingTransform(value);
      applyMappingRuleTransformDefaults(nextRule);
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    if (property === 'sourcePath') {
      const normalizedSource = normalizeMappingPath(value);
      if (normalizedSource === undefined) {
        delete nextRule.sourcePath;
      } else {
        nextRule.sourcePath = normalizedSource;
      }
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    if (property === 'targetPath') {
      if (value === null) {
        nextRule.targetPath = null;
      } else {
        const normalizedTarget = normalizeMappingPath(value);
        if (normalizedTarget === undefined) {
          delete nextRule.targetPath;
        } else {
          nextRule.targetPath = normalizedTarget;
        }
      }
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    if (property === 'priority' || property === 'reversePriority') {
      const nextNumber = normalizeOptionalNumber(value);
      if (nextNumber === undefined) {
        delete (nextRule as Record<string, unknown>)[property];
      } else {
        (nextRule as Record<string, unknown>)[property] = nextNumber;
      }
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    if (property === 'bidirectional') {
      if (typeof value === 'boolean') {
        nextRule.bidirectional = value;
      } else {
        delete nextRule.bidirectional;
      }
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    if (property === 'valueMap') {
      if (isRecord(value) && Object.keys(value).length > 0) {
        nextRule.valueMap = value;
      } else {
        delete nextRule.valueMap;
      }
      rules[ruleIndex] = nextRule;
      state.mapping.rules = rules;
      return {};
    }

    const normalized = normalizeOptionalValue(value);
    if (normalized === undefined) {
      delete (nextRule as Record<string, unknown>)[property];
    } else {
      (nextRule as Record<string, unknown>)[property] = normalized;
    }

    applyMappingRuleTransformDefaults(nextRule);
    rules[ruleIndex] = nextRule;
    state.mapping.rules = rules;
    return {};
  });
}

/** Deletes a mapping rule and ensures at least one default rule remains. */
export function deleteMappingRule(
  project: Signal<ProjectState> = projectSignal,
  ruleIndex: number
): void {
  commitProject(project, (state) => {
    const rules = state.mapping.rules ? [...state.mapping.rules] : [];
    if (ruleIndex < 0 || ruleIndex >= rules.length) {
      return {};
    }

    rules.splice(ruleIndex, 1);
    if (rules.length === 0) {
      const defaultPath = collectFieldPaths(state.definition.items)[0] ?? 'response';
      state.mapping.rules = [
        normalizeMappingRule({
          sourcePath: defaultPath,
          targetPath: defaultPath,
          transform: 'preserve',
          bidirectional: true
        })
      ];
      return {};
    }

    state.mapping.rules = rules;
    return {};
  });
}

/** Sets or clears a theme design token value. */
export function setThemeToken(
  project: Signal<ProjectState> = projectSignal,
  tokenKey: string,
  value: string | number | null | undefined
): void {
  commitProject(project, (state) => {
    const normalizedKey = tokenKey.trim();
    if (!normalizedKey) {
      return {};
    }

    const next = { ...(state.theme.tokens ?? {}) };
    const normalizedValue =
      typeof value === 'string'
        ? value.trim()
        : value;

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
      delete next[normalizedKey];
    } else {
      next[normalizedKey] = normalizedValue;
    }

    state.theme.tokens = next;
    return {};
  });
}

/** Adds a theme selector rule and returns its index. */
export function addThemeSelector(
  project: Signal<ProjectState> = projectSignal,
  input: Partial<ThemeSelectorRule> = {}
): number {
  let selectorIndex = -1;

  commitProject(project, (state) => {
    const selectors = [...(state.theme.selectors ?? [])];
    selectors.push(normalizeThemeSelector(input));
    state.theme.selectors = selectors;
    selectorIndex = selectors.length - 1;
    return {};
  });

  return selectorIndex;
}

/** Selector match fields editable in theme selector rules. */
export type ThemeSelectorMatchProperty = keyof ThemeSelectorMatch;

/** Sets selector match criteria with validation against allowed type values. */
export function setThemeSelectorMatchProperty(
  project: Signal<ProjectState> = projectSignal,
  selectorIndex: number,
  property: ThemeSelectorMatchProperty,
  value: string | null | undefined
): void {
  commitProject(project, (state) => {
    const selectors = [...(state.theme.selectors ?? [])];
    const currentSelector = selectors[selectorIndex];
    if (!currentSelector) {
      return {};
    }

    const nextSelector = normalizeThemeSelector(currentSelector);
    const nextMatch = { ...nextSelector.match };

    if (property === 'type') {
      const normalizedType = normalizeThemeSelectorType(value);
      if (normalizedType === undefined) {
        delete nextMatch.type;
      } else {
        nextMatch.type = normalizedType;
      }
      if (normalizedType && normalizedType !== 'field') {
        delete nextMatch.dataType;
      }
    } else {
      const normalizedDataType = normalizeThemeSelectorDataType(value);
      if (normalizedDataType === undefined) {
        delete nextMatch.dataType;
      } else {
        nextMatch.dataType = normalizedDataType;
        if (nextMatch.type === undefined) {
          nextMatch.type = 'field';
        }
      }
    }

    nextSelector.match = ensureThemeSelectorMatch(nextMatch);
    selectors[selectorIndex] = nextSelector;
    state.theme.selectors = selectors;
    return {};
  });
}

/** Sets or clears a selector `apply` presentation property. */
export function setThemeSelectorApplyProperty(
  project: Signal<ProjectState> = projectSignal,
  selectorIndex: number,
  property: string,
  value: unknown
): void {
  commitProject(project, (state) => {
    const selectors = [...(state.theme.selectors ?? [])];
    const currentSelector = selectors[selectorIndex];
    if (!currentSelector) {
      return {};
    }

    const nextSelector = normalizeThemeSelector(currentSelector);
    const nextApply = { ...nextSelector.apply };
    const normalizedValue = normalizeOptionalValue(value);

    if (normalizedValue === undefined) {
      delete nextApply[property];
    } else {
      nextApply[property] = normalizedValue;
    }

    nextSelector.apply = nextApply;
    selectors[selectorIndex] = nextSelector;
    state.theme.selectors = selectors;
    return {};
  });
}

/** Deletes a theme selector rule by index. */
export function deleteThemeSelector(
  project: Signal<ProjectState> = projectSignal,
  selectorIndex: number
): void {
  commitProject(project, (state) => {
    const selectors = [...(state.theme.selectors ?? [])];
    if (selectorIndex < 0 || selectorIndex >= selectors.length) {
      return {};
    }

    selectors.splice(selectorIndex, 1);
    state.theme.selectors = selectors;
    return {};
  });
}

/** Sets or removes a theme breakpoint and recomputes active breakpoint. */
export function setThemeBreakpoint(
  project: Signal<ProjectState> = projectSignal,
  breakpointName: string,
  minWidth: number | null | undefined
): void {
  commitProject(project, (state) => {
    const name = breakpointName.trim();
    if (!name) {
      return {};
    }

    const nextBreakpoints = normalizeBreakpoints(state.theme.breakpoints);
    if (minWidth === null || minWidth === undefined || !Number.isFinite(minWidth)) {
      delete nextBreakpoints[name];
    } else {
      nextBreakpoints[name] = Math.max(0, Math.round(minWidth));
    }

    state.theme.breakpoints = normalizeBreakpoints(nextBreakpoints);
    state.uiState.activeBreakpoint = resolveActiveBreakpointName(
      state.theme.breakpoints,
      state.uiState.previewWidth
    );
    return {};
  });
}

/** Sets preview width and recomputes active breakpoint. */
export function setPreviewWidth(project: Signal<ProjectState> = projectSignal, width: number): void {
  commitProject(project, (state) => {
    const normalizedWidth = clampPreviewWidth(width);
    state.uiState.previewWidth = normalizedWidth;
    state.uiState.activeBreakpoint = resolveActiveBreakpointName(state.theme.breakpoints ?? {}, normalizedWidth);
    return {};
  });
}

/** Sets active breakpoint when it exists in theme breakpoints. */
export function setActiveBreakpoint(project: Signal<ProjectState> = projectSignal, breakpointName: string): void {
  commitProject(project, (state) => {
    const normalized = breakpointName.trim();
    if (!normalized) {
      return {};
    }

    if ((state.theme.breakpoints ?? {})[normalized] === undefined) {
      return {};
    }

    state.uiState.activeBreakpoint = normalized;
    return {};
  });
}

/** Opens or closes the JSON editor and optionally switches tabs. */
export function setJsonEditorOpen(
  project: Signal<ProjectState> = projectSignal,
  open: boolean,
  tab?: JsonArtifactKey
): void {
  commitProject(project, (state) => {
    state.uiState.jsonEditorOpen = open;
    if (tab) {
      state.uiState.jsonEditorTab = tab;
    }
    return {};
  });
}

/** Toggles JSON editor visibility and optionally switches tabs. */
export function toggleJsonEditor(
  project: Signal<ProjectState> = projectSignal,
  tab?: JsonArtifactKey
): void {
  commitProject(project, (state) => {
    state.uiState.jsonEditorOpen = !state.uiState.jsonEditorOpen;
    if (tab) {
      state.uiState.jsonEditorTab = tab;
    }
    return {};
  });
}

/** Sets active JSON editor artifact tab. */
export function setJsonEditorTab(
  project: Signal<ProjectState> = projectSignal,
  tab: JsonArtifactKey
): void {
  commitProject(project, (state) => {
    state.uiState.jsonEditorTab = tab;
    return {};
  });
}

/** Patch object for responsive override editing. */
export interface ResponsiveOverridePatch {
  span?: number | null;
  start?: number | null;
  hidden?: boolean | null;
}

/** Supported group renderer display modes. */
export type GroupDisplayMode = 'stack' | 'table';

/** Data table column configuration for repeating-group table mode. */
export interface GroupDataTableColumn {
  bind: string;
  header: string;
  min?: number;
  max?: number;
  step?: number;
}

/** Patch object for group data table settings. */
export interface GroupDataTablePatch {
  columns?: GroupDataTableColumn[] | null;
  showRowNumbers?: boolean | null;
  allowAdd?: boolean | null;
  allowRemove?: boolean | null;
  sortable?: boolean | null;
  filterable?: boolean | null;
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
}

/** Applies responsive override patch to a component node at a breakpoint. */
export function setComponentResponsiveOverride(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  breakpointName: string,
  patch: ResponsiveOverridePatch
): void {
  commitProject(project, (state) => {
    const name = breakpointName.trim();
    if (!name) {
      return {};
    }

    const node = findComponentNodeByPath(state.definition.items, state.component.tree, path);
    if (!node) {
      return {};
    }

    const responsive = { ...(node.responsive as Record<string, Record<string, unknown>> | undefined) };
    const nextOverride = { ...(responsive[name] ?? {}) };

    if ('span' in patch) {
      applyResponsiveNumber(nextOverride, 'span', patch.span, 1, 12);
    }
    if ('start' in patch) {
      applyResponsiveNumber(nextOverride, 'start', patch.start, 1, 12);
    }
    if ('hidden' in patch) {
      applyResponsiveBoolean(nextOverride, 'hidden', patch.hidden);
    }

    if (Object.keys(nextOverride).length === 0) {
      delete responsive[name];
    } else {
      responsive[name] = nextOverride;
    }

    if (Object.keys(responsive).length === 0) {
      delete node.responsive;
    } else {
      node.responsive = responsive;
    }

    return {};
  });
}

/** Sets the rendered widget component for a field item. */
export function setFieldWidgetComponent(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  widget: string
): void {
  commitProject(project, (state) => {
    const location = findItemLocation(state.definition.items, path);
    if (!location) {
      throw new Error(`Cannot set widget for missing item at path: ${path}`);
    }
    if (location.item.type !== 'field') {
      throw new Error(`Cannot set widget for non-field item at path: ${path}`);
    }

    const node = findComponentNodeByPath(state.definition.items, state.component.tree, path);
    if (!node) {
      return {};
    }

    node.component = resolveFieldWidgetSelection(location.item.dataType, widget);
    return {};
  });
}

/** Switches a repeating group between stack and data-table component modes. */
export function setGroupDisplayMode(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  mode: GroupDisplayMode
): void {
  commitProject(project, (state) => {
    const context = findGroupContext(state, path);
    if (!context) {
      throw new Error(`Cannot set display mode for missing group at path: ${path}`);
    }

    if (mode === 'table') {
      context.item.repeatable = true;
      applyDataTableMode(context.node, context.item, path);
    } else {
      applyStackMode(context.node, context.item, path);
    }

    return {};
  });
}

/** Applies data-table configuration on a repeating group component node. */
export function setGroupDataTableConfig(
  project: Signal<ProjectState> = projectSignal,
  path: string,
  patch: GroupDataTablePatch
): void {
  commitProject(project, (state) => {
    const context = findGroupContext(state, path);
    if (!context) {
      throw new Error(`Cannot set data table config for missing group at path: ${path}`);
    }

    context.item.repeatable = true;
    applyDataTableMode(context.node, context.item, path);

    const nextNode = context.node;
    const groupFields = listGroupFieldOptions(context.item);

    if ('columns' in patch) {
      const nextColumns = patch.columns ?? [];
      nextNode.columns = sanitizeDataTableColumns(nextColumns, groupFields);
    }
    if ('showRowNumbers' in patch) {
      applyOptionalBoolean(nextNode, 'showRowNumbers', patch.showRowNumbers);
    }
    if ('allowAdd' in patch) {
      applyOptionalBoolean(nextNode, 'allowAdd', patch.allowAdd);
    }
    if ('allowRemove' in patch) {
      applyOptionalBoolean(nextNode, 'allowRemove', patch.allowRemove);
    }
    if ('sortable' in patch) {
      applyOptionalBoolean(nextNode, 'sortable', patch.sortable);
    }
    if ('filterable' in patch) {
      applyOptionalBoolean(nextNode, 'filterable', patch.filterable);
    }
    if ('sortBy' in patch) {
      applyOptionalString(nextNode, 'sortBy', patch.sortBy);
    }
    if ('sortDirection' in patch) {
      applyOptionalSortDirection(nextNode, patch.sortDirection);
    }

    const selectedKeys = new Set((nextNode.columns ?? []).map((column) => column.bind));
    if (nextNode.sortBy && !selectedKeys.has(nextNode.sortBy)) {
      delete nextNode.sortBy;
    }
    if (nextNode.sortable !== true) {
      delete nextNode.sortBy;
      delete nextNode.sortDirection;
    } else if (!nextNode.sortDirection) {
      nextNode.sortDirection = 'asc';
    }

    if (!nextNode.columns?.length) {
      delete nextNode.sortBy;
    }

    return {};
  });
}

/** Input contract for creating a shape rule. */
export interface AddShapeInput {
  name?: string;
  id?: string;
  target?: string;
  message?: string;
  constraint?: string;
  severity?: FormspecShape['severity'];
}

/** Mutable shape keys accepted by `setShapeProperty`. */
export type ShapeProperty = Exclude<keyof FormspecShape, 'id'>;

/** Adds a new shape rule and returns its generated id. */
export function addShape(
  project: Signal<ProjectState> = projectSignal,
  input: AddShapeInput = {}
): string {
  let nextShapeId = '';

  commitProject(project, (state) => {
    const shapes = state.definition.shapes ? [...state.definition.shapes] : [];
    const candidateId = normalizeShapeId(input.id ?? input.name ?? 'rule');
    const shapeId = ensureUniqueShapeId(
      new Set(shapes.map((shape) => shape.id)),
      candidateId
    );

    const shape: FormspecShape = {
      id: shapeId,
      target: normalizeTarget(input.target),
      severity: input.severity ?? 'error',
      constraint: normalizeShapeString(input.constraint) ?? 'true',
      message: normalizeShapeString(input.message) ?? 'Rule failed.'
    };

    shapes.push(shape);
    state.definition.shapes = shapes;
    nextShapeId = shapeId;
    return {};
  });

  return nextShapeId;
}

/** Sets or clears a shape property while preserving composition invariants. */
export function setShapeProperty(
  project: Signal<ProjectState> = projectSignal,
  shapeId: string,
  property: ShapeProperty,
  value: FormspecShape[ShapeProperty] | null | undefined
): void {
  commitProject(project, (state) => {
    const shapes = state.definition.shapes ? [...state.definition.shapes] : [];
    const shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    if (shapeIndex < 0) {
      return {};
    }

    const nextShape = { ...shapes[shapeIndex] };
    applyShapeProperty(nextShape, property, value);
    shapes[shapeIndex] = ensureShapeHasConstraintOrComposition(nextShape);
    state.definition.shapes = shapes.length > 0 ? shapes : undefined;
    return {};
  });
}

/** Renames a shape id and rewrites references in all shape compositions. */
export function renameShapeId(
  project: Signal<ProjectState> = projectSignal,
  currentShapeId: string,
  nextNameOrId: string
): string {
  let renamedTo = currentShapeId;

  commitProject(project, (state) => {
    const shapes = state.definition.shapes ? [...state.definition.shapes] : [];
    const shapeIndex = shapes.findIndex((shape) => shape.id === currentShapeId);
    if (shapeIndex < 0) {
      return {};
    }

    const normalized = normalizeShapeId(nextNameOrId);
    const siblingIds = new Set(
      shapes
        .filter((shape, index) => index !== shapeIndex)
        .map((shape) => shape.id)
    );
    const uniqueId = ensureUniqueShapeId(siblingIds, normalized);

    if (uniqueId === currentShapeId) {
      renamedTo = currentShapeId;
      return {};
    }

    const nextShapes = shapes.map((shape, index) => {
      const renamedShape = index === shapeIndex
        ? { ...shape, id: uniqueId }
        : { ...shape };
      return rewriteShapeReferences(renamedShape, currentShapeId, uniqueId);
    });

    state.definition.shapes = nextShapes;
    renamedTo = uniqueId;
    return {};
  });

  return renamedTo;
}

/** Deletes a shape and removes references to it from remaining compositions. */
export function deleteShape(project: Signal<ProjectState> = projectSignal, shapeId: string): void {
  commitProject(project, (state) => {
    const currentShapes = state.definition.shapes ?? [];
    if (!currentShapes.length) {
      return {};
    }

    const remaining = currentShapes
      .filter((shape) => shape.id !== shapeId)
      .map((shape) => ensureShapeHasConstraintOrComposition(removeShapeReferences(shape, shapeId)));

    state.definition.shapes = remaining.length > 0 ? remaining : undefined;
    return {};
  });
}

/** Shape composition mode used by `setShapeComposition`. */
export type ShapeCompositionMode = 'none' | 'and' | 'or' | 'xone' | 'not';

/** Sets shape composition mode (`and`/`or`/`xone`/`not`) entries. */
export function setShapeComposition(
  project: Signal<ProjectState> = projectSignal,
  shapeId: string,
  mode: ShapeCompositionMode,
  entries: string[]
): void {
  commitProject(project, (state) => {
    const shapes = state.definition.shapes ? [...state.definition.shapes] : [];
    const shapeIndex = shapes.findIndex((shape) => shape.id === shapeId);
    if (shapeIndex < 0) {
      return {};
    }

    const nextShape = { ...shapes[shapeIndex] };
    delete nextShape.and;
    delete nextShape.or;
    delete nextShape.xone;
    delete nextShape.not;

    const normalizedEntries = entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    if (mode === 'and' || mode === 'or' || mode === 'xone') {
      if (normalizedEntries.length > 0) {
        nextShape[mode] = normalizedEntries;
      }
    } else if (mode === 'not') {
      if (normalizedEntries[0]) {
        nextShape.not = normalizedEntries[0];
      }
    }

    shapes[shapeIndex] = ensureShapeHasConstraintOrComposition(nextShape);
    state.definition.shapes = shapes;
    return {};
  });
}

/** Toggles left structure panel visibility. */
export function toggleStructurePanel(project: Signal<ProjectState> = projectSignal): void {
  commitProject(project, (state) => {
    state.uiState.structurePanelOpen = !state.uiState.structurePanelOpen;
    if (!state.uiState.structurePanelOpen && state.uiState.mobilePanel === 'structure') {
      state.uiState.mobilePanel = 'none';
    }
    return {};
  });
}

/** Toggles diagnostics panel visibility. */
export function toggleDiagnosticsOpen(project: Signal<ProjectState> = projectSignal): void {
  commitProject(project, (state) => {
    state.uiState.diagnosticsOpen = !state.uiState.diagnosticsOpen;
    return {};
  });
}

/** Sets active mobile panel, toggling off when selecting the same panel. */
export function setMobilePanel(
  project: Signal<ProjectState> = projectSignal,
  panel: ProjectState['uiState']['mobilePanel']
): void {
  commitProject(project, (state) => {
    state.uiState.mobilePanel = state.uiState.mobilePanel === panel ? 'none' : panel;
    if (state.uiState.mobilePanel === 'structure') {
      state.uiState.structurePanelOpen = true;
    }
    return {};
  });
}

/** Cycles view mode between edit, split, and preview. */
export function togglePreviewMode(project: Signal<ProjectState> = projectSignal): void {
  commitProject(project, (state) => {
    if (state.uiState.viewMode === 'edit') {
      state.uiState.viewMode = 'split';
    } else if (state.uiState.viewMode === 'split') {
      state.uiState.viewMode = 'preview';
    } else {
      state.uiState.viewMode = 'edit';
    }
    return {};
  });
}

interface GroupContext {
  item: FormspecItem;
  node: GeneratedComponentNode;
}

interface GroupFieldOption {
  key: string;
  label: string;
}

function findGroupContext(state: ProjectState, path: string): GroupContext | null {
  const location = findItemLocation(state.definition.items, path);
  if (!location || location.item.type !== 'group') {
    return null;
  }

  const node = findComponentNodeByPath(state.definition.items, state.component.tree, path);
  if (!node) {
    return null;
  }

  return {
    item: location.item,
    node
  };
}

function applyDataTableMode(node: GeneratedComponentNode, item: FormspecItem, path: string): void {
  node.component = 'DataTable';
  node.bind = path;
  node.columns = node.columns?.length ? node.columns : buildDefaultDataTableColumns(item);
  if (typeof node.showRowNumbers !== 'boolean') {
    node.showRowNumbers = true;
  }
  if (typeof node.allowAdd !== 'boolean') {
    node.allowAdd = true;
  }
  if (typeof node.allowRemove !== 'boolean') {
    node.allowRemove = true;
  }
  if (typeof node.sortable !== 'boolean') {
    node.sortable = false;
  }
  if (typeof node.filterable !== 'boolean') {
    node.filterable = false;
  }
  if (node.sortable === true && !node.sortDirection) {
    node.sortDirection = 'asc';
  }

  delete node.text;
  delete node.children;
}

function applyStackMode(node: GeneratedComponentNode, item: FormspecItem, path: string): void {
  node.component = 'Stack';
  node.children = buildComponentNodesForItems(item.children ?? [], path);
  delete node.bind;
  delete node.text;
  delete node.columns;
  delete node.showRowNumbers;
  delete node.allowAdd;
  delete node.allowRemove;
  delete node.sortable;
  delete node.filterable;
  delete node.sortBy;
  delete node.sortDirection;
}

function buildDefaultDataTableColumns(item: FormspecItem): GroupDataTableColumn[] {
  return listGroupFieldOptions(item).map((field) => ({
    bind: field.key,
    header: field.label
  }));
}

function listGroupFieldOptions(item: FormspecItem): GroupFieldOption[] {
  if (item.type !== 'group') {
    return [];
  }

  return (item.children ?? [])
    .filter((child) => child.type === 'field')
    .map((field) => ({
      key: field.key,
      label: field.label ?? field.key
    }));
}

function sanitizeDataTableColumns(
  columns: GroupDataTableColumn[],
  fields: GroupFieldOption[]
): GroupDataTableColumn[] {
  const allowed = new Map(fields.map((field) => [field.key, field]));
  const normalized: GroupDataTableColumn[] = [];
  const seen = new Set<string>();

  for (const column of columns) {
    const field = allowed.get(column.bind);
    if (!field) {
      continue;
    }
    if (seen.has(field.key)) {
      continue;
    }
    seen.add(field.key);

    const nextColumn: GroupDataTableColumn = {
      bind: field.key,
      header: normalizeColumnHeader(column.header, field.label)
    };

    if (Number.isFinite(column.min)) {
      nextColumn.min = Number(column.min);
    }
    if (Number.isFinite(column.max)) {
      nextColumn.max = Number(column.max);
    }
    if (Number.isFinite(column.step)) {
      nextColumn.step = Number(column.step);
    }

    normalized.push(nextColumn);
  }

  return normalized;
}

function normalizeColumnHeader(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized?.length) {
    return fallback;
  }
  return normalized;
}

function applyOptionalBoolean<T extends keyof GeneratedComponentNode>(
  target: GeneratedComponentNode,
  key: T,
  value: boolean | null | undefined
): void {
  if (value === null || value === undefined) {
    delete target[key];
    return;
  }
  (target as Record<string, unknown>)[key as string] = value;
}

function applyOptionalString<T extends keyof GeneratedComponentNode>(
  target: GeneratedComponentNode,
  key: T,
  value: string | null | undefined
): void {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized.length) {
    delete target[key];
    return;
  }
  (target as Record<string, unknown>)[key as string] = normalized;
}

function applyOptionalSortDirection(
  target: GeneratedComponentNode,
  value: 'asc' | 'desc' | null | undefined
): void {
  if (value === 'asc' || value === 'desc') {
    target.sortDirection = value;
    return;
  }
  delete target.sortDirection;
}

function commitProject(
  project: Signal<ProjectState>,
  updater: (draft: ProjectState) => { rebuildComponentTree?: boolean }
): void {
  const draft = structuredClone(project.value);
  ensureVersioningState(draft);
  const result = updater(draft);

  draft.component.targetDefinition.url = draft.definition.url;
  draft.theme.targetDefinition.url = draft.definition.url;
  draft.mapping = normalizeMappingDocument(draft.mapping, draft.definition);
  draft.theme.breakpoints = normalizeBreakpoints(draft.theme.breakpoints);
  draft.component.breakpoints = { ...draft.theme.breakpoints };
  draft.uiState.previewWidth = clampPreviewWidth(draft.uiState.previewWidth);
  draft.uiState.activeBreakpoint =
    draft.theme.breakpoints[draft.uiState.activeBreakpoint] !== undefined
      ? draft.uiState.activeBreakpoint
      : resolveActiveBreakpointName(draft.theme.breakpoints, draft.uiState.previewWidth);

  if (result.rebuildComponentTree) {
    draft.component.tree = rebuildComponentTreeFromDefinition(draft.definition);
  }

  project.value = draft;
}

function ensureVersioningState(state: ProjectState): ProjectState['versioning'] {
  if (!isRecord(state.versioning)) {
    state.versioning = createInitialVersioningState(state.definition);
    return state.versioning;
  }

  if (!isRecord(state.versioning.baselineDefinition)) {
    state.versioning.baselineDefinition = structuredClone(state.definition);
  }
  if (!Array.isArray(state.versioning.releases)) {
    state.versioning.releases = [];
  }
  return state.versioning;
}

function findComponentNodeByPath(
  items: FormspecItem[],
  rootNode: GeneratedComponentNode,
  path: string
): GeneratedComponentNode | null {
  const segments = toPathSegments(path);
  if (!segments.length) {
    return null;
  }

  return findNodeInLevel(items, rootNode.children ?? [], segments, 0);
}

function findNodeInLevel(
  items: FormspecItem[],
  nodes: GeneratedComponentNode[],
  segments: string[],
  depth: number
): GeneratedComponentNode | null {
  const key = segments[depth];
  const itemIndex = items.findIndex((item) => item.key === key);
  if (itemIndex < 0 || itemIndex >= nodes.length) {
    return null;
  }

  const item = items[itemIndex];
  const node = nodes[itemIndex];
  if (depth === segments.length - 1) {
    return node;
  }

  if (item.type !== 'group') {
    return null;
  }

  return findNodeInLevel(item.children ?? [], node.children ?? [], segments, depth + 1);
}

function applyResponsiveNumber(
  target: Record<string, unknown>,
  key: 'span' | 'start',
  value: number | null | undefined,
  min: number,
  max: number
): void {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    delete target[key];
    return;
  }

  target[key] = rounded;
}

function applyResponsiveBoolean(
  target: Record<string, unknown>,
  key: 'hidden',
  value: boolean | null | undefined
): void {
  if (value === null || value === undefined) {
    delete target[key];
    return;
  }

  target[key] = value;
}

function buildItem(key: string, input: AddItemInput): FormspecItem {
  if (input.type === 'field') {
    return {
      type: 'field',
      key,
      dataType: input.dataType ?? 'string',
      label: input.label ?? 'Untitled field'
    };
  }

  if (input.type === 'group') {
    return {
      type: 'group',
      key,
      label: input.label ?? 'Untitled group',
      children: []
    };
  }

  return {
    type: 'display',
    key,
    label: input.label ?? 'Untitled text'
  };
}

function defaultKeyForType(type: AddItemInput['type']): string {
  if (type === 'field') {
    return 'field';
  }
  if (type === 'group') {
    return 'group';
  }
  return 'display';
}

function resolveMoveTarget(items: FormspecItem[], target: MoveItemTarget | string): MoveItemTarget {
  if (typeof target !== 'string') {
    return target;
  }

  const location = findItemLocation(items, target);
  if (!location) {
    throw new Error(`Cannot resolve move target path: ${target}`);
  }

  return {
    parentPath: location.parentPath,
    index: location.index
  };
}

function resolveItemArray(items: FormspecItem[], parentPath: string | null): FormspecItem[] {
  if (!parentPath) {
    return items;
  }

  const location = findItemLocation(items, parentPath);
  if (!location) {
    throw new Error(`Cannot resolve missing parent path: ${parentPath}`);
  }

  if (location.item.type !== 'group') {
    throw new Error(`Target parent path is not a group: ${parentPath}`);
  }

  if (!location.item.children) {
    location.item.children = [];
  }

  return location.item.children;
}

function ensureUniqueSiblingKey(items: FormspecItem[], requestedKey: string, ignoreIndex = -1): string {
  const normalized = requestedKey.trim();
  const base = normalized.length > 0 ? normalized : 'item';

  const siblingKeys = new Set(
    items
      .map((item, index) => (index === ignoreIndex ? null : item.key))
      .filter((key): key is string => typeof key === 'string')
  );

  if (!siblingKeys.has(base)) {
    return base;
  }

  let index = 2;
  while (siblingKeys.has(`${base}${index}`)) {
    index += 1;
  }
  return `${base}${index}`;
}

interface ItemLocation {
  item: FormspecItem;
  items: FormspecItem[];
  index: number;
  parentPath: string | null;
}

function findItemLocation(items: FormspecItem[], path: string): ItemLocation | null {
  const segments = toPathSegments(path);
  if (!segments.length) {
    return null;
  }

  let currentItems = items;
  let parentPath: string | null = null;

  for (let depth = 0; depth < segments.length; depth += 1) {
    const key = segments[depth];
    const index = currentItems.findIndex((item) => item.key === key);
    if (index < 0) {
      return null;
    }

    const item = currentItems[index];
    if (depth === segments.length - 1) {
      return {
        item,
        items: currentItems,
        index,
        parentPath
      };
    }

    if (item.type !== 'group') {
      return null;
    }

    if (!item.children) {
      item.children = [];
    }

    parentPath = joinPath(parentPath, item.key);
    currentItems = item.children;
  }

  return null;
}

function collectItemPaths(items: FormspecItem[], parentPath: string | null): string[] {
  const paths: string[] = [];
  for (const item of items) {
    const path = joinPath(parentPath, item.key);
    paths.push(path);
    if (item.children?.length) {
      paths.push(...collectItemPaths(item.children, path));
    }
  }
  return paths;
}

function isPathRemoved(path: string, removedPrefixes: Set<string>): boolean {
  for (const removedPrefix of removedPrefixes) {
    if (path === removedPrefix) {
      return true;
    }
    if (path.startsWith(`${removedPrefix}.`)) {
      return true;
    }
    if (path.startsWith(`${removedPrefix}[`)) {
      return true;
    }
  }
  return false;
}

function isSubPath(candidate: string, ancestor: string): boolean {
  return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
}

function clampInsertIndex(items: unknown[], index: number | undefined): number {
  if (index === undefined || Number.isNaN(index)) {
    return items.length;
  }
  if (index < 0) {
    return 0;
  }
  if (index > items.length) {
    return items.length;
  }
  return index;
}

function isEmptyBind(bind: FormspecBind): boolean {
  for (const key of Object.keys(bind)) {
    if (!EMPTY_BIND_KEYS.has(key)) {
      return false;
    }
  }
  return true;
}

function fallbackLabelForType(type: FormspecItem['type']): string {
  if (type === 'group') {
    return 'Untitled group';
  }
  if (type === 'display') {
    return 'Untitled text';
  }
  return 'Untitled field';
}

function normalizeOptionalValue(value: unknown): unknown | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return numeric;
}

function parseImportedDefinition(payload: unknown): FormspecDefinition {
  if (!isRecord(payload)) {
    throw new Error('Imported sub-form payload must be an object.');
  }

  const url = normalizeOptionalString(payload.url);
  if (!url) {
    throw new Error('Imported sub-form must include a url.');
  }

  const version = normalizeOptionalString(payload.version);
  if (!version) {
    throw new Error('Imported sub-form must include a version.');
  }

  if (!Array.isArray(payload.items)) {
    throw new Error('Imported sub-form must include an items array.');
  }

  return {
    ...(payload as FormspecDefinition),
    url,
    version
  };
}

function deriveSubformGroupKey(definition: FormspecDefinition): string {
  const source = normalizeOptionalString(definition.title) ?? 'subform';
  const slug = source
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');

  if (!slug.length) {
    return 'subform';
  }
  if (/^[A-Za-z]/.test(slug)) {
    return slug;
  }
  return `subform${slug}`;
}

function normalizeSubformFragment(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  return normalized.replace(/^#/, '');
}

function normalizeSubformKeyPrefix(value: string | undefined, groupKey: string): string {
  const normalized = normalizeOptionalString(value);
  if (normalized) {
    if (!SUBFORM_KEY_PREFIX_PATTERN.test(normalized)) {
      throw new Error('Sub-form key prefix must start with a letter and contain only letters, numbers, or underscores.');
    }
    return normalized;
  }

  const sanitizedGroupKey = groupKey.replace(/[^A-Za-z0-9_]/g, '');
  const base = sanitizedGroupKey.length > 0 ? sanitizedGroupKey : 'subform';
  const withLetterPrefix = /^[A-Za-z]/.test(base) ? base : `subform${base}`;
  return withLetterPrefix.endsWith('_') ? withLetterPrefix : `${withLetterPrefix}_`;
}

function buildSubformRef(url: string, version: string, fragment: string | undefined): string {
  const base = `${url}|${version}`;
  return fragment ? `${base}#${fragment}` : base;
}

function normalizeMappingPath(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMappingTransform(value: unknown): MappingTransformType {
  if (typeof value !== 'string') {
    return 'preserve';
  }
  const normalized = value.trim() as MappingTransformType;
  return MAPPING_TRANSFORM_TYPES.has(normalized) ? normalized : 'preserve';
}

function normalizeMappingRule(input: Partial<MappingRule>, fallbackPath = 'response'): MappingRule {
  const nextRule: MappingRule = {
    ...input,
    transform: normalizeMappingTransform(input.transform)
  };

  const sourcePath = normalizeMappingPath(input.sourcePath);
  if (sourcePath) {
    nextRule.sourcePath = sourcePath;
  } else {
    delete nextRule.sourcePath;
  }

  if (input.targetPath === null) {
    nextRule.targetPath = null;
  } else {
    const targetPath = normalizeMappingPath(input.targetPath);
    if (targetPath) {
      nextRule.targetPath = targetPath;
    } else {
      delete nextRule.targetPath;
    }
  }

  if (typeof input.expression === 'string' && input.expression.trim().length > 0) {
    nextRule.expression = input.expression;
  } else if (!MAPPING_EXPRESSION_TRANSFORMS.has(nextRule.transform)) {
    delete nextRule.expression;
  }

  if (typeof input.coerce === 'string' && input.coerce.trim().length > 0) {
    nextRule.coerce = input.coerce.trim();
  } else if (isRecord(input.coerce)) {
    nextRule.coerce = { ...input.coerce };
  } else if (nextRule.transform !== 'coerce') {
    delete nextRule.coerce;
  }

  if (isRecord(input.valueMap) && Object.keys(input.valueMap).length > 0) {
    nextRule.valueMap = { ...input.valueMap };
  } else if (nextRule.transform !== 'valueMap') {
    delete nextRule.valueMap;
  }

  if (typeof input.priority === 'number' && Number.isFinite(input.priority)) {
    nextRule.priority = input.priority;
  }
  if (typeof input.reversePriority === 'number' && Number.isFinite(input.reversePriority)) {
    nextRule.reversePriority = input.reversePriority;
  }
  if (typeof input.bidirectional === 'boolean') {
    nextRule.bidirectional = input.bidirectional;
  }
  if (typeof input.condition === 'string' && input.condition.trim().length > 0) {
    nextRule.condition = input.condition;
  }
  if (typeof input.separator === 'string' && input.separator.trim().length > 0) {
    nextRule.separator = input.separator;
  }
  if (typeof input.description === 'string' && input.description.trim().length > 0) {
    nextRule.description = input.description.trim();
  }
  if (isRecord(input.reverse) && Object.keys(input.reverse).length > 0) {
    nextRule.reverse = { ...input.reverse };
  }
  if ('default' in input) {
    nextRule.default = input.default;
  }

  if (!nextRule.sourcePath && nextRule.targetPath === undefined) {
    nextRule.sourcePath = fallbackPath;
    nextRule.targetPath = fallbackPath;
  }

  applyMappingRuleTransformDefaults(nextRule);
  return nextRule;
}

function applyMappingRuleTransformDefaults(rule: MappingRule): void {
  if (MAPPING_EXPRESSION_TRANSFORMS.has(rule.transform)) {
    if (typeof rule.expression !== 'string' || rule.expression.trim().length === 0) {
      rule.expression = defaultMappingExpression(rule.transform);
    }
  } else {
    delete rule.expression;
  }

  if (rule.transform === 'coerce') {
    if (!rule.coerce) {
      rule.coerce = 'string';
    }
  } else {
    delete rule.coerce;
  }

  if (rule.transform === 'valueMap') {
    if (!isRecord(rule.valueMap)) {
      rule.valueMap = {};
    }
  } else {
    delete rule.valueMap;
  }

  if (rule.transform === 'drop' && rule.targetPath === undefined) {
    rule.targetPath = null;
  }

  if (rule.bidirectional === undefined) {
    if (rule.transform === 'drop' || rule.transform === 'constant' || rule.transform === 'concat' || rule.transform === 'split') {
      rule.bidirectional = false;
      return;
    }
    if (rule.transform === 'expression') {
      rule.bidirectional = Boolean(rule.reverse);
      return;
    }
    rule.bidirectional = true;
  }
}

function defaultMappingExpression(transform: MappingTransformType): string {
  if (transform === 'constant') {
    return "'constant'";
  }
  if (transform === 'concat') {
    return "''";
  }
  if (transform === 'split') {
    return '[]';
  }
  return '$';
}

function normalizeMappingDocument(mapping: FormspecMappingDocument, definition: ProjectState['definition']): FormspecMappingDocument {
  const defaultPath = collectFieldPaths(definition.items)[0] ?? 'response';
  const definitionVersionFallback =
    typeof definition.version === 'string' && definition.version.trim().length > 0
      ? definition.version
      : '1.0.0';
  const nextMapping: FormspecMappingDocument = {
    ...mapping,
    definitionRef: definition.url
  };

  nextMapping.version = normalizeMappingPath(mapping.version) ?? '1.0.0';
  nextMapping.definitionVersion = normalizeMappingPath(mapping.definitionVersion) ?? definitionVersionFallback;

  const nextDirection = typeof mapping.direction === 'string' && MAPPING_DIRECTIONS.has(mapping.direction)
    ? (mapping.direction as FormspecMappingDocument['direction'])
    : 'both';
  nextMapping.direction = nextDirection;

  if (mapping.conformanceLevel && !MAPPING_CONFORMANCE_LEVELS.has(mapping.conformanceLevel)) {
    delete nextMapping.conformanceLevel;
  }

  const targetSchema = (isRecord(mapping.targetSchema) ? { ...mapping.targetSchema } : {}) as FormspecMappingDocument['targetSchema'];
  const format = normalizeMappingPath(targetSchema.format) ?? 'json';
  targetSchema.format = format;
  nextMapping.targetSchema = targetSchema;

  const sourceRules = Array.isArray(mapping.rules) ? mapping.rules : [];
  nextMapping.rules = sourceRules.length
    ? sourceRules.map((rule) => normalizeMappingRule(rule, defaultPath))
    : [
        normalizeMappingRule(
          {
            sourcePath: defaultPath,
            targetPath: defaultPath,
            transform: 'preserve',
            bidirectional: true
          },
          defaultPath
        )
      ];

  return nextMapping;
}

function normalizeThemeSelector(selector: Partial<ThemeSelectorRule>): ThemeSelectorRule {
  const match = ensureThemeSelectorMatch(isRecord(selector.match) ? selector.match : {});
  const apply = isRecord(selector.apply) ? { ...selector.apply } : {};

  return {
    match,
    apply
  };
}

function ensureThemeSelectorMatch(input: unknown): ThemeSelectorMatch {
  const match = isRecord(input) ? input : {};
  const nextMatch: ThemeSelectorMatch = {};
  const type = normalizeThemeSelectorType(match.type);
  const dataType = normalizeThemeSelectorDataType(match.dataType);

  if (type !== undefined) {
    nextMatch.type = type;
  }
  if (dataType !== undefined) {
    nextMatch.dataType = dataType;
  }
  if (!nextMatch.type && !nextMatch.dataType) {
    nextMatch.type = 'field';
  }
  if (nextMatch.type && nextMatch.type !== 'field') {
    delete nextMatch.dataType;
  }

  return nextMatch;
}

function normalizeThemeSelectorType(value: unknown): ThemeSelectorType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim() as ThemeSelectorType;
  return THEME_SELECTOR_TYPES.has(trimmed) ? trimmed : undefined;
}

function normalizeThemeSelectorDataType(value: unknown): ThemeSelectorDataType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim() as ThemeSelectorDataType;
  return THEME_SELECTOR_DATA_TYPES.has(trimmed) ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function applyShapeProperty(
  shape: FormspecShape,
  property: ShapeProperty,
  value: FormspecShape[ShapeProperty] | null | undefined
): void {
  if (property === 'target') {
    shape.target = normalizeTarget(value as string | undefined);
    return;
  }

  if (property === 'message') {
    shape.message = normalizeShapeString(value as string | undefined) ?? 'Rule failed.';
    return;
  }

  if (property === 'constraint' || property === 'activeWhen' || property === 'code') {
    const normalized = normalizeShapeString(value as string | undefined);
    if (normalized === undefined) {
      delete shape[property];
    } else {
      shape[property] = normalized as FormspecShape[ShapeProperty];
    }
    return;
  }

  if (property === 'severity' || property === 'timing') {
    const normalized = normalizeShapeString(value as string | undefined);
    if (normalized === undefined) {
      delete shape[property];
    } else {
      shape[property] = normalized as FormspecShape[ShapeProperty];
    }
    return;
  }

  if (property === 'context') {
    const context = value as FormspecShape['context'] | null | undefined;
    if (!context || Object.keys(context).length === 0) {
      delete shape.context;
      return;
    }
    shape.context = context;
    return;
  }

  if (property === 'and' || property === 'or' || property === 'xone') {
    const entries = (value as string[] | null | undefined) ?? [];
    const normalized = entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    if (normalized.length > 0) {
      shape[property] = normalized as FormspecShape[ShapeProperty];
    } else {
      delete shape[property];
    }
    return;
  }

  if (property === 'not') {
    const normalized = normalizeShapeString(value as string | undefined);
    if (normalized === undefined) {
      delete shape.not;
    } else {
      shape.not = normalized;
    }
    return;
  }

  if (property === 'extensions') {
    const extensions = value as Record<string, unknown> | undefined | null;
    if (!extensions || Object.keys(extensions).length === 0) {
      delete shape.extensions;
    } else {
      shape.extensions = extensions;
    }
  }
}

function ensureShapeHasConstraintOrComposition(shape: FormspecShape): FormspecShape {
  if (
    normalizeShapeString(shape.constraint)
    || shape.and?.length
    || shape.or?.length
    || shape.xone?.length
    || normalizeShapeString(shape.not)
  ) {
    return shape;
  }

  return {
    ...shape,
    constraint: 'true'
  };
}

function normalizeTarget(value: string | undefined): string {
  const normalized = normalizeShapeString(value);
  return normalized ?? '#';
}

function normalizeShapeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeShapeId(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!normalized.length) {
    return 'shape';
  }

  if (!/^[a-z]/.test(normalized)) {
    return `shape-${normalized}`;
  }

  return normalized;
}

function normalizeVariableScope(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized || normalized === '#') {
    return undefined;
  }
  return normalized;
}

function ensureUniqueVariableName(variables: FormspecVariable[], requestedName: string): string {
  const base = requestedName.trim() || 'variable';
  const used = new Set(variables.map((variable) => variable.name));
  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
}

function ensureUniqueShapeId(existingShapeIds: Set<string>, baseId: string): string {
  if (!existingShapeIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingShapeIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

function rewriteShapeReferences(shape: FormspecShape, fromShapeId: string, toShapeId: string): FormspecShape {
  const nextShape: FormspecShape = { ...shape };

  for (const key of SHAPE_COMPOSITION_KEYS) {
    const value = nextShape[key];
    if (Array.isArray(value)) {
      nextShape[key] = value.map((entry) => (entry === fromShapeId ? toShapeId : entry));
    }
  }

  if (nextShape.not === fromShapeId) {
    nextShape.not = toShapeId;
  }

  return nextShape;
}

function removeShapeReferences(shape: FormspecShape, removedShapeId: string): FormspecShape {
  const nextShape: FormspecShape = { ...shape };

  for (const key of SHAPE_COMPOSITION_KEYS) {
    const value = nextShape[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const filtered = value.filter((entry) => entry !== removedShapeId);
    if (filtered.length > 0) {
      nextShape[key] = filtered;
    } else {
      delete nextShape[key];
    }
  }

  if (nextShape.not === removedShapeId) {
    delete nextShape.not;
  }

  return nextShape;
}
