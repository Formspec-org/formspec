# Formspec Mapping DSL (LLM Reference)

A companion specification defining a declarative, JSON-native language for **bidirectional data transformations** between Formspec Responses and external system schemas (API payloads, database records, CSV exports, XML documents). Reuses FEL for all computed transforms. Generalizes the core spec §6.7 version-migration `fieldMap`.

## Key Concepts

- **Mapping Document**: Standalone JSON document declaring field-level correspondences and transforms between a Formspec Response and an external schema. Versioned independently from the Definition.
- **Forward mapping**: Response → External. **Reverse mapping**: External → Response.
- **Field Rule**: Atomic unit binding a source path to a target path with transforms.
- **Adapter**: Pluggable serializer/deserializer (JSON, XML, CSV) handling format-specific concerns.
- **Mapping Engine**: Runtime that reads Mapping Document + source data → produces target data. Sub-components: Mapping Document, FEL Evaluator, Adapter.

## Conformance Levels

| Level | Requirements |
|-------|-------------|
| **Mapping Core** | Forward mapping (Response → JSON), all transform types, full FEL. NOT required to support reverse/XML/CSV. |
| **Mapping Bidirectional** | Core + reverse mapping, round-trip fidelity, lossy transform detection. |
| **Mapping Extended** | Bidirectional + XML adapter (namespaces, attributes) + CSV adapter (RFC 4180, configurable delimiters). |

## Document Structure

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | RECOMMENDED | Spec version URI |
| `version` | string | REQUIRED | SemVer of this Mapping Document |
| `definitionRef` | string | REQUIRED | URI of target Formspec Definition |
| `definitionVersion` | string | REQUIRED | Semver range of compatible Definition versions |
| `targetSchema` | object | REQUIRED | External schema descriptor: `format` ("json"/"xml"/"csv"), `name`, `url`, `rootElement` (XML), `namespaces` (XML) |
| `direction` | string | OPTIONAL | "forward" (default), "reverse", or "both" |
| `defaults` | object | OPTIONAL | Default values written to target before rules execute |
| `autoMap` | boolean | OPTIONAL | When true, unmapped fields auto-preserve (priority -1) |
| `rules` | array | REQUIRED | Ordered array of Field Rule objects (≥1) |
| `adapters` | object | OPTIONAL | Adapter-specific config keyed by adapter ID |

## Field Rule Structure

| Property | Type | Description |
|----------|------|-------------|
| `sourcePath` | string | Dot-path in source document. REQUIRED except for `constant`/`drop`. |
| `targetPath` | string | Dot-path in target document. REQUIRED except for `drop`. |
| `transform` | string | REQUIRED. Transform type (see below). |
| `expression` | string (FEL) | Required for `expression`, `constant`, `concat`, `split`. `$` = source value, `@source` = full document. |
| `coerce` | object | Required for `coerce`. Has `from`, `to`, optional `format`. |
| `valueMap` | object | Required for `valueMap`. Has `forward` (lookup table), optional `reverse`, `unmapped` strategy, `default`. |
| `reverse` | object | Explicit reverse-direction override. May contain `transform`, `expression`, `coerce`, `valueMap`, `default`. Cannot re-specify paths. |
| `bidirectional` | boolean | Default true. If false, skipped during reverse execution. |
| `condition` | string (FEL) | Boolean guard — rule skipped if false/null. Evaluated before transform. |
| `default` | any | Fallback when source is absent/null. |
| `array` | object | Array handling: `mode` ("each"/"whole"/"indexed"), `separator`, `innerRules`. |
| `priority` | integer | Execution priority (higher first, default 0). |
| `description` | string | Human-readable, ignored during execution. |

## Transform Types

| Type | Description | Auto-Reversible |
|------|-------------|:-:|
| `preserve` | Identity copy | Yes |
| `drop` | Discard field from output | No |
| `expression` | Evaluate FEL expression | No (needs explicit `reverse`) |
| `coerce` | Type conversion (`from`/`to`) | Only for lossless pairs |
| `valueMap` | Lookup table substitution | Only if bijective |
| `flatten` | Collapse nested/array to flat | Yes (pairs with `nest`) |
| `nest` | Expand flat to nested | Yes (pairs with `flatten`) |
| `constant` | Fixed value injection (no source needed) | No |
| `concat` | Join multiple sources into one string | No |
| `split` | Decompose one source into multiple targets | No |

### Coercion Matrix (supported conversions)

Supported: string ↔ number/integer/boolean/date/datetime, number ↔ integer/boolean, date ↔ datetime (lossy: time discarded), money → number/integer (lossy: currency discarded).

