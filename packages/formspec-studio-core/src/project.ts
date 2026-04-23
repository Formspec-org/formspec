/** @filedesc Project class: high-level form authoring facade over formspec-core. */
import { createRawProject, createChangesetMiddleware } from '@formspec-org/core';
import type { ChangesetRecorderControl } from '@formspec-org/core';
// Internal-only core types — never appear in public method signatures
import type { IProjectCore, AnyCommand, CommandResult, FELParseContext, FELParseResult, FELReferenceSet, FELFunctionEntry, FieldDependents, ItemFilter, ItemSearchResult, Change, FormspecChangelog, LocaleState } from '@formspec-org/core';
import { ProposalManager } from './proposal-manager.js';
import { resolveLayoutPageStructure, type PageStructureView } from './page-structure.js';
// Studio-core's own type vocabulary for the public API
import type {
  FormItem, FormDefinition, ComponentDocument, ThemeDocument, MappingDocument,
  ProjectBundle, ProjectStatistics, Diagnostics, LogEntry, ProjectSnapshot,
  ChangeListener, CreateProjectOptions,
} from './types.js';
import {
  HelperError,
  type HelperResult,
  type HelperWarning,
  type FieldProps,
  type ContentProps,
  type GroupProps,
  type BranchPath,
  type ValidationOptions,
  type RepeatProps,
  type ChoiceOption,
  type FlowProps,
  type LayoutAddItemSpec,
  type PlacementOptions,
  type LayoutArrangement,
  type InstanceProps,
  type ItemChanges,
  type MetadataChanges,
  type WidgetInfo,
  type FieldTypeCatalogEntry as FieldTypeAliasRow,
  type FELValidationResult,
  type FELSuggestion,
} from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';
import * as mappingOps from './project-mapping.js';
import * as screenerOps from './project-screener.js';
import * as themeOps from './project-theme.js';
import * as layoutOps from './project-layout.js';
import * as componentTreeOps from './project-component-tree.js';
import * as previewOps from './project-preview.js';
import * as definitionOps from './project-definition.js';
import * as felOps from './project-fel.js';
import * as projectVariables from './project-variables.js';
import { requireItemPath, throwPathNotFound } from './project-path-helpers.js';

import { resolveFieldType, resolveWidget, widgetHintFor, _FIELD_TYPE_MAP } from './field-type-aliases.js';
import type { ResolvedFieldType } from './field-type-aliases.js';
import {
  getFieldTypeCatalog,
  humanizeFEL,
  registryExtensionPaletteEntries,
  sanitizeIdentifier,
  type FieldTypeCatalogEntry,
} from './authoring-helpers.js';
import {
  findComponentNodeById,
  findComponentNodeByRef,
  findKeyInItems,
  findParentRefOfNodeRef,
  pageChildren,
  refForCompNode,
} from './tree-utils.js';
import { resolvePath } from './lib/object-utils.js';
import { buildRepeatScopeRewriter } from './lib/fel-rewriter.js';
import { componentTargetRef } from './lib/component-target-ref.js';
import type { CompNode } from './layout-helpers.js';
import { COMPATIBILITY_MATRIX, COMPONENT_TO_HINT } from '@formspec-org/types';
import { rewriteFELReferences } from '@formspec-org/engine/fel-tools';
import {
  widgetConstraintToFEL,
  felToWidgetConstraint,
  isWidgetManagedConstraint,
  getWidgetConstraintProps,
  type WidgetConstraintSpec,
  type WidgetConstraintState,
  type NumericConstraintValues,
  type DateConstraintValues,
} from './widget-constraints.js';

/**
 * Behavior-driven authoring API for Formspec.
 * Composes an IProjectCore and exposes form-author-friendly helper methods.
 * All authoring methods return HelperResult.
 *
 * For raw project access (dispatch, state, queries), use formspec-core directly.
 */
export class Project {
  private _proposals: ProposalManager | null = null;
  private _isDirty = false;

  constructor(
    private readonly core: IProjectCore,
    private readonly _recorderControl?: ChangesetRecorderControl,
  ) {
    // Track dirty state: any mutation through core.dispatch marks as dirty
    this.core.onChange(() => { this._isDirty = true; });
    if (_recorderControl) {
      this._proposals = new ProposalManager(
        core,
        (on) => { _recorderControl.recording = on; },
        (actor) => { _recorderControl.currentActor = actor; },
      );
      // Wire the middleware's callback to the ProposalManager
      const pm = this._proposals;
      const originalOnRecorded = _recorderControl.onCommandsRecorded;
      _recorderControl.onCommandsRecorded = (actor, commands, results, priorState) => {
        pm.onCommandsRecorded(actor, commands, results, priorState);
        originalOnRecorded?.(actor, commands, results, priorState);
      };
    }
  }

  /** Access the ProposalManager for changeset operations. Null if not enabled. */
  get proposals(): ProposalManager | null { return this._proposals; }

  /** True when the project has unsaved mutations since the last markClean() or creation. */
  get isDirty(): boolean { return this._isDirty; }

  /** Reset the dirty flag (call after saving/publishing). */
  markClean(): void { this._isDirty = false; }

  // ── Read-only state getters (for rendering) ────────────────

  private _snapshotSource: unknown = null;
  private _snapshot: Readonly<ProjectSnapshot> | null = null;

