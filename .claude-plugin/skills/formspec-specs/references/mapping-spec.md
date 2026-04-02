# Mapping Specification Reference Map

> specs/mapping/mapping-spec.md -- 2023 lines, ~94K -- Companion: Bidirectional Transforms, Format Adapters (JSON, XML, CSV)

## Overview

The Formspec Mapping DSL is a companion specification to Formspec v1.0 that defines a declarative, JSON-native language for expressing bidirectional data transformations between Formspec Responses and external system schemas (API payloads, database records, CSV exports, XML documents). It reuses FEL (Formspec Expression Language) for all computed transforms, generalizes the version-migration `fieldMap` from core spec section 6.7, and defines three conformance levels (Core, Bidirectional, Extended) with three built-in format adapters (JSON, XML, CSV). The specification is independent of the core spec -- a conformant Formspec Core processor is NOT required to implement it.

## Section Map

### Front Matter (Lines 1-63)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Abstract | Abstract | Summarizes the spec as a companion to Formspec v1.0 for declaring bidirectional transforms between Responses and external schemas using FEL as the computation substrate. | Mapping Document, FEL reuse, fieldMap generalization, bidirectional | Getting a one-paragraph summary of what this spec does |
| -- | Status of This Document | Declares this is a draft specification, companion to core, not stable for production. | draft, companion, not stable | Checking maturity/stability of the mapping spec |
| -- | Conventions and Terminology | RFC 2119 keyword definitions, JSON/URI standards references, incorporation of core spec terms (Definition, Instance, Response, Bind, FEL). | RFC 2119, RFC 8259, RFC 6901, RFC 3986 | Understanding normative language conventions |
| -- | Bottom Line Up Front | 4-bullet summary: bidirectional DSL, required top-level fields, declarative field rules, governed by mapping schema. | BLUF summary | Quick orientation before reading the full spec |

### 1. Introduction (Lines 65-290)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1.1 | Purpose | Explains the gap between Formspec Responses and external system requirements (relational DBs, XML schemas, CSV, REST APIs) and how this spec provides a declarative mapping language to bridge that gap without bespoke mapping code. | Mapping Document, bidirectional, round-trip, declarative transforms | Understanding why the mapping spec exists |
| 1.2 | Scope | Enumerates what is defined (field renaming, coercion, value mapping, arrays, conditionals, defaults, bidirectional semantics, adapters) and what is NOT (transport, auth, rendering, scheduling, persistence). | in-scope vs out-of-scope | Determining if a feature belongs in the mapping spec |
| 1.3 | Relationship to Formspec Core | Defines mapping as a companion (not extension/supersession). Core processors need not implement it. Mapping processors MUST implement FEL and understand Response schema. Formalizes that every S6.7 fieldMap entry is a degenerate Mapping Document Field Rule. | companion spec, FEL requirement, S6.7 generalization | Understanding how mapping and core specs relate |
| 1.4 | Terminology | Defines 7 key terms with precise meanings: Mapping Document, Source Schema, Target Schema, Forward Mapping, Reverse Mapping, Transform, Field Rule, Adapter. | Mapping Document, Source/Target Schema, Forward/Reverse Mapping, Transform, Field Rule, Adapter | Looking up precise definitions of mapping-specific terms |
| 1.5 | Conformance | Defines three conformance levels as strict supersets: Core, Bidirectional, Extended. Each higher level implies all lower-level requirements. | conformance levels | Determining what a processor must implement |
| 1.5.1 | Mapping Core | Forward JSON mapping only. Must parse Mapping Documents, implement FEL, support all transform types, handle array/repeat mappings, and report diagnostics. NOT required to support reverse, XML, or CSV. | Mapping Core, forward-only, JSON | Building a minimal mapping implementation |
| 1.5.2 | Mapping Bidirectional | Adds reverse mapping, round-trip fidelity guarantee (forward then reverse reproduces original covered values), and lossy transform detection/reporting. Implies Core conformance. | Mapping Bidirectional, round-trip fidelity, lossy detection | Implementing reverse mapping support |
| 1.5.3 | Mapping Extended | Adds XML Adapter (namespaces, attributes, mixed content) and CSV Adapter (RFC 4180, configurable delimiters, header rows, multi-row repeat flattening). Implies Bidirectional conformance. | Mapping Extended, XML Adapter, CSV Adapter | Implementing XML or CSV serialization support |
| 1.6 | Notational Conventions | JSON conventions, ellipsis, comments, dot/bracket path notation, wildcard `[*]`, RFC 2119 keyword casing rules. | dot notation, bracket indexing, `[*]` wildcard | Understanding path syntax and example conventions |

