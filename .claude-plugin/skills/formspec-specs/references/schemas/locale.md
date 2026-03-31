# Locale Schema Reference Map

> schemas/locale.schema.json -- 173 lines -- Formspec Locale Document for internationalized strings

## Overview

The Locale schema defines a sidecar JSON document that provides internationalized (i18n) strings for a Formspec Definition. A Locale Document binds to a specific Definition by URL, maps item paths to localized strings via a flat key-value structure, supports FEL interpolation for dynamic content via `{{expression}}` syntax, and composes via a fallback cascade (regional -> base language -> inline defaults). Multiple Locale Documents MAY target the same Definition, one per locale. A Locale Document MUST NOT affect data collection, validation logic, or behavioral semantics -- it controls only display strings.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecLocale` | `string` (const `"1.0"`) | Yes | Locale specification version. MUST be `"1.0"`. Processors MUST reject documents with an unrecognized version. |
| `url` | `string` (format: `uri`) | No | Canonical identifier for this Locale Document. Stable across versions -- the tuple (url, version) SHOULD be globally unique. |
| `version` | `string` (minLength: 1) | Yes | Version of this Locale Document. SemVer is RECOMMENDED. The tuple (url, version) SHOULD be unique across all published locale versions. |
| `name` | `string` | No | Machine-friendly short identifier for programmatic use. |
| `title` | `string` | No | Human-readable display name for the Locale Document. |
| `description` | `string` | No | Human-readable description of the locale's purpose and target audience. |
| `locale` | `string` (minLength: 2, pattern) | Yes | BCP 47 language tag identifying the locale. Case-insensitive comparison; SHOULD normalize to lowercase language with title-case region (e.g., `fr-CA`). |
| `fallback` | `string` (minLength: 2, pattern) | No | BCP 47 language tag of the locale to consult when a key is not found. Enables explicit fallback chains (e.g., `fr-CA` -> `fr`). Circular fallback chains MUST be detected and terminated with a warning. |
| `targetDefinition` | `$ref: TargetDefinition` (from component schema) | Yes | Binding to the target Formspec Definition and compatible version range. Version mismatch triggers a warning but MUST NOT cause failure. |
| `strings` | `object` (additionalProperties: `string`) | Yes | Map of string keys to localized values. Keys follow dot-delimited path format. Values optionally contain FEL interpolation via `{{expression}}` syntax. |
| `extensions` | `object` (propertyNames: `^x-`) | No | Extension namespace for vendor-specific or tooling-specific metadata. All keys MUST be `x-` prefixed. Extensions MUST NOT alter locale resolution semantics. |

The root object has `additionalProperties: false` -- no unlisted properties are allowed.

### strings Key Format

The `strings` object uses `propertyNames` with a pattern constraint. Keys follow these conventions:

| Key Prefix | Format | Example | Description |
|---|---|---|---|
| *(item key)* | `<itemKey>.<property>` | `projectName.label` | Item-level strings: label, description, hint |
| *(item key)* | `<itemKey>.<property>@<context>` | `budgetSection.label@short` | Context-specific label variants |
| *(item key)* | `<itemKey>.options.<value>.label` | `fundingStatus.options.yes.label` | Inline choice option labels |
| *(item key)* | `<itemKey>.errors.<CODE>` | `email.errors.REQUIRED` | Per-field validation error messages |
| *(item key)* | `<itemKey>.constraintMessage` | `ssn.constraintMessage` | Bind constraint failure message |
| *(item key)* | `<itemKey>.requiredMessage` | `email.requiredMessage` | Bind required failure message |
| `$form.` | `$form.<property>` | `$form.title` | Form-level strings (title, description) |
| `$shape.` | `$shape.<id>.message` | `$shape.budget-balance.message` | Shape validation messages |
| `$page.` | `$page.<pageId>.<property>` | `$page.info.title` | Theme page strings (title, description) |
| `$optionSet.` | `$optionSet.<setName>.<value>.label` | `$optionSet.yesNoNA.yes.label` | Shared option set translations |
| `$component.` | `$component.<nodeId>.<property>` | `$component.submitBtn.label` | Component node strings |
| `$component.` | `$component.<nodeId>.<prop>[<index>]` | `$component.mainTabs.tabLabels[0]` | Component array property by index |

**propertyNames pattern:** `^(\$form\.|\$shape\.|\$page\.|\$optionSet\.|\$component\.|[a-zA-Z])[a-zA-Z0-9_@.\\\[\]\-]*$`

String values support FEL interpolation via `{{expression}}` syntax (e.g., `"Poste {{@index}}"`, `"Total : {{$itemCount}} {{if(pluralCategory($itemCount) = 'one', 'article', 'articles')}}"`).

### targetDefinition Sub-Properties

The `targetDefinition` property references `TargetDefinition` from the component schema (`https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition`).

| Property | Type | Required | Description |
|---|---|---|---|
| `url` | `string` (format: `uri`) | Yes | Canonical URL of the target Definition (its `url` property). |
| `compatibleVersions` | `string` | No | Semver range expression (npm-style) describing which Definition versions this locale supports. When absent, compatible with any version. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| *(none)* | The locale schema has an empty `$defs: {}` block. It references `TargetDefinition` from the component schema externally. | -- | -- |

## Required Fields

- `$formspecLocale` -- version pin, must be `"1.0"`
- `version` -- locale document revision identifier
- `locale` -- BCP 47 language tag
- `targetDefinition` -- binding to the target Definition
- `strings` -- the core localized string payload

## Enums and Patterns

| Property Path | Type | Values/Pattern | Description |
|---|---|---|---|
| `$formspecLocale` | const | `"1.0"` | Fixed version string for the locale specification. |
| `locale` | pattern | `^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$` | BCP 47 language tag. 2-3 letter language code with optional subtags. |
| `fallback` | pattern | `^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$` | BCP 47 language tag for fallback locale. Same pattern as `locale`. |
| `strings` (propertyNames) | pattern | `^(\$form\.|\$shape\.|\$page\.|\$optionSet\.|\$component\.|[a-zA-Z])[a-zA-Z0-9_@.\\\[\]\-]*$` | Dot-delimited path keys for string lookup. Prefixed keys for form, shape, page, optionSet, and component namespaces. |
| `extensions` (propertyNames) | pattern | `^x-` | All extension keys must start with `x-`. |

## Cross-References

- **Locale Specification** (`specs/locale/locale-spec.md`): Defines the full behavioral semantics for locale resolution, fallback cascade, interpolation processing, and key path format (Section 3.1).
- **Component Schema** (`schemas/component.schema.json`): Provides the `TargetDefinition` $def referenced by `targetDefinition` via `$ref`.
- **Definition Schema** (`schemas/definition.schema.json`): The target artifact that a Locale Document binds to. Item keys, shape IDs, optionSet names, and form-level properties in the Definition determine valid string keys.
- **Theme Schema** (`schemas/theme.schema.json`): Page IDs from the theme document are referenced by `$page.<pageId>.<property>` keys.
- **FEL Grammar** (`specs/fel/fel-grammar.md`): Governs the expression syntax used inside `{{expression}}` interpolation in string values.

## Extension Points

- **`extensions` property**: Top-level object where all keys MUST be `x-` prefixed. Processors MUST ignore unrecognized extensions. Extensions MUST NOT alter locale resolution semantics. Example uses: translator tool metadata (`x-translator`), coverage tracking (`x-coverage`).

## Validation Constraints

- **`$formspecLocale`**: `const: "1.0"` -- only the exact string `"1.0"` is accepted.
- **`version`**: `minLength: 1` -- must be a non-empty string.
- **`locale`**: `minLength: 2` plus pattern `^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$` -- at least a 2-letter language code.
- **`fallback`**: Same constraints as `locale` -- `minLength: 2` plus BCP 47 pattern.
- **`url`**: `format: "uri"` -- must be a valid URI.
- **`strings`**: `additionalProperties: { "type": "string" }` -- all values must be strings. `propertyNames` enforces the dot-delimited path pattern.
- **`targetDefinition`**: References external `TargetDefinition` with `required: ["url"]` and `additionalProperties: false`.
- **Root object**: `additionalProperties: false` -- no properties beyond those listed are permitted.
- **`x-lm.critical` annotations**: Present on `$formspecLocale`, `version`, `locale`, `targetDefinition`, and `strings` -- these are the five critical properties for LLM context.
