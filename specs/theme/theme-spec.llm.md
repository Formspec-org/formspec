# Formspec Theme Specification (LLM Reference)

A sidecar JSON document that controls how a Formspec Definition is rendered. Tier 2 in the presentation hierarchy (Tier 1 = inline hints, Tier 3 = Component spec). Multiple themes can target the same definition for platform-specific rendering (web, mobile, PDF, kiosk).

## Theme Document Structure

Required: `$formspecTheme` ("1.0"), `version`, `targetDefinition` (with `url` and optional `compatibleVersions` semver range).

Optional: `url`, `name`, `title`, `description`, `platform` ("web"/"mobile"/"pdf"/"print"/"kiosk"/"universal"), `tokens`, `defaults`, `selectors`, `items`, `pages`, `breakpoints`, `extensions`.

## Design Tokens

Flat key-value map in `tokens`. Keys are dot-delimited names, values are strings or numbers (no nesting/arrays/booleans/null).

**Categories** (recommended prefixes): `color.*`, `spacing.*`, `typography.*`, `border.*`, `elevation.*`, `x-*` (custom).

**Reference syntax**: `$token.color.primary` in `style` and `widgetConfig` values. Resolved at theme-application time. No recursive references. Unresolved → platform default + warning.

## Widget Catalog

Uses the same vocabulary as core spec `widgetHint`. Adds two capabilities:
1. **`widgetConfig`** — typed per-widget configuration (e.g., `searchable`, `maxLength`, `min`/`max`)
2. **`fallback`** arrays — ordered fallback chain when widget unavailable

**Required widgets** (must support): `textInput`, `textarea`, `numberInput`, `checkbox`, `datePicker`, `dropdown`, `checkboxGroup`, `fileUpload`, `moneyInput`.

**Progressive widgets** (should support, with fallbacks): `slider`→`numberInput`, `toggle`→`checkbox`, `radio`→`dropdown`, `autocomplete`→`dropdown`, `richText`→`textarea`, `signature`→`fileUpload`, `camera`→`fileUpload`, etc.

Custom widgets: `x-` prefixed, must always have fallback chain ending with standard widget.

## Selector Cascade (5 levels, higher wins)

| Level | Source | Description |
|-------|--------|-------------|
| 3 | Theme `items.{key}` | Per-item override (highest) |
| 2 | Theme `selectors[]` | Type/dataType-based rules |
| 1 | Theme `defaults` | Baseline for all items |
| 0 | Tier 1 `presentation` | Inline hints on item |
| -1 | Tier 1 `formPresentation` | Form-wide defaults |
| -2 | Renderer defaults | Implicit platform defaults |

**Selectors**: Array of `{match, apply}` objects. Match criteria: `type` and/or `dataType` (AND semantics). All matching selectors apply in document order; later overrides earlier per-property.

**Merge**: Shallow per-property (not deep-merged). Nested objects like `widgetConfig`, `style`, `accessibility` replaced as a whole.

**Null suppression**: Setting a property to `null` removes it from resolved result, suppressing inherited values.

**Property alignment with Tier 1**: `widget` = `widgetHint`, `style` = `styleHints` (but richer), `accessibility` same structure. `widgetConfig` and `fallback` are theme-only.

## Page Layout System

`pages` array defines ordered pages with `id`, `title`, optional `description`, and `regions`.

**12-column grid**: Each region has `key` (item key), `span` (1-12, default 12), optional `start` (column position), optional `responsive` (breakpoint overrides).

**Breakpoints**: Named in top-level `breakpoints` object (e.g., `"sm": 576, "md": 768, "lg": 1024`). Regions can override `span`, `start`, `hidden` per breakpoint.

Group keys in regions include entire subtree. Unassigned items rendered after all pages or hidden.

Without `pages`, renderer walks item tree top-to-bottom with cascade applied.

## Error Handling

Themes are gracefully degradable: unknown keys → warn, don't fail. Incompatible widget → apply fallback chain. Unresolved token → platform default. Compatibility check failure → warn, may fall back to null theme.

## Null Theme

When no theme applied, renderer uses Tier 1 hints + platform defaults. A conforming renderer must produce a usable form from Tier 1 hints alone.
