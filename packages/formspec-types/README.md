# formspec-types

TypeScript interfaces derived from the Formspec JSON schemas. Zero runtime dependencies.

This package is the shared type vocabulary for all Formspec packages. Every interface maps 1:1 to a schema in `schemas/`:

| Interface | Schema source |
|-----------|--------------|
| `FormDefinition`, `FormItem`, `FormBind`, `FormShape`, `FormVariable`, `FormInstance`, `FormOption` | `schemas/definition.schema.json` |
| `ComponentDocument` | `schemas/component.schema.json` |
| `ThemeDocument` | `schemas/theme.schema.json` |
| `MappingDocument` | `schemas/mapping.schema.json` |

All document interfaces include `[key: string]: unknown` index signatures for spec extension support (`x-*` properties).

## Install

```bash
npm install formspec-types
```

## Usage

```ts
import type { FormDefinition, FormItem, ComponentDocument } from 'formspec-types';
```

Consumers that use `formspec-core` or `formspec-studio-core` get these types re-exported automatically. Direct imports from `formspec-types` are only needed in packages that want the schema types without pulling in runtime code.

## Design

- **Schema-accurate** -- `FormItem.dataType` is `string` (not a narrow literal union) because extension registries add data types beyond the 14 core built-ins.
- **Zero dependencies** -- pure type declarations, no runtime code.
- **Single source of truth** -- both `formspec-core` and `formspec-studio-core` re-export from here, so all packages share identical type definitions with no boundary casts.

## Development

```bash
npm run build   # tsc
```
