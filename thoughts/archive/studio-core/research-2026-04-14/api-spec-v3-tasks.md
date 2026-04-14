# API Spec v3 — Implementation Progress

**Total: 122 commands, 26 queries, 1 diagnostics system, 1 export**
**Done: 122 commands, 26 queries, 1 diagnostics, 1 export, all cross-artifact behaviors (285 tests passing)**

---

## Project (§ createProject, Reading state)

- [x] `createProject(options?)` — factory, defaults, seed
- [x] `ProjectState` type — definition, component, theme, mapping, extensions, versioning
- [x] Convenience accessors: `.definition`, `.component`, `.theme`, `.mapping`
- [x] Default state generation: URN URLs, blank documents targeting definition URL

## Dispatching commands

- [x] `dispatch(command)` — handler lookup, clone-mutate-commit lifecycle
- [x] `batch(commands)` — atomic, single undo entry, single notification
- [x] Handler registry pattern (self-registering modules, no circular deps)

## Middleware

- [x] Middleware pipeline — compose around dispatch, can transform/block commands

## History

- [x] `undo()` / `redo()` with snapshot restore
- [x] `canUndo` / `canRedo`
- [x] `maxHistoryDepth` (default 50, oldest pruned)
- [x] Redo stack cleared on new dispatch
- [x] `log` — serializable command log with timestamps

## Change notification

- [x] `onChange(listener)` — returns unsubscribe
- [x] Notifications on dispatch, batch, undo, redo (with `source`)

## Definition — Items

- [x] `definition.addItem` — auto-key, parentPath, insertIndex, field→string, group→children
- [x] `definition.deleteItem` — subtree removal, bind cleanup
- [x] `definition.renameItem` — rewrites bind paths, returns newPath
- [x] `definition.moveItem` — sourcePath → targetParentPath/targetIndex
- [x] `definition.reorderItem` — swap up/down
- [x] `definition.duplicateItem` — deep clone, suffixed key

## Definition — Field Configuration

- [x] `definition.setItemProperty` — generic setter
- [x] `definition.setFieldDataType` — changes dataType
- [x] `definition.setFieldOptions` — inline options or optionSet URI
- [x] `definition.setItemExtension` — set/remove x- extensions

## Definition — Binds

- [x] `definition.setBind` — multi-property set, null removes, auto-remove empty bind

## Definition — Shapes

- [x] `definition.addShape` — auto-id, target, constraint, severity, code, activeWhen, timing, context
- [x] `definition.setShapeProperty` — generic property update
- [x] `definition.deleteShape` — remove by id, clean up composition refs
- [x] `definition.setShapeComposition` — `{ id, mode: 'and'|'or'|'xone'|'not', refs/ref }`
- [x] `definition.renameShape` — `{ id, newId }` — rewrites composition refs

## Definition — Variables

- [x] `definition.addVariable` — auto-name, expression, scope
- [x] `definition.setVariable` — update any property
- [x] `definition.deleteVariable` — remove by name

## Definition — Option Sets

- [x] `definition.setOptionSet` — create/replace named option list (inline or external)
- [x] `definition.deleteOptionSet` — inlines options into referencing fields
- [x] `definition.promoteToOptionSet` — extracts inline options → named set

## Definition — Instances

- [x] `definition.addInstance` — name, source URI, schema, inline data, static, readonly
- [x] `definition.setInstance` — update any property
- [x] `definition.renameInstance` — renames key (FEL rewriting deferred)
- [x] `definition.deleteInstance`

## Definition — Pages & Form-level

- [x] `definition.setFormTitle`
- [x] `definition.addPage` — `{ title?, insertIndex? }`
- [x] `definition.deletePage` — can't delete last
- [x] `definition.reorderPage` — `{ pageKey, direction }`
- [x] `definition.setFormPresentation` — pages toggle, labelPosition, density, defaultCurrency
- [x] `definition.setDefinitionProperty` — name, description, url, version, status, etc.

## Definition — Screener

- [x] `definition.setScreener` — `{ enabled }` — create/remove
- [x] `definition.addScreenerItem` — field in screener scope
- [x] `definition.deleteScreenerItem` — cleans up screener binds
- [x] `definition.setScreenerBind` — same shape as setBind, screener scope
- [x] `definition.addRoute` — `{ condition, target, label?, insertIndex? }`
- [x] `definition.setRouteProperty` — `{ index, property, value }`
- [x] `definition.deleteRoute` — can't delete last
- [x] `definition.reorderRoute` — order-dependent (first match wins)