  get state(): Readonly<ProjectSnapshot> {
    const s = this.core.state;
    // useSyncExternalStore requires stable references between mutations.
    // Only rebuild when the underlying state object is replaced.
    if (s !== this._snapshotSource) {
      this._snapshotSource = s;
      this._snapshot = {
        definition: s.definition as unknown as FormDefinition,
        component: this.core.component as unknown as ComponentDocument,
        theme: s.theme as unknown as ThemeDocument,
        mappings: s.mappings as unknown as Record<string, MappingDocument>,
        selectedMappingId: s.selectedMappingId,
        screener: s.screener ?? null,
      };
    }
    return this._snapshot!;
  }
  get definition(): Readonly<FormDefinition> { return this.core.definition; }
  get component(): Readonly<ComponentDocument> { return this.core.component; }
  get theme(): Readonly<ThemeDocument> { return this.core.theme; }
  get mapping(): Readonly<MappingDocument> { return this.core.mapping; }
  get mappings(): Readonly<Record<string, MappingDocument>> { return this.core.mappings; }
  get locales(): Readonly<Record<string, LocaleState>> { return this.core.locales; }
  localeAt(code: string): LocaleState | undefined { return this.core.localeAt(code); }
  activeLocaleCode(): string | undefined { return this.core.activeLocaleCode(); }

  // ── Queries ────────────────────────────────────────────────

  fieldPaths(): string[] { return this.core.fieldPaths(); }
  itemPaths(): string[] { return this.core.itemPaths(); }
  itemAt(path: string): FormItem | undefined { return this.core.itemAt(path); }
  bindFor(path: string): Record<string, unknown> | undefined { return this.core.bindFor(path); }
  variableNames(): string[] { return this.core.variableNames(); }
  instanceNames(): string[] { return this.core.instanceNames(); }
  statistics(): ProjectStatistics & { isDirty: boolean } {
    return { ...this.core.statistics(), isDirty: this._isDirty };
  }
  commandHistory(): readonly LogEntry[] { return this.core.log; }
  export(): ProjectBundle { return this.core.export() as unknown as ProjectBundle; }
  diagnose(): Diagnostics { return this.core.diagnose(); }
  componentFor(fieldKey: string): Record<string, unknown> | undefined { return this.core.componentFor(fieldKey); }
  pageStructure(): PageStructureView { return resolveLayoutPageStructure(this.state); }
  searchItems(filter: ItemFilter): ItemSearchResult[] { return this.core.searchItems(filter); }
  parseFEL(expression: string, context?: FELParseContext): FELParseResult { return this.core.parseFEL(expression, context); }
  /** Evaluate a FEL expression and return a structured trace of evaluation steps. */
  traceFEL(expression: string, fields?: Record<string, unknown>) { return this.core.traceFEL(expression, fields); }
  felFunctionCatalog(): FELFunctionEntry[] { return this.core.felFunctionCatalog(); }
  availableReferences(context?: string | FELParseContext): FELReferenceSet { return this.core.availableReferences(context); }
  expressionDependencies(expression: string): string[] { return this.core.expressionDependencies(expression); }
  fieldDependents(fieldPath: string): FieldDependents { return this.core.fieldDependents(fieldPath); }
  diffFromBaseline(fromVersion?: string): Change[] { return this.core.diffFromBaseline(fromVersion); }
  previewChangelog(): FormspecChangelog { return this.core.previewChangelog(); }

  // ── FEL editing helpers ───────────────────────────────────────

  /** Validate a FEL expression and return detailed diagnostics. */
  validateFELExpression(expression: string, contextPath?: string): FELValidationResult {
    return felOps.validateFELExpression(this._asInternals(), expression, contextPath);
  }

  /** Return autocomplete suggestions for a partial FEL expression. */
  felAutocompleteSuggestions(partial: string, contextPath?: string): FELSuggestion[] {
    return felOps.felAutocompleteSuggestions(this._asInternals(), partial, contextPath);
  }

  /** Convert a FEL expression to a human-readable English string. */
  humanizeFELExpression(expression: string): { text: string; supported: boolean } {
    return felOps.humanizeFELExpression(this._asInternals(), expression);
  }

  // ── Widget / type vocabulary queries ──────────────────────────

  /** Returns all known widgets with their compatible data types. */
  listWidgets(): WidgetInfo[] {
    // Build a reverse map: component → set of compatible data types
    const componentTypes = new Map<string, Set<string>>();
    for (const [dataType, components] of Object.entries(COMPATIBILITY_MATRIX)) {
      for (const comp of components) {
        if (!componentTypes.has(comp)) componentTypes.set(comp, new Set());
        componentTypes.get(comp)!.add(dataType);
      }
    }

    const result: WidgetInfo[] = [];
    for (const [component, dataTypes] of componentTypes) {
      // Use the canonical hint as the user-facing name
      const name = COMPONENT_TO_HINT[component] ?? component.toLowerCase();
      result.push({
        name,
        component,
        compatibleDataTypes: [...dataTypes],
      });
    }
    return result;
  }

  /** Returns widget names (component types) compatible with a given data type or alias. */
  compatibleWidgets(dataType: string): string[] {
    // Direct lookup first (canonical spec type names)
    if (COMPATIBILITY_MATRIX[dataType]) return COMPATIBILITY_MATRIX[dataType];
    // Resolve authoring aliases (e.g. "number" → "decimal", "file" → "attachment")
    try {
      const resolved = resolveFieldType(dataType);
      return COMPATIBILITY_MATRIX[resolved.dataType] ?? [];
    } catch {
      return [];
    }
  }

  /** Returns the field type alias table (all types the user can specify in addField). */
  fieldTypeCatalog(): FieldTypeAliasRow[] {
    return Object.entries(_FIELD_TYPE_MAP).map(([alias, entry]) => ({
      alias,
      dataType: entry.dataType,
      defaultWidget: entry.defaultWidget,
    }));
  }

