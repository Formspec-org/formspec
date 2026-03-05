# form-builder — API Reference

*Auto-generated from TypeScript declarations — do not hand-edit.*

Formspec Studio v2 editor APIs. Includes project state model, atomic mutation helpers, diagnostics derivations, import/export flows, versioning utilities, extension registry cataloging, and command palette search helpers.

Studio command palette API.
Provides command registry construction and fuzzy search ranking helpers.

## `buildStudioCommands(project: Signal<ProjectState>): StudioCommand[]`

Builds command palette entries for the current project snapshot.

## `searchCommands(commands: StudioCommand[], query: string, limit?: number): CommandSearchResult[]`

Performs token-aware fuzzy search over command title/subtitle/category/keywords.
Returns results sorted by descending score.

#### interface `StudioCommand`

Command palette action descriptor.

- **id**: `string`
- **title**: `string`
- **subtitle?**: `string`
- **category**: `CommandCategory`
- **keywords?**: `string[]`
- **run**: `() => void`

#### interface `CommandSearchResult`

Ranked command match produced by `searchCommands`.

- **command**: `StudioCommand`
- **score**: `number`

#### type `CommandCategory`

Command palette grouping used for sorting and display.

```ts
type CommandCategory = 'Navigation' | 'Actions' | 'Advanced';
```

Formspec Studio public API.
Exposes state, mutation, diagnostics, command, versioning, import/export, and extension helpers.

Studio derived signals and diagnostics.
Combines schema validation, FormEngine diagnostics, and variable dependency analysis.

## `createDerivedSignals(project?: Signal<ProjectState>): ProjectDerivedSignals`

Builds all computed Studio signals from a project signal.
Re-computes structural + engine diagnostics whenever project artifacts change.

## `deriveVariableDependencies(definition: FormspecDefinition): VariableDependencyEntry[]`

Builds variable dependency metadata used by the Variables inspector panel.

## `derivedSignals: ProjectDerivedSignals`

Shared singleton derived signal graph for the default project signal.

#### interface `DiagnosticNavigation`

Navigation hint used by diagnostics UI to focus relevant editor state.

- **selectionPath**: `string | null`
- **inspectorSection?**: `string`

#### interface `DiagnosticEntry`

Normalized diagnostic entry emitted by structural and engine validators.

- **id**: `string`
- **layer**: `'ajv' | 'engine'`
- **severity**: `DiagnosticSeverity`
- **source**: `string`
- **path**: `string`
- **message**: `string`
- **code?**: `string`
- **navigation?**: `DiagnosticNavigation`

#### interface `StructuralError`

Single AJV structural validation error entry.

- **path**: `string`
- **message**: `string`
- **navigation?**: `DiagnosticNavigation`

#### interface `StructuralDocumentDiagnostics`

Structural validation result for one artifact document.

- **valid**: `boolean`
- **errors**: `StructuralError[]`

#### interface `StructuralDiagnostics`

Structural diagnostics grouped by Studio artifact.

- **definition**: `StructuralDocumentDiagnostics`
- **component**: `StructuralDocumentDiagnostics`
- **theme**: `StructuralDocumentDiagnostics`
- **mapping**: `StructuralDocumentDiagnostics`

#### interface `EngineState`

Current FormEngine instance state used by diagnostics and preview.

- **engine**: `FormEngine | null`
- **error**: `string | null`
- **snapshot**: `FormEngineDiagnosticsSnapshot | null`

#### interface `CombinedDiagnostics`

Merged diagnostics payload consumed by the diagnostics panel.

- **counts**: `Record<DiagnosticSeverity, number>`
- **entries**: `DiagnosticEntry[]`
- **structural**: `StructuralDiagnostics`
- **engine**: `EngineState`

#### interface `ProjectDerivedSignals`

Public derived signals computed from the project signal.

- **fieldPaths**: `ReadonlySignal<string[]>`
- **variableDependencies**: `ReadonlySignal<VariableDependencyEntry[]>`
- **structuralDiagnostics**: `ReadonlySignal<StructuralDiagnostics>`
- **engineState**: `ReadonlySignal<EngineState>`
- **diagnostics**: `ReadonlySignal<CombinedDiagnostics>`

#### interface `VariableDependencyUsage`

One location that references a variable.

- **id**: `string`
- **kind**: `'variable' | 'bind' | 'item' | 'shape'`
- **label**: `string`
- **path**: `string | null`
- **property**: `string`

#### interface `VariableDependencyEntry`

Dependency graph node for a project variable.

- **index**: `number`
- **name**: `string`
- **scope**: `string`
- **expression**: `string`
- **dependsOnFields**: `string[]`
- **dependsOnVariables**: `string[]`
- **usedBy**: `VariableDependencyUsage[]`

#### type `DiagnosticSeverity`

Normalized severity level used across diagnostics layers.

