# Core Commands Schema Reference Map

> schemas/core-commands.schema.json -- 1220 lines -- Command definitions for programmatic form manipulation

## Overview

The Core Command Catalog is a structured JSON schema that defines every mutation command available through `RawProject.dispatch()` in `formspec-core`. It serves as a machine-readable catalog enabling LLM agents, CLI tools, and visual editors to discover available operations and construct valid command payloads. The schema defines 120 commands organized across 16 handler areas spanning definition manipulation, theme configuration, page layout, mapping rules, component tree management, and project-level operations.

## Top-Level Structure

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | const | No | JSON Schema draft 2020-12 identifier. |
| `$id` | const | No | Schema URI: `https://formspec.org/core/commands/0.1`. |
| `title` | const | No | `"Core Command Catalog"`. |
| `description` | string | No | Describes the catalog's purpose for consumers. |
| `version` | const `"0.1"` | No | Catalog version. |
| `commands` | array of `CommandEntry` | No | Ordered list of all available command definitions. |

The document is typed as `"object"` with `version` and `commands` as the two data-carrying properties.

## Command Definitions

### definition-items (6 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.addItem` | Add a field, group, or display item to the definition tree. | type, parentPath, insertIndex, key, dataType, label, description, hint, options, labels, repeatable, minRepeat, maxRepeat, optionSet, currency, presentation, prePopulate, relevant, required, readonly, calculate, constraint, constraintMessage, initialValue | type | `insertedPath`: Dot-path of the newly added item. |
| `definition.deleteItem` | Remove an item and its children from the definition tree. Cascades to binds and component references. | path | path | -- |
| `definition.renameItem` | Rename an item's key. Cascades to binds, shapes, variables, and component references via FEL rewriting. | path, newKey | path, newKey | `newPath`: Updated dot-path after rename. |
| `definition.moveItem` | Move an item to a different parent or position. Cascades path references. | sourcePath, targetParentPath, targetIndex | sourcePath | `newPath`: Updated dot-path after move. |
| `definition.reorderItem` | Move an item one position up or down among its siblings. | path, direction | path, direction | -- |
| `definition.duplicateItem` | Deep-copy an item and insert the clone after the original. Generates a unique key for the copy. | path | path | `insertedPath`: Dot-path of the duplicated item. |

### definition-binds (5 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.setBind` | Set or update bind properties for a field path. Creates the bind entry if it doesn't exist. | path, properties | path, properties | -- |
| `definition.setItemProperty` | Set an arbitrary property on a definition item. Supports dotted paths for nested properties. | path, property, value | path, property, value | -- |
| `definition.setFieldDataType` | Change a field's data type. | path, dataType | path, dataType | -- |
| `definition.setFieldOptions` | Set inline options or assign a named option set to a field. | path, options | path, options | -- |
| `definition.setItemExtension` | Set or remove an extension on a definition item. | path, extension, value | path, extension, value | -- |

### definition-metadata (1 command)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.setFormTitle` | Set the form definition's title. | title | title | -- |

### definition-pages (3 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.setDefinitionProperty` | Set a top-level definition property (name, description, url, version, status, date, derivedFrom, versionAlgorithm, nonRelevantBehavior). | property, value | property, value | -- |
| `definition.setFormPresentation` | Set a presentation-level property (e.g. pageMode, labelPosition, density, defaultCurrency). Null value removes the property. | property, value | property, value | -- |
| `definition.setGroupRef` | Set or clear a group's ref (subform reference). | path, ref, keyPrefix | path, ref | -- |

### definition-shapes (5 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.addShape` | Add a cross-field validation shape. | target, id, message, severity, constraint, code, activeWhen, timing, context | target | -- |
| `definition.setShapeProperty` | Update a property on an existing shape. | id, property, value | id, property, value | -- |
| `definition.setShapeComposition` | Set a shape's composition mode (combine child shapes via and/or/xone/not). | id, mode, refs, ref | id, mode | -- |
| `definition.renameShape` | Rename a shape's ID. Updates composition references. | id, newId | id, newId | -- |
| `definition.deleteShape` | Remove a shape by ID. | id | id | -- |

### definition-variables (3 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.addVariable` | Add a named FEL variable to the definition. | name, expression, scope | -- | -- |
| `definition.setVariable` | Update a property on an existing variable. | name, property, value | name, property, value | -- |
| `definition.deleteVariable` | Remove a named variable. | name | name | -- |

### definition-optionsets (3 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.setOptionSet` | Create or update a named option set with inline options or an external source. | name, options, source | name | -- |
| `definition.deleteOptionSet` | Remove a named option set. | name | name | -- |
| `definition.promoteToOptionSet` | Extract a field's inline options into a shared named option set and replace with a reference. | path, name | path, name | -- |