### 2. Conceptual Model (Lines 292-582)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2.1 | Overview | A Mapping Document is standalone JSON answering three questions: what goes where, how is it transformed, and in which direction(s). The Mapping Engine is the runtime that interprets it, delegating format concerns to Adapters. | Mapping Document (3 questions), Mapping Engine, format-agnostic | Getting the 30-second conceptual overview |
| 2.2 | Architecture | ASCII architecture diagram showing Formspec Response <-> Mapping Engine <-> External System. Engine has 3 sub-components: Mapping Document (declarative rules), FEL Evaluator (same as core), Adapter (format-specific serialization). | Mapping Engine architecture, FEL Evaluator reuse, Adapter component | Understanding the runtime architecture and component responsibilities |
| 2.3 | Mapping Document Lifecycle | 5-stage lifecycle: Authoring, Association (external to Definition -- core spec is unaware of mapping), Versioning (independent semver + definitionVersion range), Distribution (bundled/referenced/inline), Retirement (deprecation). | lifecycle, independent versioning, definitionVersion range, association | Understanding how Mapping Documents are created, versioned, and distributed |
| 2.4 | Data Flow | Detailed 4-stage pipeline for both forward and reverse paths with ASCII diagrams. Forward: Extract -> Transform -> Restructure -> Serialize. Reverse: Parse -> Restructure -> Transform -> Inject. | forward pipeline, reverse pipeline, Extract/Transform/Restructure/Serialize | Understanding the step-by-step execution flow in each direction |
| 2.4.1 | Forward Path | Extract source field values from Response -> Transform via FEL/coercions/value maps -> Restructure into target shape (path remapping, arrays, flattening) -> Serialize via Adapter (trivial for JSON). | Extract, Transform, Restructure, Serialize | Tracing forward mapping execution |
| 2.4.2 | Reverse Path | Parse external format via Adapter -> Restructure by mapping external paths back to Response hierarchy -> Transform via reverse FEL/inverse coercions -> Inject into Response data. Engine MUST NOT overwrite uncovered fields. New Response gets `status: "in-progress"`. | Parse, Restructure, Transform, Inject, uncovered fields preserved | Tracing reverse mapping execution |
| 2.5 | Relationship to S6.7 Migrations | Formal mapping table between S6.7 migration concepts (source, target, transform, defaults) and Mapping DSL equivalents (sourcePath, targetPath, transform, defaults). Both source and target are Responses in migrations. Processor SHOULD accept S6.7 entries as Mapping rules without modification. | S6.7 equivalence table, degenerate case | Converting between S6.7 fieldMap entries and Mapping Document rules |
| 2.6 | Design Principles | 6 prioritized principles: (1) Declarative over imperative -- no loops/assignments/control-flow, (2) FEL for all computation, (3) Composition over complexity, (4) Explicit over implicit -- no silent auto-mapping by default, (5) Bidirectional by default with explicit opt-out, (6) Independence from transport/storage. | declarative, FEL-only, composition, explicit, bidirectional-default, transport-independent | Understanding design tradeoffs and why the spec works as it does |

