# formspec-studio-core

Behavior-driven authoring API for Formspec. The `Project` class wraps `formspec-core`'s `RawProject` via the `IProjectCore` interface and exposes 51+ helper methods that translate form-author intent into command sequences.

Consumers import all types from this package. Never import from `formspec-core` directly.

## Install

```bash
npm install formspec-studio-core
```

Dependencies: `formspec-core`, `formspec-engine`, `formspec-types`. This package imports **`formspec-engine`** via subpaths (`fel-runtime`, `fel-tools`, `init-formspec-engine`, `render`) so the default engine barrel is not pulled for studio-core’s static graph.

## Quick Start

```ts
import { createProject } from 'formspec-studio-core';

const project = createProject();

project.addField('fullName', 'Full name', 'text');
project.addField('age', 'Age', 'integer');
project.addValidation('age', '$age >= 18', 'Must be 18 or older');

const bundle = project.export();
```

Seed from an existing bundle:

```ts
const project = createProject({ seed: existingBundle });
```

## Architecture

`Project` uses composition, not inheritance:

```
createProject(options?)
  └─ new Project(createRawProject(options))
       └─ this.core: IProjectCore  (private)
```

`IProjectCore` (from `formspec-core`) handles command dispatch, undo/redo, normalization, and diagnostics. `Project` translates helper calls into batched commands dispatched against the core.

There is no `.dispatch()`, `.applyCommands()`, or `.raw` getter on `Project`. All mutations go through the helper methods.

## Layering

Formspec remains layered:

- `definition.json` is the required base artifact
- `theme.json` is optional and still valid as a hand-authored mid-tier layer
- `component.json` is optional and has highest precedence when present

`formspec-studio-core` deliberately does not collapse those layers into one
artifact. Its job is to give Studio a clean authoring API without pretending
that Theme and Components are the same surface.

## Read-Only State

```ts
project.state       // ProjectSnapshot — { definition, component, theme, mapping }
project.definition  // FormDefinition
project.component   // ComponentDocument
project.theme       // ThemeDocument
project.mapping     // MappingDocument

project.itemAt('address.city')                        // FormItem | undefined
project.searchItems({ type: 'field', dataType: 'string' })
project.fieldPaths()                                  // string[]
project.statistics()                                  // ProjectStatistics
project.diagnose()                                    // Diagnostics
project.export()                                      // ProjectBundle
project.commandHistory()                              // readonly LogEntry[]
```

FEL utilities:

```ts
project.parseFEL(expression, context?)
project.felFunctionCatalog()
project.availableReferences(context?)
project.expressionDependencies(expression)
project.fieldDependents(fieldPath)
```

## History

```ts
project.undo()
project.redo()
project.canUndo   // boolean
project.canRedo   // boolean
project.onChange(() => rerender())  // returns unsubscribe fn
```

## Helper Methods

All helpers return `HelperResult`. Helpers throw `HelperError` on pre-validation failure.

**Fields and groups:**

- `addField(path, label, type, props?)` — type aliases: `text`, `integer`, `decimal`, `boolean`, `date`, `choice`, `multichoice`, `currency`, `email`, `phone`, `file`, `signature`, `rating`, `slider`
- `addGroup(path, label, props?)`
- `addContent(path, body, kind?)` — kinds: `heading`, `paragraph`, `instructions`, `alert`, `banner`, `divider`
- `removeItem(path)` — cascades: cleans up binds, shapes, mapping rules, screener routes
- `moveItem(path, targetParentPath?, targetIndex?)`
- `moveItems(moves[])` — atomic batch move
- `renameItem(path, newKey)`
- `reorderItem(path, direction)`
- `copyItem(path, deep?)`
- `updateItem(path, changes)` — routes keys to definition, bind, component, theme handlers
- `wrapItemsInGroup(paths[], label?)`
- `wrapInLayoutComponent(path, component)` — `'Card'`, `'Stack'`, `'Collapsible'`
- `batchDeleteItems(paths[])`
- `batchDuplicateItems(paths[])`

