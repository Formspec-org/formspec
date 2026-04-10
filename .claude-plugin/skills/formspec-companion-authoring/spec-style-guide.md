# Formspec-Org Specification Style Guide

**Version:** 1.0.0-draft.1
**Date:** 2026-04-09
**Audience:** Specification authors, editors, and reviewers for the Formspec-org specification family

---

## 1. Purpose

This document defines the conventions, structural patterns, and normative language rules that all Formspec-org specifications must follow. It is extracted from the existing specification suite (Core, Theme, Component, Mapping, Screener, Assist, References, Locale, Ontology, Respondent Ledger, Extension Registry, Changelog, and FEL Grammar) and codifies the patterns that make those specifications feel like a coherent family.

A specification that follows this guide will be structurally consistent with every other Formspec-org specification, enabling readers to transfer their familiarity from one document to another.

---

## 2. Document Frontmatter

### 2.1 YAML Frontmatter

Every Formspec-org spec MUST include a YAML frontmatter block before the title heading. This enables tooling pipelines and costs nothing.

```yaml
---
title: Formspec [Name] Specification
version: 1.0.0-draft.1
date: 2026-04-09
status: draft
---
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `title` | REQUIRED | Full specification title. |
| `version` | REQUIRED | Spec version string (semver). |
| `date` | REQUIRED | ISO 8601 date of the current draft. |
| `status` | REQUIRED | `draft`, `active`, or `retired`. |

Some existing specs lack frontmatter — see `legacy-cleanup.md` for the list.

### 2.2 Title Heading

The first Markdown heading is the specification title. Use `#` (H1). Include the specification version.

**Pattern:**

```markdown
# Formspec [Name] Specification v1.0
```

**Default pattern:** Use the short form for all specs:

```markdown
# Formspec [Name] Specification v1.0
```

A subtitle after `--` is permitted when the spec name alone is insufficient (e.g., `# Formspec Mapping DSL v1.0 -- Bidirectional Data Transformation for Formspec Responses`).

### 2.3 Inline Metadata Block

Immediately after the title heading, provide metadata as bold key-value pairs followed by a horizontal rule (`---`).

**Pattern:**

```markdown
**Version:** 1.0.0-draft.1
**Date:** 2026-04-09
**Editors:** Formspec Working Group
**Companion to:** Formspec v1.0 -- A JSON-Native Declarative Form Standard

---
```

**Fields (in order):**

| Field | Required | Description |
|-------|----------|-------------|
| `Version` | REQUIRED | Full version string. |
| `Date` | REQUIRED | ISO 8601 date. |
| `Editors` | REQUIRED | Authoring body or editor names. Typically "Formspec Working Group". |
| `Status` | OPTIONAL | May appear as a separate line or be stated in "Status of This Document" section. |
| `Companion to` | REQUIRED for companion/add-on specs | The parent specification title. Omit for the Core spec. |

The Respondent Ledger uses a slightly different pattern with `Status:`, `Last updated:`, `Audience:`, and `Normative language:` inline. This is acceptable for add-on specs with a lighter editorial voice.

---

## 3. Preamble Sections

After the metadata block, the following sections appear in order. All are `##` (H2) headings.

### 3.1 Abstract

**Required:** Yes, for all specs.

A single prose paragraph (or two) describing the specification's purpose, scope, and relationship to other Formspec specifications. The abstract should be self-contained -- a reader who reads only the abstract should understand what the specification defines.

**Pattern:**

```markdown
## Abstract

The Formspec [Name] Specification is a companion specification to Formspec v1.0
that defines [what it defines]. A [Document Type] -- itself a JSON document --
declares [key capabilities]. The [Name] [uses/reuses] [FEL/core constructs]
for [purpose].
```

The abstract SHOULD:

- State the specification's relationship to Core (companion, add-on, normative grammar).
- Describe the primary artifact (document type) it defines.
- Name the key capabilities.
- State its independence or dependence on Core processing.

**Example** (References spec):

> The Formspec References Specification is a companion to Formspec v1.0 that defines a standalone sidecar document for attaching external documentation, knowledge sources, and AI agent data stores to any level of a Formspec definition...

### 3.2 Status of This Document

**Required:** Yes.

States the document's maturity level and any caveats for implementors.

**Canonical wording for draft specs:**

```markdown
## Status of This Document

This document is a **draft specification**. It is a companion to the Formspec
v1.0 core specification and does not modify or extend [the core processing model |
that specification]. Implementors are encouraged to experiment with this
specification and provide feedback, but MUST NOT treat it as stable for
production use until a 1.0.0 release is published.
```