### 3. Mapping Document Schema (Lines 585-920)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Mapping Document Schema (intro) | Normative JSON structure definition. Property names are case-sensitive. Unrecognized root properties MUST be rejected unless prefixed with `x-` (vendor extension). | case-sensitive, x- vendor extensions, root property rejection | Authoring or validating a Mapping Document |
| 3.1 | Top-Level Structure | Complete schema-ref table of all root properties: `$formspecMapping` (const "1.0"), `$schema`, `adapters`, `autoMap`, `conformanceLevel`, `defaults`, `definitionRef`, `definitionVersion`, `direction`, `rules`, `targetSchema`, `version`. Generated schema reference from `schemas/mapping.schema.json` is the canonical structural contract. | top-level properties, `$formspecMapping`, `definitionRef`, `definitionVersion`, `direction`, `rules`, `targetSchema`, `autoMap`, `defaults`, `conformanceLevel` | Building or parsing the root of a Mapping Document |
| 3.1.1 | Versioning | `version` is the Mapping Document's own semver, independent of Definition version and spec version. Used for cache invalidation. `definitionVersion` is a semver range; engine MUST refuse execution on mismatch. | version independence, definitionVersion range validation, cache invalidation | Implementing version compatibility checking |
| 3.1.2 | Direction Semantics | `"forward"` = source-to-target only (reverse MUST error), `"reverse"` = target-to-source only (forward MUST error), `"both"` = either direction with optional per-rule reverse overrides. | direction enum, error on wrong direction | Implementing direction enforcement |
| 3.1.3 | Example | Complete FHIR Patient R4 mapping example demonstrating preserve, coerce (datetime to date), valueMap (biological sex to FHIR gender), expression with condition, constant, and custom adapter configuration. | FHIR Patient example | Seeing a realistic complete Mapping Document |
| 3.2 | Target Schema Descriptor | `targetSchema` object: `format` (REQUIRED: json/xml/csv), `name` (RECOMMENDED), `url` (OPTIONAL), `rootElement` (REQUIRED when xml), `namespaces` (conditional for xml, empty string key for default namespace). | targetSchema, format, rootElement, namespaces | Configuring the target format for a mapping |
| 3.2.1 | Format-Specific Behavior | JSON: dot/bracket paths, well-formed JSON per RFC 8259. XML: dot paths for elements, `@` prefix for attributes (e.g., `Patient.name.@use`). CSV: flat column header names only -- dot paths MUST error. | json path syntax, xml attribute `@` prefix, csv flat constraint | Understanding path syntax rules per target format |
| 3.2.2 | Example (XML) | CDA R2 ClinicalDocument XML target schema example with namespace declarations (default namespace and `xsi`). | XML target schema example | Setting up an XML target schema |
| 3.3 | Field Rule Structure | Complete property table for Field Rules (13 properties): `sourcePath`, `targetPath`, `transform`, `expression`, `coerce`, `valueMap`, `reverse`, `bidirectional`, `condition`, `default`, `array`, `description`, `priority`. At least one of sourcePath/targetPath MUST be present. When `array.innerRules` exists, parent SHOULD still declare `transform` (typically "preserve"); schema requires it for valid interchange. | Field Rule schema, all 13 properties, sourcePath/targetPath requirement | Authoring or validating individual Field Rules |
| 3.3.1 | Transform Types | Enumeration of all 10 transform type values (`preserve`, `drop`, `expression`, `coerce`, `valueMap`, `flatten`, `nest`, `constant`, `concat`, `split`) with brief behavior descriptions and required properties. Unknown transform values MUST be rejected. | preserve, drop, expression, coerce, valueMap, flatten, nest, constant, concat, split | Quick reference for transform type selection |
| 3.3.2 | Coerce Object | Schema for `coerce`: `from` (REQUIRED), `to` (REQUIRED), `format` (OPTIONAL pattern string, e.g., `"YYYY-MM-DD"`). Valid type strings: `string`, `number`, `boolean`, `date`, `datetime`, `integer`, `array`, `object`. Unsupported from/to combinations MUST error. | coerce schema, from/to types, format pattern | Implementing type coercion configuration |
| 3.3.3 | ValueMap Object | Schema for `valueMap`: `forward` (REQUIRED), `reverse` (OPTIONAL -- inferred by inverting forward if injective; MUST error if non-injective without explicit reverse), `unmapped` (strategy: error/drop/passthrough/default -- defaults to `"error"` for structured shape, `"passthrough"` for legacy flat shorthand), `default`. | valueMap schema, forward/reverse maps, unmapped strategy, legacy shorthand | Implementing value lookup tables |
| 3.3.4 | Array Object | Schema for `array`: `mode` (REQUIRED: each/whole/indexed), `separator` (OPTIONAL), `innerRules` (OPTIONAL: ordered array of Field Rules with element-relative paths). | array schema, mode enum, innerRules, element-relative paths | Mapping arrays and repeat groups |
| 3.3.5 | Example | Complete Field Rule example combining expression transform with reverse, condition, default, array (whole mode), priority, bidirectional flag, and description. | comprehensive Field Rule example | Seeing all Field Rule properties used together |
| 3.4 | Field Rule Ordering and Precedence | 5-step deterministic procedure: (1) priority sort descending, (2) stable order for ties, (3) condition guard before execution, (4) last-write-wins for same targetPath with diagnostic warning, (5) defaults written before any rules execute. Higher priority executes FIRST but gets OVERWRITTEN by later lower-priority rules targeting the same path. | priority sort, stable order, condition guard, last-write-wins, defaults-first | Understanding rule execution order and conflict resolution |
| 3.5 | Auto-Mapping | When `autoMap: true`, processor generates synthetic `preserve` rules at priority -1 for uncovered source fields. | autoMap, synthetic rules, priority -1 | Implementing or using auto-mapping |
| 3.5.1 | Synthetic Rule Generation | 4-step algorithm: (1) enumerate source leaf paths, (2) exclude paths covered by explicit rules (regardless of condition), (3) generate preserve rules at priority -1, (4) append to end of sorted list. | synthetic rule generation algorithm | Implementing the auto-map generator |
| 3.5.2 | Constraints | Auto-mapping is shallow (top-level and directly nested scalars only -- no recursive expansion). Explicit rules always win. `drop` suppresses auto-map for matching sourcePath. CSV format silently skips dotted paths during auto-map generation. | shallow enumeration, drop suppression, CSV skip | Understanding auto-map edge cases and limitations |
| 3.5.3 | Example | Shows name/email/age response with one explicit email rule; auto-map generates preserve for name and age. Effective rule set table shows origin. | auto-map example | Seeing auto-map in action |

