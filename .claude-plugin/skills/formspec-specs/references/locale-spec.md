# Locale Specification Reference Map

> specs/locale/locale-spec.md -- 1253 lines, ~49K -- Companion: Internationalization, Sidecar Locale Documents, Fallback Cascade

## Overview

The Formspec Locale Specification defines the Locale Document -- a standalone sidecar JSON artifact that provides internationalized strings for a Formspec Definition. It covers dot-delimited string key formats for addressing all localizable properties (item labels, choice options, validation messages, form-level strings, shape messages, theme page titles, and component node text), FEL interpolation within localized strings via `{{expression}}` syntax, a four-step fallback cascade (regional locale -> explicit fallback -> implicit language fallback -> inline defaults), and three FEL functions (`locale()`, `formatNumber()`, `formatDate()`). The spec defines two conformance levels (Locale Core and Locale Extended) and is a companion to the Formspec v1.0 Core Specification -- it does not alter core processing but adds a presentation-layer string resolution step.

## Section Map

### Front Matter and Introduction (Lines 1-151)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| -- | Status of This Document | Declares this is a draft companion specification to Formspec v1.0 Core. | draft, companion | Checking maturity/stability of the locale spec |
| -- | Conventions and Terminology | RFC 2119 keyword definitions and incorporation of core spec terms (Definition, Item, Response, Bind, FEL, conformant processor). | RFC 2119, RFC 8174, RFC 8259, RFC 3986 | Understanding normative language conventions |
| -- | Bottom Line Up Front | 4-bullet summary: sidecar JSON, required top-level fields, fallback cascade with FEL interpolation, governed by locale schema. | BLUF summary | Quick orientation before reading the full spec |
| S1 | 1. Introduction | Frames the entire specification's purpose and scope. | -- | Understanding what the locale spec covers at a high level |
| S1.1 | 1.1 Purpose | Real-world forms need multiple languages; the Locale Document provides localized strings as a sidecar artifact without bloating the Definition or requiring bespoke translation infrastructure. | Locale Document, sidecar, FEL interpolation, fallback cascade, contextual variants | Understanding why the locale spec exists |
| S1.2 | 1.2 Scope | Enumerates what IS defined (Locale Document structure, string keys, FEL interpolation, fallback cascade, `locale()` function, `pluralCategory()` usage) and what is NOT (locale negotiation, RTL layout, translation memory, CLDR tables, number/date formatting tables). Also covers cross-tier addressing: `$page.` for theme pages, `$component.` for component nodes, `$optionSet.` for shared option sets. | in-scope vs out-of-scope, cross-tier addressing, $page, $component, $optionSet | Determining if a feature belongs in the locale spec |
| S1.3 | 1.3 Relationship to Other Specifications | Table showing how Locale Documents fit alongside Core Definition, Theme Document, Component Document, and Mapping Document as composable sidecar artifacts. Multiple Locale Documents MAY target the same Definition. | sidecar pattern, composable artifacts | Understanding how locale relates to other Formspec documents |
| S1.4 | 1.4 Terminology | Defines 6 key terms: Definition, Locale Document, Locale code, String key, Cascade, Interpolation. | terminology definitions | Looking up precise definitions of locale-specific terms |
| S1.5 | 1.5 Notational Conventions | JSON example annotations, property name formatting, section reference conventions. | notation, comments | Understanding example formatting |

### Locale Document Structure (Lines 152-237)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S2 | 2. Locale Document Structure | The Locale Document is a JSON object with required and optional top-level properties. Processors MUST reject documents missing required properties. Includes a complete example. | Locale Document JSON structure | Authoring or parsing a Locale Document |
| S2.1 | 2.1 Top-Level Properties | Schema-ref table of all 11 root properties: `$formspecLocale` (REQUIRED), `url`, `version` (REQUIRED), `name`, `title`, `description`, `locale` (REQUIRED), `fallback`, `targetDefinition` (REQUIRED), `strings` (REQUIRED), `extensions`. Extensions MUST be `x-` prefixed and MUST NOT alter resolution semantics. | $formspecLocale, version, locale, fallback, targetDefinition, strings, extensions | Building or validating the root of a Locale Document |
| S2.2 | 2.2 Target Definition Binding | The `targetDefinition` object binds a Locale Document to a specific Definition by URL. `compatibleVersions` is an optional semver range; version mismatch MUST NOT fail -- processor SHOULD warn and MAY fall back to inline strings. | targetDefinition, url, compatibleVersions, semver range | Implementing version compatibility checking |
| S2.3 | 2.3 Locale Code | The `locale` property MUST be a valid BCP 47 tag. Processors MUST perform case-insensitive comparison and SHOULD normalize to lowercase language with title-case region (e.g., `fr-CA`). Processors MUST NOT fail on unrecognized subtags. | BCP 47, case-insensitive, normalization | Implementing locale code parsing and comparison |