```ts
type DiagnosticSeverity = 'error' | 'warning' | 'info';
```

## `parseExtensionRegistryDocument(payload: unknown): ExtensionRegistryDocument`

Validates and parses a registry payload using the registry JSON schema.

## `createLoadedExtensionRegistry(payload: unknown, sourceType: LoadedExtensionRegistry['sourceType'], sourceLabel: string): LoadedExtensionRegistry`

Creates a registry state entry with normalized source metadata and timestamp.

## `buildRegistryId(sourceType: LoadedExtensionRegistry['sourceType'], sourceLabel: string, document: ExtensionRegistryDocument): string`

Builds a deterministic registry id from source metadata and publish date.

## `buildExtensionCatalog(registries: LoadedExtensionRegistry[]): ExtensionCatalog`

Merges registry entries into an effective catalog.
For each `{category,name}` pair, the highest semver entry wins.

## `resolveEntryLabel(entry: Pick<ExtensionRegistryEntry, 'name' | 'metadata'>): string`

Resolves the display label for an extension entry.

#### interface `ExtensionCatalogDataType`

Catalog projection for custom data types.

- **name**: `string`
- **label**: `string`
- **version**: `string`
- **status**: `ExtensionEntryStatus`
- **description**: `string`
- **baseType**: `string`
- **constraints?**: `Record<string, unknown>`
- **metadata?**: `Record<string, unknown>`
- **registryId**: `string`

#### interface `ExtensionCatalogFunction`

Catalog projection for custom FEL functions.

- **name**: `string`
- **felName**: `string`
- **label**: `string`
- **version**: `string`
- **status**: `ExtensionEntryStatus`
- **description**: `string`
- **returns?**: `string`
- **parameters**: `Array<{
        name: string;
        type: string;
    }>`
- **signature**: `string`
- **registryId**: `string`

#### interface `ExtensionCatalogConstraint`

Catalog projection for custom FEL constraints.

- **name**: `string`
- **felName**: `string`
- **label**: `string`
- **version**: `string`
- **status**: `ExtensionEntryStatus`
- **description**: `string`
- **parameters**: `Array<{
        name: string;
        type: string;
    }>`
- **invocation**: `string`
- **registryId**: `string`

#### interface `ExtensionCatalog`

Effective extension catalog surfaced to Studio pickers and autocomplete.

- **dataTypes**: `ExtensionCatalogDataType[]`
- **functions**: `ExtensionCatalogFunction[]`
- **constraints**: `ExtensionCatalogConstraint[]`

## `resolveDefaultFieldWidget(dataType: FormspecItem['dataType'] | undefined): string`

## `getSupportedFieldWidgets(dataType: FormspecItem['dataType'] | undefined): string[]`

## `resolveFieldWidgetSelection(dataType: FormspecItem['dataType'] | undefined, widget: string): string`

## `getFieldWidgetOptions(dataType: FormspecItem['dataType'] | undefined, currentWidget?: string): FieldWidgetOption[]`

#### interface `FieldWidgetOption`

- **value**: `string`
- **label**: `string`

Studio import/export helpers.
Handles bundle/template serialization and resilient payload import parsing.

## `buildStudioBundleDocument(state: ProjectState, exportedAt?: string): StudioBundleDocument`

Builds a bundle document from the current project state.