### definition-instances (4 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.addInstance` | Add an external data source instance. | name, source, schema, data, static, readonly, description, extensions | -- | -- |
| `definition.setInstance` | Update a property on an existing instance. | name, property, value | name, property, value | -- |
| `definition.renameInstance` | Rename an instance. Updates FEL @instance() references. | name, newName | name, newName | -- |
| `definition.deleteInstance` | Remove an instance by name. | name | name | -- |

### definition-screener (8 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.setScreener` | Enable or disable the pre-form screener. | enabled | enabled | -- |
| `definition.addScreenerItem` | Add an item to the screener. | type, key, label, dataType | type, key | -- |
| `definition.deleteScreenerItem` | Remove a screener item by key. | key | key | -- |
| `definition.setScreenerBind` | Set bind properties for a screener field. | path, properties | path, properties | -- |
| `definition.addRoute` | Add a screener routing rule. | condition, target, label, insertIndex | condition, target | -- |
| `definition.setRouteProperty` | Update a property on an existing route. | index, property, value | index, property, value | -- |
| `definition.deleteRoute` | Remove a route by index. | index | index | -- |
| `definition.reorderRoute` | Move a route one position up or down. | index, direction | index, direction | -- |

### definition-migrations (7 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `definition.addMigration` | Add a version migration entry. | fromVersion, description | fromVersion | -- |
| `definition.deleteMigration` | Remove a migration by source version. | fromVersion | fromVersion | -- |
| `definition.setMigrationProperty` | Update a property on an existing migration. | fromVersion, property, value | fromVersion, property, value | -- |
| `definition.addFieldMapRule` | Add a field mapping rule to a migration. | fromVersion, source, target, transform, expression, insertIndex | fromVersion, source, target, transform | -- |
| `definition.setFieldMapRule` | Update a property on a migration field map rule. | fromVersion, index, property, value | fromVersion, index, property, value | -- |
| `definition.deleteFieldMapRule` | Remove a migration field map rule by index. | fromVersion, index | fromVersion, index | -- |
| `definition.setMigrationDefaults` | Set default values for newly added fields in a migration. | fromVersion, defaults | fromVersion, defaults | -- |

### theme (17 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `theme.setToken` | Set or remove a single design token. Supports dot-delimited paths for nested tokens. | key, value | key, value | -- |
| `theme.setTokens` | Replace the entire tokens object. | tokens | tokens | -- |
| `theme.setDefaults` | Set or remove a form-wide default presentation property (cascade level 1). | property, value | property, value | -- |
| `theme.addSelector` | Add a selector-based presentation override (cascade level 2). | match, apply, insertIndex | match, apply | -- |
| `theme.setSelector` | Update an existing selector's match criteria or applied properties. | index, match, apply | index | -- |
| `theme.deleteSelector` | Remove a selector by index. | index | index | -- |
| `theme.reorderSelector` | Move a selector one position up or down. Order determines cascade priority. | index, direction | index, direction | -- |
| `theme.setItemOverride` | Set or remove a per-item presentation override (cascade level 3). | itemKey, property, value | itemKey, property, value | -- |
| `theme.deleteItemOverride` | Remove all per-item presentation overrides for an item. | itemKey | itemKey | -- |
| `theme.setItemStyle` | Set a style property on a per-item override. | itemKey, property, value | itemKey, property, value | -- |
| `theme.setItemWidgetConfig` | Set a widget configuration property on a per-item override. | itemKey, property, value | itemKey, property, value | -- |
| `theme.setItemAccessibility` | Set an accessibility property on a per-item override. | itemKey, property, value | itemKey, property, value | -- |
| `theme.setBreakpoint` | Set or remove a named viewport breakpoint. | name, minWidth | name, minWidth | -- |
| `theme.setStylesheets` | Replace the list of external stylesheet URLs. | urls | urls | -- |
| `theme.setDocumentProperty` | Set a top-level theme document property. | property, value | property, value | -- |
| `theme.setExtension` | Set or remove an extension on the theme document. | key, value | key, value | -- |
| `theme.setTargetCompatibility` | Set the semver compatibility range for the target definition. | compatibleVersions | compatibleVersions | -- |

