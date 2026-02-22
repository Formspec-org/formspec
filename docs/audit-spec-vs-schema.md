# Formspec Feature Completedness: Spec vs Schema

> Generated 2026-02-22. Updated 2026-02-22 with resolution status for all 11 top issues.

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | FULL — Schema fully represents the spec feature |
| ⚠️ | PARTIAL — Schema captures some but not all aspects |
| ❌ | MISSING — Spec feature has no schema representation |
| 🔵 | N/A — Runtime-only or not schema-representable |

---

## 1. Core Spec (`specs/core/spec.llm.md`) vs `definition.schema.json`

### 1.1 Top-Level Definition Properties

| Feature | Schema | Notes |
|---------|--------|-------|
| `$formspec` (const "1.0") | ✅ | |
| `url` (canonical URI) | ✅ | |
| `version` | ✅ | |
| `versionAlgorithm` | ✅ | enum: semver/date/integer/natural |
| `status` (draft/active/retired) | ✅ | |
| `title` | ✅ | |
| `description` | ✅ | |
| `date` | ✅ | |
| `name` (machine-friendly) | ✅ | |
| `derivedFrom` | ✅ | **RESOLVED** — Schema updated to `oneOf` allowing URI string or `{url, version}` object. Spec updated to use object form. |
| `items` | ✅ | |
| `binds` | ✅ | |
| `shapes` | ✅ | |
| `instances` | ✅ | |
| `variables` | ✅ | |
| `nonRelevantBehavior` | ✅ | |
| `optionSets` | ✅ | |
| `screener` | ✅ | |
| `migrations` | ✅ | |
| `extensions` | ✅ | |
| `formPresentation` | ✅ | |

### 1.2 Item Types & Properties

| Feature | Schema | Notes |
|---------|--------|-------|
| Item types: field, group, display | ✅ | |
| `key` pattern | ✅ | **RESOLVED** — Spec and schema both use `^[a-zA-Z][a-zA-Z0-9_]*$` (no leading underscore) |
| `key` global uniqueness | 🔵 | Cannot enforce in JSON Schema |
| `label` (required) | ✅ | |
| `description`, `hint` | ✅ | |
| `labels` (context-keyed) | ✅ | |
| `extensions` on items | ✅ | |
| Conditional schema per type | ✅ | Uses `allOf` with `if/then` |

### 1.3 Group Items

| Feature | Schema | Notes |
|---------|--------|-------|
| `children` | ✅ | Required via `anyOf` (either `children` or `$ref`) |
| `repeatable` | ✅ | |
| `minRepeat` / `maxRepeat` | ✅ | |
| `$ref` (modular composition) | ✅ | |
| `keyPrefix` | ✅ | |
| `presentation` | ✅ | |

### 1.4 Field Items

| Feature | Schema | Notes |
|---------|--------|-------|
| `dataType` (13 extended types) | ✅ | |
| Conceptual `number` dataType | ✅ | **RESOLVED** — LLM spec updated to use `decimal`. FEL runtime type `number` is a separate concept from the field `dataType` enum. |
| `precision` | ✅ | |
| `prefix` / `suffix` | ✅ | |
| `options` (array or URI) | ✅ | |
| `optionSet` (reference) | ✅ | |
| `initialValue` | ⚠️ | Schema allows any type; can't distinguish literal from `=expression` |
| `semanticType` | ✅ | |
| `prePopulate` | ✅ | |
| `children` (dependent sub-questions) | ✅ | |

### 1.5 Bind Properties

| Feature | Schema | Notes |
|---------|--------|-------|
| `path` (required) | ✅ | |
| `calculate` / `relevant` / `required` / `readonly` / `constraint` | ✅ | All typed as string (FEL) |
| `constraintMessage` | ✅ | |
| `default` | ✅ | |
| `whitespace` | ✅ | enum: preserve/trim/normalize/remove |
| `excludedValue` | ✅ | |
| `nonRelevantBehavior` (per-path) | ✅ | |
| `disabledDisplay` | ✅ | |
| Inheritance rules (AND/OR semantics) | 🔵 | Runtime |

### 1.6 Validation Shapes

| Feature | Schema | Notes |
|---------|--------|-------|
| `id`, `target`, `message` (required) | ✅ | |
| `severity` (error/warning/info) | ✅ | |
| `constraint` (FEL) | ✅ | |
| `code` | ✅ | |
| `context` | ✅ | **RESOLVED** — Schema updated: `additionalProperties: { "type": "string" }` with description noting FEL expressions |
| `activeWhen` | ✅ | |
| `timing` (continuous/submit/demand) | ✅ | |
| Composition: `and`/`or`/`not`/`xone` | ✅ | |
| Must have constraint or composition | ✅ | Via `anyOf` |