## `buildStudioTemplateDocument(state: ProjectState, input: {
    name: string;
    description?: string;
    createdAt?: string;
}): StudioTemplateDocument`

Builds a named template document from the current project state.

## `parseImportedProjectPayload(payload: unknown): ImportedProjectPayload`

Parses supported import payloads:
bundle/template wrappers, raw artifact documents, or mixed artifact objects.

## `buildProjectStateFromImport(current: ProjectState, imported: ImportedProjectPayload): ProjectState`

Applies imported artifacts to current project state.
Companion artifacts are regenerated when importing a bare definition.

## `STUDIO_BUNDLE_VERSION`

Current Studio bundle export format version.

## `STUDIO_TEMPLATE_VERSION`

Current Studio template export format version.

#### interface `StudioArtifactsSnapshot`

Snapshot of Studio-managed artifacts.

- **definition**: `FormspecDefinition`
- **component**: `FormspecComponentDocument`
- **theme**: `FormspecThemeDocument`
- **mapping**: `FormspecMappingDocument`

#### interface `StudioBundleDocument`

Full export bundle including artifacts and optional editor metadata.

- **$formspecStudioBundle**: `typeof STUDIO_BUNDLE_VERSION`
- **exportedAt**: `string`
- **artifacts**: `StudioArtifactsSnapshot`
- **extensions?**: `ProjectExtensionsState`
- **versioning?**: `ProjectVersioningState`

#### interface `StudioTemplateDocument`

Reusable template export used for quick-start authoring flows.

- **$formspecStudioTemplate**: `typeof STUDIO_TEMPLATE_VERSION`
- **name**: `string`
- **description?**: `string`
- **createdAt**: `string`
- **artifacts**: `StudioArtifactsSnapshot`

#### interface `ImportedProjectPayload`

Parsed import payload normalized to Studio's internal import contract.

- **kind**: `ImportedPayloadKind`
- **artifacts**: `Partial<StudioArtifactsSnapshot>`
- **templateName?**: `string`
- **extensions?**: `ProjectExtensionsState`
- **versioning?**: `ProjectVersioningState`

#### type `ImportedPayloadKind`

Normalized import payload kind recognized by Studio.

```ts
type ImportedPayloadKind = 'bundle' | 'template' | 'definition' | 'component' | 'theme' | 'mapping';
```

Studio project mutations.
Each exported function applies an atomic update to `ProjectState` and keeps artifacts synchronized.

## `addItem(project: Signal<ProjectState> | undefined, input: AddItemInput): string`

Adds an item to the definition tree, selects it, and rebuilds the component tree.

## `deleteItem(project: Signal<ProjectState> | undefined, path: string): void`

Deletes an item subtree and removes dependent binds/shapes/variables/theme item entries.

## `renameItem(project: Signal<ProjectState> | undefined, path: string, newKey: string): string`

Renames an item key and rewrites all affected path references across project artifacts.

## `moveItem(project: Signal<ProjectState> | undefined, fromPath: string, target: MoveItemTarget | string): string`

Moves an item to a new parent/index and rewrites downstream path references when needed.

## `setBind(project: Signal<ProjectState> | undefined, path: string, property: BindProperty, value: FormspecBind[BindProperty] | null | undefined): void`

Sets or clears a bind property for a path and garbage-collects empty binds.

## `setPresentation(project: Signal<ProjectState> | undefined, path: string, block: Record<string, unknown> | null, target?: 'theme' | 'definition'): void`

Sets presentation overrides on either the definition item or theme item map.

## `setFormTitle(project: Signal<ProjectState> | undefined, title: string): void`

Sets the form title, falling back to `Untitled Form` when empty.

## `setSelection(project: Signal<ProjectState> | undefined, path: string | null): void`

Updates current selection path used by the surface and inspector.

## `setInspectorSectionOpen(project: Signal<ProjectState> | undefined, sectionKey: string, open: boolean): void`

Toggles persisted inspector section expansion state.

## `setItemText(project: Signal<ProjectState> | undefined, path: string, property: 'label' | 'description' | 'hint', value: string): void`

Sets label/description/hint text on an item with normalization rules.

## `setFieldOptions(project: Signal<ProjectState> | undefined, path: string, options: Array<{
    value: string;
    label: string;
}>): void`

Replaces normalized options for choice and multi-choice fields.

## `setItemProperty(project: Signal<ProjectState> | undefined, path: string, property: string, value: unknown): void`

Sets or clears an arbitrary item property.

## `setItemExtension(project: Signal<ProjectState> | undefined, path: string, extensionName: string, value: unknown): void`

Sets or clears an `x-*` extension entry on a definition item.

## `setDefinitionProperty(project: Signal<ProjectState> | undefined, property: string, value: unknown): void`

Sets or clears a top-level definition property.

## `setJsonDocument(project: Signal<ProjectState> | undefined, artifact: JsonArtifactKey, value: unknown): void`

Applies a full artifact document update from the JSON editor.

## `importArtifacts(project: Signal<ProjectState> | undefined, input: ImportArtifactsInput): ImportArtifactsResult`

Parses import payload and applies resulting artifacts to project state.

## `publishVersion(project?: Signal<ProjectState>, input?: PublishVersionInput): FormspecChangelogDocument`

Creates changelog/release metadata, bumps version, and resets versioning baseline.

## `loadExtensionRegistry(project: Signal<ProjectState> | undefined, input: LoadExtensionRegistryInput): string`

Validates and appends an extension registry to project state.

## `importSubform(project: Signal<ProjectState> | undefined, input: ImportSubformInput): string`

Imports a group fragment and inserts it into the definition/component tree.

## `removeExtensionRegistry(project: Signal<ProjectState> | undefined, registryId: string): void`

Removes a loaded extension registry by id.

## `setFormPresentationProperty(project: Signal<ProjectState> | undefined, property: string, value: unknown): void`

Sets or clears a `formPresentation` property on the definition.

## `addVariable(project?: Signal<ProjectState>, input?: AddVariableInput): number`

Appends a new variable entry and returns its index.

## `setVariableName(project: Signal<ProjectState> | undefined, variableIndex: number, name: string): void`

Sets variable name at index.

## `setVariableExpression(project: Signal<ProjectState> | undefined, variableIndex: number, expression: string): void`

Sets variable FEL expression at index.

## `setVariableScope(project: Signal<ProjectState> | undefined, variableIndex: number, scope: string): void`

Sets variable scope path (`#` for global) at index.

