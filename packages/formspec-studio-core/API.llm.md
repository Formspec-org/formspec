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

## `registryExtensionPaletteEntries(allTypes: DataTypeInfo[], resolveExtension: (name: string) => Record<string, unknown> | undefined): FieldTypeCatalogEntry[]`

Map loaded registry `dataType` extensions into palette rows.
`extra.registryDataType` is the extension name passed to `Project.addField`.

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

## `resolveLayoutSelectionNodeRef(tree: CompNode | undefined, selectionKey: string): {

    nodeId: string;
} | {
    bind: string;
}`

Map a layout-canvas selection key (def path, short bind, `__node:id`, or raw display `nodeId`) to a
`NodeRef` that `component.setNodeStyle` and related commands resolve via `findNode`.

## `isCircularComponentMove(root: CompNode | undefined, sourceRef: {

    bind?: string;
    nodeId?: string;
}, targetParentRef: {
    bind?: string;
    nodeId?: string;
}): boolean`

True if moving `sourceRef` under `targetParentRef` would violate
`component.moveNode` (target is the source node or any of its descendants).
Used by Layout DnD before calling move helpers.

## `buildBatchMoveCommands(paths: Set<string>, targetGroupPath: string): MoveCommand[]`

## `humanizeFEL(expression: string): {

    text: string;
    supported: boolean;
}`

## `propertyHelp: Record<string, string>`

## `LAYOUT_CONTAINER_COMPONENTS: Set<string>`

Canonical set of layout container component types.
Single source of truth for both the toolbar preset list and container
detection in the properties panel. Update here to add new containers.

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

## `parseCommaSeparatedKeywords(raw: string): string[] | undefined`

Parse comma-separated type-ahead aliases; returns undefined when empty so JSON omits the key.

## `formatCommaSeparatedKeywords(keywords: string[] | undefined): string`

Display keywords in a single-line editor.

## `summarizeExpression(expression: string): string`

## `buildRowSummaries(item: FormItem, binds: Record<string, string>): RowSummaryEntry[]`

## `buildCategorySummaries(item: FormItem, binds: Record<string, string>): CategorySummaries`

## `buildExpressionDiagnostics(binds: Record<string, string>, definitionKeys: string[]): Record<string, ExpressionDiagnostic | null>`

## `buildStatusPills(binds: Record<string, string>, item: FormItem, options?: BuildStatusPillsOptions): RowStatusPill[]`

## `buildAdvisories(binds: Record<string, string>, item: FormItem): Advisory[]`

## `buildDefinitionAdvisoryIssues(items: FormItem[], allBinds: FormBind[] | undefined | null): DefinitionAdvisoryIssue[]`

Collects `buildAdvisories` results for every field in the definition (for sidebar / health UI).

## `buildMissingPropertyActions(item: FormItem, binds: Record<string, string>, itemLabel: string): MissingPropertyAction[]`

#### interface `RowSummaryEntry`

- **label**: `string`
- **value**: `string`

#### interface `RowStatusPill`

- **specTerm** (`string`): Spec-normative term for tooltip discoverability.
- **warn** (`boolean`): When true, the pill should render a warning indicator.

#### interface `ExpressionDiagnostic`

- **message**: `string`
- **suggestions?**: `string[]`

#### interface `MissingPropertyAction`

- **key**: `'description' | 'hint' | 'behavior'`
- **label**: `string`
- **ariaLabel**: `string`

#### interface `BuildStatusPillsOptions`

- **categorySummaries** (`CategorySummaries`): When provided, `calculate` / `readonly` pills are omitted if the Value category
cell already conveys them (`formula`, `locked`, or stacked text like `25 · locked`).

#### interface `AdvisoryAction`

- **key**: `AdvisoryActionKey`
- **label**: `string`

#### interface `Advisory`

- **code**: `string`
- **severity**: `AdvisorySeverity`
- **message**: `string`
- **actions**: `AdvisoryAction[]`

#### interface `DefinitionAdvisoryIssue`

Flat list of advisory messages for Form Health and similar surfaces.

- **path**: `string`
- **label**: `string`
- **code**: `string`
- **severity**: `AdvisorySeverity`
- **message**: `string`

#### type `CategorySummaries`

Category-keyed summaries: one representative entry per task category.

```ts
type CategorySummaries = Record<string, string>;
```

#### type `AdvisoryActionKey`

Stable keys for advisory action buttons (studio UI maps these to handlers).

```ts
type AdvisoryActionKey = 'remove_required' | 'remove_readonly' | 'add_formula' | 'add_initial_value' | 'add_pre_fill' | 'remove_pre_populate' | 'remove_formula' | 'review_formula';
```

#### type `AdvisorySeverity`

```ts
type AdvisorySeverity = 'warning' | 'info';
```

## `previewForm(project: Project, scenario?: Record<string, unknown>, options?: {

    validationMode?: 'continuous' | 'submit' | 'none';
}): {
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

## `conditionToFEL(condition: Condition): string`

## `groupToFEL(group: ConditionGroup): string`

## `parseFELToGroup(fel: string): ConditionGroup | null`

Parses a narrow subset of FEL into `{ logic: 'and' | 'or', conditions: [...] }` via **`tryLiftConditionGroup`** (Rust/WASM). **Requires** `await initFormspecEngine()` then **`await initFormspecEngineTools()`** before use; throws if tools WASM is not loaded. Returns `null` for blank input or when the lift reports `unlifted` (unsupported shape / parse failure per WASM payload).

## `getOperatorsForDataType(dataType: string): OperatorInfo[]`

## `getOperatorLabel(operator: Operator): string`

## `operatorRequiresValue(operator: Operator): boolean`

## `fieldOptionsFromItems(items: FELEditorFieldOption[]): FELEditorFieldOption[]`

## `emptyCondition(field?: string): Condition`

## `emptyGroup(): ConditionGroup`

#### interface `Condition`

- **field**: `string`
- **operator**: `Operator`
- **value**: `string`

#### interface `ConditionGroup`

- **logic**: `'and' | 'or'`
- **conditions**: `Condition[]`

#### interface `OperatorInfo`

- **operator**: `Operator`
- **label**: `string`
- **requiresValue**: `boolean`

#### type `ComparisonOperator`

```ts
type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
```

#### type `BooleanOperator`

```ts
type BooleanOperator = 'is_true' | 'is_false';
```

#### type `StringOperator`

```ts
type StringOperator = 'contains' | 'starts_with';
```

#### type `NullCheckOperator`

```ts
type NullCheckOperator = 'is_null' | 'is_not_null' | 'is_empty' | 'is_present';
```

#### type `MoneyOperator`

```ts
type MoneyOperator = 'money_eq' | 'money_neq' | 'money_gt' | 'money_gte' | 'money_lt' | 'money_lte';
```

#### type `Operator`

```ts
type Operator = ComparisonOperator | BooleanOperator | StringOperator | NullCheckOperator | MoneyOperator;
```

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
- **warnings?**: `HelperWarning[]`

#### interface `ChoiceOption`

Choice option for inline options or defineChoices (matches definition OptionEntry).

- **keywords** (`string[]`): Optional combobox type-ahead strings (abbreviations, codes).

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

- **dataType** (`string`): Core data type when not using a registry extension.
- **registryDataType** (`string`): Registry `dataType` extension name (e.g. `x-formspec-email`).

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

## `executeLayoutAction({ action, menu, project, tree, layoutFlatOrder, deselect, select, closeMenu, }: ExecuteLayoutActionOptions): void`

#### interface `LayoutContextMenuState`

- **layoutTargetKeys** (`string[]`): Layout selection keys at menu open (def paths, `__node:id`, etc.).
When set, context actions apply to every key — not only `nodeRef`.
- **selectionCount** (`number`): Mirrors `layoutTargetKeys.length` for menu chrome (e.g. hide move when multi-select).

#### interface `LayoutContextMenuItem`

- **label**: `string`
- **action**: `string`
- **separator?**: `boolean`

#### interface `ExecuteLayoutActionOptions`

- **layoutFlatOrder** (`string[]`): DFS order of layout row keys — batch delete/wrap use this for stable ordering.

## `componentTreeForLayout(component: Pick<ComponentDocument, 'tree'>): CompNode`

The component document `tree` for layout walks. Schema `AnyComponent3` unions are wider than
{@link CompNode} (e.g. `width: string | number`); this helper is the single sanctioned assertion
at that boundary (no `unknown` / `any`).

## `hasTier3Content(nodeProps: Record<string, unknown> | undefined): boolean`

Check if a component node has any Tier 3 (presentation) properties set.
Used to show a dot indicator on overflow buttons when the node has custom styles,
accessibility info, or CSS classes.

## `setColumnSpan(project: Project, ref: NodeRef, n: number): void`

Set `style.gridColumn = "span N"` on a component node.
Clamps N to [1, 12]. Preserves all other style properties.

## `setRowSpan(project: Project, ref: NodeRef, n: number): void`

Set `style.gridRow = "span N"` on a component node.
Clamps N to [1, 12]. Preserves all other style properties.

## `setPadding(project: Project, ref: NodeRef, value: string): void`

Set `style.padding` on a component node.
Preserves all other style properties.

## `setStyleProperty(project: Project, ref: NodeRef, key: string, value: string): void`

Add or update a single style property on a component node.
Preserves all other style properties.

## `removeStyleProperty(project: Project, ref: NodeRef, key: string): void`

Remove a single style property from a component node.
Preserves all other style properties.

## `getPropertySources(project: Project, itemKey: string, prop: string, itemType?: string, itemDataType?: string): PropertySource[]`

Walk all cascade levels for a PresentationBlock property on a given item.
Returns entries in ascending level order: default → selector(s) → item-override.
Only selectors whose match criteria apply to the item's type and dataType are included.

## `getPresentationCascade(project: Project, itemKey: string): Record<string, ResolvedProperty>`

Resolve the full 5-level presentation cascade for an item:
formPresentation → item.presentation → theme.defaults → theme.selectors → theme.items[key].
Returns per-property provenance showing which tier produced the effective value.

## `getEditableThemeProperties(project: Project, itemKey: string): EditableThemeProperty[]`

Returns type-aware theme properties that can be overridden for a given item.
Properties returned vary by component type:

- Display components: no labelPosition, widget, or fallback
- Group components: no labelPosition or fallback
- Input components: all properties available
- Other: all properties available

## `setThemeOverride(project: Project, itemKey: string, prop: string, value: unknown): HelperResult`

Set a per-item theme override via the existing project.setItemOverride path.

## `clearThemeOverride(project: Project, itemKey: string, prop: string): HelperResult`

Remove a single per-item theme override property.
Calls theme.setItemOverride with value=null, which deletes the property.

#### interface `DataTableColumnSpec`

DataTable `columns` entry shape (schema-aligned) — kept explicit so `CompNode` can accept both Grid
`columns` (number|string) and DataTable column arrays without using `unknown`.

- **header**: `string`
- **bind**: `string`
- **min?**: `number`
- **max?**: `number`
- **step?**: `number`

#### interface `CompNode`

Layout/component tree node for traversal and editing. Matches schema component objects (including
numeric `gap` / `columns` where allowed) plus studio-only fields (`nodeId`, etc.). Intentionally not
a schema union so every branch exposes optional `bind` / `children` for walks. No index signature,
so document roots (`ComponentDocument.tree`) remain assignable (e.g. `CustomComponentRef`).

- **definitionItemPath** (`string`): Absolute definition item path (e.g. `pageA.contact.email`) set when the tree is
reconciled from the definition. Studio-only — not part of the shipped component
schema. Lets layout tooling resolve the correct item when duplicate leaf keys
exist across pages or groups without relying solely on `bindKeyMap`.
- **columns** (`number | string | DataTableColumnSpec[]`): Grid: count or template string. DataTable: column definitions.
- **defaultOpen** (`boolean | number`): Accordion/Collapsible may use a numeric default in schema types.
- **span** (`number`): Grid region column span (1-12). Studio-internal; not in component schema.
- **start** (`number`): Grid region column start (1-12). Studio-internal; not in component schema.
- **responsive** (`Record<string, unknown>`): Breakpoint-keyed responsive overrides on layout nodes.

#### interface `ContainerLayoutProps`

Layout-specific properties extracted from LayoutContainerProps.

- **columns?**: `number`
- **gap?**: `string`
- **direction?**: `string`
- **wrap?**: `boolean`
- **align?**: `string`
- **elevation?**: `number`
- **width?**: `string`
- **position?**: `string`
- **title?**: `string`
- **defaultOpen?**: `boolean`
- **nodeStyle?**: `Record<string, unknown>`

#### interface `NodeRef`

A node reference — either a nodeId or a bind key, matching component.setNodeStyle's NodeRef.

- **nodeId?**: `string`
- **bind?**: `string`

#### interface `PropertySource`

One entry in the cascade provenance array returned by getPropertySources.

- **source** (`'default' | 'selector' | 'item-override'`): Human-readable cascade source label. Matches ResolvedProperty.source from resolveThemeCascade.
- **sourceDetail** (`string`): Optional detail (e.g. "selector #2: field + string").
- **value** (`unknown`): The value at this cascade level.

#### interface `EditableThemeProperty`

Type-aware theme property descriptor returned by getEditableThemeProperties.

- **prop** (`string`): Property name (e.g. 'labelPosition', 'widget').
- **type** (`'enum' | 'string' | 'object'`): Property type: enum has fixed valid values, string is free text, object is complex.
- **options** (`string[]`): Valid enum values (only when type === 'enum').

## `resolveLayoutInsertTarget(project: Project, pageId?: string): LayoutInsertTarget`

Resolves the correct parent node for adding a new item to the layout.
In multi-page projects, the parent is the active page node.
In single-page projects, the parent is always 'root'.

Mirrors LayoutCanvas parent resolution for `addItemToLayout` / `addLayoutNode`.

## `getItemOverrides(project: Project, itemKey: string): Record<string, unknown>`

Returns the current per-item theme overrides for an item.
Replaces direct `(project.state.theme as any)?.items?.[itemKey] ?? {}` access.

Extracted from AppearanceSection.tsx:70.

## `addStyleOverride(project: Project, itemKey: string, key: string, value: string): void`

Adds a style key/value to the per-item theme style override.
Validates that key is a non-empty string (after trimming).

Extracted from AppearanceSection.tsx:81-88.

## `validateTokenName(name: string): boolean`

Returns true if the token name contains only valid characters:
alphanumeric, hyphens, and underscores. Empty string is rejected.

Extracted from ColorPalette.tsx:22.

## `applyBreakpointPresets(project: Project): void`

Sets standard breakpoints on the theme: mobile (0), tablet (768), desktop (1024).

Extracted from ScreenSizes.tsx:31-35.

## `summarizeSelectorRule(rule: Record<string, unknown>): string`

Returns a human-readable string for a selector rule.
Format: "{type} + {dataType}", or just one if only one is set.
Falls back to "Any item" if neither is set.

Extracted from FieldTypeRules.tsx:11-17.

## `getTokensByGroup(project: Project, group: string): Token[]`

Returns tokens whose name starts with `{group}.`.
Each token has key, name (suffix after dot), and value.

Extracted from ColorPalette.tsx:14-15.

## `getGroupedTokens(project: Project): Map<string, Token[]>`

Groups all tokens by dot-prefix. Tokens without a dot go in "other".

Extracted from AllTokens.tsx:23-28.

## `getSortedBreakpoints(project: Project): Breakpoint[]`

Returns breakpoints sorted by numeric width ascending.

Extracted from ScreenSizes.tsx:14-15.

## `getEditablePropertiesForNode(project: Project, nodeRef: string): string[]`

Returns which properties are valid to set on a given component node.
Heading and Divider nodes hide container layout properties.

Extracted from ComponentProperties.tsx:128-134.

## `parseTokenRegistry(registryDoc: Record<string, unknown>): TokenRegistryMap`

Parse a token-registry.json document into a lookup-friendly structure.

## `getTokenRegistryEntry(key: string, registry: TokenRegistryMap): TokenRegistryEntry | undefined`

Look up registry metadata for a single token key.

## `getEnrichedTokensByGroup(tokens: Record<string, string | number>, group: string, registry?: TokenRegistryMap): EnrichedToken[]`

Get enriched tokens for a category group, merging live theme values with registry metadata.
Dark-mode tokens (color.dark.*) are NOT returned as separate entries — they are
folded into the darkValue/darkKey fields of their light counterpart.

## `getEnrichedGroupedTokens(tokens: Record<string, string | number>, registry?: TokenRegistryMap): Map<string, EnrichedToken[]>`

Get all tokens grouped by category, enriched with registry metadata.
Returns a Map of group name -> EnrichedToken[].

#### interface `Token`

- **key**: `string`
- **name**: `string`
- **value**: `string`

#### interface `TokenRegistryEntry`

A single entry from a parsed token registry category.

- **key**: `string`
- **description?**: `string`
- **type**: `TokenType`
- **defaultValue?**: `string | number`
- **dark?**: `string | number`
- **darkKey?**: `string`

#### interface `TokenRegistryCategory`

A parsed registry category.

- **description?**: `string`
- **type**: `TokenType`
- **darkPrefix?**: `string`
- **entries**: `Map<string, TokenRegistryEntry>`

#### interface `EnrichedToken`

A token enriched with registry metadata.

- **description?**: `string`
- **type**: `TokenType`
- **defaultValue?**: `string | number`
- **isModified**: `boolean`
- **isCustom**: `boolean`
- **darkValue?**: `string`
- **darkDefaultValue?**: `string | number`
- **darkKey?**: `string`

#### interface `Breakpoint`

- **name**: `string`
- **width**: `number`

#### interface `LayoutInsertTarget`

- **pageId** (`string`): The resolved page node ID (or undefined for single-page).
- **parentNodeId** (`string`): The parent node ID to pass to addLayoutNode / addItemToLayout.

#### type `TokenType`

Semantic token type from the registry.

```ts
type TokenType = 'color' | 'dimension' | 'fontFamily' | 'fontWeight' | 'duration' | 'opacity' | 'shadow' | 'number';
```

#### type `TokenRegistryMap`

Parsed token registry lookup structure.

```ts
type TokenRegistryMap = Map<string, TokenRegistryCategory>;
```

## `componentTargetRef(target: string): {

    bind: string;
} | {
    nodeId: string;
}`

Resolve a layout selection target or path to a component node ref.

## `checkVariableSelfReference(name: string, expression: string): void`

Throw CIRCULAR_REFERENCE if the expression references the variable being defined.

## `buildRepeatScopeRewriter(authoredTarget: string, _normalizedTarget: string): {

    rewriteExpression: (expr: string) => string;
    rewriteMessage: (msg: string) => string;
}`

Build a rewriter that canonicalizes FEL references from template (authored)
paths to row-scoped paths after normalizeShapeTarget inserts [*].

## `editDistance(a: string, b: string): number`

Levenshtein distance for fuzzy path matching.

## `resolvePath(path: string, parentPath?: string): {

    key: string;
    parentPath?: string;
    fullPath: string;
}`

Unified path resolution for addField/addGroup/addContent.

- When `parentPath` is given, `path` is treated as relative: split on dots,
  last segment = key, preceding segments prepended to parentPath.
- When `parentPath` is NOT given, `path` is split on dots: last = key,
  preceding = parentPath.

## `sampleValues(): Record<string, unknown>`

Default sample values by data type. Uses today's date for date/dateTime.

## `sampleValueForField(item: FormItem, fieldIndex: number): unknown`

Generate a context-aware sample value for a field.

## `filterByRelevance(definition: unknown, data: Record<string, unknown>): Record<string, unknown>`

Load sample data into a FormEngine and strip fields whose
show_when/relevant condition evaluates to false.

## `pruneObject(value: unknown): unknown`

Recursively prune null values, empty arrays, and empty objects from a value.

## `sampleFieldValue(key: string, dataType: string | undefined, options?: {

    firstOptionValue?: string;
    secondOptionValue?: string;
}): unknown`

Returns a realistic sample value for a field based on its dataType and key name.
Deterministic — same inputs always produce the same output.
Used by both the mapping preview (actual values) and the output blueprint (display strings).

## `generateDefinitionSampleData(definition: FormDefinition, _options?: MappingSampleOptions): Promise<Record<string, unknown>>`

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
- **encoding?**: `string`

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
- **(get) isDirty** (`boolean`): True when the project has unsaved mutations since the last markClean() or creation.

##### `markClean(): void`

Reset the dirty flag (call after saving/publishing).

##### `localeAt(code: string): LocaleState | undefined`

##### `activeLocaleCode(): string | undefined`

##### `fieldPaths(): string[]`

##### `itemPaths(): string[]`

##### `itemAt(path: string): FormItem | undefined`

##### `bindFor(path: string): Record<string, unknown> | undefined`

##### `variableNames(): string[]`

##### `instanceNames(): string[]`

##### `statistics(): ProjectStatistics & {

        isDirty: boolean;
    }`

##### `commandHistory(): readonly LogEntry[]`

##### `export(): ProjectBundle`

##### `diagnose(): Diagnostics`

##### `componentFor(fieldKey: string): Record<string, unknown> | undefined`

##### `pageStructure(): PageStructureView`

##### `searchItems(filter: ItemFilter): ItemSearchResult[]`

##### `parseFEL(expression: string, context?: FELParseContext): FELParseResult`

##### `traceFEL(expression: string, fields?: Record<string, unknown>): import("@formspec-org/engine/fel-runtime").FelTraceResult`

Evaluate a FEL expression and return a structured trace of evaluation steps.

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

##### `humanizeFELExpression(expression: string): {

        text: string;
        supported: boolean;
    }`

Convert a FEL expression to a human-readable English string.

##### `listWidgets(): WidgetInfo[]`

Returns all known widgets with their compatible data types.

##### `compatibleWidgets(dataType: string): string[]`

Returns widget names (component types) compatible with a given data type or alias.

##### `fieldTypeCatalog(): FieldTypeAliasRow[]`

Returns the field type alias table (all types the user can specify in addField).

##### `mergedFieldTypeCatalog(): FieldTypeCatalogEntry[]`

Built-in add-item palette rows plus registry `dataType` extensions from loaded registries.

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

##### `setItemExtension(path: string, extension: string, value: unknown): HelperResult`

Set or clear a custom extension payload on a definition item.

##### `setWidgetConstraints(path: string, values: Partial<NumericConstraintValues> | Partial<DateConstraintValues>): HelperResult`

Set widget constraint properties (min, max, step, minDate, maxDate) on a field.
Updates both the component tree node AND generates a corresponding bind constraint.
If the existing bind constraint is not widget-managed (custom FEL), it is preserved.
Pass empty values to clear individual constraints.

##### `getWidgetConstraints(path: string): WidgetConstraintState`

Read current widget constraint values for a field from its component node.
Returns the component-level min/max/step (or minDate/maxDate) and whether
the bind constraint is widget-managed or custom.

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

##### `setGroupDisplayMode(groupKey: string, mode: 'stack' | 'table'): HelperResult`

Set the display mode for a repeatable group — 'stack' (default) or 'table' (DataTable).

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

##### `addPage(title: string, description?: string, id?: string): HelperResult`

Add a page — creates a Page node in the component tree.

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

##### `setGroupRef(path: string, ref: string | null, keyPrefix?: string): HelperResult`

Set or clear the `$ref` for a group item.

##### `setComponentWhen(target: string, when: string | null): HelperResult`

Set a component-level visual condition (`when`) on a bound item or layout node.

##### `setComponentAccessibility(target: string, property: string, value: unknown): HelperResult`

Set a component accessibility override on a bound item or layout node.

##### `setLayoutNodeProp(target: string, property: string, value: unknown): HelperResult`

Set an arbitrary property on a component tree node (identified by `__node:<id>` or bind key).

##### `setNodeStyleProperty(ref: {

        nodeId?: string;
        bind?: string;
    }, property: string, value: string): void`

Set a single style property on a component tree node by NodeRef.
Uses `component.setNodeStyle`, which merges into the existing style map
without clobbering other keys.

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

##### `setLocaleString(key: string, value: string, localeId?: string): HelperResult`

Set a localized string for the selected or explicit locale.

##### `removeLocaleString(key: string, localeId?: string): HelperResult`

Remove a localized string for the selected or explicit locale.

##### `setLocaleMetadata(property: string, value: unknown, localeId?: string): HelperResult`

Update a locale metadata property such as name, title, or description.

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

##### `addMigration(fromVersion: string, description?: string): HelperResult`

Ensure a migration descriptor exists for a source version.

##### `addMigrationRule(params: {

        fromVersion: string;
        source: string;
        target: string | null;
        transform: string;
        expression?: string;
        insertIndex?: number;
    }): HelperResult`

Add a field-map rule to a migration descriptor.

##### `removeMigrationRule(fromVersion: string, index: number): HelperResult`

Remove a field-map rule from a migration descriptor.

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

##### `addComponentNode(parent: {

        bind?: string;
        nodeId?: string;
    }, component: string, options?: {
        bind?: string;
        props?: Record<string, unknown>;
        insertIndex?: number;
    }): HelperResult & {
        nodeRef?: {
            bind?: string;
            nodeId?: string;
        };
    }`

Add a component-tree node under an arbitrary parent ref.

##### `addLayoutNode(parentNodeId: string, component: string): HelperResult`

Add a layout-only node to the component tree.

##### `unwrapLayoutNode(nodeId: string): HelperResult`

Unwrap a layout container, promoting its children.

##### `deleteLayoutNode(nodeId: string): HelperResult`

Delete a layout node from the component tree.

##### `wrapComponentNode(ref: {

        bind: string;
    } | {
        nodeId: string;
    }, component: string): HelperResult`

Wrap a component node (by bind or nodeId ref) in any layout component.

##### `wrapSiblingComponentNodes(refs: Array<{

        bind: string;
    } | {
        nodeId: string;
    }>, component: string): HelperResult`

Wrap multiple sibling nodes in one layout container (same parent, visual order preserved).

##### `reorderComponentNode(ref: {

        bind?: string;
        nodeId?: string;
    }, direction: 'up' | 'down'): HelperResult`

Reorder a component node (by bind or nodeId ref) up or down.

##### `moveComponentNodeToContainer(ref: {

        bind?: string;
        nodeId?: string;
    }, targetParent: {
        bind?: string;
        nodeId?: string;
    }): HelperResult`

Move a component node (by bind or nodeId ref) as the last child of a target container.

##### `moveComponentNodeToIndex(ref: {

        bind?: string;
        nodeId?: string;
    }, targetParent: {
        bind?: string;
        nodeId?: string;
    }, insertIndex: number): HelperResult`

Move a component node (by bind or nodeId ref) to a specific index within a target container.

##### `deleteComponentNode(ref: {

        bind?: string;
        nodeId?: string;
    }): HelperResult`

Delete a component node by bind or nodeId ref.

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

        mappingId?: string;
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

Rename a definition variable and rewrite FEL references — **not implemented**.

Blocked on a `definition.renameVariable` (or equivalent) command in
`@formspec-org/core`; until that exists this helper always throws
{@link HelperError} with code `NOT_IMPLEMENTED`. See the studio README
“Known limitations” section for the product-facing note.

##### `addInstance(name: string, props: InstanceProps): HelperResult`

Add a named external data source.

##### `updateInstance(name: string, changes: Partial<InstanceProps>): HelperResult`

Update instance properties.

##### `renameInstance(name: string, newName: string): HelperResult`

Rename an instance — rewrites FEL references.

##### `removeInstance(name: string): HelperResult`

Remove an instance.

##### `createScreenerDocument(options?: {

        url?: string;
        title?: string;
    }): HelperResult`

Create a new screener document with a default first-match phase.

##### `deleteScreenerDocument(): HelperResult`

Remove the screener document.

##### `addScreenField(key: string, label: string, type: string, props?: FieldProps): HelperResult`

Add a screener question.

##### `removeScreenField(key: string): HelperResult`

Remove a screener question.

##### `updateScreenField(key: string, changes: {

        label?: string;
        helpText?: string;
        required?: boolean | string;
    }): HelperResult`

Update properties on a screener question.

##### `reorderScreenField(key: string, direction: 'up' | 'down'): HelperResult`

Reorder a screener question by key.

##### `addEvaluationPhase(id: string, strategy: string, label?: string): HelperResult`

Add an evaluation phase.

##### `removeEvaluationPhase(phaseId: string): HelperResult`

Remove an evaluation phase.

##### `reorderPhase(phaseId: string, direction: 'up' | 'down'): HelperResult`

Reorder an evaluation phase.

##### `setPhaseStrategy(phaseId: string, strategy: string, config?: Record<string, unknown>): HelperResult`

Set strategy and config on a phase.

##### `addScreenRoute(phaseId: string, route: {

        condition?: string;
        target: string;
        label?: string;
        message?: string;
        score?: string;
        threshold?: number;
    }, insertIndex?: number): HelperResult`

Add a route to a phase.

##### `updateScreenRoute(phaseId: string, routeIndex: number, changes: {

        condition?: string;
        target?: string;
        label?: string;
        message?: string;
        score?: string;
        threshold?: number;
        override?: boolean;
        terminal?: boolean;
    }): HelperResult`

Update properties on a route.

##### `reorderScreenRoute(phaseId: string, routeIndex: number, direction: 'up' | 'down'): HelperResult`

Reorder a route within a phase.

##### `removeScreenRoute(phaseId: string, routeIndex: number): HelperResult`

Remove a route from a phase.

##### `setScreenerAvailability(from?: string | null, until?: string | null): HelperResult`

Set screener availability window. Pass null to clear.

##### `setScreenerResultValidity(duration: string | null): HelperResult`

Set screener result validity duration. Pass null to clear.

##### `generateSampleData(overrides?: Record<string, unknown>): Record<string, unknown>`

Generate plausible sample data for each field based on its data type.
When overrides are provided, those values replace the generated defaults
for matching field paths. Override keys that don't match any field path
are silently ignored.

Fields hidden by show_when/relevant conditions are excluded from the
result. Relevance is evaluated by loading the sample data into a
FormEngine and reading its relevance signals.

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

##### `subscribe(listener: () => void): () => void`

Subscribe to changeset state changes.

##### `getChangeset(): Readonly<Changeset> | null`

Stable snapshot of the current changeset — same reference until state changes.

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

## `platformTokenRegistry: TokenRegistryMap`

The platform token registry, parsed once at module load.

## `pageChildren(page: CompNode): CompNode[]`

Direct children of a Page node in the component tree.

## `refForCompNode(node: CompNode): {

    bind: string;
} | {
    nodeId: string;
}`

NodeRef for a component node: prefers `bind` when it is a string, else `nodeId`.

## `findKeyInItems(items: FormItem[], leafKey: string, prefix: string): string | null`

Walk the item tree to find any item with the given leaf key. Returns its full path or null.

## `findComponentNodeById(tree: CompNode | undefined, nodeId: string): CompNode | null`

Depth-first search for a node by `nodeId`. Matches the root if it carries the id.
Returns `null` when no match is found (null-style matches the public surface).

## `findComponentNodeByRef(tree: CompNode | undefined, ref: NodeRef): CompNode | null`

Depth-first search for a node by `nodeId` OR `bind`. If both are given, a match on
either field is accepted (nodeId checked first). Returns `null` when no match.

## `treeContainsRef(tree: CompNode | undefined, ref: NodeRef): boolean`

True if any node in the subtree (including the root) matches `ref` by bind or nodeId.

## `findParentOfNodeRef(tree: CompNode | undefined, ref: NodeRef): CompNode | null | undefined`

Find the parent node of the node matching `ref`.

Tri-state return distinguishes three meaningful cases:

- A `CompNode` — the parent containing the match.
- `null` — the match IS the root (no parent exists).
- `undefined` — nothing matched.

## `findParentRefOfNodeRef(tree: CompNode | undefined, ref: NodeRef): {

    nodeId: string;
} | {
    bind: string;
} | null`

Parent expressed as a single-key ref — `{ nodeId }` when the parent has a stable id,
otherwise `{ bind }`. Returns `null` when the match IS the root, when nothing matches,
or when the parent has neither id nor bind.

#### interface `ProjectSnapshot`

Read-only snapshot of the project's authored artifacts.
This is what `project.state` returns — the four editable artifacts
without internal bookkeeping (extensions and versioning).

- **screener** (`ScreenerDocument | null`): Standalone Screener Document, or null if no screener is loaded.

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

## `widgetConstraintToFEL(spec: WidgetConstraintSpec): string | null`

## `felToWidgetConstraint(expr: string): WidgetConstraintSpec | null`

## `isWidgetManagedConstraint(expr: string): boolean`

## `getWidgetConstraintProps(component: string): WidgetConstraintProp[]`

#### interface `NumericConstraintValues`

@filedesc Bidirectional conversion between widget constraint properties and FEL bind constraint expressions.

- **min?**: `number | null`
- **max?**: `number | null`
- **step?**: `number | null`

#### interface `DateConstraintValues`

- **min?**: `string | null`
- **max?**: `string | null`

#### interface `WidgetConstraintState`

- **type**: `'numeric' | 'date' | 'none'`
- **numericValues**: `NumericConstraintValues`
- **dateValues**: `DateConstraintValues`
- **isManaged**: `boolean`
- **hasCustomConstraint**: `boolean`
- **component**: `string | null`

#### interface `WidgetConstraintSpec`

- **type**: `'numeric' | 'date'`
- **values**: `NumericConstraintValues | DateConstraintValues`
- **optional?**: `boolean`

#### interface `WidgetConstraintProp`

- **key**: `string`
- **type**: `'number' | 'date'`
- **label**: `string`