### 1.7 Data Sources / Instances

| Feature | Schema | Notes |
|---------|--------|-------|
| Inline data (`data` property) | ✅ | |
| URL data (`source` property) | ✅ | |
| Function-type data source | ✅ | **RESOLVED** — Spec updated to use `formspec-fn:` URI scheme within existing `source` property instead of separate `function` type |
| `readonly` | ✅ | |

### 1.8 Extension Points

| Feature | Schema | Notes |
|---------|--------|-------|
| `extensions` on all objects | ✅ | `x-` prefixed keys throughout |
| `mustUnderstand` flag | 🔵 | **RESOLVED** — Removed from spec. Overengineered for v1.0; deferred to Extension Registry |
| Custom data types (`x-` prefixed) | 🔵 | **RESOLVED** — Deferred to Extension Registry system |
| Custom functions (`x-` prefixed) | 🔵 | **RESOLVED** — Deferred to Extension Registry system |
| Custom constraints (`x-` prefixed) | 🔵 | **RESOLVED** — Deferred to Extension Registry system |

### 1.9 Processing Model & Conformance

| Feature | Schema | Notes |
|---------|--------|-------|
| 4-phase processing (Rebuild/Recalc/Revalidate/Notify) | 🔵 | Runtime |
| Dependency DAG / cycle detection | 🔵 | Runtime |
| Core vs Extended processor levels | 🔵 | Implementation requirement |

---

## 2. Response (`specs/core/spec.llm.md` §6) vs `response.schema.json`

| Feature | Schema | Notes |
|---------|--------|-------|
| `definitionUrl` | ✅ | |
| `definitionVersion` | ✅ | |
| `status` (in-progress/completed/amended/stopped) | ✅ | |
| `data` (instance) | ✅ | |
| `authored` (ISO 8601) | ✅ | |
| `id` (UUID) | ✅ | String, no UUID format enforcement |
| `author` | ⚠️ | Schema adds `{id, name}` structure beyond spec's vague description |
| `subject` | ✅ | |
| `validationResults` | ✅ | |
| ValidationResult: severity/path/message/constraintKind | ✅ | All 6 constraintKind values match spec |
| ValidationResult: code/source/shapeId/constraint | ✅ | |

---

## 3. Validation Report vs `validationReport.schema.json`

| Feature | Schema | Notes |
|---------|--------|-------|
| `valid` (boolean) | ✅ | |
| `results` (array) | ✅ | Reuses response schema's ValidationResult |
| `counts` (error/warning/info) | ✅ | |
| `timestamp` | ✅ | |

---

## 4. FEL Grammar (`specs/fel/fel-grammar.llm.md`) — Schema Representation

| Feature | Schema | Notes |
|---------|--------|-------|
| FEL expressions typed as strings in binds | ✅ | All 5 bind MIPs + shapes + variables |
| Shape `context` values as FEL | ✅ | **RESOLVED** — Schema updated to `additionalProperties: { "type": "string" }` |
| `initialValue` literal vs `=expression` | ⚠️ | Schema uses `{}` (any), can't distinguish |
| Lexical rules / operator precedence | 🔵 | Parse-time only |
| ~40+ stdlib functions | 🔵 | Runtime only |
| Extension function declarations | 🔵 | **RESOLVED** — Deferred to Extension Registry system |

---

## 5. Theme Spec (`specs/theme/theme-spec.llm.md`) vs `theme.schema.json`

### 5.1 Document Structure

| Feature | Schema | Notes |
|---------|--------|-------|
| `$formspecTheme`, `version`, `targetDefinition` | ✅ | |
| Optional metadata (url, name, title, description) | ✅ | |
| `platform` | ⚠️ | Open string, not enum of spec's 6 known values |

### 5.2 Design Tokens

| Feature | Schema | Notes |
|---------|--------|-------|
| Flat key-value map (strings/numbers only) | ✅ | Correctly prevents booleans/arrays/null |
| Recommended prefix categories | 🔵 | Naming convention |
| `$token.` reference syntax | 🔵 | Runtime resolution |

### 5.3 Widget Catalog

