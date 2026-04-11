# Studio → Studio-Core Migration Analysis

**Date:** 2026-03-20
**Goal:** Classify business logic in `formspec-studio` that should be consolidated into `formspec-studio-core`. Studio-core should be purely behavior-driven. Studio should not know or care about JSON schemas.

---

## Executive Summary

Studio currently contains **6 categories** of business logic that leak into the UI layer:

1. **Field type catalog & type metadata** — hardcoded domain knowledge about formspec data types
2. **FEL expression utilities** — parsing, validation, highlighting, autocomplete
3. **Tree/path manipulation** — flattening, lookup, descendant pruning
4. **Widget compatibility** — mapping data types to compatible widgets
5. **Serialization adapters** — XML/CSV/JSON output formatting
6. **Document normalization** — preparing definition/component/theme docs for preview

Studio-core already has a rich 100+ method `Project` class that handles most CRUD operations. The gap is in **query/introspection helpers** and **catalogs** that studio uses to present editing UI.

---

## Category 1: Field Type Catalog & Type Metadata

### MOVE → studio-core

**File:** `packages/formspec-studio/src/components/AddItemPalette.tsx`
- **`FIELD_TYPE_CATALOG`** (lines 28–265): Complete catalog of all addable item types with metadata (label, description, icon, color, dataType, keywords, category). This is domain knowledge — which field types exist and what they mean. The UI should just render whatever the core provides.
- **`FieldTypeOption` interface**: The shape of a catalog entry.

**File:** `packages/formspec-studio/src/lib/field-helpers.ts`
- **`TYPE_MAP`** (lines 68–85): Maps data types to display metadata (icon, label, color). Duplicates domain knowledge that's also in the catalog.
- **`dataTypeInfo()`** (line 88): Lookup function for type display info.
- **`propertyHelp`** (lines 139–161): Help text for property labels. This is spec-derived domain knowledge, not UI.

### Already in studio-core
- `field-type-aliases.ts` has `FIELD_TYPE_MAP` mapping type aliases → canonical dataTypes. Related but different purpose.

### Recommendation
Create a `catalogs.ts` in studio-core that exports:
- `getFieldTypeCatalog(): FieldTypeOption[]` — the full addable-types catalog
- `getDataTypeInfo(dataType: string): DataTypeDisplay` — type display metadata
- `getPropertyHelp(): Record<string, string>` — help text

---

## Category 2: FEL Expression Utilities

### MOVE → studio-core

**File:** `packages/formspec-studio/src/lib/fel-editor-utils.ts` (entire file, 456 lines)
All of this is pure business logic with zero UI coupling:
- **`validateFEL()`** (line 71): Validates FEL syntax using the lexer/parser. Pure function.
- **`buildFELHighlightTokens()`** (line 94): Tokenizes FEL for syntax highlighting. Pure function.
- **`getFELAutocompleteTrigger()`** (line 151): Determines autocomplete context from cursor position. Pure function.
- **`getFELInstanceNameAutocompleteTrigger()`** (line 197): Instance name autocomplete. Pure function.
- **`getFELFunctionAutocompleteTrigger()`** (line 239): Function name autocomplete. Pure function.
- **`filterFELFieldOptions()`** (line 271): Filters/sorts field options for autocomplete. Pure function.
- **`filterFELFunctionOptions()`** (line 294): Filters/sorts function options. Pure function.
- **`getInstanceFieldOptions()`** (line 320): Extracts field paths from instance schemas/data. Pure function.
- **`getInstanceNameOptions()`** (line 222): Filters instance names. Pure function.
- All supporting types (`FELEditorFieldOption`, `FELAutocompleteTrigger`, `FELHighlightToken`, etc.)

**File:** `packages/formspec-studio/src/lib/fel-catalog.ts` (entire file, 112 lines)
- **`FUNCTION_DETAILS`** (line 27): Signatures and descriptions for all ~60 FEL functions.
- **`getFELCatalog()`** (line 101): Merges engine's function catalog with display metadata.
- **`CATEGORY_COLORS`** / **`CATEGORY_ORDER`**: Display metadata for function categories.
- **`formatCategoryName()`**: String formatting utility.