Key elements:

- State the maturity level (**draft specification**).
- State the relationship to Core (companion, does not modify/extend).
- Encourage experimentation while cautioning against production use.

### 3.3 Conventions and Terminology

**Required:** Yes.

This section establishes the normative language convention and defines terms used throughout the specification.

**BCP 14 boilerplate (REQUIRED):**

```markdown
## Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in [BCP 14][rfc2119] [RFC 2119]
[RFC 8174] when, and only when, they appear in ALL CAPITALS, as shown here.
```

Immediately after the BCP 14 paragraph, declare the foundational RFCs used:

```markdown
JSON syntax and data types are as defined in [RFC 8259]. URI syntax is as
defined in [RFC 3986]. JSON Pointer syntax is as defined in [RFC 6901].
```

Include only the RFC declarations relevant to this spec. Common ones:

- `[RFC 8259]` -- JSON (always)
- `[RFC 3986]` -- URI syntax (almost always)
- `[RFC 6901]` -- JSON Pointer (when paths are used)
- `[RFC 3987]` -- IRIs (Ontology spec)
- `[ISO 8601]` -- Durations/dates (Screener, Ledger)

**Core term inheritance:**

For companion specs, include a paragraph inheriting terms from Core:

```markdown
Terms defined in the Formspec v1.0 core specification -- including *Definition*,
*Item*, *Bind*, *FEL*, and *conformant processor* -- retain their
core-specification meanings throughout this document unless explicitly redefined.
```

**Additional terms:**

Define spec-specific terms after the inheritance statement. Use a bulleted list with bold term followed by em-dash and definition:

```markdown
Additional terms:

- **Screener Document** -- A JSON document conforming to this specification.
- **Registry-aware processor** -- A conformant Formspec processor that
  additionally understands the Registry Document format...
```

**Default:** Use the bulleted list for up to 10 terms. For specs with many terms (>10), use a table:

```markdown
| Term | Definition |
|------|------------|
| **Definition** | A Formspec Definition document (core spec S4). |
| **Theme** | A Formspec Theme document conforming to this specification. |
```

**Reference link definitions:**

Place RFC link definitions at the end of the Conventions section:

```markdown
[rfc2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 3986]: https://www.rfc-editor.org/rfc/rfc3986
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[RFC 8259]: https://www.rfc-editor.org/rfc/rfc8259
```

### 3.4 Bottom Line Up Front (BLUF)

**Required:** Yes, for specs that participate in the `docs:generate` pipeline.

The BLUF section is a machine-injected summary block. It contains 3-5 bullet points capturing the essential structural and behavioral contract of the specification.

**Pattern:**

```markdown
## Bottom Line Up Front

<!-- bluf:start file=[name]-spec.bluf.md -->
- This document defines [what it defines].
- A valid [document type] requires [list of required top-level properties].
- [Key behavioral or structural rule].
- This BLUF is governed by `schemas/[name].schema.json`; generated references are the structural contract.
<!-- bluf:end -->
```

**Rules:**

- The BLUF content lives in a separate `.bluf.md` file (e.g., `theme-spec.bluf.md`).
- The `<!-- bluf:start file=... -->` and `<!-- bluf:end -->` markers are generated by `npm run docs:generate`. Do NOT hand-edit the content between these markers.
- The BLUF file itself is hand-authored -- it is the source of truth for the injected content.
- The last bullet SHOULD reference the governing schema file.

**Writing good BLUF bullets:**

Every BLUF bullet should be a falsifiable statement about what the spec requires — not a vague summary of what it "covers."

- Bad: "This document defines theme tokens and widget catalogs."
- Good: "A valid Theme Document requires `$formspecTheme`, `version`, and `targetDefinition`."
- Bad: "The Screener handles respondent routing."
- Good: "Override routes are evaluated before the phase pipeline and can halt evaluation with `terminal: true`."

Each BLUF should have 3-5 bullets covering: (1) the required properties for a valid document, (2) the key behavioral rule that makes this spec distinct, (3) the additive invariant, (4) the governing schema reference.

### 3.5 Table of Contents (Optional)

Some specs include an explicit Table of Contents. This is OPTIONAL but RECOMMENDED for specs exceeding ~500 lines.

**Pattern:**