  /** Built-in add-item palette rows plus registry `dataType` extensions from loaded registries. */
  mergedFieldTypeCatalog(): FieldTypeCatalogEntry[] {
    return [
      ...getFieldTypeCatalog(),
      ...registryExtensionPaletteEntries(this.core.allDataTypes(), (name) => this.core.resolveExtension(name)),
    ];
  }

  /** Returns raw registry documents for passing to rendering consumers (e.g. <formspec-render>). */
  registryDocuments(): unknown[] {
    return this.core.state.extensions.registries
      .map(r => r.document)
      .filter(Boolean);
  }

  // ── Layout node movement ────────────────────────────────────

  /** Move a component tree node to a new parent/position. */
  moveLayoutNode(
    sourceNodeId: string,
    targetParentNodeId: string,
    targetIndex: number,
  ): HelperResult {
    return componentTreeOps.moveLayoutNode(this._asInternals(), sourceNodeId, targetParentNodeId, targetIndex);
  }

  /** Batch-move multiple definition items atomically (e.g. multi-select DnD). */
  moveItems(
    moves: Array<{ sourcePath: string; targetParentPath?: string; targetIndex: number }>,
  ): HelperResult {
    return componentTreeOps.moveItems(this._asInternals(), moves);
  }

  /**
   * Set definition-level `extensions` in one undoable command (`definition.setDefinitionProperty`).
   * Caller supplies the full merged map, or `null` to remove the property. Prefer this over
   * mutating `project.core.state` from adapters (e.g. MCP) that cannot access private `core`.
   */
  setDefinitionExtensions(extensions: Record<string, unknown> | null): void {
    componentTreeOps.setDefinitionExtensions(this._asInternals(), extensions);
  }

  // ── History ────────────────────────────────────────────────

  undo(): boolean {
    // Disable undo during open changeset — the changeset IS the undo mechanism
    if (this._proposals?.hasActiveChangeset) return false;
    return this.core.undo();
  }
  redo(): boolean {
    if (this._proposals?.hasActiveChangeset) return false;
    return this.core.redo();
  }
  get canUndo(): boolean {
    if (this._proposals?.hasActiveChangeset) return false;
    return this.core.canUndo;
  }
  get canRedo(): boolean {
    if (this._proposals?.hasActiveChangeset) return false;
    return this.core.canRedo;
  }
  onChange(listener: ChangeListener): () => void { return this.core.onChange(() => listener()); }

  // ── Bulk operations ────────────────────────────────────────

  /** Import a project bundle. The import is undoable like any other edit. */
  loadBundle(bundle: Partial<ProjectBundle>): void {
    this.core.dispatch({ type: 'project.import', payload: bundle });
  }

  /** Add a mapping rule from a form field to an output target. */
  mapField(sourcePath: string, targetPath: string, mappingId?: string): HelperResult {
    return mappingOps.mapField(this._asInternals(), sourcePath, targetPath, mappingId);
  }

  /** Remove all mapping rules for a given source path. */
  unmapField(sourcePath: string, mappingId?: string): HelperResult {
    return mappingOps.unmapField(this._asInternals(), sourcePath, mappingId);
  }

  addField(path: string, label: string, type: string, props?: FieldProps): HelperResult {
    return definitionOps.addField(this._asInternals(), path, label, type, props);
  }

  addGroup(path: string, label: string, props?: GroupProps): HelperResult {
    return definitionOps.addGroup(this._asInternals(), path, label, props);
  }

  addContent(path: string, body: string, kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider', props?: ContentProps): HelperResult {
    return definitionOps.addContent(this._asInternals(), path, body, kind, props);
  }

  showWhen(target: string, condition: string): HelperResult {
    return definitionOps.showWhen(this._asInternals(), target, condition);
  }

  readonlyWhen(target: string, condition: string): HelperResult {
    return definitionOps.readonlyWhen(this._asInternals(), target, condition);
  }

  require(target: string, condition?: string): HelperResult {
    return definitionOps.require(this._asInternals(), target, condition);
  }

  calculate(target: string, expression: string): HelperResult {
    return definitionOps.calculate(this._asInternals(), target, expression);
  }

  branch(on: string, paths: BranchPath[], otherwise?: string | string[]): HelperResult {
    return definitionOps.branch(this._asInternals(), on, paths, otherwise);
  }

  addValidation(target: string, rule: string, message: string, options?: ValidationOptions): HelperResult {
    return definitionOps.addValidation(this._asInternals(), target, rule, message, options);
  }

  removeValidation(target: string): HelperResult {
    return definitionOps.removeValidation(this._asInternals(), target);
  }

  updateValidation(shapeId: string, changes: { rule?: string; message?: string; timing?: 'continuous' | 'submit' | 'demand'; severity?: 'error' | 'warning' | 'info'; code?: string; activeWhen?: string; }): HelperResult {
    return definitionOps.updateValidation(this._asInternals(), shapeId, changes);
  }

  removeItem(path: string): HelperResult {
    return definitionOps.removeItem(this._asInternals(), path);
  }

  updateItem(path: string, changes: ItemChanges): HelperResult {
    return definitionOps.updateItem(this._asInternals(), path, changes);
  }

  setItemExtension(path: string, extension: string, value: unknown): HelperResult {
    return definitionOps.setItemExtension(this._asInternals(), path, extension, value);
  }

  setWidgetConstraints(path: string, values: Partial<NumericConstraintValues> | Partial<DateConstraintValues>): HelperResult {
    return definitionOps.setWidgetConstraints(this._asInternals(), path, values);
  }

  getWidgetConstraints(path: string): WidgetConstraintState {
    return definitionOps.getWidgetConstraints(this._asInternals(), path);
  }