**File:** `packages/formspec-studio/src/lib/humanize.ts` (entire file, 44 lines)
- **`humanizeFEL()`**: Converts simple FEL expressions to human-readable strings. Pure function.

### Recommendation
Create `fel-editing.ts` in studio-core that consolidates all FEL editing support:
- Expression validation, highlighting, autocomplete triggers
- Function catalog with metadata
- Humanization

This lets any future studio client (web, mobile, CLI) use the same FEL editing intelligence without depending on the Preact-based studio.

---

## Category 3: Tree & Path Manipulation

### MOVE → studio-core

**File:** `packages/formspec-studio/src/lib/tree-helpers.ts` (entire file, 200 lines)
All pure data structure operations:
- **`buildDefLookup()`** (line 81): Builds flat lookup map from definition items. Used extensively.
- **`buildBindKeyMap()`** (line 103): Secondary lookup from item key → path.
- **`flattenComponentTree()`** (line 122): Walks component tree producing flat entries. Core to both canvas rendering and DnD.
- **`isLayoutId()` / `nodeIdFromLayoutId()` / `nodeRefFor()`**: Identity helpers.
- All supporting types (`FlatEntry`, `DefLookupEntry`, `CompNode`).

**File:** `packages/formspec-studio/src/lib/selection-helpers.ts` (entire file, 55 lines)
All pure functions for multi-select operations:
- **`pruneDescendants()`** (line 7): Removes paths whose ancestors are in the set.
- **`sortForBatchDelete()`** (line 23): Sorts paths deepest-first for safe deletion.
- **`buildBatchMoveCommands()`** (line 40): Builds move command payloads.

**File:** `packages/formspec-studio/src/lib/field-helpers.ts`
- **`flatItems()`** (line 18): Flattens nested item tree into flat list with paths.
- **`bindsFor()`** (line 31): Gets bind properties for a field path.
- **`shapesFor()`** (line 52): Gets shapes targeting a specific path.

### Recommendation
Studio-core already has `Project.fieldPaths()`, `Project.itemAt()`, `Project.bindFor()`. Extend with:
- `flattenDefinition()` — replaces `flatItems()`
- `flattenComponentTree()` — the component tree flattening
- `pruneDescendants()` / `sortForBatchDelete()` — selection utilities
- `buildDefLookup()` — the definition lookup builder

These are all used by DnD, context menus, batch operations — behavior that should work identically regardless of rendering technology.

---

## Category 4: Widget Compatibility

### MOVE → studio-core

**File:** `packages/formspec-studio/src/lib/field-helpers.ts`
- **`ITEM_TYPE_WIDGETS`** (lines 97–100): Maps non-field item types to compatible widget names.
- **`compatibleWidgets()`** (line 103): Returns compatible widget components for a type+dataType combo.
- **`widgetHintForComponent()`** (line 111): Converts component → widgetHint token.
- **`componentForWidgetHint()`** (line 130): Converts widgetHint → component id.

### Already in studio-core
- `field-type-aliases.ts` has `resolveWidget()` and `widgetHintFor()` — related but focused on aliases, not compatibility matrices.

### Recommendation
Add `compatibleWidgets()` and the bidirectional hint ↔ component mapping to studio-core. The UI component (`WidgetHintSection.tsx`) currently calls these helpers directly — it should instead call `project.compatibleWidgets(type, dataType)` or similar.

---