```markdown
## Table of Contents

- [Bottom Line Up Front](#bottom-line-up-front)
- [S1 Introduction](#1-introduction)
  - [S1.1 Purpose and Scope](#11-purpose-and-scope)
  - [S1.2 Relationship to Formspec Core](#12-relationship-to-formspec-core)
...
```

The Component spec (`specs/component/component-spec.md`) and Screener spec (`specs/screener/screener-spec.md`) include explicit TOCs. The Core spec does not -- its size is managed through the reference map system instead.

---

## 4. Numbered Section Structure

### 4.1 Section Numbering Convention

All major sections use `## N. Title` (H2 with number + period). Subsections use `### N.M Title` (H3). Sub-subsections use `#### N.M.P Title` (H4). Never go deeper than H4 in normative sections.

```markdown
## 4. Evaluation Pipeline
### 4.1 Phase Ordering
#### 4.1.1 Override Route Pre-Evaluation
```

### 4.2 Standard Section Ordering

The following ordering is the canonical pattern for Formspec-org companion specifications:

| Section | Content | Required |
|---------|---------|----------|
| **1. Introduction** | Purpose, scope, relationship to Core, terminology, design principles, conformance levels | Yes |
| **2-N. Technical Sections** | The normative body of the specification, numbered sequentially | Yes |
| **N+1. Processing Model** | Evaluation order, phase descriptions (if applicable) | If applicable |
| **N+2. Conformance** | Conformance levels, roles, requirements | Yes |
| **N+3. Extension Points** | Extension mechanisms, `x-` conventions | If applicable |
| **N+4. Examples** | Complete worked examples | RECOMMENDED |
| **N+5. Security Considerations** | Security, privacy, trust implications | RECOMMENDED |
| **Appendix A-Z** | Reference tables, migration guides, lineage | Optional |

**Observed orderings across existing specs:**

- **Core:** Introduction > Conceptual Model > Expression Language > Definition Schema > Validation > Versioning > Examples > Extension Points > Lineage > Appendix (Requirements Traceability)
- **Screener:** Introduction > Document Structure > Items and Binds > Evaluation Pipeline > Strategies > Override Routes > Route Targets > Determination Record > Lifecycle > Processing Model > Conformance > Extension Points > Examples > Security Considerations > Appendices
- **Ontology:** Purpose and Scope > Concept Bindings > Vocabulary Bindings > Alignments > JSON-LD Context > Resolution Cascade > Conformance > Schema > Security Considerations > Example > Appendices

### 4.3 Introduction Subsections

The Introduction section (S1) should contain the following subsections, though exact naming varies:

| Subsection | Content | Examples |
|------------|---------|----------|
| Purpose and Scope | What this spec defines and does NOT define | Core S1.1, Mapping S1.1 |
| Relationship to Core | How this spec relates to the Core spec | Theme S1.2, Mapping S1.3 |
| Design Principles | Numbered principles with rationale | Core S1.2, References S1.1, Assist S1.4 |
| Terminology | Spec-specific term definitions | Mapping S1.4, Component S1.4 |
| Conformance | Conformance levels and requirements | Core S1.4, Mapping S1.5 |
| Notational Conventions | JSON example conventions, path syntax | Mapping S1.6, Component "Conventions" |
| Scope exclusions | What the spec explicitly does NOT define | Mapping S1.2, Assist S1.2 |

### 4.4 Design Principles

When a spec includes design principles, number them and provide a rationale. Two formats are used:

**Table format** (Core S1.2):

```markdown
| ID | Principle | Rationale |
|----|-----------|----------|
| **AD-01** | **Schema is data, not code.** ... | Enables tooling, auditing... |
| **AD-02** | **Separate structure from behavior...** | Allows one Definition... |
```

**Numbered list format** (Assist S1.4, References S1.1):

```markdown
1. **LLM-independent.** The protocol MUST stand on structured data alone.
2. **User-controlled mutation.** Providers MUST preserve user agency...
3. **Additive, not invasive.** Assist MUST NOT redefine core semantics.
```

**Default:** Use the numbered list format. It is more concise and readable for most specs. Use the table format only when principles have formal ID prefixes (e.g., `AD-01`) that need traceability back to a requirements document.

---

## 5. Normative Language

### 5.1 RFC 2119 / BCP 14 Keywords

Formspec specifications use the full BCP 14 keyword set. Keywords appear in ALL CAPITALS only when they carry normative force:

- **MUST / MUST NOT / SHALL / SHALL NOT** -- Absolute requirements and prohibitions. These are testable, enforceable constraints.
- **REQUIRED** -- Equivalent to MUST. Used primarily in property tables.
- **SHOULD / SHOULD NOT / RECOMMENDED / NOT RECOMMENDED** -- Strong guidance with allowable exceptions when justified.
- **MAY / OPTIONAL** -- Truly optional behavior.

**Choosing between MUST and SHOULD:**

The most common spec authoring mistake is using MUST when SHOULD is more appropriate, or vice versa. Use this test:

- **MUST** — If a processor violates this, is the output *wrong*? Would it produce corrupt data, security vulnerabilities, or silent data loss? Use MUST.
- **SHOULD** — If a processor violates this, is the output *suboptimal but still correct*? Would it produce a worse user experience or miss an optimization? Use SHOULD.
- **MAY** — Is this a feature some processors will implement and others won't, with no correctness implication? Use MAY.

When in doubt, prefer SHOULD. Over-using MUST makes conformance expensive and discourages adoption. Under-using MUST creates ambiguity about what "conformant" means. Err toward SHOULD for behavioral guidance, MUST for structural requirements.

**Usage rules:**

1. Use MUST for structural requirements (required properties, format constraints, rejection conditions).
2. Use SHOULD for behavioral guidance where reasonable exceptions exist (e.g., "SHOULD emit a warning").
3. Use MAY for features a processor may implement optionally.
4. Never use MUST/SHOULD/MAY in lowercase when intending normative force.
5. In informal discussion or rationale sections, use lowercase "must", "should", "may" to avoid false normativity.
6. One requirement per sentence. Never write compound MUST clauses ("MUST do X and MUST do Y") — split them.
7. Every MUST requirement should be testable. If you cannot describe a test that would detect a violation, the requirement is too vague.

### 5.2 Normative vs. Informative Sections

Use explicit markers when a section's normative status needs clarification:

```markdown
This section is informative, not normative.
```

This pattern appears in: Core S9 ("Lineage -- What Was Borrowed and Why"), Core Appendix A ("This appendix is informative"). Use it for:

- Lineage/history sections
- Appendices that provide informational reference material
- Design rationale sections
- Examples (examples are informative by default unless stated otherwise)

Normative sections do not need an explicit "This section is normative" marker -- normativity is the default.

### 5.3 Conformance Requirement Identifiers

Critical conformance requirements SHOULD be given a unique identifier for traceability. Two patterns exist:

**Inline bold prefix** (Screener spec):

```markdown
**Conformance Rule (SC-01):** Processors MUST preserve answer states in the
Determination Record for all items...
```

**In-table ID column** (Core Appendix A):

```markdown
| Req | Description | Addressed By |
|-----|-------------|--------------|
| VP-01 | Responses pinned to definition version | S6.4 |
| VC-01 | Multiple versions coexisting | S6.1 |
```

**ID prefix conventions:**

| Prefix | Spec |
|--------|------|
| `AD-` | Core design principles |
| `FT-`, `FL-`, `VR-`, `VS-`, `VE-`, `VX-`, `VC-`, `PR-`, `FM-` | Core requirements traceability |
| `VP-` | Core versioning/pinning |
| `SC-` | Screener conformance rules |

When creating a new spec, choose a 2-letter prefix derived from the spec name (e.g., `AS-` for Assist, `RF-` for References, `ON-` for Ontology). Use sequential numbering. Gaps are acceptable; do not renumber.

### 5.4 The Additive Invariant

Companion and add-on specifications include a critical invariant statement declaring that the spec does not modify Core semantics. This appears in both the Abstract and the conformance section.

**Canonical wording:**

```markdown
[This spec] MUST NOT affect data capture, validation, or the processing model.
```

**Variations from existing specs:**

- References: "References are pure metadata: they MUST NOT affect data capture, validation, or the processing model."
- Ontology: "Ontology metadata is pure metadata -- it MUST NOT affect data capture, validation, or the processing model."
- Locale: "A Locale Document MUST NOT affect data collection, validation logic, or behavioral semantics."
- Assist: "Assist is additive. A processor that does not implement this specification remains fully conformant to Formspec core."
- Respondent Ledger: "MUST NOT require ledger replay in order to interpret a valid Response."
- Theme: "A Theme MUST NOT affect data collection, validation, or behavioral semantics."

The exact phrasing varies, but the invariant is: the companion/add-on specification adds capabilities without changing what the Core spec does.

---