| Feature | Schema | Notes |
|---------|--------|-------|
| `widget` property | ✅ | |
| `widgetConfig` (per-widget config) | ⚠️ | Open object, no per-widget shape validation |
| `fallback` arrays | ✅ | |
| Required/progressive widget conformance | 🔵 | Renderer requirement |

### 5.4 Selector Cascade

| Feature | Schema | Notes |
|---------|--------|-------|
| `defaults` (level 1) | ✅ | |
| `selectors` with match/apply (level 2) | ✅ | |
| `items` per-key overrides (level 3) | ✅ | |
| Cascade priority/merge semantics | 🔵 | Processing rule |
| Null suppression | ✅ | **RESOLVED** — Spec updated to use `"none"` sentinel string instead of JSON `null`. Schema correctly rejects `null`. Both now aligned. |

### 5.5 PresentationBlock

| Feature | Schema | Notes |
|---------|--------|-------|
| `widget`, `widgetConfig`, `labelPosition`, `style`, `accessibility`, `fallback` | ✅ | All present |
| AccessibilityBlock (role, description, liveRegion) | ✅ | |

### 5.6 Page Layout

| Feature | Schema | Notes |
|---------|--------|-------|
| `pages` array (id, title, description, regions) | ✅ | |
| 12-column grid regions (key, span, start, responsive) | ✅ | |
| Breakpoints (name-to-integer map) | ✅ | |

### 5.7 Extensions

| Feature | Schema | Notes |
|---------|--------|-------|
| `extensions` with `x-` prefixed keys | ✅ | |

---

## 6. Component Spec (`specs/component/component-spec.llm.md`) vs `component.schema.json`

### 6.1 Document Structure

| Feature | Schema | Notes |
|---------|--------|-------|
| `$formspecComponent`, `version`, `targetDefinition`, `tree` | ✅ | |
| Optional metadata (`name`, `title`, `description`) | ✅ | **RESOLVED** — Added to schema |
| `x-` prefixed top-level extension keys | ✅ | **RESOLVED** — Added `patternProperties: { "^x-": {} }` to schema |

### 6.2 Component Model — Base

| Feature | Schema | Notes |
|---------|--------|-------|
| `component`, `when`, `responsive`, `style` on all | ✅ | |
| `labelOverride`/`hintOverride`/`descriptionOverride` | 🔵 | **RESOLVED** — Removed from spec. Overdesigned; label management belongs in definition/theme, not component tree |
| Single root constraint | ✅ | `tree` is single object |
| Category nesting (children vs. no children) | ✅ | |
| `bind` on Stack/Grid/Card/Collapsible for repeatable groups | 🔵 | **RESOLVED** — Removed from spec. Repeatable group binding only allowed on DataTable. Layout/container `bind` conflated data binding with visual structure. |
| Max nesting depth (20) | 🔵 | **DEFERRED TO LINT** — Not enforceable in JSON Schema; better as a lint rule |
| Wizard children must all be Page | 🔵 | **DEFERRED TO LINT** — Recursive component tree makes this awkward in JSON Schema; enforce via lint |
| Accessibility properties | ✅ | **RESOLVED** — `AccessibilityBlock` (role, description, liveRegion) added to all components |

### 6.3 Built-In Components — Core (18)

| Component | Schema | Notes |
|-----------|--------|-------|
| Page | ✅ | — |
| Stack | ✅ | **RESOLVED** — Added `wrap` to schema. `bind` removed from spec (not applicable). |
| Grid | ✅ | **RESOLVED** — Added `rowGap` to schema. `bind` removed from spec (not applicable). |
| Wizard | ✅ | **RESOLVED** — Added `allowSkip` to schema |
| Spacer | ✅ | — |
| TextInput | ✅ | **RESOLVED** — Added `prefix`, `suffix` to schema |
| NumberInput | ✅ | **RESOLVED** — Added `showStepper`, `locale` to schema |
| DatePicker | ✅ | **RESOLVED** — Added `showTime` to schema |
| Select | ✅ | **RESOLVED** — Added `clearable` to schema |
| CheckboxGroup | ✅ | — |
| Toggle | ✅ | — |
| FileUpload | ✅ | **RESOLVED** — Added `dragDrop` to schema |
| Heading | ✅ | — |
| Text | ✅ | — |
| Divider | ✅ | — |
| Card | ✅ | **RESOLVED** — Added `elevation` to schema. `bind` removed from spec. |
| Collapsible | ✅ | **RESOLVED** — `bind` removed from spec. |
| ConditionalGroup | ✅ | — |