## `deleteVariable(project: Signal<ProjectState> | undefined, variableIndex: number): void`

Deletes a variable entry by index.

## `setMappingProperty(project: Signal<ProjectState> | undefined, property: MappingProperty, value: unknown): void`

Sets or clears a top-level mapping document property.

## `setMappingTargetSchemaProperty(project: Signal<ProjectState> | undefined, property: MappingTargetSchemaProperty, value: unknown): void`

Sets or clears a mapping target-schema property.

## `addMappingRule(project?: Signal<ProjectState>, input?: AddMappingRuleInput): number`

Appends a mapping rule with defaults and returns its index.

## `setMappingRuleProperty(project: Signal<ProjectState> | undefined, ruleIndex: number, property: MappingRuleProperty, value: unknown): void`

Sets or clears a property on a mapping rule row.

## `deleteMappingRule(project: Signal<ProjectState> | undefined, ruleIndex: number): void`

Deletes a mapping rule and ensures at least one default rule remains.

## `setThemeToken(project: Signal<ProjectState> | undefined, tokenKey: string, value: string | number | null | undefined): void`

Sets or clears a theme design token value.

## `addThemeSelector(project?: Signal<ProjectState>, input?: Partial<ThemeSelectorRule>): number`

Adds a theme selector rule and returns its index.

## `setThemeSelectorMatchProperty(project: Signal<ProjectState> | undefined, selectorIndex: number, property: ThemeSelectorMatchProperty, value: string | null | undefined): void`

Sets selector match criteria with validation against allowed type values.

## `setThemeSelectorApplyProperty(project: Signal<ProjectState> | undefined, selectorIndex: number, property: string, value: unknown): void`

Sets or clears a selector `apply` presentation property.

## `deleteThemeSelector(project: Signal<ProjectState> | undefined, selectorIndex: number): void`

Deletes a theme selector rule by index.

## `setThemeBreakpoint(project: Signal<ProjectState> | undefined, breakpointName: string, minWidth: number | null | undefined): void`

Sets or removes a theme breakpoint and recomputes active breakpoint.

## `setPreviewWidth(project: Signal<ProjectState> | undefined, width: number): void`

Sets preview width and recomputes active breakpoint.

## `setActiveBreakpoint(project: Signal<ProjectState> | undefined, breakpointName: string): void`

Sets active breakpoint when it exists in theme breakpoints.

## `setJsonEditorOpen(project: Signal<ProjectState> | undefined, open: boolean, tab?: JsonArtifactKey): void`

Opens or closes the JSON editor and optionally switches tabs.

## `toggleJsonEditor(project?: Signal<ProjectState>, tab?: JsonArtifactKey): void`

Toggles JSON editor visibility and optionally switches tabs.

## `setJsonEditorTab(project: Signal<ProjectState> | undefined, tab: JsonArtifactKey): void`

Sets active JSON editor artifact tab.

## `setComponentResponsiveOverride(project: Signal<ProjectState> | undefined, path: string, breakpointName: string, patch: ResponsiveOverridePatch): void`

Applies responsive override patch to a component node at a breakpoint.

## `setFieldWidgetComponent(project: Signal<ProjectState> | undefined, path: string, widget: string): void`

Sets the rendered widget component for a field item.

## `setGroupDisplayMode(project: Signal<ProjectState> | undefined, path: string, mode: GroupDisplayMode): void`

Switches a repeating group between stack and data-table component modes.

## `setGroupDataTableConfig(project: Signal<ProjectState> | undefined, path: string, patch: GroupDataTablePatch): void`

Applies data-table configuration on a repeating group component node.

## `addShape(project?: Signal<ProjectState>, input?: AddShapeInput): string`

Adds a new shape rule and returns its generated id.

## `setShapeProperty(project: Signal<ProjectState> | undefined, shapeId: string, property: ShapeProperty, value: FormspecShape[ShapeProperty] | null | undefined): void`

Sets or clears a shape property while preserving composition invariants.

## `renameShapeId(project: Signal<ProjectState> | undefined, currentShapeId: string, nextNameOrId: string): string`

Renames a shape id and rewrites references in all shape compositions.

## `deleteShape(project: Signal<ProjectState> | undefined, shapeId: string): void`

Deletes a shape and removes references to it from remaining compositions.

## `setShapeComposition(project: Signal<ProjectState> | undefined, shapeId: string, mode: ShapeCompositionMode, entries: string[]): void`

Sets shape composition mode (`and`/`or`/`xone`/`not`) entries.

## `toggleStructurePanel(project?: Signal<ProjectState>): void`

Toggles left structure panel visibility.

