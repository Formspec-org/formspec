# @formspec/studio-core — API Reference

*Auto-generated from TypeScript declarations — do not hand-edit.*

Pure TypeScript library for creating and editing Formspec artifact bundles. Every edit is a serializable Command dispatched against a Project. No framework dependencies, no singletons, no side effects.

formspec-studio-core

Document-agnostic semantic authoring API for Formspec.
Project composes IProjectCore (from formspec-core) and exposes
51 behavior-driven helper methods for form authoring.

Consumers import types from THIS package — never from formspec-core.

## `bindsFor(binds: FormBind[] | undefined | null, path: string): Record<string, string>`

## `flatItems(items: FormItem[], prefix?: string, depth?: number): FlatItem[]`

## `shapesFor(shapes: Shape[] | undefined | null, path: string): Shape[]`

## `normalizeBindEntries(binds: unknown): NormalizedBindEntry[]`

## `normalizeBindsView(binds: unknown, items?: FormItem[]): Record<string, Record<string, unknown>>`

## `computeUnassignedItems(items: FormItem[], treeChildren: CompNode[]): UnassignedItem[]`

## `dataTypeInfo(dataType: string): DataTypeDisplay`

## `countDefinitionFields(items: FormItem[]): number`

## `sanitizeIdentifier(raw: string): string`

## `compatibleWidgets(type: string, dataType?: string): string[]`

## `getFieldTypeCatalog(): FieldTypeCatalogEntry[]`

## `widgetHintForComponent(component: string, dataType?: string): string`

## `componentForWidgetHint(widgetHint?: string | null): string | null`

## `buildDefLookup(items: FormItem[], prefix?: string, parentPath?: string | null): Map<string, DefLookupEntry>`

## `buildBindKeyMap(defLookup: Map<string, DefLookupEntry>): Map<string, string>`

## `pruneDescendants(paths: Set<string>): string[]`

## `sortForBatchDelete(paths: string[]): string[]`

## `isLayoutId(id: string): boolean`

## `nodeIdFromLayoutId(id: string): string`

