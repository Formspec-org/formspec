# formspec-types

TypeScript types generated from the Formspec JSON schemas. Zero runtime dependencies.

This package is the shared type vocabulary for all Formspec packages. Types map directly to their source schema in `schemas/`.

## Install

```bash
npm install formspec-types
```

## Usage

```ts
import type { FormDefinition, FormItem, ValidationReport } from 'formspec-types';
```

Packages that depend on `formspec-core` or `formspec-studio-core` receive these types as re-exports. Import directly from `formspec-types` only when you need the schema types without pulling in runtime code.

## Exported types

### Definition (`schemas/definition.schema.json`)

| Type | Description |
|------|-------------|
| `FormDefinition` | Top-level form definition document |
| `FormItem` | A single form item — field, group, or display element — with all conditional properties typed |
| `FormBind` | Field bind constraints (required, calculate, readonly, constraint, etc.) |
| `FormShape` | A cross-field validation shape rule |
| `FormVariable` | A computed variable with a FEL expression |
| `FormInstance` | An external data source instance |
| `FormOption` | A single choice option `{ value, label }` |
| `FormScreener` | Pre-form screener with fields and routing rules |

The augmented types above (`FormItem`, `FormBind`, `FormDefinition`, `FormScreener`) extend the generated schema types with properties that the JSON Schema expresses conditionally (via `if/then`) and that code-generation cannot fully represent. Raw generated types are also available as `Item`, `Bind`, `FormDefinition` (generated), `Screener`, `Shape`, `Variable`, `Instance`, `OptionEntry`, `Route`, `Presentation`, `FELExpression`.

### Component (`schemas/component.schema.json`)

`ComponentDocument`, `AnyComponent`, `Page`, `Stack`, `Grid`, `Card`, `Panel`, `Wizard`, `Tabs`, `Columns`, `Accordion`, `Collapsible`, `ConditionalGroup`, `TextInput`, `NumberInput`, `DatePicker`, `Select`, `CheckboxGroup`, `RadioGroup`, `Toggle`, `MoneyInput`, `Slider`, `Rating`, `FileUpload`, `Signature`, `Heading`, `Text`, `Divider`, `Alert`, `Badge`, `ProgressBar`, `Summary`, `ValidationSummary`, `DataTable`, `SubmitButton`, `Modal`, `Popover`, `Spacer`, `CustomComponentDef`, `CustomComponentRef`, `ComponentBase`, `StyleMap`, `AccessibilityBlock`, `ResponsiveOverrides`, `Breakpoints`, `Tokens`, `TargetDefinition`, `ChildrenArray`

### Theme (`schemas/theme.schema.json`)

`ThemeDocument`, `Selector`, `SelectorMatch`, `PresentationBlock`, `PageLayout`, `Region`

### Response (`schemas/response.schema.json`)

`FormResponse` — a completed or in-progress form submission, pinned to a specific definition version.

### Validation (`schemas/validation-report.schema.json`, `schemas/validation-result.schema.json`)

`ValidationReport` — aggregated validation output with `valid`, `results`, and `counts`.
`ValidationResult` / `FormspecValidationResult` — a single validation finding with path, severity, and constraint kind.

### Mapping (`schemas/mapping.schema.json`)

`MappingDocument`, `FieldRule`, `InnerRule`, `Coerce`, `ValueMap`, `ReverseOverride`, `ArrayDescriptor`, `JsonAdapter`, `XmlAdapter`, `CsvAdapter`, `TargetSchema`

### Registry (`schemas/registry.schema.json`)

`RegistryDocument`, `RegistryEntry`, `Publisher`

### FEL functions (`schemas/fel-functions.schema.json`)

`FELFunctionCatalog`, `FunctionEntry`, `Parameter`, `FELType`

## Design notes

- **Schema-accurate** — `FormItem.dataType` accepts any `string`, not a narrow literal union. Extension registries add data types beyond the 14 core built-ins, so the type must stay open.
- **Zero dependencies** — pure type declarations, no runtime code.
- **Single source of truth** — `formspec-core` and `formspec-studio-core` both re-export from here, so all packages share identical definitions with no boundary casts.

## Regenerating types

Types are generated from JSON schemas by `scripts/generate-types.mjs`.

```bash
npm run build        # generate types, then tsc
npm run types:generate   # generate only, no tsc
```

Do not edit files under `src/generated/`. Edit the source schemas in `schemas/` instead.