## `toggleDiagnosticsOpen(project?: Signal<ProjectState>): void`

Toggles diagnostics panel visibility.

## `setMobilePanel(project: Signal<ProjectState> | undefined, panel: ProjectState['uiState']['mobilePanel']): void`

Sets active mobile panel, toggling off when selecting the same panel.

## `togglePreviewMode(project?: Signal<ProjectState>): void`

Cycles view mode between edit, split, and preview.

#### interface `AddItemInput`

Input contract for inserting an item into the definition tree.

- **type**: `'field' | 'group' | 'display'`
- **dataType?**: `FormspecItem['dataType']`
- **key?**: `string`
- **label?**: `string`
- **parentPath?**: `string | null`
- **index?**: `number`

#### interface `MoveItemTarget`

Target position for `moveItem`.

- **parentPath**: `string | null`
- **index?**: `number`

#### interface `AddVariableInput`

Input contract for creating a variable definition entry.

- **name?**: `string`
- **expression?**: `string`
- **scope?**: `string`

#### interface `AddMappingRuleInput`

Input contract for creating a mapping rule row.

- **sourcePath?**: `string`
- **targetPath?**: `string | null`
- **transform?**: `MappingTransformType`

#### interface `LoadExtensionRegistryInput`

Input payload for loading a registry into extension state.

- **payload**: `unknown`
- **sourceType**: `LoadedExtensionRegistry['sourceType']`
- **sourceLabel**: `string`

#### interface `PublishVersionInput`

Options used by the publish flow when generating changelog + version bump.

- **bump?**: `SemverImpact`
- **summary?**: `string`
- **generatedAt?**: `string`

#### interface `ImportSubformInput`

Input payload for sub-form import and insertion behavior.

- **payload**: `unknown`
- **parentPath?**: `string | null`
- **index?**: `number`
- **groupKey?**: `string`
- **groupLabel?**: `string`
- **keyPrefix?**: `string`
- **fragment?**: `string`
- **sourceLabel?**: `string`

#### interface `ImportArtifactsInput`

Input payload accepted by artifact import mutations.

- **payload**: `unknown`

#### interface `ImportArtifactsResult`

Normalized result metadata from `importArtifacts`.

- **kind**: `ImportedPayloadKind`
- **templateName?**: `string`

#### interface `ResponsiveOverridePatch`

Patch object for responsive override editing.

- **span?**: `number | null`
- **start?**: `number | null`
- **hidden?**: `boolean | null`

#### interface `GroupDataTableColumn`

Data table column configuration for repeating-group table mode.

- **bind**: `string`
- **header**: `string`
- **min?**: `number`
- **max?**: `number`
- **step?**: `number`

#### interface `GroupDataTablePatch`

Patch object for group data table settings.

- **columns?**: `GroupDataTableColumn[] | null`
- **showRowNumbers?**: `boolean | null`
- **allowAdd?**: `boolean | null`
- **allowRemove?**: `boolean | null`
- **sortable?**: `boolean | null`
- **filterable?**: `boolean | null`
- **sortBy?**: `string | null`
- **sortDirection?**: `'asc' | 'desc' | null`

#### interface `AddShapeInput`

Input contract for creating a shape rule.

- **name?**: `string`
- **id?**: `string`
- **target?**: `string`
- **message?**: `string`
- **constraint?**: `string`
- **severity?**: `FormspecShape['severity']`

#### type `BindProperty`

Mutable bind keys supported by `setBind`.

```ts
type BindProperty = Exclude<keyof FormspecBind, 'path'>;
```

#### type `JsonArtifactKey`

Artifact tab identifier used by JSON editor mutations.

```ts
type JsonArtifactKey = ProjectState['uiState']['jsonEditorTab'];
```

#### type `MappingProperty`

Top-level mapping properties editable by `setMappingProperty`.

```ts
type MappingProperty = 'version' | 'definitionVersion' | 'direction' | 'conformanceLevel' | 'autoMap';
```

#### type `MappingTargetSchemaProperty`

Target schema key editable by `setMappingTargetSchemaProperty`.

```ts
type MappingTargetSchemaProperty = keyof FormspecMappingDocument['targetSchema'];
```

#### type `MappingRuleProperty`

Mapping rule key editable by `setMappingRuleProperty`.

```ts
type MappingRuleProperty = keyof MappingRule;
```

#### type `ThemeSelectorMatchProperty`

Selector match fields editable in theme selector rules.

```ts
type ThemeSelectorMatchProperty = keyof ThemeSelectorMatch;
```

#### type `GroupDisplayMode`

Supported group renderer display modes.

```ts
type GroupDisplayMode = 'stack' | 'table';
```

#### type `ShapeProperty`

Mutable shape keys accepted by `setShapeProperty`.

```ts
type ShapeProperty = Exclude<keyof FormspecShape, 'id'>;
```