**Lossless auto-reversible pairs**: string ↔ integer, string ↔ number, string ↔ boolean ("true"/"false"), date ↔ string (ISO 8601).

### ValueMap

`forward`: key-value lookup table. `reverse`: explicit or auto-inferred (only if bijective). `unmapped` strategy: "error" (default), "passthrough", "drop", "default".

### Array Operations

| Mode | Behavior |
|------|----------|
| `each` | Apply transform per element. `$` = current element, `$index` = index. `innerRules` with element-relative paths. |
| `whole` | Treat entire array as single value. For aggregates (sum, filter, join). |
| `indexed` | Apply `innerRules` by positional `index`. Uncovered elements dropped. |

### Flatten/Nest Modes

- **Delimited**: Array of scalars ↔ delimited string (via `separator`)
- **Positional**: Array ↔ indexed fields (`<path>_0`, `_1`, ...)
- **Dot-prefix**: Nested object ↔ flat dot-delimited keys

## Execution Pipeline

1. **Validate** — Parse JSON, verify schema, check definitionVersion compatibility
2. **Resolve direction** — Filter rules by active direction
3. **Apply defaults** — Write `defaults` to target (overwritten by later rules)
4. **Generate auto-map rules** — If `autoMap: true`, synthesize preserve rules for uncovered fields (priority -1)
5. **Sort rules** — Descending priority, stable order
6. **Execute rules** — For each: evaluate condition → resolve sourcePath → apply transform → write to targetPath
7. **Serialize** — Pass target to Adapter

**Rule ordering**: Higher priority executes first. Same priority: document order. Last-write-wins for same targetPath.

## Bidirectional Semantics

- Paths swap automatically during reverse execution
- Auto-reversible transforms derive their inverse without explicit `reverse` block
- Lossy transforms (drop, non-reversible expression, lossy coerce, many-to-one valueMap, concat, split) MUST set `bidirectional: false` or provide explicit `reverse`
- **Round-trip fidelity**: For all bidirectional rules, forward then reverse must reproduce original values on covered paths

### Reverse Conflict Resolution

When multiple external fields → same Response path: last-rule-wins by default. `reversePriority` (integer) overrides document order.

## Format Adapters

**JSON** (Core): Identity serialization. Config: `pretty`, `sortKeys`, `nullHandling` ("include"/"omit").

**XML** (Extended): Elements via dot-path, attributes via `@` prefix, namespace prefix via colon. Requires `targetSchema.rootElement`. Config: `declaration`, `indent`, `cdata` (paths wrapped in CDATA).

**CSV** (Extended): Flat target paths only (no dots). Repeat groups emit one row per instance, non-repeat fields duplicated. Config: `delimiter`, `quote`, `header`, `encoding`, `lineEnding`.

**Custom**: `x-` prefixed identifiers, must implement serialize/deserialize. Unknown adapter → error (no silent fallback).

## Error Handling

| Category | Examples | Behavior |
|----------|----------|----------|
| Validation | Malformed JSON, missing properties, invalid FEL | Halt before execution |
| Resolution | sourcePath not found | Use `default` if present, else non-fatal diagnostic |
| Transform | Coercion failure, unmapped value, FEL runtime error | Non-fatal diagnostic, continue |
| Adapter | Nested path in CSV, encoding error | Halt, no partial output |

Standard error codes: `INVALID_DOCUMENT`, `VERSION_MISMATCH`, `INVALID_FEL`, `PATH_NOT_FOUND`, `COERCE_FAILURE`, `UNMAPPED_VALUE`, `FEL_RUNTIME`, `ADAPTER_FAILURE`.

## Null/Absent Handling

- **Absent + default**: Write default (skip expression)
- **Absent, no default**: Omit target (or evaluate expression with `$` = null)
- **Explicit null**: Preserve null (or look up null key in valueMap)

## Relationship to §6.7 Migrations

Every §6.7 `fieldMap` entry is a degenerate Mapping Document where both source and target are Formspec Responses. Conversion: `source` → `sourcePath`, `target` → `targetPath` (null = drop), `transform` types identical, `defaults` → top-level `defaults`, pass-through → `autoMap: true`.

## Design Principles

1. Declarative over imperative (no loops, assignments, control flow)
2. FEL for all computation (reuse existing evaluator)
3. Composition over complexity (many simple rules > monolithic expressions)
4. Explicit over implicit (no silent auto-mapping by default)
5. Bidirectional by default with explicit opt-out for lossy transforms
6. Independent of transport and storage