### 4. Transform Operations (Lines 922-1461)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Transform Operations (intro) | Every Field Rule MUST specify exactly one transform type via `transform`. The transform type determines which additional properties are required or permitted. | transform operations, exactly one per rule | Implementing or using any transform type |
| 4.1 | Transform Type Reference | Summary table of all 10 transforms with auto-reversibility status (Yes/No/Conditional) and required properties. | transform reference table | Quick lookup of transform capabilities |
| 4.2 | `preserve` -- Identity Copy | Copies source value to target unmodified, retaining source type. Always auto-reversible (engine copies from targetPath back to sourcePath). Incompatible types SHOULD trigger implicit coercion with diagnostic warning. | preserve, identity, auto-reversible, implicit coercion warning | Implementing the simplest transform |
| 4.3 | `drop` -- Discard | Suppresses source value; no property written to target. Never reversible. `bidirectional: true` on drop MUST produce validation error. `targetPath` null/omitted is accepted; if `targetPath` is provided, field is still omitted from output. | drop, never reversible, targetPath null accepted, bidirectional validation | Implementing field exclusion |
| 4.4 | `expression` -- FEL Evaluation | Evaluates a FEL expression to compute target value. Binding context: `$` = resolved source value at sourcePath (or null if absent), `@source` = entire source document root. Both bindings MUST be available. Not auto-reversible; requires explicit `reverse.expression` for bidirectional use -- `bidirectional: true` without `reverse` block MUST error. | expression, `$` binding, `@source` binding, not auto-reversible | Implementing computed transforms with FEL |
| 4.5 | `coerce` -- Type Conversion | Converts source value between types using `coerce.from`/`coerce.to`. Complete 7x7 conversion matrix (string, number, integer, boolean, date, datetime, money). Lossy conversions: datetime->date (time discarded), money->number/integer (currency discarded). Specific coercion rules for string<->boolean ("true"/"yes"/"1"), boolean->integer (true->1), date/datetime->string (ISO 8601 default), money->number (extracts amount). | coerce, conversion matrix, lossy markers, format property, coercion rules | Implementing type conversions between Formspec and external types |
| 4.6 | `valueMap` -- Lookup Table | Static lookup table substitution. Bijective maps auto-derive reverse by key-value inversion. Non-injective (duplicate values) auto-reversal is impossible -- explicit `reverse.valueMap.forward` MUST be provided. 4 unmapped strategies: error (default for structured), passthrough (default for legacy shorthand), drop, default. Same `unmapped` strategy applies in both directions unless `reverse` block overrides. | valueMap, bijective auto-reverse, unmapped strategies, forward/reverse maps, legacy shorthand | Implementing enumeration/code translation |
| 4.7 | `flatten` -- Collapse Nested/Array Structures | 3 modes inferred from source shape: Delimited (array + separator -> joined string), Positional (array without separator -> indexed fields `<targetPath>_0`, `_1`...), Dot-prefix (object -> flat dot-delimited keys). Auto-reversible, pairs with `nest`. `expression` OPTIONAL for structural modes, REQUIRED for non-trivial projection (e.g., per-element extraction before join). | flatten, 3 modes, separator, auto-reversible with nest, mode inference | Collapsing nested structures to flat representations |
| 4.8 | `nest` -- Expand Flat to Nested | Inverse of `flatten`. Mode inferred from source shape: delimited string + separator -> split into array, positionally-named fields -> ordered array, dot-prefixed fields -> nested object. Auto-reversible, pairs with `flatten`. | nest, inverse of flatten, mode inference | Expanding flat structures back to nested form |
| 4.9 | `constant` -- Fixed Value Injection | Writes fixed value to target. `sourcePath` NOT REQUIRED, MUST be ignored if present. `expression` provides the literal value (MAY reference `@source` but SHOULD NOT). NOT reversible -- `bidirectional: true` MUST produce validation error. | constant, no sourcePath, not reversible | Injecting envelope fields, API versions, fixed metadata |
| 4.10 | `concat` -- Multiple Sources to Single Target String | Combines multiple source fields into one string via FEL expression using `@source` references. `sourcePath` NOT REQUIRED. Result MUST be string (non-string coerced via `string()`). NOT auto-reversible (boundary information lost). `bidirectional: true` without explicit `reverse` expression MUST NOT be set. | concat, multi-source, string result, not auto-reversible | Combining names, addresses, or other multi-field values |
| 4.11 | `split` -- Single Source to Multiple Targets | Decomposes single source value into multiple target fields. Expression MUST return an object (keys appended to targetPath) or array (indices as positional suffixes). `$` = source value, `@source` = full document. | split, object/array return, positional suffixes | Decomposing composite values into structured fields |
| 4.12 | Array Operations | Controls how array-valued source fields (including Formspec repeat groups) are mapped. When present, `array` MUST contain `mode`. | array operations, repeat groups | Mapping arrays and Formspec repeat sections |
| 4.12.1 | `array` Object Schema | Properties: `mode` (REQUIRED: each/whole/indexed), `separator` (OPTIONAL, valid only with whole), `innerRules` (OPTIONAL: nested Field Rules with element-relative paths). | array object schema | Configuring array mapping behavior |
| 4.12.2 | `mode: "each"` | Iterates every source element, applying transform/expression or innerRules per element. Bindings: `$` = current element, `$index` = zero-based index, `@source` = full document. InnerRule paths resolve relative to current element. Target MUST contain one output element per source element, in order. | each mode, `$index`, element-relative paths, one-to-one | Implementing per-element array transforms |
| 4.12.3 | `mode: "whole"` | Treats entire array as a single value (`$` = complete array). Appropriate for aggregate operations like sum, filter, join. | whole mode, aggregate operations | Implementing whole-array transforms |
| 4.12.4 | `mode: "indexed"` | Applies innerRules by positional index. Each inner rule MUST include an `index` property (integer). Elements not covered by any inner rule are DROPPED. | indexed mode, positional, uncovered dropped | Implementing positional array mapping (e.g., CSV columns) |
| 4.12.5 | Complete Example | Repeat group `budget_items` mapped to `line_items` using `mode: "each"` with innerRules for preserve (description->label), coerce (amount->string value), and valueMap (category->type code) per element. Shows source, rule, and target JSON. | array each example, repeat group mapping | Seeing a complete array mapping with inner rules |
| 4.13 | Conditional Mapping | `condition` property: FEL boolean expression. If false or null, entire rule skipped -- no output, no side effects. Bindings: `$` = sourcePath value (null if absent), `@source` = full document. Evaluated BEFORE any transform. A skipped rule MUST NOT produce an error even if its expression or sourcePath would be invalid. | condition, pre-transform evaluation, skip semantics | Implementing conditional field mapping |
| 4.13.1 | Branching | Multiple rules MAY target same targetPath with mutually exclusive conditions. Non-exclusive conditions SHOULD warn but MUST NOT error. When multiple rules targeting same path evaluate to true, last rule in document order wins. | branching, mutually exclusive conditions, last-rule-wins | Implementing type-discriminated or conditional routing |
| 4.13.2 | Reverse Direction | During reverse mapping, `condition` evaluates against the external document (reverse-direction source). `$` and `@source` bind to external values. Authors SHOULD ensure conditions are meaningful in both directions or provide `reverse.condition` override. | reverse condition, external document binding | Implementing conditional logic that works bidirectionally |