## Category 5: Serialization Adapters

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/mapping/adapters.ts` (entire file, 187 lines)
Complete serialization logic for mapping preview:
- **`serializeMappedData()`**: Dispatches to format-specific serializers.
- **`toJSON()`**: JSON serialization with null stripping, key sorting, pretty printing.
- **`toXML()`**: Full XML serializer with namespaces, CDATA, declaration.
- **`toCSV()`**: CSV serializer with quoting, delimiters, headers.
- **`AdapterOptions` interface**: Configuration for all three formats.

This is pure business logic. Zero DOM/UI dependency. Currently in studio because the mapping preview needed it, but it belongs in core.

### Recommendation
Move to studio-core as `serialization-adapters.ts` or integrate with the existing `Project.previewMapping()` method.

---

## Category 6: Document Normalization

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/preview/preview-documents.ts` (84 lines)
- **`normalizeDefinitionDoc()`**: Normalizes `presentation` → `formPresentation`.
- **`normalizeComponentDoc()`**: Normalizes component tree root and wires targetDefinition URL.
- **`normalizeThemeDoc()`**: Merges user theme with default theme, wires targetDefinition.

These are the bridge between studio's document model and the webcomponent's expectations. This normalization logic is spec behavior, not UI.

### Recommendation
Move to studio-core. `Project.export()` already exists — these normalizations could become part of a `Project.exportForPreview()` or `Project.exportBundle()` that produces webcomponent-ready documents.

---

## Category 7: Drop Target Computation (DnD Logic)

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/editor/dnd/compute-drop-target.ts` (294 lines)
Heavy pure logic for DnD positioning:
- **`computeDropTarget()`**: Given source, target, position, and flat list, computes the drop target for both definition and component moves.
- **`buildSequentialMoves()`**: Builds sequential move descriptors for multi-item DnD.
- **`isDescendantOf()`**: Descendant check with flat-list traversal.
- All helper functions for resolving component/definition targets.

This is algorithm-heavy logic with zero DOM dependency. It operates on the `FlatEntry[]` data structure and returns move descriptors that are fed to `Project.moveItem()` and `Project.moveLayoutNode()`.

### Recommendation
Move to studio-core alongside the tree helpers it depends on. Expose as `computeDropTarget()` and `buildSequentialMoves()`.

---

## Category 8: Canvas Operations (Context Menu Actions)

### KEEP in studio (mostly)

**File:** `packages/formspec-studio/src/workspaces/editor/canvas-operations.ts` (197 lines)
- **`buildContextMenuItems()`**: Returns menu items based on selection state. This is **UI menu structure** — keep in studio.
- **`executeContextAction()`**: Dispatches to `Project.*` methods based on action string. This is a **thin UI dispatcher** — the actual business logic (delete, duplicate, wrap, move) is already in `Project`. Keep in studio.
- **`clampContextMenuPosition()`**: Uses `window.innerWidth` — definitely UI. Keep in studio.

---

## Category 9: Bind Normalization (Duplicated)

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/logic/LogicTab.tsx` (lines 52–74)
- **`normalizeBinds(binds, items)`**: Converts the definition's `binds` (array form) into a grouped `Record<path, BindEntry>`, and extracts `prePopulate` from item definitions into the same structure. Merges two separate definition structures into one unified view.

**File:** `packages/formspec-studio/src/components/CommandPalette.tsx` (lines 23–39)
- **`normalizeBinds(binds)`**: Another local implementation — same concept, slightly different shape. Classic code smell from duplicated domain logic.

### Recommendation
Add `Project.getBindsView()` or `normalizeBinds()` to studio-core. Both call sites consume the same merged view.

---

## Category 10: Sample Data Generation & Engine Seeding

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/mapping/MappingPreview.tsx` (lines 19–85)
- **`generateSchemaSample()`**: Creates a FormEngine, walks all definition items, generates type-appropriate fake data using `@faker-js/faker` with key-name heuristics (e.g., `keyLower.includes('email')` → faker email), handles repeatable groups. Significant data generation algorithm.

**File:** `packages/formspec-studio/src/workspaces/data/TestResponse.tsx` (lines 7–17)
- **`seedInitialValues(engine, items, prefix)`**: Recursively walks definition items, calls `engine.setValue()` for fields with non-expression initial values. Duplicates engine initialization logic that `evaluation-helpers.ts` in studio-core also handles.

### Recommendation
Add `Project.generateSampleData()` and consolidate engine seeding into studio-core's existing `previewForm()` / `validateResponse()` helpers.

---

## Category 11: Definition Queries (Option Sets, Search Index)

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/data/OptionSets.tsx` (lines 49–59)
- Usage count computation: Uses `flatItems()` to walk all definition items and count references to each `optionSet` by name. Pure cross-definition query.