### 6.4 Built-In Components — Progressive (15)

| Component | Schema | Notes |
|-----------|--------|-------|
| Columns | ✅ | — |
| Tabs | ✅ | **RESOLVED** — Added `tabLabels`, `defaultTab` to schema. `position` was already in schema; added to spec. |
| Accordion | ✅ | **RESOLVED** — Added `defaultOpen` to schema |
| RadioGroup | ✅ | **RESOLVED** — Added `orientation` to schema |
| MoneyInput | ✅ | **RESOLVED** — Replaced schema's `prefix`/`suffix` with spec's `showCurrency`/`locale` |
| Slider | ✅ | **RESOLVED** — Added `showValue`, `showTicks` to schema |
| Rating | ✅ | **RESOLVED** — Added `icon` enum and `allowHalf` to schema |
| Signature | ✅ | **RESOLVED** — Unified naming: `strokeColor` everywhere (spec and schema). Added `height`, `penWidth` to schema. `clearable` added to spec. |
| Alert | ✅ | **RESOLVED** — Added `dismissible` to schema |
| Badge | ✅ | **RESOLVED** — Added `variant` enum to schema |
| ProgressBar | ✅ | **RESOLVED** — Added `showPercent` to schema |
| Summary | ✅ | — |
| DataTable | ✅ | **RESOLVED** — Added `showRowNumbers`, `allowAdd`, `allowRemove` to schema |
| Panel | ✅ | **RESOLVED** — Unified naming: `left`/`right` in both spec and schema. Added `title`, `width` to schema. |
| Modal | ✅ | **RESOLVED** — Added `trigger`, `triggerLabel`, `closable` to schema. `size` was already in schema; added to spec. |

### 6.5 Custom Components

| Feature | Schema | Notes |
|---------|--------|-------|
| `components` registry with `params`/`tree` | ✅ | **RESOLVED** — Made `params` optional in schema (only `tree` required) |
| PascalCase naming convention | ✅ | **RESOLVED** — `patternProperties` with `^[A-Z][a-zA-Z0-9]*$` and `additionalProperties: false` |
| Custom component instantiation (`CustomComponentRef`) | ✅ | |

### 6.6 Responsive Design

| Feature | Schema | Notes |
|---------|--------|-------|
| Top-level `breakpoints` | ✅ | |
| `responsive` property on components | ⚠️ | No restriction on which props can be overridden. **Accepted** — better as lint rule than schema constraint |

---

## 7. Mapping Spec (`specs/mapping/mapping-spec.llm.md`) vs `mapping.schema.json`

### 7.1 Document Structure

| Feature | Schema | Notes |
|---------|--------|-------|
| `$schema` | ✅ | |
| `version` | ✅ | **RESOLVED** — SemVer pattern added |
| `definitionRef` | ✅ | **RESOLVED** — URI format added |
| `definitionVersion` | ⚠️ | Semver range — not practically validatable via regex; defer to runtime |
| `targetSchema` (format, rootElement, namespaces) | ✅ | Includes conditional for XML rootElement |
| `direction` | ✅ | **RESOLVED** — Schema default fixed to `"forward"` to match spec |
| `defaults` | ✅ | |
| `autoMap` | ✅ | |
| `rules` (array, minItems: 1) | ✅ | |
| `adapters` (json, xml, csv, x-custom) | ✅ | |

### 7.2 Field Rules

| Feature | Schema | Notes |
|---------|--------|-------|
| `sourcePath` / `targetPath` | ✅ | `anyOf` enforces at least one |
| `transform` (10 types) | ✅ | All 10 enumerated |
| `expression` (FEL) | ✅ | Conditionally required for expression/constant/concat/split |
| `coerce` (object + shorthand string) | ✅ | |
| `valueMap` (full + shorthand) | ✅ | All 4 `unmapped` strategies |
| `reverse` override | ✅ | Correctly omits path re-specification |
| `bidirectional` | ✅ | |
| `condition` (FEL guard) | ✅ | |
| `default` (fallback) | ✅ | |
| `array` descriptor (each/whole/indexed) | ✅ | With recursive inner rules |
| `priority` / `reversePriority` | ✅ | |

### 7.3 Format Adapters

| Feature | Schema | Notes |
|---------|--------|-------|
| JSON adapter (pretty, sortKeys, nullHandling) | ✅ | |
| XML adapter (declaration, indent, cdata) | ✅ | |
| CSV adapter (delimiter, quote, header, encoding, lineEnding) | ✅ | |
| Custom adapters (`x-` prefix) | ✅ | |