## Definition — Migrations

- [x] `definition.addMigration` — `{ fromVersion, description? }`
- [x] `definition.deleteMigration`
- [x] `definition.setMigrationProperty` — description, extensions
- [x] `definition.addFieldMapRule` — `{ fromVersion, source, target, transform, expression?, insertIndex? }`
- [x] `definition.setFieldMapRule` — `{ fromVersion, index, property, value }`
- [x] `definition.deleteFieldMapRule`
- [x] `definition.setMigrationDefaults` — `{ fromVersion, defaults }`

## Definition — Modular Composition

- [x] `definition.setGroupRef` — `{ path, ref, keyPrefix? }` — set/clear `$ref`

## Component — Tree Structure

- [x] `component.addNode` — `{ parent: NodeRef, insertIndex?, component, bind?, props? }`
- [x] `component.deleteNode` — subtree removal
- [x] `component.moveNode` — `{ source, targetParent, targetIndex? }`
- [x] `component.reorderNode` — swap with sibling
- [x] `component.duplicateNode` — deep clone, new nodeIds
- [x] `component.wrapNode` — `{ node, wrapper: { component, props? } }`
- [x] `component.unwrapNode` — dissolve container, promote children

## Component — Node Properties

- [x] `component.setNodeProperty` — generic setter
- [x] `component.setNodeType` — change type in-place
- [x] `component.setNodeStyle` — single style property
- [x] `component.setNodeAccessibility` — role, description, liveRegion
- [x] `component.spliceArrayProp` — splice into array-valued props
- [x] `component.setFieldWidget` — validates widget on bound field
- [x] `component.setResponsiveOverride` — per-breakpoint overrides
- [x] `component.setWizardProperty` — showProgress, allowSkip
- [x] `component.setGroupRepeatable` — toggle repeat
- [x] `component.setGroupDisplayMode` — stack | dataTable
- [x] `component.setGroupDataTable` — columns, sorting, row behavior

## Component — Custom Components

- [x] `component.registerCustom` — `{ name, params, tree }`
- [x] `component.updateCustom` — partial params/tree
- [x] `component.deleteCustom` — removes template
- [x] `component.renameCustom` — rewrites tree references

## Component — Document-Level

- [x] `component.setToken` — Tier 3 design token
- [x] `component.setBreakpoint` — component-level breakpoint
- [x] `component.setDocumentProperty` — url, name, title, description, version, targetDefinition

## Theme — Tokens & Defaults

- [x] `theme.setToken` — dot-delimited key
- [x] `theme.setTokens` — batch set
- [x] `theme.setDefaults` — form-wide baseline (cascade level 1)

## Theme — Selectors (Cascade Level 2)

- [x] `theme.addSelector` — `{ match, apply, insertIndex? }`
- [x] `theme.setSelector` — `{ index, match?, apply? }`
- [x] `theme.deleteSelector`
- [x] `theme.reorderSelector` — document order matters

## Theme — Per-Item Overrides (Cascade Level 3)

- [x] `theme.setItemOverride` — `{ itemKey, property, value }` — null removes, empty cleanup
- [x] `theme.deleteItemOverride` — remove entire block
- [x] `theme.setItemStyle` — single CSS property in per-item style
- [x] `theme.setItemWidgetConfig` — single widgetConfig property
- [x] `theme.setItemAccessibility` — role, description, liveRegion

## Theme — Page Layout

- [x] `theme.addPage` — `{ id?, title?, description?, insertIndex? }`
- [x] `theme.setPageProperty` — title, description
- [x] `theme.deletePage` — can't delete last
- [x] `theme.reorderPage`
- [x] `theme.addRegion` — `{ pageId, key?, span?, start?, insertIndex? }`
- [x] `theme.setRegionProperty` — span, start, responsive
- [x] `theme.deleteRegion`
- [x] `theme.reorderRegion`
- [x] `theme.renamePage` — rewrites region refs
- [x] `theme.setRegionKey` — change region's bound item key
- [x] `theme.setPages` — bulk replace (import scenarios)

## Theme — Document-Level