#### type `ShapeCompositionMode`

Shape composition mode used by `setShapeComposition`.

```ts
type ShapeCompositionMode = 'none' | 'and' | 'or' | 'xone' | 'not';
```

Studio project state model and initializers.
Defines the canonical in-memory shape used by the editor.

## `createInitialDefinition(overrides?: Partial<FormspecDefinition>): FormspecDefinition`

Creates a valid baseline Formspec definition for a new Studio project.

## `createInitialComponent(definition: FormspecDefinition): FormspecComponentDocument`

Creates the default component artifact synchronized to a definition.

## `createInitialTheme(definition: FormspecDefinition): FormspecThemeDocument`

Creates the default theme artifact synchronized to a definition.

## `createInitialMapping(definition: FormspecDefinition): FormspecMappingDocument`

Creates the default mapping artifact synchronized to a definition.

## `createInitialVersioningState(definition: FormspecDefinition): ProjectVersioningState`

Initializes versioning state with the definition as baseline and no releases.

## `createInitialProjectState(seed?: Partial<ProjectState>): ProjectState`

Builds a normalized, self-consistent project state.
Repairs companion artifacts (component/theme/mapping/versioning) when partially seeded.

## `createProjectSignal(initialState?: ProjectState): Signal<ProjectState>`

Creates a writable project signal from an initial project state.

## `normalizeBreakpoints(breakpoints: Record<string, unknown> | undefined, fallback?: Record<string, number>): Record<string, number>`

Normalizes breakpoint input into a compact `{ name: minWidth }` map.

## `resolveActiveBreakpointName(breakpoints: Record<string, number>, previewWidth: number): string`

Resolves the active breakpoint name for a preview width.

## `getSortedBreakpointEntries(breakpoints: Record<string, number>): Array<[string, number]>`

Returns breakpoint entries sorted by ascending min width.

## `clampPreviewWidth(value: number): number`

Clamps preview width to the supported Studio viewport range.

## `DEFAULT_THEME_BREAKPOINTS: Record<string, number>`

Default breakpoint map used for preview and responsive editors.

## `DEFAULT_PREVIEW_WIDTH`

Default preview width used on project initialization.

## `projectSignal: Signal<ProjectState>`

Shared singleton project signal used by the Studio runtime.

#### interface `FormspecComponentDocument`

Component artifact persisted by Studio.

- **$formspecComponent**: `'1.0'`
- **version**: `string`
- **targetDefinition**: `{
        url: string;
        compatibleVersions?: string;
    }`
- **breakpoints?**: `Record<string, number>`
- **tree**: `GeneratedComponentNode`
- **name?**: `string`
- **title?**: `string`
- **description?**: `string`

#### interface `ThemeSelectorMatch`

Rule matcher used by theme selector rules.

- **type?**: `ThemeSelectorType`
- **dataType?**: `ThemeSelectorDataType`

#### interface `ThemeSelectorRule`

Theme selector rule that applies a presentation block when matched.

- **match**: `ThemeSelectorMatch`
- **apply**: `Record<string, unknown>`

#### interface `FormspecThemeDocument`

Theme artifact persisted by Studio.

- **$formspecTheme**: `'1.0'`
- **version**: `string`
- **targetDefinition**: `{
        url: string;
        compatibleVersions?: string;
    }`
- **breakpoints?**: `Record<string, number>`
- **tokens?**: `Record<string, string | number>`
- **selectors?**: `ThemeSelectorRule[]`
- **items?**: `Record<string, Record<string, unknown>>`
- **name?**: `string`
- **title?**: `string`
- **description?**: `string`

#### interface `MappingTargetSchema`

Target schema metadata used by mapping rules.

- **format**: `string`
- **name?**: `string`
- **url?**: `string`
- **rootElement?**: `string`
- **namespaces?**: `Record<string, string>`

#### interface `MappingRule`

Single mapping rule row in the mapping document.

- **sourcePath?**: `string`
- **targetPath?**: `string | null`
- **transform**: `MappingTransformType`
- **expression?**: `string`
- **coerce?**: `string | Record<string, unknown>`
- **valueMap?**: `Record<string, unknown>`
- **reverse?**: `Record<string, unknown>`
- **bidirectional?**: `boolean`
- **condition?**: `string`
- **default?**: `unknown`
- **separator?**: `string`
- **description?**: `string`
- **priority?**: `number`
- **reversePriority?**: `number`

#### interface `FormspecMappingDocument`

Mapping artifact persisted by Studio.

- **$schema?**: `string`
- **version**: `string`
- **definitionRef**: `string`
- **definitionVersion**: `string`
- **targetSchema**: `MappingTargetSchema`
- **direction?**: `MappingDirection`
- **defaults?**: `Record<string, unknown>`
- **autoMap?**: `boolean`
- **conformanceLevel?**: `MappingConformanceLevel`
- **rules**: `MappingRule[]`
- **adapters?**: `Record<string, unknown>`