  moveItem(path: string, targetParentPath?: string, targetIndex?: number): HelperResult {
    return definitionOps.moveItem(this._asInternals(), path, targetParentPath, targetIndex);
  }

  renameItem(path: string, newKey: string): HelperResult {
    return definitionOps.renameItem(this._asInternals(), path, newKey);
  }

  reorderItem(path: string, direction: 'up' | 'down'): HelperResult {
    return definitionOps.reorderItem(this._asInternals(), path, direction);
  }

  setMetadata(changes: MetadataChanges): HelperResult {
    return definitionOps.setMetadata(this._asInternals(), changes);
  }

  defineChoices(name: string, options: ChoiceOption[]): HelperResult {
    return definitionOps.defineChoices(this._asInternals(), name, options);
  }

  makeRepeatable(target: string, props?: RepeatProps): HelperResult {
    return definitionOps.makeRepeatable(this._asInternals(), target, props);
  }

  setGroupDisplayMode(groupKey: string, mode: 'stack' | 'table'): HelperResult {
    return definitionOps.setGroupDisplayMode(this._asInternals(), groupKey, mode);
  }

  copyItem(path: string, deep?: boolean, targetPath?: string): HelperResult {
    return definitionOps.copyItem(this._asInternals(), path, deep, targetPath);
  }

  wrapItemsInGroup(paths: string[], groupPathOrLabel?: string, groupLabel?: string): HelperResult {
    return definitionOps.wrapItemsInGroup(this._asInternals(), paths, groupPathOrLabel, groupLabel);
  }

  wrapInLayoutComponent(path: string, component: 'Card' | 'Stack' | 'Collapsible'): HelperResult {
    return definitionOps.wrapInLayoutComponent(this._asInternals(), path, component);
  }

  batchDeleteItems(paths: string[]): HelperResult {
    return definitionOps.batchDeleteItems(this._asInternals(), paths);
  }

  batchDuplicateItems(paths: string[]): HelperResult {
    return definitionOps.batchDuplicateItems(this._asInternals(), paths);
  }

  // ── Submit Button ──

  /** Add a submit button. */
  addSubmitButton(label?: string, pageId?: string): HelperResult {
    return componentTreeOps.addSubmitButton(this._asInternals(), label, pageId);
  }

  /** Narrow `this` for delegate modules that accept {@link ProjectInternals}. */
  private _asInternals(): ProjectInternals {
    return this as unknown as ProjectInternals;
  }

  // ── Page Helpers ──

  /** Add a page — creates a Page node in the component tree. */
  addPage(title: string, description?: string, id?: string): HelperResult {
    return layoutOps.addPage(this._asInternals(), title, description, id);
  }

  /** Remove a page — deletes only the page surface. Groups and fields remain intact as unassigned items. */
  removePage(pageId: string): HelperResult {
    return layoutOps.removePage(this._asInternals(), pageId);
  }

  /** Reorder a page. */
  reorderPage(pageId: string, direction: 'up' | 'down'): HelperResult {
    return layoutOps.reorderPage(this._asInternals(), pageId, direction);
  }

  /** Move a page to an arbitrary zero-based index in one atomic undo step. */
  movePageToIndex(pageId: string, targetIndex: number): HelperResult {
    return layoutOps.movePageToIndex(this._asInternals(), pageId, targetIndex);
  }

  /** List all pages with their id, title, description, and primary group path. */
  listPages(): Array<{ id: string; title: string; description?: string; groupPath?: string }> {
    return layoutOps.listPages(this._asInternals());
  }

  /** Update a page's title or description. */
  updatePage(pageId: string, changes: { title?: string; description?: string }): HelperResult {
    return layoutOps.updatePage(this._asInternals(), pageId, changes);
  }



  /** Assign an item to a page. */
  placeOnPage(target: string, pageId: string, options?: PlacementOptions): HelperResult {
    return layoutOps.placeOnPage(this._asInternals(), target, pageId, options);
  }

  /** Remove item from page assignment. */
  unplaceFromPage(target: string, pageId: string): HelperResult {
    return layoutOps.unplaceFromPage(this._asInternals(), target, pageId);
  }

  /** Set flow mode. */
  setFlow(mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult {
    return layoutOps.setFlow(this._asInternals(), mode, props);
  }

  /** Set or clear the `$ref` for a group item. */
  setGroupRef(path: string, ref: string | null, keyPrefix?: string): HelperResult {
    return layoutOps.setGroupRef(this._asInternals(), path, ref, keyPrefix);
  }

  /** Set a component-level visual condition (`when`) on a bound item or layout node. */
  setComponentWhen(target: string, when: string | null): HelperResult {
    return layoutOps.setComponentWhen(this._asInternals(), target, when);
  }

  /** Set a component accessibility override on a bound item or layout node. */
  setComponentAccessibility(target: string, property: string, value: unknown): HelperResult {
    return layoutOps.setComponentAccessibility(this._asInternals(), target, property, value);
  }

  /** Set an arbitrary property on a component tree node (identified by `__node:<id>` or bind key). */
  setLayoutNodeProp(target: string, property: string, value: unknown): HelperResult {
    return layoutOps.setLayoutNodeProp(this._asInternals(), target, property, value);
  }

  /**
   * Set a single style property on a component tree node by NodeRef.
   * Uses `component.setNodeStyle`, which merges into the existing style map
   * without clobbering other keys.
   */
  setNodeStyleProperty(ref: { nodeId?: string; bind?: string }, property: string, value: string): void {
    return layoutOps.setNodeStyleProperty(this._asInternals(), ref, property, value);
  }

  /** Add a new item from the Layout workspace, placing it directly into the component tree. */
  addItemToLayout(spec: LayoutAddItemSpec, pageId?: string): HelperResult {
    return layoutOps.addItemToLayout(this._asInternals(), spec, pageId);
  }

  // ── Layout Helpers ──

  /** Apply spatial layout to targets. */
  applyLayout(targets: string | string[], arrangement: LayoutArrangement): HelperResult {
    return layoutOps.applyLayout(this._asInternals(), targets, arrangement);
  }

  /** Apply style overrides to a specific field. */
  applyStyle(path: string, properties: Record<string, unknown>): HelperResult {
    return layoutOps.applyStyle(this._asInternals(), path, properties);
  }

  /** Apply style to form-level defaults or type selectors. */
  applyStyleAll(
    target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string },
    properties: Record<string, unknown>,
  ): HelperResult {
    return layoutOps.applyStyleAll(this._asInternals(), target, properties);
  }

