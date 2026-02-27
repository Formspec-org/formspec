---
title: Formspec Core Specification
version: 1.0.0-draft.1
date: 2025-07-10
---

# FORMSPEC v1.0 — A JSON-Native Declarative Form Standard

**Version:** 1.0.0-draft.1  
**Date:** 2025-07-10  
**Editors:** Formspec Working Group  

***

## Abstract

Formspec is a format-agnostic, JSON-native standard for declarative form
definition and validation. It specifies how to describe form fields, computed
values, validation rules, conditional logic, repeatable sections, versioning,
and structured validation results — independent of any rendering technology,
programming language, or data transport mechanism. A Formspec definition is a
self-contained JSON document that completely describes the structure, behavior,
and constraints of a data-collection instrument without prescribing how that
instrument is presented to a user. The standard draws on two decades of
prior art — W3C XForms for its model/view/instance separation and reactive
processing model, W3C SHACL for its composable validation shapes and structured
result vocabulary, and HL7 FHIR R5 Questionnaire for its pragmatic approach to
form hierarchy and response capture — and synthesizes these ideas into a
coherent, JSON-first specification suitable for web, mobile, server-side, and
offline implementations.

## Status of This Document

This document is a **draft specification**. It has not been submitted to any
standards body. The interfaces described herein are subject to change without
notice. Implementors are encouraged to experiment with this specification and
provide feedback, but MUST NOT treat it as stable for production use until a
1.0.0 release is published.

## Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in [BCP 14][rfc2119] [RFC 2119]
[RFC 8174] when, and only when, they appear in ALL CAPITALS, as shown here.

JSON syntax and data types are as defined in [RFC 8259]. JSON Pointer syntax is
as defined in [RFC 6901]. URI syntax is as defined in [RFC 3986].

The following terms are used throughout this specification:

- **Conformant processor** — Any software that reads, writes, evaluates, or
  validates Formspec documents in accordance with this specification.
- **Definition document** — A JSON document conforming to the Formspec
  Definition schema.
- **Normative** — Text that forms part of the specification's requirements.
- **Informative** — Text provided for explanation only; it does not impose
  requirements.

[rfc2119]: https://www.rfc-editor.org/rfc/rfc2119

***

## 1. Introduction

### 1.1 Motivation

In 2003, the W3C published XForms 1.0, a declarative form standard that cleanly
separated data model, validation logic, and presentation. XForms introduced
concepts that remain unsurpassed in rigor: a reactive dependency graph for
computed values, model-level validation independent of UI, the
rebuild/recalculate/revalidate/refresh processing model, and the ability to
define a form’s complete behavior in markup rather than imperative code.

XForms solved the right problems. But it solved them in XML, for XML, using
XPath, within XHTML — a technology stack that the mainstream web ecosystem has
largely moved away from. Today, JSON is the dominant data interchange format for
web APIs, mobile applications, and cloud services. The form libraries that serve
this ecosystem — JSON Schema-based generators, React form builders, low-code
platform engines — each reinvent fragments of what XForms provided, but none
offer a coherent, transport-independent, renderer-agnostic standard.

The result is a fragmented landscape:

- **JSON Schema** describes data shape but not computed fields, conditional
  visibility, or repeatable-section semantics.
- **React Hook Form, Formik, and similar libraries** bind validation to a
  specific JavaScript framework and runtime.
- **Low-code platform schemas** (Typeform, JotForm, Google Forms) are
  proprietary and tightly coupled to their rendering engines.
- **FHIR Questionnaire** provides a health-care-domain form model but lacks a
  general-purpose expression language and composable validation.
- **ODK XForms** extends XForms for mobile data collection but remains
  XML/XPath-dependent.

No existing specification provides "XForms for JSON" — a single, open,
JSON-native standard that covers form structure, reactive behavior, composable
validation, and structured results, while remaining independent of rendering
technology and programming language.

Formspec fills this gap.

### 1.2 Design Principles

The following principles guided every design decision in this specification.
They are listed in priority order; when principles conflict, higher-numbered
principles yield to lower-numbered ones.

| ID | Principle | Rationale |
|----|-----------|----------|
| **AD-01** | **Schema is data, not code.** A Formspec definition is a JSON document. It can be stored, versioned, diffed, transmitted, and validated using standard JSON tooling. No Turing-complete language is required to interpret the structure. | Enables tooling, auditing, and cross-platform portability. |
| **AD-02** | **Separate structure from behavior from presentation.** What data is collected (Items), how it behaves (Binds, Shapes), and how it is displayed (renderer) are three independent concerns. This specification defines structure and behavior normatively. It provides OPTIONAL, advisory presentation hints (§4.2.5) that guide renderers without constraining them. Rendering engines, layout toolkits, and visual style remain out of scope. | Allows one Definition to carry rendering guidance while still driving web, mobile, PDF, voice, and API interfaces without modification. |
| **AD-03** | **JSON-native, not JSON-ported.** Formspec is not an XML specification transliterated into JSON. Data types, paths, expressions, and idioms are designed for JSON’s type system and structure from the ground up. | Avoids impedance mismatch (e.g., XML attributes vs. elements, mixed content, namespace prefixes). |
| **AD-04** | **Evaluable in any language.** The Formspec Expression Language (FEL) is a small, deterministic language with no host-language dependency. A conformant processor MAY be implemented in JavaScript, Python, Java, C#, Rust, Go, Swift, or any other general-purpose language. | Prevents vendor lock-in and enables server-side, client-side, and offline evaluation. |
| **AD-05** | **Layered complexity.** A form with five text fields and no conditional logic requires no expressions, no binds, and no validation shapes. A form with cross-field validation, computed totals, and conditional repeatable sections has access to the full power of the specification. Complexity is opt-in, never mandatory. | Lowers the barrier to entry; simple forms remain simple. |
| **AD-06** | **Extensible without forking.** Domain-specific field types, custom FEL functions, and additional validation rules are accommodated through defined extension points. Extensions MUST NOT alter the semantics of the core specification. | Enables healthcare, finance, government, and survey domains to extend the standard without fragmentation. |
| **AD-07** | **Validation is structured, not boolean.** Validation produces a machine-readable result document with per-field findings at specified severities — not merely a pass/fail flag. | Supports progressive disclosure of errors, multi-level review workflows, and accessibility. |

### 1.3 Scope

This specification defines:

- The JSON schema for Definition documents (form definitions).
- The JSON schema for Response documents (form responses).
- The Formspec Expression Language (FEL) grammar, type system, and built-in
  function library.
- The processing model (rebuild, recalculate, revalidate, notify).
- The validation result structure.
- Extension point contracts.

This specification does **not** define:

- Rendering, layout, widget selection, or visual style.
- Transport protocols (HTTP, WebSocket, message queue).
- Authentication or authorization.
- Storage or persistence mechanisms.
- A canonical serialization for non-JSON formats (YAML, CBOR, MessagePack),
  although such serializations MAY be defined in companion specifications.

### 1.4 Conformance

Formspec defines two conformance tiers.

#### 1.4.1 Formspec Core

A conformant **Core** processor MUST:

1. Parse and validate any FormDefinition document that conforms to the
   Formspec JSON schema without error.
2. Support all core data types (§4.2.3), including `money`.
3. Implement all five Bind MIPs: `calculate`, `relevant`, `required`,
   `readonly`, `constraint`.
4. Implement the full FEL expression language (§3), including all built-in
   functions.
5. Implement validation shapes with severity levels and ValidationReport
   generation (§5).
6. Implement the four-phase processing model (§2.4).
7. Implement canonical identity, versioning, and response pinning (§6).
8. Support named option sets (§4.6).
9. Reject Definition documents containing circular dependencies with a
   diagnostic message identifying at least one cycle.

A Core processor MAY support a subset of FEL built-in functions, provided
it signals an unsupported-function error when encountering a function it does
not implement, rather than silently ignoring the call.

#### 1.4.2 Formspec Extended

A conformant **Extended** processor MUST support Formspec Core plus:

1. Extension properties (§8).
2. Screener routing (§4.7).
4. Modular composition and assembly (§6.6).
5. Version migration maps (§6.7).
6. Pre-population declarations (§4.2.3, `prePopulate`).

A processor claiming Extended conformance implicitly claims Core conformance.

#### 1.4.3 Conformance Prohibitions

A conformant Formspec processor (Core or Extended) MUST NOT:

1. **Silently substitute definition versions.** When validating a Response
   pinned to version X, the processor MUST use version X. If version X is
   unavailable, the processor MUST report an error.
2. **Produce validation results for non-relevant fields.** Non-relevant
   fields are exempt from all validation (§5.6 rule 1).
3. **Block data persistence based on validation state.** Validation and
   persistence are independent operations (§5.5).

***

## 2. Conceptual Model

### 2.1 Core Abstractions

Formspec is organized around six core abstractions. Each abstraction has a
precise role; understanding these roles is a prerequisite for reading the rest
of this specification.

#### 2.1.1 Definition

A **Definition** is the complete, versioned specification of a form. It is a
JSON document that contains:

- **Identity** — a canonical URL and a semantic version string that together
  form a globally unique, immutable reference.
- **Items** — the structural tree of fields, groups, and display nodes (§2.1.3).
- **Binds** — behavioral declarations that attach reactive expressions to data
  nodes (§2.1.4).
- **Data Sources** — declarations of secondary instances and external lookup
  tables (§2.1.2).
- **Validation Shapes** — composable constraint rule sets (§2.1.5).
- **Metadata** — human-readable title, description, authoring timestamps,
  and status.

A Definition is analogous to an XForms `<model>` combined with an XForms
`<body>` structure declaration, or to a FHIR R5 `Questionnaire` resource.

A Definition MUST include a `url` (canonical URL) and a `version` (semantic
version). The tuple `(url, version)` uniquely identifies a Definition across
all systems. A conformant processor MUST treat two Definitions with the same
`(url, version)` as identical.

> **Example.** A minimal Definition:
>
> ```json
> {
>   "formspec": "1.0",
>   "url": "https://example.org/forms/intake",
>   "version": "2.1.0",
>   "title": "Patient Intake Form",
>   "status": "active",
>   "items": [
>     { "key": "firstName", "type": "field", "dataType": "string" },
>     { "key": "lastName",  "type": "field", "dataType": "string" }
>   ]
> }
> ```

#### 2.1.2 Instance

An **Instance** is a JSON object whose structure mirrors the Definition’s item
tree. It contains the current values for all fields. An Instance is the
data substrate on which Binds operate, Shapes validate, and Responses persist.

Formspec supports **multiple named instances**:

| Instance kind | Name | Description |
|---|---|---|
| **Primary instance** | `"$primary"` (implicit) | The form data being collected. This is the default target for all field references that do not specify an instance name. |
| **Secondary instance** | Any user-defined string | Reference data supplied at form-load time: lookup tables, prior-year data, configuration values, code lists. Secondary instances are read-only during form completion. |

A conformant processor MUST maintain the primary instance. It SHOULD support at
least one secondary instance. It MAY support an arbitrary number.

An Instance mirrors the Item tree according to these rules:

- A `field` Item with key `k` corresponds to a JSON property `k` whose value
  is of the field’s declared `dataType` (or `null` if absent).
- A `group` Item with key `k` that is not repeatable corresponds to a JSON
  object under property `k`.
- A `group` Item with key `k` that is repeatable (`repeat: true`) corresponds
  to a JSON array under property `k`, where each element is a JSON object.
- A `display` Item has no representation in the Instance.

> **Example.** Given this Item tree:
>
> ```json
> [
>   { "key": "name", "type": "field", "dataType": "string" },
>   { "key": "addresses", "type": "group", "repeatable": true, "children": [
>       { "key": "street", "type": "field", "dataType": "string" },
>       { "key": "city",   "type": "field", "dataType": "string" }
>   ]}
> ]
> ```
>
> A valid Instance would be:
>
> ```json
> {
>   "name": "Ada Lovelace",
>   "addresses": [
>     { "street": "123 Analytical Engine Ln", "city": "London" },
>     { "street": "456 Difference Row",       "city": "Bath" }
>   ]
> }
> ```

#### 2.1.3 Item

An **Item** is a node in the Definition’s structural tree. Every Item MUST have
a `key` property — a stable, machine-readable identifier that is unique among
its siblings. The `key` is used in Instance paths, Bind targets, Shape targets,
and FEL field references. A `key` MUST match the regular expression
`^[a-zA-Z_][a-zA-Z0-9_]*$`.

An Item MUST have a `type` property with one of three values:

| Type | Description | Has value? | Has children? |
|------|-------------|-----------|---------------|
| `"field"` | Captures a single data value from the user or from a calculation. The `dataType` property declares the value’s type. | Yes | No |
| `"group"` | A structural container. Groups organize related fields and may be **repeatable** (`"repeatable": true`), meaning the user can add zero or more instances of the group’s child structure. | No (contains children) | Yes |
| `"display"` | Read-only presentational content: instructions, headings, separators, help text. Display items carry no data and appear in neither the Instance nor the Response data. | No | No |

Field items MUST declare a `dataType` from the following set:

| `dataType` | JSON representation | FEL type | Notes |
|------------|-------------------|----------|-------|
| `"string"` | JSON string | `string` | |
| `"number"` | JSON number | `number` | IEEE 754 double. |
| `"integer"` | JSON number (no fraction) | `number` | Processors MUST reject fractional values. |
| `"boolean"` | JSON `true` / `false` | `boolean` | |
| `"date"` | JSON string, ISO 8601 date (`YYYY-MM-DD`) | `date` | |
| `"dateTime"` | JSON string, ISO 8601 date-time | `date` | |
| `"time"` | JSON string, ISO 8601 time (`HH:MM:SS`) | `string` | Supports time extraction and construction via `hours()`, `minutes()`, `seconds()`, and `time()` functions (§3.5). |
| `"choice"` | JSON string (selected option key) | `string` | Valid values constrained by an `options` array or data source reference. |
| `"multiChoice"` | JSON array of strings | `array` | |
| `"attachment"` | JSON object `{ "url": "...", "contentType": "...", "size": ... }` | N/A | Binary content is out-of-band; the Instance stores a reference. |

Additional `dataType` values MAY be defined via extensions (§7).

> **Example.** A group with mixed item types:
>
> ```json
> {
>   "key": "demographics",
>   "type": "group",
>   "label": "Demographics",
>   "children": [
>     { "key": "heading", "type": "display", "label": "Demographics" },
>     { "key": "dob",     "type": "field",   "dataType": "date",
>       "label": "Date of Birth" },
>     { "key": "sex",     "type": "field",   "dataType": "choice",
>       "label": "Sex at Birth",
>       "options": [
>         { "value": "M", "label": "Male" },
>         { "value": "F", "label": "Female" },
>         { "value": "O", "label": "Other" }
>       ]
>     }
>   ]
> }
> ```

#### 2.1.4 Bind

A **Bind** is a behavioral declaration attached to one or more data nodes by
path. Binds are the bridge between the structural layer (Items) and the
behavioral layer (reactive expressions). A Bind is not a visual concept; it
exists purely in the data/logic domain.

Each Bind MUST specify a `target` — a path expression (using dot-separated
`key` notation) that identifies the data node(s) to which the Bind applies. A
Bind MAY specify one or more of the following properties, each containing a
FEL expression:

| Property | FEL return type | Semantics |
|----------|---------------|----------|
| `calculate` | Same as target field’s `dataType` | The field’s value is computed from this expression. A field with a `calculate` Bind is implicitly `readonly`. The processor MUST evaluate this expression and write the result to the Instance whenever a dependency changes. |
| `relevant` | `boolean` | If the expression evaluates to `false`, the target node (and all its descendants, if a group) is **not relevant**: it is hidden from the user, excluded from validation, and its value in the Instance is preserved but marked as non-relevant. A non-relevant field’s value MUST NOT appear in validation results. |
| `required` | `boolean` | If `true`, the target field MUST have a non-null, non-empty-string value for the Instance to be valid. This is evaluated dynamically — a field may be required only when other conditions hold. |
| `readonly` | `boolean` | If `true`, the field’s value MUST NOT be modified by user input. It MAY still be modified by a `calculate` expression. |
| `constraint` | `boolean` | A per-field validation expression. If it evaluates to `false`, the field is invalid. The Bind SHOULD include a `constraintMessage` string for human-readable feedback. |
| `default` | Same as target field’s `dataType` | The initial value assigned to the field when the Instance is first created or when a new repeat instance is added. Evaluated once at initialization, not reactively. |

Binds are evaluated **reactively**. When a value in the Instance changes, the
processor MUST re-evaluate all Binds whose expressions reference the changed
value, directly or transitively, following the processing model (§2.4).

> **Example.** Binds for a tax form:
>
> ```json
> {
>   "binds": [
>     {
>       "target": "totalIncome",
>       "calculate": "$wages + $interest + $dividends"
>     },
>     {
>       "target": "spouseInfo",
>       "relevant": "$filingStatus = 'married'"
>     },
>     {
>       "target": "ssn",
>       "required": "true",
>       "constraint": "matches($ssn, '^[0-9]{3}-[0-9]{2}-[0-9]{4}$')",
>       "constraintMessage": "SSN must be in the format 000-00-0000."
>     },
>     {
>       "target": "filingDate",
>       "default": "today()"
>     }
>   ]
> }
> ```

#### 2.1.5 Validation Shape

A **Validation Shape** is a named, composable validation rule set. The concept
is borrowed from W3C SHACL (Shapes Constraint Language) and adapted for
Formspec’s JSON-native context.

Each Shape MUST have:

- A `name` — a unique identifier within the Definition.
- A `target` — one or more data paths to which the Shape applies.
- One or more **constraints**, each with:
  - An `expression` (FEL, returning `boolean`) — the condition that MUST hold.
  - A `severity` — one of `"error"`, `"warning"`, or `"info"`.
  - A `message` — a human-readable description of the violation.
  - An optional `code` — a machine-readable identifier for the violation.

Shapes MAY compose with other Shapes using the following logical operators:

| Operator | Semantics |
|----------|----------|
| `and` | All referenced Shapes MUST pass for this Shape to pass. |
| `or` | At least one referenced Shape MUST pass. |
| `not` | The referenced Shape MUST fail for this Shape to pass. |
| `xone` | Exactly one of the referenced Shapes MUST pass. |

Shapes produce **ValidationResult** entries. A ValidationResult is a structured
JSON object, not a boolean flag. Each result entry includes the Shape name,
target path, severity, message, code, and the evaluated expression. This
structured output supports accessibility tooling, multi-level review workflows,
and machine-to-machine validation pipelines.

> **Example.** A composable validation shape:
>
> ```json
> {
>   "shapes": [
>     {
>       "id": "dateRangeValid",
>       "target": "endDate",
>       "severity": "error",
>       "constraint": "$endDate >= $startDate",
>       "message": "End date must not precede start date.",
>       "code": "DATE_RANGE_001"
>     },
>     {
>       "id": "dateRangeReasonable",
>       "target": "endDate",
>       "severity": "warning",
>       "constraint": "dateDiff($endDate, $startDate, 'days') <= 365",
>       "message": "Date range exceeds one year. Please verify.",
>       "code": "DATE_RANGE_002"
>     },
>     {
>       "id": "dateRangeComplete",
>       "target": "endDate",
>       "message": "Date range validation failed.",
>       "and": ["dateRangeValid", "dateRangeReasonable"]
>     }
>   ]
> }
> ```

#### 2.1.6 Response

A **Response** is a completed or in-progress Instance pinned to a specific
Definition version. It is the unit of data capture — the filled-in form.

The canonical structural contract for Response properties is generated from
`schemas/response.schema.json`:

<!-- schema-ref:start id=core-response-top-level schema=schemas/response.schema.json pointers=# -->
<!-- generated:schema-ref id=core-response-top-level -->
| Pointer | Field | Type | Required | Notes | Description |
|---|---|---|---|---|---|
| `#/properties/author` | `author` | <code>object</code> | no | — | Identifier and display name of the person or system that authored the Response. |
| `#/properties/authored` | `authored` | <code>string</code> | yes | critical | When the Response was last modified (ISO 8601 date-time). |
| `#/properties/data` | `data` | <code>object</code> | yes | critical | The primary Instance — the form data. |
| `#/properties/definitionUrl` | `definitionUrl` | <code>string</code> | yes | critical | The canonical URL of the Definition. |
| `#/properties/definitionVersion` | `definitionVersion` | <code>string</code> | yes | critical | The exact version of the Definition against which this Response was created. |
| `#/properties/extensions` | `extensions` | <code>object</code> | no | — | — |
| `#/properties/id` | `id` | <code>string</code> | no | — | A globally unique identifier (e.g., UUID). |
| `#/properties/status` | `status` | <code>string</code> | yes | enum: <code>"in-progress"</code>, <code>"completed"</code>, <code>"amended"</code>, <code>"stopped"</code>; critical | The current status of this Response. |
| `#/properties/subject` | `subject` | <code>object</code> | no | — | The entity this Response is about. |
| `#/properties/validationResults` | `validationResults` | <code>array</code> | no | — | The most recent set of ValidationResult entries (§2.5.1). |
<!-- schema-ref:end -->

The generated table above defines required and optional properties. In this
spec section, prose requirements describe semantics that the schema alone
cannot express.

A Response references exactly one Definition by the tuple
`(definitionUrl, definitionVersion)`. A conformant processor MUST reject a
Response whose `definitionVersion` does not match any known Definition at the
given `definitionUrl`.

> **Example.** A completed Response:
>
> ```json
> {
>   "definitionUrl": "https://example.org/forms/intake",
>   "definitionVersion": "2.1.0",
>   "status": "completed",
>   "authored": "2025-07-10T14:30:00Z",
>   "author": { "id": "user-42", "name": "Dr. Grace Hopper" },
>   "data": {
>     "firstName": "Ada",
>     "lastName": "Lovelace"
>   }
> }
> ```

#### 2.1.7 Data Source

A **Data Source** is a declaration within a Definition that makes external or
supplemental data available to FEL expressions at runtime. Data Sources are the
mechanism by which secondary instances (§2.1.2) are populated.

Each Data Source MUST have a `name` (string, unique identifier within the
Definition, used in `@instance('name')` references, MUST match
`^[a-zA-Z_][a-zA-Z0-9_]*$`).

Each Data Source MUST also declare its content via one of the following
mechanisms:

| Mechanism | Property | Description |
|-----------|----------|-------------|
| **Inline** | `data` (JSON object or array) | The data is embedded directly in the Definition document. Suitable for small, static lookup tables (e.g., country codes, status enums). |
| **URL** | `source` (string, URI) | The data is fetched from an external endpoint at form-load time. The response MUST be a JSON document. The processor MUST fetch the data before the first Rebuild phase. If the fetch fails, the processor MUST signal a load error. |
| **Host function** | `source` (string, `formspec-fn:` URI) | The data is supplied by the host environment via a named callback. The URI scheme `formspec-fn:` identifies a host-registered function (e.g., `"formspec-fn:lookupPatient"`). The host maps the function name to a callback. This allows integration with application-specific data layers without embedding external URLs in the Definition. |

A Data Source MAY include a `schema` property describing the expected shape of
the data (field names and types). This schema is informative — it aids tooling
and documentation — but a conformant processor is NOT REQUIRED to validate
Data Source contents against it.

Secondary instances populated by Data Sources are **read-only** during form
completion. A `calculate` Bind MUST NOT target a path within a secondary
instance. A conformant processor MUST signal a definition error if such a Bind
is encountered.