### mapping (16 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `mapping.setProperty` | Set a top-level mapping document property (direction, definitionRef, url). | property, value | property, value | -- |
| `mapping.setTargetSchema` | Set a property on the mapping target schema. | property, value | property, value | -- |
| `mapping.addRule` | Add a mapping rule. | sourcePath, targetPath, transform, insertIndex | -- | -- |
| `mapping.setRule` | Update a property on an existing mapping rule. | index, property, value | index, property, value | -- |
| `mapping.deleteRule` | Remove a mapping rule by index. | index | index | -- |
| `mapping.reorderRule` | Move a mapping rule one position up or down. | index, direction | index, direction | -- |
| `mapping.setAdapter` | Set the output adapter format and configuration. | format, config | format, config | -- |
| `mapping.setDefaults` | Set default values for the mapping output. | defaults | defaults | -- |
| `mapping.autoGenerateRules` | Auto-generate mapping rules from definition fields. | scopePath, priority, replace | -- | -- |
| `mapping.setExtension` | Set or remove an extension on the mapping document. | key, value | key, value | -- |
| `mapping.setRuleExtension` | Set or remove an extension on a specific mapping rule. | index, key, value | index, key, value | -- |
| `mapping.addInnerRule` | Add a nested inner rule to a mapping rule (for group/array transforms). | ruleIndex, sourcePath, targetPath, transform, insertIndex | ruleIndex | -- |
| `mapping.setInnerRule` | Update a property on a nested inner rule. | ruleIndex, innerIndex, property, value | ruleIndex, innerIndex, property, value | -- |
| `mapping.deleteInnerRule` | Remove a nested inner rule by index. | ruleIndex, innerIndex | ruleIndex, innerIndex | -- |
| `mapping.reorderInnerRule` | Move a nested inner rule one position up or down. | ruleIndex, innerIndex, direction | ruleIndex, innerIndex, direction | -- |
| `mapping.preview` | Execute mapping rules against sample data and return the transformed output. Does not mutate state. | sampleData, direction, ruleIndices | sampleData | `output`, `diagnostics`, `appliedRules`, `direction` |

### pages (13 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `pages.addPage` | Add a Page node to the component tree. Promotes pageMode to wizard if currently single or unset. | id, title, description | -- | -- |
| `pages.deletePage` | Remove a Page node from the component tree by ID. | id | id | -- |
| `pages.setMode` | Set the form presentation page mode. Ensures the component tree exists. | mode | mode | -- |
| `pages.reorderPages` | Move a Page node one position up or down among its siblings. | id, direction | id, direction | -- |
| `pages.movePageToIndex` | Move a Page node to an absolute index position, clamped to bounds. | id, targetIndex | id, targetIndex | -- |
| `pages.setPageProperty` | Set an arbitrary property on a Page node. | id, property, value | id, property, value | -- |
| `pages.assignItem` | Assign a bound item to a Page. Moves the node from its current location in the tree. | pageId, key, span | pageId, key | -- |
| `pages.unassignItem` | Remove a bound item from a Page and move it back to the root level. | pageId, key | pageId, key | -- |
| `pages.autoGenerate` | Auto-generate Page nodes from definition items using presentation.layout.page hints. Replaces all existing pages. | -- | -- | -- |
| `pages.setPages` | Replace the entire set of Page nodes in the component tree. | pages | pages | -- |
| `pages.reorderRegion` | Move a region (bound item) within a Page to a target index. | pageId, key, targetIndex | pageId, key, targetIndex | -- |
| `pages.renamePage` | Rename a Page node's title. | id, newId | id, newId | -- |
| `pages.setRegionProperty` | Set a property (span, start, or responsive) on a region within a Page. | pageId, key, property, value | pageId, key, property, value | -- |

### component-tree (7 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `component.addNode` | Add a node to the component tree. | parent, insertIndex, component, bind, props | parent, component | `nodeRef`: Reference to the new node. |
| `component.deleteNode` | Remove a node and its children from the component tree. | node | node | -- |
| `component.moveNode` | Move a node to a different parent or position. | source, targetParent, targetIndex | source, targetParent | -- |
| `component.reorderNode` | Move a node one position up or down among its siblings. | node, direction | node, direction | -- |
| `component.duplicateNode` | Deep-copy a node and insert the clone after the original. | node | node | `nodeRef`: Reference to the duplicated node. |
| `component.wrapNode` | Wrap a node in a new container node. | node, wrapper | node, wrapper | `nodeRef`: Reference to the new wrapper node. |
| `component.unwrapNode` | Replace a container node with its children (unwrap one level). | node | node | -- |