### 5. Bidirectional Semantics (Lines 1464-1599)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5.1 | Forward and Reverse Execution | Direction table: Forward = Response -> External (default), Reverse = External -> Response. `direction` property controls default. Individual rules declare directional participation via `bidirectional`. Core processors MAY ignore `bidirectional` and support forward only. | direction semantics, forward/reverse roles | Understanding source/target role swapping |
| 5.2 | Auto-Reversal | Complete table of auto-reversibility per transform type with inverse transforms and conditions. Lossless coercion pairs enumerated: string<->integer, string<->number, string<->boolean, date<->string (ISO 8601). Pairs not listed (number->integer, money->number) are lossy and MUST NOT be auto-reversed. | auto-reversal table, lossless coercion pairs, inverse transforms | Determining which transforms can be automatically reversed |
| 5.3 | Explicit Reverse Overrides | `reverse` object may contain: `transform`, `expression`, `coerce`, `valueMap`, `default`. sourcePath and targetPath swap automatically during reverse execution. The `reverse` block MUST NOT re-specify them -- validation error if either appears inside `reverse`. | reverse block, auto path swap, forbidden properties | Implementing explicit reverse transform configuration |
| 5.4 | Lossy Transforms and Non-Reversibility | Formal definition: transform T is lossy if distinct s1 != s2 produce T(s1) = T(s2). Lossy transforms: drop, expression (without reverse), lossy coerce, many-to-one valueMap, concat, split. Lossy rules MUST set `bidirectional: false`. Lossy + `bidirectional: true` without `reverse` MUST error. Reverse through `bidirectional: false` MUST error (not silently skip). | lossy definition, bidirectional enforcement, error on reverse of non-reversible | Implementing lossy transform detection and enforcement |
| 5.5 | Round-Trip Fidelity | Formal mathematical definitions: Response Round-Trip P(R_M(F_M(R))) = P(R), and External Round-Trip F_M(R_M(F_M(R))) = F_M(R), where P is projection onto covered paths. Uncovered fields left untouched. Bidirectional conformance MUST satisfy both. | round-trip fidelity, P(R) projection, response round-trip, external round-trip | Verifying or testing bidirectional correctness |
| 5.6 | Conflict Resolution in Reverse Mapping | When multiple external fields map to same Response path: (1) last-rule-wins in document order, (2) processor SHOULD warn, (3) `reversePriority` (non-negative integer) overrides document order -- highest wins; equal priorities fall back to last-rule-wins. | reverse conflict resolution, reversePriority, last-rule-wins | Handling multiple-to-one reverse mapping conflicts |

### 6. Format Adapters (Lines 1601-1730)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6.1 | Adapter Architecture | Adapters implement two operations: serialize (JSONValue -> bytes) and deserialize (bytes -> JSONValue). 3 built-in adapters: JSON (Mapping Core), XML (Mapping Extended), CSV (Mapping Extended). Active adapter determined by `targetSchema.format`; JSON is default when omitted. Custom adapters via S6.5. | adapter operations, serialize/deserialize, built-in adapters, format selection | Understanding the adapter abstraction |
| 6.2 | JSON Adapter | Identity serialization -- engine's internal representation is already JSON. Target paths use dot-notation with bracket indexing. Intermediate objects and arrays MUST be created automatically. Configuration (`adapters.json`): `pretty` (boolean), `sortKeys` (boolean), `nullHandling` ("include"/"omit"). | JSON adapter, identity serialization, auto-create intermediates, null handling | Configuring JSON output formatting |
| 6.3 | XML Adapter (Mapping Extended) | Serializes internal JSON as XML 1.0 document. Path conventions: `a.b.c` = nested elements, `a.b.@id` = attribute on parent, `a.b[0].c` = repeated sibling. Namespace colon notation (`xsi:type`). Requires `rootElement`, optional `namespaces`. Configuration (`adapters.xml`): `declaration` (boolean), `indent` (integer), `cdata` (string array of paths). | XML adapter, attribute `@` prefix, namespace prefixes, rootElement, CDATA | Implementing XML serialization with namespaces and attributes |
| 6.4 | CSV Adapter (Mapping Extended) | Serializes internal JSON as RFC 4180 delimited text. Structural constraint: all target paths MUST be simple identifiers (no dots or brackets) -- nested path MUST error. Repeat groups emit separate rows; non-repeat fields duplicated across rows. Configuration (`adapters.csv`): `delimiter`, `quote`, `header` (boolean), `encoding`, `lineEnding` ("crlf"/"lf"). | CSV adapter, flat paths only, repeat -> rows, RFC 4180 | Implementing CSV serialization for tabular export |
| 6.5 | Custom Adapters | Custom adapter identifiers MUST begin with `x-` prefix. Configuration placed under `adapters.<identifier>`. MUST implement same serialize/deserialize interface. Unrecognized adapter identifier MUST report diagnostic error and MUST NOT silently fall back to JSON. | custom adapters, x- prefix, no silent fallback | Extending the adapter system with custom formats |