**File:** `packages/formspec-studio/src/components/CommandPalette.tsx` (lines 60–121)
- Search index construction: Builds a flat list of searchable results from items, variables, binds, and shapes with keyword arrays encoding what terms each entity matches against. This is a search-index over the definition.

### Recommendation
Add `Project.getOptionSetUsage()` and `Project.getSearchIndex()` methods to studio-core. These are pure queries that any consumer (not just the React UI) would benefit from.

---

## Category 12: Widget Resolution Priority

### MOVE → studio-core

**File:** `packages/formspec-studio/src/workspaces/editor/properties/WidgetHintSection.tsx` (lines 21–25)
- Three-way widget resolution: `widgetHint presentation → component tree override → compatibility-matrix default`. This precedence order is a spec-level rule embedded in a React component.

### Recommendation
Add `Project.resolvedWidgetFor(path)` that encapsulates this resolution order.

---

## What Should NOT Move

### Pure UI State (KEEP in studio)
- `state/useSelection.tsx` — multi-select state with React context. Pure UI concern (which items are highlighted).
- `state/useActivePage.tsx` — which page tab is active. UI navigation state.
- `state/useCanvasTargets.tsx` — DOM element registry for scroll-to. Purely DOM-bound.
- `state/ProjectContext.tsx` — React context provider. Framework binding.
- All `use*.ts` hooks — React framework glue.

### Pure UI Components (KEEP in studio)
- All `.tsx` component files in `components/`, `workspaces/`, `features/`
- `lib/keyboard.ts` — keyboard shortcut handling
- `workspaces/editor/block-utils.ts` — CSS indent calculation, DOM ref factory

### UI Catalog Constants (KEEP in studio)
- `CATEGORY_COLORS` in `fel-catalog.ts` — CSS class names for display
- Icon glyphs and color classes in `TYPE_MAP`

Note: The **data** (which categories exist, which functions exist) should move. The **presentation** (colors, icons) stays.

---

## Migration Priority

| Priority | Category | Files | Lines | Impact |
|----------|----------|-------|-------|--------|
| **P0** | FEL editing utils | `fel-editor-utils.ts`, `fel-catalog.ts`, `humanize.ts` | ~612 | Unblocks FEL editor reuse |
| **P0** | Tree/path helpers | `tree-helpers.ts`, `selection-helpers.ts`, parts of `field-helpers.ts` | ~300 | Unblocks DnD/canvas reuse |
| **P0** | Bind normalization | `LogicTab.tsx`, `CommandPalette.tsx` (duplicated!) | ~60 | Eliminates duplication |
| **P1** | Field type catalog | Part of `AddItemPalette.tsx`, part of `field-helpers.ts` | ~300 | Unblocks item palette reuse |
| **P1** | Drop target computation | `compute-drop-target.ts` | ~294 | Unblocks DnD reuse |
| **P1** | Widget compatibility | Part of `field-helpers.ts`, `WidgetHintSection.tsx` | ~50 | Clean API boundary |
| **P1** | Definition queries | `OptionSets.tsx`, `CommandPalette.tsx` | ~80 | Reusable queries |
| **P2** | Serialization adapters | `adapters.ts` | ~187 | Already works, lower urgency |
| **P2** | Document normalization | `preview-documents.ts` | ~84 | Could fold into Project.export |
| **P2** | Sample data generation | `MappingPreview.tsx`, `TestResponse.tsx` | ~100 | Consolidates engine seeding |