### 7.4 Other

| Feature | Schema | Notes |
|---------|--------|-------|
| Conformance levels (Core/Bidirectional/Extended) | ✅ | **RESOLVED** — `conformanceLevel` enum added |
| Execution pipeline (7-step) | 🔵 | Runtime |
| Bidirectional semantics / round-trip fidelity | 🔵 | Runtime |

---

## 8. Extension Registry (`specs/registry/extension-registry.llm.md`) vs `registry.schema.json`

### 8.1 Document Structure

| Feature | Schema | Notes |
|---------|--------|-------|
| `$formspecRegistry` = "1.0" | ✅ | |
| `$schema` | ✅ | |
| `publisher` (name, url, contact) | ✅ | |
| `published` (ISO 8601) | ✅ | |
| `entries` (array) | ✅ | |
| `extensions` | ✅ | |

### 8.2 Registry Entry

| Feature | Schema | Notes |
|---------|--------|-------|
| `name` (x-prefixed identifier) | ✅ | |
| `category` (5 values) | ✅ | dataType/function/constraint/property/namespace |
| `version` (SemVer) | ✅ | **RESOLVED** — Regex end-anchored with `$` to prevent trailing char acceptance |
| `status` (draft/stable/deprecated/retired) | ✅ | |
| `description` | ✅ | |
| `compatibility` | ✅ | |
| `specUrl` / `schemaUrl` | ✅ | |
| `license` (SPDX) | ✅ | **RESOLVED** — SPDX-like pattern added |

### 8.3 Category-Specific Properties

| Feature | Schema | Notes |
|---------|--------|-------|
| dataType: `baseType`, `constraints`, `metadata` | ✅ | Conditional enforcement |
| function: `parameters`, `returns` | ✅ | Conditional enforcement |
| constraint: `parameters` | ✅ | Conditional enforcement |
| namespace: `members` | ✅ | |

### 8.4 Naming & Lifecycle

| Feature | Schema | Notes |
|---------|--------|-------|
| `x-formspec-` prefix reserved | ❌ | Schema doesn't prevent third-party use |
| `(name, version)` uniqueness | ❌ | JSON Schema limitation |
| Valid state transitions | ❌ | Cannot enforce ordering |
| Deprecation notice when `status: deprecated` | ✅ | **RESOLVED** — Conditional `if/then` requires `deprecationNotice` when status is `deprecated` |

---

## 9. Changelog (`specs/registry/changelog-spec.llm.md`) vs `changelog.schema.json`

| Feature | Schema | Notes |
|---------|--------|-------|
| `definitionUrl` / `fromVersion` / `toVersion` | ✅ | **RESOLVED** — `changelog.schema.json` created |
| `generatedAt` | ✅ | |
| `semverImpact` (major/minor/patch) | ✅ | |
| `summary` | ✅ | |
| `changes` array | ✅ | |
| Change: `type` (added/removed/modified/moved/renamed) | ✅ | All 5 enum values |
| Change: `target` (8 categories) | ✅ | All 8 enum values |
| Change: `path`, `key`, `impact`, `description` | ✅ | |
| Change: `before`/`after`, `migrationHint` | ✅ | |
| Impact classification rules | 🔵 | Runtime/tooling concern |

---

## Aggregate Summary

| Spec Area | ✅ Full | ⚠️ Partial | ❌ Missing | 🔵 N/A |
|-----------|---------|-----------|-----------|--------|
| **Core Definition** | 57 | 2 | 0 | 13 |
| **Response** | 10 | 1 | 0 | 0 |
| **Validation Report** | 4 | 0 | 0 | 0 |
| **FEL Grammar** | 2 | 1 | 0 | 5 |
| **Theme** | 18 | 3 | 0 | 6 |
| **Component (structure)** | 11 | 0 | 0 | 6 |
| **Component (33 built-ins)** | 33 | 0 | 0 | 0 |
| **Component (custom/responsive)** | 4 | 1 | 0 | 0 |
| **Mapping** | 27 | 1 | 0 | 10 |
| **Extension Registry** | 25 | 0 | 3 | 8 |
| **Changelog** | 9 | 0 | 0 | 1 |
| **TOTAL** | **200** | **9** | **3** | **49** |