### 7. Processing Model (Lines 1732-1810)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7.1 | Execution Pipeline | 7-step ordered pipeline: (1) Validate (parse JSON, verify schema, confirm definitionVersion), (2) Resolve direction, (3) Apply defaults (before rules), (4) Generate auto-map rules, (5) Sort rules (priority descending, stable), (6) Execute rules (condition -> resolve sourcePath -> apply transform -> write targetPath), (7) Serialize via Adapter. Reverse execution swaps source/target roles at step 6. Implementations MAY optimize but MUST produce indistinguishable results. | 7-step pipeline, execution order, deterministic | Implementing a conformant mapping engine |
| 7.2 | Error Handling | 4 error categories with different severities: Validation (MUST halt before step 6), Resolution (use default if available, else non-fatal diagnostic), Transform (non-fatal diagnostic, continue with remaining rules), Adapter (MUST halt, no partial output). Diagnostic object schema: `ruleIndex`, `sourcePath`, `targetPath`, `errorCode`, `message`. 8 standard error codes: INVALID_DOCUMENT, VERSION_MISMATCH, INVALID_FEL, PATH_NOT_FOUND, COERCE_FAILURE, UNMAPPED_VALUE, FEL_RUNTIME, ADAPTER_FAILURE. | error categories, halt vs non-fatal, Diagnostic object, error codes | Implementing error handling and diagnostics |
| 7.3 | Null and Absent Value Handling | Formspec Responses distinguish absent fields from explicit null. 3x4 behavior matrix across scenarios (absent+default, absent+no-default, explicit null) and transforms (preserve, expression, coerce, valueMap). Key behaviors: absent+default -> write default; absent+no-default -> omit target (preserve/coerce/valueMap) or evaluate with `$`=null (expression); explicit null -> write null (preserve), evaluate with `$`=null (expression), write null (coerce), look up null key then unmapped strategy (valueMap). | absent vs null, default handling, behavior matrix | Implementing null/absent handling for each transform type |
| 7.4 | Idempotency | Forward mapping MUST be idempotent: same Response + same Document = same output every time. No non-determinism (random IDs, timestamps, hash-map iteration order) unless the Mapping Document explicitly invokes a non-deterministic FEL function. Reverse mapping is similarly idempotent. | idempotency, determinism requirement | Verifying deterministic behavior of mapping execution |

### 8. Examples (Lines 1812-1937)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8.1 | Grant Application to Federal API | Maps grant form (applicant_name, ein, budget_total, budget_items repeat, narrative) to federal API (organization.name, organization.taxId, financials.requestedAmount, lineItems[], projectDescription). Demonstrates preserve, expression with explicit reverse (EIN dash stripping), coerce, array each with innerRules (valueMap for category codes), and defaults for envelope fields. | grant API example, EIN formatting, array innerRules | Seeing a realistic JSON API mapping with arrays |
| 8.2 | Patient Intake to CSV Export | Maps patient form (name, dob, medications repeat, allergies array) to flat CSV with positional medication columns and delimited allergy list. Uses preserve, coerce (date to string), flatten with indexed mode for positional columns, flatten with separator for array join. All targetPaths are simple identifiers per CSV constraint. | CSV export example, indexed positional columns, flatten separator | Seeing a realistic CSV mapping with repeat groups |
| 8.3 | Bidirectional FHIR Integration | Round-trip mapping between vitals form and HL7 FHIR Observation resource. Uses preserve, coerce (number, string), and constant (resourceType). Demonstrates auto-reversal for lossless rules, forward-only constant that is skipped in reverse, and defaults that apply only to forward target. | FHIR example, bidirectional, constant forward-only, auto-reversal | Seeing a realistic bidirectional integration mapping |

### Appendix A. Relationship to S6.7 Migrations (Lines 1939-2023)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| A (intro) | Appendix A. Relationship to S6.7 Migrations (Normative) | Formal, normative algorithm for converting S6.7 version migration descriptors into Mapping Documents. | S6.7 conversion algorithm | Converting existing migration descriptors to Mapping Documents |
| A.1 | Conversion Algorithm | 5-step algorithm: (1) create Mapping Document with direction: "forward", version: "1.0.0", definitionVersion = source version, (2) set targetSchema.format: "json", (3) convert each fieldMap entry (source->sourcePath, null target->drop with bidirectional:false, transform directly, expression->bidirectional:false), (4) copy defaults to Mapping Document top level, (5) set autoMap: true to replicate S6.7 pass-through semantics. | conversion algorithm, 5 steps | Implementing S6.7-to-Mapping conversion |
| A.2 | Example | Side-by-side S6.7 migration descriptor (with fieldMap for budget restructuring, indirect_rate drop, pi_name expression) and equivalent Mapping Document. Includes property correspondence table mapping S6.7 properties to Mapping Document properties. | conversion example, property correspondence | Seeing a concrete S6.7 to Mapping Document conversion |

## Cross-References