---

## Schema Coupling Found in Studio

Studio does **not** directly import or reference JSON schema files from `schemas/`. However, it has **implicit schema knowledge** in several places:

1. **`propertyHelp`** in `field-helpers.ts` — descriptions copied from schema `description` fields
2. **`FIELD_TYPE_CATALOG`** — encodes which `dataType` values are valid and their metadata
3. **`TYPE_MAP`** — encodes the full set of data types
4. **`ITEM_TYPE_WIDGETS`** — encodes which component types work with which item types
5. **`bindTypes`** in `BindsSection.tsx` — hardcodes the list of valid bind types (`required`, `relevant`, `calculate`, `constraint`, `readonly`, `pre-populate`)

None of these reference schema files at runtime, but they duplicate knowledge that the schemas define. Moving them to studio-core consolidates this domain knowledge in one place and lets it be derived from the spec/schemas if desired.

---

## Three-Tier Placement Analysis

Not all business logic belongs in studio-core. The guiding principle: **how far down the stack is the knowledge defined?**

- **Engine** (`formspec-engine`): Spec-level facts — things defined by the FEL grammar or data type system
- **Core** (`formspec-core`): Structural queries over the definition/project model — same level as `resolvePageView()`, `fieldPaths()`
- **Studio-core** (`formspec-studio-core`): Authoring UX helpers — defaults, coercion, placement, catalogs

### Full Change List

#### → Engine (`formspec-engine`)

| # | What | Current Location | Reasoning |
|---|------|-----------------|-----------|
| E1 | **FEL identifier validation** — `isValidFELIdentifier(name)` / `sanitizeFELIdentifier(name)` | `VariablesSection.tsx` line 31 (`/[^a-zA-Z0-9_]/g`), duplicated in `OptionSets.tsx` line 49 and `DataSources.tsx` line 108 | The valid-identifier character set is defined by the FEL grammar. Engine already owns the FEL lexer — it should export these predicates so every consumer uses the same rule. Currently three copies with slight behavioral differences (remove vs. replace-with-underscore). |
| E2 | **Data type taxonomy predicates** — `isChoiceLike(dt)`, `isDecimalLike(dt)`, `isRepeatableType(dt)` | `SelectedItemProperties.tsx` lines 49–51 (inline boolean expressions), implicitly in `field-helpers.ts` TYPE_MAP | These classifications derive from the spec's data type definitions. Engine defines what data types exist — it should also export how they group. Any consumer (engine validators, studio, future CLI tools) needs the same taxonomy. |
| E3 | **FEL function metadata** — signatures, parameter types, descriptions for all ~60 stdlib functions | `fel-catalog.ts` lines 27–99 (`FUNCTION_DETAILS`) | Engine implements these functions. The metadata describing them (arity, parameter names, descriptions) is a spec-level fact, not a studio concern. Engine should export a `getFELFunctionCatalog()` that returns structured metadata. Studio just adds display properties (colors, icons). |

#### → Core (`formspec-core`)