### component-properties (17 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `component.setNodeProperty` | Set an arbitrary property on a component tree node. | node, property, value | node, property, value | -- |
| `component.setNodeType` | Change a node's component type. | node, component, preserveProps | node, component | -- |
| `component.setNodeStyle` | Set a style property on a component tree node. | node, property, value | node, property, value | -- |
| `component.setNodeAccessibility` | Set an accessibility property on a component tree node. | node, property, value | node, property, value | -- |
| `component.spliceArrayProp` | Splice (insert/remove) items in an array-valued node property. | node, property, index, deleteCount, insert | node, property, index, deleteCount | -- |
| `component.setFieldWidget` | Set which widget component renders a field. Convenience command that finds the node by field key. | fieldKey, widget | fieldKey, widget | -- |
| `component.setResponsiveOverride` | Set or remove a responsive breakpoint override on a node. | node, breakpoint, patch | node, breakpoint, patch | -- |
| `component.setGroupRepeatable` | Toggle a group's repeatable flag in the component tree. | groupKey, repeatable | groupKey, repeatable | -- |
| `component.setGroupDisplayMode` | Set how a group renders (table, accordion, card, etc.). | groupKey, mode | groupKey, mode | -- |
| `component.setGroupDataTable` | Configure data table rendering for a repeatable group. | groupKey, config | groupKey, config | -- |
| `component.registerCustom` | Register a custom component template. | name, params, tree | name, params, tree | -- |
| `component.updateCustom` | Update an existing custom component template. | name, params, tree | name | -- |
| `component.deleteCustom` | Remove a custom component template. | name | name | -- |
| `component.renameCustom` | Rename a custom component template. | name, newName | name, newName | -- |
| `component.setToken` | Set or remove a Tier 3 design token override on the component document. | key, value | key, value | -- |
| `component.setBreakpoint` | Set or remove a named breakpoint on the component document. | name, minWidth | name, minWidth | -- |
| `component.setDocumentProperty` | Set a top-level component document property. | property, value | property, value | -- |

### project (5 commands)

| Command | Description | Parameters | Required Params | Returns |
|---------|-------------|------------|-----------------|---------|
| `project.import` | Replace one or more project artifacts wholesale. Clears undo history. | definition, component, theme, mapping | -- | -- |
| `project.importSubform` | Import items from an external definition into a target group. | definition, targetGroupPath, keyPrefix | definition | -- |
| `project.loadRegistry` | Load an extension registry into the project. | registry | registry | -- |
| `project.removeRegistry` | Unload an extension registry. | url | url | -- |
| `project.publish` | Publish the current definition as a versioned release. Creates a changelog and frozen snapshot. | version, summary | version | -- |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|------------|-------------|----------------|---------|
| `PayloadProperty` | Describes a single property in a command's payload. Defines the shape of each parameter a command accepts. | `name` (string, required), `type` (string, required), `description` (string), `required` (boolean, default false), `enum` (string[]), `default` (any) | Every command's `payload` array contains items of this type. |
| `NodeRef` | Reference to a component tree node. Provides two addressing modes for tree nodes. | `bind` (string) -- field key to identify a bound node, `nodeId` (string) -- direct node ID for unbound layout nodes | All `component.*` commands that accept `node`, `parent`, `source`, `targetParent` parameters. |
| `CommandEntry` | Defines a single command in the catalog, including its discriminant type, handler area, payload shape, side effects, return values, and examples. | `type` (string, required), `area` (string enum, required), `description` (string, required), `payload` (PayloadProperty[], required), `sideEffects` (string[]), `returns` (object), `examples` (array) | Top-level `commands` array. |

## Required Fields

### Top-level CommandEntry
- `type` -- command discriminant string
- `area` -- handler module area enum value
- `description` -- human-readable description
- `payload` -- array of PayloadProperty objects

### PayloadProperty
- `name` -- property name string
- `type` -- type annotation string

### Example objects (within CommandEntry.examples)
- `command` -- the example command object

### Per-command required payload parameters

Commands where ALL parameters are optional (no required params):
- `definition.addVariable`, `definition.addInstance`, `pages.addPage`, `pages.autoGenerate`, `mapping.addRule`, `mapping.autoGenerateRules`, `mapping.addInnerRule`, `project.import`

Commands with required params are listed in the Command Definitions tables above.

## Enumerations

### CommandEntry.area
Handler area grouping for commands:
```
"definition-items", "definition-binds", "definition-metadata", "definition-pages",
"definition-shapes", "definition-variables", "definition-optionsets", "definition-instances",
"definition-screener", "definition-migrations", "theme", "mapping",
"pages", "component-tree", "component-properties", "project"
```

### CommandEntry.sideEffects
Side effects triggered after command execution:
```
"rebuildComponentTree", "clearHistory"
```

### definition.addItem > type
Item type discriminant:
```
"field", "group", "display"
```

### definition.reorderItem > direction
```
"up", "down"
```