- **Formspec v1.0 core specification** -- Parent spec; Mapping DSL is a companion. Response schema (S2.1.6), FEL (S3), version migrations (S6.7) are incorporated by reference. (Abstract, S1.1, S1.3, S2.5, Appendix A)
- **S6.7 of the core specification (version-migration `fieldMap`)** -- The Mapping DSL generalizes this. Every S6.7 fieldMap entry is a degenerate Mapping Document Field Rule. Formal conversion algorithm in Appendix A. (Abstract, S1.3, S2.5, Appendix A)
- **S3 of the core specification (FEL)** -- FEL is the computation substrate for all transform expressions. Mapping processors MUST implement FEL including all built-in functions. (S1.3, S1.5.1, S2.2, S2.6)
- **S2.1.6 of the core specification (Response schema)** -- Mapping processors MUST understand the Formspec Response schema. (S1.3)
- **schemas/mapping.schema.json** -- Canonical JSON Schema governing Mapping Document structure. Generated schema-ref table in S3.1 is the structural contract. (BLUF, S3.1)
- **RFC 8259 (JSON)** -- JSON syntax standard. Mapping Documents are JSON. JSON adapter serialization. (Conventions, S3.2.1, S6.2, S7.1)
- **RFC 6901 (JSON Pointer)** -- JSON Pointer syntax reference. (Conventions)
- **RFC 3986 (URI)** -- URI syntax for `definitionRef` and `targetSchema.url`. (Conventions)
- **RFC 4180 (CSV)** -- CSV format standard for the CSV adapter. (S1.5.3, S6.4)
- **RFC 2119 / RFC 8174 (Key words)** -- Normative keyword definitions (MUST, SHOULD, MAY, etc.). (Conventions)
- **Semantic Versioning 2.0.0** -- `version` and `definitionVersion` follow semver. `definitionVersion` uses node-semver range syntax. (S2.3, S3.1.1)
- **HL7 FHIR** -- Referenced in examples: Patient R4 (S3.1.3), Observation (S8.3). (S3.1.3, S8.3)

## Key Schemas Defined

| Schema / Structure | Section | Description |
|--------------------|---------|-------------|
| **Mapping Document (root)** | S3.1 | Top-level JSON object with `$formspecMapping`, `$schema`, `version`, `definitionRef`, `definitionVersion`, `direction`, `targetSchema`, `rules`, `defaults`, `autoMap`, `conformanceLevel`, `adapters`. |
| **Target Schema Descriptor** | S3.2 | Object describing external format: `format` (json/xml/csv), `name`, `url`, `rootElement`, `namespaces`. |
| **Field Rule** | S3.3 | Atomic mapping unit with 13 properties: `sourcePath`, `targetPath`, `transform`, `expression`, `coerce`, `valueMap`, `reverse`, `bidirectional`, `condition`, `default`, `array`, `description`, `priority`. |
| **Coerce Object** | S3.3.2 | `from` (type string), `to` (type string), `format` (optional pattern string). |
| **ValueMap Object** | S3.3.3 | `forward` (object), `reverse` (object, optional), `unmapped` (strategy string), `default` (any). Also supports legacy flat shorthand. |
| **Array Object** | S3.3.4 | `mode` (each/whole/indexed), `separator` (string), `innerRules` (array of Field Rules). |
| **Reverse Override Object** | S5.3 | `transform`, `expression`, `coerce`, `valueMap`, `default`. MUST NOT contain `sourcePath`, `targetPath`, or nested `reverse`. |
| **Diagnostic Object** | S7.2 | `ruleIndex` (integer, -1 if not rule-specific), `sourcePath`, `targetPath`, `errorCode`, `message`. |
| **JSON Adapter Config** | S6.2 | `pretty` (boolean), `sortKeys` (boolean), `nullHandling` ("include"/"omit"). |
| **XML Adapter Config** | S6.3 | `declaration` (boolean), `indent` (integer), `cdata` (string[]). |
| **CSV Adapter Config** | S6.4 | `delimiter`, `quote`, `header` (boolean), `encoding`, `lineEnding` ("crlf"/"lf"). |

## Transform Operations Quick Reference

| Transform | Purpose | Auto-Reversible? | Inverse | Key Parameters | Notes |
|-----------|---------|:-:|---------|----------------|-------|
| `preserve` | Identity copy, value passes through unmodified | Yes | `preserve` | -- | Incompatible types: implicit coercion with warning |
| `drop` | Discard field from output | No | -- | -- | `bidirectional: true` MUST error; `targetPath` can be null |
| `expression` | Evaluate arbitrary FEL expression | No | -- | `expression` (REQUIRED) | `$` = source value, `@source` = full doc; needs explicit `reverse.expression` for bidirectional |
| `coerce` | Type conversion between data types | Conditional | `coerce` (inverse pair) | `coerce.from`, `coerce.to`, `coerce.format` | Lossless pairs auto-reverse; lossy (datetime->date, money->number) require explicit reverse |
| `valueMap` | Static lookup table substitution | Conditional | `valueMap` (inverted) | `valueMap.forward`, `valueMap.unmapped` | Bijective maps auto-reverse; non-injective require explicit reverse |
| `flatten` | Collapse nested/array to flat | Yes | `nest` | `separator` (for delimited mode) | 3 modes: delimited, positional, dot-prefix; mode inferred from source shape |
| `nest` | Expand flat to nested structure | Yes | `flatten` | `separator` (for string split) | Inverse of flatten; mode inferred from source shape |
| `constant` | Inject fixed value regardless of source | No | -- | `expression` (REQUIRED) | `sourcePath` ignored; `bidirectional: true` MUST error |
| `concat` | Combine multiple source fields into one string | No | -- | `expression` (REQUIRED) | References `@source`; boundary info lost; needs explicit reverse |
| `split` | Decompose single source into multiple targets | No | -- | `expression` (REQUIRED) | Must return object or array; join order ambiguous |

## Coercion Conversion Matrix