| # | What | Current Location | Reasoning |
|---|------|-----------------|-----------|
| C1 | **`normalizeBinds(binds, items)`** — merge binds array + prePopulate into unified path-keyed map | `LogicTab.tsx` lines 52–74, duplicated in `CommandPalette.tsx` lines 23–39 | A structural query over the definition, same class as `resolvePageView()` and `resolveThemeCascade()` which already live in core. Two copies exist today — classic sign it belongs in the shared layer. |
| C2 | **Shapes constraint normalization** — `constraint/or/and` → display string | `ShapesSection.tsx` lines 106–108 | Core already owns shape command handlers and understands the shapes schema. The polymorphic constraint representation is a definition-level concept. Any consumer rendering shapes needs this. |
| C3 | **Option set usage counting** — walk item tree, count references per option set name | `OptionSets.tsx` lines 52–58 | A cross-definition query analogous to `fieldPaths()` or `dependencyGraph()` — both already in core's `queries/` directory. Also needed for safe-delete guards. |
| C4 | **Page mode interpretation** — what counts as a "page", filtering items by active page | `EditorCanvas.tsx` lines 65–140 | Core already owns `resolvePageStructure()` and `resolvePageView()`. The EditorCanvas re-derives the same semantics inline. Should use core's existing functions or extend them. |
| C5 | **Drop target computation** — `computeDropTarget()`, `buildSequentialMoves()` | `compute-drop-target.ts` (294 lines) | Pure functions encoding definition-tree structural move validity. Core already owns `moveItems` command handling — the legality/ordering rules belong alongside it. Zero DOM dependency. |
| C6 | **Definition tree flattening** — `buildDefLookup()`, `flattenComponentTree()`, `buildBindKeyMap()` | `tree-helpers.ts` (200 lines) | Structural queries over definition and component trees. Core owns both document schemas. Used by DnD, canvas, search, and multiple studio components — should be a single shared implementation. |
| C7 | **Multi-select path operations** — `pruneDescendants()`, `sortForBatchDelete()`, `buildBatchMoveCommands()` | `selection-helpers.ts` (55 lines) | Pure path-algebra functions that encode definition path semantics (parent/child/descendant relationships). Core owns path resolution — these belong there. |
| C8 | **Field path flattening + bind/shape lookups** — `flatItems()`, `bindsFor()`, `shapesFor()` | `field-helpers.ts` lines 18–60 | Definition queries. Core already has `Project.fieldPaths()`, `Project.itemAt()`, `Project.bindFor()`. These are either duplicates or missing query methods. |
| C9 | **Artifact type → bundle key mapping** — human-readable artifact names to bundle schema keys | `ImportDialog.tsx` line 137 (`.toLowerCase()`) | Core owns the `ProjectState` bundle schema. The mapping from display names to bundle keys is a vocabulary concern — currently relies on a fragile `.toLowerCase()` convention. |
| C10 | **Search index construction** — builds searchable entries from items, variables, binds, shapes | `CommandPalette.tsx` lines 60–121 | A cross-definition query that walks the full definition model. Same pattern as core's `statistics()`, `diagnose()`, and `dependencyGraph()` queries. |
| C11 | **Serialization adapters** — JSON/XML/CSV output formatting | `adapters.ts` (187 lines) | Python already has `src/formspec/adapters/`. The TS equivalent is spec-level behavior — format-specific serialization rules defined by the mapping spec. Could also go in engine alongside `RuntimeMappingEngine`, but core is the minimum viable home. |

#### → Studio-core (`formspec-studio-core`)

