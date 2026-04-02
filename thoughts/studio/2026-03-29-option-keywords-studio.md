# Option `keywords` in Studio (2026-03-29)

Definition **OptionEntry** may include optional **`keywords: string[]`** (see `schemas/definition.schema.json`). Runtimes use them for searchable Select / combobox type-ahead (alongside value and label).

**Studio**

- Inline field options and **Option Sets** editors expose a comma-separated **Keywords** field. Values round-trip through `project.updateItem` / `updateOptionSet`.
- Helpers: `parseCommaSeparatedKeywords` and `formatCommaSeparatedKeywords` in `@formspec-org/studio-core`.

**studio-core**

- `ChoiceOption` includes optional `keywords` so `defineChoices` and `ItemChanges.options` match the schema.

**Rust (`formspec-core`)**

- `resolve_option_sets_on_definition` clones option arrays/objects as JSON; **keywords** are preserved. Covered by `inlines_preserves_keywords_on_options` in `option_sets.rs`.