## 6. Conformance Sections

### 6.1 Conformance Levels

Most Formspec specs define two or three conformance levels as strict supersets:

| Spec | Level 1 | Level 2 | Level 3 |
|------|---------|---------|---------|
| Core | Core | Extended | -- |
| Mapping | Mapping Core | Mapping Bidirectional | Mapping Extended |
| Screener | Core | Complete | -- |
| Component | Core | Complete | -- |
| Locale | Locale Core | Locale Extended | -- |

**Pattern:**

```markdown
## N. Conformance

### N.1 Conformance Levels

This specification defines [two | three] conformance levels:

| Level | Requirements |
|-------|-------------|
| **Core** | MUST support [minimum viable set]. |
| **Complete** | MUST support all [full set]. |
```

Each conformance level SHOULD be defined with a numbered list of MUST requirements:

```markdown
#### N.1.1 [Level Name] Core

A conformant **[Level Name] Core** processor MUST:

1. Parse and validate any [Document Type] that conforms to the [Schema] without error.
2. Implement [minimum feature set].
3. Report diagnostic errors for [error conditions].
```

### 6.2 Conformance Roles

Some specs define conformance by role rather than (or in addition to) level:

**Pattern** (Assist S2):

```markdown
## 2. Conformance Roles

### 2.1 Assist Provider

A conformant Assist Provider:

- **MUST** implement every tool in S3.2, S3.3, and S3.4.
- **MUST** follow the field-help resolution algorithm in S5.
...

### 2.2 Assist Consumer

A conformant Assist Consumer:

- **MUST** treat the provider as authoritative for live form state.
...
```

### 6.3 Conformance Prohibitions

The Core spec includes an explicit "Conformance Prohibitions" subsection (S1.4.3) listing things a processor MUST NOT do. This pattern is RECOMMENDED for any spec where common implementation mistakes need explicit prohibition:

```markdown
#### N.M Conformance Prohibitions

A conformant processor MUST NOT:

1. **Silently substitute definition versions.** When validating a Response
   pinned to version X, the processor MUST use version X.
2. **Produce validation results for non-relevant fields.**
3. ...
```

### 6.4 Core vs. Extended Processor Requirements

For companion specs that are additive to Core, conformance is typically split into "Core processor" and "Extended processor" requirements:

```markdown
### N.1 Core Processor Requirements

- A conformant Core processor MAY ignore [Document Type] entirely --
  they are an additive [metadata | presentation] layer.
- A conformant Core processor MUST NOT use [this spec's artifacts]
  to alter data capture, validation, or the processing model.

### N.2 Extended Processor Requirements

- An Extended processor that supports [document type] MUST load
  and validate documents against the schema in SN.
- An Extended processor MUST verify that `targetDefinition.url`
  matches the loaded Definition's `url`.
```

This pattern appears in: References (S8), Ontology (S8), Locale (S10).

---

## 7. Cross-Specification References

### 7.1 Section Citations

When referencing a section in the same spec, use `SN.M` notation:

```markdown
See S4.3 for Bind Schema details.
```

When referencing a section in another spec, prefix with the spec name:

```markdown
- "core S4.2.5" or "Core S4.3"
- "theme S3" or "Theme S3"
- "FEL Grammar S4"
- "Screener Specification S6"
```

**Default:** Use inline `S4.3` in prose. Use parenthetical `(S4.3)` in property table Description columns or when the reference is a secondary aside.

### 7.2 Companion Relationship Declaration

Every companion or add-on spec MUST declare its relationship to Core in both the metadata block and the Introduction. The metadata block uses:

```markdown
**Companion to:** Formspec v1.0 -- A JSON-Native Declarative Form Standard
```

The Introduction includes a "Relationship to Formspec Core" subsection (or equivalent) that:

1. States what the Core spec defines.
2. States what this spec adds.
3. States that the companion spec does NOT modify Core.
4. Optionally, includes a table showing the layer/tier architecture.

**Example** (Theme S1.2):

```markdown
### 1.2 Relationship to Formspec Core

| Layer | Concern | Defined In |
|-------|---------|------------|
| 1. Structure | What data to collect | Core S4 (Items) |
| 2. Behavior | How data behaves | Core S4.3 (Binds), S5 (Shapes) |
| 3. Presentation | How data is displayed | Core S4.2.5 (Tier 1) + **this spec** (Tier 2) |
```

### 7.3 Cross-Spec Dependency Declaration