## `nodeRefFor(entry: Pick<FlatEntry, 'bind' | 'nodeId'>): {
    bind: string;
} | {
    nodeId: string;
}`

## `flattenComponentTree(root: CompNode, defLookup: Map<string, DefLookupEntry>, bindKeyMap?: Map<string, string>): FlatEntry[]`

## `findComponentNodeById(node: Record<string, unknown> | undefined, nodeId: string): Record<string, unknown> | null`

## `buildBatchMoveCommands(paths: Set<string>, targetGroupPath: string): MoveCommand[]`

## `humanizeFEL(expression: string): string`

## `propertyHelp: Record<string, string>`

#### interface `DataTypeDisplay`

- **icon**: `string`
- **label**: `string`
- **color**: `string`

#### interface `FieldTypeCatalogEntry`

- **label**: `string`
- **description**: `string`
- **icon**: `string`
- **color**: `string`
- **itemType**: `'field' | 'group' | 'display' | 'layout'`
- **component?**: `string`
- **dataType?**: `string`
- **extra?**: `Record<string, unknown>`
- **category**: `string`
- **keywords?**: `string[]`

#### interface `FlatItem`

- **path**: `string`
- **item**: `FormItem`
- **depth**: `number`

#### interface `Shape`

#### interface `NormalizedBindEntry`

- **path**: `string`
- **entries**: `Record<string, string>`

#### interface `UnassignedItem`

- **key**: `string`
- **label**: `string`
- **itemType**: `'field' | 'group' | 'display'`

#### interface `DefLookupEntry`

- **item**: `FormItem`
- **path**: `string`
- **parentPath**: `string | null`

#### interface `CompNode`

- **component**: `string`
- **bind?**: `string`
- **nodeId?**: `string`
- **_layout?**: `boolean`
- **children?**: `CompNode[]`

#### interface `FlatEntry`

- **id**: `string`
- **node**: `CompNode`
- **depth**: `number`
- **hasChildren**: `boolean`
- **defPath**: `string | null`
- **category**: `'field' | 'group' | 'display' | 'layout'`
- **nodeId**: `string | undefined`
- **bind**: `string | undefined`

#### interface `MoveCommand`

- **type**: `'definition.moveItem'`
- **payload**: `{
        sourcePath: string;
        targetParentPath: string;
        targetIndex: number;
    }`

## `summarizeExpression(expression: string): string`

## `buildRowSummaries(item: FormItem, binds: Record<string, string>): RowSummaryEntry[]`

## `buildStatusPills(binds: Record<string, string>, item: FormItem): RowStatusPill[]`

## `buildMissingPropertyActions(item: FormItem, binds: Record<string, string>, itemLabel: string): MissingPropertyAction[]`

#### interface `RowSummaryEntry`

- **label**: `string`
- **value**: `string`

#### interface `RowStatusPill`

- **text**: `string`
- **color**: `'accent' | 'logic' | 'error' | 'green' | 'amber' | 'muted'`

#### interface `MissingPropertyAction`

- **key**: `'description' | 'hint' | 'behavior'`
- **label**: `string`
- **ariaLabel**: `string`

## `previewForm(project: Project, scenario?: Record<string, unknown>): {
    visibleFields: string[];
    hiddenFields: {
        path: string;
        hiddenBy?: string;
    }[];
    currentValues: Record<string, unknown>;
    requiredFields: string[];
    pages: {
        id: string;
        title: string;
        validationErrors: number;
        validationWarnings: number;
        status: 'active' | 'complete' | 'incomplete' | 'unreachable';
    }[];
    validationState: Record<string, {
        severity: 'error' | 'warning' | 'info';
        message: string;
    }>;
}`

Preview — simulate respondent experience.
Creates a FormEngine from the project's exported definition,
optionally replays scenario values, and returns a snapshot.

All paths in the returned object (visibleFields, hiddenFields, currentValues,
requiredFields, validationState keys) use 0-based indexing for repeat group
instances (e.g. `items[0].field`). Note that the engine's ValidationReport
uses 1-based indexing externally; this function normalizes those back to 0-based
for consistency.

## `validateResponse(project: Project, response: Record<string, unknown>): ValidationReport`

Validate a response document against the current form definition.
Returns a ValidationReport from formspec-engine.

## `validateFEL(expression: string): string | null`

## `buildFELHighlightTokens(expression: string, functionSignatures?: Record<string, string>): FELHighlightToken[]`

## `getFELAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null`

## `getFELInstanceNameAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null`

## `getInstanceNameOptions(instances: Record<string, FormspecInstance> | undefined, query: string): string[]`

## `getFELFunctionAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null`

## `filterFELFieldOptions(options: FELEditorFieldOption[], query: string): FELEditorFieldOption[]`

## `filterFELFunctionOptions(options: FELEditorFunctionOption[], query: string): FELEditorFunctionOption[]`

## `getInstanceFieldOptions(instances: Record<string, FormspecInstance> | undefined, instanceName: string): FELEditorFieldOption[]`

#### interface `FELEditorFieldOption`

- **path**: `string`
- **label**: `string`
- **dataType?**: `string`

#### interface `FELEditorFunctionOption`

- **name**: `string`
- **label**: `string`
- **signature?**: `string`
- **description?**: `string`
- **category?**: `string`

#### interface `FELAutocompleteTrigger`

- **start**: `number`
- **end**: `number`
- **query**: `string`
- **insertionPrefix?**: `string`
- **insertionSuffix?**: `string`
- **instanceName?**: `string`

#### interface `FELHighlightToken`

- **key**: `string`
- **text**: `string`
- **kind**: `'plain' | 'keyword' | 'literal' | 'operator' | 'path' | 'function'`
- **functionName?**: `string`
- **signature?**: `string`

## `resolveFieldType(type: string): ResolvedFieldType`

## `resolveWidget(widget: string): string`

## `widgetHintFor(aliasOrComponent: string): string | undefined`

## `isTextareaWidget(widget: string): boolean`

## `FIELD_TYPE_MAP: Record<string, {
    dataType: string;
    defaultWidget: string;
    defaultWidgetHint?: string;
    constraintExpr?: string;
}>`

## `WIDGET_ALIAS_MAP: Record<string, string>`

#### interface `ResolvedFieldType`

- **defaultWidgetHint** (`string`): Spec-normative default widgetHint for this dataType (e.g. "textarea" for text).

#### interface `HelperWarning`

Structured warning — prefer over prose strings for programmatic consumers

- **code**: `string`
- **message**: `string`
- **detail?**: `object`

#### interface `HelperResult`

Return type for all helper methods

- **summary**: `string`
- **action**: `{
        helper: string;
        params: Record<string, unknown>;
    }`
- **affectedPaths**: `string[]`
- **createdId?**: `string`
- **groupKey?**: `string`
- **warnings?**: `HelperWarning[]`

#### interface `ChoiceOption`

Choice option for inline options or defineChoices

- **value**: `string`
- **label**: `string`

#### interface `FieldProps`

Field properties for addField / addScreenField

- **placeholder?**: `string`
- **hint?**: `string`
- **description?**: `string`
- **ariaLabel?**: `string`
- **choices?**: `ChoiceOption[]`
- **choicesFrom?**: `string`
- **widget?**: `string`
- **page?**: `string`
- **required?**: `boolean`
- **readonly?**: `boolean`
- **initialValue?**: `unknown`
- **insertIndex?**: `number`
- **parentPath?**: `string`

#### interface `ContentProps`

Content properties for addContent

- **page?**: `string`
- **parentPath?**: `string`
- **insertIndex?**: `number`

#### interface `GroupProps`

Group properties

- **display?**: `'stack' | 'dataTable'`
- **page?**: `string`
- **parentPath?**: `string`
- **insertIndex?**: `number`

#### interface `RepeatProps`

Repeat group configuration

- **min?**: `number`
- **max?**: `number`
- **addLabel?**: `string`
- **removeLabel?**: `string`

#### interface `BranchPath`

Branch path — one arm of a conditional branch

- **when** (`string | number | boolean`): Value to match against. Required for 'equals'/'contains' modes, optional for 'condition' mode.
- **condition** (`string`): Raw FEL expression — used when mode is 'condition' (escape hatch for advanced users).

#### interface `PlacementOptions`

Placement options for placeOnPage

- **span?**: `number`

#### interface `LayoutAddItemSpec`

Layout-side add-item request

- **itemType**: `'field' | 'group' | 'display' | 'layout'`
- **label**: `string`
- **key?**: `string`
- **dataType?**: `string`
- **component?**: `string`
- **repeatable?**: `boolean`
- **presentation?**: `Record<string, unknown>`

#### interface `FlowProps`

Flow configuration

- **showProgress?**: `boolean`
- **allowSkip?**: `boolean`

#### interface `ValidationOptions`

Validation options for addValidation

- **timing?**: `'continuous' | 'submit' | 'demand'`
- **severity?**: `'error' | 'warning' | 'info'`
- **code?**: `string`
- **activeWhen?**: `string`

#### interface `InstanceProps`

Named external data source (secondary instance)

- **source?**: `string`
- **data?**: `unknown`
- **schema?**: `object`
- **static?**: `boolean`
- **readonly?**: `boolean`
- **description?**: `string`

#### interface `FELValidationResult`

FEL expression validation result — returned by validateFELExpression()

- **valid**: `boolean`
- **errors**: `Array<{
        message: string;
        line?: number;
        column?: number;
    }>`
- **references**: `string[]`
- **functions**: `string[]`

#### interface `FELSuggestion`

FEL autocomplete suggestion — returned by felAutocompleteSuggestions()

- **label**: `string`
- **kind**: `'field' | 'function' | 'variable' | 'instance' | 'keyword'`
- **detail?**: `string`
- **insertText**: `string`

#### interface `WidgetInfo`

Widget info — returned by listWidgets()

- **name**: `string`
- **component**: `string`
- **compatibleDataTypes**: `string[]`

#### interface `MetadataChanges`

Metadata changes for setMetadata — split between title, presentation, and definition handlers

- **title?**: `string | null`
- **name?**: `string | null`
- **description?**: `string | null`
- **url?**: `string | null`
- **version?**: `string | null`
- **status?**: `'draft' | 'active' | 'retired' | 'unknown' | null`
- **date?**: `string | null`
- **versionAlgorithm?**: `string | null`
- **nonRelevantBehavior?**: `'empty' | 'suppress' | null`
- **derivedFrom?**: `string | null`
- **density?**: `'compact' | 'comfortable' | 'spacious' | null`
- **labelPosition?**: `'top' | 'start' | 'hidden' | null`
- **pageMode?**: `'single' | 'wizard' | 'tabs' | null`
- **defaultCurrency?**: `string | null`
- **showProgress?**: `boolean | null`
- **allowSkip?**: `boolean | null`
- **defaultTab?**: `number | null`
- **tabPosition?**: `'top' | 'bottom' | 'left' | 'right' | null`
- **direction?**: `'ltr' | 'rtl' | 'auto' | null`

#### interface `ItemChanges`

Changes for updateItem — each key routes to a different handler

- **label?**: `string | null`
- **hint?**: `string | null`
- **description?**: `string | null`
- **placeholder?**: `string`
- **ariaLabel?**: `string`
- **options?**: `ChoiceOption[] | null`
- **choicesFrom?**: `string`
- **currency?**: `string | null`
- **precision?**: `number | null`
- **initialValue?**: `unknown`
- **prePopulate?**: `unknown`
- **dataType?**: `string`
- **required?**: `boolean | string | null`
- **constraint?**: `string | null`
- **constraintMessage?**: `string | null`
- **calculate?**: `string | null`
- **relevant?**: `string | null`
- **readonly?**: `boolean | string | null`
- **default?**: `string | null`
- **repeatable?**: `boolean`
- **minRepeat?**: `number | null`
- **maxRepeat?**: `number | null`
- **widget?**: `string | null`
- **style?**: `Record<string, unknown>`
- **page?**: `string`
- **prefix?**: `string | null`
- **suffix?**: `string | null`
- **semanticType?**: `string | null`

#### type `LayoutArrangement`

Layout arrangement for applyLayout

```ts
type LayoutArrangement = 'columns-2' | 'columns-3' | 'columns-4' | 'card' | 'sidebar' | 'inline';
```

#### class `HelperError`

Thrown by helpers when pre-validation fails

##### `constructor(code: string, message: string, detail?: object | undefined)`

## `handleKeyboardShortcut(event: KeyboardEvent, handlers: ShortcutHandlers, options?: ShortcutOptions): void`

#### interface `ShortcutHandlers`

@filedesc Global Studio keyboard shortcut policy for undo/redo, delete, escape, and search.

- **undo**: `() => void`
- **redo**: `() => void`
- **delete**: `() => void`
- **escape**: `() => void`
- **search**: `() => void`

#### interface `ShortcutOptions`

- **activeWorkspace?**: `string`

## `buildLayoutContextMenuItems(menu: LayoutContextMenuState | null): LayoutContextMenuItem[]`

## `executeLayoutAction({ action, menu, project, deselect, closeMenu, }: ExecuteLayoutActionOptions): void`

#### interface `LayoutContextMenuState`

- **x**: `number`
- **y**: `number`
- **kind**: `'node' | 'canvas'`
- **nodeType?**: `'field' | 'group' | 'display' | 'layout'`
- **nodeRef?**: `{
        bind?: string;
        nodeId?: string;
    }`

#### interface `LayoutContextMenuItem`

- **label**: `string`
- **action**: `string`
- **separator?**: `boolean`

#### interface `ExecuteLayoutActionOptions`

- **action**: `string`
- **menu**: `LayoutContextMenuState | null`
- **project**: `Project`
- **deselect**: `() => void`
- **closeMenu**: `() => void`

## `generateDefinitionSampleData(definition: FormDefinition, options?: MappingSampleOptions): Record<string, unknown>`

#### interface `MappingSampleOptions`

- **seed?**: `number`

## `serializeMappedData(data: any, options?: AdapterOptions): string`

#### interface `AdapterOptions`

@filedesc Mapping preview serializers for JSON, XML, and CSV output formats.

- **format?**: `'json' | 'xml' | 'csv'`
- **rootElement?**: `string`
- **namespaces?**: `Record<string, string>`
- **pretty?**: `boolean`
- **sortKeys?**: `boolean`
- **nullHandling?**: `'include' | 'omit'`
- **declaration?**: `boolean`
- **indent?**: `number`
- **cdata?**: `string[]`
- **delimiter?**: `string`
- **quote?**: `string`
- **header?**: `boolean`
- **lineEnding?**: `'crlf' | 'lf'`

## `resolveLayoutPageStructure(state: PageStructureViewInput): PageStructureView`

#### interface `PageView`

- **id**: `string`
- **title**: `string`
- **description?**: `string`
- **items**: `PageItemView[]`

#### interface `PageItemView`

- **key**: `string`
- **label**: `string`
- **status**: `'valid' | 'broken'`
- **width**: `number`
- **offset?**: `number`
- **responsive**: `Record<string, {
        width?: number;
        offset?: number;
        hidden?: boolean;
    }>`
- **itemType**: `'field' | 'group' | 'display'`
- **childCount?**: `number`
- **repeatable?**: `boolean`
- **widgetHint?**: `string`

#### interface `PlaceableItem`

- **key**: `string`
- **label**: `string`
- **itemType**: `'field' | 'group' | 'display'`

#### interface `PageStructureView`

- **mode**: `'single' | 'wizard' | 'tabs'`
- **pages**: `PageView[]`
- **unassigned**: `PlaceableItem[]`
- **itemPageMap**: `Record<string, string>`
- **breakpointNames**: `string[]`
- **breakpointValues?**: `Record<string, number>`
- **diagnostics**: `Array<{
        severity: 'warning' | 'error';
        message: string;
    }>`

#### type `PageStructureViewInput`

```ts
type PageStructureViewInput = {
    definition: Pick<FormDefinition, 'formPresentation' | 'items'>;
    component?: Pick<ComponentState, 'tree'>;
    theme?: {
        breakpoints?: Record<string, number>;
    };
};
```

## `normalizeDefinitionDoc(definition: unknown): unknown`

## `normalizeComponentDoc(doc: unknown, definition?: unknown): unknown`

## `normalizeThemeDoc(doc: unknown, definition: unknown): unknown`

## `createProject(options?: CreateProjectOptions): Project`

## `buildBundleFromDefinition(definition: FormDefinition): ProjectBundle`

Build a full ProjectBundle from a bare definition.

Uses createRawProject to generate the component tree, theme, and mapping
that the definition implies. On failure (degenerate definition), returns
a minimal bundle with the definition and empty/null documents.

#### class `Project`

Behavior-driven authoring API for Formspec.
Composes an IProjectCore and exposes form-author-friendly helper methods.
All authoring methods return HelperResult.

For raw project access (dispatch, state, queries), use formspec-core directly.

##### `constructor(core: IProjectCore, _recorderControl?: ChangesetRecorderControl | undefined)`

- **(get) proposals** (`ProposalManager | null`): Access the ProposalManager for changeset operations. Null if not enabled.

##### `localeAt(code: string): LocaleState | undefined`

##### `activeLocaleCode(): string | undefined`

##### `fieldPaths(): string[]`

##### `itemPaths(): string[]`

##### `itemAt(path: string): FormItem | undefined`

##### `bindFor(path: string): Record<string, unknown> | undefined`

##### `variableNames(): string[]`

##### `instanceNames(): string[]`

##### `statistics(): ProjectStatistics`

##### `commandHistory(): readonly LogEntry[]`

##### `export(): ProjectBundle`

##### `diagnose(): Diagnostics`

##### `componentFor(fieldKey: string): Record<string, unknown> | undefined`

##### `pageStructure(): PageStructureView`

##### `searchItems(filter: ItemFilter): ItemSearchResult[]`

##### `parseFEL(expression: string, context?: FELParseContext): FELParseResult`

##### `felFunctionCatalog(): FELFunctionEntry[]`

##### `availableReferences(context?: string | FELParseContext): FELReferenceSet`

##### `expressionDependencies(expression: string): string[]`

##### `fieldDependents(fieldPath: string): FieldDependents`

##### `diffFromBaseline(fromVersion?: string): Change[]`

##### `previewChangelog(): FormspecChangelog`

##### `validateFELExpression(expression: string, contextPath?: string): FELValidationResult`

Validate a FEL expression and return detailed diagnostics.

##### `felAutocompleteSuggestions(partial: string, contextPath?: string): FELSuggestion[]`

Return autocomplete suggestions for a partial FEL expression.

##### `humanizeFELExpression(expression: string): string`

Convert a FEL expression to a human-readable English string.

##### `listWidgets(): WidgetInfo[]`

Returns all known widgets with their compatible data types.

##### `compatibleWidgets(dataType: string): string[]`

Returns widget names (component types) compatible with a given data type or alias.

##### `fieldTypeCatalog(): FieldTypeCatalogEntry[]`

Returns the field type alias table (all types the user can specify in addField).

##### `registryDocuments(): unknown[]`

Returns raw registry documents for passing to rendering consumers (e.g. <formspec-render>).

##### `moveLayoutNode(sourceNodeId: string, targetParentNodeId: string, targetIndex: number): HelperResult`

Move a component tree node to a new parent/position.

##### `moveItems(moves: Array<{
        sourcePath: string;
        targetParentPath?: string;
        targetIndex: number;
    }>): HelperResult`

Batch-move multiple definition items atomically (e.g. multi-select DnD).

##### `undo(): boolean`

##### `redo(): boolean`

##### `onChange(listener: ChangeListener): () => void`

##### `loadBundle(bundle: Partial<ProjectBundle>): void`

Import a project bundle. The import is undoable like any other edit.

##### `mapField(sourcePath: string, targetPath: string, mappingId?: string): HelperResult`

Add a mapping rule from a form field to an output target.

##### `unmapField(sourcePath: string, mappingId?: string): HelperResult`

Remove all mapping rules for a given source path.

##### `addField(path: string, label: string, type: string, props?: FieldProps): HelperResult`

Add a data collection field.
Resolves type alias → { dataType, defaultWidget } via the Field Type Alias Table.
Widget in props resolved via the Widget Alias Table before dispatch.

##### `addGroup(path: string, label: string, props?: GroupProps): HelperResult`

Add a group/section container.

##### `addContent(path: string, body: string, kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider', props?: ContentProps): HelperResult`

Add display content — non-data element.

##### `showWhen(target: string, condition: string): HelperResult`

Conditional visibility — dispatches definition.setBind { relevant: condition }

##### `readonlyWhen(target: string, condition: string): HelperResult`

Readonly condition — dispatches definition.setBind { readonly: condition }

##### `require(target: string, condition?: string): HelperResult`

Required rule — dispatches definition.setBind { required: condition ?? 'true' }

##### `calculate(target: string, expression: string): HelperResult`

Calculated value — dispatches definition.setBind { calculate: expression }

##### `branch(on: string, paths: BranchPath[], otherwise?: string | string[]): HelperResult`

Branching — show different fields based on an answer or variable.
Auto-detects mode for multiChoice fields (uses selected() not equals).
Supports variables: pass `@varName` or a bare name that matches a variable.

##### `addValidation(target: string, rule: string, message: string, options?: ValidationOptions): HelperResult`

Cross-field validation — adds a shape rule.

##### `removeValidation(target: string): HelperResult`

Remove validation from a target — handles both shape IDs and field paths.
When target matches a shape ID: deletes the shape.
When target matches a field path: clears bind constraint + constraintMessage,
and removes any shapes targeting that path.
Tries both lookups so MCP callers don't need to know which mechanism was used.

##### `updateValidation(shapeId: string, changes: {
        rule?: string;
        message?: string;
        timing?: 'continuous' | 'submit' | 'demand';
        severity?: 'error' | 'warning' | 'info';
        code?: string;
        activeWhen?: string;
    }): HelperResult`

Update a validation shape's rule, message, or options.

##### `removeItem(path: string): HelperResult`

Remove item — full reference cleanup before delete.
Collects ALL dependents BEFORE mutations, then dispatches cleanup + delete atomically.

##### `updateItem(path: string, changes: ItemChanges): HelperResult`

Update any property of an existing item — fan-out helper.

##### `moveItem(path: string, targetParentPath?: string, targetIndex?: number): HelperResult`

Move item to a new parent or position.

##### `renameItem(path: string, newKey: string): HelperResult`

Rename item — FEL reference rewriting handled inside the handler.

##### `reorderItem(path: string, direction: 'up' | 'down'): HelperResult`

Reorder item within its parent (swap with neighbor).

##### `setMetadata(changes: MetadataChanges): HelperResult`

Form-level metadata setter.

##### `defineChoices(name: string, options: ChoiceOption[]): HelperResult`

Define a reusable named option set.

##### `makeRepeatable(target: string, props?: RepeatProps): HelperResult`

Make a group repeatable with optional cardinality constraints.

##### `copyItem(path: string, deep?: boolean, targetPath?: string): HelperResult`

Copy a field or group. If targetPath is provided, places the clone under that group.

##### `wrapItemsInGroup(paths: string[], groupPathOrLabel?: string, groupLabel?: string): HelperResult`

Wrap existing items in a new group container.
When groupPath is provided, uses it as the group key (must not already exist).
When omitted, auto-generates a unique key.

##### `wrapInLayoutComponent(path: string, component: 'Card' | 'Stack' | 'Collapsible'): HelperResult`

Wrap an item node in a layout component.

##### `batchDeleteItems(paths: string[]): HelperResult`

Batch delete multiple items atomically. Pre-validates all paths exist,
collects cleanup commands for dependent binds/shapes/variables, then
dispatches everything in a single atomic operation.

##### `batchDuplicateItems(paths: string[]): HelperResult`

Batch duplicate multiple items using copyItem for full bind/shape handling.

##### `addSubmitButton(label?: string, pageId?: string): HelperResult`

Add a submit button.

##### `addPage(title: string, description?: string, id?: string, opts?: {
        standalone?: boolean;
    }): HelperResult`

Add a page. By default creates a paired definition group and places it on the new page.
With `opts.standalone`, creates only the page with no paired group.

##### `removePage(pageId: string): HelperResult`

Remove a page — deletes only the page surface. Groups and fields remain intact as unassigned items.

##### `reorderPage(pageId: string, direction: 'up' | 'down'): HelperResult`

Reorder a page.

##### `movePageToIndex(pageId: string, targetIndex: number): HelperResult`

Move a page to an arbitrary zero-based index in one atomic undo step.

##### `listPages(): Array<{
        id: string;
        title: string;
        description?: string;
        groupPath?: string;
    }>`

List all pages with their id, title, description, and primary group path.

##### `updatePage(pageId: string, changes: {
        title?: string;
        description?: string;
    }): HelperResult`

Update a page's title or description.

##### `placeOnPage(target: string, pageId: string, options?: PlacementOptions): HelperResult`

Assign an item to a page.

##### `unplaceFromPage(target: string, pageId: string): HelperResult`

Remove item from page assignment.

##### `setFlow(mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult`

Set flow mode.

##### `setComponentWhen(target: string, when: string | null): HelperResult`

Set a component-level visual condition (`when`) on a bound item or layout node.

##### `setComponentAccessibility(target: string, property: string, value: unknown): HelperResult`

Set a component accessibility override on a bound item or layout node.

##### `addItemToLayout(spec: LayoutAddItemSpec, pageId?: string): HelperResult`

Add a new item from the Layout workspace, placing it directly into the component tree.

##### `applyLayout(targets: string | string[], arrangement: LayoutArrangement): HelperResult`

Apply spatial layout to targets.

##### `applyStyle(path: string, properties: Record<string, unknown>): HelperResult`

Apply style overrides to a specific field.

##### `applyStyleAll(target: 'form' | {
        type: 'group' | 'field' | 'display';
    } | {
        dataType: string;
    }, properties: Record<string, unknown>): HelperResult`

Apply style to form-level defaults or type selectors.

##### `setToken(key: string, value: string | null): HelperResult`

Set or delete a single theme token (null = delete).

##### `setThemeDefault(property: string, value: unknown): HelperResult`

Set a default theme property (e.g. labelPosition, widget, cssClass).

##### `setBreakpoint(name: string, minWidth: number | null): HelperResult`

Set or delete a responsive breakpoint (null minWidth = delete).

##### `addThemeSelector(match: Record<string, unknown>, apply: Record<string, unknown>): HelperResult`

Add a theme selector rule.

##### `updateThemeSelector(index: number, changes: {
        match?: Record<string, unknown>;
        apply?: Record<string, unknown>;
    }): HelperResult`

Update a theme selector rule by index.

##### `deleteThemeSelector(index: number): HelperResult`

Delete a theme selector rule by index.

##### `reorderThemeSelector(index: number, direction: 'up' | 'down'): HelperResult`

Reorder a theme selector rule.

##### `setItemOverride(itemKey: string, property: string, value: unknown): HelperResult`

Set a per-item theme override (e.g. labelPosition for a specific field).

##### `clearItemOverrides(itemKey: string): HelperResult`

Clear all per-item theme overrides for an item.

##### `addRegion(pageId: string, span?: number): HelperResult`

Add an empty region to a page.

##### `updateRegion(pageId: string, regionIndex: number, property: string, value: unknown): HelperResult`

Update a region property by index.

##### `deleteRegion(pageId: string, regionIndex: number): HelperResult`

Delete a region from a page by index.

##### `reorderRegion(pageId: string, regionIndex: number, direction: 'up' | 'down'): HelperResult`

Reorder a region within a page by index.

##### `setRegionKey(pageId: string, regionIndex: number, newKey: string): HelperResult`

Set the field-key assignment for a region by index.

##### `renamePage(pageId: string, newTitle: string): HelperResult`

Rename a page's title.

##### `setItemWidth(pageId: string, itemKey: string, width: number): HelperResult`

Set the width (grid span) of an item on a page.

##### `setItemOffset(pageId: string, itemKey: string, offset: number | undefined): HelperResult`

Set the offset (grid start) of an item on a page.

##### `setItemResponsive(pageId: string, itemKey: string, breakpoint: string, overrides: {
        width?: number;
        offset?: number;
        hidden?: boolean;
    } | undefined): HelperResult`

Set responsive breakpoint overrides for an item on a page.

##### `removeItemFromPage(pageId: string, itemKey: string): HelperResult`

Remove an item from a page.

##### `moveItemToPage(sourcePageId: string, itemKey: string, targetPageId: string, opts?: PlacementOptions): HelperResult`

Move an item from one page to another as a single atomic undo step.
Batches the unassign + assign into one history entry so undo/redo is coherent.

##### `reorderItemOnPage(pageId: string, itemKey: string, direction: 'up' | 'down'): HelperResult`

Reorder an item within a page (by key, not index).

##### `moveItemOnPageToIndex(pageId: string, itemKey: string, targetIndex: number): HelperResult`

Move an item to an arbitrary position on a page by target index.

##### `addLayoutNode(parentNodeId: string, component: string): HelperResult`

Add a layout-only node to the component tree.

##### `unwrapLayoutNode(nodeId: string): HelperResult`

Unwrap a layout container, promoting its children.

##### `deleteLayoutNode(nodeId: string): HelperResult`

Delete a layout node from the component tree.

##### `updateOptionSet(name: string, property: string, value: unknown): HelperResult`

Update a property on an option set.

##### `deleteOptionSet(name: string): HelperResult`

Delete an option set by name.

##### `setMappingProperty(property: string, value: unknown, mappingId?: string): HelperResult`

Set a mapping document root property (e.g. version, direction, autoMap).

##### `setMappingTargetSchema(property: string, value: unknown, mappingId?: string): HelperResult`

Set a property on the mapping's target structure descriptor.

##### `addMappingRule(params: {
        sourcePath?: string;
        targetPath?: string;
        transform?: string;
        insertIndex?: number;
        mappingId?: string;
    }): HelperResult`

Add a mapping rule with optional transform parameters.

##### `updateMappingRule(index: number, property: string, value: unknown, mappingId?: string): HelperResult`

Update a property of an existing mapping rule.

##### `removeMappingRule(index: number, mappingId?: string): HelperResult`

Remove a mapping rule by index.

##### `clearMappingRules(mappingId?: string): HelperResult`

Clear all mapping rules.

##### `reorderMappingRule(index: number, direction: 'up' | 'down', mappingId?: string): HelperResult`

Reorder a mapping rule.

##### `setMappingAdapter(format: string, config: unknown): HelperResult`

Set configuration for a specific wire-format adapter (JSON, XML, CSV).

##### `updateMappingDefaults(defaults: Record<string, unknown>): HelperResult`

Update the top-level mapping defaults.

##### `autoGenerateMappingRules(params?: {
        scopePath?: string;
        priority?: number;
        replace?: boolean;
    }): HelperResult`

Auto-generate mapping rules for every field in the form.

##### `previewMapping(params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult`

Run a mapping preview and return the projected output.

##### `createMapping(id: string, options?: {
        targetSchema?: Record<string, unknown>;
    }): HelperResult`

Create a new named mapping document and select it.

##### `deleteMapping(id: string): HelperResult`

Delete a named mapping document. Throws if it is the last mapping.

##### `renameMapping(oldId: string, newId: string): HelperResult`

Rename a mapping document. Throws if the new ID already exists.

##### `selectMapping(id: string): HelperResult`

Select the active mapping document by ID.

##### `addVariable(name: string, expression: string, scope?: string): HelperResult`

Add a named FEL variable.

##### `updateVariable(name: string, expression: string): HelperResult`

Update a variable's expression.

##### `removeVariable(name: string): HelperResult`

Remove a variable — warns about dangling references.

##### `renameVariable(name: string, newName: string): HelperResult`

Rename a variable — Future Work, handler not implemented.

##### `addInstance(name: string, props: InstanceProps): HelperResult`

Add a named external data source.

##### `updateInstance(name: string, changes: Partial<InstanceProps>): HelperResult`

Update instance properties.

##### `renameInstance(name: string, newName: string): HelperResult`

Rename an instance — rewrites FEL references.

##### `removeInstance(name: string): HelperResult`

Remove an instance.

##### `setScreener(enabled: boolean): HelperResult`

Enable/disable screener.

##### `addScreenField(key: string, label: string, type: string, props?: FieldProps): HelperResult`

Add a screener question.

##### `removeScreenField(key: string): HelperResult`

Remove a screener question.

##### `addScreenRoute(condition: string, target: string, label?: string, message?: string): HelperResult`

Add a screener routing rule.

##### `updateScreenRoute(routeIndex: number, changes: {
        condition?: string;
        target?: string;
        label?: string;
        message?: string;
    }): HelperResult`

Update a screener route.

##### `reorderScreenRoute(routeIndex: number, direction: 'up' | 'down'): HelperResult`

Reorder a screener route.

##### `removeScreenRoute(routeIndex: number): HelperResult`

Remove a screener route.

##### `generateSampleData(): Record<string, unknown>`

Generate plausible sample data for each field based on its data type.

##### `normalizeDefinition(): Record<string, unknown>`

Return a cleaned-up deep clone of the definition.
Strips null values, empty arrays, and undefined keys.

#### interface `ChangeEntry`

A single recorded entry within a changeset.

Stores the actual pipeline commands (not MCP tool arguments) for
deterministic replay. The MCP layer sets toolName/summary via
beginEntry/endEntry; user overlay entries have them auto-generated.

- **commands** (`AnyCommand[][]`): The actual commands dispatched through the pipeline (captured by middleware).
- **toolName** (`string`): Which MCP tool triggered this entry (set by MCP layer, absent for user overlay).
- **summary** (`string`): Human-readable summary (set by MCP layer, auto-generated for user overlay).
- **affectedPaths** (`string[]`): Paths affected by this entry (extracted from CommandResult).
- **warnings** (`string[]`): Warnings produced during execution.
- **capturedValues** (`Record<string, unknown>`): Captured evaluated values for one-shot expressions (initialValue/default with = prefix).

#### interface `DependencyGroup`

A dependency group computed from intra-changeset analysis.
Entries within a group must be accepted or rejected together.

- **entries** (`number[]`): Indices into changeset.aiEntries.
- **reason** (`string`): Human-readable explanation of why these entries are grouped.

#### interface `Changeset`

A changeset tracking AI-proposed mutations with git merge semantics.

The user is never locked out — AI changes and user changes coexist
as two recording tracks, and conflicts are detected at merge time.

- **id** (`string`): Unique changeset identifier.
- **label** (`string`): Human-readable label (e.g. "Added 3 fields, set validation on email").
- **aiEntries** (`ChangeEntry[]`): AI's work (recorded during MCP tool brackets).
- **userOverlay** (`ChangeEntry[]`): User edits made while changeset exists.
- **dependencyGroups** (`DependencyGroup[]`): Computed from aiEntries on close.
- **status** (`ChangesetStatus`): Current lifecycle status.
- **snapshotBefore** (`ProjectState`): Full state snapshot captured when changeset was opened.

#### interface `ReplayFailure`

Failure result when command replay fails.

- **phase** (`'ai' | 'user'`): Which phase failed: 'ai' for AI group replay, 'user' for user overlay replay.
- **entryIndex** (`number`): The entry that failed to replay.
- **error** (`Error`): The error that occurred during replay.

#### type `ChangesetStatus`

Status of a changeset through its lifecycle.

```ts
type ChangesetStatus = 'open' | 'pending' | 'merged' | 'rejected';
```

#### type `MergeResult`

Result of a merge operation.

```ts
type MergeResult = {
    ok: true;
    diagnostics: Diagnostics;
} | {
    ok: false;
    replayFailure: ReplayFailure;
} | {
    ok: false;
    diagnostics: Diagnostics;
};
```

#### class `ProposalManager`

Manages changeset lifecycle, actor-tagged recording, and snapshot-and-replay.

The ProposalManager controls the ChangesetRecorderControl (from formspec-core's
changeset middleware) and orchestrates the full changeset lifecycle:

1. Open → snapshot state, start recording
2. AI mutations (via MCP beginEntry/endEntry brackets)
3. User edits (canvas, recorded to user overlay)
4. Close → compute dependency groups, status → pending
5. Merge/reject → snapshot-and-replay or discard

##### `constructor(core: IProjectCore, setRecording: (on: boolean) => void, setActor: (actor: 'ai' | 'user') => void)`

@param core - The IProjectCore instance to manage.
@param setRecording - Callback to toggle the middleware's recording flag.
@param setActor - Callback to set the middleware's currentActor.

- **(get) changeset** (`Readonly<Changeset> | null`): Returns the active changeset, or null if none.
- **(get) hasActiveChangeset** (`boolean`): Whether a changeset is currently open or pending review.
- **(get) canUndo** (`boolean`): Whether undo is currently allowed.
Disabled while a changeset is open — the changeset IS the undo mechanism.
- **(get) canRedo** (`boolean`): Whether redo is currently allowed.
Disabled while a changeset is open.

##### `openChangeset(): string`

Open a new changeset. Captures a state snapshot and starts recording.

##### `beginEntry(toolName: string): void`

Begin an AI entry bracket. Sets actor to 'ai'.
Called by the MCP layer before executing a tool.

##### `endEntry(summary: string, warnings?: string[]): void`

End an AI entry bracket. Resets actor to 'user'.
Called by the MCP layer after a tool completes.

##### `onCommandsRecorded(actor: 'ai' | 'user', commands: Readonly<AnyCommand[][]>, results: Readonly<CommandResult[]>, _priorState: Readonly<ProjectState>): void`

Called by the changeset middleware when commands are recorded.
Routes to AI entries or user overlay based on actor.

##### `closeChangeset(label: string): void`

Close the changeset. Computes dependency groups and sets status to 'pending'.

##### `acceptChangeset(groupIndices?: number[]): MergeResult`

Accept (merge) a pending changeset.

##### `rejectChangeset(groupIndices?: number[]): MergeResult`

Reject a pending changeset. Restores to snapshot and replays user overlay.

##### `discardChangeset(): void`

Discard the current changeset without merging or rejecting.
Restores to the snapshot before the changeset was opened.

#### interface `ProjectSnapshot`

Read-only snapshot of the project's authored artifacts.
This is what `project.state` returns — the four editable artifacts
without internal bookkeeping (extensions and versioning).

- **definition**: `FormDefinition`
- **component**: `ComponentDocument`
- **theme**: `ThemeDocument`
- **mappings**: `Record<string, MappingDocument>`
- **selectedMappingId?**: `string`

#### interface `CreateProjectOptions`

Options for creating a new Project via `createProject()`.
Simpler than core's ProjectOptions — no middleware, no raw ProjectState.

- **seed** (`Partial<ProjectBundle>`): Partial bundle to seed the project with.
- **registries** (`unknown[]`): Extension registry documents to load.
- **maxHistoryDepth** (`number`): Maximum undo snapshots (default: 50).
- **enableChangesets** (`boolean`): Whether to enable changeset support (ProposalManager).
Default: true. Set to false to skip the changeset middleware.

#### type `ChangeListener`

Callback invoked after every state change.
Intentionally narrower than core's ChangeListener — consumers subscribe
for re-render notifications, they don't inspect command internals.

```ts
type ChangeListener = () => void;
```