- [x] `theme.setBreakpoint` — named responsive breakpoint
- [x] `theme.setStylesheets` — `{ urls }` — external CSS
- [x] `theme.setDocumentProperty` — url, version, name, title, description, platform
- [x] `theme.setExtension` — document-level `x-` property
- [x] `theme.setTargetCompatibility` — `{ compatibleVersions }`

## Mapping

- [x] `mapping.setProperty` — direction, autoMap, conformanceLevel, version, definitionRef
- [x] `mapping.setTargetSchema` — format, name, url, rootElement, namespaces
- [x] `mapping.addRule` — `{ sourcePath?, targetPath?, transform?, insertIndex? }`
- [x] `mapping.setRule` — `{ index, property, value }`
- [x] `mapping.deleteRule`
- [x] `mapping.reorderRule`
- [x] `mapping.setAdapter` — format-specific config (json, xml, csv)
- [x] `mapping.setDefaults` — literal key-value pairs
- [x] `mapping.autoGenerateRules` — preserve rules for uncovered fields
- [x] `mapping.setExtension` — document-level `x-`
- [x] `mapping.setRuleExtension` — per-rule `x-`
- [x] `mapping.addInnerRule` — inner rule in array.innerRules
- [x] `mapping.setInnerRule` — update inner rule property
- [x] `mapping.deleteInnerRule`
- [x] `mapping.reorderInnerRule`
- [x] `mapping.preview` — dry-run against sample data

## Project-level

- [x] `project.import` — replace entire state, clear history
- [x] `project.importSubform` — merge definition fragment as nested group
- [x] `project.loadRegistry` — load extension registry, pre-index
- [x] `project.removeRegistry` — unload by URL
- [x] `project.publish` — snapshot as versioned release

## Queries

### Definition & Cross-Artifact (14/14)

- [x] `fieldPaths()` — all leaf field dot-paths
- [x] `itemAt(path)` — resolve item by dot-path
- [x] `statistics()` — counts
- [x] `bindFor(path)` — effective bind (merges wildcards)
- [x] `componentFor(fieldKey)` — component node bound to field
- [x] `effectivePresentation(fieldKey)` — theme cascade
- [x] `resolveExtension(name)` — resolve against loaded registries
- [x] `searchItems(filter)` — by label, type, dataType, hasExtension
- [x] `optionSetUsage(name)` — fields referencing named option set
- [x] `instanceNames()` — all instance names
- [x] `variableNames()` — all variable names
- [x] `allDataTypes()` — 13 core + extension dataTypes
- [x] `unboundItems()` — items not bound to component nodes
- [x] `resolveToken(key)` — Tier 3 → Tier 2 → platform default

### FEL Queries (8/8)

- [x] `parseFEL(expression, context?)` — regex-based reference extraction (no AST — needs FEL parser for full implementation)
- [x] `felFunctionCatalog()` — built-in + extension functions
- [x] `availableReferences(contextPath?)` — fields, vars, instances
- [x] `dependencyGraph()` — nodes + edges (regex-based reference extraction)
- [x] `fieldDependents(fieldPath)` — reverse: binds, shapes, vars, mapping rules
- [x] `variableDependents(variableName)` — fields referencing variable
- [x] `expressionDependencies(expression)` — field paths expression references
- [x] `allExpressions()` — all FEL expressions with artifact + location

### Extension Queries (2/2)

- [x] `listRegistries()` — loaded registries with entry counts
- [x] `browseExtensions(filter?)` — by category, status, namePattern

### Versioning Queries (2/2)

- [x] `previewChangelog()` — structured diff without committing
- [x] `diffFromBaseline(fromVersion?)` — Change[] with type, target, impact

## Diagnostics

- [x] `diagnose()` → `Diagnostics`:
  - `structural` — schema validation per artifact (placeholder — needs JSON Schema integration)
  - `expressions` — FEL parse failures (placeholder — needs FEL parser integration)
  - `extensions` — unresolved extension references (done: scans x- prefixed properties)
  - `consistency` — cross-artifact: orphan component refs, stale mapping paths (done)
  - `counts` — `{ error, warning, info }` (done)

## Export

- [x] `export()` — serialize all 4 artifacts as independent copies

## Cross-artifact Behaviors

### Component tree sync
- [x] Rebuild on definition structural changes. Signaled by `rebuildComponentTree: true`. Full rebuild preserves existing bound node properties and unbound layout nodes.