| From / To | `string` | `number` | `integer` | `boolean` | `date` | `datetime` | `money` |
|-----------|:--------:|:--------:|:---------:|:---------:|:------:|:----------:|:-------:|
| **`string`** | -- | Y | Y | Y | Y | Y | N |
| **`number`** | Y | -- | Y | Y | N | N | N |
| **`integer`** | Y | Y | -- | Y | N | N | N |
| **`boolean`** | Y | Y | Y | -- | N | N | N |
| **`date`** | Y | N | N | N | -- | Y | N |
| **`datetime`** | Y | N | N | N | Y* | -- | N |
| **`money`** | Y | Y* | Y* | N | N | N | -- |

Y = supported, N = MUST reject, -- = identity (no-op), Y* = lossy (datetime->date discards time; money->number/integer discards currency)

## Critical Behavioral Rules

These are the non-obvious rules that are easy to miss and commonly trip up implementers:

1. **Execution pipeline order is strict (S7.1).** The 7 steps MUST execute in order: Validate -> Resolve direction -> Apply defaults -> Generate auto-map -> Sort rules -> Execute rules -> Serialize. Defaults are applied BEFORE rules, and auto-map rules are generated BEFORE sorting.

2. **Priority sort means higher-priority rules execute FIRST, and thus get OVERWRITTEN (S3.4).** Because of last-write-wins, a rule with `priority: 10` will be overwritten by a later rule with `priority: 0` targeting the same path. This is counterintuitive. To make high-priority rules "win," use conditions on lower-priority rules, not priority alone.

3. **Auto-map synthetic rules have priority -1 (S3.5.1).** They always execute after all explicit rules (even priority 0), so explicit rules always overwrite auto-mapped values. Explicit `drop` rules suppress auto-map for matching sourcePaths.

4. **`bidirectional` defaults to `true` (S3.3), except for `drop` which defaults to `false` (S4.3).** This means most rules are assumed bidirectional unless explicitly opted out. Lossy transforms without `bidirectional: false` or an explicit `reverse` block MUST produce a validation error.

5. **Reverse execution through `bidirectional: false` MUST error, not silently skip (S5.4).** The processor must actively reject reverse mapping attempts through non-reversible rules rather than ignoring them.

6. **`sourcePath` and `targetPath` swap automatically in reverse (S5.3).** The `reverse` block MUST NOT re-specify them. If either appears inside `reverse`, the processor MUST report a validation error.

7. **Condition is evaluated BEFORE any transform (S4.13).** A skipped rule (condition = false/null) MUST NOT produce an error even if its expression or sourcePath would be invalid for the given input.

8. **Absent vs explicit null are distinct (S7.3).** Absent + default -> write default. Absent + no default -> omit target (for preserve/coerce/valueMap) or evaluate with `$` = null (for expression). Explicit null -> write null (for preserve) or look up null key in valueMap.

9. **Lossless coercion pairs are specifically enumerated (S5.2).** Only string<->integer, string<->number, string<->boolean, and date<->string (with ISO 8601 format) are auto-reversible. All other coercion pairs (number->integer, money->number, datetime->date) are lossy and MUST NOT auto-reverse.

10. **ValueMap auto-reverse requires bijective forward map (S4.6).** If forward has duplicate values (non-injective), auto-reversal is impossible. A `reverse.valueMap.forward` block MUST be provided explicitly, or the processor MUST error.

11. **CSV target paths MUST be flat identifiers (S6.4, S3.2.1).** No dots, no brackets. A nested targetPath with CSV format MUST produce a validation error. Auto-map silently skips dotted paths for CSV.

12. **Adapter errors MUST halt; partial output MUST NOT be emitted (S7.2).** Unlike transform errors (which are non-fatal and allow continued processing), adapter failures are fatal and require a complete halt.

13. **Unmapped valueMap strategy applies in BOTH directions (S4.6).** Unless the reverse block specifies its own `unmapped` override, the forward strategy is used for reverse too.

14. **Forward mapping MUST be idempotent (S7.4).** No random IDs, timestamps, or non-deterministic hash-map iteration unless the Mapping Document explicitly invokes non-deterministic FEL functions.

15. **Uncovered fields are left untouched by both forward and reverse execution (S5.5).** The engine MUST NOT modify fields that no Field Rule covers. During reverse injection into a new Response, status is set to `"in-progress"` (S2.4.2).

16. **`flatten` and `nest` are structural inverses (S4.7, S4.8).** Flatten auto-reverses to nest and vice versa. Mode is inferred from source shape (array+separator=delimited, array=positional, object=dot-prefix), not explicitly declared.

17. **In `array.mode: "indexed"`, uncovered elements are DROPPED (S4.12.4).** Only elements with matching index in innerRules are mapped; the rest are discarded.

18. **Multiple rules targeting same targetPath with conditions: last-rule-wins when multiple are true (S4.13.1).** Processor SHOULD warn (but MUST NOT error) if conditions are not provably exclusive.

19. **Unrecognized root properties MUST be rejected unless `x-` prefixed (S3).** This applies to the Mapping Document root level. Custom adapter identifiers also MUST begin with `x-` (S6.5).

20. **ValueMap legacy shorthand vs structured shape have different `unmapped` defaults (S3.3.3).** Flat shorthand (no nested `forward` property) defaults to `"passthrough"`; structured shape (explicit `forward` object) defaults to `"error"`.