### String Keys and Values (Lines 239-724)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S3 | 3. String Keys and Values | Covers the entire string key format system and FEL interpolation rules. | string keys, interpolation | Understanding the string addressing and resolution system |
| S3.1 | 3.1 String Key Format | Dot-delimited paths of the form `<itemKey>.<property>` address localizable properties. When `$ref` with `keyPrefix` is used, keys MUST use post-assembly keys (after prefix is prepended). | dot-delimited paths, itemKey, property, keyPrefix, post-assembly | Understanding the general key format |
| S3.1.1 | 3.1.1 Item Properties | Three localizable properties: `<key>.label`, `<key>.description`, `<key>.hint`. These map to `Item.label`, `Item.description`, and `Item.hint`. | label, description, hint | Localizing basic item text |
| S3.1.2 | 3.1.2 Context Labels | The `@context` suffix overrides Definition `labels` entries (e.g., `short`, `pdf`, `accessibility`). Cascade: locale `key.label@context` -> locale `key.label` -> Definition `labels[context]` -> Definition `label`. The `@context` suffix MAY be used with any localizable property, not only `label`; for non-label properties the inline context step is skipped. | @context suffix, labels, short, pdf, accessibility, cascade | Implementing context-specific label resolution |
| S3.1.3 | 3.1.3 Choice Option Labels | Options addressed by `<fieldKey>.options.<optionValue>.label`. Only `label` is localizable (not `value`). Characters `.` and `\` in option values MUST be escaped with backslash. OptionSet-level keys use `$optionSet.<setName>.<optionValue>.label` prefix. Field-level keys override OptionSet-level keys, enabling context-specific translations for shared sets. | choice options, optionValue, escaping, $optionSet, field-level override | Localizing dropdown/radio option labels |
| S3.1.4 | 3.1.4 Validation Messages | Two granularities: per constraint code (`<key>.errors.<code>`) and per Bind (`<key>.constraintMessage`, `<key>.requiredMessage`). Seven reserved codes: REQUIRED, TYPE_MISMATCH, MIN_REPEAT, MAX_REPEAT, CONSTRAINT_FAILED, SHAPE_FAILED, EXTERNAL_FAILED. Cascade: per-code locale key -> per-Bind locale key -> inline constraintMessage -> processor default. Code synthesis from `constraintKind` ensures keys are always resolvable. | errors, constraintMessage, requiredMessage, code synthesis, constraintKind, reserved codes | Localizing validation error messages |
| S3.1.5 | 3.1.5 Form-Level Strings | `$form.title` and `$form.description` address top-level Definition properties. The `$form` prefix is reserved and cannot collide with item keys (item keys exclude `$`). | $form, title, description | Localizing the form's own title and description |
| S3.1.6 | 3.1.6 Shape Rule Messages | Shape rules addressed by `$shape.<shapeId>.message`. The `$shape` prefix is reserved and cannot collide with item keys. | $shape, shapeId, message | Localizing cross-field validation messages |
| S3.1.7 | 3.1.7 Page Layout Strings | Theme page titles and descriptions addressed by `$page.<pageId>.title` and `$page.<pageId>.description`. A Locale Document using `$page.` keys depends on both the target Definition and the Theme Document. Validators SHOULD warn on orphaned page IDs. | $page, pageId, Theme Document dependency | Localizing theme page titles |
| S3.1.8 | 3.1.8 Component Node Strings | Component nodes with `id` addressed by `$component.<nodeId>.<property>`. Supports bracket indexing for array props (`tabLabels[0]`, `columns[1].header`). Only string-typed props are addressable. Includes a table of all localizable component properties (18 components). Repeat template nodes share the same locale key across all instances but `{{expression}}` evaluates per instance. | $component, nodeId, bracket indexing, array props, repeat template | Localizing component text content |
| S3.2 | 3.2 Key Resolution Rules | Four rules: keys are case-sensitive; orphaned keys produce warnings (not failures); partial coverage is allowed (missing keys cascade); duplicate keys follow JSON last-value-wins. | case-sensitive, orphaned keys, partial coverage, duplicate keys | Understanding how the processor handles edge cases in key lookup |
| S3.3 | 3.3 FEL Interpolation | String values MAY contain `{{<FEL expression>}}` sequences. Expressions are evaluated in the item's binding context with access to `$` references, FEL stdlib, `locale()`, and `pluralCategory()`. | FEL interpolation, double curly braces, binding context | Using dynamic values in localized strings |
| S3.3.1 | 3.3.1 Interpolation Processing | Six normative rules: (1) literal `{{` via `{{{{`, (2) parse/eval failure preserves literal text + warning, (3) null becomes empty string unless rule 3a applies, (3a) null without `$`/`@` sigil and without static literal expression preserves literal text, (4) coercion details for booleans/numbers, (5) no side effects, (6) not recursive. | escape syntax, error handling, null coercion, rule 3a, static literal, no side effects, not recursive | Implementing the interpolation evaluator |
| S3.3.2 | 3.3.2 Interpolation Binding Context | Table of binding contexts per key prefix: item keys get item scope with `@index`/`@count` in repeats; `$form`, `$page`, `$optionSet`, `$component` (outside repeat) get global context; `$component` inside repeat template gets instance scope. Template paths use indices stripped but expressions evaluate per instance. | binding context, key prefix, @index, @count, template path | Implementing context resolution for interpolation |

### Fallback Cascade (Lines 726-820)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S4 | 4. Fallback Cascade | Governs how string resolution walks from most-specific to least-specific locale. | cascade, fallback | Understanding the locale resolution priority chain |
| S4.1 | 4.1 Cascade Order | Four-step cascade: (1) Regional Locale Document matching requested code, (2) Explicit fallback chain (walk `fallback` declarations), (3) Implicit language fallback (strip region subtag if not already consulted), (4) Inline default from Definition. Processor MUST return first non-null result; if all fail, return empty string `""`. | regional, explicit fallback, implicit language fallback, inline default, empty string | Implementing the fallback resolution algorithm |
| S4.2 | 4.2 Cascade Examples | Concrete example with `fr-CA` (has only `name.hint`), `fr` (has `name.label` and `name.hint`), and inline defaults, showing resolved values per key. | cascade example, fr-CA, fr | Verifying cascade implementation correctness |
| S4.3 | 4.3 Circular Fallback Detection | Circular fallback chains (e.g., `fr-CA` -> `fr` -> `fr-CA`) MUST be detected and MUST terminate the cascade, falling through to inline defaults. Processors SHOULD warn. | circular detection, termination | Implementing circular fallback chain protection |
| S4.4 | 4.4 Multiple Locale Documents | An engine MAY have multiple Locale Documents loaded simultaneously. The engine maintains an ordered cascade list; `setLocale()` determines the active cascade. | multiple documents, locale cascade, setLocale | Understanding how multiple locale documents coexist |

### FEL Functions (Lines 822-926)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S5 | 5. FEL Functions | Introduces three locale-tier FEL functions. `locale()` is Locale Core; `formatNumber()` and `formatDate()` are Locale Extended. These are extensions to the FEL stdlib that MUST NOT collide with core built-in names. Non-locale processors MUST NOT register them. | locale(), formatNumber(), formatDate(), conformance levels | Understanding which FEL functions the locale spec adds |
| S5.1 | 5.1 `locale()` | Returns the active BCP 47 locale code as a string (empty string if no locale active). Non-deterministic like `now()`. Available in all FEL contexts (calculate, relevant, constraint, readonly). Enables locale-aware conditional logic in the Definition itself. | locale(), non-deterministic, all FEL contexts | Implementing the locale() function or using it in expressions |
| S5.2 | 5.2 Pluralization via `pluralCategory()` | Uses core FEL `pluralCategory(count)` (core spec S3.5) which returns CLDR plural categories: zero, one, two, few, many, other. Authors combine with `if()` for word form selection. Correctly handles languages where `one` does not correspond to 1 (e.g., French treats 0 as `one`). | pluralCategory, CLDR, plural forms, if() chaining | Implementing pluralization in localized strings |
| S5.3 | 5.3 `formatNumber(value, locale?)` | Formats a number per locale conventions. Returns null for null input. Uses active locale if `locale` omitted. Implementations SHOULD use host platform capabilities (Intl.NumberFormat, locale.format_string). MUST fall back to `"en"` format if requested locale is unsupported. | formatNumber, Intl.NumberFormat, en fallback | Implementing locale-aware number formatting |
| S5.4 | 5.4 `formatDate(value, pattern?, locale?)` | Formats an ISO 8601 date string per locale. Patterns: short, medium, long, full (default: medium). Returns null for null input. Uses active locale if omitted. | formatDate, ISO 8601, short/medium/long/full | Implementing locale-aware date formatting |

### Processor Capabilities (Lines 927-979)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S6 | 6. Processor Capabilities | Defines four capabilities a conformant locale processor MUST provide. Method names are illustrative; implementations MAY use different API shapes. | processor capabilities, API contract | Implementing a locale-aware Formspec engine |
| S6.1 | 6.1 Load a Locale Document | Register a parsed Locale Document. MUST validate `$formspecLocale` version and `targetDefinition` binding. Same-locale replacement semantics (new replaces old). Loading MUST NOT trigger reactive updates until active locale is set. | load, validate, replace, no reactive trigger | Implementing locale document loading |
| S6.2 | 6.2 Set the Active Locale | Activate a locale by BCP 47 tag, triggering reactive string resolution. MUST build the fallback cascade. Unknown locale falls back to inline defaults with warning. Changing locale MUST trigger reactive updates via the same mechanism as field value changes. | setLocale, reactive updates, cascade building | Implementing locale activation and reactivity |
| S6.3 | 6.3 Resolve a Localized String | Resolve a single string by path, property, and optional context. Returns the resolved string after cascade lookup and FEL interpolation. Returns empty string if no string found at any level. | resolve, path, property, context | Implementing the string resolution API |
| S6.4 | 6.4 Query the Active Locale | Returns the active BCP 47 locale code or empty string if none active. | query, active locale | Implementing the locale query API |

### Validation and Linting (Lines 981-1030)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S7 | 7. Validation and Linting | Schema validation, cross-reference validation, and linter rules for Locale Documents. | validation, linting | Implementing locale document validation |
| S7.1 | 7.1 Schema Validation | Locale Documents MUST validate against `schemas/locale.schema.json`. Enforces required properties, string-valued `strings` object, BCP 47 syntax, and URI for `targetDefinition.url`. | schema validation, locale.schema.json | Implementing basic structural validation |
| S7.2 | 7.2 Cross-Reference Validation | Table of 11 cross-reference checks with severity levels: orphaned keys (Warning), missing translations (Info), invalid option/shape references (Warning), invalid property (Error), interpolation parse errors (Warning), version mismatch (Warning), orphaned $page/$component/$optionSet keys (Warning), brackets in item keys (Warning). | cross-reference checks, severity levels, orphaned keys | Implementing cross-document validation |
| S7.3 | 7.3 Linter Rules | Table of 10 lint codes (L100-L401): L100/L101 for structural issues, L200-L203 for key reference issues, L300-L301 for FEL interpolation issues, L400-L401 for fallback chain issues. | lint codes, L100-L401 | Implementing locale-specific linter rules |

### Processing Model (Lines 1031-1117)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S8 | 8. Processing Model | How locale string resolution fits into the overall Formspec processing architecture. | processing model | Understanding where locale resolution happens in the pipeline |
| S8.1 | 8.1 Integration with the Four-Phase Cycle | String resolution is NOT part of the core four-phase cycle (Rebuild -> Recalculate -> Revalidate -> Notify). It is a presentation concern. Conceptual layers: (1) Core cycle, (2) String resolution (post-Recalculate), (3) Theme cascade, (4) Render. String resolution and theme cascade are orthogonal and can run in parallel. | presentation concern, four-phase cycle, orthogonal to theme | Understanding the architectural boundary between core processing and locale |
| S8.2 | 8.2 Validation Message Localization | Localized validation messages are resolved at render time, NOT during Revalidate. Core produces ValidationResult with inline message; the locale-aware presentation layer overlays localized messages. `ValidationResult.message` always contains the inline/default-locale message. | render-time resolution, presentation overlay, ValidationResult.message | Implementing localized validation message display |
| S8.3 | 8.3 Reactivity | String resolution is reactive. Re-evaluation triggers: active locale change, field value change (for interpolation), loaded Locale Documents change. Locale notifications are separate from core Phase 4 Notify. Implementations SHOULD create computed signals per resolved string. | reactive, signals, re-evaluation triggers | Implementing reactive locale string resolution |
| S8.4 | 8.4 Repeat Group Paths | String keys use template paths (without instance indices). Same localized string applies to all repeat instances. Per-instance customization uses FEL interpolation with `@index` (1-based). | template path, repeat groups, @index, 1-based | Localizing strings inside repeat groups |

### Security Considerations (Lines 1119-1141)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S9 | 9. Security Considerations | Three security concerns for locale processing. | security | Reviewing locale security posture |
| S9.1 | 9.1 Content Injection | Renderers MUST sanitize localized string values before inserting into HTML or markup. FEL interpolation results are untrusted text, not markup. | sanitization, XSS, untrusted text | Implementing safe rendering of localized strings |
| S9.2 | 9.2 Expression Evaluation | FEL expressions in interpolated strings use the same read-only security model as `calculate`. No side effects, no host platform API access beyond FEL stdlib. | read-only, no side effects | Verifying security of interpolation expressions |
| S9.3 | 9.3 Locale Document Provenance | Host applications SHOULD verify document integrity and provenance using the same mechanisms as other sidecar artifacts. | integrity, provenance | Implementing secure locale document loading |

### Conformance (Lines 1142-1181)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S10 | 10. Conformance | Defines two conformance levels and authoring conformance requirements. | conformance | Determining what a processor or document must implement |
| S10.1 | 10.1 Conformance Levels | Two levels: Locale Core (cascade + interpolation + `locale()`) and Locale Extended (adds `formatNumber()`, `formatDate()`, cross-reference validation, reactive resolution). | Locale Core, Locale Extended | Choosing the right conformance target |
| S10.2 | 10.2 Locale Core Conformance | Five requirements: parse/validate Locale Documents, implement fallback cascade (S4), evaluate FEL interpolation (S3.3), implement `locale()` (S5.1), provide all four capabilities (S6). | Core requirements | Building a minimal locale implementation |
| S10.3 | 10.3 Locale Extended Conformance | Three additional requirements beyond Core: implement `formatNumber()`/`formatDate()` (S5.3-5.4), implement cross-reference validation (S7.2), provide reactive string resolution (S8.3). | Extended requirements | Building a full locale implementation |
| S10.4 | 10.4 Authoring Conformance | Four requirements for Locale Documents: include all required properties, use valid BCP 47 codes, use valid key formats, use valid FEL in interpolations. | authoring requirements | Validating locale documents for conformance |

### Appendix (Lines 1182-1253)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| App A | Appendix A: Complete Locale Document Example | Full example covering all key patterns: `$form.*`, item properties, context labels, choice options, per-code and per-Bind validation messages, shape messages, FEL interpolation with `pluralCategory()` and `formatNumber()`, repeat group `@index`, `$page.*`, `$optionSet.*`, and `$component.*` keys. | complete example, all key patterns | Seeing a realistic complete Locale Document |

## Cross-References

| Reference | Context | Location |
|-----------|---------|----------|
| Formspec v1.0 Core Specification (`../core/spec.md`) | Parent spec; Locale Documents are companions. Items, Binds, Shapes, FEL, Response, and conformant processor definitions are incorporated by reference. | Status, S1.1, S1.3, S1.4, S3.1.4, S3.3, S5.2, S8.1, S8.4 |
| Core spec S3.1 (`now()`) | `locale()` is non-deterministic in the same manner as `now()`. | S5.1 |
| Core spec S3.2.2 (repeat context variables) | `@index` is available in interpolation within repeat groups. | S3.3.2, S8.4 |
| Core spec S3.5 (`pluralCategory()`) | Core FEL function returning CLDR plural categories; used in locale string interpolation. | S1.2, S5.2 |
| Core spec S4 (Definition) | Definition structure and item schema. | S1.4 |
| Core spec S4.3.1 (`constraintMessage`) | Bind-level constraint messages that locale keys can override. | S3.1.4 |
| Core spec S4.6 (OptionSet) | Shared option sets addressable via `$optionSet` prefix. | S3.1.3 |
| Core spec S6.6 (`$ref` with `keyPrefix`) | Modular composition; locale keys MUST use post-assembly keys. | S3.1 |
| Theme spec S6.1 (PageLayout) | Page `id`, `title`, `description` properties addressable via `$page` prefix. | S3.1.7 |
| Component spec S3.1 (component nodes with `id`) | Component node `id` property addressable via `$component` prefix. | S3.1.8 |
| `schemas/locale.schema.json` | Canonical JSON Schema governing Locale Document structure. | BLUF, S2.1 (schema-ref), S7.1 |
| `schemas/component/1.0#/$defs/TargetDefinition` | Shared `$ref` for the `targetDefinition` schema definition. | S2.1 (schema-ref) |
| RFC 2119 / RFC 8174 | Normative keyword definitions (MUST, SHOULD, MAY, etc.). | Conventions |
| RFC 8259 (JSON) | JSON syntax and data types. | Conventions |
| RFC 3986 (URI) | URI syntax for `url` and `targetDefinition.url`. | Conventions |
| BCP 47 / IANA Language Subtag Registry | Locale code format; processors SHOULD validate subtags when available. | S2.3 |
| CLDR (Unicode Common Locale Data Repository) | Plural categories used by `pluralCategory()`. | S5.2 |
| Semantic Versioning | `version` and `compatibleVersions` follow semver. | S2.1, S2.2 |

## String Key Prefix Quick Reference

| Prefix | Target | Scope | Example |
|--------|--------|-------|---------|
| `<itemKey>.*` | Item properties (label, description, hint) | Item binding scope | `projectName.label` |
| `<itemKey>.options.<value>.*` | Choice option labels | Item binding scope | `status.options.yes.label` |
| `<itemKey>.errors.<CODE>` | Validation messages by code | Item binding scope | `email.errors.REQUIRED` |
| `<itemKey>.constraintMessage` | Bind constraint message | Item binding scope | `ssn.constraintMessage` |
| `<itemKey>.requiredMessage` | Required-field message | Item binding scope | `email.requiredMessage` |
| `$form.*` | Form title and description | Global context | `$form.title` |
| `$shape.<id>.*` | Shape rule messages | Shape target scope | `$shape.budget-balance.message` |
| `$page.<id>.*` | Theme page titles/descriptions | Global context | `$page.info.title` |
| `$optionSet.<name>.*` | Shared OptionSet option labels | Global context | `$optionSet.yesNoNA.yes.label` |
| `$component.<id>.*` | Component node string props | Global or repeat scope | `$component.submitBtn.label` |

## Reserved Validation Code Mapping

| `constraintKind` | Synthesized `code` |
|---|---|
| `required` | `REQUIRED` |
| `type` | `TYPE_MISMATCH` |
| `cardinality` | `MIN_REPEAT` or `MAX_REPEAT` |
| `constraint` | `CONSTRAINT_FAILED` |
| `shape` | `SHAPE_FAILED` |
| `external` | `EXTERNAL_FAILED` |

## Linter Rules Quick Reference

| Code | Description |
|------|-------------|
| L100 | Missing required top-level property |
| L101 | Invalid BCP 47 locale code |
| L200 | Orphaned string key -- item not found in Definition |
| L201 | Missing translation -- localizable property has no key |
| L202 | Invalid option value reference |
| L203 | Invalid shape ID reference |
| L300 | FEL interpolation parse error |
| L301 | FEL interpolation references undefined variable |
| L400 | Circular fallback chain detected |
| L401 | Fallback locale not loaded |

## Critical Behavioral Rules

1. **String resolution is a presentation concern, NOT part of the core four-phase cycle (S8.1).** It runs after Recalculate, orthogonal to the Theme cascade. Locale changes are presentation-layer events, not core data events. Do not interleave locale resolution with Rebuild/Recalculate/Revalidate/Notify.

2. **The fallback cascade has four steps in strict order (S4.1).** Regional locale -> explicit `fallback` chain -> implicit language fallback (strip region) -> inline defaults. The implicit language step is skipped if the explicit chain already consulted that base language. Processor MUST return the first non-null result; if all fail, return empty string `""`.

3. **Circular fallback chains MUST be detected and MUST terminate (S4.3).** When `fr-CA` -> `fr` -> `fr-CA` is detected, the processor MUST stop the cascade and fall through to inline defaults. It SHOULD warn.

4. **Interpolation rule 3a distinguishes author typos from intentional empty values (S3.3.1).** When an expression evaluates to `null` AND has no `$` or `@` sigil AND is not a static literal, the processor MUST preserve the literal `{{...}}` text rather than producing an empty string. This prevents silent data loss from misspelled function names or invalid expressions that happen to evaluate to null.

5. **Interpolation failure MUST NOT break the entire string (S3.3.1 rule 2).** A failed expression is replaced with its literal `{{original expression}}` text. The rest of the string still resolves normally. Error-severity FEL diagnostics count as evaluation failure even when the coerced value is `null`.

6. **Validation messages are localized at render time, not during Revalidate (S8.2).** `ValidationResult.message` always contains the inline/default-locale message. The locale-aware presentation layer overlays the localized message. This means the ValidationResult is never mutated by locale processing.

7. **Locale codes are case-insensitive but string keys are case-sensitive (S2.3, S3.2).** `fr-CA`, `FR-CA`, and `fr-ca` all match the same locale, but `projectName.label` and `ProjectName.label` are different string keys. Processors SHOULD normalize locale codes to lowercase language + title-case region.

8. **Orphaned keys produce warnings, not errors (S3.2 rule 2).** A key referencing an item not in the Definition MUST NOT cause failure. This enables forward-compatible Locale Documents that include keys for items in newer Definition versions.

9. **Loading a Locale Document MUST NOT trigger reactive updates (S6.1).** Only `setLocale()` triggers cascade building and reactive string resolution. This prevents partial-load rendering glitches.

10. **Repeat group keys use template paths -- no instance indices (S8.4).** `lineItems.amount.label` applies to ALL instances. Per-instance differentiation requires FEL interpolation with `@index` (which is 1-based). The key `lineItems[0].amount.label` is NOT valid.

11. **`$page.` and `$component.` keys create cross-tier dependencies (S3.1.7, S3.1.8).** A Locale Document using these keys depends on both the target Definition AND the associated Theme/Component Document. Validators SHOULD warn when referenced page IDs or node IDs are not found.

12. **Field-level option keys override OptionSet-level keys (S3.1.3).** The cascade for option labels is: field-level locale key -> OptionSet-level locale key -> inline Definition label. This allows context-specific translations for shared option sets.

13. **Version mismatch MUST NOT fail (S2.2).** When `compatibleVersions` is present and unsatisfied, the processor SHOULD warn and MAY fall back to inline strings, but MUST NOT reject the document or halt processing.

14. **Interpolation is not recursive (S3.3.1 rule 6).** The output of evaluating an expression is never scanned for further `{{...}}` sequences. This prevents injection attacks and infinite loops.

15. **`locale()` is available in ALL FEL contexts, not just interpolation (S5.1).** It works in `calculate`, `relevant`, `constraint`, and `readonly` expressions, enabling locale-aware conditional logic in the Definition itself (e.g., showing items only for certain locales).
