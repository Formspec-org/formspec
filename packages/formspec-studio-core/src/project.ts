/** @filedesc Project class: high-level form authoring facade over formspec-core. */
import { createRawProject, createChangesetMiddleware } from 'formspec-core';
import type { ChangesetRecorderControl } from 'formspec-core';
// Internal-only core types — never appear in public method signatures
import type { IProjectCore, AnyCommand, CommandResult, FELParseContext, FELParseResult, FELReferenceSet, FELFunctionEntry, FieldDependents, ItemFilter, ItemSearchResult, Change, FormspecChangelog, LocaleState } from 'formspec-core';
import { ProposalManager } from './proposal-manager.js';
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
  type PlacementOptions,
  type LayoutArrangement,
  type InstanceProps,
  type ItemChanges,
  type MetadataChanges,
  type WidgetInfo,
  type FieldTypeCatalogEntry,
  type FELValidationResult,
  type FELSuggestion,
} from './helper-types.js';
import { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget, _FIELD_TYPE_MAP } from './field-type-aliases.js';
import { COMPATIBILITY_MATRIX, COMPONENT_TO_HINT } from 'formspec-types';
import { analyzeFEL } from 'formspec-engine/fel-runtime';
import { rewriteFELReferences } from 'formspec-engine/fel-tools';

/**
 * Behavior-driven authoring API for Formspec.
 * Composes an IProjectCore and exposes form-author-friendly helper methods.
 * All authoring methods return HelperResult.
 *
 * For raw project access (dispatch, state, queries), use formspec-core directly.
 */
export class Project {
  private _proposals: ProposalManager | null = null;

