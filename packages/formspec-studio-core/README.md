# formspec-studio-core

Pure TypeScript library for creating and editing Formspec artifact bundles. Every edit is a serializable command dispatched against a `Project` instance.

This package is the **authoring core** that powers Formspec tooling — CLI tools, LLM agents, and visual editors like the Form Builder all drive it through the same command API. It uses `formspec-engine` for FEL compilation, dependency analysis, and schema validation, but has no framework bindings, no singleton state, and no UI concerns.

It manages four editable artifacts together:

- `definition` — form structure and behavior (items, binds, shapes, variables)
- `component` — UI tree and widget configuration
- `theme` — presentation tokens and cascade rules
- `mapping` — inbound and outbound data transforms

## Install

```bash
npm install formspec-studio-core
```

Runtime dependency: `formspec-engine`

## Quick Start

```ts
import { createProject } from 'formspec-studio-core';

const project = createProject();

project.dispatch({
  type: 'definition.setFormTitle',
  payload: { title: 'Eligibility Intake' },
});

project.batch([
  {
    type: 'definition.addItem',
    payload: {
      type: 'field',
      key: 'fullName',
      label: 'Full name',
      dataType: 'string',
    },
  },
  {
    type: 'definition.addItem',
    payload: {
      type: 'field',
      key: 'age',
      label: 'Age',
      dataType: 'integer',
    },
  },
  {
    type: 'definition.setBind',
    payload: {
      path: 'age',
      properties: {
        required: true,
        constraint: '$age >= 18',
        constraintMessage: 'Must be 18 or older',
      },
    },
  },
]);

console.log(project.fieldPaths());
console.log(project.bindFor('age'));

const bundle = project.export();
```

## Core Model

`createProject()` returns a `Project` that owns a full `ProjectState`:

```ts
interface ProjectState {
  definition: FormspecDefinition;
  component: FormspecComponentDocument;
  theme: FormspecThemeDocument;
  mapping: FormspecMappingDocument;
  extensions: ExtensionsState;
  versioning: VersioningState;
}
```

The important rule is simple: read through `project.state` and query helpers, mutate only through commands.

Every dispatch follows the same flow:

1. Run middleware chain (may transform or reject the command)
2. Clone current state and apply the command handler
3. Rebuild component tree (if the handler signals structural change)
4. Run cross-artifact normalization
5. Push history snapshot
6. Notify subscribers

That gives you atomic edits, undo/redo, command logs, and easy replay.

## Public API

The main mutation surface:

- `createProject(options?)`
- `project.dispatch(command)`
- `project.batch(commands)`
- `project.undo()` / `project.redo()`
- `project.onChange(listener)`
- `project.export()`

State accessors:

- `project.state` — full `ProjectState` (read-only)
- `project.definition` / `.component` / `.theme` / `.mapping` — individual artifacts
- `project.canUndo` / `project.canRedo` — undo/redo availability
- `project.log` — serializable command log (replayable on a fresh project)

Query helpers:

**Structure**
- `fieldPaths()` — all leaf field paths in document order
- `itemAt(path)` — resolve an item by dot-path
- `searchItems(filter)` — filter by type, dataType, label, or extension usage
- `statistics()` — field/group/bind/expression counts and max nesting depth
- `instanceNames()` — declared external data source instance names
- `variableNames()` — declared named FEL variable names
- `optionSetUsage(name)` — field paths that reference a given option set

**Cross-artifact**
- `bindFor(path)` — bind properties for a field path
- `componentFor(fieldKey)` — component tree node bound to a field
- `effectivePresentation(fieldKey)` — resolved theme cascade for a field
- `unboundItems()` — fields with no component tree node
- `resolveToken(key)` — design token value through the two-tier cascade
- `resolveExtension(name)` — registry entry for an extension name

**FEL & expressions**
- `parseFEL(expression, context?)` — parse and validate a FEL expression inline
- `availableReferences(context?)` — scope-aware reference set for autocomplete
- `felFunctionCatalog()` — built-in and extension FEL functions
- `allExpressions()` — all FEL expressions with artifact locations
- `expressionDependencies(expression)` — field paths referenced by an expression
- `dependencyGraph()` — full cross-artifact FEL dependency graph with cycle detection
- `fieldDependents(fieldPath)` — reverse lookup: binds/shapes/variables referencing a field
- `variableDependents(variableName)` — bind paths referencing a named variable

**Registries & types**
- `allDataTypes()` — 13 core types plus extension-provided data types
- `listRegistries()` — loaded registries with summary metadata
- `browseExtensions(filter?)` — browse extension entries across registries

**Diagnostics & versioning**
- `diagnose()` — multi-pass validation (structural, expressions, extensions, consistency)
- `previewChangelog()` — structured diff preview without publishing
- `diffFromBaseline(fromVersion?)` — raw change list from a baseline version

## Command Catalog

122 commands across 15 areas. Commands are plain serializable objects:

```ts
{
  type: 'definition.addItem',
  payload: {
    type: 'field',
    key: 'email',
    label: 'Email',
    dataType: 'string',
  },
}
```

The full command catalog — every type string, payload shape, and side effect — is machine-readable at [`schemas/studio-commands.schema.json`](../../schemas/studio-commands.schema.json). LLM agents and CLI tools can consume this catalog to discover and construct valid commands.

Command areas:

| Area | Commands | Description |
|------|----------|-------------|
| `definition.*` | 48 | Items, binds, shapes, variables, option sets, instances, pages, screener, migrations, metadata |
| `component.*` | 25 | Component tree structure, node properties, custom components, responsive overrides |
| `theme.*` | 28 | Tokens, defaults, selectors, item overrides, pages, grid regions, breakpoints, stylesheets |
| `mapping.*` | 16 | Rules, inner rules, adapter config, preview, extensions |
| `project.*` | 5 | Import, subform import, registry loading, publishing |

Handlers self-register at module load time. Consumers do not interact with handlers directly; `Project.dispatch()` routes to the correct handler.

## History and Subscriptions

Each `Project` instance maintains its own undo stack, redo stack, and append-only command log.

```ts
const unsubscribe = project.onChange((state, event) => {
  console.log(event.source, event.command.type, event.result);
});

project.dispatch({
  type: 'definition.setFormTitle',
  payload: { title: 'Updated title' },
});

project.undo();
unsubscribe();
```

`batch()` groups multiple commands into one notification and one undo entry.

## Diagnostics and Analysis

`formspec-studio-core` is not just a mutator. It also exposes authoring-time analysis backed by `formspec-engine`:

`diagnose()` runs four passes on demand and returns grouped results:

- **structural** — JSON Schema validation for all four artifacts
- **expressions** — parser-backed FEL validation for every indexed expression
- **extensions** — registry-backed checks for unresolved extension names
- **consistency** — cross-artifact reference checks (component binds, mapping source paths, theme selectors, stale overrides)

Each `Diagnostic` carries an `artifact`, `path`, `severity` (`error`/`warning`/`info`), machine-readable `code`, and human-readable `message`. Aggregate counts are included for quick status display.

## Development

```bash
npm run build
npm run test
```

Package-local references:

- [API.llm.md](./API.llm.md) — TypeScript API reference (Project class, query methods, interfaces)
- [Command Catalog](../../schemas/studio-commands.schema.json) — Machine-readable command catalog (122 commands, payload schemas)
- [api-spec-v3.md](./research/api-spec-v3.md) — Design research