> **Example.** Data source declarations:
>
> ```json
> {
>   "dataSources": [
>     {
>       "name": "countryCodes",
>       "data": [
>         { "code": "US", "label": "United States" },
>         { "code": "GB", "label": "United Kingdom" },
>         { "code": "CA", "label": "Canada" }
>       ]
>     },
>     {
>       "name": "priorYear",
>       "source": "https://api.example.org/responses/2024/{{respondentId}}"
>     },
>     {
>       "name": "inventory",
>       "source": "formspec-fn:loadInventoryData"
>     }
>   ]
> }
> ```
>
> These data sources are then referenced in FEL expressions:
>
> ```
> @instance('priorYear').totalIncome
> @instance('countryCodes')  
> ```

### 2.2 Relationships

The six core abstractions relate to each other as follows. A conformant
processor MUST maintain these relationships.

```
┌────────────────────────────────────────────────────────────────┐
│                         Definition                         │
│  (url + version = unique identity)                         │
│                                                            │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Items      │  │ Binds    │  │ Shapes     │  │ Data       │  │
│  │ (tree)     │  │ (list)   │  │ (list)     │  │ Sources    │  │
│  └──────┬─────┘  └────┬─────┘  └─────┬──────┘  └────────────┘  │
│       │             │             │                            │
└───────┼─────────────┼─────────────┼────────────────────────────┘
       │             │             │
       │    target    │    target   │
       │   (by path)  │  (by path)  │
       ▼             ▼             ▼
┌─────────────────────────────────────────┐
│        Instance (JSON object)          │
│  Mirrors Item tree structure.          │
│  Contains current field values.        │
└───────────────────┬─────────────────────┘
                    │
                    │ contained in
                    ▼
┌─────────────────────────────────────────┐
│          Response                      │
│  references Definition (url+version)   │
│  contains Instance (data)              │
│  carries metadata (who, when, status)  │
└─────────────────────────────────────────┘
```

**Formal relationship constraints:**

1. A Definition MUST contain one or more Items. Items form a tree (a single
   root list of Items, each of which may have `children`).
2. A Definition MAY contain zero or more Binds. Each Bind MUST reference at
   least one Item by path. A conformant processor MUST signal an error if a
   Bind’s `target` does not resolve to any Item in the Definition.
3. A Definition MAY contain zero or more Validation Shapes. Each Shape MUST
   reference at least one Item by path.
4. A Response MUST reference exactly one Definition by the tuple
   `(definitionUrl, definitionVersion)`.
5. A Response contains exactly one primary Instance. The Instance’s structure
   MUST conform to the Definition’s Item tree.
6. Binds and Shapes operate on Instance data. They reference Items by path,
   and those paths resolve to nodes in the Instance.

### 2.3 The Three Layers

Formspec enforces a strict **three-layer separation of concerns**. This
separation is not a suggestion — it is an architectural invariant.

#### Layer 1: Structure Layer (Items)

The Structure Layer answers the question: **WHAT data is collected?**

This layer defines:

- The hierarchical tree of fields, groups, and display nodes.
- Each field’s data type.
- Which groups are repeatable.
- The set of valid options for choice fields.
- Labels and help text (as human-readable metadata, not rendering instructions).

The Structure Layer is a pure schema. It contains no logic, no expressions, and
no conditional behavior. A Definition consisting only of a Structure Layer is
valid — it describes a simple, static form.

#### Layer 2: Behavior Layer (Binds + Shapes)

The Behavior Layer answers the question: **HOW does data behave?**

This layer defines:

- Computed values (`calculate` Binds).
- Conditional visibility (`relevant` Binds).
- Dynamic required/read-only state (`required`, `readonly` Binds).
- Per-field constraints (`constraint` Binds).
- Cross-field and cross-section validation (Shapes).
- Default values (`default` Binds).

All behavior is expressed in FEL (§3). The Behavior Layer is reactive: when
data changes, affected expressions are re-evaluated automatically.

The Behavior Layer MUST NOT contain any rendering instructions, layout
directives, widget specifications, or style information. It operates entirely
in the data/logic domain.

#### Layer 3: Presentation Layer

The Presentation Layer answers the question: **HOW is data displayed?**

This specification provides OPTIONAL **presentation hints** — advisory
metadata that helps renderers make informed decisions about widget selection,
layout, and accessibility. Presentation hints are defined in §4.2.5
(per-item) and §4.1.1 (form-wide).

Presentation hints are strictly advisory:

- A conforming processor MAY ignore any or all presentation hints.
- A conforming definition MUST NOT require presentation hints for correct
  data capture, validation, or submission.
- Hints MUST NOT alter data semantics, validation results, or processing
  behavior.

The following remain **out of scope** and are NOT defined by this
specification:

- Rendering engines, widget toolkits, or CSS.
- Platform-specific affordances (touch targets, screen reader APIs).
- Navigation and focus management.
- Visual style, themes, and branding.

The [Formspec Theme Specification](theme-spec.md) defines sidecar theme
documents that override Tier 1 presentation hints with a selector cascade,
design tokens, widget configurations, and page layout. Companion
specifications MAY standardize additional Presentation Layer schemas
(e.g., component models). Such specifications are independent of this
document.

This separation ensures that a single Definition can drive a web form, a mobile
form, a PDF rendering, a voice-guided form, and an API-only validation endpoint
— all without modification.

### 2.4 Processing Model

Formspec defines a four-phase processing cycle, adapted from the XForms
processing model, that governs how changes in Instance data propagate through
Binds and Shapes. A conformant processor MUST implement these four phases and
MUST execute them in the specified order.

#### Phase 1: Rebuild

**Trigger:** The structural shape of the Instance has changed — specifically,
a repeat instance has been added or removed, or the Definition itself has been
replaced (e.g., version migration).

**Action:** The processor MUST:

1. Re-index all Items, updating path-to-node mappings for any repeat instances.
2. Reconstruct the dependency graph. The dependency graph is a directed acyclic
   graph (DAG) where each node is a Bind or Shape expression and each edge
   represents a field reference within that expression. New repeat instances
   introduce new nodes; removed repeat instances remove nodes.
3. Validate that the dependency graph remains acyclic. If a cycle is detected,
   the processor MUST signal a definition error and MUST NOT proceed to
   Phase 2.

**Postcondition:** The dependency graph accurately reflects the current
structure of the Instance.

> *Informative note:* For Definitions with no repeatable groups, the Rebuild
> phase is a no-op after initial load. Processors MAY optimize accordingly.

#### Phase 2: Recalculate

**Trigger:** One or more field values in the Instance have changed (via user
input, programmatic update, or a prior Recalculate pass), or Phase 1 has
completed.

**Action:** The processor MUST:

1. Identify the set of **dirty nodes** — fields whose values have changed
   since the last Recalculate.
2. Compute the **affected subgraph** — the transitive closure of all nodes
   reachable from the dirty nodes in the dependency graph.
3. Topologically sort the affected subgraph.
4. Evaluate each Bind expression in topological order:
   - `calculate` — Compute the value and write it to the Instance. If the
     computed value differs from the current value, mark the target node as
     dirty (which may expand the affected subgraph; the processor MUST
     iterate until no new dirty nodes are produced, up to a
     processor-defined limit of at least 100 iterations).
   - `relevant` — Evaluate and store the boolean result. If a node transitions
     from relevant to non-relevant, the processor MUST mark all descendant
     nodes as non-relevant. If a node transitions from non-relevant to
     relevant, the processor MUST re-evaluate all descendant Binds.
   - `required` — Evaluate and store the boolean result.
   - `readonly` — Evaluate and store the boolean result.

**Postcondition:** All `calculate`, `relevant`, `required`, and `readonly`
Bind states are consistent with current Instance data. The Instance contains
no stale computed values.

**Minimal recalculation:** A conformant processor MUST NOT re-evaluate Bind
expressions that are not in the affected subgraph. This is the minimal
recalculation guarantee, borrowed from XForms.

#### Phase 3: Revalidate

**Trigger:** Phase 2 has completed.

**Action:** The processor MUST:

1. For each relevant field that is in the affected subgraph or whose
   `required` / `relevant` state changed in Phase 2:
   a. If the field has a `constraint` Bind, evaluate the constraint expression.
      If the result is `false`, record a ValidationResult with severity
      `"error"` and the Bind’s `constraintMessage`.
   b. If the field has a `required` Bind that evaluated to `true`, and the
      field’s value is `null` or empty string, record a ValidationResult with
      severity `"error"` and a processor-generated message (or the Bind’s
      `requiredMessage`, if provided).
2. For each Validation Shape whose target paths intersect the affected
   subgraph, evaluate the Shape’s constraint expressions and record
   ValidationResult entries for any failures.
3. Composed Shapes (`and`, `or`, `not`, `xone`) MUST be evaluated by
   evaluating their constituent Shapes and combining results according to
   the composition operator.

**Postcondition:** A complete, current set of ValidationResult entries exists
for all affected nodes.

#### Phase 4: Notify

**Trigger:** Phase 3 has completed.

**Action:** The processor MUST signal state changes to any attached
Presentation Layer or observer. The notification mechanism is
implementation-defined, but MUST convey at minimum:

- The set of fields whose values changed.
- The set of fields whose `relevant`, `required`, or `readonly` state changed.
- The set of fields whose validation state changed (new errors, resolved
  errors, new warnings).

A Presentation Layer receiving these notifications can update the display
accordingly. The Formspec specification does not prescribe how notifications
are delivered (events, callbacks, reactive signals, polling).

#### Deferred Processing

During **batch operations** — such as loading an entire Response, importing
data from an external source, or programmatically setting multiple fields —
the processor SHOULD defer the four-phase cycle until the batch completes.
This avoids redundant intermediate evaluations.

Specifically, during a batch:

1. All field writes are accumulated.
2. No Rebuild, Recalculate, Revalidate, or Notify phases execute.
3. When the batch ends, the processor executes one complete four-phase cycle
   with the union of all dirty nodes.

A conformant processor MUST produce the same final state regardless of whether
changes are processed individually or in a batch.

#### Presentation Hints and Processing

The `presentation` (§4.2.5) and `formPresentation` (§4.1.1) objects are
metadata. They do NOT participate in the Rebuild → Recalculate → Revalidate
→ Notify processing cycle. FEL expressions MUST NOT reference `presentation`
properties. When a processor serializes a Response, `presentation` properties
MUST NOT appear in the Response data.

### 2.5 Validation Results

Validation in Formspec produces **structured results**, not boolean pass/fail
flags. This section defines the ValidationResult data structure. Every
conformant processor MUST produce ValidationResult entries conforming to
this structure.

#### 2.5.1 ValidationResult Entry