  // ── Theme Token / Default / Breakpoint Helpers ──

  /** Set or delete a single theme token (null = delete). */
  setToken(key: string, value: string | null): HelperResult {
    return themeOps.setToken(this._asInternals(), key, value);
  }

  /** Set a default theme property (e.g. labelPosition, widget, cssClass). */
  setThemeDefault(property: string, value: unknown): HelperResult {
    return themeOps.setThemeDefault(this._asInternals(), property, value);
  }

  /** Set or delete a responsive breakpoint (null minWidth = delete). */
  setBreakpoint(name: string, minWidth: number | null): HelperResult {
    return themeOps.setBreakpoint(this._asInternals(), name, minWidth);
  }

  // ── Locale helpers ──

  /** Set a localized string for the selected or explicit locale. */
  setLocaleString(key: string, value: string, localeId?: string): HelperResult {
    return themeOps.setLocaleString(this._asInternals(), key, value, localeId);
  }

  /** Remove a localized string for the selected or explicit locale. */
  removeLocaleString(key: string, localeId?: string): HelperResult {
    return themeOps.removeLocaleString(this._asInternals(), key, localeId);
  }

  /** Update a locale metadata property such as name, title, or description. */
  setLocaleMetadata(property: string, value: unknown, localeId?: string): HelperResult {
    return themeOps.setLocaleMetadata(this._asInternals(), property, value, localeId);
  }

  // ── Theme Selector CRUD ──

  /** Add a theme selector rule. */
  addThemeSelector(match: Record<string, unknown>, apply: Record<string, unknown>): HelperResult {
    return themeOps.addThemeSelector(this._asInternals(), match, apply);
  }

  /** Update a theme selector rule by index. */
  updateThemeSelector(index: number, changes: { match?: Record<string, unknown>; apply?: Record<string, unknown> }): HelperResult {
    return themeOps.updateThemeSelector(this._asInternals(), index, changes);
  }

  /** Delete a theme selector rule by index. */
  deleteThemeSelector(index: number): HelperResult {
    return themeOps.deleteThemeSelector(this._asInternals(), index);
  }

  /** Reorder a theme selector rule. */
  reorderThemeSelector(index: number, direction: 'up' | 'down'): HelperResult {
    return themeOps.reorderThemeSelector(this._asInternals(), index, direction);
  }

  // ── Migration helpers ──

  /** Ensure a migration descriptor exists for a source version. */
  addMigration(fromVersion: string, description?: string): HelperResult {
    return themeOps.addMigration(this._asInternals(), fromVersion, description);
  }

  /** Add a field-map rule to a migration descriptor. */
  addMigrationRule(params: {
    fromVersion: string;
    source: string;
    target: string | null;
    transform: string;
    expression?: string;
    insertIndex?: number;
  }): HelperResult {
    return themeOps.addMigrationRule(this._asInternals(), params);
  }

  /** Remove a field-map rule from a migration descriptor. */
  removeMigrationRule(fromVersion: string, index: number): HelperResult {
    return themeOps.removeMigrationRule(this._asInternals(), fromVersion, index);
  }

  // ── Theme Per-Item Override Helpers ──

  /** Set a per-item theme override (e.g. labelPosition for a specific field). */
  setItemOverride(itemKey: string, property: string, value: unknown): HelperResult {
    return themeOps.setItemOverride(this._asInternals(), itemKey, property, value);
  }

  /** Clear all per-item theme overrides for an item. */
  clearItemOverrides(itemKey: string): HelperResult {
    return themeOps.clearItemOverrides(this._asInternals(), itemKey);
  }

  // ── Region Helpers ──

  /** Add an empty region to a page. */
  addRegion(pageId: string, span?: number): HelperResult {
    return layoutOps.addRegion(this._asInternals(), pageId, span);
  }

  /** Update a region property by index. */
  updateRegion(pageId: string, regionIndex: number, property: string, value: unknown): HelperResult {
    return layoutOps.updateRegion(this._asInternals(), pageId, regionIndex, property, value);
  }

  /** Delete a region from a page by index. */
  deleteRegion(pageId: string, regionIndex: number): HelperResult {
    return layoutOps.deleteRegion(this._asInternals(), pageId, regionIndex);
  }

  /** Reorder a region within a page by index. */
  reorderRegion(pageId: string, regionIndex: number, direction: 'up' | 'down'): HelperResult {
    return layoutOps.reorderRegion(this._asInternals(), pageId, regionIndex, direction);
  }

  /** Set the field-key assignment for a region by index. */
  setRegionKey(pageId: string, regionIndex: number, newKey: string): HelperResult {
    return layoutOps.setRegionKey(this._asInternals(), pageId, regionIndex, newKey);
  }

  /** Rename a page's title. */
  renamePage(pageId: string, newTitle: string): HelperResult {
    return layoutOps.renamePage(this._asInternals(), pageId, newTitle);
  }