When a spec depends on another companion spec, declare it in the metadata:

```markdown
**Depends on:** Formspec Core Specification v1.0 (spec.md), Formspec Theme
Specification v1.0 (theme-spec.md), FEL Normative Grammar v1.0
(fel-grammar.md)
```

And in the Introduction, include a relationship table:

```markdown
| Specification | Relationship |
|---|---|
| **Core** | Assist reads and mutates state governed by the core processing model. |
| **References** | Assist uses References Documents as one source of contextual help. |
| **Ontology** | Assist uses Ontology Documents for semantic alignment. |
```

---

## 8. Property Tables and Schema References

### 8.1 Property Tables

When documenting JSON object properties, use a property table with the following columns:

**Standard columns:**

```markdown
| Property | Type | Required | Description |
|----------|------|----------|-------------|
```

Some specs add additional columns:

```markdown
| Property | Type | Req | Description |
```

The shorter `Req` column uses `REQUIRED`, `RECOMMENDED`, `OPTIONAL`, or a simple yes/no.

### 8.2 Schema Reference Injection

For sections that describe the structure of a JSON document, use the `schema-ref` marker system to inject generated property tables from the JSON Schema:

```markdown
<!-- schema-ref:start id=[unique-id] schema=schemas/[name].schema.json pointers=# -->
<!-- generated:schema-ref id=[unique-id] -->
| Pointer | Field | Type | Required | Notes | Description |
|---|---|---|---|---|---|
... (generated content) ...
<!-- schema-ref:end -->
```

**Rules:**

- The `id` is a document-unique identifier for the schema reference block.
- The `schema` path is relative to the repository root.
- The `pointers` value specifies which JSON Pointer paths to include (`#` means the root object; specific paths like `#/$defs/FieldRule` target sub-definitions).
- Content between `<!-- generated:schema-ref ... -->` and `<!-- schema-ref:end -->` is machine-generated by `npm run docs:generate`. Do NOT hand-edit.
- After the generated table, you MAY add prose that elaborates on behavioral semantics the schema cannot express.

**Example** (Registry spec S2):

```markdown
A Registry Document is a JSON object at the top level with the following
properties:

<!-- schema-ref:start id=registry-top-level schema=schemas/registry.schema.json pointers=# -->
... (generated) ...
<!-- schema-ref:end -->
```

---

## 9. Examples and YAML/JSON Conventions

### 9.1 JSON Example Format

All JSON examples use the following conventions (stated in spec prose):

1. JSON property names are enclosed in double quotes per RFC 8259.
2. Comments of the form `// description` appear for explanatory purposes only. Comments are not valid JSON.
3. Ellipsis (`...`) within an object or array indicates omitted properties.
4. Property values that are strings use `"double quotes"`.

### 9.2 Inline Examples

Short examples appear inline within the specification text, wrapped in fenced code blocks with a `json` language tag:

````markdown
```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://agency.gov/forms/budget",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  }
}
```
````

### 9.3 Complete Examples

Complete, self-contained examples appear in:

- An **Examples** section (typically one of the last numbered sections), or
- An **Appendix** (e.g., "Appendix A: Full Example -- Budget Form").

Complete examples MUST be valid against the corresponding JSON Schema.

**Writing good examples:**

An example exists to teach, not just to validate. Every complete example should demonstrate at least one non-obvious behavior or interaction — a feature that a reader would not infer from the property tables alone.

- Bad: Minimal boilerplate that validates but shows only required properties with placeholder values.
- Good: A realistic document (e.g., a grant-processing form) that exercises conditional logic, cross-field Shapes, and at least one optional feature.
- One excellent, realistic example is worth more than three minimal ones.
- Use comments (`// description`) to highlight the non-obvious parts — explain why a value is set, not what the property name means.

### 9.4 PEG Grammar Examples

The FEL Grammar spec (`specs/fel/fel-grammar.md`) uses PEG notation in fenced code blocks with a `peg` language tag:

````markdown
```peg
Expression     <- _ OrExpr _
OrExpr         <- AndExpr (_ 'or' _ AndExpr)*
```
````

---

## 10. Appendices

### 10.1 Appendix Naming

Appendices use letter designations: `Appendix A`, `Appendix B`, etc. They are `##` (H2) headings.

**Pattern:**

```markdown
## Appendix A: Full Example -- Budget Form
## Appendix B: Component Quick Reference
## Appendix C: DataType <-> Component Compatibility
```