**Logic and validation:**

- `showWhen(target, condition)` — sets `relevant` bind; validates FEL
- `readonlyWhen(target, condition)` — sets `readonly` bind; validates FEL
- `require(target, condition?)` — sets `required` bind
- `calculate(target, expression)` — sets `calculate` bind; validates FEL
- `branch(on, paths[], otherwise?)` — wires conditional visibility across multiple targets
- `addValidation(target, rule, message, options?)` — adds a shape rule
- `updateValidation(shapeId, changes)` — updates rule, message, timing, severity, activeWhen
- `removeValidation(shapeId)`

**Variables and instances:**

- `addVariable(name, expression, scope?)`
- `updateVariable(name, expression)`
- `removeVariable(name)` — warns on dangling references
- `renameVariable(name, newName)` — **not implemented** (throws `HelperError` `NOT_IMPLEMENTED` until core adds a rename command)
- `addInstance(name, props)`
- `updateInstance(name, changes)`
- `renameInstance(name, newName)`
- `removeInstance(name)` — warns on dangling references

**Choices:**

- `defineChoices(name, options[])` — defines a named option set
- `updateOptionSet(name, property, value)`
- `deleteOptionSet(name)`

**Repeatable sections:**

- `makeRepeatable(target, props?)` — requires a group item; sets min/max/labels

**Layout and flow:**

- `applyLayout(targets, arrangement)` — arrangements: `columns-2`, `columns-3`, `columns-4`, `card`, `sidebar`, `inline`
- `applyStyle(path, properties)`
- `applyStyleAll(properties, target?, dataType?)` — target: `'form'` or `'fields'`
- `moveLayoutNode(sourceNodeId, targetParentNodeId, targetIndex)`
- `addLayoutNode(parentNodeId, component)`
- `unwrapLayoutNode(nodeId)`
- `deleteLayoutNode(nodeId)`
- `addSubmitButton(label?, pageId?)`
- `setFlow(mode, props?)` — modes: `'single'`, `'wizard'`, `'tabs'`

**Pages:**

- `addPage(title, description?)` — creates definition group + component Page node + wizard mode
- `removePage(pageId)` — removes the Page node and leaves definition items unassigned
- `reorderPage(pageId, direction)`
- `updatePage(pageId, changes)`
- `renamePage(pageId, newId)`
- `placeOnPage(target, pageId, options?)`
- `unplaceFromPage(target, pageId)`

**Theme:**

- `setToken(key, value)`
- `setThemeDefault(property, value)`
- `setBreakpoint(name, minWidth)`
- `addThemeSelector(match, apply)`
- `updateThemeSelector(index, changes)`
- `deleteThemeSelector(index)`
- `reorderThemeSelector(index, direction)`
- `setItemOverride(itemKey, property, value)`
- `clearItemOverrides(itemKey)`
- `setRegionKey` / `updateRegion`

**Mapping:**

- `mapField(sourcePath, targetPath)`
- `unmapField(sourcePath)`
- `setMappingProperty(property, value)`

**Screener:**

- `setScreener(enabled)`
- `addScreenField(key, label, type, props?)`
- `removeScreenField(key)`
- `addScreenRoute(condition, target, label?)`
- `updateScreenRoute(routeIndex, changes)`
- `reorderScreenRoute(routeIndex, direction)`
- `removeScreenRoute(routeIndex)` — blocks deletion of the last route

**Metadata:**

- `setMetadata(changes)` — title, description, version, status, pageMode, density, labelPosition, etc.
- `loadBundle(bundle)` — imports a partial bundle; undoable

## HelperResult and HelperError

```ts
interface HelperResult {
  summary: string;
  action: { helper: string; params: Record<string, unknown> };
  affectedPaths: string[];
  createdId?: string;
  warnings?: HelperWarning[];
}

class HelperError extends Error {
  code: string;    // see error codes below
  detail?: object;
}
```