  // ── Behavioral Page Methods ──

  /** Set the width (grid span) of an item on a page. */
  setItemWidth(pageId: string, itemKey: string, width: number): HelperResult {
    return layoutOps.setItemWidth(this._asInternals(), pageId, itemKey, width);
  }

  /** Set the offset (grid start) of an item on a page. */
  setItemOffset(pageId: string, itemKey: string, offset: number | undefined): HelperResult {
    return layoutOps.setItemOffset(this._asInternals(), pageId, itemKey, offset);
  }

  /** Set responsive breakpoint overrides for an item on a page. */
  setItemResponsive(
    pageId: string,
    itemKey: string,
    breakpoint: string,
    overrides: { width?: number; offset?: number; hidden?: boolean } | undefined,
  ): HelperResult {
    return layoutOps.setItemResponsive(this._asInternals(), pageId, itemKey, breakpoint, overrides);
  }

  /** Remove an item from a page. */
  removeItemFromPage(pageId: string, itemKey: string): HelperResult {
    return layoutOps.removeItemFromPage(this._asInternals(), pageId, itemKey);
  }

  /**
   * Move an item from one page to another as a single atomic undo step.
   * Batches the unassign + assign into one history entry so undo/redo is coherent.
   */
  moveItemToPage(sourcePageId: string, itemKey: string, targetPageId: string, opts?: PlacementOptions): HelperResult {
    return layoutOps.moveItemToPage(this._asInternals(), sourcePageId, itemKey, targetPageId, opts);
  }

  /** Reorder an item within a page (by key, not index). */
  reorderItemOnPage(pageId: string, itemKey: string, direction: 'up' | 'down'): HelperResult {
    return layoutOps.reorderItemOnPage(this._asInternals(), pageId, itemKey, direction);
  }

  /** Move an item to an arbitrary position on a page by target index. */
  moveItemOnPageToIndex(pageId: string, itemKey: string, targetIndex: number): HelperResult {
    return layoutOps.moveItemOnPageToIndex(this._asInternals(), pageId, itemKey, targetIndex);
  }

  // ── Component Tree Helpers ──

  /** Add a component-tree node under an arbitrary parent ref. */
  addComponentNode(
    parent: { bind?: string; nodeId?: string },
    component: string,
    options?: { bind?: string; props?: Record<string, unknown>; insertIndex?: number },
  ): HelperResult & { nodeRef?: { bind?: string; nodeId?: string } } {
    return componentTreeOps.addComponentNode(this._asInternals(), parent, component, options);
  }

  /** Add a layout-only node to the component tree. */
  addLayoutNode(parentNodeId: string, component: string): HelperResult {
    return componentTreeOps.addLayoutNode(this._asInternals(), parentNodeId, component);
  }

  /** Unwrap a layout container, promoting its children. */
  unwrapLayoutNode(nodeId: string): HelperResult {
    return componentTreeOps.unwrapLayoutNode(this._asInternals(), nodeId);
  }

  /** Delete a layout node from the component tree. */
  deleteLayoutNode(nodeId: string): HelperResult {
    return componentTreeOps.deleteLayoutNode(this._asInternals(), nodeId);
  }

  /** Wrap a component node (by bind or nodeId ref) in any layout component. */
  wrapComponentNode(ref: { bind: string } | { nodeId: string }, component: string): HelperResult {
    return componentTreeOps.wrapComponentNode(this._asInternals(), ref, component);
  }

  /** Wrap multiple sibling nodes in one layout container (same parent, visual order preserved). */
  wrapSiblingComponentNodes(
    refs: Array<{ bind: string } | { nodeId: string }>,
    component: string,
  ): HelperResult {
    return componentTreeOps.wrapSiblingComponentNodes(this._asInternals(), refs, component);
  }

  /** Reorder a component node (by bind or nodeId ref) up or down. */
  reorderComponentNode(ref: { bind?: string; nodeId?: string }, direction: 'up' | 'down'): HelperResult {
    return componentTreeOps.reorderComponentNode(this._asInternals(), ref, direction);
  }

  /** Move a component node (by bind or nodeId ref) as the last child of a target container. */
  moveComponentNodeToContainer(
    ref: { bind?: string; nodeId?: string },
    targetParent: { bind?: string; nodeId?: string },
  ): HelperResult {
    return componentTreeOps.moveComponentNodeToContainer(this._asInternals(), ref, targetParent);
  }

  /** Move a component node (by bind or nodeId ref) to a specific index within a target container. */
  moveComponentNodeToIndex(
    ref: { bind?: string; nodeId?: string },
    targetParent: { bind?: string; nodeId?: string },
    insertIndex: number,
  ): HelperResult {
    return componentTreeOps.moveComponentNodeToIndex(this._asInternals(), ref, targetParent, insertIndex);
  }

  /** Delete a component node by bind or nodeId ref. */
  deleteComponentNode(ref: { bind?: string; nodeId?: string }): HelperResult {
    return componentTreeOps.deleteComponentNode(this._asInternals(), ref);
  }

  // ── Option Set Helpers ──

  /** Update a property on an option set. */
  updateOptionSet(name: string, property: string, value: unknown): HelperResult {
    return definitionOps.updateOptionSet(this._asInternals(), name, property, value);
  }

  /** Delete an option set by name. */
  deleteOptionSet(name: string): HelperResult {
    return definitionOps.deleteOptionSet(this._asInternals(), name);
  }

  // ── Mapping Helpers ──

  /** Set a mapping document root property (e.g. version, direction, autoMap). */
  setMappingProperty(property: string, value: unknown, mappingId?: string): HelperResult {
    return mappingOps.setMappingProperty(this._asInternals(), property, value, mappingId);
  }