| # | What | Current Location | Reasoning |
|---|------|-----------------|-----------|
| S1 | **Field type catalog** — `FIELD_TYPE_CATALOG` with metadata (label, description, icon, category, keywords) | `AddItemPalette.tsx` lines 28–265 | Studio-core owns the authoring API (`addField`, `addGroup`, `addContent`). The catalog of what you *can* add is the authoring counterpart. Display properties (icons, colors) stay in studio; structural data (types, categories, keywords) moves. |
| S2 | **Type display metadata** — `TYPE_MAP`, `dataTypeInfo()` | `field-helpers.ts` lines 68–88 | Maps data types → display info. Depends on the type taxonomy (engine) but adds authoring-level display metadata. Studio-core already has `resolveFieldType()` — this extends it. |
| S3 | **Property help text** — `propertyHelp` record | `field-helpers.ts` lines 139–161 | Help text derived from the spec but specific to the authoring experience. Any editor UI needs it. Not spec-level (engine doesn't need it) but not rendering-specific either. |
| S4 | **Widget compatibility matrix** — `compatibleWidgets()`, `widgetHintForComponent()`, `componentForWidgetHint()` | `field-helpers.ts` lines 97–137 | Studio-core already owns `resolveWidget()` and `widgetHintFor()`. The compatibility matrix and bidirectional mapping are the same concern. |
| S5 | **Widget resolution priority** — three-way precedence: `widgetHint` → component tree override → compatibility default | `WidgetHintSection.tsx` lines 21–25 | Authoring-level resolution order. Studio-core owns `resolveWidget()` — this is the full version. |
| S6 | **FEL editing utilities** — validation, highlighting, autocomplete triggers, filtering | `fel-editor-utils.ts` (456 lines) | Pure authoring support functions. Depend on engine's FEL lexer/parser but add editing intelligence (cursor-aware autocomplete, syntax highlighting tokens). Any editor UI needs these — not just React studio. |
| S7 | **FEL humanization** — `humanizeFEL()` | `humanize.ts` (44 lines) | Authoring UX — converting FEL to human-readable strings for display. Not spec-level, but any authoring surface needs it. |
| S8 | **FEL function display catalog** — merge engine metadata with category colors/order | `fel-catalog.ts` lines 101–112 (`getFELCatalog`) | Bridges engine's function metadata (E3) with display concerns. Studio-core is the right seam — it already bridges engine and UI for other concerns. |
| S9 | **`parseRepeatValue()`** — string → int coercion for min/maxRepeat | `GroupConfigSection.tsx` lines 8–13 | Input coercion for an authoring operation. Studio-core owns group editing — this validation helper belongs with it. |
| S10 | **Default shape values** — `'*'`, `'true'`, `'Validation failed'`, `severity: 'error'` | `ShapesSection.tsx` lines 30–37 | Studio-core owns `addValidation()`. What a "blank" shape looks like is an authoring default, not a spec rule. Should be `addValidationWithDefaults()`. |
| S11 | **Name sanitization** — `sanitizeName()` for option sets and data sources | `OptionSets.tsx` line 49, `DataSources.tsx` line 108 (identical, duplicated) | Authoring UX: takes user input, produces a valid identifier. Depends on engine's identifier rules (E1) but adds the replace-with-underscore behavior specific to authoring. Single shared `sanitizeIdentifier()` in studio-core. |
| S12 | **`handleAddItem` path derivation** — compute insertion path from active page state | `EditorCanvas.tsx` lines 184–216 | Studio-core owns `addField`/`addGroup`/`addContent`. The "figure out where to insert based on active page" logic is an authoring placement concern — should be a `PlacementOptions` parameter or helper. |
| S13 | **Widget hint → content kind mapping** — `WIDGET_HINT_TO_KIND` | `EditorCanvas.tsx` lines 37–44 | Studio-core owns `resolveFieldType()` and `widgetHintFor()`. This reverse mapping (hint → `addContent` kind parameter) belongs alongside them. |
| S14 | **Document normalization for preview** — `normalizeDefinitionDoc()`, `normalizeComponentDoc()`, `normalizeThemeDoc()` | `preview-documents.ts` (84 lines) | Bridge between studio's model and the webcomponent's expectations. Studio-core already has `previewForm()` — these normalizations could become `Project.exportForPreview()`. |
| S15 | **Sample data generation** — `generateSchemaSample()` with faker heuristics | `MappingPreview.tsx` lines 19–85 | Authoring tool: generates realistic test data for preview. Studio-core owns `previewForm()` and `validateResponse()` — sample generation is the same family. |
| S16 | **Engine seeding** — `seedInitialValues()` | `TestResponse.tsx` lines 7–17 | Duplicates logic already in studio-core's `evaluation-helpers.ts`. Should consolidate into the existing helper. |
| S17 | **Item classification helpers** — `isChoice`, `isDecimalLike`, `isMoney` computed from dataType | `SelectedItemProperties.tsx` lines 49–51 | These inline expressions should call engine predicates (E2) but the "which property sections to show for which classification" logic is an authoring UX concern. Studio-core should expose `getPropertySections(type, dataType)` or similar. |
| S18 | **Existing bind behavior type enumeration** — merging bind keys with prePopulate presence | `SelectedItemProperties.tsx` lines 53–56 | Parallel to the `normalizeBinds` problem (C1). Once C1 exists, this becomes a trivial call. But the "which behavior types are available to add" logic is authoring UX. |

---

## Dependency Flow

```
formspec-engine (E1–E3)
       ↓ imports
formspec-core (C1–C11)
       ↓ imports
formspec-studio-core (S1–S18)
       ↓ imports
formspec-studio (pure UI: rendering, React hooks, DOM events)
```

Each layer only imports downward. Studio-core bridges engine predicates and core queries into authoring-friendly APIs. Studio becomes a pure rendering layer.

---

## Proposed API Additions

### Engine additions

```typescript
// fel/identifiers.ts
export function isValidFELIdentifier(name: string): boolean;
export function sanitizeFELIdentifier(name: string): string;

// data-types.ts
export function isChoiceLike(dataType: string): boolean;
export function isDecimalLike(dataType: string): boolean;
export function isRepeatableType(dataType: string): boolean;
export function dataTypeCategory(dataType: string): 'text' | 'numeric' | 'choice' | 'temporal' | 'binary' | 'special';

// fel/catalog.ts
export function getFELFunctionCatalog(): FELFunctionMeta[];
```

### Core additions

```typescript
// queries/binds.ts
export function normalizeBinds(binds: unknown[], items: FormItem[]): Record<string, BindView>;

// queries/shapes.ts
export function normalizeShapeConstraint(shape: Shape): string;

// queries/option-sets.ts
export function optionSetUsage(items: FormItem[]): Record<string, number>;

// queries/search.ts
export function buildSearchIndex(definition: FormDefinition): SearchEntry[];

// dnd/drop-target.ts (moved from studio)
export function computeDropTarget(...): DropTarget | null;
export function buildSequentialMoves(...): DefinitionMove[];

// tree/flatten.ts (moved from studio)
export function buildDefLookup(items: FormItem[]): Map<string, DefLookupEntry>;
export function flattenComponentTree(root: CompNode, ...): FlatEntry[];
export function flattenDefinition(items: FormItem[]): FlatItem[];

// tree/selection.ts (moved from studio)
export function pruneDescendants(paths: Set<string>): string[];
export function sortForBatchDelete(paths: string[]): string[];

// serialization/adapters.ts (moved from studio)
export function serializeMappedData(data: any, options: AdapterOptions): string;
```

### Studio-core additions

```typescript
// catalogs.ts
export function getFieldTypeCatalog(): FieldTypeOption[];
export function getDataTypeInfo(dataType: string): DataTypeDisplay;
export function getPropertyHelp(): Record<string, string>;
export function compatibleWidgets(type: string, dataType?: string): string[];
export function widgetHintToContentKind(hint: string): string | undefined;

// fel-editing.ts
export function validateFEL(expression: string): string | null;
export function buildFELHighlightTokens(expression: string): FELHighlightToken[];
export function getFELAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null;
export function getFELFunctionAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null;
export function getFELInstanceNameAutocompleteTrigger(expression: string, caret: number): FELAutocompleteTrigger | null;
export function filterFELFieldOptions(options: FELEditorFieldOption[], query: string): FELEditorFieldOption[];
export function filterFELFunctionOptions(options: FELEditorFunctionOption[], query: string): FELEditorFunctionOption[];
export function humanizeFEL(expression: string): string;

// identifiers.ts
export function sanitizeIdentifier(name: string): string;  // uses engine's isValidFELIdentifier + replace-with-underscore

// New Project methods
Project.getBindsView(): Record<string, BindView>;
Project.getOptionSetUsage(): Record<string, number>;
Project.getSearchIndex(): SearchEntry[];
Project.resolvedWidgetFor(path: string): string;
Project.generateSampleData(): Record<string, unknown>;
Project.exportForPreview(): { definition; component; theme };
Project.addValidationWithDefaults(): HelperResult;
Project.computeInsertionPath(activePage?: number): string | undefined;
```