A single ValidationResult entry is a JSON object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `severity` | string | REQUIRED | One of `"error"`, `"warning"`, or `"info"`. See §2.5.2 for severity semantics. |
| `path` | string | REQUIRED | The dot-notation path to the data node that produced this result (e.g., `"demographics.dob"`, `"lineItems[2].amount"`). For repeat instances, the path MUST include the concrete 1-based index (not the `[*]` wildcard). See §4.3.3 for the distinction between definition-time FieldRef paths and resolved instance paths. |
| `message` | string | REQUIRED | A human-readable description of the finding. Suitable for display to end users. Processors SHOULD support localization of messages, but the mechanism is implementation-defined. |
| `constraintKind` | string | REQUIRED | The category of constraint that produced this result. MUST be one of: `"required"` (required field has no value), `"type"` (value does not conform to declared `dataType`), `"cardinality"` (repeatable group violates `minRepeat`/`maxRepeat`), `"constraint"` (Bind `constraint` evaluated to `false`), `"shape"` (named Shape's constraint evaluated to `false`), `"external"` (external system injected this result). |
| `code` | string | RECOMMENDED | A machine-readable identifier for this class of finding. Processors SHOULD include this using the standard built-in codes (see below) when no specific code is declared. Codes enable programmatic handling (e.g., suppressing known warnings, mapping to external error catalogs). |
| `source` | string | OPTIONAL | Identifies the origin of the finding: `"bind"` (from a Bind `constraint` or `required` check) or `"shape"` (from a Validation Shape). |
| `shapeId` | string | OPTIONAL | If `source` is `"shape"`, the `id` of the Validation Shape that produced this entry. |
| `constraint` | string | OPTIONAL | The FEL constraint expression that failed. Included for diagnostic purposes. Processors MAY omit this in production to reduce payload size. |

**Standard Built-in Constraint Codes:**

The following codes are RESERVED. Conformant processors MUST use these exact
codes for the corresponding built-in constraints. Shape-level and external
codes override the generic defaults.

| Code | constraintKind | Triggered When |
|------|---------------|---------------|
| `REQUIRED` | `required` | A required field is null or empty string. |
| `TYPE_MISMATCH` | `type` | Value cannot be interpreted as the field's `dataType`. |
| `MIN_REPEAT` | `cardinality` | Fewer repeat instances than `minRepeat`. |
| `MAX_REPEAT` | `cardinality` | More repeat instances than `maxRepeat`. |
| `CONSTRAINT_FAILED` | `constraint` | Bind `constraint` returned `false`. |
| `SHAPE_FAILED` | `shape` | Shape's constraint returned `false`. |
| `EXTERNAL_FAILED` | `external` | External validation source reported a failure. |

> **Example.** A set of ValidationResult entries:
>
> ```json
> [
>   {
>     "severity": "error",
>     "path": "ssn",
>     "message": "SSN must be in the format 000-00-0000.",
>     "code": "FORMAT_SSN",
>     "source": "bind",
>     "expression": "matches($ssn, '^[0-9]{3}-[0-9]{2}-[0-9]{4}$')"
>   },
>   {
>     "severity": "warning",
>     "path": "endDate",
>     "message": "Date range exceeds one year. Please verify.",
>     "code": "DATE_RANGE_002",
>     "source": "shape",
>     "shapeId": "dateRangeReasonable"
>   },
>   {
>     "severity": "error",
>     "path": "lineItems[3].quantity",
>     "message": "This field is required.",
>     "code": "REQUIRED",
>     "source": "bind"
>   }
> ]
> ```

#### 2.5.2 Severity Levels

Formspec defines three severity levels. Severity levels are strictly ordered:
`error` > `warning` > `info`.

| Severity | Semantics | Effect on Response status |
|----------|-----------|-------------------------|
| `error` | The data is invalid. The finding MUST be resolved before the Response can transition to `"completed"` status. | A Response with one or more `error`-severity results MUST NOT be marked `"completed"`. It MAY remain `"in-progress"`. |
| `warning` | The data is suspect but not provably invalid. The finding SHOULD be reviewed but does not block completion. | A Response with only `warning` and/or `info` results MAY be marked `"completed"`. |
| `info` | An informational observation. No action is required. Typically used for guidance, suggestions, or calculated summaries. | No effect on Response status. |

A conformant processor MUST distinguish between the three severity levels in
its result output. A processor MUST NOT collapse `warning` into `error` or
omit `info` results without explicit user configuration.

#### 2.5.3 Aggregated Validation State

The aggregated validation state of a Response is derived from its
ValidationResult entries:

| Condition | Aggregated state |
|-----------|------------------|
| One or more entries with `severity = "error"` | `"invalid"` |
| No `"error"` entries, one or more `"warning"` entries | `"valid-with-warnings"` |
| No `"error"` or `"warning"` entries (zero or more `"info"` entries) | `"valid"` |

The aggregated state is a convenience derivation. A conformant processor MUST
be able to report the aggregated state but MUST also provide access to the full
list of individual ValidationResult entries.

#### 2.5.4 Non-Relevant Fields

Fields that are non-relevant (i.e., whose `relevant` Bind evaluates to `false`)
MUST NOT produce ValidationResult entries. If a field transitions from relevant
to non-relevant during Recalculate, any previously-emitted ValidationResult
entries for that field MUST be removed during Revalidate.

Conversely, when a field transitions from non-relevant to relevant, the
processor MUST evaluate all applicable Binds and Shapes for that field during
the next Revalidate phase.

***

## 3. Expression Language — Formspec Expression Language (FEL)

### 3.1 Design Goals

The Formspec Expression Language (FEL) is a small, deterministic, side-effect-free
expression language designed for evaluating form logic. It is **not** a
general-purpose programming language. It has no statements, no loops, no
variable assignment, no I/O, and no user-defined functions (though extensions
MAY register additional built-in functions).

FEL’s design goals are:

1. **Host-language independence.** FEL MUST be implementable in any
   general-purpose programming language. It MUST NOT depend on JavaScript
   semantics, XPath axes, Python operator overloading, or any other
   host-language feature.
2. **Familiarity.** FEL syntax is designed to be readable by spreadsheet users
   and web developers. Function names follow common conventions (e.g.,
   `sum()`, `if()`, `today()`). Operators use standard mathematical notation.
3. **Unambiguous grammar.** FEL’s grammar is a Parsing Expression Grammar (PEG),
   which is unambiguous by construction. There is exactly one valid parse tree
   for any syntactically valid FEL expression.
4. **Determinism.** Given the same Instance data, a FEL expression MUST always
   produce the same result, regardless of implementation language or platform.
   The sole exception is `now()`, which returns the current date-time and is
   therefore non-deterministic by design; processors SHOULD document their
   `now()` resolution behavior.
5. **Type safety.** FEL uses a small, explicit type system. Type mismatches
   produce errors, not silent coercions. This prevents an entire class of bugs
   common in loosely typed expression languages.

### 3.2 Field References

FEL expressions operate on Instance data by referencing fields. A **field
reference** resolves to the current value of a field in the Instance.

#### 3.2.1 Simple References

The `$` sigil introduces a field reference:

| Syntax | Resolves to | Example |
|--------|------------|--------|
| `$fieldKey` | The value of the field with the given key, resolved against the nearest enclosing scope. | `$firstName` → `"Ada"` |
| `$parentKey.childKey` | The value of a nested field. Dot-separated path segments correspond to group keys. | `$demographics.dob` → `"1815-12-10"` |
| `$` | The current node’s own value. Used in `constraint` expressions where the Bind’s target is the field being validated. | `$ > 0` (the current field’s value must be positive) |

Field references are **lexically scoped**. When a reference appears inside a
Bind targeting a field within a repeatable group, `$siblingField` resolves to
the sibling field within the **same repeat instance** — not across all
instances. This mirrors XForms scoping behavior.

#### 3.2.2 Repeat References

Within repeatable contexts, additional reference forms are available:

| Syntax | Resolves to | Example |
|--------|------------|--------|
| `$repeatKey[index].fieldKey` | The value of `fieldKey` in the repeat instance at the given 1-based `index`. | `$lineItems[1].amount` → `100.00` |
| `$repeatKey[*].fieldKey` | An **array** of all values of `fieldKey` across all instances of the repeat. Intended for use with aggregate functions. | `sum($lineItems[*].amount)` → `350.00` |
| `@current` | An explicit reference to the current repeat instance object. Useful for disambiguation. | `@current.quantity * @current.unitPrice` |
| `@index` | The 1-based position of the current repeat instance within its parent array. | `if(@index = 1, 'First', 'Subsequent')` |
| `@count` | The total number of instances in the current repeat collection. | `@count >= 1` (at least one entry required) |

A conformant processor MUST signal an error if an explicit index is out of
bounds (less than 1 or greater than the number of repeat instances).

#### 3.2.3 Cross-Instance References

To reference data in a secondary instance, use the `@instance()` accessor:

```
@instance('priorYear').totalIncome
```

The argument to `@instance()` MUST be a string literal matching the `name` of a
declared data source in the Definition. If the named instance does not exist,
the processor MUST signal an error.

Field paths after `@instance()` follow the same dot-notation as primary
instance references.

> **Example.** A calculation that compares current-year income to prior-year:
>
> ```
> $totalIncome - @instance('priorYear').totalIncome
> ```

### 3.3 Operators

FEL defines the following operators, listed from lowest to highest precedence.
Operators at the same precedence level are left-associative unless otherwise
noted.

#### Precedence Table

| Precedence | Operator(s) | Category | Associativity |
|-----------|------------|----------|---------------|
| 1 (lowest) | `? :` | Ternary conditional | Right |
| 2 | `or` | Logical disjunction | Left |
| 3 | `and` | Logical conjunction | Left |
| 4 | `=`, `!=` | Equality | Left |
| 5 | `<`, `>`, `<=`, `>=` | Comparison | Left |
| 6 | `in`, `not in` | Membership | Left |
| 7 | `??` | Null-coalescing | Left |
| 8 | `+`, `-`, `&` | Addition / concatenation | Left |
| 9 | `*`, `/`, `%` | Multiplication | Left |
| 10 (highest) | `not` (prefix), `-` (negate) | Unary | Right |

#### Operator Semantics

**Arithmetic operators** (`+`, `-`, `*`, `/`, `%`):

- Both operands MUST be of type `number`. If either operand is not a number,
  the processor MUST signal a type error.
- Division by zero MUST signal an evaluation error (not produce `Infinity` or
  `NaN`).
- The `%` (modulo) operator returns the remainder of integer division. Both
  operands MUST be numbers; the result follows the sign of the dividend.

**Comparison operators** (`<`, `>`, `<=`, `>=`):

- Both operands MUST be of the same type: `number` compared with `number`,
  `string` compared with `string` (lexicographic, Unicode code-point order),
  `date` compared with `date` (chronological order).
- Comparing operands of different types MUST signal a type error, with one
  exception: comparing any value to `null` is permitted and is defined below.

**Equality operators** (`=`, `!=`):

- Any two values of the same type may be compared for equality.
- `null = null` evaluates to `true`.
- `null = <any non-null value>` evaluates to `false`.
- Cross-type equality (e.g., `number = string`) MUST signal a type error.

**Logical operators** (`and`, `or`, `not`):

- Operands MUST be of type `boolean`. Non-boolean operands MUST signal a type
  error (no truthy/falsy coercion).
- `and` and `or` use short-circuit evaluation: if the left operand of `and` is
  `false`, the right operand is not evaluated; if the left operand of `or` is
  `true`, the right operand is not evaluated.

**String concatenation** (`&`):

- Both operands MUST be of type `string`. Use `string()` to convert non-string
  values before concatenation.
- The `&` operator is used instead of `+` to prevent ambiguity between numeric
  addition and string concatenation.

> **Example:** `$firstName & ' ' & $lastName` → `"Ada Lovelace"`

**Null-coalescing operator** (`??`):

- If the left operand is `null`, the result is the right operand. Otherwise,
  the result is the left operand.
- Both operands MUST be of the same type (or the left operand is `null`).

> **Example:** `$middleName ?? 'N/A'` → `"N/A"` if `middleName` is null.

**Membership operators** (`in`, `not in`):

- The left operand is a scalar value. The right operand MUST be an `array`.
- `value in array` evaluates to `true` if the array contains an element equal
  to the value (using `=` semantics).
- `value not in array` is equivalent to `not (value in array)`.

> **Example:** `$status in ['active', 'pending']`

**Ternary conditional** (`? :`):

- Syntax: `condition ? thenExpr : elseExpr`
- `condition` MUST be of type `boolean`.
- If `condition` is `true`, the result is `thenExpr`; otherwise, `elseExpr`.
- Only the selected branch is evaluated.

### 3.4 Type System

FEL defines five primitive types and one compound type.

#### 3.4.1 Primitive Types

| Type | Description | JSON representation | Literal syntax in FEL |
|------|------------|-------------------|---------------------|
| `string` | A Unicode character sequence. | JSON string | `'hello'` or `"hello"` (single or double quotes) |
| `number` | A decimal (base-10) value. Implementations MUST NOT introduce binary floating-point rounding errors in arithmetic operations on values representable as finite decimal fractions. Minimum precision: 18 significant decimal digits. | JSON number | `42`, `3.14`, `-7`, `0.001` |
| `boolean` | A truth value. | JSON `true` or `false` | `true`, `false` |
| `date` | A calendar date (no time component). | JSON string in ISO 8601 format (`YYYY-MM-DD`) | `@2025-07-10` |
| `money` | A monetary value with currency identity. | `{ "amount": "50000.00", "currency": "USD" }` | No literal syntax; use `money(50000, 'USD')` |
| `null` | The absence of a value. | JSON `null` | `null` |

> **Decimal precision rationale:** The `number` type uses decimal (base-10)
> semantics rather than IEEE 754 binary floating-point. This ensures that
> `0.1 + 0.2 = 0.3` — a critical property for financial calculations.
> JSON serialization uses JSON number syntax per RFC 8259. Implementations
> SHOULD preserve the original decimal representation when round-tripping
> values through the Instance.

> **Money type:** The `amount` field of a `money` value MUST be serialized as
> a JSON string containing a decimal number (not a JSON number) to preserve
> precision. `currency` is an ISO 4217 three-letter code. Processors that do
> not support the `money` type MUST fall back to treating the value as a JSON
> object with `amount` and `currency` string properties.

#### 3.4.2 Compound Type

| Type | Description | JSON representation |
|------|------------|-------------------|
| `array` | An ordered sequence of values of the same type. Produced by repeat wildcard references (`$repeat[*].field`) and array literals. Used as input to aggregate functions. | JSON array |

Array literals are supported in FEL:

```
['active', 'pending', 'review']
[1, 2, 3, 4, 5]
```

All elements of an array literal MUST be of the same type. A mixed-type array
literal is a parse error.

#### 3.4.3 Coercion Rules

FEL does **not** perform implicit type coercion. The following rules are
normative:

1. Arithmetic operators (`+`, `-`, `*`, `/`, `%`) require both operands to be
   `number`. Applying an arithmetic operator to a non-number operand MUST
   signal a type error.
2. The concatenation operator (`&`) requires both operands to be `string`.
3. Logical operators (`and`, `or`, `not`) require `boolean` operands.
4. Comparison operators require both operands to be of the same type (or one
   to be `null`).
5. There is no "truthy" or "falsy" concept. The number `0` is not `false`;
   the empty string `''` is not `false`; `null` is not `false`. Only the
   boolean value `false` is `false`.

Explicit coercion is performed via cast functions:

| Function | Input | Output | Behavior |
|----------|-------|--------|----------|
| `number(value)` | `string` | `number` | Parses the string as a decimal number. MUST signal an error if the string is not a valid number. |
| `number(value)` | `boolean` | `number` | `true` → `1`, `false` → `0`. |
| `number(value)` | `null` | `null` | Returns `null`. |
| `string(value)` | `number` | `string` | Decimal representation, no trailing zeros. |
| `string(value)` | `boolean` | `string` | `"true"` or `"false"`. |
| `string(value)` | `date` | `string` | ISO 8601 date string (`YYYY-MM-DD`). |
| `string(value)` | `null` | `string` | Returns `""` (empty string). |
| `boolean(value)` | `string` | `boolean` | `"true"` → `true`, `"false"` → `false`. All other strings MUST signal an error. |
| `boolean(value)` | `number` | `boolean` | `0` → `false`, all other numbers → `true`. |
| `boolean(value)` | `null` | `boolean` | Returns `false`. |
| `date(value)` | `string` | `date` | Parses ISO 8601 date. MUST signal an error if the string is not a valid date. |
| `date(value)` | `null` | `null` | Returns `null`. |

**Critical distinction:** Empty string and `null` are **not** the same.

- `null` means the value is **absent** — the field has never been set.
- `''` (empty string) means the value is **present but empty** — the field
  was set to an empty string.

A `required` Bind treats both `null` and `''` as unsatisfied (the field is
not considered answered). But in all other contexts, `null != ''`.

### 3.5 Built-in Functions

The following functions are part of the core FEL specification. A conformant
processor MUST implement all functions in this section. Extension functions
(§7) MAY supplement but MUST NOT override these functions.

In the signatures below, `T` denotes any type, and `?` after a parameter name
indicates it is optional.

#### 3.5.1 Aggregate Functions

Aggregate functions operate on arrays and reduce them to a single value.

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `sum` | `sum(array<number>) → number` | `number` | Sum of all elements. `sum([])` returns `0`. Null elements are skipped. |
| `count` | `count(array<T>) → number` | `number` | Number of non-null elements. `count([])` returns `0`. |
| `countWhere` | `countWhere(array, boolean) → number` | `number` | Count of elements where the expression evaluates to `true`. Within the expression, `$` refers to the current element. E.g., `countWhere($line_items[*].amount, $ > 10000)`. |
| `avg` | `avg(array<number>) → number` | `number` | Arithmetic mean of non-null elements. `avg([])` MUST signal an error (division by zero). |
| `min` | `min(array<number>) → number` | `number` | Smallest non-null element. `min([])` returns `null`. Also works on `array<date>` and `array<string>`. |
| `max` | `max(array<number>) → number` | `number` | Largest non-null element. `max([])` returns `null`. Also works on `array<date>` and `array<string>`. |

> **Example.** Compute a line-item total:
>
> ```
> sum($lineItems[*].quantity * $lineItems[*].unitPrice)
> ```
>
> *Informative note:* The above requires element-wise multiplication of two
> arrays. When two arrays of equal length are operands to an arithmetic
> operator, the operation is applied element-wise, producing a new array.
> If the arrays are of different lengths, the processor MUST signal an error.

#### 3.5.2 String Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `length` | `length(string) → number` | `number` | Number of Unicode code points. `length(null)` returns `0`. |
| `contains` | `contains(string, string) → boolean` | `boolean` | `true` if the first string contains the second as a substring. Case-sensitive. |
| `startsWith` | `startsWith(string, string) → boolean` | `boolean` | `true` if the first string starts with the second. |
| `endsWith` | `endsWith(string, string) → boolean` | `boolean` | `true` if the first string ends with the second. |
| `substring` | `substring(string, number, number?) → string` | `string` | Extract a substring. First `number` is the 1-based start position. Second `number` is the length (optional; if omitted, returns from start to end). |
| `replace` | `replace(string, string, string) → string` | `string` | Replace all occurrences of the second argument in the first argument with the third argument. Literal string matching, not regex. |
| `upper` | `upper(string) → string` | `string` | Convert to uppercase (Unicode-aware). |
| `lower` | `lower(string) → string` | `string` | Convert to lowercase (Unicode-aware). |
| `trim` | `trim(string) → string` | `string` | Remove leading and trailing whitespace. |
| `matches` | `matches(string, string) → boolean` | `boolean` | `true` if the first string matches the regular expression in the second string. The regex syntax is a subset of ECMA-262: character classes, quantifiers, anchors, alternation, and grouping. Lookahead/lookbehind are NOT REQUIRED. |
| `format` | `format(string, any...) → string` | `string` | String interpolation. Positional placeholders `{0}`, `{1}`, etc. are replaced with the corresponding arguments, formatted as strings. E.g., `format('{0} of {1}', $current, $total)`. |

#### 3.5.3 Numeric Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `round` | `round(number, number?) → number` | `number` | Round to the given precision (default 0). Uses "round half to even" (banker’s rounding). |
| `floor` | `floor(number) → number` | `number` | Largest integer ≤ the argument. |
| `ceil` | `ceil(number) → number` | `number` | Smallest integer ≥ the argument. |
| `abs` | `abs(number) → number` | `number` | Absolute value. |
| `power` | `power(number, number) → number` | `number` | Exponentiation. `power(2, 10)` returns `1024`. |

#### 3.5.4 Date Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `today` | `today() → date` | `date` | The current date in the processor’s local time zone (or UTC, at the processor’s discretion; processors SHOULD document their choice). |
| `now` | `now() → date` | `date` | The current date-time. Non-deterministic. |
| `hours` | `hours(string) → integer` | `time` | Extract the hours component (0–23) from an ISO 8601 time string. E.g., `hours('14:30:00')` → `14`. |
| `minutes` | `minutes(string) → integer` | `time` | Extract the minutes component (0–59) from an ISO 8601 time string. E.g., `minutes('14:30:00')` → `30`. |
| `seconds` | `seconds(string) → integer` | `time` | Extract the seconds component (0–59) from an ISO 8601 time string. E.g., `seconds('14:30:00')` → `0`. |
| `time` | `time(integer, integer, integer) → string` | `time` | Construct an ISO 8601 time string from hours, minutes, seconds. E.g., `time(14, 30, 0)` → `'14:30:00'`. Hours MUST be 0–23, minutes and seconds 0–59. |
| `timeDiff` | `timeDiff(string, string) → integer` | `time` | Difference in seconds between two ISO 8601 time strings. `timeDiff('14:30:00', '13:00:00')` → `5400`. Result MAY be negative. |
| `year` | `year(date) → number` | `number` | The four-digit year component. |
| `month` | `month(date) → number` | `number` | The month component (1–12). |
| `day` | `day(date) → number` | `number` | The day-of-month component (1–31). |
| `dateDiff` | `dateDiff(date, date, string) → number` | `number` | The difference between two dates in the specified unit. The third argument MUST be one of `'years'`, `'months'`, `'days'`. The result is `date1 - date2` (positive if date1 is later). For `'years'` and `'months'`, the result is a whole number (truncated, not rounded). |
| `dateAdd` | `dateAdd(date, number, string) → date` | `date` | Add the specified amount in the specified unit to the date. Units are `'years'`, `'months'`, `'days'`. If adding months produces an invalid date (e.g., Jan 31 + 1 month), the result is the last day of the target month. |

#### 3.5.5 Logical Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `if` | `if(boolean, T, T) → T` | `T` | If the first argument is `true`, returns the second argument; otherwise returns the third. Only the selected branch is evaluated. The second and third arguments MUST be of the same type. |
| `coalesce` | `coalesce(T, T, ...T) → T` | `T` | Returns the first non-null argument. If all arguments are `null`, returns `null`. All arguments MUST be of the same type (or `null`). |
| `empty` | `empty(T) → boolean` | `boolean` | `true` if the argument is `null`, an empty string (`''`), or an empty array (`[]`). `false` otherwise. |
| `present` | `present(T) → boolean` | `boolean` | The logical inverse of `empty()`. |
| `selected` | `selected(array, string) → boolean` | `boolean` | Returns `true` if the multiChoice field's value array contains the specified value. Shorthand for `value in $field`. |

#### 3.5.6 Type-Checking Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `isNumber` | `isNumber(T) → boolean` | `boolean` | `true` if the argument is of type `number`. |
| `isString` | `isString(T) → boolean` | `boolean` | `true` if the argument is of type `string`. |
| `isDate` | `isDate(T) → boolean` | `boolean` | `true` if the argument is of type `date`. |
| `isNull` | `isNull(T) → boolean` | `boolean` | `true` if the argument is `null`. Equivalent to `$ = null`. |
| `typeOf` | `typeOf(T) → string` | `string` | Returns the type name as a string: `"string"`, `"number"`, `"boolean"`, `"date"`, `"null"`, or `"array"`. |

#### 3.5.7 Money Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `money` | `money(number, string) → money` | `money` | Construct a Money value. |
| `moneyAmount` | `moneyAmount(money) → number` | `number` | Extract the decimal amount. |
| `moneyCurrency` | `moneyCurrency(money) → string` | `string` | Extract the ISO 4217 currency code. |
| `moneyAdd` | `moneyAdd(money, money) → money` | `money` | Add two Money values. Operands MUST have the same currency; mismatched currencies produce a type error. |
| `moneySum` | `moneySum(array) → money` | `money` | Sum an array of Money values. All elements MUST share the same currency. Empty array returns `null`. |

#### 3.5.8 MIP-State Query Functions

These functions query the current computed state of model item properties.
They are evaluated during the Revalidate phase, after all Recalculate MIPs
have been resolved.

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `valid` | `valid($path) → boolean` | `boolean` | `true` if the referenced field has no error-severity validation results. |
| `relevant` | `relevant($path) → boolean` | `boolean` | `true` if the referenced field is currently relevant. |
| `readonly` | `readonly($path) → boolean` | `boolean` | `true` if the referenced field is currently readonly. |
| `required` | `required($path) → boolean` | `boolean` | `true` if the referenced field is currently required. |

The argument is a field reference using standard FEL `$path` syntax:

```
if(not(valid($ein)), "Please correct EIN before proceeding", "")
```

#### 3.5.9 Repeat Navigation Functions

These functions navigate within repeat contexts. All MUST only be called
within a repeat context; calling them outside a repeat is a definition error.

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `prev` | `prev() → object \| null` | object or null | Returns the previous row (`@index - 1`). Returns `null` for the first row. |
| `next` | `next() → object \| null` | object or null | Returns the next row (`@index + 1`). Returns `null` for the last row. |
| `parent` | `parent() → object` | object | Returns the parent context of the current repeat row. Within a nested repeat, returns the enclosing repeat row. At the top-level repeat, returns the root instance object. |

Usage:

```
prev().cumulative_total + @current.amount
parent().section_total
```

**Dependency semantics:** When row order changes (insert, delete, reorder),
all expressions using `prev()` or `next()` in the affected repeat MUST be
re-evaluated. Implementations SHOULD treat `prev()`/`next()` as depending on
the entire repeat collection for dependency tracking purposes.

### 3.6 Dependency Tracking

FEL expressions are the source of all reactive behavior in Formspec. To
support minimal recalculation (§2.4, Phase 2), a conformant processor MUST
implement dependency tracking as specified in this section.

#### 3.6.1 Reference Extraction

When a Definition is loaded, the processor MUST parse every FEL expression in
every Bind and Shape and extract the set of **field references** contained in
that expression. A field reference is any syntactic construct that resolves to
an Instance value:

- `$fieldKey`
- `$parent.child`
- `$repeat[*].field`
- `$repeat[index].field`
- `@current.field`
- `@instance('name').field`

The processor MUST build a **dependency graph** — a directed graph `G = (V, E)`
where:

- Each vertex `v ∈ V` is a data node (a field in the Instance) or a Bind/Shape
  expression.
- Each edge `(u, v) ∈ E` means "the expression for `v` references the value of
  `u`." In other words, `v` depends on `u`.

#### 3.6.2 Topological Ordering

The dependency graph MUST be a directed acyclic graph (DAG). A conformant
processor MUST verify acyclicity during the Rebuild phase (§2.4, Phase 1).

If a cycle is detected, the processor MUST:

1. Signal a **definition error** (not a runtime error).
2. Include in the error message the set of field keys that participate in at
   least one cycle.
3. Refuse to proceed with Recalculate, Revalidate, or Notify.

If the graph is acyclic, the processor MUST compute a topological ordering of
the vertices. This ordering determines the evaluation sequence: a Bind’s
expression is evaluated only after all expressions it depends on have been
evaluated.

#### 3.6.3 Incremental Re-evaluation

When a field value changes (due to user input or an external update), the
processor MUST:

1. Identify the changed field as the **root** of the dirty subgraph.
2. Compute the **affected set** — all vertices reachable from the root by
   following dependency edges forward (i.e., all expressions that directly or
   transitively depend on the changed field).
3. Topologically sort the affected set.
4. Re-evaluate only the expressions in the affected set, in topological order.

Expressions outside the affected set MUST NOT be re-evaluated. This is the
**minimal recalculation guarantee**.

> **Example.** Consider three fields and two Binds:
>
> - `$price` (user-entered)
> - `$quantity` (user-entered)
> - `$subtotal` with Bind: `calculate = $price * $quantity`
> - `$total` with Bind: `calculate = sum($lineItems[*].subtotal) + $tax`
>
> If the user changes `$price`, the affected set is `{$subtotal, $total}`.
> The processor re-evaluates `$subtotal` first (because `$total` depends on
> `$subtotal`), then `$total`. The field `$quantity` and any Binds that do
> not transitively depend on `$price` are untouched.

#### 3.6.4 Wildcard Dependencies

A wildcard repeat reference (`$repeat[*].field`) introduces a dependency on
**every** instance of `field` within the repeat. When any instance of that
field changes, or when a repeat instance is added or removed, the expression
containing the wildcard reference is in the affected set.

A conformant processor MUST track wildcard dependencies at the collection
level: a change to any element of the collection marks the wildcard-dependent
expression as dirty.

### 3.7 Grammar (Informative)

This section provides a simplified Parsing Expression Grammar (PEG) for FEL.
It is **informative**, not normative — the normative semantics are defined in
§§3.2–3.6 above. This grammar is provided to demonstrate that FEL is
unambiguous and PEG-parseable, and to serve as a starting point for
implementors.

The grammar uses the following PEG conventions:
- `'literal'` — literal string match
- `/` — ordered choice
- `*` — zero or more
- `+` — one or more
- `?` — optional
- `( )` — grouping
- `!` — negative lookahead

```peg
# ============================================================
# Formspec Expression Language (FEL) — PEG Grammar (Informative)
# ============================================================

Expression     ← _ LetExpr _

LetExpr        ← 'let' _ Identifier _ '=' _ IfExpr _ 'in' _ LetExpr
               / IfExpr

IfExpr         ← 'if' _ Ternary _ 'then' _ IfExpr _ 'else' _ IfExpr
               / Ternary

Ternary        ← LogicalOr (_ '?' _ Expression _ ':' _ Expression)?

LogicalOr      ← LogicalAnd (_ 'or' _ LogicalAnd)*

LogicalAnd     ← Equality (_ 'and' _ Equality)*

Equality       ← Comparison ((_ '=' / _ '!=') _ Comparison)*

Comparison     ← Membership ((_ '<=' / _ '>=' / _ '<' / _ '>') _ Membership)*

Membership     ← NullCoalesce ((_ 'not' _ 'in' / _ 'in') _ NullCoalesce)?

NullCoalesce   ← Addition (_ '??' _ Addition)*

Addition       ← Multiplication ((_ '+' / _ '-' / _ '&') _ Multiplication)*

Multiplication ← Unary ((_ '*' / _ '/' / _ '%') _ Unary)*

Unary          ← 'not' _ Unary
               / '-' _ Unary
               / Postfix

Postfix        ← Atom PathTail*

PathTail       ← '.' Identifier
               / '[' _ ( Integer / '*' ) _ ']'

Atom           ← IfCall
               / FunctionCall
               / FieldRef
               / ObjectLiteral
               / ArrayLiteral
               / Literal
               / '(' _ Expression _ ')'

IfCall         ← 'if' _ '(' _ ArgList? _ ')'

FieldRef       ← '$' Identifier PathTail*
               / '$'
               / '@' Identifier ('(' _ StringLiteral _ ')')? ('.' Identifier)*

FunctionCall   ← Identifier '(' _ ArgList? _ ')'
ArgList        ← Expression (_ ',' _ Expression)*

ObjectLiteral  ← '{' _ ObjectEntries? _ '}'
ObjectEntries  ← ObjectEntry (_ ',' _ ObjectEntry)*
ObjectEntry    ← (Identifier / StringLiteral) _ ':' _ Expression

ArrayLiteral   ← '[' _ (Expression (_ ',' _ Expression)*)? _ ']'

Literal        ← DateTimeLiteral
               / DateLiteral
               / NumberLiteral
               / StringLiteral
               / 'true'
               / 'false'
               / 'null'

DateLiteral     ← '@' [0-9]{4} '-' [0-9]{2} '-' [0-9]{2}
DateTimeLiteral ← '@' [0-9]{4} '-' [0-9]{2} '-' [0-9]{2} 'T'
                   [0-9]{2} ':' [0-9]{2} ':' [0-9]{2} ('Z' / [+-][0-9]{2}':'[0-9]{2})

# --- Lexical rules ---

Identifier     ← [a-zA-Z_] [a-zA-Z0-9_]*

NumberLiteral  ← '-'? [0-9]+ ('.' [0-9]+)? (('e' / 'E') ('+' / '-')? [0-9]+)?

StringLiteral  ← '\'' (!'\'' .)* '\''
               / '"' (!'"' .)* '"'

Integer        ← [0-9]+

_              ← [ \t\n\r]*              # Optional whitespace
```

> *Informative note:* This grammar intentionally omits Unicode escape sequences
> in string literals, detailed whitespace rules, and comment syntax. The
> normative grammar is defined in the companion document *FEL Normative
> Grammar v1.0*.

### 3.8 Null Propagation

Null values require special handling in an expression language used for form
logic. Fields are frequently null — a user has not yet filled in a value, a
repeated section is empty, a secondary instance lookup returns no match.
Formspec defines explicit null-propagation rules to avoid ambiguity.

#### 3.8.1 General Rule

Unless otherwise specified by a specific function or operator, **null
propagates through expressions**: if any operand to a function or operator is
`null`, the result is `null`.

This rule applies to:

- **Arithmetic operators:** `null + 5` → `null`, `10 * null` → `null`.
- **String concatenation:** `'hello' & null` → `null`.
- **Comparison operators:** `null < 5` → `null` (not `true` or `false`).

When a `null` result reaches a context that requires a `boolean` — such as a
`relevant`, `required`, `constraint`, or `if()` condition — the processor MUST
treat `null` as follows:

| Context | `null` is treated as | Rationale |
|---------|---------------------|----------|
| `relevant` | `true` | A field whose relevance cannot be determined SHOULD remain visible. Hiding fields silently is worse than showing them. |
| `required` | `false` | A field whose required-ness cannot be determined SHOULD NOT block submission. |
| `readonly` | `false` | A field whose read-only state cannot be determined SHOULD remain editable. |
| `constraint` | `true` (passes) | A constraint that cannot be evaluated due to null inputs is not considered violated. The `required` Bind, not the `constraint` Bind, is responsible for ensuring the field has a value. |
| `if()` condition | The processor MUST signal an evaluation error. | Unlike Bind contexts, `if()` is a general-purpose function and should not silently swallow nulls. Use `coalesce()` or `?? false` to handle explicitly. |

#### 3.8.2 Functions with Special Null Handling

The following functions define their own null behavior and do NOT follow the
general propagation rule:

| Function | Null behavior |
|----------|---------------|
| `coalesce(v1, v2, ...)` | Skips null arguments, returns first non-null. Returns `null` only if all arguments are null. |
| `empty(value)` | Returns `true` if the argument is `null`. |
| `present(value)` | Returns `false` if the argument is `null`. |
| `isNull(value)` | Returns `true` if the argument is `null`. |
| `typeOf(value)` | Returns `"null"` if the argument is `null`. |
| `count(array)` | Skips null elements in the array. |
| `sum(array)` | Skips null elements. `sum([null, null])` → `0`. |
| `avg(array)` | Skips null elements. `avg([null, 10, null, 20])` → `15`. |
| `min(array)` | Skips null elements. |
| `max(array)` | Skips null elements. |
| `??` (null-coalescing) | Returns right operand if left is null. |
| `string(null)` | Returns `""`. |
| `boolean(null)` | Returns `false`. |
| `number(null)` | Returns `null`. |
| `date(null)` | Returns `null`. |
| `length(null)` | Returns `0`. |

#### 3.8.3 Missing Field References

If a FEL expression references a field key that exists in the Definition but
has no value in the Instance (i.e., the JSON property is absent or explicitly
`null`), the reference resolves to `null`.

If a FEL expression references a field key that does **not** exist in the
Definition, the processor MUST signal a **definition error** at load time (not
at evaluation time). This is a static check.

### 3.9 Element-Wise Array Operations

When an arithmetic, comparison, or string operator is applied to two arrays of
equal length, the operation is performed **element-wise**, producing a new
array of the same length.

**Formal rules:**

1. If both operands are arrays of equal length `n`, the result is an array of
   length `n` where element `i` is the result of applying the operator to
   element `i` of each operand.
2. If both operands are arrays of different lengths, the processor MUST signal
   an evaluation error.
3. If one operand is a scalar and the other is an array of length `n`, the
   scalar is **broadcast**: the result is an array of length `n` where each
   element is the result of applying the operator to the scalar and the
   corresponding array element.
4. Null elements within arrays follow the null-propagation rules (§3.8.1):
   an operation on a null element produces null in the corresponding position.

Element-wise operations are the primary mechanism for computing derived values
across repeat collections before aggregation.

> **Example.** Compute line-item totals and then sum them:
>
> ```
> sum($lineItems[*].quantity * $lineItems[*].unitPrice)
> ```
>
> If the Instance contains:
>
> ```json
> {
>   "lineItems": [
>     { "quantity": 2, "unitPrice": 10.00 },
>     { "quantity": 5, "unitPrice": 3.50 },
>     { "quantity": 1, "unitPrice": 25.00 }
>   ]
> }
> ```
>
> Then `$lineItems[*].quantity` → `[2, 5, 1]` and
> `$lineItems[*].unitPrice` → `[10.00, 3.50, 25.00]`.
>
> Element-wise multiplication: `[2, 5, 1] * [10.00, 3.50, 25.00]` →
> `[20.00, 17.50, 25.00]`.
>
> `sum([20.00, 17.50, 25.00])` → `62.50`.

> **Example.** Scalar broadcast — apply a tax rate to all line totals:
>
> ```
> $lineItems[*].amount * $taxRate
> ```
>
> If `$taxRate` is `0.08` and `$lineItems[*].amount` is `[20.00, 17.50, 25.00]`,
> the result is `[1.60, 1.40, 2.00]`.

### 3.10 Error Handling

FEL distinguishes between two classes of errors: **definition errors** (detected
at load time) and **evaluation errors** (detected at runtime during expression
evaluation).

#### 3.10.1 Definition Errors

A definition error indicates that the Definition document is malformed or
internally inconsistent. Definition errors are detected during the initial
load and Rebuild phase. A conformant processor MUST detect all of the
following and MUST NOT proceed to Recalculate:

| Error | Description |
|-------|-------------|
| **Syntax error** | A FEL expression does not conform to the grammar (§3.7). The error message MUST include the expression text and the approximate position of the error. |
| **Undefined reference** | A field reference (`$key` or `$parent.child`) does not correspond to any Item in the Definition. |
| **Undefined instance** | An `@instance('name')` reference names a Data Source that is not declared in the Definition. |
| **Undefined function** | A function call names a function that is neither a built-in (§3.5) nor a registered extension function. |
| **Circular dependency** | The dependency graph (§3.6) contains a cycle. The error message MUST identify at least one field key in the cycle. |
| **Arity mismatch** | A function is called with the wrong number of arguments. |
| **Calculate target conflict** | A `calculate` Bind targets a field that is also targeted by another `calculate` Bind. Each field MUST have at most one `calculate` Bind. |
| **Read-only instance write** | A `calculate` Bind targets a path within a secondary (read-only) instance. |

#### 3.10.2 Evaluation Errors

An evaluation error occurs during expression evaluation when operand values
violate type or domain constraints. A conformant processor MUST handle
evaluation errors as follows:

| Error | Description | Processor behavior |
|-------|-------------|-------------------|
| **Type error** | An operator or function receives an operand of an unexpected type (e.g., `'hello' + 5`). | The expression result is `null`. The processor MUST record a diagnostic. The diagnostic SHOULD be surfaced to Definition authors (e.g., in a debug console) but MUST NOT be surfaced to end users as a validation error. |
| **Division by zero** | The `/` or `%` operator has a zero right operand. | Same as type error: result is `null`, diagnostic recorded. |
| **Index out of bounds** | An explicit repeat index (`$repeat[n].field`) references a position that does not exist. | Same as type error: result is `null`, diagnostic recorded. |
| **Date overflow** | A `dateAdd()` operation produces an invalid date that cannot be normalized (e.g., adding 1 month to January 31 is normalized to February 28/29, which is valid — but implementation-specific edge cases may arise). | Processor MUST normalize to the nearest valid date. If normalization is not possible, result is `null`, diagnostic recorded. |
| **Regex error** | The `matches()` function receives an invalid regular expression string. | The expression result is `null`. The processor MUST record a diagnostic. |

**Design rationale:** Evaluation errors produce `null` rather than halting
evaluation because form users should not be punished for a Definition author's
mistake. A type error in one expression should not prevent the rest of the form
from functioning. The diagnostic recording ensures that errors are observable
by authors during testing.

### 3.11 Reserved Words

The following identifiers are reserved in FEL and MUST NOT be used as field
keys, Data Source names, or extension function names:

```
and       or        not       in        true      false     null
```

Additionally, all built-in function names (§3.5) are reserved in the function
namespace: a field key MAY be `sum` (it is referenced as `$sum`), but an
extension function MUST NOT be named `sum`.

### 3.12 Extension Functions

Formspec allows domain-specific extensions to register additional functions with
the FEL evaluator. Extension functions are the primary mechanism for extending
FEL without modifying the core specification.

An extension function MUST:

1. Have a name that does not collide with any built-in function (§3.5) or
   reserved word (§3.11).
2. Be **pure** — given the same arguments, it MUST always return the same
   result. Extension functions MUST NOT have side effects.
3. Be **total** — it MUST return a value (possibly `null`) for every valid
   combination of argument types. It MUST NOT throw exceptions that propagate
   to the FEL evaluator; instead, it returns `null` and the processor records
   a diagnostic.
4. Declare its **signature** — parameter types and return type — so that the
   processor can perform static type checking during the Rebuild phase.

An extension function SHOULD be registered with the processor before the
Definition is loaded. If a Definition references an extension function that is
not registered, the processor MUST signal a definition error (§3.10.1).

> **Example.** A healthcare extension function:
>
> A Definition in a healthcare context might use:
>
> ```
> bmi($weightKg, $heightCm)
> ```
>
> The host application registers `bmi` as an extension function with signature
> `bmi(number, number) → number` and implementation
> `weight / ((height / 100) ^ 2)`. The FEL evaluator treats it identically to
> a built-in function.

A Definition that uses extension functions SHOULD declare them in a top-level
`extensions` array so that processors can detect missing extensions at load
time rather than at evaluation time:

> ```json
> {
>   "extensions": [
>     {
>       "namespace": "https://example.org/healthcare",
>       "functions": [
>         {
>           "name": "bmi",
>           "params": [
>             { "name": "weightKg", "type": "number" },
>             { "name": "heightCm", "type": "number" }
>           ],
>           "returns": "number",
>           "description": "Body Mass Index: weight / (height_m)^2"
>         }
>       ]
>     }
>   ]
> }
> ```

***

***


## 4. Definition Schema

### 4.0 Bottom Line Up Front

<!-- bluf:start file=definition-spec.bluf.md -->
- This section defines the canonical Definition document shape for form structure and behavior declarations.
- A valid definition requires `$formspec`, `url`, `version`, `status`, `title`, and `items`.
- Definition identity is the immutable tuple `(url, version)`; processors must not silently substitute versions.
- This BLUF is governed by `schemas/definition.schema.json`; generated references are the structural contract.
<!-- bluf:end -->

### 4.1 Top-Level Structure

A Formspec Definition is a JSON object. Conforming implementations MUST
recognize the following top-level properties and MUST reject any Definition
that omits a REQUIRED property.

```json
{
  "$formspec": "1.0",
  "url": "https://example.gov/forms/annual-report",
  "version": "2025.1.0",
  "versionAlgorithm": "semver",
  "status": "active",
  "derivedFrom": "https://example.gov/forms/annual-report|2024.1.0",
  "title": "Annual Financial Report",
  "description": "...",
  "items": [],
  "binds": [],
  "shapes": [],
  "instances": {},
  "formPresentation": {
    "pageMode": "single",
    "labelPosition": "top",
    "density": "comfortable"
  },
  "extensions": {}
}
```

The canonical structural contract for Definition top-level properties is
generated from `schemas/definition.schema.json`:

<!-- schema-ref:start id=core-definition-top-level schema=schemas/definition.schema.json pointers=# -->
<!-- generated:schema-ref id=core-definition-top-level -->
| Pointer | Field | Type | Required | Notes | Description |
|---|---|---|---|---|---|
| `#/properties/$formspec` | `$formspec` | <code>string</code> | yes | const: <code>"1.0"</code>; critical | Definition specification version. MUST be '1.0'. |
| `#/properties/binds` | `binds` | <code>array</code> | no | — | — |
| `#/properties/date` | `date` | <code>string</code> | no | — | — |
| `#/properties/derivedFrom` | `derivedFrom` | <code>composite</code> | no | — | Parent definition. Either a URI string or an object with url and optional version. |
| `#/properties/description` | `description` | <code>string</code> | no | — | — |
| `#/properties/extensions` | `extensions` | <code>object</code> | no | — | — |
| `#/properties/formPresentation` | `formPresentation` | <code>object</code> | no | — | Form-wide presentation defaults per §4.1.1. All properties OPTIONAL and advisory. |
| `#/properties/instances` | `instances` | <code>object</code> | no | — | — |
| `#/properties/items` | `items` | <code>array</code> | yes | critical | Root item tree defining fields, groups, and display nodes. |
| `#/properties/migrations` | `migrations` | <code>&#36;ref</code> | no | <code>&#36;ref</code>: <code>#/&#36;defs/Migrations</code> | — |
| `#/properties/name` | `name` | <code>string</code> | no | pattern: <code>^[a-zA-Z][a-zA-Z0-9\-]*&#36;</code> | — |
| `#/properties/nonRelevantBehavior` | `nonRelevantBehavior` | <code>string</code> | no | enum: <code>"remove"</code>, <code>"empty"</code>, <code>"keep"</code>; default: <code>"remove"</code> | — |
| `#/properties/optionSets` | `optionSets` | <code>object</code> | no | — | — |
| `#/properties/screener` | `screener` | <code>&#36;ref</code> | no | <code>&#36;ref</code>: <code>#/&#36;defs/Screener</code> | — |
| `#/properties/shapes` | `shapes` | <code>array</code> | no | — | — |
| `#/properties/status` | `status` | <code>string</code> | yes | enum: <code>"draft"</code>, <code>"active"</code>, <code>"retired"</code>; critical | Definition lifecycle state. |
| `#/properties/title` | `title` | <code>string</code> | yes | critical | Human-readable definition title. |
| `#/properties/url` | `url` | <code>string</code> | yes | critical | Canonical URI identifier of the logical form. |
| `#/properties/variables` | `variables` | <code>array</code> | no | — | — |
| `#/properties/version` | `version` | <code>string</code> | yes | critical | Version identifier of this specific Definition document. |
| `#/properties/versionAlgorithm` | `versionAlgorithm` | <code>string</code> | no | enum: <code>"semver"</code>, <code>"date"</code>, <code>"integer"</code>, <code>"natural"</code>; default: <code>"semver"</code> | — |
<!-- schema-ref:end -->

The generated table above defines required and optional properties. In this
section, prose requirements describe semantics beyond structural constraints.

Implementations MUST preserve unrecognized top-level properties during
round-tripping but MUST NOT assign semantics to them.

#### 4.1.1 Form Presentation

The OPTIONAL `formPresentation` object on the Definition root provides
form-wide presentation defaults. All properties within `formPresentation`
are OPTIONAL and advisory. A conforming processor MAY ignore any or all of
these properties.

| Property | Type | Values | Default | Description |
|---|---|---|---|---|
| `pageMode` | string | `"single"`, `"wizard"`, `"tabs"` | `"single"` | Suggests how top-level groups are paginated. `"wizard"`: sequential steps with navigation controls. `"tabs"`: tabbed sections. `"single"`: all items on one page. Processors that do not support the declared mode SHOULD fall back to `"single"`. |
| `labelPosition` | string | `"top"`, `"start"`, `"hidden"` | `"top"` | Default label placement for all Fields. `"top"`: label above input. `"start"`: label to the leading side (left in LTR, right in RTL). `"hidden"`: label suppressed visually but MUST remain in accessible markup. |
| `density` | string | `"compact"`, `"comfortable"`, `"spacious"` | `"comfortable"` | Spacing density hint. |
| `defaultCurrency` | string | ISO 4217 (e.g. `"USD"`) | (none) | Default currency code applied to all `money` fields that do not declare their own `currency` property. When set, MoneyInput widgets MUST pre-fill the currency to this value and lock it. FEL `money()` calls that omit the currency argument MAY inherit this default. |

Example:

```json
{
  "formPresentation": {
    "pageMode": "wizard",
    "labelPosition": "top",
    "density": "compact"
  }
}
```

### 4.2 Item Schema

An **Item** represents a single node in the form's structural tree. Every Item
MUST declare a `key` and a `type`. The `type` determines which additional
properties are applicable.

```json
{
  "key": "budget_section",
  "type": "group",
  "label": "Budget Information",
  "description": "Enter budget details for each line item",
  "labels": {
    "short": "Budget",
    "pdf": "Section III: Budget Information"
  },
  "children": []
}
```

#### 4.2.1 Common Item Properties

The following properties are recognized on all Item types:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `key` | string | **1..1** (REQUIRED) | Stable identifier for this Item. MUST be unique across the entire Definition (not merely among siblings). MUST match the regular expression `[a-zA-Z][a-zA-Z0-9_]*`. The `key` is used to join Definition Items to Response data nodes and MUST NOT change across versions of the same Definition if the semantic meaning is preserved. |
| `type` | string | **1..1** (REQUIRED) | Item type. MUST be one of: `"group"`, `"field"`, `"display"`. |
| `label` | string | **1..1** (REQUIRED) | Primary human-readable label. Implementations MUST display this label (or a `labels` alternative) when rendering the Item. |
| `description` | string | **0..1** (OPTIONAL) | Human-readable help text or description. Implementations SHOULD make this text available to users on demand (e.g., via tooltip or help icon). |
| `hint` | string | **0..1** (OPTIONAL) | Short instructional text displayed alongside the input (e.g., below the label or as placeholder guidance). Distinct from `description`, which is typically shown on demand. |
| `labels` | object | **0..1** (OPTIONAL) | Alternative display labels keyed by context name. Well-known context names include `"short"`, `"pdf"`, `"csv"`, and `"accessibility"`. Implementations MAY define additional context names. |

#### 4.2.2 Group Items

A **Group** Item is a structural container. It organizes child Items into
logical sections and MAY represent repeatable (one-to-many) data collections.

```json
{
  "key": "line_items",
  "type": "group",
  "label": "Line Items",
  "repeatable": true,
  "minRepeat": 1,
  "maxRepeat": 50,
  "children": []
}
```

Group-specific properties:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `children` | array of Item | **1..1** (REQUIRED) | Ordered list of child Items. MAY be empty. Defines the sub-tree rooted at this Group. |
| `repeatable` | boolean | **0..1** (OPTIONAL) | When `true`, this Group represents a one-to-many collection. Each repetition creates an independent copy of the Group's `children` in the Response data. Default: `false`. |
| `minRepeat` | integer | **0..1** (OPTIONAL) | Minimum number of repetitions. Applicable only when `repeatable` is `true`. MUST be a non-negative integer. Default: `0`. If `minRepeat` is greater than zero, the implementation MUST pre-populate that many empty repetitions when a new Response is created. |
| `maxRepeat` | integer | **0..1** (OPTIONAL) | Maximum number of repetitions. Applicable only when `repeatable` is `true`. MUST be a positive integer, or absent for unbounded. If present, MUST be greater than or equal to `minRepeat`. Implementations MUST prevent the user from adding repetitions beyond this limit. |

A non-repeatable Group (the default) is rendered as a single structural
section. Its `children` appear exactly once in the Response data.

#### 4.2.3 Field Items

A **Field** Item represents a single data-entry point. Each Field produces
exactly one value in the Response data (or one value per repetition if the
Field is inside a repeatable Group).

```json
{
  "key": "amount",
  "type": "field",
  "dataType": "decimal",
  "label": "Award Amount",
  "description": "Total federal award amount",
  "precision": 2,
  "prefix": "$",
  "children": []
}
```

Field-specific properties:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `dataType` | string | **1..1** (REQUIRED) | The value type of this Field. MUST be one of the core data types defined below. |
| `currency` | string | **0..1** (OPTIONAL) | ISO 4217 currency code. Applicable only when `dataType` is `"money"`. Overrides `formPresentation.defaultCurrency` for this field specifically. When neither `currency` nor `defaultCurrency` is set, the currency is captured directly from user input. |
| `precision` | integer | **0..1** (OPTIONAL) | Number of decimal places. Applicable only when `dataType` is `"decimal"`. Implementations SHOULD round or constrain input to this precision. |
| `prefix` | string | **0..1** (OPTIONAL) | Display prefix rendered before the input (e.g., `"$"`). This is a presentation hint only; the prefix MUST NOT appear in the stored data value. |
| `suffix` | string | **0..1** (OPTIONAL) | Display suffix rendered after the input (e.g., `"%"`). This is a presentation hint only; the suffix MUST NOT appear in the stored data value. |
| `options` | array \| string (URI) | **0..1** (OPTIONAL) | Applicable when `dataType` is `"choice"` or `"multiChoice"`. If an array, each element MUST be an object with at least `value` (string, REQUIRED) and `label` (string, REQUIRED) properties. If a string, it MUST be a URI referencing an external option set. |
| `optionSet` | string | **0..1** (OPTIONAL) | Name of a top-level option set declared in `optionSets` (§4.6). Applicable when `dataType` is `"choice"` or `"multiChoice"`. When both `options` and `optionSet` are present, `optionSet` takes precedence. |
| `initialValue` | any \| string | **0..1** (OPTIONAL) | Initial value assigned when a new Response is created or a new repeat instance is added. May be a **literal value** (any JSON value conforming to the field's `dataType`) or an **expression string** prefixed with `=` (e.g., `"=today()"`, `"=@instance('entity').name"`). An expression-based `initialValue` is evaluated **once** at creation time and is NOT re-evaluated when dependencies change (use `calculate` on a Bind for continuous recalculation). Distinct from the Bind `default` property (see §4.3). |
| `semanticType` | string | **0..1** (OPTIONAL) | Domain meaning annotation (e.g., `"us-gov:ein"`, `"ietf:email"`, `"iso:phone-e164"`). Purely metadata — MUST NOT affect validation, calculation, or any behavioral semantics. Supports intelligent widget selection, data classification, and interoperability mapping. Implementations SHOULD use URIs or namespaced identifiers to avoid collisions. |
| `prePopulate` | object | **0..1** (OPTIONAL) | Pre-population declaration. Contains `instance` (string, name of a secondary instance), `path` (string, dot-notation path within the instance), and `editable` (boolean, default `true`; when `false`, the field is locked after pre-population). Syntactic sugar: a processor MUST treat `prePopulate` as equivalent to an `initialValue` expression plus a `readonly` bind. When both `prePopulate` and `initialValue` are present, `prePopulate` takes precedence. |
| `children` | array of Item | **0..1** (OPTIONAL) | Child items. Fields MAY contain children to model dependent sub-questions. When present, the children are contextually tied to the Field's value. |

**Core Data Types:**

| Data Type | JSON Representation | Description |
|---|---|---|
| `"string"` | string | Short-form text. Single line. |
| `"text"` | string | Long-form text. May span multiple lines. |
| `"integer"` | number (integer) | Whole number without fractional component. |
| `"decimal"` | number | Number with optional fractional component. |
| `"boolean"` | boolean | `true` or `false`. |
| `"date"` | string | Calendar date in `YYYY-MM-DD` format ([ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html)). |
| `"dateTime"` | string | Date and time in ISO 8601 format (e.g., `"2025-01-15T10:30:00Z"`). |
| `"time"` | string | Time of day in `HH:MM:SS` format (ISO 8601). |
| `"uri"` | string | A syntactically valid URI per RFC 3986. |
| `"attachment"` | object | A file attachment. The object MUST contain `contentType` (string, MIME type) and `url` or `data` (Base64-encoded content). |
| `"choice"` | string | A single selection from a defined set of options. The stored value is the `value` property of the selected option. |
| `"multiChoice"` | array of string | Multiple selections from a defined set of options. Each element is the `value` property of a selected option. |
| `"money"` | object | A monetary value. The object contains `amount` (string, a decimal number) and `currency` (string, ISO 4217 code). See §3.4.1. |

Implementations MAY support additional data types via the `extensions`
mechanism. Unrecognized data types MUST be treated as `"string"` for storage
and SHOULD produce a warning.

#### 4.2.4 Display Items

A **Display** Item is a read-only, non-data-producing element. It is used for
instructions, headings, and informational text. Display Items do NOT appear in
the Response data.

```json
{
  "key": "instructions",
  "type": "display",
  "label": "Complete all fields below. Required fields are marked with an asterisk."
}
```

Display-specific constraints:

- Display Items MUST NOT have `children`. If `children` is present, it MUST be
  an empty array.
- Display Items MUST NOT have a `dataType`.
- Binds referencing a Display Item's key MAY use only the `relevant` property.
  All other bind properties (`required`, `calculate`, `constraint`, `readonly`)
  are meaningless for Display Items and MUST be ignored.

#### 4.2.5 Presentation Hints

The OPTIONAL `presentation` object MAY appear on any Item (Field, Group,
or Display). All properties within `presentation` are OPTIONAL and advisory.

A conforming processor MUST accept a `presentation` object without error.
A conforming processor MAY ignore any property within `presentation`.
Unknown keys within `presentation` MUST be ignored (forward-compatibility).

Presentation hints MUST NOT affect data capture, validation, calculation,
or submission semantics.

##### 4.2.5.1 Widget Hint

The `widgetHint` property is a string suggesting the preferred UI control.
When present, the value SHOULD be one of the values listed in the tables
below for the Item's type and `dataType`. Custom values MUST be prefixed
with `x-`. A processor receiving an incompatible or unrecognized
`widgetHint` MUST ignore it and use its default widget for that Item type
and `dataType`.

**Group Items:**

| widgetHint | Description |
|---|---|
| `"section"` | Standard section with heading (default). |
| `"card"` | Visually elevated card/panel. |
| `"accordion"` | Expandable/collapsible section. |
| `"tab"` | Tab panel (meaningful when `formPresentation.pageMode` is `"tabs"`). |

**Display Items:**

| widgetHint | Description |
|---|---|
| `"paragraph"` | Body text (default). |
| `"heading"` | Section heading. |
| `"divider"` | Visual separator/rule. |
| `"banner"` | Callout or alert banner. |

**Field Items (by dataType):**

| dataType | Valid widgetHint values | Default |
|---|---|---|
| `string` | `"textInput"`, `"password"`, `"color"` | `"textInput"` |
| `text` | `"textarea"`, `"richText"` | `"textarea"` |
| `integer` | `"numberInput"`, `"stepper"`, `"slider"`, `"rating"` | `"numberInput"` |
| `decimal` | `"numberInput"`, `"slider"` | `"numberInput"` |
| `boolean` | `"checkbox"`, `"toggle"`, `"yesNo"` | `"checkbox"` |
| `date` | `"datePicker"`, `"dateInput"` | `"datePicker"` |
| `dateTime` | `"dateTimePicker"`, `"dateTimeInput"` | `"dateTimePicker"` |
| `time` | `"timePicker"`, `"timeInput"` | `"timePicker"` |
| `uri` | `"textInput"`, `"urlInput"` | `"textInput"` |
| `attachment` | `"fileUpload"`, `"camera"`, `"signature"` | `"fileUpload"` |
| `choice` | `"dropdown"`, `"radio"`, `"autocomplete"`, `"segmented"`, `"likert"` | Renderer decides by option count |
| `multiChoice` | `"checkboxGroup"`, `"multiSelect"`, `"autocomplete"` | `"checkboxGroup"` |
| `money` | `"moneyInput"` | `"moneyInput"` |

When `widgetHint` is absent, unrecognized, or incompatible with the
Item's type or `dataType`, the processor MUST use its default widget for
that `dataType` as listed above.

##### 4.2.5.2 Layout

The `layout` sub-object provides spatial arrangement hints.

**On Group Items:**

| Property | Type | Values | Default | Description |
|---|---|---|---|---|
| `flow` | string | `"stack"`, `"grid"`, `"inline"` | `"stack"` | How children are arranged. `"stack"`: vertical sequence. `"grid"`: multi-column grid. `"inline"`: horizontal flow. |
| `columns` | integer | 1–12 | 1 | Column count when `flow` is `"grid"`. Ignored otherwise. |
| `collapsible` | boolean | | `false` | Whether the group can be collapsed by the user. |
| `collapsedByDefault` | boolean | | `false` | Initial collapsed state. Ignored if `collapsible` is not `true`. |
| `page` | string | non-empty | (none) | Named wizard step or tab. Groups with the same `page` value are rendered together. Only meaningful when `formPresentation.pageMode` is not `"single"`. Groups without `page` attach to the preceding page. |

**On Field and Display Items:**

| Property | Type | Values | Default | Description |
|---|---|---|---|---|
| `colSpan` | integer | 1–12 | 1 | Grid columns this item spans. Only meaningful when the parent Group has `flow: "grid"`. |
| `newRow` | boolean | | `false` | Force this item to start a new grid row. |

Layout properties do NOT cascade from parent Group to child Items. Each
Item's layout is independent.

##### 4.2.5.3 Style Hints

The `styleHints` sub-object provides semantic visual tokens. These are
NOT CSS — renderers map them to their own palette and sizing.

| Property | Type | Values | Default | Description |
|---|---|---|---|---|
| `emphasis` | string | `"primary"`, `"success"`, `"warning"`, `"danger"`, `"muted"` | (none) | Semantic importance or tone. |
| `size` | string | `"compact"`, `"default"`, `"large"` | `"default"` | Relative sizing. |

##### 4.2.5.4 Accessibility

The `accessibility` sub-object provides metadata for assistive technologies.

| Property | Type | Values | Default | Description |
|---|---|---|---|---|
| `role` | string | free string | (none) | Semantic role hint. Well-known values: `"alert"`, `"status"`, `"navigation"`, `"complementary"`, `"region"`. Renderers SHOULD map to platform-equivalent accessibility APIs (ARIA on web, UIAccessibility on iOS, etc.). |
| `description` | string | | (none) | Supplemental accessible description. Distinct from the Item's `hint` and `description` properties (which are visible text); this is for screen-reader-only context. |
| `liveRegion` | string | `"off"`, `"polite"`, `"assertive"` | `"off"` | For dynamic or calculated fields: how aggressively to announce value changes to assistive technology. |

The `role` and `liveRegion` properties are named after ARIA concepts but
this specification does NOT require ARIA. Renderers on non-web platforms
SHOULD map to equivalent accessibility APIs. Renderers on platforms
without accessibility APIs SHOULD ignore these properties.

##### 4.2.5.5 Precedence and Interaction

1. **`formPresentation` provides form-wide defaults.** Item-level
   `presentation` properties override them per-property (not per-object).
2. **Existing Item properties are complementary.** The properties `prefix`,
   `suffix`, `hint`, `description`, `labels`, and `semanticType` retain
   their defined semantics and are NOT superseded by `presentation`.
3. **`widgetHint` takes precedence over `semanticType` for widget selection.**
   When a Field has both `semanticType` (e.g., `"ietf:email"`) and
   `widgetHint` (e.g., `"textInput"`), the renderer SHOULD use the
   `widgetHint` for widget selection. When only `semanticType` is present,
   renderers MAY use it to infer a widget.
4. **`disabledDisplay` on a Bind controls non-relevant rendering.**
   `presentation` properties on the same Item control relevant-state
   rendering. There is no conflict.
5. **No cascade.** `presentation` properties do NOT cascade from parent
   Group to child Items. Each Item's `presentation` is independent.

##### 4.2.5.6 Forward Compatibility

The `presentation` object permits additional properties at its top level
(unknown keys MUST be ignored). The nested sub-objects (`layout`,
`styleHints`, `accessibility`) do NOT permit additional properties, to
catch typographical errors.

This design allows future companion specifications to define additional
keys inside `presentation` without breaking existing validators.

> **Informative note — Presentation tiers:**
>
> The `presentation` object serves as a baseline (Tier 1) for richer
> presentation systems:
>
> - The [Formspec Theme Specification](theme-spec.md) (Tier 2) defines
>   sidecar theme documents that override inline hints with a 3-level
>   selector cascade, design tokens, and responsive page layouts.
> - The [Formspec Component Specification](component-spec.md) (Tier 3)
>   defines component documents for full presentation-tree control,
>   including custom parameterized components and slot bindings.
>
> Companion specifications treat inline `presentation` hints as
> author-specified defaults that may be overridden by higher tiers.

Example — a Field with full presentation hints:

```json
{
  "key": "annual_revenue",
  "type": "field",
  "label": "Annual Revenue",
  "dataType": "money",
  "prefix": "$",
  "presentation": {
    "widgetHint": "moneyInput",
    "layout": {
      "colSpan": 6
    },
    "styleHints": {
      "emphasis": "primary",
      "size": "large"
    },
    "accessibility": {
      "description": "Enter total revenue for the fiscal year",
      "liveRegion": "polite"
    }
  }
}
```

### 4.3 Bind Schema

A **Bind** attaches behavioral expressions to one or more data nodes
identified by a path expression. Binds are the primary mechanism for declaring
dynamic behavior — calculated values, conditional relevance, input constraints,
and requiredness — without embedding logic in the item tree.

```json
{
  "path": "budget_section.line_items[*].amount",
  "required": "true",
  "readonly": "false",
  "relevant": "$budget_section.has_budget = true",
  "calculate": null,
  "constraint": "$ >= 0",
  "default": "0"
}
```

#### 4.3.1 Bind Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `path` | string | **1..1** (REQUIRED) | Path expression identifying the data node(s) this Bind targets. Uses dot notation for nesting and `[*]` for repeatable groups. The path determines the **evaluation context** for all expressions on this Bind. See §4.3.3 for path syntax. |
| `calculate` | string (FEL expression) | **0..1** (OPTIONAL) | Expression whose result replaces the node's value on each recalculation cycle. A node with a `calculate` Bind is implicitly `readonly` unless `readonly` is explicitly set to `"false"`. The expression is evaluated in the context of the node identified by `path`. |
| `relevant` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Relevance predicate. When the expression evaluates to `false`, the targeted node and all its descendants are **non-relevant**. Non-relevant nodes are excluded from submission (see §5.6) and their validation rules MUST NOT execute. |
| `required` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Requiredness predicate. When the expression evaluates to `true`, the targeted node MUST have a non-empty value for the Response to pass validation with respect to this node. A value is "empty" if it is `null`, an empty string `""`, or an empty array `[]`. |
| `readonly` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Read-only predicate. When `true`, the node SHOULD NOT be modified by direct user input. Implementations MUST still allow programmatic modification (e.g., via `calculate`). |
| `constraint` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Additional validity predicate evaluated after type checking and `required` checking. The token `$` within this expression is bound to the current value of the targeted node. The constraint passes when the expression evaluates to `true`. |
| `constraintMessage` | string | **0..1** (OPTIONAL) | Human-readable message to display when `constraint` evaluates to `false`. If absent, implementations SHOULD generate a generic failure message. |
| `default` | any | **0..1** (OPTIONAL) | Value to assign when a previously non-relevant node becomes relevant again. This is distinct from `initialValue` on the Item: `initialValue` is applied once at Response creation; `default` is applied on each relevance transition from non-relevant to relevant. |
| `whitespace` | string | **0..1** (OPTIONAL) | Controls how text values are normalized on input. MUST be one of: `"preserve"` (no modification — **DEFAULT**), `"trim"` (remove leading/trailing whitespace), `"normalize"` (trim then collapse internal runs to a single space), `"remove"` (remove all whitespace — useful for identifiers like phone numbers and EINs). Whitespace transformation is applied **before** the value is stored in the Instance and **before** any constraint or type validation. For `"integer"` or `"decimal"` fields, whitespace is always trimmed regardless of this setting. |
| `excludedValue` | string | **0..1** (OPTIONAL) | Controls what downstream expressions see when this field is non-relevant. MUST be one of: `"preserve"` (expressions see the field's last value — **DEFAULT**) or `"null"` (expressions see `null` when the field is non-relevant). This controls the *in-memory evaluation model*; `nonRelevantBehavior` controls the *serialized output*. |
| `nonRelevantBehavior` | string | **0..1** (OPTIONAL) | Per-path override of the Definition-level `nonRelevantBehavior`. Takes precedence over the Definition default. See §5.6. |
| `disabledDisplay` | string | **0..1** (OPTIONAL) | Presentation hint for non-relevant items. MUST be one of `"hidden"` or `"protected"`. When `"hidden"`, non-relevant items are removed from the visual layout. When `"protected"`, non-relevant items remain visible but are rendered as disabled/greyed-out. Default: `"hidden"`. (Borrowed from FHIR R5 Questionnaire.) |

#### 4.3.2 Inheritance Rules

Bind properties interact across the item hierarchy as follows:

- **`relevant`:** Inherited via logical AND. If any ancestor of a node is
  non-relevant, the node is non-relevant regardless of its own `relevant`
  expression. Implementations MUST enforce this: a child cannot be relevant
  when its parent is not.

- **`readonly`:** Inherited via logical OR. If any ancestor of a node is
  read-only, the node is read-only regardless of its own `readonly`
  expression. Implementations MUST enforce this: a child cannot be editable
  when its parent is read-only.

- **`required`:** NOT inherited. A required parent does not make its children
  required, and a required child does not make its parent required. Each
  `required` declaration stands alone.

- **`calculate`:** NOT inherited. Calculations execute only on the specific
  node targeted by the Bind.

- **`constraint`:** NOT inherited. Constraints are evaluated only against the
  specific node targeted by the Bind.

#### 4.3.3 Path Syntax

Bind paths use dot-separated segments to navigate the item tree. The following
forms are defined:

| Pattern | Meaning | Example |
|---|---|---|
| `fieldKey` | A root-level field | `entity_name` |
| `groupKey.fieldKey` | A field nested inside a group | `budget_section.total_budget` |
| `groupKey[*].fieldKey` | A field inside each repetition of a repeatable group | `line_items[*].amount` |
| `groupKey[@index = N].fieldKey` | A field in a specific repetition (1-based index) | `line_items[@index = 1].amount` |
| `groupA.groupB[*].fieldKey` | Deep nesting across multiple groups | `budget_section.line_items[*].amount` |

The `[*]` wildcard MUST be used when a Bind applies uniformly to all
repetitions of a repeatable group. Index-based addressing (`[@index = N]`)
SHOULD be used only in exceptional circumstances (e.g., binding a calculation
to the first repetition only).

A path MUST resolve to at least one Item `key` in the Definition. If a path
does not resolve, implementations MUST report a Definition error.

**FieldRef vs Resolved Instance Path.** Bind `path` and Shape `target`
properties use **FieldRef** syntax — definition-time addresses with `[*]`
wildcards. ValidationResult `path` properties use **resolved instance paths**
with concrete 1-based indexes (e.g., `line_items[3].amount`). This
unambiguously identifies the specific data node that failed validation.

### 4.4 Instance Schema

An **Instance** is a named secondary data source available to expressions
within the Definition. Instances provide cross-referencing capability — for
example, validating against prior-year data or populating option lists from
external registries.

Instances are declared as properties of the top-level `instances` object. The
property name serves as the instance's identifier.

```json
{
  "instances": {
    "priorYear": {
      "source": "https://api.example.gov/responses/2024/{{entityId}}",
      "static": false,
      "schema": {
        "total_expenditures": "decimal",
        "entity_name": "string"
      }
    },
    "stateCodes": {
      "source": "https://api.example.gov/reference/states",
      "static": true,
      "data": [
        {"code": "AL", "name": "Alabama"},
        {"code": "AK", "name": "Alaska"}
      ]
    }
  }
}
```

#### 4.4.1 Instance Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `source` | string (URI) | **0..1** (OPTIONAL) | URL from which to fetch the instance data at runtime. MAY contain `{{paramName}}` template variables that are resolved by the implementation at runtime. Template variable resolution is implementation-defined. |
| `static` | boolean | **0..1** (OPTIONAL) | If `true`, the instance data does not change during the lifetime of a single form session. Implementations MAY cache static instance data aggressively. Default: `false`. |
| `data` | any | **0..1** (OPTIONAL) | Inline instance data. If both `source` and `data` are present, `data` serves as the fallback when the `source` is unavailable. If only `data` is present, the instance is fully inline. |
| `schema` | object | **0..1** (OPTIONAL) | Type declarations for the instance's fields. Keys are field names; values are data type strings (using the same core data types defined in §4.2.3). Implementations SHOULD use the schema for type coercion and expression type-checking. |
| `readonly` | boolean | **0..1** (OPTIONAL) | If `true`, the instance data MUST NOT be modified by `calculate` Binds or any other mechanism during form execution. Default: `true`. A `calculate` Bind targeting a path within a read-only instance is a definition error. When `false`, the instance acts as a writable scratch-pad for intermediate calculations that should not be submitted. |

At least one of `source` or `data` MUST be present. An Instance with neither
MUST be rejected as a Definition error.

#### 4.4.2 Referencing Instances in Expressions

Instance data is accessed in FEL expressions via the `@instance()` function:

```
@instance('priorYear').total_expenditures
@instance('stateCodes')[code = 'CA'].name
```

The argument to `@instance()` MUST be a string literal matching an instance
name declared in the `instances` object. References to undeclared instances
MUST produce an evaluation error.

When instance data is unavailable (e.g., a network fetch fails and no `data`
fallback exists), `@instance()` MUST return `null`. Expressions SHOULD be
authored defensively to handle `null` instance data.


### 4.5 Variables

**Variables** are named computed values with lexical scoping. They provide a
mechanism for defining intermediate calculations that can be referenced across
multiple Binds, Shapes, and other expressions without repetition. The design
is borrowed from FHIR SDC's `variable` extension.

Variables are declared in the top-level `variables` array.

```json
{
  "variables": [
    {
      "name": "totalBudget",
      "expression": "sum($line_items[*].amount)",
      "scope": "budget_section"
    },
    {
      "name": "priorYearTotal",
      "expression": "@instance('priorYear').total_expenditures",
      "scope": "#"
    }
  ]
}
```

#### 4.5.1 Variable Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `name` | string | **1..1** (REQUIRED) | Variable name. MUST match `[a-zA-Z][a-zA-Z0-9_]*`. Referenced in FEL expressions as `@name` (e.g., `@totalBudget`). MUST be unique within its scope. |
| `expression` | string (FEL expression) | **1..1** (REQUIRED) | The expression that computes this variable's value. Evaluated in the context of the scope item. |
| `scope` | string | **0..1** (OPTIONAL) | The Item `key` this variable is scoped to. The variable is visible to expressions evaluated on that Item and all of its descendants. The special value `"#"` denotes definition-wide scope (visible everywhere). Default: `"#"`. |

#### 4.5.2 Evaluation Semantics

Variables are **continuously recalculated**. Whenever any dependency of a
variable's expression changes, the variable's value MUST be recomputed before
any dependent expressions are evaluated. This is analogous to XForms
`calculate` and FHIR SDC `calculatedExpression`.

Variables MUST NOT form circular dependencies. If a circular dependency is
detected, implementations MUST report a Definition error and MUST NOT attempt
evaluation.

The evaluation order of variables MUST respect the dependency graph:
if variable A depends on variable B, then B MUST be evaluated before A.
Within the same dependency tier, evaluation order is implementation-defined.

For one-time initialization semantics (compute once at Response creation,
never recalculate), use `initialValue` on the Item rather than a variable.


### 4.6 Option Sets

**Option Sets** are named, reusable option lists declared at the top level of
a Definition. They allow multiple `choice` or `multiChoice` fields to
reference the same options without duplication.

Option Sets are declared in the top-level `optionSets` object. The property
name serves as the set's identifier.

```json
{
  "optionSets": {
    "yes_no_na": {
      "options": [
        { "value": "yes", "label": "Yes" },
        { "value": "no", "label": "No" },
        { "value": "na", "label": "Not Applicable" }
      ]
    },
    "agency_list": {
      "source": "https://api.sam.gov/agencies",
      "valueField": "code",
      "labelField": "name"
    }
  }
}
```

#### 4.6.1 OptionSet Properties

An OptionSet is defined by one of:

| Property | Type | Description |
|----------|------|-------------|
| `options` | array of `{ value, label }` | Inline list of permitted values. Each entry MUST have `value` (string, REQUIRED) and `label` (string, REQUIRED). |
| `source` | string (URI) | External endpoint returning an array of options. |
| `valueField` | string | When using `source`, the JSON property name for the option value. Default: `"value"`. |
| `labelField` | string | When using `source`, the JSON property name for the option label. Default: `"label"`. |

A `choice` or `multiChoice` field references a named option set via the
`optionSet` property on the Field item (§4.2.3).


### 4.7 Screener Routing

A **Screener** is a routing mechanism that classifies respondents and directs
them to the appropriate target Definition. Screeners are declared in the
optional `screener` property of a Definition.

```json
{
  "screener": {
    "items": [
      {
        "key": "award_amount",
        "type": "field",
        "dataType": "money",
        "label": "Total federal award amount"
      }
    ],
    "routes": [
      {
        "condition": "moneyAmount($award_amount) < 250000",
        "target": "https://grants.gov/forms/sf-425-short|1.0.0",
        "label": "SF-425 Short Form"
      },
      {
        "condition": "true",
        "target": "https://grants.gov/forms/sf-425|2.1.0",
        "label": "SF-425 Full Form"
      }
    ]
  }
}
```

#### 4.7.1 Screener Properties

| Property | Type | Description |
|----------|------|-------------|
| `screener.items` | array of Item | Fields for routing classification. These use the standard Item schema (§4.2) and their values are available to route conditions. |
| `screener.routes` | array of Route | Ordered routing rules. |
| `screener.routes[].condition` | string (FEL → boolean) | Expression evaluated against screener item values. |
| `screener.routes[].target` | string (URI) | Canonical reference (`url\|version`) to the target FormDefinition. |
| `screener.routes[].label` | string (OPTIONAL) | Human-readable route description. |

Routes are evaluated in declaration order. The first route whose `condition`
evaluates to `true` wins. A route with `"condition": "true"` acts as a
default/fallback.

Screener items are NOT part of the form's instance data — they exist only for
routing purposes. A Definition with a `screener` section MAY also contain
regular `items` and `binds`; in this case the screener acts as a gating step
before the main form.

***

## 5. Validation

### 5.1 Severity Levels

Formspec defines three severity levels for validation results, borrowed from
[SHACL](https://www.w3.org/TR/shacl/) with modified conformance semantics:

| Level | Code | Blocks Submission | Meaning |
|---|---|---|---|
| Error | `"error"` | **Yes** | The data is invalid and MUST be corrected before the Response can be submitted. |
| Warning | `"warning"` | **No** | Advisory. The data is accepted but flagged for attention. |
| Info | `"info"` | **No** | Informational. No user action is required. |

**Conformance Rule (VC-01):** A Response is **valid** if and only if zero
validation results with severity `"error"` exist. Warning-level and
info-level results do NOT affect validity. This differs from SHACL, where any
validation result of any severity indicates non-conformance.

Implementations MUST clearly distinguish severity levels in the user
interface. Error-level results SHOULD be presented with prominent visual
treatment (e.g., red borders, error icons). Warning-level results SHOULD be
visually distinct from errors (e.g., yellow/amber treatment).


### 5.2 Validation Shape Schema

A **Shape** is a named, composable validation rule set. Shapes provide
validation logic that operates at a higher level than individual Bind
constraints — cross-field checks, conditional rules, and composite
validations. The design is borrowed from SHACL's shape concept, adapted for
JSON data.

```json
{
  "shapes": [
    {
      "id": "budget_total_check",
      "target": "budget_section",
      "severity": "error",
      "message": "Line item amounts must sum to the total budget",
      "code": "BUDGET_SUM_MISMATCH",
      "constraint": "sum($line_items[*].amount) = $total_budget"
    }
  ]
}
```

#### 5.2.1 Shape Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `id` | string | **1..1** (REQUIRED) | Unique identifier for this Shape. MUST be unique across all Shapes in the Definition. MUST match `[a-zA-Z][a-zA-Z0-9_\-]*`. |
| `target` | string | **1..1** (REQUIRED) | Path expression identifying the data node(s) this Shape validates. Uses the same path syntax as Binds (§4.3.3). The special value `"#"` targets the entire Response root. |
| `severity` | string | **0..1** (OPTIONAL) | Severity of the validation result produced when this Shape fails. MUST be one of `"error"`, `"warning"`, `"info"`. Default: `"error"`. |
| `constraint` | string (FEL expression → boolean) | **0..1** (OPTIONAL) | Validity predicate. The expression evaluates to `true` when the data is valid and `false` when it is invalid. REQUIRED unless the Shape uses composition operators (`and`, `or`, `not`, `xone`). |
| `message` | string | **1..1** (REQUIRED) | Human-readable failure message displayed when the Shape's constraint evaluates to `false`. MAY contain `{{expression}}` interpolation sequences, where `expression` is a FEL expression evaluated in the Shape's target context. |
| `code` | string | **0..1** (OPTIONAL) | Machine-readable error code. Implementations SHOULD use these codes for programmatic error handling, localization lookups, and API responses. |
| `context` | object | **0..1** (OPTIONAL) | Additional context data included in the ValidationResult when the Shape fails. Keys are context field names; values are FEL expressions evaluated in the Shape's target context at the time of failure. |
| `activeWhen` | string (FEL → boolean) | **0..1** (OPTIONAL) | When present, the shape is evaluated only when this expression evaluates to `true`. When absent or `true`, the shape is always evaluated (subject to non-relevant suppression). When `false`, the shape is skipped entirely — it produces no results of any severity. `activeWhen` is evaluated during the Revalidate phase, before the shape's `constraint`. `activeWhen` is independent of the target's relevance; non-relevant suppression (§5.6 rule 1) takes precedence. |
| `timing` | string | **0..1** (OPTIONAL) | Controls when this shape is evaluated. MUST be one of: `"continuous"` (evaluated whenever any dependency changes — **DEFAULT**), `"submit"` (evaluated only when submission is requested), `"demand"` (evaluated only when explicitly requested by the consuming application). The global validation mode (§5.5) acts as an override: when `"disabled"`, no shapes fire; when `"deferred"`, all shapes are deferred; when `"continuous"`, shapes fire per their individual `timing`. |

#### 5.2.2 Composition Operators

Shapes MAY be composed from other Shapes using the following operators,
borrowed from SHACL's logical constraint components:

| Operator | Type | Semantics |
|---|---|---|
| `and` | array of string | The Shape passes if and only if **all** elements pass. |
| `or` | array of string | The Shape passes if and only if **at least one** element passes. |
| `not` | string | The Shape passes if and only if the element **does NOT** pass. |
| `xone` | array of string | The Shape passes if and only if **exactly one** element passes. |

Each element in a composition operator (and the single string value of `not`)
may be either:

- A shape `id` string referencing another defined shape in the definition's
  `shapes` array — the referenced shape is evaluated and its pass/fail result
  is used; or
- An inline FEL boolean expression string — the expression is evaluated
  directly and its boolean result is used.

A shape `id` is resolved by looking it up in the definition's `shapes` array;
if not found, the element is treated as an inline FEL expression.

When a composition operator is present, the `constraint` property is OPTIONAL.
If both `constraint` and a composition operator are present, they are combined
with implicit AND: the Shape passes only if the `constraint` evaluates to
`true` AND the composition operator's condition is met.

Example — disjunctive composition using shape `id` references:

```json
{
  "id": "contact_info_complete",
  "target": "#",
  "severity": "error",
  "message": "Provide either email or phone number",
  "or": ["has_email", "has_phone"]
}
```

Example — disjunctive composition using inline FEL expressions:

```json
{
  "id": "contact_info_complete",
  "target": "#",
  "severity": "error",
  "message": "Provide either email or phone number",
  "or": ["present($email)", "present($phone)"]
}
```

Inline FEL is simpler and more ergonomic when the condition does not need to
be reused across multiple shapes. Shape `id` references remain useful for
sharing named constraints and for nested composition.

Composition MAY be nested: a referenced Shape MAY itself use composition
operators. Implementations MUST detect circular references among Shapes and
report a Definition error.

### 5.3 Validation Result Schema

Each failed constraint — whether from a Bind `constraint`, a Bind `required`
check, a type check, or a Shape — produces a structured **ValidationResult**.
The schema is borrowed from SHACL's Validation Result vocabulary.

```json
{
  "path": "budget_section.total_budget",
  "severity": "error",
  "message": "Line item amounts must sum to the total budget",
  "code": "BUDGET_SUM_MISMATCH",
  "shapeId": "budget_total_check",
  "value": 50000,
  "context": {
    "expectedTotal": 75000,
    "actualTotal": 50000
  }
}
```

#### 5.3.1 ValidationResult Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `path` | string | **1..1** (REQUIRED) | The resolved instance path of the node that failed validation. For repeat instances, the path MUST include the concrete 1-based index (e.g., `line_items[2].amount`), not the wildcard `[*]`. See §4.3.3 for the FieldRef/resolved-path distinction. |
| `severity` | string | **1..1** (REQUIRED) | The severity level. MUST be one of `"error"`, `"warning"`, `"info"`. |
| `constraintKind` | string | **1..1** (REQUIRED) | The category of constraint that produced this result. MUST be one of: `"required"`, `"type"`, `"cardinality"`, `"constraint"`, `"shape"`, `"external"`. See §2.5.1. |
| `message` | string | **1..1** (REQUIRED) | Human-readable description of the failure. All `{{expression}}` interpolation sequences MUST be resolved before this value is surfaced. |
| `code` | string | **0..1** (RECOMMENDED) | Machine-readable error code. Processors SHOULD include this using the standard built-in codes (§2.5.1) when no specific code is declared. |
| `shapeId` | string | **0..1** (OPTIONAL) | The `id` of the Shape that produced this result, if applicable. MUST be absent for results produced by Bind constraints, type checks, or required checks. |
| `value` | any | **0..1** (OPTIONAL) | The actual value of the node at the time of validation failure. Implementations SHOULD include this for debugging purposes. For attachment fields, the value SHOULD be omitted or replaced with metadata (filename, size) to avoid excessive payload size. |
| `constraint` | string | **0..1** (OPTIONAL) | The constraint expression that failed, as authored in the Definition. Included for debugging and logging. Implementations MUST NOT display raw constraint expressions to end users. |
| `context` | object | **0..1** (OPTIONAL) | Additional context data, propagated from the Shape's `context` property. Keys are context field names; values are the evaluated results of the context expressions. |

Implementations MUST produce ValidationResults for all of the following
condition types:

1. **Type mismatch** — the value does not conform to the Field's `dataType`.
2. **Required violation** — a required node has an empty value.
3. **Bind constraint failure** — a Bind's `constraint` evaluates to `false`.
4. **Shape constraint failure** — a Shape's `constraint` or composition evaluates to invalid.
5. **Repeat cardinality violation** — a repeatable Group has fewer than `minRepeat` or more than `maxRepeat` repetitions.


### 5.4 Validation Report Schema

A **ValidationReport** aggregates all ValidationResults for a given Response
at a point in time.

```json
{
  "valid": true,
  "results": [],
  "counts": {
    "error": 0,
    "warning": 2,
    "info": 1
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### 5.4.1 ValidationReport Properties

The canonical structural contract for ValidationReport properties is generated
from `schemas/validationReport.schema.json`:

<!-- schema-ref:start id=core-validation-report-top-level schema=schemas/validationReport.schema.json pointers=# -->
<!-- generated:schema-ref id=core-validation-report-top-level -->
| Pointer | Field | Type | Required | Notes | Description |
|---|---|---|---|---|---|
| `#/properties/counts` | `counts` | <code>object</code> | yes | critical | Counts of results by severity level. |
| `#/properties/definitionUrl` | `definitionUrl` | <code>string</code> | no | — | The canonical URL of the Definition that was validated against. |
| `#/properties/definitionVersion` | `definitionVersion` | <code>string</code> | no | — | The version of the Definition that was validated against. |
| `#/properties/extensions` | `extensions` | <code>object</code> | no | — | — |
| `#/properties/results` | `results` | <code>array</code> | yes | critical | All validation results regardless of severity. |
| `#/properties/timestamp` | `timestamp` | <code>string</code> | yes | critical | ISO 8601 date-time indicating when validation was performed. |
| `#/properties/valid` | `valid` | <code>boolean</code> | yes | critical | true if and only if the results array contains zero entries with severity 'error'. |
<!-- schema-ref:end -->

Implementations MUST ensure that `valid` is consistent with `counts.error`:
`valid` MUST be `true` when `counts.error` is `0` and `false` otherwise.


### 5.5 Validation Modes

Formspec defines three validation modes controlling when the validation
pipeline executes. Validation mode is a **runtime concern**, not part of the
Definition. Implementations MUST support all three modes and MUST support
switching between modes at runtime without data loss.

| Mode | Code | Behavior |
|---|---|---|
| Continuous | `"continuous"` | Validation executes on every value change. Results are immediately available after each edit. This is the RECOMMENDED default for interactive editing. |
| Deferred | `"deferred"` | Validation executes only on explicit request — for example, on save, submit, section navigation, or programmatic invocation. This mode allows saving incomplete or partially invalid data without user friction. |
| Disabled | `"disabled"` | Validation is skipped entirely. No ValidationResults are produced. This mode is intended for bulk import, data migration, and administrative override scenarios. |

**Critical Rule (VE-05):** Saving data MUST never be blocked by validation.
Regardless of the active validation mode, an implementation MUST allow the
user (or calling system) to persist the current state of the Response data.
Validation results are **advisory** until the point of submission. Only the
submission action requires `valid = true` (i.e., zero error-level results).

Implementations MAY offer a `"continuous-soft"` variant where validation runs
continuously but results are displayed only after the user has interacted with
(blurred) the relevant field. This is a presentation-layer concern and does
not constitute a distinct validation mode.

**Per-Shape Timing Interaction:** Individual Shapes MAY declare a `timing`
property (§5.2.1) that controls when they fire (`"continuous"`, `"submit"`,
`"demand"`). The global validation mode acts as an override:

- When the global mode is `"disabled"`, no shapes fire regardless of `timing`.
- When the global mode is `"deferred"`, all shapes (including `"continuous"`) are deferred.
- When the global mode is `"continuous"` (default), shapes fire per their individual `timing`.


### 5.6 Non-Relevant Field Handling

When a node's `relevant` Bind expression evaluates to `false` (or when any
ancestor is non-relevant per the inheritance rules in §4.3.2), the following
rules apply:

1. **Validation suppression.** Validation rules targeting the non-relevant
   node MUST NOT execute. The node MUST NOT produce any ValidationResults.
   This includes Bind constraints, Shape constraints, required checks, and
   type checks.

2. **Submission behavior.** The node's treatment in the submitted Response
   is governed by the `nonRelevantBehavior` property (Definition-level
   default, overridable per-Bind). The three modes are:
   - `"remove"` (**DEFAULT**) — non-relevant nodes and descendants are
     excluded from the submitted Response.
   - `"empty"` — non-relevant nodes are retained but values set to `null`.
   - `"keep"` — non-relevant nodes are retained with current values.

3. **Required suppression.** A non-relevant node is never required, regardless
   of its `required` Bind. Implementations MUST NOT produce a required-
   violation ValidationResult for a non-relevant node.

4. **Calculation continuation.** A non-relevant node's `calculate` Bind
   MUST continue to evaluate. The computed value exists in the in-memory data
   model and MAY be referenced by other expressions. For user-input fields
   that become non-relevant, the `excludedValue` Bind property (§4.3.1)
   controls what downstream expressions see: `"preserve"` (default, last
   value) or `"null"` (expressions see `null`). Submission behavior is
   governed separately by `nonRelevantBehavior` (rule 2).

5. **Re-relevance.** When a previously non-relevant node becomes relevant
   again, its value is restored. If a `default` is declared on the node's
   Bind, the `default` value MUST be applied. If no `default` is declared,
   the node retains whatever value it had before becoming non-relevant.


### 5.7 External Validation Results

External systems — server-side APIs, third-party validators, business rule
engines — MAY inject validation results into the Formspec validation pipeline.
This enables validation logic that cannot be expressed in FEL (e.g., database
lookups, cross-system consistency checks).

```json
{
  "path": "entity.ein",
  "severity": "error",
  "message": "EIN not found in IRS database",
  "code": "EIN_NOT_FOUND",
  "source": "external",
  "sourceId": "irs-ein-lookup"
}
```

#### 5.7.1 External Result Requirements

External validation results conform to the ValidationResult schema (§5.3)
with the following additional properties and constraints:

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `source` | string | **1..1** (REQUIRED) | MUST be the string `"external"`. This property distinguishes externally injected results from those derived from the Definition's Binds and Shapes. |
| `sourceId` | string | **0..1** (OPTIONAL) | Identifier of the external system that produced this result. Implementations SHOULD include this for audit and debugging purposes. |

#### 5.7.2 Merging Rules

- External results MUST be merged into the ValidationReport alongside
  Definition-derived results.
- External results with severity `"error"` MUST be included in the `valid`
  determination. An external error blocks submission, just as a
  Definition-derived error does.
- External results MUST be included in the `counts` aggregation.
- Implementations MUST support injecting external results at any time during
  the form session — not only at submission.
- When the same `path` + `code` combination is injected multiple times, the
  most recent result SHOULD replace the prior one (idempotent injection).
- Implementations SHOULD provide a mechanism to clear external results (e.g.,
  when the external system confirms the issue has been resolved).

***

## 6. Versioning & Evolution

### 6.1 Identity Model

A Definition is identified by its canonical `url`. The `url` represents the
logical form — it is stable across versions. All versions of the same logical
form share the same `url` and differ only in their `version` property.

The **fully qualified reference** to a specific Definition version uses the
pipe syntax:

```
url|version
```

For example:

```
https://example.gov/forms/annual-report|2025.1.0
```

When a reference omits the `|version` suffix, it refers to the logical form
without specifying a version. The resolution semantics of unversioned
references are context-dependent:

- In a Response's `definition` property, the version MUST be specified.
  Unversioned references are invalid in this context (§6.4).
- In `derivedFrom`, a plain URI string indicates derivation from the
  logical form in general. An object form `{ "url": "...", "version": "..." }`
  pins derivation to a specific version.
- In `$ref` composition, an unversioned reference SHOULD resolve to the
  latest `"active"` version at assembly time.


### 6.2 Version Algorithms

The `versionAlgorithm` property governs interpretation and ordering of
`version` strings. Conforming implementations MUST support all four
algorithms:

| Algorithm | Format | Comparison Semantics |
|---|---|---|
| `"semver"` | `MAJOR.MINOR.PATCH` | Per [Semantic Versioning 2.0.0](https://semver.org/). Pre-release labels and build metadata are supported (e.g., `1.0.0-rc.1`). |
| `"date"` | `YYYY.MM.DD` | Chronological comparison. Each segment is compared numerically: year, then month, then day. |
| `"integer"` | Integer string (e.g., `"42"`) | Numeric comparison. The version string MUST be parseable as a non-negative integer. |
| `"natural"` | Any string | No ordering is defined. Versions can only be compared for equality. Implementations MUST NOT assume any ordering when `versionAlgorithm` is `"natural"`. |

When `versionAlgorithm` is absent, implementations MUST default to
`"semver"`. A version string that does not conform to its declared algorithm
MUST be treated as a Definition error.

#### 6.2.1 Version Semantics for Form Definitions

When `versionAlgorithm` is `"semver"`, the following guidance applies to
form definition changes. This guidance is RECOMMENDED, not REQUIRED.

| Increment | Change Type | Response Compatibility |
|-----------|------------|----------------------|
| **Patch** (2.1.0 → 2.1.1) | Cosmetic only — labels, descriptions, help text. | Existing responses remain fully valid. |
| **Minor** (2.1.0 → 2.2.0) | Additive — new optional fields, relaxed constraints. | Existing responses valid but may lack new fields. |
| **Major** (2.1.0 → 3.0.0) | Breaking — removed/renamed fields, tightened constraints. | Existing responses MAY fail. Migration (§6.7) RECOMMENDED. |


### 6.3 Status Lifecycle

Every Definition MUST declare a `status`. The permitted values and their
lifecycle transitions are:

```
  draft ────▶ active ────▶ retired
    ▲                        │
    └──────────────────────┘
    (new version, not same Definition)
```

- **`"draft"`** — The Definition is under development. It SHOULD NOT be used
  for production data collection. Implementations MAY restrict access to draft
  Definitions to authoring tools and preview environments.

- **`"active"`** — The Definition is in production. New Responses SHOULD
  reference active Definitions. Multiple versions of the same logical form
  MAY be active simultaneously (e.g., during a transition period).

- **`"retired"`** — The Definition is no longer in use for new data
  collection. Existing Responses that reference a retired Definition remain
  valid and MUST still be processable. New Responses SHOULD NOT reference
  retired Definitions. Implementations MAY enforce this as a hard constraint.

**Transition constraints:**

- A Definition MUST NOT transition backward: `active → draft` and
  `retired → active` are forbidden for the *same* Definition version.
- To revise a retired form, authors MUST create a new version with status
  `"draft"` and progress it through the lifecycle independently.
- The transition `draft → active` SHOULD be gated by a validation step
  confirming that the Definition is internally consistent (all paths resolve,
  no circular dependencies, all referenced Shapes exist, etc.).


### 6.4 Response Pinning

A Response MUST reference a specific Definition version using
`definitionUrl` and `definitionVersion` properties:

```json
{
  "definitionUrl": "https://example.gov/forms/annual-report",
  "definitionVersion": "2025.1.0",
  "status": "in-progress",
  "authored": "2025-01-15T14:30:00Z",
  "data": {}
}
```

**Pinning Rule (VP-01):** A Response is always validated against the
Definition version it references, even if a newer version of the same logical
form exists. This guarantees that existing Responses are never retroactively
invalidated by Definition changes.

**Implication:** If a Definition author discovers a flaw in version `2025.1.0`
after Responses have been collected, they MUST publish a new version
(e.g., `2025.1.1`) and migrate Responses explicitly. They MUST NOT alter
version `2025.1.0` in place.

**Immutability Rule (VP-02):** Once a Definition version reaches `"active"`
status, its content MUST NOT be modified. Any change — however minor —
requires a new version. This ensures that the `url|version` pair is a stable,
immutable reference.


### 6.5 Variant Derivation

A Definition MAY declare `derivedFrom` to indicate it is a variant of another
Definition. Common derivation scenarios include:

- **Year-over-year updates** — `annual-report` version `2025.1.0` derived
  from `{ "url": "https://example.gov/forms/annual-report", "version": "2024.1.0" }`.
- **Long form / short form** — `annual-report-short` derived from the
  `annual-report` definition (unversioned URI string).
- **Domain-specific specialization** — `annual-report-healthcare` derived
  from a specific version via the object form.

**Semantics:** `derivedFrom` is **informational only**. It does NOT imply
behavioral inheritance, structural inclusion, or any runtime linkage between
the parent and derived Definitions. The derived Definition is a fully
independent artifact.

`derivedFrom` enables the following tooling capabilities:

1. **Change analysis** — Tooling MAY compare the derived Definition to its
   parent to highlight structural and behavioral differences.
2. **Pre-population** — Implementations MAY use `derivedFrom` to identify
   Responses to the parent Definition that can serve as pre-population sources
   for the derived Definition, mapping data by matching `key` values.
3. **Lineage tracking** — Audit systems MAY use `derivedFrom` to construct
   the full derivation history of a Definition.


### 6.6 Modular Composition

Definitions MAY include items from other Definitions via the `$ref` property
on a Group Item. This enables reuse of common item sets (e.g., demographics,
address blocks, signature sections) across multiple Definitions.

```json
{
  "key": "demographics",
  "type": "group",
  "label": "Demographics",
  "$ref": "https://example.gov/forms/common/demographics|1.0.0",
  "keyPrefix": "demo_"
}
```

#### 6.6.1 Composition Properties

| Property | Type | Cardinality | Description |
|---|---|---|---|
| `$ref` | string (URI) | **0..1** (OPTIONAL) | Canonical reference to another Definition, using the `url\|version` syntax. By default, all root-level Items from the referenced Definition are included as children of this Group. A **fragment** (after `#`) MAY be appended to select a single item by `key`: e.g., `"https://grants.gov/forms/common/demographics|1.0.0#mailing_address"`. When a fragment is present, only the item with the matching key (and its descendants) is included. If the fragment key does not exist in the referenced Definition, assembly MUST fail with an error. |
| `keyPrefix` | string | **0..1** (OPTIONAL) | A string prepended to every `key` imported from the referenced Definition. This prevents key collisions when the same referenced Definition is included multiple times or when its keys conflict with the host Definition. The prefix MUST match `[a-zA-Z][a-zA-Z0-9_]*`. Borrowed from FHIR SDC's `linkIdPrefix` concept. |

#### 6.6.2 Assembly

**Assembly** is the process of resolving all `$ref` inclusions to produce a
self-contained Definition with no external references. Assembly SHOULD be
performed at **publish time** (when a Definition transitions from `"draft"` to
`"active"`). The output of assembly is a fully expanded Definition that can be
processed without access to the referenced Definitions.

Assembly rules:

1. All root-level Items from the referenced Definition MUST be inserted as
   children of the Group that declares the `$ref`.
2. If `keyPrefix` is specified, every `key` in the imported items (including
   deeply nested children) MUST be prefixed. Bind paths, Shape targets, and
   variable scopes referencing those keys MUST be updated accordingly.
3. Binds, Shapes, and Variables from the referenced Definition MUST be
   imported into the host Definition. Their paths and scopes MUST be
   rewritten to reflect the new position in the host item tree and any
   `keyPrefix` transformation.
4. If a key collision exists after prefix application, the assembler MUST
   report an error and abort.
5. `$ref` resolution MUST be recursive: if the referenced Definition itself
   contains `$ref` inclusions, those MUST be resolved as well.
6. Circular `$ref` chains MUST be detected and reported as a Definition
   error.

The assembled Definition SHOULD carry an `assembledFrom` metadata array
listing all referenced Definitions:

```json
{
  "assembledFrom": [
    {
      "url": "https://example.gov/forms/common/demographics",
      "version": "1.0.0",
      "keyPrefix": "demo_"
    }
  ]
}
```

This metadata is informational and MUST NOT affect runtime behavior.


### 6.7 Version Migrations

Definitions MAY declare a `migrations` section describing how to transform
Responses from prior versions into the current version's structure. This
addresses the operational gap when a major version introduces breaking changes.

```json
{
  "migrations": {
    "from": {
      "2.1.0": {
        "description": "Restructured budget section; split other_costs into subcategories",
        "fieldMap": [
          {
            "source": "expenditures.other_costs",
            "target": "expenditures.miscellaneous.total",
            "transform": "preserve"
          },
          {
            "source": "indirect_rate",
            "target": null,
            "transform": "drop"
          }
        ],
        "defaults": {
          "expenditures.miscellaneous.description": "",
          "reporting.frequency": "quarterly"
        }
      }
    }
  }
}
```

#### 6.7.1 Migration Map Structure

| Property | Type | Description |
|----------|------|-------------|
| `from` | object | Keys are source version strings. Values are migration descriptors. |
| `from[version].description` | string | Human-readable description of what changed. |
| `from[version].fieldMap` | array | Ordered list of field mapping rules. |
| `from[version].defaults` | object | Default values for new fields that have no source mapping. Keys are target field paths; values are literal defaults. |

Each field mapping rule contains:

| Property | Type | Description |
|----------|------|-------------|
| `source` | string | Field path in the source version's instance. |
| `target` | string or null | Field path in the target (current) version. `null` means the field is dropped. |
| `transform` | string | One of: `"preserve"` (copy value as-is), `"drop"` (discard), `"expression"` (apply a FEL transform). |
| `expression` | string | When `transform` is `"expression"`, a FEL expression evaluated with `$` bound to the source field's value and `@source` bound to the entire source response data. |

#### 6.7.2 Migration Semantics

- A conformant processor SHOULD support migrating Responses when a migration
  map exists for the Response's pinned version.
- Migration produces a **new** Response pinned to the target version. The
  original Response is preserved unchanged.
- Fields present in the source but absent from `fieldMap` are carried forward
  by path matching (if the path exists in the target version) or dropped
  (if it does not).
- The migrated Response's `status` SHOULD be reset to `"in-progress"` to
  signal that the respondent should review the migrated data.

***


## 7. Concrete Examples

This section provides normative examples demonstrating how Formspec
Definitions, Instances, Responses, and ValidationReports interoperate in
realistic scenarios. Each example is a complete or near-complete JSON
fragment. Processors conforming to this specification MUST be able to
consume and correctly evaluate all examples in this section.

***

### 7.1 Budget Line Items with Calculated Totals

This example demonstrates a repeatable "line items" group where each row
contains a category, description, and dollar amount. A calculated grand
total sums all line-item amounts. An external data source pre-populates
the authorized award amount. A cross-field validation constraint ensures
the calculated total equals the award amount exactly.

**Demonstrated features:**

- Repeatable group with child fields
- Calculated field aggregating across repeat instances (`sum()`)
- Pre-populated field from a secondary instance
- Cross-field validation (sum MUST equal award)
- Definition fragment, Instance data, and Response data

#### 7.1.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/budget-detail",
  "version": "2025-06-01",
  "status": "active",
  "title": "Budget Detail — Line Items",

  "instances": {
    "main": {
      "description": "Primary form data"
    },
    "award": {
      "description": "Pre-populated award data from grants management system",
      "source": "https://api.grants.example.gov/awards/{awardId}",
      "schema": {
        "award_amount": "decimal",
        "award_number": "string",
        "period_start": "date",
        "period_end":   "date"
      },
      "data": {
        "award_amount": 250000.00,
        "award_number": "GR-2025-04817",
        "period_start": "2025-01-01",
        "period_end":   "2025-12-31"
      }
    }
  },

  "items": [
    {
      "key": "award_amount",
      "type": "field",
      "dataType": "decimal",
      "label": "Authorized Award Amount",
      "hint": "This value is pre-populated from the grants management system and cannot be edited.",
      "initialValue": "=@instance('award').award_amount"
    },
    {
      "key": "line_items",
      "type": "group",
      "repeatable": true,
      "label": "Budget Line Items",
      "minRepeat": 1,
      "maxRepeat": 50,
      "children": [
        {
          "key": "category",
          "type": "field",
          "dataType": "string",
          "label": "Budget Category",
          "options": [
            { "value": "personnel",    "label": "Personnel" },
            { "value": "fringe",       "label": "Fringe Benefits" },
            { "value": "travel",       "label": "Travel" },
            { "value": "equipment",    "label": "Equipment" },
            { "value": "supplies",     "label": "Supplies" },
            { "value": "contractual",  "label": "Contractual" },
            { "value": "other",        "label": "Other" },
            { "value": "indirect",     "label": "Indirect Costs" }
          ]
        },
        {
          "key": "description",
          "type": "field",
          "dataType": "string",
          "label": "Description"
        },
        {
          "key": "amount",
          "type": "field",
          "dataType": "decimal",
          "label": "Amount ($)"
        }
      ]
    },
    {
      "key": "total_budget",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Budget",
      "hint": "Auto-calculated. Must equal the authorized award amount."
    }
  ],

  "binds": [
    {
      "path": "award_amount",
      "readonly": "true"
    },
    {
      "path": "line_items[*].category",
      "required": "true"
    },
    {
      "path": "line_items[*].description",
      "required": "true"
    },
    {
      "path": "line_items[*].amount",
      "required": "true",
      "constraint": "$ > 0",
      "constraintMessage": "Amount must be greater than zero."
    },
    {
      "path": "total_budget",
      "calculate": "sum(line_items[*].amount)",
      "readonly": "true"
    }
  ],

  "shapes": [
    {
      "id": "budget-balances",
      "severity": "error",
      "target": "total_budget",
      "constraint": "$total_budget = $award_amount",
      "message": "Total budget (${$total_budget}) must equal the authorized award amount (${$award_amount})."
    }
  ]
}
```

#### 7.1.2 Instance Data (In Progress)

The following Instance represents a partially completed form with three
line items:

```json
{
  "definitionUrl": "https://grants.example.gov/forms/budget-detail",
  "definitionVersion": "2025-06-01",
  "status": "in-progress",
  "data": {
    "award_amount": 250000.00,
    "line_items": [
      {
        "category": "personnel",
        "description": "Senior researcher — 0.5 FTE",
        "amount": 95000.00
      },
      {
        "category": "fringe",
        "description": "Benefits at 32% of personnel",
        "amount": 30400.00
      },
      {
        "category": "travel",
        "description": "Conference attendance — 2 domestic trips",
        "amount": 4600.00
      }
    ],
    "total_budget": 130000.00
  }
}
```

Note: `total_budget` is 130,000.00 (the calculated sum) while
`award_amount` is 250,000.00. The `budget-balances` shape will produce
an error-severity result because the two values are not equal. The user
must add additional line items totaling $120,000.00 to reach balance.

#### 7.1.3 Response Data (Final Submission)

```json
{
  "definitionUrl": "https://grants.example.gov/forms/budget-detail",
  "definitionVersion": "2025-06-01",
  "status": "completed",
  "data": {
    "award_amount": 250000.00,
    "line_items": [
      { "category": "personnel",   "description": "Senior researcher — 0.5 FTE",          "amount": 95000.00 },
      { "category": "fringe",      "description": "Benefits at 32% of personnel",          "amount": 30400.00 },
      { "category": "travel",      "description": "Conference attendance — 2 domestic trips","amount": 4600.00 },
      { "category": "equipment",   "description": "Lab workstation and peripherals",       "amount": 12000.00 },
      { "category": "supplies",    "description": "Reagents and consumables",               "amount": 28000.00 },
      { "category": "contractual", "description": "Statistical analysis subcontract",       "amount": 45000.00 },
      { "category": "indirect",    "description": "F&A at 52% of MTDC",                    "amount": 35000.00 }
    ],
    "total_budget": 250000.00
  }
}
```

The `total_budget` now equals `award_amount`. The `budget-balances`
shape produces no results, and the Response is valid.

***
### 7.2 Conditional Section with Dependent Validation

This example demonstrates a conditional "subcontracting" section that
appears only when the user indicates subcontracting occurred. When the
section is not relevant, its fields are excluded from the Response and
their validation constraints are suspended.

**Demonstrated features:**

- Boolean field controlling group visibility
- `relevant` bind on a group
- `required` binds that apply only when the parent group is relevant
- Non-relevant exclusion from Response data

#### 7.2.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Annual Progress Report — Subcontracting Section",

  "items": [
    {
      "key": "has_subcontracts",
      "type": "field",
      "dataType": "boolean",
      "label": "Did you subcontract any work during this reporting period?"
    },
    {
      "key": "subcontracting",
      "type": "group",
      "label": "Subcontracting Details",
      "repeatable": true,
      "minRepeat": 1,
      "maxRepeat": 20,
      "children": [
        {
          "key": "subcontractor_name",
          "type": "field",
          "dataType": "string",
          "label": "Subcontractor Name"
        },
        {
          "key": "subcontractor_ein",
          "type": "field",
          "dataType": "string",
          "label": "Subcontractor EIN"
        },
        {
          "key": "subcontract_amount",
          "type": "field",
          "dataType": "decimal",
          "label": "Subcontract Amount ($)"
        },
        {
          "key": "work_description",
          "type": "field",
          "dataType": "string",
          "label": "Description of Subcontracted Work"
        }
      ]
    },
    {
      "key": "subcontract_total",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Subcontracted Amount"
    }
  ],

  "binds": [
    {
      "path": "has_subcontracts",
      "required": "true"
    },
    {
      "path": "subcontracting",
      "relevant": "$has_subcontracts = true"
    },
    {
      "path": "subcontracting[*].subcontractor_name",
      "required": "true"
    },
    {
      "path": "subcontracting[*].subcontractor_ein",
      "required": "true",
      "constraint": "matches($, '^[0-9]{2}-[0-9]{7}$')",
      "constraintMessage": "EIN must be in XX-XXXXXXX format."
    },
    {
      "path": "subcontracting[*].subcontract_amount",
      "required": "true",
      "constraint": "$ > 0",
      "constraintMessage": "Amount must be greater than zero."
    },
    {
      "path": "subcontracting[*].work_description",
      "required": "true"
    },
    {
      "path": "subcontract_total",
      "relevant": "$has_subcontracts = true",
      "calculate": "sum(subcontracting[*].subcontract_amount)",
      "readonly": "true"
    }
  ]
}
```

#### 7.2.2 Response — No Subcontracting

When the user selects "No", the `subcontracting` group and
`subcontract_total` field are non-relevant. Conforming processors MUST
exclude non-relevant fields from the Response `data` object:

```json
{
  "definitionUrl": "https://grants.example.gov/forms/progress-report",
  "definitionVersion": "2025-06-01",
  "status": "completed",
  "data": {
    "has_subcontracts": false
  }
}
```

Note the absence of `subcontracting` and `subcontract_total`. These
fields are not set to `null` or empty — they are omitted entirely.
Validation constraints on `subcontractor_name`, `subcontractor_ein`,
and `subcontract_amount` (all marked `required`) are NOT evaluated
because their nearest relevant ancestor (`subcontracting`) is
non-relevant.

#### 7.2.3 Response — With Subcontracting

```json
{
  "definitionUrl": "https://grants.example.gov/forms/progress-report",
  "definitionVersion": "2025-06-01",
  "status": "completed",
  "data": {
    "has_subcontracts": true,
    "subcontracting": [
      {
        "subcontractor_name": "Acme Analytics, LLC",
        "subcontractor_ein": "84-1234567",
        "subcontract_amount": 45000.00,
        "work_description": "Statistical modeling and data analysis for Phase II trials."
      },
      {
        "subcontractor_name": "BioSample Services, Inc.",
        "subcontractor_ein": "91-7654321",
        "subcontract_amount": 18500.00,
        "work_description": "Sample preparation and cold-chain logistics."
      }
    ],
    "subcontract_total": 63500.00
  }
}
```

All `required` constraints on the child fields are now active and
evaluated. The `subcontract_total` is calculated as the sum of all
`subcontract_amount` values.

***

### 7.3 Repeatable Rows with Per-Row Calculations and Cross-Row Total

This example demonstrates an "expenditure categories" repeatable where
each row contains three cost fields and a per-row calculated total. A
grand total aggregates all row totals. A percentage-based validation
raises a warning if any single cost category exceeds 50% of its row
total.

**Demonstrated features:**

- Per-row calculated field within a repeatable group
- Cross-row aggregate calculation
- Per-row percentage-based validation (warning severity)
- Bind paths using `[*]` notation for repeat context

#### 7.3.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/expenditure-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Quarterly Expenditure Report — By Category",

  "items": [
    {
      "key": "categories",
      "type": "group",
      "repeatable": true,
      "label": "Expenditure Categories",
      "minRepeat": 1,
      "maxRepeat": 25,
      "children": [
        {
          "key": "category_name",
          "type": "field",
          "dataType": "string",
          "label": "Category Name"
        },
        {
          "key": "personnel_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Personnel Costs ($)"
        },
        {
          "key": "travel_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Travel Costs ($)"
        },
        {
          "key": "supply_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Supply Costs ($)"
        },
        {
          "key": "row_total",
          "type": "field",
          "dataType": "decimal",
          "label": "Row Total ($)"
        }
      ]
    },
    {
      "key": "grand_total",
      "type": "field",
      "dataType": "decimal",
      "label": "Grand Total ($)"
    }
  ],

  "binds": [
    {
      "path": "categories[*].category_name",
      "required": "true"
    },
    {
      "path": "categories[*].personnel_costs",
      "required": "true",
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].travel_costs",
      "required": "true",
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].supply_costs",
      "required": "true",
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].row_total",
      "calculate": "$personnel_costs + $travel_costs + $supply_costs",
      "readonly": "true"
    },
    {
      "path": "grand_total",
      "calculate": "sum(categories[*].row_total)",
      "readonly": "true"
    }
  ],

  "shapes": [
    {
      "id": "personnel-concentration-warning",
      "severity": "warning",
      "target": "categories[*].personnel_costs",
      "constraint": "$row_total = 0 or ($personnel_costs div $row_total) <= 0.50",
      "message": "Personnel costs (${$personnel_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    },
    {
      "id": "travel-concentration-warning",
      "severity": "warning",
      "target": "categories[*].travel_costs",
      "constraint": "$row_total = 0 or ($travel_costs div $row_total) <= 0.50",
      "message": "Travel costs (${$travel_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    },
    {
      "id": "supply-concentration-warning",
      "severity": "warning",
      "target": "categories[*].supply_costs",
      "constraint": "$row_total = 0 or ($supply_costs div $row_total) <= 0.50",
      "message": "Supply costs (${$supply_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    }
  ]
}
```

**Commentary on per-row expression context:** The `calculate` expression
on `categories[*].row_total` uses unqualified field references
(`$personnel_costs`, `$travel_costs`, `$supply_costs`). Within a bind
that targets `categories[*]`, unqualified references resolve against the
current repeat instance. A processor MUST evaluate this expression once
per repeat instance, scoped to that instance's data. The expression
`$personnel_costs` within the third repeat instance refers to
`categories[2].personnel_costs`, not to a global field.

The `grand_total` bind uses `sum(categories[*].row_total)`, which
aggregates across ALL repeat instances. The `[*]` within a `sum()`,
`count()`, or other aggregate function denotes collection-level
aggregation. Processors MUST distinguish between:

- **Per-instance context:** `categories[*].row_total` as a bind path —
  the expression evaluates once per row.
- **Aggregate context:** `sum(categories[*].row_total)` as an expression —
  the function receives all values and returns a single scalar.

#### 7.3.2 Instance Data with Warning

```json
{
  "definitionUrl": "https://grants.example.gov/forms/expenditure-report",
  "definitionVersion": "2025-06-01",
  "status": "in-progress",
  "data": {
    "categories": [
      {
        "category_name": "Core Research",
        "personnel_costs": 80000.00,
        "travel_costs": 5000.00,
        "supply_costs": 15000.00,
        "row_total": 100000.00
      },
      {
        "category_name": "Outreach",
        "personnel_costs": 3000.00,
        "travel_costs": 22000.00,
        "supply_costs": 5000.00,
        "row_total": 30000.00
      }
    ],
    "grand_total": 130000.00
  }
}
```

#### 7.3.3 ValidationReport

The first row has `personnel_costs` at 80% of `row_total` (80,000 /
100,000). The second row has `travel_costs` at 73% of `row_total`
(22,000 / 30,000). Both exceed the 50% threshold:

```json
{
  "definitionUrl": "https://grants.example.gov/forms/expenditure-report",
  "definitionVersion": "2025-06-01",
  "valid": true,
  "results": [
    {
      "path": "categories[0].personnel_costs",
      "severity": "warning",
      "shapeId": "personnel-concentration-warning",
      "message": "Personnel costs ($80,000.00) exceed 50% of the row total ($100,000.00). Verify this allocation is correct.",
      "value": 80000.00,
      "context": {
        "row_total": 100000.00,
        "percentage": 0.80
      }
    },
    {
      "path": "categories[1].travel_costs",
      "severity": "warning",
      "shapeId": "travel-concentration-warning",
      "message": "Travel costs ($22,000.00) exceed 50% of the row total ($30,000.00). Verify this allocation is correct.",
      "value": 22000.00,
      "context": {
        "row_total": 30000.00,
        "percentage": 0.73
      }
    }
  ]
}
```

`valid` is `true` because both results have warning severity. Only
error-severity results cause `valid` to be `false`. Advisory warnings
SHOULD be presented to the user but MUST NOT block submission.

***

### 7.4 Year-over-Year Comparison Warning

This example demonstrates a field whose current-year value is compared
against a prior-year value loaded from a secondary instance. If the
change exceeds 25% in either direction, a warning is raised with
interpolated values in the message.

**Demonstrated features:**

- Secondary instance declaration with external source
- Cross-instance FEL expression
- Warning-severity shape
- Message interpolation with computed values

#### 7.4.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/annual-budget",
  "version": "2025-06-01",
  "status": "active",
  "title": "Annual Budget — Year-over-Year Review",

  "instances": {
    "main": {
      "description": "Current-year budget submission"
    },
    "prior_year": {
      "description": "Prior-year actuals from financial system",
      "source": "https://api.grants.example.gov/actuals/{awardId}/2024",
      "schema": {
        "total_expenditure":  "decimal",
        "personnel_total":    "decimal",
        "travel_total":       "decimal",
        "equipment_total":    "decimal",
        "reporting_year":     "integer"
      },
      "data": {
        "total_expenditure": 200000.00,
        "personnel_total":   120000.00,
        "travel_total":       15000.00,
        "equipment_total":    25000.00,
        "reporting_year":     2024
      }
    }
  },

  "variables": [
    {
      "name": "prior_total",
      "expression": "@instance('prior_year').total_expenditure",
      "scope": "global"
    },
    {
      "name": "yoy_change_pct",
      "expression": "if($prior_total != 0, abs($total_expenditure - $prior_total) div $prior_total, 0)",
      "scope": "global"
    }
  ],

  "items": [
    {
      "key": "total_expenditure",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Proposed Expenditure for Current Year ($)"
    },
    {
      "key": "budget_justification",
      "type": "field",
      "dataType": "string",
      "label": "Budget Justification Narrative"
    }
  ],

  "binds": [
    {
      "path": "total_expenditure",
      "required": "true",
      "constraint": "$ > 0",
      "constraintMessage": "Total expenditure must be greater than zero."
    },
    {
      "path": "budget_justification",
      "required": "true"
    }
  ],

  "shapes": [
    {
      "id": "yoy-variance-warning",
      "severity": "warning",
      "target": "total_expenditure",
      "constraint": "$yoy_change_pct <= 0.25",
      "message": "The proposed expenditure (${$total_expenditure}) differs from the prior year actual (${$prior_total}) by ${round($yoy_change_pct * 100)}%. Changes exceeding 25% require additional justification in the narrative."
    }
  ]
}
```

#### 7.4.2 Instance Data Triggering the Warning

```json
{
  "definitionUrl": "https://grants.example.gov/forms/annual-budget",
  "definitionVersion": "2025-06-01",
  "status": "in-progress",
  "data": {
    "total_expenditure": 280000.00,
    "budget_justification": ""
  }
}
```

The prior-year total is $200,000.00. The proposed amount is $280,000.00.
The year-over-year change is 40%, exceeding the 25% threshold.

#### 7.4.3 ValidationReport

```json
{
  "definitionUrl": "https://grants.example.gov/forms/annual-budget",
  "definitionVersion": "2025-06-01",
  "valid": false,
  "results": [
    {
      "path": "total_expenditure",
      "severity": "warning",
      "shapeId": "yoy-variance-warning",
      "message": "The proposed expenditure ($280,000.00) differs from the prior year actual ($200,000.00) by 40%. Changes exceeding 25% require additional justification in the narrative.",
      "value": 280000.00,
      "context": {
        "prior_year_value": 200000.00,
        "change_percentage": 40
      }
    },
    {
      "path": "budget_justification",
      "severity": "error",
      "code": "required",
      "message": "This field is required.",
      "value": ""
    }
  ]
}
```

`valid` is `false` because of the error-severity result on
`budget_justification` (empty string fails `required`). The warning on
`total_expenditure` does not by itself cause invalidity. Once the user
provides a justification narrative, `valid` will become `true` even
though the year-over-year warning persists.

***

### 7.5 Screener Routing to Form Variants

This example demonstrates a short screener form that asks classification
questions and routes the user to one of two form variants based on the
answers. The routing decision is expressed as a calculated field whose
value is a definition URL.

**Demonstrated features:**

- Choice fields driving routing logic
- A calculated routing field producing a definition URL
- `derivedFrom` relationships between screener and variant forms
- Dynamic form selection based on user input

#### 7.5.1 Screener Definition

```json
{
  "url": "https://grants.example.gov/forms/progress-screener",
  "version": "2025-06-01",
  "status": "active",
  "title": "Progress Report — Screener",

  "items": [
    {
      "key": "award_type",
      "type": "field",
      "dataType": "string",
      "label": "What type of award is this?",
      "options": [
        { "value": "grant",             "label": "Grant" },
        { "value": "cooperative_agreement", "label": "Cooperative Agreement" },
        { "value": "contract",          "label": "Contract" }
      ]
    },
    {
      "key": "reporting_period_type",
      "type": "field",
      "dataType": "string",
      "label": "Is this an interim or final report?",
      "options": [
        { "value": "interim", "label": "Interim (Quarterly / Semi-annual)" },
        { "value": "final",   "label": "Final" }
      ]
    },
    {
      "key": "total_award_value",
      "type": "field",
      "dataType": "decimal",
      "label": "Total award value ($)"
    },
    {
      "key": "has_subawards",
      "type": "field",
      "dataType": "boolean",
      "label": "Does this award include any subawards?"
    },
    {
      "key": "routed_form",
      "type": "field",
      "dataType": "string",
      "label": "Assigned Report Form",
      "hint": "Determined automatically based on your answers above."
    }
  ],

  "binds": [
    { "path": "award_type",            "required": "true" },
    { "path": "reporting_period_type",  "required": "true" },
    { "path": "total_award_value",      "required": "true", "constraint": "$ > 0" },
    { "path": "has_subawards",          "required": "true" },
    {
      "path": "routed_form",
      "readonly": "true",
      "calculate": "if($reporting_period_type = 'final' or $total_award_value >= 500000 or $has_subawards = true, 'https://grants.example.gov/forms/full-progress-report|2025-06-01', 'https://grants.example.gov/forms/abbreviated-progress-report|2025-06-01')"
    }
  ]
}
```

**Routing logic:** The user is routed to the **full report** if ANY of
the following are true:

1. The reporting period is "final".
2. The total award value is $500,000 or more.
3. The award includes subawards.

Otherwise, the user is routed to the **abbreviated report**.

#### 7.5.2 Variant Definitions (Headers Only)

The full and abbreviated reports declare their lineage via `derivedFrom`:

```json
{
  "url": "https://grants.example.gov/forms/full-progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Full Progress Report",
  "derivedFrom": "https://grants.example.gov/forms/progress-screener|2025-06-01"
}
```

```json
{
  "url": "https://grants.example.gov/forms/abbreviated-progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Abbreviated Progress Report",
  "derivedFrom": "https://grants.example.gov/forms/progress-screener|2025-06-01"
}
```

The `derivedFrom` property is informational. Processors SHOULD use it to
assist in traceability and auditing. Processors MUST NOT require
`derivedFrom` to be resolvable at runtime.

#### 7.5.3 Screener Response and Routing Result

```json
{
  "definitionUrl": "https://grants.example.gov/forms/progress-screener",
  "definitionVersion": "2025-06-01",
  "status": "completed",
  "data": {
    "award_type": "grant",
    "reporting_period_type": "interim",
    "total_award_value": 175000.00,
    "has_subawards": false,
    "routed_form": "https://grants.example.gov/forms/abbreviated-progress-report|2025-06-01"
  }
}
```

The consuming application reads `routed_form` and navigates the user to
the abbreviated report definition. The screener Response SHOULD be
retained for audit purposes.

***

### 7.6 External Validation Failure

This example demonstrates a field that passes local (client-side)
validation but fails external (server-side) validation. The field is an
Employer Identification Number (EIN) that conforms to the required
format pattern but references a non-existent entity in an external
database.

**Demonstrated features:**

- Field with pattern constraint (local format validation)
- External validation result injected with `source: "external"`
- Both local and external results in the same ValidationReport
- Report is invalid due to external error

#### 7.6.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/entity-registration",
  "version": "2025-06-01",
  "status": "active",
  "title": "Entity Registration — Identification",

  "items": [
    {
      "key": "organization_name",
      "type": "field",
      "dataType": "string",
      "label": "Organization Legal Name"
    },
    {
      "key": "ein",
      "type": "field",
      "dataType": "string",
      "label": "Employer Identification Number (EIN)",
      "hint": "Nine-digit number assigned by the IRS, in XX-XXXXXXX format."
    },
    {
      "key": "duns_number",
      "type": "field",
      "dataType": "string",
      "label": "UEI / DUNS Number"
    }
  ],

  "binds": [
    {
      "path": "organization_name",
      "required": "true"
    },
    {
      "path": "ein",
      "required": "true",
      "constraint": "matches($, '^[0-9]{2}-[0-9]{7}$')",
      "constraintMessage": "EIN must be in XX-XXXXXXX format (e.g., 12-3456789)."
    },
    {
      "path": "duns_number",
      "required": "true",
      "constraint": "matches($, '^[A-Z0-9]{12}$')",
      "constraintMessage": "UEI must be exactly 12 alphanumeric characters."
    }
  ],

  "extensions": {
    "x-irs-validation": {
      "fields": ["ein"],
      "endpoint": "https://api.irs.gov/validate-ein",
      "timeout": 5000,
      "description": "Validates EIN existence against IRS database. Invoked server-side after local validation passes."
    }
  }
}
```

#### 7.6.2 Instance Data

```json
{
  "definitionUrl": "https://grants.example.gov/forms/entity-registration",
  "definitionVersion": "2025-06-01",
  "status": "in-progress",
  "data": {
    "organization_name": "Northwind Research Foundation",
    "ein": "99-0000001",
    "duns_number": "N8K4Q2R7J1M3"
  }
}
```

The EIN `99-0000001` matches the pattern `^[0-9]{2}-[0-9]{7}$`, so
local validation passes. However, the IRS database lookup determines
that this EIN does not correspond to any registered entity.

#### 7.6.3 ValidationReport — Combined Local and External Results

A processor that performs both local and external validation MUST
produce a single ValidationReport containing results from both sources:

```json
{
  "definitionUrl": "https://grants.example.gov/forms/entity-registration",
  "definitionVersion": "2025-06-01",
  "valid": false,
  "results": [
    {
      "path": "ein",
      "severity": "error",
      "code": "external-validation-failed",
      "message": "EIN 99-0000001 was not found in the IRS database. Verify the number and try again.",
      "value": "99-0000001",
      "source": "external",
      "sourceId": "x-irs-validation",
      "context": {
        "endpoint": "https://api.irs.gov/validate-ein",
        "response_code": 404,
        "checked_at": "2025-06-15T14:32:07Z"
      }
    }
  ]
}
```

**Key observations:**

1. **Local validation passed:** There is no result for the `constraint`
   bind on `ein` because the pattern check succeeded. Absence of a
   result for a constraint means the constraint is satisfied.

2. **External validation failed:** The result has `source: "external"`
   and `sourceId: "x-irs-validation"`, identifying it as originating
   from an external system rather than from bind or shape evaluation.

3. **Report is invalid:** `valid` is `false` because the external
   result has error severity. External results participate in the
   conformance determination identically to local results: error
   severity → invalid; warning or info severity → does not affect
   validity.

4. **Context metadata:** The `context` object carries diagnostic
   information from the external system. Processors SHOULD include
   sufficient context for debugging but MUST NOT include sensitive
   credentials or internal system details.

Processors MUST support external validation results being injected into
a ValidationReport after initial local validation. The combined report
MUST re-evaluate the `valid` flag considering all results regardless of
source.

***

## 8. Extension Points

Formspec is designed to be extended without modifying the core
specification. This section defines the normative requirements for
extension mechanisms. Implementors MAY use these mechanisms to support
domain-specific functionality while preserving interoperability with
conforming processors.

All extension identifiers (type names, function names, property keys,
constraint names, namespace keys) MUST be prefixed with `x-` to
guarantee no collision with identifiers introduced in future versions of
this specification. A processor encountering a non-prefixed identifier
it does not recognize MUST treat it as a specification error.

***

### 8.1 Custom Data Types, Functions, and Constraints

Custom data types, functions, and validation constraint components are
declared and published through the **Extension Registry** system (see the
Extension Registry specification). The registry provides structured
metadata including parameter signatures, base types, compatibility
information, and versioning for each extension.

Definitions that use custom extensions SHOULD reference them in the
top-level `extensions` object for discoverability. The following
general requirements apply:

1. All custom identifiers MUST be prefixed with `x-`.

2. Processors that encounter a custom data type they do not support
   MUST fall back to the declared `baseType` and SHOULD log an
   informational notice.

3. Processors that encounter a custom function or constraint they do
   not support MUST raise a clear, actionable error. Processors MUST
   NOT silently skip unsupported functions or constraints.

4. Custom functions MUST be pure (side-effect-free) with respect to
   Instance data.

5. Custom constraints MUST NOT produce false-positive validation
   results when unsupported — processors MUST fail rather than skip.

***

### 8.4 Extension Properties

Any object in a Formspec Definition, Instance, Response, or
ValidationReport MAY carry an `extensions` property containing
implementor-specific data.

```json
{
  "key": "ein",
  "type": "field",
  "dataType": "string",
  "label": "Employer Identification Number",
  "extensions": {
    "x-irs-validation": {
      "endpoint": "https://api.irs.gov/validate-ein",
      "timeout": 5000,
      "retryPolicy": {
        "maxAttempts": 3,
        "backoffMs": 1000
      }
    },
    "x-analytics": {
      "trackFocus": true,
      "trackDuration": true
    }
  }
}
```

The following requirements apply to extension properties:

1. All keys within an `extensions` object MUST be prefixed with `x-`.

2. Processors MUST ignore extension properties they do not understand.
   Unrecognized extension properties MUST NOT cause a processing error,
   warning, or behavioral change.

3. Extension properties MUST NOT alter the core semantics defined by
   this specification. Specifically:
   - An extension property MUST NOT change whether a field is
     required, relevant, readonly, or calculated.
   - An extension property MUST NOT modify the evaluation of FEL
     expressions.
   - An extension property MUST NOT affect the `valid` flag of a
     ValidationReport through core validation logic. (An extension
     MAY contribute external validation results per §7.6, but these
     are external results, not core-semantic alterations.)

4. Extension properties SHOULD be self-documenting. Each top-level
   extension key SHOULD correspond to a published extension
   specification or at minimum include a `description` property.

5. When serializing a Formspec document, processors MUST preserve
   extension properties they do not understand. A round-trip through
   a conforming processor MUST NOT strip unrecognized extensions.

***

### 8.5 Extension Namespaces

Organizations publishing multiple related extensions SHOULD use a
namespace convention to group them under a single `x-{namespace}` key.

```json
{
  "extensions": {
    "x-gov-grants": {
      "version": "2.0",
      "cfda-number": true,
      "sam-registration-required": true,
      "single-audit-threshold": 750000
    },
    "x-org-branding": {
      "version": "1.3",
      "theme": "agency-dark",
      "logoUrl": "https://example.gov/assets/logo.svg"
    }
  }
}
```

The following requirements apply to extension namespaces:

1. A namespace key MUST follow the pattern `x-{organization}-{domain}`
   or `x-{domain}` where `{organization}` and `{domain}` consist of
   lowercase ASCII letters and hyphens only.

2. Namespace objects SHOULD include a `version` property to support
   evolution of the extension independently of the Formspec
   specification version.

3. Organizations SHOULD publish a machine-readable schema for their
   extension namespace to enable validation by processors that
   support the extension.

4. Processors MUST treat the entire namespace object as opaque if
   they do not support the namespace. The requirements of §8.4
   (ignore, preserve, do not alter core semantics) apply to namespace
   objects in their entirety.

***

## 9. Lineage — What Was Borrowed and Why

Formspec is not designed in a vacuum. This section documents the
standards, specifications, and systems from which Formspec draws its
concepts, and explains the adaptations made for the JSON-native,
form-validation context. This section is informative, not normative.

Transparency of lineage serves three purposes:

1. **Intellectual honesty.** Credit where credit is due.
2. **Onboarding.** Implementors familiar with the source standards can
   map their existing knowledge to Formspec concepts.
3. **Design rationale.** Where Formspec diverges from a source, the
   reason is documented to prevent future re-litigation.

***

### 9.1 From W3C XForms (2003)

XForms is the most significant ancestor of Formspec. The core
architectural decisions — separation of model from view, reactive
dependency graphs, non-relevant pruning, and the four-phase processing
cycle — all originate in XForms.

| Concept | XForms Origin | Formspec Adaptation |
|---------|--------------|---------------------|
| Model Item Properties | `<bind>` elements with `calculate`, `constraint`, `relevant`, `required`, `readonly` attributes | Bind objects with identical property names; FEL expressions replace XPath |
| Reactive dependency graph | Topological sort of XPath dependencies with pertinent subgraph recalculation | Identical algorithm, applied to FEL field references parsed from `$fieldKey` tokens |
| Non-relevant exclusion | `relevant="false()"` causes node to be pruned from submission XML | Same semantics: non-relevant = hidden from user + excluded from Response + validation suspended |
| Repeat | `<repeat nodeset="...">` with dynamic per-item evaluation context | Repeatable groups with `[*]` path notation; `@index` and `@count` built-in accessors |
| Multiple instances | `instance('id')` function to reference secondary data sources | Named instances with `@instance('id')` in FEL; declared with schema and optional inline data |
| MVC separation | Model / View / Controller as independent architectural layers | Structure layer / Behavior layer / Presentation layer (presentation explicitly out of scope) |
| Four-phase processing cycle | Rebuild → Recalculate → Revalidate → Refresh | Rebuild → Recalculate → Revalidate → Notify (Refresh renamed; UI update is implementation-specific) |
| Submission pipeline | Select relevant nodes → prune non-relevant → validate → serialize to XML | Same pipeline; serialization target is JSON, not XML |
| Expression context scoping | Nearest ancestor binding element narrows the XPath evaluation context | Lexical scoping through item hierarchy; `$` as self-reference within constraints |

**What was NOT borrowed from XForms:**

- **XML Events.** XForms uses XML Events (DOM Level 2 Events with XML
  syntax) for action dispatching. Formspec has no event system; state
  transitions are implicit in the reactive dependency graph.
- **XPath dependency on XML namespaces and node types.** FEL operates
  on JSON values, which have no namespace axis, attribute axis, or
  mixed content.
- **The action system.** XForms defines `setvalue`, `insert`, `delete`,
  `send`, `toggle`, `setfocus`, and others. Formspec treats all
  mutations as data changes that trigger the processing cycle, not as
  imperative actions.
- **The UI control vocabulary.** XForms defines `<input>`, `<select>`,
  `<select1>`, `<trigger>`, `<output>`, etc. Formspec delegates all
  UI concerns to the presentation layer.
- **Synchronous/asynchronous submission modes.** Formspec Responses are
  data documents; transport is outside the specification's scope.

***

### 9.2 From W3C SHACL (2017)

SHACL (Shapes Constraint Language) provides the architectural model for
Formspec's validation system. The concept of "shapes" as named,
composable validation rule sets applied to a data graph is directly
borrowed.

| Concept | SHACL Origin | Formspec Adaptation |
|---------|-------------|---------------------|
| Three severity levels | `sh:Violation`, `sh:Warning`, `sh:Info` | `error`, `warning`, `info` — with a different conformance rule (see below) |
| Structured ValidationResult | `focusNode`, `resultPath`, `value`, `message`, `sourceShape`, `sourceConstraintComponent` | `path`, `severity`, `message`, `code`, `shapeId`, `value`, `context` |
| Constraint composition | `sh:and`, `sh:or`, `sh:not`, `sh:xone` | `and`, `or`, `not`, `xone` logical combinators on validation shapes |
| Shapes/data separation | Shapes graph + data graph as independent inputs | Definitions + Instances as independent documents |
| Custom constraint components | `sh:ConstraintComponent` with parameters + validators | Extension constraints with parameters + external implementation (§8.3) |
| Severity as metadata | Declared per-shape, not per-individual-constraint | Same: `severity` is a shape-level property; all results from a shape inherit its severity |

**Key divergence from SHACL:**

In SHACL, `sh:conforms` is `false` if ANY validation result exists,
regardless of severity. A shapes graph that produces only `sh:Info`
results is non-conforming. This design makes warnings and informational
messages operationally useless in systems where advisory messages are
expected — which includes virtually all form-based data collection
systems.

Formspec deliberately breaks from SHACL on this point:

> **Formspec conformance rule:** `valid` is `false` if and only if at
> least one result with `severity: "error"` exists. Results with
> `severity: "warning"` or `severity: "info"` do not affect the `valid`
> flag.

This decision was motivated by real-world requirements in grants
management, healthcare reporting, and financial compliance, where forms
routinely produce advisory warnings ("this value is unusually high") and
informational notes ("this field was auto-calculated") that must not
block submission.

***

### 9.3 From HL7 FHIR R5 / SDC (2023)

FHIR's Questionnaire and Structured Data Capture (SDC) implementation
guide represent the most mature modern form standard in production use.
Formspec borrows heavily from FHIR's identity model, response
architecture, and expression extensions.

| Concept | FHIR Origin | Formspec Adaptation |
|---------|------------|---------------------|
| Canonical URL + version + status | `Questionnaire.url`, `.version`, `.status` lifecycle model | Identical: `url` + `version` + `status` with same semantics |
| Response pinning | `QuestionnaireResponse.questionnaire` references a specific Questionnaire version | `Response.definition` uses `url\|version` format for unambiguous binding |
| `derivedFrom` | `Questionnaire.derivedFrom` for lineage tracking between form versions | Same property name and semantics |
| `linkId` | Stable item identifier bridging Questionnaire ↔ QuestionnaireResponse | `key` property on items; serves identical bridging function |
| Item taxonomy | `group` / `display` / `question` item types | `group` / `display` / `field` (renamed from `question` for clarity and generality) |
| Two-tier conditionals | `enableWhen` (simple comparison) + `enableWhenExpression` (FHIRPath) | Single tier using FEL; simple cases are just simple expressions, eliminating the need for a separate simple syntax |
| `disabledDisplay` | `hidden` / `protected` display modes for disabled items | Same property on binds; same behavioral semantics |
| Variable scoping | SDC `variable` extension with `name` + `expression` + ancestor→descendant visibility | `variables` array with `name` + `expression` + explicit `scope` property |
| `initialExpression` vs `calculatedExpression` | Once-evaluated vs continuously-evaluated expressions | `initialValue` (evaluated once at instantiation) vs `calculate` bind (continuously reactive) |
| Modular composition | `subQuestionnaire` + `$assemble` operation + `keyPrefix` | `$ref` + `keyPrefix` + assembly at publish time |
| `assembledFrom` | Metadata listing source Questionnaires after `$assemble` | Same metadata property populated after assembly |
| `versionAlgorithm` | Explicit declaration of version comparison semantics (`semver`, `integer`, `date`, etc.) | Same property with same purpose |

**What was NOT borrowed from FHIR:**

- **FHIR resource model.** Formspec documents are plain JSON, not FHIR
  resources. They do not require a FHIR server, FHIR identifier
  system, or FHIR-specific serialization.
- **FHIRPath as the expression language.** FHIRPath is tightly coupled
  to FHIR's type system and resource navigation model. FEL is designed
  for flat and nested JSON field references without FHIR dependencies.
- **`enableWhen` simple operator syntax.** FHIR provides both
  `enableWhen` (a simple `{question, operator, answer}` tuple) and
  `enableWhenExpression` (a FHIRPath string). Formspec uses only FEL
  expressions, accepting the slight verbosity increase for simple
  cases in exchange for a single, consistent conditional mechanism.
- **Answer value sets via FHIR terminology services.** Formspec's
  `choices` are inline JSON arrays. Integration with external
  terminology services is an extension concern, not a core feature.
- **The three population mechanisms.** FHIR SDC defines
  `$populate` (observation-based), `$populatehtml` (narrative-based),
  and `$populatelink` (link-based). Formspec uses secondary instances
  and `initialValue` expressions, which are more general.

***

### 9.4 From Secondary Sources

| Concept | Source | Formspec Adaptation |
|---------|--------|---------------------|
| `${field}` reference syntax | ODK XLSForm | `$fieldKey` reference syntax — `$` prefix instead of `${}` wrapper for cleaner nesting in complex expressions |
| `.` self-reference in constraints | ODK XLSForm | `$` as self-reference within constraint expressions, unifying the reference syntax |
| PEG-parseable expression grammar | SurveyJS | FEL is designed to be parseable by a PEG (Parsing Expression Grammar) parser, ensuring unambiguous parsing without separate lexer/parser stages |
| Rich built-in operators | SurveyJS (`empty`, `contains`, `notempty`) | Built-in FEL functions: `empty()`, `contains()`, `present()`, `length()`, with a defined type signature for each |
| Expression validation API | SurveyJS (client-side expression testing) | Recommended implementation feature: processors SHOULD expose an API for validating FEL expressions at design time, prior to form deployment |
| Data/UI schema separation | JSON Forms (JSON Schema for data, UI Schema for layout) | Structure layer / Presentation layer separation; presentation explicitly out of scope to avoid under-specifying a complex domain |
| Validation modes | JSON Forms (`validateMode: "onBlur"`, `"onChange"`, etc.) | `continuous` / `deferred` / `disabled` validation modes; the mapping to UI events is an implementation concern |
| External error injection | JSON Forms / React JSON Schema Form (RJSF) `additionalErrors` | External validation results with `source` and `sourceId` properties, merged into a single ValidationReport |
| Mapping DSL for data transformation | CommonGrants (proposed) | Published as a companion specification: **Formspec Mapping DSL v1.0** (see [`mapping-spec.md`](mapping-spec.md)). Covers bidirectional transforms between Formspec Responses and external schemas (JSON, XML, CSV). |

***

### 9.5 What Is Original to Formspec

While Formspec is deliberately derivative — preferring proven concepts
over novel invention — several design elements are original
combinations or new constructs not found in the source standards.

1. **Unified expression language (FEL).** Formspec introduces a
   purpose-built expression language that is neither XPath (XForms),
   FHIRPath (FHIR), JavaScript (most web form libraries), nor a
   proprietary grammar. FEL is designed for exactly one domain — form
   logic — with an explicit type system, JSON-native value semantics,
   no host-language dependency, and guaranteed PEG-parseability. The
   language is intentionally small: it supports field references,
   arithmetic, comparison, logical operators, string functions, and
   aggregate functions. It deliberately excludes variable assignment,
   loops, closures, and side effects.

2. **Validation Shapes as first-class composable objects.** Neither
   XForms nor FHIR R5 have named, composable, reusable validation rule
   sets. XForms has per-node `constraint` attributes; FHIR has simple
   `invariant` elements. Formspec borrows SHACL's shape architecture
   — named shapes with targets, severity, and structured results —
   and applies it to form validation. This combination (SHACL shapes +
   form data model) is novel.

3. **Modified SHACL conformance semantics.** The decision that only
   error-severity results (not warnings or info) affect the `valid`
   flag is an original divergence from SHACL, motivated by operational
   requirements in real-world form systems where advisory messages are
   the norm, not the exception.

4. **Bind paths with repeat notation.** The `group[*].field` path
   syntax for binding within repeatable contexts is a JSON-native
   alternative to XPath node-set expressions. It is designed for the
   hierarchical JSON data model and provides clear semantics for
   per-instance vs. aggregate expression evaluation without requiring
   a full path language.

5. **The three-layer separation applied to JSON forms.** While XForms
   pioneered MVC separation for forms-over-XML, Formspec is the first
   specification to apply this architecture as
   Structure / Behavior / Presentation with JSON as the native data
   format and an explicitly out-of-scope presentation layer. The
   deliberate exclusion of presentation concerns is itself a design
   decision: by refusing to under-specify UI, Formspec avoids the
   trap of mandating a lowest-common-denominator widget set.

6. **Cross-instance expressions with named instances.** While XForms
   has multiple instances accessed via `instance('id')`, Formspec's
   `@instance('id')` syntax within FEL is original, as is the
   declaration model for secondary data sources that combines a
   schema definition, a source URL for runtime resolution, and inline
   fallback data for offline or testing scenarios — all in a single
   declaration.

7. **Extension namespace convention with fallback guarantees.** The
   `x-` prefix convention for custom types, functions, constraints,
   and properties, combined with the requirement that custom types
   declare a `baseType` fallback and that processors preserve
   unrecognized extensions on round-trip, provides a forward-
   compatibility contract not found in the source standards. This
   enables domain-specific extension (federal grants, clinical trials,
   financial reporting) without fragmenting the core specification.

***

*End of Part 3 — Sections 7–9.*


***

## Appendix A: Requirements Traceability

This appendix maps the motivating requirements to the specification sections
that address them. This appendix is informative.

### Field Definitions

| Req | Description | Addressed By |
|-----|-------------|--------------|
| FT-01 | Standard types (text, numeric, date, select, etc.) | §4.2.3 Field Items — `dataType` enumeration |
| FT-02 | Financial fields with currency formatting | §4.2.3 `money` dataType; §3.5.7 Money Functions; §3.4.1 decimal precision semantics |
| FT-03 | File attachment fields | §4.2.3 `attachment` dataType |
| FT-04 | Auto-calculated fields | §4.3 Bind `calculate` property; §3 FEL expression language |
| FT-05 | Pre-populated fields (editable vs locked) | §4.2.3 `prePopulate` + `initialValue` (expression-based with `=` prefix); §4.3 Bind `readonly`; §4.4 Instances |
| FM-01 | Field metadata (label, description, alt labels) | §4.2.1 `label`, `description`; `labels` object for context-specific labels |
| FM-02 | Default value when excluded by conditional logic | §4.3 Bind `default` property |

### Form Logic

| Req | Description | Addressed By |
|-----|-------------|--------------|
| FL-01 | Conditional visibility | §4.3 Bind `relevant` expression |
| FL-02 | Non-relevant data exclusion | §5.6 Non-Relevant Field Handling; §2.5.4 |
| FL-03 | Repeatable sections | §4.2.2 Group Items with `repeatable`, `minRepeat`, `maxRepeat` |
| FL-04 | Cross-form field dependencies | §4.4 Named instances with cross-instance references; §3.2.3 `@instance()` |
| FL-05 | Screener/routing logic | §4.7 Screener Routing; §7.5 example |

### Validation

| Req | Description | Addressed By |
|-----|-------------|--------------|
| VR-01 | Three severity levels | §5.1 Severity Levels |
| VS-01 | Field-level validation | §4.3 Bind `constraint`; §5.2 Shapes targeting individual paths |
| VS-02 | Field-group validation | §5.2 Shapes targeting group paths; §7.3 cross-row total example |
| VS-03 | Form-level validation | §5.2 Shapes targeting `#` (root); §7.1 budget total check |
| VS-04 | Cross-form validation | §3.2.3 Cross-instance references; §7.4 year-over-year example |
| VE-01 | Incremental re-evaluation | §3.6 Dependency Tracking; §2.4 Phase 2 Recalculate |
| VE-02 | Formula-based validation rules | §5.2 Shape `constraint` uses FEL; same language as `calculate` |
| VE-03 | Prior-year comparison rules | §7.4 Year-over-Year Comparison Warning example |
| VE-04 | Inline explanatory messages | §5.2 Shape `message` with `{{expression}}` interpolation |
| VE-05 | Saving never blocked by validation | §5.5 Validation Modes; deferred mode |
| VE-06 | External validation injection | §5.7 External Validation Results |
| VX-01 | Structured validation results | §5.3 Validation Result Schema |
| VX-02 | Results partitioned by severity | §5.4 ValidationReport; `valid` considers only errors |
| VX-03 | Results consumable by any system | §5.3, §5.4 — JSON results with no implementation dependency |

### Versioning & Evolution

| Req | Description | Addressed By |
|-----|-------------|--------------|
| VC-01 | Multiple versions coexisting | §6.1 Identity Model; `url` + `version` |
| VC-02 | Responses pinned to definition version | §6.4 Response Pinning |
| VC-03 | Definitions evolve without breaking responses | §6.4 Responses validated against pinned version |
| VC-04 | Form variants from common base | §6.5 Variant Derivation; `derivedFrom` |
| VC-05 | Year-over-year pre-population | §4.4 Instances with prior-year source; §7.4 example |
| VC-06 | Definition lifecycle | §6.3 Status Lifecycle (draft → active → retired) |

### Authoring & Extensibility

| Req | Description | Addressed By |
|-----|-------------|--------------|
| AD-01 | Schema-driven (definitions are data) | §1.2 Design Principles; entire spec is JSON documents |
| AD-02 | Supports visual/no-code authoring | §1.2; declarative JSON is tooling-friendly by design |
| AD-03 | Program-agnostic | §1.2; no domain-specific types in core |
| AD-04 | Extensible for domain-specific needs | §8 Extension Points (custom types, functions, constraints, properties, namespaces) |

### Presentation

| Req | Description | Addressed By |
|-----|-------------|--------------|
| PR-01 | Advisory widget selection hints | §4.2.5.1 `widgetHint` per Item type and `dataType` |
| PR-02 | Layout and spatial arrangement | §4.2.5.2 `layout` — `flow`, `columns`, `colSpan`, `page` |
| PR-03 | Semantic style tokens | §4.2.5.3 `styleHints` — `emphasis`, `size` |
| PR-04 | Accessibility metadata | §4.2.5.4 `accessibility` — `role`, `description`, `liveRegion` |
| PR-05 | Form-wide defaults | §4.1.1 `formPresentation` — `pageMode`, `labelPosition`, `density` |
| PR-06 | No impact on data semantics | §2.4 "Presentation Hints and Processing"; §4.2.5 normative statement |
| PR-07 | Forward compatibility for richer systems | §4.2.5.6 `additionalProperties: true` on `presentation` |