**Default:** Use colon separators (`Appendix A: Title`). See `legacy-cleanup.md` for specs that use em-dash.

### 10.2 Common Appendix Types

| Type | Content | Examples |
|------|---------|----------|
| Full Example | Complete, valid document demonstrating all features | Component Appendix A, Locale Appendix A |
| Quick Reference | Condensed lookup table | Component Appendix B |
| Compatibility Matrix | Cross-reference table for types or components | Component Appendix C, Theme Appendix B |
| References | Normative and informative reference citations | Extension Registry Appendix B, Ontology Appendix A |
| Migration Guide | How to migrate from a prior mechanism | Screener Appendix A |
| Requirements Traceability | Mapping from requirements to spec sections | Core Appendix A |
| Lineage/History | Design history and prior art acknowledgment | Ontology Appendix B |

### 10.3 References Appendix

When a spec includes a references appendix, use a table format:

```markdown
## Appendix [N] -- References

| Tag | Reference |
|---|---|
| [rfc2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997. |
| [RFC 8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017. |
| [RFC 8259] | Bray, T., Ed., "The JavaScript Object Notation (JSON) Data Interchange Format", STD 90, RFC 8259, December 2017. |
```

**Default:** Use the appendix table format for specs with more than 5 references. For specs with fewer, inline link definitions at the end of the Conventions section are acceptable.

---

## 11. Writing Quality

### 11.1 Normative Prose Style

Normative requirements should be written for testability. A requirement that cannot be tested is a requirement that will be interpreted differently by every implementer.

**Good normative prose:**

- Active voice, single subject: "A conformant processor MUST reject a Response whose `definitionVersion` does not match the loaded Definition."
- Testable: you can write a test that passes a mismatched Response and verifies rejection.
- Specific: names the property, the condition, and the expected behavior.

**Bad normative prose:**

- Passive voice: "Responses should be properly validated." (By whom? Against what? What does "properly" mean?)
- Untestable: "The processor MUST handle edge cases correctly." (Which edge cases? What is "correctly"?)
- Compound: "The processor MUST validate the Response, update the case file, and emit a provenance record." (Split into three MUST statements — each is independently testable.)

### 11.2 Property Table Descriptions

Property table descriptions should be one sentence for structural properties, two sentences max for behavioral properties. The first sentence says what it is; the second says what the processor does with it.

- Good: "Canonical URI identifier for this Definition. Stable across versions — the pair (url, version) SHOULD be globally unique."
- Bad: "This is the URL." (Useless — the column name already says `url`.)
- Bad: A 5-sentence paragraph in a table cell. (Move behavioral detail to prose after the table.)

### 11.3 Rationale and "Why" Sections

Normative sections state what. Rationale explains why. Keep them separate. Do not embed justification inside a MUST requirement — it muddies the normative force. Instead:

```markdown
A conformant processor MUST NOT evaluate Shapes for non-relevant fields.

*Rationale: Non-relevant fields are logically absent from the form.
Validating absent data produces false positives that erode trust
in the validation report.*
```

---

## 12. Cross-Specification Conflict Resolution

When two Formspec-org specs make requirements that could interact (e.g., Assist constrains mutations, a governance spec constrains the same mutations), the following precedence applies:

1. **Core processing model** — highest priority. No companion or add-on spec may override the four-phase cycle (Core S2.4) or its outputs.
2. **Companion spec requirements** — companion specs add constraints; they do not relax Core constraints. If Assist says "MUST NOT write to readonly" and a governance spec says "MAY override readonly under authority," the Assist constraint wins unless the governance spec explicitly states it operates outside the Assist protocol boundary (i.e., before Assist is invoked).
3. **Add-on spec requirements** — same as companions but with lower editorial authority (pre-1.0 specs cannot override 1.0 spec requirements).

When designing a companion framework (like WOS) that wraps multiple Formspec protocols, state explicitly which layer your requirements operate at and cite the Formspec specs they interact with. Do not create implicit overrides.

---

## 13. Security Considerations

**Required:** RECOMMENDED for all companion and add-on specs.

A Security Considerations section addresses trust, URI resolution, injection, and privacy concerns specific to the spec.

**Common topics** (extracted from existing specs):

- **URI resolution:** Agents and renderers MUST NOT blindly fetch arbitrary URIs. Maintain allowlists.
- **Inline content:** Treat as untrusted data. Sanitize before display.
- **Credential exposure:** URIs MUST NOT contain credentials.
- **Prompt injection:** Agent-facing content could contain adversarial text.
- **Circular resolution:** Guard against loops in reference chains.
- **Information disclosure:** Metadata may reveal data model details.
- **Document provenance:** Loading documents from untrusted sources.

