# formspec-studio-core

Behavior-driven authoring API for Formspec. 51 helper methods that translate form-author intent into command sequences against the raw project core.

This package composes `formspec-core` internally via dependency injection -- the `Project` class wraps an `IProjectCore` and exposes a higher-level API. Consumers import types from this package, never from `formspec-core`.

## Install

```bash
npm install formspec-studio-core
```

Runtime dependencies: `formspec-core`, `formspec-engine`, `formspec-types`

## Quick Start

```ts
import { createProject } from 'formspec-studio-core';

const project = createProject();

project.addField({ key: 'fullName', label: 'Full name', type: 'text' });
project.addField({ key: 'age', label: 'Age', type: 'integer' });
project.setValidation('age', { constraint: '$age >= 18', message: 'Must be 18 or older' });

const bundle = project.export();
```

## Architecture

`Project` uses composition, not inheritance:

```
createProject(options?)
  └─ new Project(createRawProject(options))
       └─ this.core: IProjectCore  (private, not exposed)
```

The `IProjectCore` from `formspec-core` handles command dispatch, undo/redo, normalization, and diagnostics. `Project` translates behavior-driven helper calls into command batches dispatched against the core.

**No escape hatches:** There is no `.raw` getter, no `.dispatch()`, and no `.applyCommands()` on `Project`. All mutations go through the 51 helper methods.

## Read-Only State

```ts
project.state       // ProjectSnapshot (definition + component + theme + mapping)
project.definition  // FormDefinition
project.component   // ComponentDocument
project.theme       // ThemeDocument
project.mapping     // MappingDocument

project.itemAt('address.city')    // FormItem | undefined
project.searchItems({ type: 'field', dataType: 'string' })
project.statistics()              // ProjectStatistics
```

## Helper Methods

All helpers return `HelperResult` with warnings and the dispatched commands. Helpers throw `HelperError` on pre-validation failure (e.g., `ITEM_NOT_FOUND`, `DUPLICATE_KEY`).

**Fields & Groups:**
`addField`, `addGroup`, `addDisplay`, `removeItem`, `moveItem`, `copyItem`, `updateItem`

**Validation & Logic:**
`setValidation`, `addShape`, `updateShape`, `removeShape`, `addVariable`, `updateVariable`, `removeVariable`

**Instances & Options:**
`addInstance`, `updateInstance`, `removeInstance`, `setChoices`, `createOptionSet`, `deleteOptionSet`

**Repeatable Sections:**
`enableRepeat`, `disableRepeat`

**Layout & Flow:**
`setLayout`, `arrangeFlow`, `setFieldWidget`, `addContent`

**Theme:**
`setThemeDefaults`, `setItemOverride`, `removeItemOverride`, `addSelector`, `removeSelector`, `setThemeTokens`

**Mapping:**
`addMappingRule`, `updateMappingRule`, `removeMappingRule`

**Screener:**
`enableScreener`, `disableScreener`, `addScreenerField`, `removeScreenerField`, `addScreenerRoute`, `removeScreenerRoute`, `setScreenerRouteProperty`

**Metadata & Versioning:**
`setMetadata`, `publish`

## Type Vocabulary

Studio-core defines its own operational types (independent of formspec-core):

- `ProjectBundle`, `ProjectSnapshot` -- exported artifact bundles
- `ProjectStatistics` -- aggregate complexity metrics
- `Diagnostic`, `Diagnostics` -- validation results
- `LogEntry` -- timestamped command history
- `ChangeListener` -- narrowed to `() => void` (core's listener takes state/event args)
- `CreateProjectOptions` -- simplified factory options (no middleware, no raw ProjectState)

Schema-derived types (`FormDefinition`, `FormItem`, `ComponentDocument`, etc.) come from `formspec-types` and are re-exported here.

## Evaluation Helpers

For form preview and response validation without a full engine:

```ts
import { previewForm, validateResponse } from 'formspec-studio-core';

const preview = previewForm(project.export());
const report = validateResponse(project.export(), userResponse);
```

## Development

```bash
npm run build        # tsc
npm run test         # vitest run (222 tests)
npm run test:watch   # vitest
```