#### interface `ExtensionPublisher`

Registry publisher metadata.

- **name**: `string`
- **url**: `string`
- **contact?**: `string`

#### interface `ExtensionEntryCompatibility`

Compatibility constraints for a registry entry.

- **formspecVersion**: `string`
- **mappingDslVersion?**: `string`

#### interface `ExtensionEntryParameter`

Signature metadata for extension functions and constraints.

- **name**: `string`
- **type**: `string`
- **description?**: `string`

#### interface `ExtensionRegistryEntry`

Single extension entry exposed by a registry document.

- **name**: `string`
- **category**: `ExtensionEntryCategory`
- **version**: `string`
- **status**: `ExtensionEntryStatus`
- **description**: `string`
- **compatibility**: `ExtensionEntryCompatibility`
- **publisher?**: `ExtensionPublisher`
- **specUrl?**: `string`
- **schemaUrl?**: `string`
- **license?**: `string`
- **deprecationNotice?**: `string`
- **examples?**: `unknown[]`
- **extensions?**: `Record<string, unknown>`
- **baseType?**: `string`
- **constraints?**: `Record<string, unknown>`
- **metadata?**: `Record<string, unknown>`
- **parameters?**: `ExtensionEntryParameter[]`
- **returns?**: `string`
- **members?**: `string[]`

#### interface `ExtensionRegistryDocument`

Registry document loaded by Studio.

- **$formspecRegistry**: `string`
- **$schema?**: `string`
- **publisher**: `ExtensionPublisher`
- **published**: `string`
- **entries**: `ExtensionRegistryEntry[]`
- **extensions?**: `Record<string, unknown>`

#### interface `LoadedExtensionRegistry`

A registry plus source metadata tracked by Studio state.

- **id**: `string`
- **sourceType**: `'url' | 'file' | 'inline'`
- **sourceLabel**: `string`
- **loadedAt**: `string`
- **document**: `ExtensionRegistryDocument`

#### interface `ProjectExtensionsState`

Extension subsystem state.

- **registries**: `LoadedExtensionRegistry[]`

#### interface `VersionRelease`

Published release snapshot recorded by the Studio versioning flow.

- **version**: `string`
- **publishedAt**: `string`
- **changelog**: `FormspecChangelogDocument`

#### interface `ProjectVersioningState`

Versioning subsystem state.

- **baselineDefinition**: `FormspecDefinition`
- **releases**: `VersionRelease[]`

#### interface `ProjectUIState`

Editor-only UI state persisted alongside artifacts.

- **inspectorSections**: `Record<string, boolean>`
- **viewMode**: `'edit' | 'preview' | 'split'`
- **structurePanelOpen**: `boolean`
- **diagnosticsOpen**: `boolean`
- **mobilePanel**: `'none' | 'structure' | 'inspector'`
- **previewWidth**: `number`
- **activeBreakpoint**: `string`
- **jsonEditorOpen**: `boolean`
- **jsonEditorTab**: `'definition' | 'component' | 'theme'`

#### interface `ProjectState`

Top-level Studio project state.

- **definition**: `FormspecDefinition`
- **component**: `FormspecComponentDocument`
- **theme**: `FormspecThemeDocument`
- **mapping**: `FormspecMappingDocument`
- **extensions**: `ProjectExtensionsState`
- **versioning**: `ProjectVersioningState`
- **selection**: `string | null`
- **uiState**: `ProjectUIState`

#### type `ThemeSelectorType`

Supported selector `type` values for theme selector rules.

```ts
type ThemeSelectorType = FormspecItem['type'];
```

#### type `ThemeSelectorDataType`

Supported selector `dataType` values for theme selector rules.

```ts
type ThemeSelectorDataType = Exclude<FormspecItem['dataType'], undefined>;
```

#### type `MappingDirection`

Direction support for mapping execution.

```ts
type MappingDirection = 'forward' | 'reverse' | 'both';
```

#### type `MappingConformanceLevel`

Feature-level conformance class for a mapping document.

```ts
type MappingConformanceLevel = 'core' | 'bidirectional' | 'extended';
```

#### type `MappingTransformType`

Supported mapping transformation operators.

```ts
type MappingTransformType = 'preserve' | 'drop' | 'expression' | 'coerce' | 'valueMap' | 'flatten' | 'nest' | 'constant' | 'concat' | 'split';
```

#### type `ExtensionEntryCategory`

Registry entry category recognized by Studio extension tooling.

```ts
type ExtensionEntryCategory = 'dataType' | 'function' | 'constraint' | 'property' | 'namespace';
```

#### type `ExtensionEntryStatus`

Lifecycle status for extension registry entries.