Place Security Considerations near the end of the spec, after Conformance and Extension Points but before Appendices.

---

## 14. Specification Categories

### 14.1 Core Specification

There is one Core specification (`specs/core/spec.md`). It defines the foundational data model, expression language, validation framework, processing model, and extension mechanism. It stands alone -- it is not "companion to" anything.

### 14.2 Companion Specifications

A companion specification defines a sidecar document type or protocol that extends the Formspec ecosystem without modifying Core semantics. Companion specs:

- Declare `**Companion to:** Formspec v1.0` in their metadata.
- Include the additive invariant (S5.4).
- Define conformance levels where a Core processor MAY ignore them entirely.
- Produce JSON documents with a `$formspec[Name]` document type marker.

Existing companions: Theme, Component, Mapping, Extension Registry, Changelog, FEL Grammar, Screener, Assist, References, Locale, Ontology.

### 14.3 Add-On Specifications

An add-on specification is more experimental or domain-specific than a companion. It may use a different versioning scheme (e.g., `v0.1` instead of `v1.0`) and may have a lighter editorial voice. The Respondent Ledger is the current example.

Add-ons follow the same structural conventions as companions but may:

- Use a pre-1.0 version number.
- Include `Audience:` in the metadata.
- Use a more informal tone in rationale sections.

### 14.4 Normative Grammar Documents

The FEL Grammar (`specs/fel/fel-grammar.md`) is a normative grammar companion. It is smaller and more focused than other specs:

- States "Normative companion to Formspec v1.0 S3" in its metadata.
- Defines syntax only, not semantics (semantics live in Core S3).
- Uses PEG formalism with its own notation section.
- Ends with `*End of normative grammar.*`.

---

## 15. Document Lifecycle

### 15.1 Generated Artifacts

The following files are generated by tooling and MUST NOT be hand-edited:

| Artifact | Generated By | Source |
|----------|-------------|--------|
| `*.llm.md` | `npm run docs:generate` | Canonical spec `.md` |
| `*.semantic.md` | `npm run docs:generate` | Canonical spec `.md` |
| BLUF injection (between markers) | `npm run docs:generate` | `*.bluf.md` file |
| Schema reference tables | `npm run docs:generate` | `schemas/*.schema.json` |
| `filemap.json` | `npm run docs:filemap` | Source file analysis |

### 15.2 Authoring Workflow

For any spec or schema change:

1. Edit the canonical spec prose (`.md`), BLUF file (`.bluf.md`), and/or schema (`.schema.json`) as needed.
2. Run `npm run docs:generate`.
3. Run `npm run docs:check` to verify consistency.

### 15.3 End-of-Document Markers

Some specs include a closing marker:

```markdown
*End of Part 3 -- Sections 7-9.*
```

or:

```markdown
*End of normative grammar.*
```

This is OPTIONAL but helpful for very long documents to signal the end of a logical unit.

---

## 16. Naming Conventions Summary

| Context | Convention | Examples |
|---------|-----------|----------|
| Spec file names | `[name]-spec.md` or `[name].md` | `theme-spec.md`, `spec.md`, `fel-grammar.md` |
| BLUF file names | `[name]-spec.bluf.md` | `theme-spec.bluf.md` |
| LLM artifact names | `[name]-spec.llm.md` | `theme-spec.llm.md` |
| Schema file names | `[name].schema.json` | `theme.schema.json`, `definition.schema.json` |
| JSON property names | camelCase | `targetDefinition`, `widgetHint`, `dataType` |
| Document type markers | `$formspec[PascalName]` | `$formspec`, `$formspecTheme`, `$formspecMapping` |
| Extension identifiers | `x-` prefix | `x-respondentLedger`, `x-constraint-satisfaction` |
| Item keys | camelCase or snake_case | `firstName`, `budget_section` |
| Conformance rule IDs | `[XX]-[NN]` (2-letter prefix, sequential number) | `SC-01`, `VP-01`, `AD-01` |
| Section references (same spec) | `SN.M` or `(SN.M)` | `S4.3`, `(S5.6)` |
| Section references (other spec) | `[spec name] SN.M` | `core S4.2.5`, `Theme S3` |

---

*End of Formspec-Org Specification Style Guide.*