  /** Set a property on the mapping's target structure descriptor. */
  setMappingTargetSchema(property: string, value: unknown, mappingId?: string): HelperResult {
    return mappingOps.setMappingTargetSchema(this._asInternals(), property, value, mappingId);
  }

  /** Add a mapping rule with optional transform parameters. */
  addMappingRule(params: {
    sourcePath?: string;
    targetPath?: string;
    transform?: string;
    insertIndex?: number;
    mappingId?: string;
  }): HelperResult {
    return mappingOps.addMappingRule(this._asInternals(), params);
  }

  /** Update a property of an existing mapping rule. */
  updateMappingRule(index: number, property: string, value: unknown, mappingId?: string): HelperResult {
    return mappingOps.updateMappingRule(this._asInternals(), index, property, value, mappingId);
  }

  /** Remove a mapping rule by index. */
  removeMappingRule(index: number, mappingId?: string): HelperResult {
    return mappingOps.removeMappingRule(this._asInternals(), index, mappingId);
  }

  /** Clear all mapping rules. */
  clearMappingRules(mappingId?: string): HelperResult {
    return mappingOps.clearMappingRules(this._asInternals(), mappingId);
  }

  /** Reorder a mapping rule. */
  reorderMappingRule(index: number, direction: 'up' | 'down', mappingId?: string): HelperResult {
    return mappingOps.reorderMappingRule(this._asInternals(), index, direction, mappingId);
  }

  /** Set configuration for a specific wire-format adapter (JSON, XML, CSV). */
  setMappingAdapter(format: string, config: unknown): HelperResult {
    return mappingOps.setMappingAdapter(this._asInternals(), format, config);
  }

  /** Update the top-level mapping defaults. */
  updateMappingDefaults(defaults: Record<string, unknown>): HelperResult {
    return mappingOps.updateMappingDefaults(this._asInternals(), defaults);
  }

  /** Auto-generate mapping rules for every field in the form. */
  autoGenerateMappingRules(params: {
    mappingId?: string;
    scopePath?: string;
    priority?: number;
    replace?: boolean;
  } = {}): HelperResult {
    return mappingOps.autoGenerateMappingRules(this._asInternals(), params);
  }

  /** Run a mapping preview and return the projected output. */
  previewMapping(params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult {
    return mappingOps.previewMapping(this._asInternals(), params);
  }

  /** Create a new named mapping document and select it. */
  createMapping(id: string, options: { targetSchema?: Record<string, unknown> } = {}): HelperResult {
    return mappingOps.createMapping(this._asInternals(), id, options);
  }

  /** Delete a named mapping document. Throws if it is the last mapping. */
  deleteMapping(id: string): HelperResult {
    return mappingOps.deleteMapping(this._asInternals(), id);
  }

  /** Rename a mapping document. Throws if the new ID already exists. */
  renameMapping(oldId: string, newId: string): HelperResult {
    return mappingOps.renameMapping(this._asInternals(), oldId, newId);
  }

  /** Select the active mapping document by ID. */
  selectMapping(id: string): HelperResult {
    return mappingOps.selectMapping(this._asInternals(), id);
  }

  // ── Variable Helpers ──

  /** Add a named FEL variable. */
  addVariable(name: string, expression: string, scope?: string): HelperResult {
    return projectVariables.addVariable(this._asInternals(), name, expression, scope);
  }

  /** Update a variable's expression. */
  updateVariable(name: string, expression: string): HelperResult {
    return projectVariables.updateVariable(this._asInternals(), name, expression);
  }

  /** Remove a variable — warns about dangling references. */
  removeVariable(name: string): HelperResult {
    return projectVariables.removeVariable(this._asInternals(), name);
  }

  /**
   * Rename a definition variable and rewrite FEL references — **not implemented**.
   *
   * Blocked on a `definition.renameVariable` (or equivalent) command in
   * `@formspec-org/core`; until that exists this helper always throws
   * {@link HelperError} with code `NOT_IMPLEMENTED`. See the studio README
   * “Known limitations” section for the product-facing note.
   */
  renameVariable(name: string, newName: string): HelperResult {
    return projectVariables.renameVariable(this._asInternals(), name, newName);
  }

  // ── Instance Helpers ──

  /** Add a named external data source. */
  addInstance(name: string, props: InstanceProps): HelperResult {
    return projectVariables.addInstance(this._asInternals(), name, props);
  }

  /** Update instance properties. */
  updateInstance(name: string, changes: Partial<InstanceProps>): HelperResult {
    return projectVariables.updateInstance(this._asInternals(), name, changes);
  }

  /** Rename an instance — rewrites FEL references. */
  renameInstance(name: string, newName: string): HelperResult {
    return projectVariables.renameInstance(this._asInternals(), name, newName);
  }

  /** Remove an instance. */
  removeInstance(name: string): HelperResult {
    return projectVariables.removeInstance(this._asInternals(), name);
  }

  // ── Screener Document Helpers ──

  /** Create a new screener document with a default first-match phase. */
  createScreenerDocument(options?: { url?: string; title?: string }): HelperResult {
    return screenerOps.createScreenerDocument(this._asInternals(), options);
  }

  /** Remove the screener document. */
  deleteScreenerDocument(): HelperResult {
    return screenerOps.deleteScreenerDocument(this._asInternals());
  }

  /** Add a screener question. */
  addScreenField(key: string, label: string, type: string, props?: FieldProps): HelperResult {
    return screenerOps.addScreenField(this._asInternals(), key, label, type, props);
  }

  /** Remove a screener question. */
  removeScreenField(key: string): HelperResult {
    return screenerOps.removeScreenField(this._asInternals(), key);
  }

  /** Update properties on a screener question. */
  updateScreenField(key: string, changes: { label?: string; helpText?: string; required?: boolean | string }): HelperResult {
    return screenerOps.updateScreenField(this._asInternals(), key, changes);
  }

  /** Reorder a screener question by key. */
  reorderScreenField(key: string, direction: 'up' | 'down'): HelperResult {
    return screenerOps.reorderScreenField(this._asInternals(), key, direction);
  }

  // ── Phase Management ──

  /** Add an evaluation phase. */
  addEvaluationPhase(id: string, strategy: string, label?: string): HelperResult {
    return screenerOps.addEvaluationPhase(this._asInternals(), id, strategy, label);
  }

  /** Remove an evaluation phase. */
  removeEvaluationPhase(phaseId: string): HelperResult {
    return screenerOps.removeEvaluationPhase(this._asInternals(), phaseId);
  }

  /** Reorder an evaluation phase. */
  reorderPhase(phaseId: string, direction: 'up' | 'down'): HelperResult {
    return screenerOps.reorderPhase(this._asInternals(), phaseId, direction);
  }

  /** Set strategy and config on a phase. */
  setPhaseStrategy(phaseId: string, strategy: string, config?: Record<string, unknown>): HelperResult {
    return screenerOps.setPhaseStrategy(this._asInternals(), phaseId, strategy, config);
  }

  // ── Phase-Scoped Route Management ──

  /** Add a route to a phase. */
  addScreenRoute(phaseId: string, route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number }, insertIndex?: number): HelperResult {
    return screenerOps.addScreenRoute(this._asInternals(), phaseId, route, insertIndex);
  }