**Error codes:**

| Code | When thrown |
|---|---|
| `PATH_NOT_FOUND` | Target path does not exist (includes `similarPaths` in detail) |
| `DUPLICATE_KEY` | Key already exists at the resolved path |
| `INVALID_TYPE` | Unrecognized field type alias |
| `INVALID_PROPS` | Conflicting or invalid props (e.g., both `choices` and `choicesFrom`) |
| `INVALID_FEL` | FEL expression fails to parse |
| `INVALID_KEY` | Unknown key in `updateItem` or `setMetadata` changes |
| `INVALID_TARGET_TYPE` | Operation requires a different item type (e.g., `makeRepeatable` on a non-group) |
| `PAGE_NOT_FOUND` | Specified page ID does not exist |
| `VARIABLE_NOT_FOUND` | Variable name not in the definition |
| `INSTANCE_NOT_FOUND` | Instance name not in the definition |
| `ROUTE_OUT_OF_BOUNDS` | Screener route index out of range |
| `ROUTE_MIN_COUNT` | Cannot delete the last screener route |

## Evaluation Helpers

`previewForm` and `validateResponse` run a `FormEngine` instance against the current definition without a browser.

```ts
import { previewForm, validateResponse } from 'formspec-studio-core';

// Simulate respondent state (optionally with scenario values)
const preview = previewForm(project, { age: 25 });
// preview.visibleFields, .hiddenFields, .currentValues, .requiredFields,
// .validationState, .pages

// Validate a response document
const report = validateResponse(project, { fullName: 'Alice', age: 25 });
// report is a ValidationReport from formspec-engine
```

## Type Vocabulary

Schema-derived types re-exported from `formspec-types`:
`FormItem`, `FormBind`, `FormShape`, `FormVariable`, `FormInstance`, `FormOption`, `FormDefinition`, `ComponentDocument`, `ThemeDocument`, `MappingDocument`

Operational types from `formspec-core` (re-exported):
`ProjectBundle`, `ProjectStatistics`, `Diagnostic`, `Diagnostics`, `LogEntry`

Studio-core types:
`ProjectSnapshot`, `ChangeListener`, `CreateProjectOptions`

Helper types:
`HelperResult`, `HelperWarning`, `HelperError`, `FieldProps`, `GroupProps`, `RepeatProps`, `BranchPath`, `LayoutArrangement`, `PlacementOptions`, `FlowProps`, `ValidationOptions`, `InstanceProps`, `ItemChanges`, `MetadataChanges`, `ChoiceOption`

Utilities re-exported from `formspec-core`:
`resolveThemeCascade`, `resolvePageStructure` (and related types)

## Field Type Aliases

`addField` accepts these type aliases:

| Alias | dataType | Default widget |
|---|---|---|
| `text`, `string` | `text` / `string` | TextInput |
| `integer` | `integer` | NumberInput |
| `decimal`, `number` | `decimal` | NumberInput |
| `boolean` | `boolean` | Toggle |
| `date` | `date` | DatePicker |
| `datetime`, `dateTime`, `time` | `dateTime` / `time` | DatePicker |
| `choice` | `choice` | Select |
| `multichoice`, `multiChoice` | `multiChoice` | CheckboxGroup |
| `currency`, `money` | `money` | MoneyInput |
| `file`, `attachment` | `attachment` | FileUpload |
| `signature` | `attachment` | Signature |
| `rating` | `integer` | Rating |
| `slider` | `decimal` | Slider |
| `email` | `string` | TextInput + email constraint |
| `phone` | `string` | TextInput + phone constraint |
| `url`, `uri` | `uri` | TextInput |

## Development

```bash
npm run build        # tsc
npm run test         # vitest run (222 tests)
npm run test:watch   # vitest
```