  constructor(
    private readonly core: IProjectCore,
    private readonly _recorderControl?: ChangesetRecorderControl,
  ) {
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
        component: s.component as unknown as ComponentDocument,
        theme: s.theme as unknown as ThemeDocument,
        mappings: s.mappings as unknown as Record<string, MappingDocument>,
        selectedMappingId: s.selectedMappingId,
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

  /** Returns the effective component document — authored if it has a tree, otherwise merged with generated. */
  get effectiveComponent(): Readonly<ComponentDocument> {
    const authored = this.core.component;
    const isAuthored = !!authored && typeof (authored as any).$formspecComponent === 'string' && !!(authored as any).tree;
    if (isAuthored) return authored;
    const generated = this.core.generatedComponent;
    return { ...authored, ...generated, tree: (generated as any).tree, 'x-studio-generated': true } as Readonly<ComponentDocument>;
  }

  // ── Queries ────────────────────────────────────────────────

  fieldPaths(): string[] { return this.core.fieldPaths(); }
  itemAt(path: string): FormItem | undefined { return this.core.itemAt(path); }
  bindFor(path: string): Record<string, unknown> | undefined { return this.core.bindFor(path); }
  variableNames(): string[] { return this.core.variableNames(); }
  instanceNames(): string[] { return this.core.instanceNames(); }
  statistics(): ProjectStatistics { return this.core.statistics(); }
  commandHistory(): readonly LogEntry[] { return this.core.log; }
  export(): ProjectBundle { return this.core.export() as unknown as ProjectBundle; }
  diagnose(): Diagnostics { return this.core.diagnose(); }
  componentFor(fieldKey: string): Record<string, unknown> | undefined { return this.core.componentFor(fieldKey); }
  searchItems(filter: ItemFilter): ItemSearchResult[] { return this.core.searchItems(filter); }
  parseFEL(expression: string, context?: FELParseContext): FELParseResult { return this.core.parseFEL(expression, context); }
  felFunctionCatalog(): FELFunctionEntry[] { return this.core.felFunctionCatalog(); }
  availableReferences(context?: string | FELParseContext): FELReferenceSet { return this.core.availableReferences(context); }
  expressionDependencies(expression: string): string[] { return this.core.expressionDependencies(expression); }
  fieldDependents(fieldPath: string): FieldDependents { return this.core.fieldDependents(fieldPath); }
  diffFromBaseline(fromVersion?: string): Change[] { return this.core.diffFromBaseline(fromVersion); }
  previewChangelog(): FormspecChangelog { return this.core.previewChangelog(); }

  // ── FEL editing helpers ───────────────────────────────────────

  /** Validate a FEL expression and return detailed diagnostics. */
  validateFELExpression(expression: string, contextPath?: string): FELValidationResult {
    const context: FELParseContext | undefined = contextPath ? { targetPath: contextPath } : undefined;
    const parseResult = this.core.parseFEL(expression, context);
    return {
      valid: parseResult.valid,
      errors: parseResult.errors.map(d => ({
        message: d.message,
        line: (d as any).line,
        column: (d as any).column,
      })),
      references: parseResult.references,
      functions: parseResult.functions,
    };
  }

  /** Return autocomplete suggestions for a partial FEL expression. */
  felAutocompleteSuggestions(partial: string, contextPath?: string): FELSuggestion[] {
    const context: FELParseContext | undefined = contextPath ? { targetPath: contextPath } : undefined;
    const refs = this.core.availableReferences(context);
    const catalog = this.core.felFunctionCatalog();

    // Extract the token being typed — strip leading $ or @ if present
    const stripped = partial.replace(/^\$/, '').replace(/^@/, '');
    const isFieldPrefix = partial.startsWith('$');
    const isVarPrefix = partial.startsWith('@');
    const lowerStripped = stripped.toLowerCase();

    const suggestions: FELSuggestion[] = [];

    // Field suggestions
    if (!isVarPrefix) {
      for (const field of refs.fields) {
        if (lowerStripped && !field.path.toLowerCase().startsWith(lowerStripped)) continue;
        suggestions.push({
          label: field.path,
          kind: 'field',
          detail: field.label ? `${field.label} (${field.dataType})` : field.dataType,
          insertText: `$${field.path}`,
        });
      }
    }

    // Function suggestions
    if (!isFieldPrefix && !isVarPrefix) {
      for (const fn of catalog) {
        if (lowerStripped && !fn.name.toLowerCase().startsWith(lowerStripped)) continue;
        suggestions.push({
          label: fn.name,
          kind: 'function',
          detail: fn.description ?? fn.signature ?? fn.category,
          insertText: `${fn.name}(`,
        });
      }
    }

    // Variable suggestions
    if (!isFieldPrefix) {
      for (const v of refs.variables) {
        if (lowerStripped && !v.name.toLowerCase().startsWith(lowerStripped)) continue;
        suggestions.push({
          label: v.name,
          kind: 'variable',
          detail: v.expression ? `= ${v.expression}` : undefined,
          insertText: `@${v.name}`,
        });
      }
    }

    // Instance suggestions
    if (!isFieldPrefix && !isVarPrefix) {
      for (const inst of refs.instances) {
        if (lowerStripped && !inst.name.toLowerCase().startsWith(lowerStripped)) continue;
        suggestions.push({
          label: inst.name,
          kind: 'instance',
          detail: inst.source,
          insertText: `instance('${inst.name}')`,
        });
      }
    }

    // Context-specific keyword suggestions (e.g. @current, @index, @count)
    if (!isFieldPrefix) {
      for (const ref of refs.contextRefs) {
        const name = ref.startsWith('@') ? ref.slice(1) : ref;
        if (lowerStripped && !name.toLowerCase().startsWith(lowerStripped)) continue;
        suggestions.push({
          label: ref,
          kind: 'keyword',
          detail: 'context reference',
          insertText: ref.startsWith('@') ? ref : `@${name}`,
        });
      }
    }

    return suggestions;
  }

  /** Convert a FEL expression to a human-readable English string. */
  humanizeFELExpression(expression: string): string {
    return humanizeFEL(expression);
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

  /** Returns widget names (component types) compatible with a given data type. */
  compatibleWidgets(dataType: string): string[] {
    return COMPATIBILITY_MATRIX[dataType] ?? [];
  }

  /** Returns the field type alias table (all types the user can specify in addField). */
  fieldTypeCatalog(): FieldTypeCatalogEntry[] {
    return Object.entries(_FIELD_TYPE_MAP).map(([alias, entry]) => ({
      alias,
      dataType: entry.dataType,
      defaultWidget: entry.defaultWidget,
    }));
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
    this.core.dispatch({
      type: 'component.moveNode',
      payload: {
        source: { nodeId: sourceNodeId },
        targetParent: { nodeId: targetParentNodeId },
        targetIndex,
      },
    } as AnyCommand);
    return {
      summary: `Moved layout node ${sourceNodeId}`,
      action: { helper: 'moveLayoutNode', params: { sourceNodeId, targetParentNodeId, targetIndex } },
      affectedPaths: [sourceNodeId],
    };
  }

  /** Batch-move multiple definition items atomically (e.g. multi-select DnD). */
  moveItems(
    moves: Array<{ sourcePath: string; targetParentPath?: string; targetIndex: number }>,
  ): HelperResult {
    const commands = moves.map(m => ({
      type: 'definition.moveItem',
      payload: {
        sourcePath: m.sourcePath,
        ...(m.targetParentPath != null ? { targetParentPath: m.targetParentPath } : {}),
        targetIndex: m.targetIndex,
      },
    }));
    this.core.batch(commands as AnyCommand[]);
    return {
      summary: `Moved ${moves.length} items`,
      action: { helper: 'moveItems', params: { moves } },
      affectedPaths: moves.map(m => m.sourcePath),
    };
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
    this.core.dispatch({ type: 'project.import', payload: bundle } as AnyCommand);
  }

  /** Add a mapping rule from a form field to an output target. */
  mapField(sourcePath: string, targetPath: string, mappingId?: string): HelperResult {
    if (!this.core.itemAt(sourcePath)) {
      this._throwPathNotFound(sourcePath);
    }
    this.core.dispatch({
      type: 'mapping.addRule',
      payload: { sourcePath, targetPath, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Mapped "${sourcePath}" → "${targetPath}"`,
      action: { helper: 'mapField', params: { sourcePath, targetPath, mappingId } },
      affectedPaths: [sourcePath],
    };
  }

  /** Remove all mapping rules for a given source path. */
  unmapField(sourcePath: string, mappingId?: string): HelperResult {
    const rules = (this.core.mapping as any)?.rules ?? [];
    const indices = rules
      .map((r: any, i: number) => r.sourcePath === sourcePath ? i : -1)
      .filter((i: number) => i >= 0)
      .reverse(); // descending to avoid index shift
    for (const idx of indices) {
      this.core.dispatch({
        type: 'mapping.deleteRule',
        payload: { index: idx, ...(mappingId !== undefined ? { mappingId } : {}) },
      } as AnyCommand);
    }
    return {
      summary: `Unmapped "${sourcePath}" (${indices.length} rule(s))`,
      action: { helper: 'unmapField', params: { sourcePath, mappingId } },
      affectedPaths: [sourcePath],
    };
  }

  /** Simple edit distance for fuzzy path matching. */
  private static _editDistance(a: string, b: string): number {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;
    const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
    for (let i = 0; i <= la; i++) dp[i][0] = i;
    for (let j = 0; j <= lb; j++) dp[0][j] = j;
    for (let i = 1; i <= la; i++) {
      for (let j = 1; j <= lb; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[la][lb];
  }

  /** Find field paths similar to the given (nonexistent) path. */
  private _findSimilarPaths(path: string, maxDistance = 3): string[] {
    const allPaths = this.core.fieldPaths();
    // Also include group paths
    const allItems = this.core.state.definition.items;
    const collectPaths = (items: any[], prefix?: string): string[] => {
      const result: string[] = [];
      for (const item of items) {
        const fullPath = prefix ? `${prefix}.${item.key}` : item.key;
        result.push(fullPath);
        if (item.children?.length) {
          result.push(...collectPaths(item.children, fullPath));
        }
      }
      return result;
    };
    const allKnownPaths = [...new Set([...allPaths, ...collectPaths(allItems)])];

    return allKnownPaths
      .map(p => ({ path: p, dist: Project._editDistance(path.toLowerCase(), p.toLowerCase()) }))
      .filter(({ dist }) => dist <= maxDistance && dist > 0)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map(({ path }) => path);
  }

  /** Throw PATH_NOT_FOUND with similarPaths detail. */
  private _throwPathNotFound(path: string): never {
    const similarPaths = this._findSimilarPaths(path);
    throw new HelperError('PATH_NOT_FOUND', `Item not found at path "${path}"`, {
      path,
      ...(similarPaths.length > 0 ? { similarPaths } : {}),
    });
  }

  /** Validate that `path` refers to an existing main-form item. Throws PATH_NOT_FOUND otherwise. */
  private _requireItemPath(path: string): void {
    if (!this.core.itemAt(path)) {
      this._throwPathNotFound(path);
    }
  }

  /** Resolve a page ID to its primary definition group path (from theme regions). */
  private _resolvePageGroup(pageId: string): string | undefined {
    const pages = (this.core.state.theme.pages ?? []) as Array<{ id: string; regions?: Array<{ key?: string }> }>;
    const page = pages.find(p => p.id === pageId);
    if (!page?.regions?.length) return undefined;
    const groupKey = page.regions[0].key;
    if (!groupKey) return undefined;
    const item = this.core.itemAt(groupKey);
    return item?.type === 'group' ? groupKey : undefined;
  }

  /**
   * Unified path resolution for addField/addGroup/addContent.
   *
   * - When `parentPath` is given, `path` is treated as relative: split on dots,
   *   last segment = key, preceding segments prepended to parentPath.
   * - When `parentPath` is NOT given, `path` is split on dots: last = key,
   *   preceding = parentPath.
   */
  private _resolvePath(path: string, parentPath?: string): { key: string; parentPath?: string; fullPath: string } {
    const segments = path.split('.');
    const key = segments.pop()!;
    const relativeParts = segments; // everything before the last dot

    let effectiveParent: string | undefined;
    if (parentPath) {
      effectiveParent = relativeParts.length > 0
        ? `${parentPath}.${relativeParts.join('.')}`
        : parentPath;
    } else {
      effectiveParent = relativeParts.length > 0 ? relativeParts.join('.') : undefined;
    }

    const fullPath = effectiveParent ? `${effectiveParent}.${key}` : key;
    return { key, parentPath: effectiveParent, fullPath };
  }

  // ── Authoring methods ──

  /**
   * Add a data collection field.
   * Resolves type alias → { dataType, defaultWidget } via the Field Type Alias Table.
   * Widget in props resolved via the Widget Alias Table before dispatch.
   */
  addField(path: string, label: string, type: string, props?: FieldProps): HelperResult {
    // Pre-validation
    const resolved = resolveFieldType(type);
    let resolvedWidget = resolved.defaultWidget;
    let widgetAlias: string | undefined;

    if (props?.widget) {
      resolvedWidget = resolveWidget(props.widget);
      widgetAlias = props.widget;
    }

    if (props?.choices && props?.choicesFrom) {
      throw new HelperError('INVALID_PROPS', 'Cannot set both choices and choicesFrom', {
        choices: props.choices,
        choicesFrom: props.choicesFrom,
      });
    }

    if (props?.page) {
      const pages = this.core.state.theme.pages;
      const pageExists = pages?.some((p: any) => p.id === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = this._resolvePageGroup(props.page);
    }

    const { key, parentPath, fullPath } = this._resolvePath(path, baseParent);

    // Check for duplicate key
    if (this.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }

    // Build phase1: definition.addItem
    const addItemPayload: Record<string, unknown> = {
      type: 'field',
      key,
      label,
      dataType: resolved.dataType,
    };
    if (parentPath) addItemPayload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) addItemPayload.insertIndex = props.insertIndex;

    const phase1: AnyCommand[] = [
      { type: 'definition.addItem', payload: addItemPayload },
    ];

    // Build phase2: component + binds + properties
    const phase2: AnyCommand[] = [
      { type: 'component.setFieldWidget', payload: { fieldKey: key, widget: resolvedWidget } },
    ];

    // textarea needs extra widgetHint on the component node
    if ((widgetAlias && isTextareaWidget(widgetAlias)) || (!widgetAlias && resolved.defaultWidgetHint === 'textarea')) {
      phase2.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: key }, property: 'widgetHint', value: 'textarea' },
      });
    }

    // Widget hint on definition for round-trip
    const hint = widgetAlias
      ? widgetHintFor(widgetAlias)
      : (resolved.defaultWidgetHint ?? widgetHintFor(resolvedWidget));
    if (hint) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'presentation.widgetHint', value: hint },
      });
    }

    // Required
    if (props?.required) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { required: 'true' } },
      });
    }

    // Readonly
    if (props?.readonly) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { readonly: 'true' } },
      });
    }

    // Semantic type constraint (email, phone) — uses $ self-reference
    if (resolved.constraintExpr) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { constraint: resolved.constraintExpr } },
      });
    }

    // Initial value
    if (props?.initialValue !== undefined && props?.initialValue !== null) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'initialValue', value: props.initialValue },
      });
    }

    // Inline choices
    if (props?.choices) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'options', value: props.choices },
      });
    }

    // Named option set
    if (props?.choicesFrom) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'optionSet', value: props.choicesFrom },
      });
    }

    // Page assignment
    if (props?.page) {
      phase2.push({
        type: 'pages.assignItem',
        payload: { pageId: props.page, key },
      });
    }

    // Item properties
    if (props?.hint) {
      addItemPayload.hint = props.hint;
    }
    if (props?.description) {
      addItemPayload.description = props.description;
    }
    // H1: placeholder → theme widgetConfig
    if (props?.placeholder) {
      phase2.push({
        type: 'theme.setItemWidgetConfig',
        payload: { itemKey: key, property: 'placeholder', value: props.placeholder },
      });
    }
    // H2: ariaLabel → theme accessibility
    if (props?.ariaLabel) {
      phase2.push({
        type: 'theme.setItemAccessibility',
        payload: { itemKey: key, property: 'description', value: props.ariaLabel },
      });
    }

    // Dispatch
    this.core.batchWithRebuild(phase1, phase2);

    return {
      summary: `Added field '${key}' (${type}) to ${parentPath ? `'${parentPath}'` : 'root'}`,
      action: { helper: 'addField', params: { path: fullPath, label, type } },
      affectedPaths: [fullPath],
    };
  }

  /** Add a group/section container. */
  addGroup(path: string, label: string, props?: GroupProps): HelperResult {
    // Page validation
    if (props?.page) {
      const pages = this.core.state.theme.pages;
      const pageExists = pages?.some((p: any) => p.id === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = this._resolvePageGroup(props.page);
    }

    const { key, parentPath, fullPath } = this._resolvePath(path, baseParent);

    if (this.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }

    const addItemPayload: Record<string, unknown> = {
      type: 'group',
      key,
      label,
    };
    if (parentPath) addItemPayload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) addItemPayload.insertIndex = props.insertIndex;

    // addGroup creates only the definition group (response structure).
    // Page assignment is a separate action via the Pages tab.
    if (props?.display) {
      // Two-phase: addItem triggers rebuild, then setGroupDisplayMode on rebuilt tree
      this.core.batchWithRebuild(
        [{ type: 'definition.addItem', payload: addItemPayload }],
        [{ type: 'component.setGroupDisplayMode', payload: { groupKey: key, mode: props.display } }],
      );
    } else {
      // Single dispatch — no component tree dependency
      this.core.dispatch({ type: 'definition.addItem', payload: addItemPayload });
    }

    return {
      summary: `Added group '${key}' to ${parentPath ? `'${parentPath}'` : 'root'}`,
      action: { helper: 'addGroup', params: { path: fullPath, label, display: props?.display } },
      affectedPaths: [fullPath],
    };
  }

  /** Add display content — non-data element. */
  addContent(
    path: string,
    body: string,
    kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider',
    props?: ContentProps,
  ): HelperResult {
    // Kind → widgetHint mapping
    const kindToHint: Record<string, string> = {
      heading: 'heading',
      instructions: 'paragraph',
      paragraph: 'paragraph',
      alert: 'banner',
      banner: 'banner',
      divider: 'divider',
    };
    const widgetHint = kindToHint[kind ?? 'paragraph'] ?? 'paragraph';

    if (props?.page) {
      const pages = this.core.state.theme.pages;
      const pageExists = pages?.some((p: any) => p.id === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = this._resolvePageGroup(props.page);
    }

    const { key, parentPath, fullPath } = this._resolvePath(path, baseParent);

    if (this.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }

    const payload: Record<string, unknown> = {
      type: 'display',
      key,
      label: body,
      presentation: { widgetHint },
    };
    if (parentPath) payload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) payload.insertIndex = props.insertIndex;

    const commands: AnyCommand[] = [{ type: 'definition.addItem', payload }];

    if (props?.page) {
      commands.push({
        type: 'pages.assignItem',
        payload: { pageId: props.page, key },
      });
    }

    if (commands.length > 1) {
      this.core.batchWithRebuild([commands[0]], commands.slice(1));
    } else {
      this.core.dispatch(commands[0]);
    }

    return {
      summary: `Added ${kind ?? 'paragraph'} content '${key}'`,
      action: { helper: 'addContent', params: { path: fullPath, body, kind } },
      affectedPaths: [fullPath],
    };
  }

  // ── Bind Helpers ──

  /** Validate a FEL expression string, throwing INVALID_FEL if it fails to parse. */
  private _validateFEL(expression: string): void {
    const result = this.core.parseFEL(expression);
    if (!result.valid) {
      throw new HelperError('INVALID_FEL', `Invalid FEL expression: ${expression}`, {
        expression,
        parseError: result.errors[0] ? {
          message: result.errors[0].message,
          code: result.errors[0].code,
        } : undefined,
      });
    }
  }

  /** Throw CIRCULAR_REFERENCE if the expression references the variable being defined. */
  private _checkVariableSelfReference(name: string, expression: string): void {
    const analysis = analyzeFEL(expression);
    if (analysis.valid && analysis.variables.includes(name)) {
      throw new HelperError('CIRCULAR_REFERENCE', `Variable "${name}" references itself`, {
        name,
        expression,
      });
    }
  }

  /**
   * Normalize a shape target path by inserting `[*]` after any repeatable group
   * segments. Template paths like `expenses.receipt` become `expenses[*].receipt`
   * when `expenses` is a repeatable group.
   *
   * Skips special targets (`*`, `#`) and paths that already contain wildcards
   * at the correct positions.
   */
  private _normalizeShapeTarget(target: string): string {
    // Special targets — pass through
    if (target === '*' || target === '#') return target;

    // Split on dots but preserve existing [*] suffixes
    const segments = target.split('.');
    const normalized: string[] = [];
    let lookupPath = '';

    for (const segment of segments) {
      // If segment already has [*], keep it as-is
      if (segment.endsWith('[*]')) {
        normalized.push(segment);
        lookupPath += (lookupPath ? '.' : '') + segment.replace('[*]', '');
        continue;
      }

      normalized.push(segment);
      lookupPath += (lookupPath ? '.' : '') + segment;

      // Check if this segment is a repeatable group
      const item = this.core.itemAt(lookupPath);
      if (item?.type === 'group' && (item as any).repeatable) {
        // Append [*] to the last segment we just pushed
        normalized[normalized.length - 1] = segment + '[*]';
      }
    }

    return normalized.join('.');
  }

  /** Conditional visibility — dispatches definition.setBind { relevant: condition } */
  showWhen(target: string, condition: string): HelperResult {
    this._requireItemPath(target);
    this._validateFEL(condition);
    this.core.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { relevant: condition } },
    });
    return {
      summary: `Set '${target}' visible when: ${condition}`,
      action: { helper: 'showWhen', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Readonly condition — dispatches definition.setBind { readonly: condition } */
  readonlyWhen(target: string, condition: string): HelperResult {
    this._requireItemPath(target);
    this._validateFEL(condition);
    this.core.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { readonly: condition } },
    });
    return {
      summary: `Set '${target}' readonly when: ${condition}`,
      action: { helper: 'readonlyWhen', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Required rule — dispatches definition.setBind { required: condition ?? 'true' } */
  require(target: string, condition?: string): HelperResult {
    this._requireItemPath(target);
    const expr = condition ?? 'true';
    this._validateFEL(expr);
    this.core.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { required: expr } },
    });
    return {
      summary: `Set '${target}' required${condition ? ` when: ${condition}` : ''}`,
      action: { helper: 'require', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Calculated value — dispatches definition.setBind { calculate: expression } */
  calculate(target: string, expression: string): HelperResult {
    this._requireItemPath(target);
    this._validateFEL(expression);
    this.core.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { calculate: expression } },
    });
    return {
      summary: `Set '${target}' calculated as: ${expression}`,
      action: { helper: 'calculate', params: { target, expression } },
      affectedPaths: [target],
    };
  }

  // ── Branch ──

  /** Build a FEL expression for a single branch arm. */
  private _branchExpr(on: string, when: string | number | boolean, mode: 'equals' | 'contains'): string {
    if (mode === 'contains') {
      return typeof when === 'string' ? `selected(${on}, '${when}')` : `selected(${on}, ${when})`;
    }
    // equals mode
    if (typeof when === 'string') return `${on} = '${when}'`;
    if (typeof when === 'boolean') return `${on} = ${when}`;
    return `${on} = ${when}`;
  }

  /**
   * Branching — show different fields based on an answer.
   * Auto-detects mode for multiChoice fields (uses selected() not equals).
   */
  branch(on: string, paths: BranchPath[], otherwise?: string | string[]): HelperResult {
    // Pre-validate: on field must exist
    const onItem = this.core.itemAt(on);
    if (!onItem) {
      this._throwPathNotFound(on);
    }

    // Auto-detect mode based on on-field dataType
    const isMultiChoice = onItem.dataType === 'multiChoice';
    const defaultMode = isMultiChoice ? 'contains' as const : 'equals' as const;

    const warnings: HelperWarning[] = [];
    const allExprs: string[] = [];
    const affectedPaths: string[] = [];

    // Accumulate expressions per target — multiple arms can target the same field
    const targetExprs = new Map<string, string[]>();

    for (const arm of paths) {
      const mode = arm.mode ?? defaultMode;
      const expr = this._branchExpr(on, arm.when, mode);
      allExprs.push(expr);

      const targets = Array.isArray(arm.show) ? arm.show : [arm.show];
      for (const target of targets) {
        if (!targetExprs.has(target)) {
          targetExprs.set(target, []);
        }
        targetExprs.get(target)!.push(expr);
      }
    }

    // Otherwise arm
    if (otherwise) {
      const otherwiseTargets = Array.isArray(otherwise) ? otherwise : [otherwise];
      const negatedExpr = allExprs.length === 1
        ? `not(${allExprs[0]})`
        : `not(${allExprs.join(' or ')})`;

      for (const target of otherwiseTargets) {
        if (!targetExprs.has(target)) {
          targetExprs.set(target, []);
        }
        targetExprs.get(target)!.push(negatedExpr);
      }
    }

    // Emit one setBind per target with OR'd expression
    const commands: AnyCommand[] = [];
    for (const [target, exprs] of targetExprs) {
      const existingBind = this.core.bindFor(target);
      if (existingBind?.relevant) {
        warnings.push({
          code: 'RELEVANT_OVERWRITTEN',
          message: `Existing relevant expression on "${target}" was replaced`,
          detail: { path: target, previousExpression: existingBind.relevant },
        });
      }

      const combined = exprs.length === 1 ? exprs[0] : exprs.join(' or ');
      commands.push({
        type: 'definition.setBind',
        payload: { path: target, properties: { relevant: combined } },
      });
      affectedPaths.push(target);
    }

    // Dispatch all setBind commands atomically
    this.core.dispatch(commands);
    return {
      summary: `Branch on '${on}' with ${paths.length} arm(s)`,
      action: { helper: 'branch', params: { on, paths: paths.length, otherwise: !!otherwise } },
      affectedPaths,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Validation Helpers ──

  /** Cross-field validation — adds a shape rule. */
  addValidation(
    target: string,
    rule: string,
    message: string,
    options?: ValidationOptions,
  ): HelperResult {
    // Validate target path exists (skip form-wide wildcards and repeat wildcards)
    if (target !== '*' && target !== '#' && !target.includes('[*]')) {
      this._requireItemPath(target);
    }

    this._validateFEL(rule);
    if (options?.activeWhen) {
      this._validateFEL(options.activeWhen);
    }

    const normalizedTarget = this._normalizeShapeTarget(target);

    const payload: Record<string, unknown> = {
      target: normalizedTarget,
      constraint: rule,
      message,
    };
    if (options?.timing) payload.timing = options.timing;
    if (options?.severity) payload.severity = options.severity;
    if (options?.code) payload.code = options.code;
    if (options?.activeWhen) payload.activeWhen = options.activeWhen;

    this.core.dispatch({ type: 'definition.addShape', payload });

    // Read the shape ID from state (addShape appends to shapes array)
    const shapes = this.core.state.definition.shapes ?? [];
    const createdId = shapes[shapes.length - 1]?.id;

    return {
      summary: `Added validation on '${target}': ${message}`,
      action: { helper: 'addValidation', params: { target, rule, message } },
      affectedPaths: [createdId],
      createdId,
    };
  }

  /** Remove a validation shape by ID. */
  removeValidation(shapeId: string): HelperResult {
    this.core.dispatch({ type: 'definition.deleteShape', payload: { id: shapeId } });
    return {
      summary: `Removed validation '${shapeId}'`,
      action: { helper: 'removeValidation', params: { shapeId } },
      affectedPaths: [shapeId],
    };
  }

  /** Update a validation shape's rule, message, or options. */
  updateValidation(
    shapeId: string,
    changes: {
      rule?: string;
      message?: string;
      timing?: 'continuous' | 'submit' | 'demand';
      severity?: 'error' | 'warning' | 'info';
      code?: string;
      activeWhen?: string;
    },
  ): HelperResult {
    if (changes.rule) this._validateFEL(changes.rule);
    if (changes.activeWhen) this._validateFEL(changes.activeWhen);

    const commands: AnyCommand[] = [];

    // rule → dispatches as 'constraint' (shape schema property)
    if (changes.rule !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'constraint', value: changes.rule },
      });
    }
    if (changes.message !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'message', value: changes.message },
      });
    }
    if (changes.timing !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'timing', value: changes.timing },
      });
    }
    if (changes.severity !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'severity', value: changes.severity },
      });
    }
    if (changes.code !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'code', value: changes.code },
      });
    }
    if (changes.activeWhen !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'activeWhen', value: changes.activeWhen },
      });
    }

    if (commands.length > 0) {
      this.core.dispatch(commands);
    }

    return {
      summary: `Updated validation '${shapeId}'`,
      action: { helper: 'updateValidation', params: { shapeId, ...changes } },
      affectedPaths: [shapeId],
    };
  }

  // ── Structural Helpers ──

  /**
   * Remove item — full reference cleanup before delete.
   * Collects ALL dependents BEFORE mutations, then dispatches cleanup + delete atomically.
   */
  removeItem(path: string): HelperResult {
    const item = this.core.itemAt(path);
    if (!item) {
      this._throwPathNotFound(path);
    }

    // Step 1: Collect dependent set upfront
    const deps = this.core.fieldDependents(path);

    // Also collect for descendants if item is a group
    const descendantDeps: typeof deps[] = [];
    if (item.children?.length) {
      const collectDescendantPaths = (children: any[], parentPath: string) => {
        for (const child of children) {
          const childPath = `${parentPath}.${child.key}`;
          descendantDeps.push(this.core.fieldDependents(childPath));
          if (child.children?.length) {
            collectDescendantPaths(child.children, childPath);
          }
        }
      };
      collectDescendantPaths(item.children, path);
    }

    // Step 2: Build cleanup commands
    const commands: AnyCommand[] = [];

    const processBindDeps = (depSet: typeof deps) => {
      // Clean up bind properties on OTHER items that reference the deleted path
      // FieldDependents.binds: { path: string; property: string }[]
      for (const bind of depSet.binds) {
        if (bind.path === path) continue; // Skip the deleted item's own binds
        commands.push({
          type: 'definition.setBind',
          payload: { path: bind.path, properties: { [bind.property]: null } },
        });
      }

      // Clean up shapes referencing the deleted path
      // FieldDependents.shapes: { id: string; property: string }[]
      for (const shape of depSet.shapes) {
        commands.push({
          type: 'definition.deleteShape',
          payload: { id: shape.id },
        });
      }

      // Clean up variables referencing the deleted path
      // FieldDependents.variables: string[]
      for (const varName of depSet.variables) {
        commands.push({
          type: 'definition.deleteVariable',
          payload: { name: varName },
        });
      }

      // Clean up mapping rules (delete in descending index order per mapping)
      // FieldDependents.mappingRules: string[] format "mappingId:index"
      if (depSet.mappingRules?.length) {
        // Group by mappingId, then delete in descending index order within each
        const byMapping = new Map<string, number[]>();
        for (const ref of depSet.mappingRules) {
          const colonAt = ref.lastIndexOf(':');
          const mappingId = colonAt >= 0 ? ref.slice(0, colonAt) : 'default';
          const index = colonAt >= 0 ? parseInt(ref.slice(colonAt + 1), 10) : parseInt(ref, 10);
          if (!isNaN(index)) {
            const arr = byMapping.get(mappingId) ?? [];
            arr.push(index);
            byMapping.set(mappingId, arr);
          }
        }
        for (const [mappingId, indices] of byMapping) {
          const sortedIndices = indices.sort((a, b) => b - a);
          for (const idx of sortedIndices) {
            commands.push({
              type: 'mapping.deleteRule',
              payload: { mappingId, index: idx },
            });
          }
        }
      }

      // Clean up screener routes (delete in descending index order)
      if (depSet.screenerRoutes?.length) {
        const sortedIndices = [...depSet.screenerRoutes].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          commands.push({
            type: 'definition.deleteRoute',
            payload: { index: idx },
          });
        }
      }
    };

    processBindDeps(deps);
    for (const dDeps of descendantDeps) {
      processBindDeps(dDeps);
    }

    // Step 3: Add the deleteItem command
    commands.push({
      type: 'definition.deleteItem',
      payload: { path },
    });

    // Dispatch atomically
    this.core.dispatch(commands);

    return {
      summary: `Removed item '${path}'`,
      action: { helper: 'removeItem', params: { path } },
      affectedPaths: [path],
    };
  }

  // ── Update Item ──

  /** Valid keys for updateItem. */
  private static readonly _VALID_UPDATE_KEYS = new Set([
    'label', 'hint', 'description', 'placeholder', 'ariaLabel',
    'options', 'choicesFrom', 'currency', 'precision', 'initialValue', 'prePopulate',
    'dataType', 'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default', 'repeatable', 'minRepeat', 'maxRepeat',
    'widget', 'style', 'page',
    'prefix', 'suffix', 'semanticType',
  ]);

  /** Properties that route to definition.setItemProperty. */
  private static readonly _ITEM_PROPERTY_KEYS = new Set([
    'label', 'hint', 'description',
    'options', 'choicesFrom', 'initialValue', 'prePopulate',
    'repeatable', 'minRepeat', 'maxRepeat',
    'currency', 'precision',
    'prefix', 'suffix', 'semanticType',
  ]);

  /** Properties that route to definition.setBind. */
  private static readonly _BIND_KEYS = new Set([
    'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default',
  ]);

  /** PresentationBlock top-level keys — everything else is a CSS property. */
  private static readonly _PRESENTATION_BLOCK_KEYS = new Set([
    'widget', 'widgetConfig', 'labelPosition', 'style',
    'accessibility', 'fallback', 'cssClass',
  ]);

  /** Update any property of an existing item — fan-out helper. */
  updateItem(path: string, changes: ItemChanges): HelperResult {
    // Pre-validate: path must exist
    if (!this.core.itemAt(path)) {
      this._throwPathNotFound(path);
    }

    // Check for unknown keys
    for (const key of Object.keys(changes)) {
      if (!Project._VALID_UPDATE_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown updateItem key "${key}"`, {
          invalidKey: key,
          validKeys: [...Project._VALID_UPDATE_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    const leafKey = path.split('.').pop()!;
    const warnings: HelperWarning[] = [];

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      // Item property routing
      if (Project._ITEM_PROPERTY_KEYS.has(key)) {
        const property = key === 'choicesFrom' ? 'optionSet' : key;
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property, value },
        });
        continue;
      }

      // Bind property routing
      if (Project._BIND_KEYS.has(key)) {
        let bindValue: unknown;
        if (key === 'required' || key === 'readonly') {
          if (value === true) bindValue = 'true';
          else if (value === false) bindValue = null; // null-deletion
          else bindValue = value; // string FEL passthrough
        } else {
          bindValue = value;
        }
        commands.push({
          type: 'definition.setBind',
          payload: { path, properties: { [key]: bindValue } },
        });
        continue;
      }

      // dataType routing
      if (key === 'dataType') {
        commands.push({
          type: 'definition.setFieldDataType',
          payload: { path, dataType: value },
        });
        continue;
      }

      // widget routing — definition widgetHint + component widget in same batch
      if (key === 'widget') {
        const resolvedWidget = resolveWidget(value as string);
        const hint = widgetHintFor(value as string);

        // definition.setItemProperty for widgetHint (REQUIRED for round-trip)
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property: 'presentation.widgetHint', value: hint ?? null },
        });

        // component.setFieldWidget now returns nodeNotFound instead of throwing
        commands.push({
          type: 'component.setFieldWidget',
          payload: { fieldKey: leafKey, widget: resolvedWidget },
        });
        continue;
      }

      // style routing → theme.setItemStyle (CSS in style sub-object)
      if (key === 'style') {
        const styleProps = value as Record<string, unknown>;
        for (const [prop, val] of Object.entries(styleProps)) {
          commands.push({
            type: 'theme.setItemStyle',
            payload: { itemKey: leafKey, property: prop, value: val },
          });
        }
        continue;
      }

      // placeholder → theme widgetConfig
      if (key === 'placeholder') {
        commands.push({
          type: 'theme.setItemWidgetConfig',
          payload: { itemKey: leafKey, property: 'placeholder', value },
        });
        continue;
      }

      // ariaLabel → theme accessibility
      if (key === 'ariaLabel') {
        commands.push({
          type: 'theme.setItemAccessibility',
          payload: { itemKey: leafKey, property: 'description', value },
        });
        continue;
      }

      // page routing
      if (key === 'page') {
        commands.push({
          type: 'pages.assignItem',
          payload: { pageId: value, key: leafKey },
        });
        continue;
      }
    }

    if (commands.length > 0) {
      const results = this.core.dispatch(commands);
      // Check for nodeNotFound from component.setFieldWidget (non-throwing)
      for (const result of results) {
        if ((result as any).nodeNotFound) {
          warnings.push({
            code: 'COMPONENT_NODE_NOT_FOUND',
            message: `No component node bound to field '${leafKey}'; widgetHint set on definition only`,
          });
        }
      }
    }

    return {
      summary: `Updated item '${path}'`,
      action: { helper: 'updateItem', params: { path, changes } },
      affectedPaths: [path],
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }
  // ── Move / Rename / Reorder ──

  /** Move item to a new parent or position. */
  moveItem(path: string, targetParentPath?: string, targetIndex?: number): HelperResult {
    this.core.dispatch({
      type: 'definition.moveItem',
      payload: { sourcePath: path, targetParentPath, targetIndex },
    });
    // Compute new path
    const leafKey = path.split('.').pop()!;
    const newPath = targetParentPath ? `${targetParentPath}.${leafKey}` : leafKey;
    // Build descriptive summary — when path == newPath it's a reorder, not a cross-parent move
    const parentLabel = targetParentPath ? `'${targetParentPath}'` : 'root';
    const indexLabel = targetIndex !== undefined ? ` at index ${targetIndex}` : '';
    const summary = path === newPath
      ? `Moved '${path}' to ${parentLabel}${indexLabel}`
      : `Moved '${path}' to '${newPath}'${indexLabel}`;
    return {
      summary,
      action: { helper: 'moveItem', params: { path, targetParentPath, targetIndex } },
      affectedPaths: [newPath],
    };
  }

  /** Rename item — FEL reference rewriting handled inside the handler. */
  renameItem(path: string, newKey: string): HelperResult {
    this.core.dispatch({
      type: 'definition.renameItem',
      payload: { path, newKey },
    });
    // Compute new full path
    const segments = path.split('.');
    segments.pop();
    const newPath = segments.length > 0 ? `${segments.join('.')}.${newKey}` : newKey;
    return {
      summary: `Renamed '${path}' to '${newPath}'`,
      action: { helper: 'renameItem', params: { path, newKey } },
      affectedPaths: [newPath],
    };
  }

  /** Reorder item within its parent (swap with neighbor). */
  reorderItem(path: string, direction: 'up' | 'down'): HelperResult {
    this.core.dispatch({
      type: 'definition.reorderItem',
      payload: { path, direction },
    });
    return {
      summary: `Reordered '${path}' ${direction}`,
      action: { helper: 'reorderItem', params: { path, direction } },
      affectedPaths: [path],
    };
  }

  // ── Metadata ──

  /** Valid keys for setMetadata. */
  private static readonly _VALID_METADATA_KEYS = new Set([
    'title', 'name', 'description', 'url', 'version', 'status', 'date',
    'versionAlgorithm', 'nonRelevantBehavior', 'derivedFrom',
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
  ]);

  /** Keys that route to definition.setFormPresentation. */
  private static readonly _PRESENTATION_KEYS = new Set([
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
  ]);

  /** Form-level metadata setter. */
  setMetadata(changes: MetadataChanges): HelperResult {
    // Validate keys
    for (const key of Object.keys(changes)) {
      if (!Project._VALID_METADATA_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown metadata key "${key}"`, {
          invalidKey: key,
          validKeys: [...Project._VALID_METADATA_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      if (key === 'title') {
        commands.push({ type: 'definition.setFormTitle', payload: { title: value } });
      } else if (Project._PRESENTATION_KEYS.has(key)) {
        commands.push({ type: 'definition.setFormPresentation', payload: { property: key, value } });
      } else {
        commands.push({ type: 'definition.setDefinitionProperty', payload: { property: key, value } });
      }
    }

    if (commands.length > 0) {
      this.core.dispatch(commands);
    }

    return {
      summary: `Updated form metadata`,
      action: { helper: 'setMetadata', params: { changes } },
      affectedPaths: [],
    };
  }

  // ── Choices ──

  /** Define a reusable named option set. */
  defineChoices(name: string, options: ChoiceOption[]): HelperResult {
    this.core.dispatch({
      type: 'definition.setOptionSet',
      payload: { name, options },
    });
    return {
      summary: `Defined option set '${name}' with ${options.length} choices`,
      action: { helper: 'defineChoices', params: { name, optionCount: options.length } },
      affectedPaths: [],
    };
  }

  // ── Repeatable ──

  /** Make a group repeatable with optional cardinality constraints. */
  makeRepeatable(target: string, props?: RepeatProps): HelperResult {
    // Pre-validate: target must be a group
    const item = this.core.itemAt(target);
    if (!item) {
      this._throwPathNotFound(target);
    }
    if (item.type !== 'group') {
      throw new HelperError('INVALID_TARGET_TYPE', `makeRepeatable requires a group, got "${item.type}"`, {
        path: target,
        actualType: item.type,
      });
    }

    const leafKey = target.split('.').pop()!;
    const commands: AnyCommand[] = [
      { type: 'definition.setItemProperty', payload: { path: target, property: 'repeatable', value: true } },
    ];

    if (props?.min !== undefined) {
      commands.push({ type: 'definition.setItemProperty', payload: { path: target, property: 'minRepeat', value: props.min } });
    }
    if (props?.max !== undefined) {
      commands.push({ type: 'definition.setItemProperty', payload: { path: target, property: 'maxRepeat', value: props.max } });
    }

    // Component tree: toggle repeat mode
    commands.push({ type: 'component.setGroupRepeatable', payload: { groupKey: leafKey, repeatable: true } });

    // Optional labels on the component node
    if (props?.addLabel) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: leafKey }, property: 'addLabel', value: props.addLabel },
      });
    }
    if (props?.removeLabel) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: leafKey }, property: 'removeLabel', value: props.removeLabel },
      });
    }

    this.core.dispatch(commands);

    return {
      summary: `Made group '${target}' repeatable`,
      action: { helper: 'makeRepeatable', params: { target, ...props } },
      affectedPaths: [],
    };
  }

  // ── Copy Item ──

  /** Copy a field or group. If targetPath is provided, places the clone under that group. */
  copyItem(path: string, deep?: boolean, targetPath?: string): HelperResult {
    const item = this.core.itemAt(path);
    if (!item) {
      this._throwPathNotFound(path);
    }

    // Validate targetPath if provided
    if (targetPath !== undefined) {
      const targetItem = this.core.itemAt(targetPath);
      if (!targetItem) {
        throw new HelperError('PATH_NOT_FOUND', `Target path not found: ${targetPath}`);
      }
    }

    const sourceParent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : undefined;
    const needsMove = targetPath !== undefined && targetPath !== sourceParent;
    const leafKey = path.split('.').pop()!;
    const cloneKey = this._predictCloneKey(path);
    const clonePath = sourceParent ? `${sourceParent}.${cloneKey}` : cloneKey;

    // When moving to a different parent, use original key if no collision in target
    const finalKey = needsMove && !this._hasKeyInGroup(targetPath!, leafKey) ? leafKey : cloneKey;
    const finalPath = needsMove ? `${targetPath}.${finalKey}` : clonePath;

    if (!deep) {
      // Shallow copy — duplicate, then optionally move to target
      const commands: AnyCommand[] = [
        { type: 'definition.duplicateItem', payload: { path } },
      ];

      if (needsMove) {
        commands.push({
          type: 'definition.moveItem',
          payload: { sourcePath: clonePath, targetParentPath: targetPath },
        });
        if (finalKey !== cloneKey) {
          commands.push({
            type: 'definition.renameItem',
            payload: { path: `${targetPath}.${cloneKey}`, newKey: finalKey },
          });
        }
      }

      this.core.dispatch(commands);

      // Collect warnings about omitted binds/shapes
      const warnings: HelperWarning[] = [];
      const binds = this.core.state.definition.binds ?? [];
      const shapes = this.core.state.definition.shapes ?? [];

      const matchingBinds = binds.filter((b: any) =>
        b.path === path || b.path?.startsWith(`${path}.`),
      );
      if (matchingBinds.length > 0) {
        const props = matchingBinds.flatMap((b: any) =>
          Object.keys(b).filter(k => k !== 'path'),
        );
        warnings.push({
          code: 'BINDS_NOT_COPIED',
          message: `${matchingBinds.length} bind(s) not copied`,
          detail: { count: matchingBinds.length, properties: [...new Set(props)] },
        });
      }

      const matchingShapes = shapes.filter((s: any) =>
        s.target === path || s.target?.startsWith(`${path}.`),
      );
      if (matchingShapes.length > 0) {
        warnings.push({
          code: 'SHAPES_NOT_COPIED',
          message: `${matchingShapes.length} shape(s) not copied`,
          detail: { count: matchingShapes.length },
        });
      }

      const dest = needsMove ? ` to '${targetPath}'` : '';
      return {
        summary: `Copied '${path}' (shallow)${dest}`,
        action: { helper: 'copyItem', params: { path, deep: false, ...(targetPath !== undefined ? { targetPath } : {}) } },
        affectedPaths: [finalPath],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Deep copy — duplicate + rewrite FEL references in binds/shapes, then optionally move
    const phase1: AnyCommand[] = [
      { type: 'definition.duplicateItem', payload: { path } },
    ];

    // Collect bind/shape data before dispatch
    const binds = this.core.state.definition.binds ?? [];
    const shapes = this.core.state.definition.shapes ?? [];

    const matchingBinds = binds.filter((b: any) =>
      b.path === path || b.path?.startsWith(`${path}.`),
    );

    const matchingShapes = shapes.filter((s: any) =>
      s.target === path || s.target?.startsWith(`${path}.`),
    );

    this.core.batchWithRebuild(phase1, (() => {
      const phase2: AnyCommand[] = [];

      // Rewrite paths to the final destination (accounts for eventual move+rename)
      const rewritePath = (p: string): string => {
        if (p === path) return finalPath;
        if (p.startsWith(`${path}.`)) return finalPath + p.slice(path.length);
        return p;
      };

      const rewriteFEL = (expr: string | undefined): string | undefined => {
        if (!expr) return expr;
        try {
          return rewriteFELReferences(expr, {
            rewriteFieldPath: (p: string) => {
              if (p === path || p.startsWith(`${path}.`)) {
                return rewritePath(p);
              }
              return p;
            },
          });
        } catch {
          return expr;
        }
      };

      // Copy binds with rewritten paths and FEL
      for (const bind of matchingBinds) {
        const newBindPath = rewritePath(bind.path);
        const rewrittenProps: Record<string, unknown> = {};
        for (const [prop, val] of Object.entries(bind)) {
          if (prop === 'path') continue;
          if (typeof val === 'string') {
            rewrittenProps[prop] = rewriteFEL(val) ?? val;
          } else {
            rewrittenProps[prop] = val;
          }
        }
        if (Object.keys(rewrittenProps).length > 0) {
          phase2.push({
            type: 'definition.setBind',
            payload: { path: newBindPath, properties: rewrittenProps },
          });
        }
      }

      // Copy shapes with rewritten targets and FEL
      for (const shape of matchingShapes) {
        const payload: Record<string, unknown> = {
          target: rewritePath(shape.target),
          constraint: rewriteFEL(shape.constraint) ?? shape.constraint,
          message: shape.message,
        };
        if (shape.timing) payload.timing = shape.timing;
        if (shape.severity) payload.severity = shape.severity;
        if (shape.code) payload.code = shape.code;
        if (shape.activeWhen) payload.activeWhen = rewriteFEL(shape.activeWhen);
        if (shape.context) {
          const rewrittenContext: Record<string, string> = {};
          for (const [key, expr] of Object.entries(shape.context)) {
            const s = typeof expr === 'string' ? expr : undefined;
            rewrittenContext[key] = rewriteFEL(s) ?? s ?? '';
          }
          payload.context = rewrittenContext;
        }
        phase2.push({ type: 'definition.addShape', payload });
      }

      // If relocating, add move + rename commands after FEL rewriting
      if (needsMove) {
        phase2.push({
          type: 'definition.moveItem',
          payload: { sourcePath: clonePath, targetParentPath: targetPath },
        });
        if (finalKey !== cloneKey) {
          phase2.push({
            type: 'definition.renameItem',
            payload: { path: `${targetPath}.${cloneKey}`, newKey: finalKey },
          });
        }
      }

      return phase2;
    })());

    const dest = needsMove ? ` to '${targetPath}'` : '';
    return {
      summary: `Copied '${path}' (deep)${dest}`,
      action: { helper: 'copyItem', params: { path, deep: true, ...(targetPath !== undefined ? { targetPath } : {}) } },
      affectedPaths: [finalPath],
    };
  }

  /** Predict the clone key that duplicateItem will generate. */
  private _predictCloneKey(path: string): string {
    const leafKey = path.split('.').pop()!;
    const parentPath = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : undefined;
    const parentItem = parentPath ? this.core.itemAt(parentPath) : undefined;
    const siblings: any[] = parentPath
      ? (parentItem as any)?.children ?? []
      : this.core.state.definition.items;
    const existingKeys = new Set(siblings.map((s: any) => s.key));

    // Replicate uniqueKey logic from definition-items.ts
    if (!existingKeys.has(leafKey)) return leafKey;
    let suffix = 1;
    while (existingKeys.has(`${leafKey}_${suffix}`)) suffix++;
    return `${leafKey}_${suffix}`;
  }

  /** Check if a group already contains a child with the given key. */
  private _hasKeyInGroup(groupPath: string, key: string): boolean {
    const groupItem = this.core.itemAt(groupPath) as any;
    if (!groupItem?.children) return false;
    return groupItem.children.some((c: any) => c.key === key);
  }

  // ── Wrap Items In Group ──

  /**
   * Wrap existing items in a new group container.
   * When groupPath is provided, uses it as the group key (must not already exist).
   * When omitted, auto-generates a unique key.
   */
  wrapItemsInGroup(paths: string[], groupPathOrLabel?: string, groupLabel?: string): HelperResult {
    // Pre-validation
    for (const p of paths) {
      if (!this.core.itemAt(p)) {
        this._throwPathNotFound(p);
      }
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    // Determine groupKey and label from arguments
    let explicitGroupPath: string | undefined;
    let label: string;
    if (groupLabel !== undefined) {
      // Called as wrapItemsInGroup(paths, groupPath, groupLabel)
      explicitGroupPath = groupPathOrLabel;
      label = groupLabel;
    } else {
      // Called as wrapItemsInGroup(paths, label?)
      label = groupPathOrLabel ?? 'Group';
    }

    // When an explicit group path is given, pre-validate it
    if (explicitGroupPath !== undefined) {
      if (this.core.itemAt(explicitGroupPath)) {
        throw new HelperError('DUPLICATE_KEY', `An item with key "${explicitGroupPath}" already exists`, {
          path: explicitGroupPath,
        });
      }
    }

    const groupKey = explicitGroupPath ?? `group_${Date.now()}`;

    // Find first item's position for the new group
    const firstPath = pruned[0];
    const firstSegments = firstPath.split('.');
    const firstItemKey = firstSegments.pop()!;
    const parentPath = firstSegments.length > 0 ? firstSegments.join('.') : undefined;

    // Find insertIndex of first item
    const parentItems = parentPath
      ? this.core.itemAt(parentPath)?.children ?? []
      : this.core.state.definition.items;
    const insertIndex = parentItems.findIndex((i: any) => i.key === firstItemKey);

    const addPayload: Record<string, unknown> = {
      type: 'group', key: groupKey, label,
    };
    if (parentPath) addPayload.parentPath = parentPath;
    if (insertIndex >= 0) addPayload.insertIndex = insertIndex;

    const resolvedGroupPath = parentPath ? `${parentPath}.${groupKey}` : groupKey;

    const phase2 = pruned.map((p, i) => ({
      type: 'definition.moveItem' as const,
      payload: { sourcePath: p, targetParentPath: resolvedGroupPath, targetIndex: i },
    }));

    this.core.batchWithRebuild(
      [{ type: 'definition.addItem', payload: addPayload }],
      phase2,
    );

    const movedPaths = pruned.map(p => {
      const leaf = p.split('.').pop()!;
      return `${resolvedGroupPath}.${leaf}`;
    });

    return {
      summary: `Wrapped ${pruned.length} item(s) in group '${groupKey}'`,
      action: { helper: 'wrapItemsInGroup', params: { paths: pruned, groupPath: resolvedGroupPath, label } },
      affectedPaths: [resolvedGroupPath, ...movedPaths],
    };
  }

  // ── Wrap In Layout Component ──

  /** Wrap an item node in a layout component. */
  wrapInLayoutComponent(path: string, component: 'Card' | 'Stack' | 'Collapsible'): HelperResult {
    if (!this.core.itemAt(path)) {
      this._throwPathNotFound(path);
    }

    const leafKey = path.split('.').pop()!;
    const result = this.core.dispatch({
      type: 'component.wrapNode',
      payload: { node: { bind: leafKey }, wrapper: { component } },
    });
    const nodeId = (result as any)?.nodeRef?.nodeId;

    return {
      summary: `Wrapped '${path}' in ${component}`,
      action: { helper: 'wrapInLayoutComponent', params: { path, component } },
      affectedPaths: [nodeId ?? path],
      createdId: nodeId,
    };
  }

  // ── Batch Operations ──

  /**
   * Batch delete multiple items atomically. Pre-validates all paths exist,
   * collects cleanup commands for dependent binds/shapes/variables, then
   * dispatches everything in a single atomic operation.
   */
  batchDeleteItems(paths: string[]): HelperResult {
    if (paths.length === 0) {
      return {
        summary: 'No items to delete',
        action: { helper: 'batchDeleteItems', params: { paths } },
        affectedPaths: [],
      };
    }

    // Pre-validate: all paths must exist
    for (const p of paths) {
      if (!this.core.itemAt(p)) {
        this._throwPathNotFound(p);
      }
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );
    // Sort deepest-first so child deletions don't invalidate parent paths
    const sorted = [...pruned].sort((a, b) => b.split('.').length - a.split('.').length);

    this.core.dispatch(
      sorted.map(p => ({ type: 'definition.deleteItem' as const, payload: { path: p } })),
    );

    return {
      summary: `Deleted ${sorted.length} item(s)`,
      action: { helper: 'batchDeleteItems', params: { paths: sorted } },
      affectedPaths: sorted,
    };
  }

  /**
   * Batch duplicate multiple items using copyItem for full bind/shape handling.
   */
  batchDuplicateItems(paths: string[]): HelperResult {
    if (paths.length === 0) {
      return {
        summary: 'No items to duplicate',
        action: { helper: 'batchDuplicateItems', params: { paths } },
        affectedPaths: [],
      };
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    const affectedPaths: string[] = [];
    for (const p of pruned) {
      const result = this.copyItem(p);
      affectedPaths.push(...result.affectedPaths);
    }

    return {
      summary: `Duplicated ${pruned.length} item(s)`,
      action: { helper: 'batchDuplicateItems', params: { paths: pruned } },
      affectedPaths,
    };
  }

  // ── Submit Button ──

  /** Add a submit button. */
  addSubmitButton(label?: string, pageId?: string): HelperResult {
    const addNodeCmd: AnyCommand = {
      type: 'component.addNode',
      payload: {
        parent: { nodeId: 'root' },
        component: 'SubmitButton',
        props: { label: label ?? 'Submit' },
      },
    };

    if (pageId) {
      const addResult = this.core.dispatch(addNodeCmd);
      const nodeId = (addResult as any)?.nodeRef?.nodeId;
      const regionKey = nodeId ?? 'submit';
      this.core.dispatch({
        type: 'pages.assignItem',
        payload: { pageId, key: regionKey },
      });
      return {
        summary: `Added submit button`,
        action: { helper: 'addSubmitButton', params: { label, pageId } },
        affectedPaths: nodeId ? [nodeId] : [],
        createdId: nodeId,
      };
    }

    const result = this.core.dispatch(addNodeCmd);
    const nodeId = (result as any)?.nodeRef?.nodeId;

    return {
      summary: `Added submit button`,
      action: { helper: 'addSubmitButton', params: { label, pageId } },
      affectedPaths: nodeId ? [nodeId] : [],
      createdId: nodeId,
    };
  }

  // ── Page Helpers ──

  /**
   * Add a page. By default creates a paired definition group + theme page + region (the 80% case).
   * With `opts.standalone`, creates only the theme page with no paired group.
   */
  addPage(title: string, description?: string, id?: string, opts?: { standalone?: boolean }): HelperResult {
    // Validate custom ID format
    if (id !== undefined) {
      if (!/^[a-zA-Z][a-zA-Z0-9_\-]*$/.test(id)) {
        throw new HelperError('INVALID_PAGE_ID', `Page ID "${id}" is invalid. Must start with a letter and contain only letters, digits, underscores, or hyphens.`, { id });
      }
      // Check for duplicate page ID
      const existing = (this.core.state.theme.pages ?? []).find((p: any) => p.id === id);
      if (existing) {
        throw new HelperError('DUPLICATE_KEY', `A page with ID "${id}" already exists`, { id });
      }
    }

    // Pre-generate page ID
    const pageId = id ?? `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pagePayload: Record<string, unknown> = { id: pageId, title };
    if (description) pagePayload.description = description;

    if (opts?.standalone) {
      // Standalone: only a theme page, no paired group
      this.core.dispatch({ type: 'pages.addPage', payload: pagePayload } as AnyCommand);

      return {
        summary: `Added page '${title}'`,
        action: { helper: 'addPage', params: { title, description, standalone: true } },
        affectedPaths: [pageId],
        createdId: pageId,
      };
    }

    // Convenience path: group + page + region
    const rawKey = id ?? title;
    const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `page_${Date.now()}`;

    // Deduplicate: if key already exists, append a counter
    let finalKey = key;
    let counter = 2;
    while (this.core.itemAt(finalKey)) {
      finalKey = `${key}_${counter++}`;
    }

    // All three commands in one dispatch = one undo step
    this.core.dispatch([
      { type: 'definition.addItem', payload: { type: 'group', key: finalKey, label: title } },
      { type: 'pages.addPage', payload: pagePayload },
      { type: 'pages.assignItem', payload: { pageId, key: finalKey } },
    ] as AnyCommand[]);

    return {
      summary: `Added page '${title}'`,
      action: { helper: 'addPage', params: { title, description } },
      affectedPaths: [finalKey],
      createdId: pageId,
      groupKey: finalKey,
    };
  }

  /** Remove a page — deletes only the theme page and its regions. Groups and fields remain intact as unassigned items. */
  removePage(pageId: string): HelperResult {
    this.core.dispatch({ type: 'pages.deletePage', payload: { id: pageId } });

    return {
      summary: `Removed page '${pageId}'`,
      action: { helper: 'removePage', params: { pageId } },
      affectedPaths: [pageId],
    };
  }

  /** Reorder a page. */
  reorderPage(pageId: string, direction: 'up' | 'down'): HelperResult {
    this.core.dispatch({ type: 'pages.reorderPages', payload: { id: pageId, direction } });
    return {
      summary: `Reordered page '${pageId}' ${direction}`,
      action: { helper: 'reorderPage', params: { pageId, direction } },
      affectedPaths: [pageId],
    };
  }

  /** Move a page to an arbitrary zero-based index in one atomic undo step. */
  movePageToIndex(pageId: string, targetIndex: number): HelperResult {
    this.core.dispatch({ type: 'pages.movePageToIndex', payload: { id: pageId, targetIndex } });
    return {
      summary: `Moved page '${pageId}' to index ${targetIndex}`,
      action: { helper: 'movePageToIndex', params: { pageId, targetIndex } },
      affectedPaths: [pageId],
    };
  }

  /** List all pages with their id, title, description, and primary group path. */
  listPages(): Array<{ id: string; title: string; description?: string; groupPath?: string }> {
    const pages = (this.core.state.theme.pages ?? []) as Array<{ id: string; title?: string; description?: string; regions?: Array<{ key?: string }> }>;
    return pages.map(p => {
      const groupPath = p.regions?.[0]?.key;
      return {
        id: p.id,
        title: p.title ?? 'Untitled',
        ...(p.description ? { description: p.description } : {}),
        ...(groupPath ? { groupPath } : {}),
      };
    });
  }

  /** Update a page's title or description. */
  updatePage(pageId: string, changes: { title?: string; description?: string }): HelperResult {
    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'pages.setPageProperty',
          payload: { id: pageId, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.core.dispatch(commands);

    return {
      summary: `Updated page '${pageId}'`,
      action: { helper: 'updatePage', params: { pageId, ...changes } },
      affectedPaths: [pageId],
    };
  }

  /** Assign an item to a page. */
  placeOnPage(target: string, pageId: string, options?: PlacementOptions): HelperResult {
    const leafKey = target.split('.').pop()!;
    const payload: Record<string, unknown> = { pageId, key: leafKey };
    if (options?.span) payload.span = options.span;

    this.core.dispatch({ type: 'pages.assignItem', payload });

    return {
      summary: `Placed '${target}' on page '${pageId}'`,
      action: { helper: 'placeOnPage', params: { target, pageId } },
      affectedPaths: [target],
    };
  }

  /** Remove item from page assignment. */
  unplaceFromPage(target: string, pageId: string): HelperResult {
    const leafKey = target.split('.').pop()!;
    this.core.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: leafKey } });

    return {
      summary: `Removed '${target}' from page '${pageId}'`,
      action: { helper: 'unplaceFromPage', params: { target, pageId } },
      affectedPaths: [target],
    };
  }

  /** Set flow mode. */
  setFlow(mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult {
    const commands: AnyCommand[] = [
      { type: 'pages.setMode', payload: { mode } },
    ];

    if (props?.showProgress !== undefined) {
      commands.push({
        type: 'component.setWizardProperty',
        payload: { property: 'showProgress', value: props.showProgress },
      });
    }
    if (props?.allowSkip !== undefined) {
      commands.push({
        type: 'component.setWizardProperty',
        payload: { property: 'allowSkip', value: props.allowSkip },
      });
    }

    this.core.dispatch(commands);

    return {
      summary: `Set flow mode to '${mode}'`,
      action: { helper: 'setFlow', params: { mode, ...props } },
      affectedPaths: [],
    };
  }

  // ── Layout Helpers ──

  /** Layout arrangement → component mapping. */
  private static readonly _LAYOUT_MAP: Record<LayoutArrangement, { component: string; props?: Record<string, unknown> }> = {
    'columns-2': { component: 'Grid', props: { columns: 2 } },
    'columns-3': { component: 'Grid', props: { columns: 3 } },
    'columns-4': { component: 'Grid', props: { columns: 4 } },
    'card': { component: 'Card' },
    'sidebar': { component: 'Panel', props: { position: 'left' } },
    'inline': { component: 'Stack', props: { direction: 'horizontal' } },
  };

  /** Apply spatial layout to targets. */
  applyLayout(targets: string | string[], arrangement: LayoutArrangement): HelperResult {
    const targetArray = Array.isArray(targets) ? targets : [targets];
    const layout = Project._LAYOUT_MAP[arrangement];

    // Create layout container
    const addPayload: Record<string, unknown> = {
      parent: { nodeId: 'root' },
      component: layout.component,
    };
    if (layout.props) addPayload.props = layout.props;

    const commands: AnyCommand[] = [
      { type: 'component.addNode', payload: addPayload },
    ];

    // Move each target into the layout container (deferred — need nodeRef from first command)
    // Since we can't get the nodeRef mid-batch, we dispatch the addNode first, then moveNode
    this.core.dispatch(commands[0]);

    // Now find the created node — it should be the last child of root
    const tree = this.core.state.component?.tree;
    const rootChildren = (tree as any)?.children ?? [];
    const lastChild = rootChildren[rootChildren.length - 1];
    const containerRef = lastChild?.nodeId
      ? { nodeId: lastChild.nodeId }
      : lastChild?.bind
        ? { bind: lastChild.bind }
        : { nodeId: 'root' };

    // Move targets into container
    const moveCommands: AnyCommand[] = targetArray.map((t, i) => ({
      type: 'component.moveNode' as const,
      payload: {
        source: { bind: t.split('.').pop()! },
        targetParent: containerRef,
        targetIndex: i,
      },
    }));

    if (moveCommands.length > 0) {
      this.core.dispatch(moveCommands);
    }

    return {
      summary: `Applied ${arrangement} layout to ${targetArray.length} item(s)`,
      action: { helper: 'applyLayout', params: { targets: targetArray, arrangement } },
      affectedPaths: targetArray,
    };
  }

  /** Apply style overrides to a specific field. */
  applyStyle(path: string, properties: Record<string, unknown>): HelperResult {
    const leafKey = path.split('.').pop()!;
    const warnings: HelperWarning[] = [];
    const commands: AnyCommand[] = [];

    // Check for ambiguous leaf key — multiple items share same key
    const collectLeafPaths = (items: any[], key: string, prefix?: string): string[] => {
      const paths: string[] = [];
      for (const item of items) {
        const itemPath = prefix ? `${prefix}.${item.key}` : item.key;
        if (item.key === key) paths.push(itemPath);
        if (item.children?.length) paths.push(...collectLeafPaths(item.children, key, itemPath));
      }
      return paths;
    };
    const matchingPaths = collectLeafPaths(this.core.state.definition.items, leafKey);
    if (matchingPaths.length > 1) {
      warnings.push({
        code: 'AMBIGUOUS_ITEM_KEY',
        message: `Leaf key '${leafKey}' matches ${matchingPaths.length} items; style override applies to all`,
        detail: { leafKey, conflictingPaths: matchingPaths },
      });
    }

    for (const [prop, val] of Object.entries(properties)) {
      if (Project._PRESENTATION_BLOCK_KEYS.has(prop)) {
        commands.push({
          type: 'theme.setItemOverride',
          payload: { itemKey: leafKey, property: prop, value: val },
        });
      } else {
        commands.push({
          type: 'theme.setItemStyle',
          payload: { itemKey: leafKey, property: prop, value: val },
        });
      }
    }

    if (commands.length > 0) {
      this.core.dispatch(commands);
    }

    return {
      summary: `Applied style to '${path}'`,
      action: { helper: 'applyStyle', params: { path, properties } },
      affectedPaths: [path],
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  /** Apply style to form-level defaults or type selectors. */
  applyStyleAll(
    target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string },
    properties: Record<string, unknown>,
  ): HelperResult {
    const commands: AnyCommand[] = [];

    if (target === 'form') {
      const cssProps: Record<string, unknown> = {};
      for (const [prop, val] of Object.entries(properties)) {
        if (prop === 'density') {
          commands.push({
            type: 'definition.setFormPresentation',
            payload: { property: 'density', value: val },
          });
        } else if (Project._PRESENTATION_BLOCK_KEYS.has(prop)) {
          commands.push({
            type: 'theme.setDefaults',
            payload: { property: prop, value: val },
          });
        } else {
          cssProps[prop] = val;
        }
      }
      // CSS properties nest inside defaults.style as a single merge
      if (Object.keys(cssProps).length > 0) {
        const existing = (this.core.state.theme as any).defaults?.style ?? {};
        commands.push({
          type: 'theme.setDefaults',
          payload: { property: 'style', value: { ...existing, ...cssProps } },
        });
      }
    } else {
      // Selector-based: { type: ... } or { dataType: ... }
      // Build a single { match, apply } selector with proper nesting
      const apply: Record<string, unknown> = {};
      const cssProps: Record<string, unknown> = {};
      for (const [prop, val] of Object.entries(properties)) {
        if (Project._PRESENTATION_BLOCK_KEYS.has(prop)) {
          apply[prop] = val;
        } else {
          cssProps[prop] = val;
        }
      }
      if (Object.keys(cssProps).length > 0) {
        apply.style = cssProps;
      }
      commands.push({
        type: 'theme.addSelector',
        payload: { match: target, apply },
      });
    }

    if (commands.length > 0) {
      this.core.dispatch(commands);
    }

    return {
      summary: `Applied style to ${typeof target === 'string' ? target : JSON.stringify(target)}`,
      action: { helper: 'applyStyleAll', params: { target, properties } },
      affectedPaths: [],
    };
  }

  // ── Theme Token / Default / Breakpoint Helpers ──

  /** Set or delete a single theme token (null = delete). */
  setToken(key: string, value: string | null): HelperResult {
    this.core.dispatch({ type: 'theme.setToken', payload: { key, value } } as AnyCommand);
    return {
      summary: value === null ? `Deleted theme token '${key}'` : `Set theme token '${key}'`,
      action: { helper: 'setToken', params: { key, value } },
      affectedPaths: [],
    };
  }

  /** Set a default theme property (e.g. labelPosition, widget, cssClass). */
  setThemeDefault(property: string, value: unknown): HelperResult {
    this.core.dispatch({ type: 'theme.setDefaults', payload: { property, value } } as AnyCommand);
    return {
      summary: `Set theme default '${property}'`,
      action: { helper: 'setThemeDefault', params: { property, value } },
      affectedPaths: [],
    };
  }

  /** Set or delete a responsive breakpoint (null minWidth = delete). */
  setBreakpoint(name: string, minWidth: number | null): HelperResult {
    this.core.dispatch({ type: 'theme.setBreakpoint', payload: { name, minWidth } } as AnyCommand);
    return {
      summary: minWidth === null ? `Deleted breakpoint '${name}'` : `Set breakpoint '${name}' at ${minWidth}px`,
      action: { helper: 'setBreakpoint', params: { name, minWidth } },
      affectedPaths: [],
    };
  }

  // ── Theme Selector CRUD ──

  /** Add a theme selector rule. */
  addThemeSelector(match: Record<string, unknown>, apply: Record<string, unknown>): HelperResult {
    this.core.dispatch({ type: 'theme.addSelector', payload: { match, apply } } as AnyCommand);
    // Read newly created selector index
    const selectors = (this.core.state.theme as any).selectors ?? [];
    const newIndex = selectors.length - 1;
    return {
      summary: `Added theme selector`,
      action: { helper: 'addThemeSelector', params: { match, apply } },
      affectedPaths: [],
      createdId: String(newIndex),
    };
  }

  /** Update a theme selector rule by index. */
  updateThemeSelector(index: number, changes: { match?: Record<string, unknown>; apply?: Record<string, unknown> }): HelperResult {
    this.core.dispatch({ type: 'theme.setSelector', payload: { index, ...changes } } as AnyCommand);
    return {
      summary: `Updated theme selector ${index}`,
      action: { helper: 'updateThemeSelector', params: { index, changes } },
      affectedPaths: [],
    };
  }

  /** Delete a theme selector rule by index. */
  deleteThemeSelector(index: number): HelperResult {
    this.core.dispatch({ type: 'theme.deleteSelector', payload: { index } } as AnyCommand);
    return {
      summary: `Deleted theme selector ${index}`,
      action: { helper: 'deleteThemeSelector', params: { index } },
      affectedPaths: [],
    };
  }

  /** Reorder a theme selector rule. */
  reorderThemeSelector(index: number, direction: 'up' | 'down'): HelperResult {
    this.core.dispatch({ type: 'theme.reorderSelector', payload: { index, direction } } as AnyCommand);
    return {
      summary: `Reordered theme selector ${index} ${direction}`,
      action: { helper: 'reorderThemeSelector', params: { index, direction } },
      affectedPaths: [],
    };
  }

  // ── Theme Per-Item Override Helpers ──

  /** Set a per-item theme override (e.g. labelPosition for a specific field). */
  setItemOverride(itemKey: string, property: string, value: unknown): HelperResult {
    this.core.dispatch({ type: 'theme.setItemOverride', payload: { itemKey, property, value } } as AnyCommand);
    return {
      summary: `Set theme override '${property}' on item '${itemKey}'`,
      action: { helper: 'setItemOverride', params: { itemKey, property, value } },
      affectedPaths: [itemKey],
    };
  }

  /** Clear all per-item theme overrides for an item. */
  clearItemOverrides(itemKey: string): HelperResult {
    this.core.dispatch({ type: 'theme.deleteItemOverride', payload: { itemKey } } as AnyCommand);
    return {
      summary: `Cleared all theme overrides for item '${itemKey}'`,
      action: { helper: 'clearItemOverrides', params: { itemKey } },
      affectedPaths: [itemKey],
    };
  }

  // ── Region Helpers ──

  /** Add an empty region to a page. */
  addRegion(pageId: string, span?: number): HelperResult {
    // pages.assignItem requires a key — generate a placeholder
    const key = `region_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload: Record<string, unknown> = { pageId, key };
    if (span !== undefined) payload.span = span;
    this.core.dispatch({ type: 'pages.assignItem', payload });
    return {
      summary: `Added region to page '${pageId}'`,
      action: { helper: 'addRegion', params: { pageId, span } },
      affectedPaths: [pageId],
    };
  }

  /** Update a region property by index. */
  updateRegion(pageId: string, regionIndex: number, property: string, value: unknown): HelperResult {
    const key = this._regionKeyAt(pageId, regionIndex);
    this.core.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key, property, value },
    });
    return {
      summary: `Updated region ${regionIndex} on page '${pageId}' property '${property}'`,
      action: { helper: 'updateRegion', params: { pageId, regionIndex, property, value } },
      affectedPaths: [pageId],
    };
  }

  /** Delete a region from a page by index. */
  deleteRegion(pageId: string, regionIndex: number): HelperResult {
    const key = this._regionKeyAt(pageId, regionIndex);
    this.core.dispatch({ type: 'pages.unassignItem', payload: { pageId, key } });
    return {
      summary: `Deleted region ${regionIndex} from page '${pageId}'`,
      action: { helper: 'deleteRegion', params: { pageId, regionIndex } },
      affectedPaths: [pageId],
    };
  }

  /** Reorder a region within a page by index. */
  reorderRegion(pageId: string, regionIndex: number, direction: 'up' | 'down'): HelperResult {
    const key = this._regionKeyAt(pageId, regionIndex);
    const targetIndex = direction === 'up' ? regionIndex - 1 : regionIndex + 1;
    this.core.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key, targetIndex },
    });
    return {
      summary: `Reordered region ${regionIndex} on page '${pageId}' ${direction}`,
      action: { helper: 'reorderRegion', params: { pageId, regionIndex, direction } },
      affectedPaths: [pageId],
    };
  }

  /** Set the field-key assignment for a region by index. */
  setRegionKey(pageId: string, regionIndex: number, newKey: string): HelperResult {
    const pages = (this.core.state.theme as any).pages ?? [];
    const page = pages.find((p: any) => p.id === pageId);
    if (!page) throw new HelperError('PAGE_NOT_FOUND', `Page not found: ${pageId}`);
    const region = page.regions?.[regionIndex];
    if (!region) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
    const oldKey = region.key as string;
    const oldSpan = region.span as number | undefined;

    // assignItem appends to the end — follow with reorderRegion to restore position
    const commands: AnyCommand[] = [
      { type: 'pages.unassignItem', payload: { pageId, key: oldKey } },
      { type: 'pages.assignItem', payload: { pageId, key: newKey, span: oldSpan } },
      { type: 'pages.reorderRegion', payload: { pageId, key: newKey, targetIndex: regionIndex } },
    ];
    this.core.dispatch(commands);
    return {
      summary: `Set region ${regionIndex} on page '${pageId}' to key '${newKey}'`,
      action: { helper: 'setRegionKey', params: { pageId, regionIndex, key: newKey } },
      affectedPaths: [pageId],
    };
  }

  /** Rename a page's ID. */
  renamePage(pageId: string, newId: string): HelperResult {
    this.core.dispatch({ type: 'pages.renamePage', payload: { id: pageId, newId } });
    return {
      summary: `Renamed page '${pageId}' to '${newId}'`,
      action: { helper: 'renamePage', params: { pageId, newId } },
      affectedPaths: [newId],
    };
  }

  /** Look up a region's key by its index on a page. */
  private _regionKeyAt(pageId: string, regionIndex: number): string {
    const pages = (this.core.state.theme as any).pages ?? [];
    const page = pages.find((p: any) => p.id === pageId);
    if (!page) throw new HelperError('PAGE_NOT_FOUND', `Page not found: ${pageId}`);
    const region = page.regions?.[regionIndex];
    if (!region) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
    return region.key;
  }

  /** Find a region's index by item key on a page. Throws if page or item not found. */
  private _regionIndexOf(pageId: string, itemKey: string): number {
    const pages = (this.core.state.theme as any).pages ?? [];
    const page = pages.find((p: any) => p.id === pageId);
    if (!page) throw new HelperError('PAGE_NOT_FOUND', `Page not found: ${pageId}`);
    const regions = page.regions ?? [];
    const index = regions.findIndex((r: any) => r.key === itemKey);
    if (index === -1) throw new HelperError('ITEM_NOT_ON_PAGE', `Item '${itemKey}' is not on page '${pageId}'`, { pageId, itemKey });
    return index;
  }

  // ── Behavioral Page Methods ──

  /** Set the width (grid span) of an item on a page. */
  setItemWidth(pageId: string, itemKey: string, width: number): HelperResult {
    this._regionIndexOf(pageId, itemKey); // validates existence
    this.core.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: itemKey, property: 'span', value: width },
    });
    return {
      summary: `Set width of '${itemKey}' on page '${pageId}' to ${width}`,
      action: { helper: 'setItemWidth', params: { pageId, itemKey, width } },
      affectedPaths: [pageId],
    };
  }

  /** Set the offset (grid start) of an item on a page. */
  setItemOffset(pageId: string, itemKey: string, offset: number | undefined): HelperResult {
    this._regionIndexOf(pageId, itemKey);
    this.core.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: itemKey, property: 'start', value: offset },
    });
    return {
      summary: `Set offset of '${itemKey}' on page '${pageId}' to ${offset ?? 'auto'}`,
      action: { helper: 'setItemOffset', params: { pageId, itemKey, offset } },
      affectedPaths: [pageId],
    };
  }

  /** Set responsive breakpoint overrides for an item on a page. */
  setItemResponsive(
    pageId: string,
    itemKey: string,
    breakpoint: string,
    overrides: { width?: number; offset?: number; hidden?: boolean } | undefined,
  ): HelperResult {
    const regionIndex = this._regionIndexOf(pageId, itemKey);
    const pages = (this.core.state.theme as any).pages ?? [];
    const page = pages.find((p: any) => p.id === pageId);
    const region = page.regions[regionIndex];

    // Clone existing responsive map or start fresh
    const responsive = { ...(region.responsive ?? {}) };

    if (overrides === undefined) {
      delete responsive[breakpoint];
    } else {
      // Translate behavioral vocabulary → schema vocabulary
      const entry: Record<string, unknown> = {};
      if (overrides.width !== undefined) entry.span = overrides.width;
      if (overrides.offset !== undefined) entry.start = overrides.offset;
      if (overrides.hidden !== undefined) entry.hidden = overrides.hidden;
      responsive[breakpoint] = entry;
    }

    this.core.dispatch({
      type: 'pages.setRegionProperty',
      payload: { pageId, key: itemKey, property: 'responsive', value: responsive },
    });
    return {
      summary: `Set responsive '${breakpoint}' for '${itemKey}' on page '${pageId}'`,
      action: { helper: 'setItemResponsive', params: { pageId, itemKey, breakpoint, overrides } },
      affectedPaths: [pageId],
    };
  }

  /** Remove an item from a page. */
  removeItemFromPage(pageId: string, itemKey: string): HelperResult {
    this._regionIndexOf(pageId, itemKey);
    this.core.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: itemKey } });
    return {
      summary: `Removed '${itemKey}' from page '${pageId}'`,
      action: { helper: 'removeItemFromPage', params: { pageId, itemKey } },
      affectedPaths: [pageId],
    };
  }

  /**
   * Move an item from one page to another as a single atomic undo step.
   * Batches the unassign + assign into one history entry so undo/redo is coherent.
   */
  moveItemToPage(sourcePageId: string, itemKey: string, targetPageId: string, opts?: PlacementOptions): HelperResult {
    this._regionIndexOf(sourcePageId, itemKey);
    const leafKey = itemKey.split('.').pop()!;
    const assignPayload: Record<string, unknown> = { pageId: targetPageId, key: leafKey };
    if (opts?.span) assignPayload.span = opts.span;
    this.core.batch([
      { type: 'pages.unassignItem', payload: { pageId: sourcePageId, key: leafKey } },
      { type: 'pages.assignItem', payload: assignPayload },
    ] as AnyCommand[]);
    return {
      summary: `Moved '${itemKey}' from page '${sourcePageId}' to page '${targetPageId}'`,
      action: { helper: 'moveItemToPage', params: { sourcePageId, itemKey, targetPageId } },
      affectedPaths: [sourcePageId, targetPageId],
    };
  }

  /** Reorder an item within a page (by key, not index). */
  reorderItemOnPage(pageId: string, itemKey: string, direction: 'up' | 'down'): HelperResult {
    const currentIndex = this._regionIndexOf(pageId, itemKey);
    const targetIndex = Math.max(0, direction === 'up' ? currentIndex - 1 : currentIndex + 1);
    this.core.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: itemKey, targetIndex },
    });
    return {
      summary: `Reordered '${itemKey}' ${direction} on page '${pageId}'`,
      action: { helper: 'reorderItemOnPage', params: { pageId, itemKey, direction } },
      affectedPaths: [pageId],
    };
  }

  /** Move an item to an arbitrary position on a page by target index. */
  moveItemOnPageToIndex(pageId: string, itemKey: string, targetIndex: number): HelperResult {
    if (targetIndex < 0) {
      throw new HelperError('ROUTE_OUT_OF_BOUNDS', `targetIndex must be non-negative, got ${targetIndex}`);
    }
    this._regionIndexOf(pageId, itemKey); // validates page and item existence
    this.core.dispatch({
      type: 'pages.reorderRegion',
      payload: { pageId, key: itemKey, targetIndex },
    });
    return {
      summary: `Moved '${itemKey}' to index ${targetIndex} on page '${pageId}'`,
      action: { helper: 'moveItemOnPageToIndex', params: { pageId, itemKey, targetIndex } },
      affectedPaths: [pageId],
    };
  }

  // ── Component Tree Helpers ──

  /** Add a layout-only node to the component tree. */
  addLayoutNode(parentNodeId: string, component: string): HelperResult {
    const result = this.core.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: parentNodeId }, component },
    } as AnyCommand);
    const nodeId = (result as any)?.nodeRef?.nodeId;
    return {
      summary: `Added layout node '${component}' under '${parentNodeId}'`,
      action: { helper: 'addLayoutNode', params: { parentNodeId, component } },
      affectedPaths: nodeId ? [nodeId] : [],
      createdId: nodeId,
    };
  }

  /** Unwrap a layout container, promoting its children. */
  unwrapLayoutNode(nodeId: string): HelperResult {
    this.core.dispatch({
      type: 'component.unwrapNode',
      payload: { node: { nodeId } },
    } as AnyCommand);
    return {
      summary: `Unwrapped layout node '${nodeId}'`,
      action: { helper: 'unwrapLayoutNode', params: { nodeId } },
      affectedPaths: [nodeId],
    };
  }

  /** Delete a layout node from the component tree. */
  deleteLayoutNode(nodeId: string): HelperResult {
    this.core.dispatch({
      type: 'component.deleteNode',
      payload: { node: { nodeId } },
    } as AnyCommand);
    return {
      summary: `Deleted layout node '${nodeId}'`,
      action: { helper: 'deleteLayoutNode', params: { nodeId } },
      affectedPaths: [nodeId],
    };
  }

  // ── Option Set Helpers ──

  /** Update a property on an option set. */
  updateOptionSet(name: string, property: string, value: unknown): HelperResult {
    this.core.dispatch({
      type: 'definition.setOptionSetProperty',
      payload: { name, property, value },
    } as AnyCommand);
    return {
      summary: `Updated option set '${name}' property '${property}'`,
      action: { helper: 'updateOptionSet', params: { name, property, value } },
      affectedPaths: [],
    };
  }

  /** Delete an option set by name. */
  deleteOptionSet(name: string): HelperResult {
    this.core.dispatch({
      type: 'definition.deleteOptionSet',
      payload: { name },
    } as AnyCommand);
    return {
      summary: `Deleted option set '${name}'`,
      action: { helper: 'deleteOptionSet', params: { name } },
      affectedPaths: [],
    };
  }

  // ── Mapping Helpers ──

  /** Set a mapping document root property (e.g. version, direction, autoMap). */
  setMappingProperty(property: string, value: unknown, mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.setProperty',
      payload: { property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Set mapping property '${property}'`,
      action: { helper: 'setMappingProperty', params: { property, value, mappingId } },
      affectedPaths: [],
    };
  }

  /** Set a property on the mapping's target structure descriptor. */
  setMappingTargetSchema(property: string, value: unknown, mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.setTargetSchema',
      payload: { property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Set mapping target schema '${property}'`,
      action: { helper: 'setMappingTargetSchema', params: { property, value, mappingId } },
      affectedPaths: [],
    };
  }

  /** Add a mapping rule with optional transform parameters. */
  addMappingRule(params: {
    sourcePath?: string;
    targetPath?: string;
    transform?: string;
    insertIndex?: number;
    mappingId?: string;
  }): HelperResult {
    this.core.dispatch({
      type: 'mapping.addRule',
      payload: params,
    } as AnyCommand);
    return {
      summary: `Added mapping rule ${params.sourcePath ?? ''} → ${params.targetPath ?? ''}`,
      action: { helper: 'addMappingRule', params },
      affectedPaths: params.sourcePath ? [params.sourcePath] : [],
    };
  }

  /** Update a property of an existing mapping rule. */
  updateMappingRule(index: number, property: string, value: unknown, mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.setRule',
      payload: { index, property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Updated mapping rule ${index} property '${property}'`,
      action: { helper: 'updateMappingRule', params: { index, property, value, mappingId } },
      affectedPaths: [],
    };
  }

  /** Remove a mapping rule by index. */
  removeMappingRule(index: number, mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.deleteRule',
      payload: { index, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Removed mapping rule ${index}`,
      action: { helper: 'removeMappingRule', params: { index, mappingId } },
      affectedPaths: [],
    };
  }

  /** Clear all mapping rules. */
  clearMappingRules(mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.clearRules',
      payload: { ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: 'Cleared all mapping rules',
      action: { helper: 'clearMappingRules', params: { mappingId } },
      affectedPaths: [],
    };
  }

  /** Reorder a mapping rule. */
  reorderMappingRule(index: number, direction: 'up' | 'down', mappingId?: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.reorderRule',
      payload: { index, direction, ...(mappingId !== undefined ? { mappingId } : {}) },
    } as AnyCommand);
    return {
      summary: `Reordered mapping rule ${index} ${direction}`,
      action: { helper: 'reorderMappingRule', params: { index, direction, mappingId } },
      affectedPaths: [],
    };
  }

  /** Set configuration for a specific wire-format adapter (JSON, XML, CSV). */
  setMappingAdapter(format: string, config: unknown): HelperResult {
    this.core.dispatch({
      type: 'mapping.setAdapter',
      payload: { format, config },
    } as AnyCommand);
    return {
      summary: `Configured '${format}' adapter`,
      action: { helper: 'setMappingAdapter', params: { format, config } },
      affectedPaths: [],
    };
  }

  /** Update the top-level mapping defaults. */
  updateMappingDefaults(defaults: Record<string, unknown>): HelperResult {
    this.core.dispatch({
      type: 'mapping.setDefaults',
      payload: { defaults },
    } as AnyCommand);
    return {
      summary: 'Updated mapping defaults',
      action: { helper: 'updateMappingDefaults', params: { defaults } },
      affectedPaths: [],
    };
  }

  /** Auto-generate mapping rules for every field in the form. */
  autoGenerateMappingRules(params: {
    scopePath?: string;
    priority?: number;
    replace?: boolean;
  } = {}): HelperResult {
    this.core.dispatch({
      type: 'mapping.autoGenerateRules',
      payload: params,
    } as AnyCommand);
    return {
      summary: 'Auto-generated mapping rules',
      action: { helper: 'autoGenerateMappingRules', params },
      affectedPaths: [],
    };
  }

  /** Run a mapping preview and return the projected output. */
  previewMapping(params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult {
    return this.core.previewMapping(params);
  }

  /** Create a new named mapping document and select it. */
  createMapping(id: string, options: { targetSchema?: Record<string, unknown> } = {}): HelperResult {
    this.core.dispatch({
      type: 'mapping.create',
      payload: { id, ...options },
    } as AnyCommand);
    return {
      summary: `Created mapping '${id}'`,
      action: { helper: 'createMapping', params: { id, options } },
      affectedPaths: [],
      createdId: id,
    };
  }

  /** Delete a named mapping document. Throws if it is the last mapping. */
  deleteMapping(id: string): HelperResult {
    const ids = Object.keys(this.core.mappings);
    if (ids.length <= 1) {
      throw new HelperError('MAPPING_MIN_COUNT', 'Cannot delete the last mapping document', { id });
    }
    if (!this.core.mappings[id]) {
      throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${id}' does not exist`, { id });
    }
    this.core.dispatch({
      type: 'mapping.delete',
      payload: { id },
    } as AnyCommand);
    return {
      summary: `Deleted mapping '${id}'`,
      action: { helper: 'deleteMapping', params: { id } },
      affectedPaths: [],
    };
  }

  /** Rename a mapping document. Throws if the new ID already exists. */
  renameMapping(oldId: string, newId: string): HelperResult {
    if (!this.core.mappings[oldId]) {
      throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${oldId}' does not exist`, { oldId });
    }
    if (this.core.mappings[newId]) {
      throw new HelperError('MAPPING_DUPLICATE_ID', `Mapping '${newId}' already exists`, { newId });
    }
    this.core.dispatch({
      type: 'mapping.rename',
      payload: { oldId, newId },
    } as AnyCommand);
    return {
      summary: `Renamed mapping '${oldId}' to '${newId}'`,
      action: { helper: 'renameMapping', params: { oldId, newId } },
      affectedPaths: [],
    };
  }

  /** Select the active mapping document by ID. */
  selectMapping(id: string): HelperResult {
    this.core.dispatch({
      type: 'mapping.select',
      payload: { id },
    } as AnyCommand);
    return {
      summary: `Selected mapping '${id}'`,
      action: { helper: 'selectMapping', params: { id } },
      affectedPaths: [],
    };
  }

  // ── Page Auto-generate Helper ──

  /** Auto-generate pages from definition groups. */
  autoGeneratePages(): HelperResult {
    this.core.dispatch({ type: 'pages.autoGenerate', payload: {} } as AnyCommand);
    return {
      summary: `Auto-generated pages from definition groups`,
      action: { helper: 'autoGeneratePages', params: {} },
      affectedPaths: [],
    };
  }

  // ── Variable Helpers ──

  /** Add a named FEL variable. */
  addVariable(name: string, expression: string, scope?: string): HelperResult {
    this._validateFEL(expression);
    this._checkVariableSelfReference(name, expression);
    const payload: Record<string, unknown> = { name, expression };
    if (scope) payload.scope = scope;

    this.core.dispatch({ type: 'definition.addVariable', payload });

    return {
      summary: `Added variable '${name}'`,
      action: { helper: 'addVariable', params: { name, expression, scope } },
      affectedPaths: [],
    };
  }

  /** Update a variable's expression. */
  updateVariable(name: string, expression: string): HelperResult {
    if (!this.core.variableNames().includes(name)) {
      throw new HelperError('VARIABLE_NOT_FOUND', `Variable "${name}" does not exist`, {
        name,
        validVariables: this.core.variableNames(),
      });
    }
    this._validateFEL(expression);
    this._checkVariableSelfReference(name, expression);
    this.core.dispatch({
      type: 'definition.setVariable',
      payload: { name, property: 'expression', value: expression },
    });

    return {
      summary: `Updated variable '${name}'`,
      action: { helper: 'updateVariable', params: { name, expression } },
      affectedPaths: [],
    };
  }

  /** Remove a variable — warns about dangling references. */
  removeVariable(name: string): HelperResult {
    if (!this.core.variableNames().includes(name)) {
      throw new HelperError('VARIABLE_NOT_FOUND', `Variable "${name}" does not exist`, {
        name,
        validVariables: this.core.variableNames(),
      });
    }
    // Scan for dangling references before deletion
    const warnings: HelperWarning[] = [];
    const allExprs = this.core.allExpressions();
    const varRef = `$${name}`;
    const danglingPaths: string[] = [];

    for (const exprLoc of allExprs) {
      if (typeof exprLoc.expression === 'string' && exprLoc.expression.includes(varRef)) {
        danglingPaths.push(exprLoc.location ?? 'unknown');
      }
    }

    if (danglingPaths.length > 0) {
      warnings.push({
        code: 'DANGLING_REFERENCES',
        message: `${danglingPaths.length} expression(s) still reference $${name}`,
        detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
      });
    }

    this.core.dispatch({ type: 'definition.deleteVariable', payload: { name } });

    return {
      summary: `Removed variable '${name}'`,
      action: { helper: 'removeVariable', params: { name } },
      affectedPaths: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /** Rename a variable — Future Work, handler not implemented. */
  renameVariable(name: string, newName: string): HelperResult {
    throw new HelperError(
      'NOT_IMPLEMENTED',
      `renameVariable is not yet implemented (definition.renameVariable handler does not exist)`,
      { name, newName },
    );
  }

  // ── Instance Helpers ──

  /** Add a named external data source. */
  addInstance(name: string, props: InstanceProps): HelperResult {
    this.core.dispatch({
      type: 'definition.addInstance',
      payload: { name, ...props },
    });

    return {
      summary: `Added instance '${name}'`,
      action: { helper: 'addInstance', params: { name, ...props } },
      affectedPaths: [],
    };
  }

  private _validateInstanceExists(name: string): void {
    if (!this.core.instanceNames().includes(name)) {
      throw new HelperError('INSTANCE_NOT_FOUND', `Instance "${name}" does not exist`, {
        name,
        validInstances: this.core.instanceNames(),
      });
    }
  }

  /** Update instance properties. */
  updateInstance(name: string, changes: Partial<InstanceProps>): HelperResult {
    this._validateInstanceExists(name);
    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'definition.setInstance',
          payload: { name, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.core.dispatch(commands);

    return {
      summary: `Updated instance '${name}'`,
      action: { helper: 'updateInstance', params: { name, changes } },
      affectedPaths: [],
    };
  }

  /** Rename an instance — rewrites FEL references. */
  renameInstance(name: string, newName: string): HelperResult {
    this._validateInstanceExists(name);
    this.core.dispatch({
      type: 'definition.renameInstance',
      payload: { name, newName },
    });

    return {
      summary: `Renamed instance '${name}' to '${newName}'`,
      action: { helper: 'renameInstance', params: { name, newName } },
      affectedPaths: [],
    };
  }

  /** Remove an instance. */
  removeInstance(name: string): HelperResult {
    this._validateInstanceExists(name);
    // Scan for dangling references
    const warnings: HelperWarning[] = [];
    const allExprs = this.core.allExpressions();
    const ref = `@instance('${name}')`;
    const danglingPaths: string[] = [];

    for (const exprLoc of allExprs) {
      if (typeof exprLoc.expression === 'string' && exprLoc.expression.includes(ref)) {
        danglingPaths.push(exprLoc.location ?? 'unknown');
      }
    }

    if (danglingPaths.length > 0) {
      warnings.push({
        code: 'DANGLING_REFERENCES',
        message: `${danglingPaths.length} expression(s) still reference @instance('${name}')`,
        detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
      });
    }

    this.core.dispatch({ type: 'definition.deleteInstance', payload: { name } });

    return {
      summary: `Removed instance '${name}'`,
      action: { helper: 'removeInstance', params: { name } },
      affectedPaths: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Screener Helpers ──

  /** Enable/disable screener. */
  setScreener(enabled: boolean): HelperResult {
    this.core.dispatch({ type: 'definition.setScreener', payload: { enabled } });

    return {
      summary: `Screener ${enabled ? 'enabled' : 'disabled'}`,
      action: { helper: 'setScreener', params: { enabled } },
      affectedPaths: [],
    };
  }

  /** Add a screener question. */
  addScreenField(key: string, label: string, type: string, props?: FieldProps): HelperResult {
    const resolved = resolveFieldType(type);
    this.core.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key, label, dataType: resolved.dataType },
    });

    return {
      summary: `Added screener field '${key}'`,
      action: { helper: 'addScreenField', params: { key, label, type } },
      affectedPaths: [key],
    };
  }

  /** Remove a screener question. */
  removeScreenField(key: string): HelperResult {
    this.core.dispatch({ type: 'definition.deleteScreenerItem', payload: { key } });

    return {
      summary: `Removed screener field '${key}'`,
      action: { helper: 'removeScreenField', params: { key } },
      affectedPaths: [key],
    };
  }

  /** Add a screener routing rule. */
  addScreenRoute(condition: string, target: string, label?: string, message?: string): HelperResult {
    this._validateFEL(condition);
    const payload: Record<string, unknown> = { condition, target };
    if (label) payload.label = label;
    if (message) payload.message = message;

    this.core.dispatch({ type: 'definition.addRoute', payload });

    return {
      summary: `Added screen route to '${target}'`,
      action: { helper: 'addScreenRoute', params: { condition, target, label, message } },
      affectedPaths: [],
    };
  }

  private _validateRouteIndex(routeIndex: number): void {
    const routes = (this.core.state.definition as any).screener?.routes ?? [];
    if (routeIndex < 0 || routeIndex >= routes.length) {
      throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Route index ${routeIndex} is out of bounds`, {
        routeIndex,
        routeCount: routes.length,
      });
    }
  }

  /** Update a screener route. */
  updateScreenRoute(
    routeIndex: number,
    changes: { condition?: string; target?: string; label?: string; message?: string },
  ): HelperResult {
    this._validateRouteIndex(routeIndex);
    if (changes.condition) this._validateFEL(changes.condition);

    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'definition.setRouteProperty',
          payload: { index: routeIndex, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.core.dispatch(commands);

    return {
      summary: `Updated screen route ${routeIndex}`,
      action: { helper: 'updateScreenRoute', params: { routeIndex, ...changes } },
      affectedPaths: [],
    };
  }

  /** Reorder a screener route. */
  reorderScreenRoute(routeIndex: number, direction: 'up' | 'down'): HelperResult {
    this._validateRouteIndex(routeIndex);
    this.core.dispatch({
      type: 'definition.reorderRoute',
      payload: { index: routeIndex, direction },
    });

    return {
      summary: `Reordered screen route ${routeIndex} ${direction}`,
      action: { helper: 'reorderScreenRoute', params: { routeIndex, direction } },
      affectedPaths: [],
    };
  }

  /** Remove a screener route. */
  removeScreenRoute(routeIndex: number): HelperResult {
    this._validateRouteIndex(routeIndex);
    const routes = (this.core.state.definition as any).screener?.routes ?? [];
    if (routes.length <= 1) {
      throw new HelperError('ROUTE_MIN_COUNT', 'Cannot delete the last remaining screener route', {
        currentRouteCount: routes.length,
        routes,
      });
    }
    this.core.dispatch({ type: 'definition.deleteRoute', payload: { index: routeIndex } });

    return {
      summary: `Removed screen route ${routeIndex}`,
      action: { helper: 'removeScreenRoute', params: { routeIndex } },
      affectedPaths: [],
    };
  }

  // ── Preview / Query Methods ──

  /** Default sample values by data type. */
  private static readonly _SAMPLE_VALUES: Record<string, unknown> = {
    string: 'Sample text',
    text: 'Sample paragraph text',
    integer: 42,
    decimal: 3.14,
    boolean: true,
    date: '2024-01-15',
    time: '09:00:00',
    dateTime: '2024-01-15T09:00:00Z',
    uri: 'https://example.com',
    attachment: 'sample-file.pdf',
    money: { amount: 100, currency: 'USD' },
    multiChoice: ['option1'],
  };

  /**
   * Generate plausible sample data for each field based on its data type.
   */
  generateSampleData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const items = this.core.state.definition.items ?? [];

    const walkItems = (itemList: any[], prefix: string) => {
      for (const item of itemList) {
        const path = prefix ? `${prefix}.${item.key}` : item.key;
        if (item.type === 'group') {
          // Recurse into children
          if (item.children?.length) {
            walkItems(item.children, path);
          }
          continue;
        }
        if (item.type !== 'field') continue;

        const dt = item.dataType as string;
        if (dt === 'choice' || dt === 'multiChoice') {
          // Use first option if available
          const options = item.options as Array<{ value: string }> | undefined;
          if (options?.length) {
            data[path] = dt === 'multiChoice' ? [options[0].value] : options[0].value;
          } else {
            data[path] = dt === 'multiChoice' ? ['option1'] : 'option1';
          }
        } else {
          data[path] = Project._SAMPLE_VALUES[dt] ?? 'Sample text';
        }
      }
    };

    walkItems(items as any[], '');
    return data;
  }

  /**
   * Return a cleaned-up deep clone of the definition.
   * Strips null values, empty arrays, and undefined keys.
   */
  normalizeDefinition(): Record<string, unknown> {
    const def = this.core.state.definition;
    const clone = JSON.parse(JSON.stringify(def));
    return Project._pruneObject(clone) as Record<string, unknown>;
  }

  /** Recursively prune null values, empty arrays, and empty objects from a value. */
  private static _pruneObject(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
      if (value.length === 0) return undefined;
      const pruned = value.map(v => Project._pruneObject(v)).filter(v => v !== undefined);
      return pruned.length === 0 ? undefined : pruned;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      let hasKeys = false;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const pruned = Project._pruneObject(v);
        if (pruned !== undefined) {
          result[k] = pruned;
          hasKeys = true;
        }
      }
      return hasKeys ? result : undefined;
    }
    return value;
  }
}

export function createProject(options?: CreateProjectOptions): Project {
  // Set up changeset recording middleware if requested
  let recorderControl: ChangesetRecorderControl | undefined;
  const coreMiddleware: import('formspec-core').Middleware[] = [];

  if (options?.enableChangesets !== false) {
    // Default: enable changeset support
    recorderControl = {
      recording: false,
      currentActor: 'user',
      onCommandsRecorded: () => {}, // Will be overridden by ProposalManager constructor
    };
    coreMiddleware.push(createChangesetMiddleware(recorderControl));
  }

  const coreOptions: any = { ...options };
  if (coreMiddleware.length > 0) {
    coreOptions.middleware = coreMiddleware;
  }

  // Bridge studio-core options → core options at the package boundary
  return new Project(createRawProject(coreOptions), recorderControl);
}

// ── humanizeFEL (string-level FEL→English transform) ──────────────

const OP_MAP: Record<string, string> = {
  '=': 'is',
  '!=': 'is not',
  '>': 'is greater than',
  '>=': 'is at least',
  '<': 'is less than',
  '<=': 'is at most',
};

function humanizeRef(ref: string): string {
  const name = ref.replace(/^\$/, '');
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function humanizeValue(val: string): string {
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  return val;
}

/**
 * Attempt to convert a FEL expression to a human-readable string.
 * Only handles simple `$ref op value` patterns. Returns the raw expression
 * for anything more complex.
 */
function humanizeFEL(expression: string): string {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(\$\w+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) return trimmed;
  const [, ref, op, value] = match;
  const humanOp = OP_MAP[op];
  if (!humanOp) return trimmed;
  return `${humanizeRef(ref)} ${humanOp} ${humanizeValue(value.trim())}`;
}