### definition.addShape > severity
```
"error", "warning", "info"
```

### definition.addShape > timing
```
"continuous", "submit", "demand"
```

### definition.setShapeComposition > mode
```
"and", "or", "xone", "not"
```

### definition.reorderRoute > direction
```
"up", "down"
```

### theme.reorderSelector > direction
```
"up", "down"
```

### mapping.reorderRule > direction
```
"up", "down"
```

### mapping.reorderInnerRule > direction
```
"up", "down"
```

### mapping.preview > direction
```
"forward", "reverse"
```

### pages.setMode > mode
```
"single", "wizard", "tabs"
```

### pages.reorderPages > direction
```
"up", "down"
```

### pages.setRegionProperty > property
```
"span", "start", "responsive"
```

### component.reorderNode > direction
```
"up", "down"
```

## Cross-References

All `$ref` references are internal to this schema file (no external schema file references):

| Reference | Used In |
|-----------|---------|
| `#/$defs/CommandEntry` | `commands` array items |
| `#/$defs/PayloadProperty` | `CommandEntry.payload` array items |

The `NodeRef` definition is referenced conceptually by component commands (their `node`, `parent`, `source`, `targetParent` parameters are typed as `"object"` with description pointing to the `{ bind?, nodeId? }` shape) but not via formal `$ref`.

No `$ref` to external schema files (e.g., `definition.schema.json`, `theme.schema.json`) -- this catalog is self-contained.

## Validation Constraints

### Discriminator Pattern
- Commands are discriminated by `type` string (e.g., `"definition.addItem"`, `"theme.setToken"`). The `type` field on `CommandEntry` acts as the dispatch key for `RawProject.dispatch()`.
- The `area` enum acts as a secondary grouping discriminator for handler routing.

### additionalProperties
- `PayloadProperty`: `additionalProperties: false` -- strictly validates property shape.
- `CommandEntry`: `additionalProperties: false` -- no extra fields allowed on command definitions.

### Const Values
- `version`: constrained to exactly `"0.1"`.

### Default Values
- `PayloadProperty.required`: defaults to `false`.
- `component.setNodeType > preserveProps`: defaults to `false`.

### Null Semantics
- Many commands use `"Null to remove"` convention: setting a value to `null` removes the property. This applies to: `definition.setItemProperty`, `definition.setDefinitionProperty`, `definition.setFormPresentation`, `definition.setItemExtension`, `theme.setToken`, `theme.setDefaults`, `theme.setItemOverride`, `theme.setItemStyle`, `theme.setItemWidgetConfig`, `theme.setItemAccessibility`, `theme.setDocumentProperty`, `theme.setExtension`, `theme.setBreakpoint`, `mapping.setProperty`, `mapping.setTargetSchema`, `mapping.setExtension`, `mapping.setRuleExtension`, `component.setNodeProperty`, `component.setNodeStyle`, `component.setNodeAccessibility`, `component.setToken`, `component.setBreakpoint`, `component.setDocumentProperty`.
- **Exception**: `definition.setShapeProperty` has NO null-delete semantics -- setting to null stores null literally. Use `definition.deleteShape` to remove.

### Side Effects
Commands that trigger `rebuildComponentTree`:
- `definition.addItem`, `definition.deleteItem`, `definition.renameItem`, `definition.moveItem`, `definition.reorderItem`, `definition.duplicateItem`, `definition.setGroupRef`, `component.setGroupRepeatable`, `project.import`, `project.importSubform`

Commands that trigger `clearHistory`:
- `project.import`

### NodeRef Addressing
Component tree commands accept node references as objects with two optional addressing modes:
- `bind`: field key (for field-bound nodes)
- `nodeId`: direct node identifier (for unbound layout nodes)

At least one must be provided; the `NodeRef` schema does not enforce this via `oneOf` -- it relies on runtime validation.

### Mixed-Type Parameters
- `definition.setFieldOptions > options`: typed as `"array|string"` -- accepts either an array of `{value, label}` objects (inline options) or a string (named option set reference).
- Several `value` parameters are typed as `"any"` indicating they accept arbitrary JSON values.

### Command Count by Area

| Area | Count |
|------|-------|
| definition-items | 6 |
| definition-binds | 5 |
| definition-metadata | 1 |
| definition-pages | 3 |
| definition-shapes | 5 |
| definition-variables | 3 |
| definition-optionsets | 3 |
| definition-instances | 4 |
| definition-screener | 8 |
| definition-migrations | 7 |
| theme | 17 |
| mapping | 16 |
| pages | 13 |
| component-tree | 7 |
| component-properties | 17 |
| project | 5 |
| **Total** | **120** |