  /** Update properties on a route. */
  updateScreenRoute(
    phaseId: string,
    routeIndex: number,
    changes: { condition?: string; target?: string; label?: string; message?: string; score?: string; threshold?: number; override?: boolean; terminal?: boolean },
  ): HelperResult {
    return screenerOps.updateScreenRoute(this._asInternals(), phaseId, routeIndex, changes);
  }

  /** Reorder a route within a phase. */
  reorderScreenRoute(phaseId: string, routeIndex: number, direction: 'up' | 'down'): HelperResult {
    return screenerOps.reorderScreenRoute(this._asInternals(), phaseId, routeIndex, direction);
  }

  /** Remove a route from a phase. */
  removeScreenRoute(phaseId: string, routeIndex: number): HelperResult {
    return screenerOps.removeScreenRoute(this._asInternals(), phaseId, routeIndex);
  }

  // ── Screener Lifecycle ──

  /** Set screener availability window. Pass null to clear. */
  setScreenerAvailability(from?: string | null, until?: string | null): HelperResult {
    return screenerOps.setScreenerAvailability(this._asInternals(), from, until);
  }

  /** Set screener result validity duration. Pass null to clear. */
  setScreenerResultValidity(duration: string | null): HelperResult {
    return screenerOps.setScreenerResultValidity(this._asInternals(), duration);
  }

  // ── Preview / Query Methods ──

  /**
   * Generate plausible sample data for each field based on its data type.
   * When overrides are provided, those values replace the generated defaults
   * for matching field paths. Override keys that don't match any field path
   * are silently ignored.
   *
   * Fields hidden by show_when/relevant conditions are excluded from the
   * result. Relevance is evaluated by loading the sample data into a
   * FormEngine and reading its relevance signals.
   */
  generateSampleData(overrides?: Record<string, unknown>): Record<string, unknown> {
    return previewOps.generateSampleData(this._asInternals(), overrides);
  }

  /**
   * Return a cleaned-up deep clone of the definition.
   * Strips null values, empty arrays, and undefined keys.
   */
  normalizeDefinition(): Record<string, unknown> {
    return previewOps.normalizeDefinition(this._asInternals());
  }
}

export function createProject(options?: CreateProjectOptions): Project {
  // Set up changeset recording middleware if requested
  let recorderControl: ChangesetRecorderControl | undefined;
  const coreMiddleware: import('@formspec-org/core').Middleware[] = [];

  if (options?.enableChangesets !== false) {
    // Default: enable changeset support
    recorderControl = {
      recording: false,
      currentActor: 'user',
      onCommandsRecorded: () => {}, // Will be overridden by ProposalManager constructor
    };
    coreMiddleware.push(createChangesetMiddleware(recorderControl));
  }

  const coreOptions: import('@formspec-org/core').ProjectOptions = {
    ...options,
    seed: options?.seed as import('@formspec-org/core').ProjectOptions['seed'],
    middleware: coreMiddleware.length > 0 ? coreMiddleware : undefined,
  };

  // Bridge studio-core options → core options at the package boundary
  return new Project(createRawProject(coreOptions), recorderControl);
}

/**
 * Build a full ProjectBundle from a bare definition.
 *
 * Uses createRawProject to generate the component tree, theme, and mapping
 * that the definition implies. On failure (degenerate definition), returns
 * a minimal bundle with the definition and empty/null documents.
 */
export function buildBundleFromDefinition(definition: FormDefinition): ProjectBundle {
  try {
    const project = createProject({ seed: { definition }, enableChangesets: false });
    const exported = project.export();
    return {
      ...exported,
      component: structuredClone(project.component),
    };
  } catch {
    return {
      definition,
      component: {
        $formspecComponent: '1.0',
        version: '0.1.0',
        targetDefinition: definition.url ? { url: definition.url } : undefined,
        tree: null!,
        customComponents: [],
      } as unknown as ComponentDocument,
      theme: null as unknown as ThemeDocument,
      mappings: {},
    };
  }
}