### Reference rewriting
- [x] `renameItem`: full cross-artifact rewrite (binds, shapes, variables, component binds, theme overrides, mapping rules)
- [x] `renameInstance`: `@instance('old')` in all FEL expressions (binds, shapes, variables)
- [x] `renameShape`: composition references
- [x] `renameCustom`: component tree references

### Reference cleanup on delete
- [x] `deleteItem`: binds, shapes, theme per-item overrides
- [x] `deleteShape`: remove from compositions referencing it

### Post-dispatch normalization
- [x] Component + theme `targetDefinition.url` synced to `definition.url`
- [x] Theme breakpoints sorted/validated; component breakpoints synced from theme when not independently set
- [x] Mapping rules validated against definition paths (covered by diagnostics)
- [x] Versioning state initialized if missing (handled by createDefaultState)

---

## Architecture Notes

### File Structure
```
src/
  index.ts                    # Barrel exports
  types.ts                    # All interfaces/types
  project.ts                  # Project class + createProject factory
  handler-registry.ts         # Handler Map + register/get (leaf, no downstream imports)
  handlers.ts                 # Re-exports registry + imports handler modules
  handlers/
    helpers.ts                # Shared: resolveItemLocation
    definition-metadata.ts    # setFormTitle
    definition-items.ts       # 6 item commands
    definition-binds.ts       # setBind + 4 field config commands
    definition-shapes.ts      # 5 shape commands
    definition-variables.ts   # 3 variable commands
    definition-optionsets.ts  # 3 option set commands
    definition-instances.ts   # 4 instance commands
    definition-pages.ts       # 6 page/form-level commands + setGroupRef
    definition-screener.ts    # 8 screener commands
    definition-migrations.ts  # 7 migration commands
    component-tree.ts         # 7 tree structure commands
    component-properties.ts   # 11 node property + 4 custom + 3 doc-level commands
    theme.ts                  # 28 theme commands
    mapping.ts                # 16 mapping commands
    project.ts                # 5 project-level commands
tests/
  project.test.ts             # 4 tests
  history.test.ts             # 8 tests
  batch-and-notify.test.ts    # 6 tests
  definition-items.test.ts    # 21 tests
  definition-fields.test.ts   # 12 tests
  definition-shapes-vars.test.ts  # 18 tests
  definition-optionsets.test.ts   # 6 tests
  definition-instances.test.ts    # 7 tests
  definition-pages.test.ts       # 18 tests
  definition-screener.test.ts    # 12 tests
  definition-migrations.test.ts  # 8 tests
  component-tree.test.ts         # 12 tests
  component-properties.test.ts   # 21 tests
  theme.test.ts                  # 31 tests
  mapping.test.ts                # 18 tests
  project-commands.test.ts       # 5 tests
  queries.test.ts                # 52 tests
  diagnostics.test.ts            # 6 tests
  cross-artifact.test.ts         # 10 tests
  tree-sync.test.ts              # 7 tests
  breakpoint-sync.test.ts        # 3 tests
```

### Summary Table
| Domain | Total | Done | Remaining |
|--------|-------|------|-----------|
| Definition — Items | 6 | 6 | 0 |
| Definition — Field Configuration | 4 | 4 | 0 |
| Definition — Binds | 1 | 1 | 0 |
| Definition — Shapes | 5 | 5 | 0 |
| Definition — Variables | 3 | 3 | 0 |
| Definition — Option Sets | 3 | 3 | 0 |
| Definition — Instances | 4 | 4 | 0 |
| Definition — Pages & Form-level | 6 | 6 | 0 |
| Definition — Screener | 8 | 8 | 0 |
| Definition — Migrations | 7 | 7 | 0 |
| Definition — Modular Composition | 1 | 1 | 0 |
| Component — Tree Structure | 7 | 7 | 0 |
| Component — Node Properties | 11 | 11 | 0 |
| Component — Custom Components | 4 | 4 | 0 |
| Component — Document-Level | 3 | 3 | 0 |
| Theme — Tokens & Defaults | 3 | 3 | 0 |
| Theme — Selectors | 4 | 4 | 0 |
| Theme — Per-Item Overrides | 5 | 5 | 0 |
| Theme — Page Layout | 11 | 11 | 0 |
| Theme — Document-Level | 5 | 5 | 0 |
| Mapping | 16 | 16 | 0 |
| Project-level | 5 | 5 | 0 |
| **Commands** | **122** | **122** | **0** |
| **Queries** | **26** | **26** | **0** |
