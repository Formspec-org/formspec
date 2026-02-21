# FORMSPEC v1.0 — A JSON-Native Declarative Form Standard

**Version:** 1.0.0-draft.1  
**Date:** 2025-07-10  
**Editors:** Formspec Working Group  

---

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

---

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
| **AD-02** | **Separate structure from behavior from presentation.** What data is collected (Items), how it behaves (Binds, Shapes), and how it is displayed (renderer) are three independent concerns. This specification defines the first two and explicitly excludes the third. | Allows one Definition to drive web, mobile, PDF, voice, and API interfaces without modification. |
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

A conformant Formspec processor MUST:

1. Parse any Definition document that conforms to the Formspec JSON schema
   without error.
2. Evaluate FEL expressions as specified in §3.
3. Implement the four-phase processing model as specified in §2.4.
4. Produce ValidationResult documents conforming to the Formspec result schema.
5. Reject Definition documents containing circular dependencies with a
   diagnostic message identifying at least one cycle.

A conformant processor MAY support a subset of FEL built-in functions, provided
it signals an unsupported-function error when encountering a function it does
not implement, rather than silently ignoring the call.

---

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
>   { "key": "addresses", "type": "group", "repeat": true, "children": [
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
| `"group"` | A structural container. Groups organize related fields and may be **repeatable** (`"repeat": true`), meaning the user can add zero or more instances of the group’s child structure. | No (contains children) | Yes |
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
| `"time"` | JSON string, ISO 8601 time (`HH:MM:SS`) | `string` | Treated as string in FEL; time functions are a future extension. |
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
>       "name": "dateRangeValid",
>       "target": "endDate",
>       "constraints": [
>         {
>           "expression": "$endDate >= $startDate",
>           "severity": "error",
>           "message": "End date must not precede start date.",
>           "code": "DATE_RANGE_001"
>         }
>       ]
>     },
>     {
>       "name": "dateRangeReasonable",
>       "target": "endDate",
>       "constraints": [
>         {
>           "expression": "dateDiff($endDate, $startDate, 'days') <= 365",
>           "severity": "warning",
>           "message": "Date range exceeds one year. Please verify.",
>           "code": "DATE_RANGE_002"
>         }
>       ]
>     },
>     {
>       "name": "dateRangeComplete",
>       "and": ["dateRangeValid", "dateRangeReasonable"]
>     }
>   ]
> }
> ```

#### 2.1.6 Response

A **Response** is a completed or in-progress Instance pinned to a specific
Definition version. It is the unit of data capture — the filled-in form.

A Response MUST contain:

| Property | Type | Description |
|----------|------|-------------|
| `definitionUrl` | string (URI) | The canonical URL of the Definition. |
| `definitionVersion` | string (semver) | The exact version of the Definition against which this Response was created. |
| `status` | string | One of: `"in-progress"`, `"completed"`, `"amended"`, `"stopped"`. |
| `data` | object | The primary Instance — the form data. |
| `authored` | string (ISO 8601 date-time) | When the Response was last modified. |

A Response MAY contain:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | A globally unique identifier (e.g., UUID). |
| `author` | object | Identifier and display name of the person or system that authored the Response. |
| `validationResults` | array | The most recent set of ValidationResult entries. |

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

Each Data Source MUST have:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | A unique identifier within the Definition. This is the key used in `@instance('name')` references. MUST match `^[a-zA-Z_][a-zA-Z0-9_]*$`. |
| `type` | string | One of `"inline"`, `"url"`, or `"function"`. See below. |

Each Data Source MUST also declare its content via one of the following
mechanisms, depending on `type`:

| `type` | Additional property | Description |
|--------|-------------------|-------------|
| `"inline"` | `data` (JSON object or array) | The data is embedded directly in the Definition document. Suitable for small, static lookup tables (e.g., country codes, status enums). |
| `"url"` | `url` (string, URI) | The data is fetched from an external endpoint at form-load time. The response MUST be a JSON document. The processor MUST fetch the data before the first Rebuild phase. If the fetch fails, the processor MUST signal a load error. |
| `"function"` | `functionName` (string) | The data is supplied by the host environment via a named callback registered with the processor. This allows integration with application-specific data layers without embedding URLs in the Definition. |

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
>       "type": "inline",
>       "data": [
>         { "code": "US", "label": "United States" },
>         { "code": "GB", "label": "United Kingdom" },
>         { "code": "CA", "label": "Canada" }
>       ]
>     },
>     {
>       "name": "priorYear",
>       "type": "url",
>       "url": "https://api.example.org/responses/2024/{{respondentId}}"
>     },
>     {
>       "name": "inventory",
>       "type": "function",
>       "functionName": "loadInventoryData"
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

#### Layer 3: Presentation Layer (Out of Scope)

The Presentation Layer answers the question: **HOW is data displayed?**

This layer — which this specification deliberately does **not** define —
encompasses:

- Widget selection (text input, dropdown, date picker, radio buttons).
- Layout and flow (single page, multi-step wizard, accordion).
- Visual style (CSS, themes, branding).
- Platform-specific affordances (touch targets, screen reader hints).
- Navigation and focus management.

Implementors are free to define their own Presentation Layer conventions.
Companion specifications MAY standardize Presentation Layer schemas for
specific platforms (e.g., "Formspec Web Widgets" or "Formspec Mobile Layout"),
but such specifications are independent of this document.

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
| `path` | string | REQUIRED | The dot-notation path to the data node that produced this result (e.g., `"demographics.dob"`, `"lineItems[2].amount"`). For repeat instances, the path MUST include the 1-based index. |
| `message` | string | REQUIRED | A human-readable description of the finding. Suitable for display to end users. Processors SHOULD support localization of messages, but the mechanism is implementation-defined. |
| `code` | string | OPTIONAL | A machine-readable identifier for this class of finding. Codes enable programmatic handling (e.g., suppressing known warnings, mapping to external error catalogs). |
| `source` | string | OPTIONAL | Identifies the origin of the finding: `"bind"` (from a Bind `constraint` or `required` check) or `"shape"` (from a Validation Shape). |
| `shapeName` | string | OPTIONAL | If `source` is `"shape"`, the `name` of the Validation Shape that produced this entry. |
| `expression` | string | OPTIONAL | The FEL expression that was evaluated. Included for diagnostic purposes. Processors MAY omit this in production to reduce payload size. |

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
>     "shapeName": "dateRangeReasonable"
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

---

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
| 10 (highest) | `not` (prefix) | Logical negation | Right (unary) |

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
| `number` | An IEEE 754 double-precision floating-point number. | JSON number | `42`, `3.14`, `-7`, `0.001` |
| `boolean` | A truth value. | JSON `true` or `false` | `true`, `false` |
| `date` | A calendar date (no time component). | JSON string in ISO 8601 format (`YYYY-MM-DD`) | No date literal syntax; use `date('2025-07-10')` |
| `null` | The absence of a value. | JSON `null` | `null` |

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

#### 3.5.3 Numeric Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `round` | `round(number, number?) → number` | `number` | Round to the given precision (default 0). Uses "round half to even" (banker’s rounding). |
| `floor` | `floor(number) → number` | `number` | Largest integer ≤ the argument. |
| `ceil` | `ceil(number) → number` | `number` | Smallest integer ≥ the argument. |
| `abs` | `abs(number) → number` | `number` | Absolute value. |

#### 3.5.4 Date Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `today` | `today() → date` | `date` | The current date in the processor’s local time zone (or UTC, at the processor’s discretion; processors SHOULD document their choice). |
| `now` | `now() → date` | `date` | The current date-time. Non-deterministic. |
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

#### 3.5.6 Type-Checking Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|------------|
| `isNumber` | `isNumber(T) → boolean` | `boolean` | `true` if the argument is of type `number`. |
| `isString` | `isString(T) → boolean` | `boolean` | `true` if the argument is of type `string`. |
| `isDate` | `isDate(T) → boolean` | `boolean` | `true` if the argument is of type `date`. |
| `isNull` | `isNull(T) → boolean` | `boolean` | `true` if the argument is `null`. Equivalent to `$ = null`. |
| `typeOf` | `typeOf(T) → string` | `string` | Returns the type name as a string: `"string"`, `"number"`, `"boolean"`, `"date"`, `"null"`, or `"array"`. |

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

Expression     ← _ Ternary _

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
               / Atom

Atom           ← FunctionCall
               / FieldRef
               / ArrayLiteral
               / Literal
               / '(' _ Expression _ ')'

FieldRef       ← '$' Identifier ('.' Identifier)* ('[' _ ( Integer / '*' ) _ ']' ('.' Identifier)*)*
               / '$'
               / '@' Identifier ('(' _ StringLiteral _ ')')? ('.' Identifier)*

FunctionCall   ← Identifier '(' _ (Expression (_ ',' _ Expression)*)? _ ')'

ArrayLiteral   ← '[' _ (Expression (_ ',' _ Expression)*)? _ ']'

Literal        ← NumberLiteral
               / StringLiteral
               / 'true'
               / 'false'
               / 'null'

# --- Lexical rules ---

Identifier     ← [a-zA-Z_] [a-zA-Z0-9_]*

NumberLiteral  ← '-'? [0-9]+ ('.' [0-9]+)? (('e' / 'E') ('+' / '-')? [0-9]+)?

StringLiteral  ← '\'' (!'\'' .)* '\''
               / '"' (!'"' .)* '"'

Integer        ← [0-9]+

_              ← [ \t\n\r]*              # Optional whitespace
```

> *Informative note:* This grammar intentionally omits Unicode escape sequences
> in string literals, detailed whitespace rules, and comment syntax. A full
> formal grammar will be published as a companion document.

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

---

*End of Part 1. The specification continues in Part 2 with §4 (Definition
Schema), §5 (Response Schema), §6 (Validation Results Schema), §7 (Extensions),
and §8 (Conformance Test Suite).*