```ts
type ExtensionEntryStatus = 'draft' | 'stable' | 'deprecated' | 'retired';
```

## `generateDefinitionChangelog(oldDefinition: FormspecDefinition, newDefinition: FormspecDefinition, definitionUrl: string, options?: GenerateChangelogOptions): FormspecChangelogDocument`

Generates a changelog by diffing two definitions.
Emits item/bind/shape/metadata changes plus computed semver impact.

## `validateGeneratedChangelog(document: FormspecChangelogDocument): ChangelogValidationResult`

Validates a generated changelog against the changelog schema.

## `bumpSemverVersion(version: string, impact: SemverImpact): string`

Applies a major/minor/patch bump to a semver string.

#### interface `ChangelogChange`

One normalized changelog diff entry.

- **type**: `ChangelogChangeType`
- **target**: `ChangelogTarget`
- **path**: `string`
- **impact**: `ChangelogImpact`
- **key?**: `string`
- **description?**: `string`
- **before?**: `unknown`
- **after?**: `unknown`
- **migrationHint?**: `string`

#### interface `FormspecChangelogDocument`

Changelog document produced by Studio publish flow.

- **$schema?**: `string`
- **definitionUrl**: `string`
- **fromVersion**: `string`
- **toVersion**: `string`
- **generatedAt**: `string`
- **semverImpact**: `SemverImpact`
- **summary?**: `string`
- **changes**: `ChangelogChange[]`

#### interface `GenerateChangelogOptions`

Optional metadata for generated changelog documents.

- **generatedAt?**: `string`
- **summary?**: `string`

#### interface `ChangelogValidationResult`

Schema validation result for a generated changelog document.

- **valid**: `boolean`
- **errors**: `string[]`

#### type `ChangelogChangeType`

Change action type captured in changelog entries.

```ts
type ChangelogChangeType = 'added' | 'removed' | 'modified' | 'moved' | 'renamed';
```

#### type `ChangelogTarget`

Artifact target kind affected by a changelog entry.

```ts
type ChangelogTarget = 'item' | 'bind' | 'shape' | 'optionSet' | 'dataSource' | 'screener' | 'migration' | 'metadata';
```

#### type `ChangelogImpact`

Compatibility impact classification for a change entry.

```ts
type ChangelogImpact = 'breaking' | 'compatible' | 'cosmetic';
```

#### type `SemverImpact`

Supported semantic version bump classes.

```ts
type SemverImpact = 'major' | 'minor' | 'patch';
```

Studio definition wiring helpers.
Keeps definition paths, expressions, and component nodes aligned during edits.

## `toPathSegments(path: string | null | undefined): string[]`

Splits a dotted bind path into segments.

## `joinPath(parts: Array<string | null | undefined>): string`

Joins path parts with `.` while skipping empty values.

## `getParentPath(path: string): string | null`

Returns the parent path for a bind path or `null` at the root.

## `getLeafKey(path: string): string`

Returns the final key segment for a bind path.

## `rewritePathByMap(path: string, rewriteMap: PathRewriteMap): string`

Rewrites a path using an old->new map.
Matches exact path, dotted descendants, and repeat-index descendants.

## `rebuildComponentTreeFromDefinition(definition: FormspecDefinition): GeneratedComponentNode`

Rebuilds the full component tree directly from definition items.

## `buildComponentNodesForItems(items: FormspecItem[], parentPath?: string): GeneratedComponentNode[]`

Builds component nodes for a sibling item array under `parentPath`.

## `collectFieldPaths(items: FormspecItem[], parentPath?: string): string[]`

Collects every field path in depth-first order.

## `rewriteDefinitionPathReferences(definition: FormspecDefinition, rewriteMap: PathRewriteMap): FormspecDefinition`

Rewrites all known path references in a definition clone.
Includes binds, shapes, variables, item expressions, and message templates.

## `rewriteFelPaths(expression: string, rewriteMap: PathRewriteMap): string`

Rewrites FEL field-path references in an expression string.
String literals are preserved and never rewritten.

#### interface `GeneratedComponentNode`

Minimal component node shape generated from definition items.

- **component**: `string`
- **bind?**: `string`
- **text?**: `string`
- **responsive?**: `Record<string, Record<string, unknown>>`
- **columns?**: `Array<{
        header: string;
        bind: string;
        min?: number;
        max?: number;
        step?: number;
    }>`
- **showRowNumbers?**: `boolean`
- **allowAdd?**: `boolean`
- **allowRemove?**: `boolean`
- **sortable?**: `boolean`
- **filterable?**: `boolean`
- **sortBy?**: `string`
- **sortDirection?**: `'asc' | 'desc'`
- **children?**: `GeneratedComponentNode[]`

#### type `PathRewriteMap`

Path rewrite map where keys are old paths and values are rewritten paths.

```ts
type PathRewriteMap = Record<string, string>;
```