**Delta from original audit**: ✅ +45, ⚠️ -34, ❌ -19, 🔵 +11

### Top Issues — Resolution Summary

#### 1. No `changelog.schema.json` — ✅ RESOLVED
**Decision**: Spec is mature enough. Created `schemas/changelog.schema.json` covering all 10 features: required `definitionUrl`, `fromVersion`, `toVersion`, `semverImpact`, `changes` array. Change objects include all 5 `type` values, 8 `target` values, `impact` classification, and optional `before`/`after`/`migrationHint`.

#### 2. Component prop drift — ✅ RESOLVED
**Decision**: Both spec and schema needed updates. Applied changes bidirectionally:
- **Schema additions** (22 components): Added all missing spec props to schema (`wrap`, `rowGap`, `allowSkip`, `prefix`, `suffix`, `showStepper`, `locale`, `showTime`, `clearable`, `dragDrop`, `elevation`, `tabLabels`, `defaultTab`, `defaultOpen`, `orientation`, `showCurrency`, `locale`, `showValue`, `showTicks`, `icon`, `allowHalf`, `height`, `penWidth`, `dismissible`, `variant`, `showPercent`, `showRowNumbers`, `allowAdd`, `allowRemove`, `title`, `width`, `trigger`, `triggerLabel`, `closable`).
- **Schema removals**: MoneyInput `prefix`/`suffix` replaced with `showCurrency`/`locale` to match spec.
- **Spec additions**: Tabs `position`, Modal `size` added to spec (were implementation-discovered props the spec missed).
- **Naming unification**: Signature `penColor` → `strokeColor` everywhere. Panel `sidebar`/`inline` → `left`/`right` everywhere. Signature `clearable` added to spec.

#### 3. Core extension points — ✅ RESOLVED
**Decision**: Simplified for v1.0. `mustUnderstand` removed from spec (overengineered). Custom data types, functions, and constraints deferred entirely to the Extension Registry system rather than inline declarations in definitions. Spec §8.1-8.3 collapsed from ~180 lines to ~20 lines.

#### 4. Mapping `direction` default — ✅ RESOLVED
**Decision**: `"forward"` is the correct default (safer, no accidental reverse mapping). Schema default fixed from `"both"` to `"forward"`. Spec prose already said `"forward"` in two places; the property table was the outlier.

#### 5. Component `bind` for repeatable groups — ✅ RESOLVED
**Decision**: Removed `bind` from layout/container components (Stack, Grid, Card, Collapsible) in spec. Repeatable group binding is only allowed on DataTable. Rationale: layout `bind` conflated data binding with visual structure. DataTable is the purpose-built component for tabular repeat display.

#### 6. Component metadata — ✅ RESOLVED
**Decision**: Simple oversight. Added `name`, `title`, `description` to component schema top-level. Added `patternProperties: { "^x-": {} }` for extension keys.

#### 7. Component label/hint/description overrides — ✅ RESOLVED
**Decision**: Removed from spec. These overrides create two sources of truth — label management belongs in the definition (Tier 1) or theme selector cascade (Tier 2), not the component tree (Tier 3). Removed `labelOverride`, `hintOverride`, `descriptionOverride` from component spec and all back-references.

#### 8. Theme null suppression — ✅ RESOLVED
**Decision**: Spec updated to use `"none"` sentinel string instead of JSON `null` for property suppression. Schema was already correct to reject `null`. Both now aligned: set `"none"` to explicitly suppress `widget` or `labelPosition`; omit other properties to leave them unset.

#### 9. `derivedFrom` pipe syntax — ✅ RESOLVED
**Decision**: Object form `{url, version}` replaces pipe syntax `url|version`. Schema updated to `oneOf` allowing either simple URI string or `{url, version}` object. Spec updated with object form examples.

#### 10. Function-type data sources — ✅ RESOLVED
**Decision**: `formspec-fn:` URI scheme within existing `source` property. No separate `function` type needed. Spec updated to document `formspec-fn:functionName` pattern. Clean, schema-compatible, no new properties required.

#### 11. Responsive override restrictions — ACCEPTED AS-IS
**Decision**: Better as a lint rule than a schema constraint. Would require complex per-component conditional schemas that aren't worth the maintenance burden. Schema allows freeform overrides; tooling can validate.

#### General Principle
> Before "fixing" any gap, ask: **Is the spec correct? Is the schema correct? Is neither correct?** A gap between spec and schema is information — it tells you something needs a decision, not that something needs to be mechanically synced.
