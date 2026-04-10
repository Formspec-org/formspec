---
name: formspec-companion-authoring
description: Use when authoring a new Formspec-org specification, companion spec, add-on spec, or schema — or when reviewing an external spec for Formspec integration correctness. Triggers on "write a spec", "create a companion spec", "author a schema", "does this spec align with Formspec", "review this spec for Formspec compatibility", "spec style", "schema conventions", "how do Formspec specs work", or any task producing normative specification prose or JSON Schema for the Formspec ecosystem.
---

# Formspec Companion Spec Authoring

Author specifications and schemas that belong in the Formspec-org family. Two reference docs provide the conventions; this skill provides the decision framework for applying them.

## Reference Documents

- `spec-style-guide.md` — W3C-style specification authoring conventions (document structure, normative language, conformance sections, cross-spec references, BLUF patterns, property tables, naming)
- `schema-authoring-guide.md` — JSON Schema authoring conventions (`$formspec*` markers, `x-lm` annotations, `$defs`, extension model, schema-spec alignment, validation patterns)

Read the relevant reference doc before authoring. Do not guess at conventions.

## The Four Rules

### 1. Additive Only

Every Formspec companion spec follows the additive invariant:

> "MUST NOT affect data capture, validation, or the processing model."

Your spec adds capability. It never redefines core semantics. A Formspec processor that ignores your companion spec produces identical data/validation results.

Variants by spec (from the reference docs):
- Assist: "MUST NOT change core response, validation, calculation, or relevance semantics"
- References/Ontology: "MUST NOT affect data capture, validation, or the processing model"
- Respondent Ledger: "The Response stays canonical; ledger replay is never required to interpret a Response"

### 2. Cite, Never Restate

When your spec depends on Formspec behavior (processing model, FEL evaluation, Assist protocol, version pinning), cite the normative section number. Do not restate the semantics in your own words. Restatement creates normative divergence.

- **Do:** "Responses are validated against their pinned Definition version (Core S6.4, VP-01)."
- **Don't:** "The system validates the response against the version of the definition that was active when the response was created." (subtly wrong — pinned, not "active when created")

### 3. Delegate Processing

If your spec uses Formspec Definitions, your processor delegates to a Formspec-conformant processor for Definition evaluation. Your spec never specifies how the four-phase cycle works — it hands a Definition to something that already implements it.

### 4. Use Canonical Terminology

Formspec terms have precise normative definitions. Use them exactly:
- "Assist Provider" not "Formspec Assist Provider"
- "VP-01 (Core S6.4)" not "the Formspec Pinning Rule"
- "Impact Classification (Changelog S4)" not "Formspec-style impact classification"

## Spec Categories

| Category | Relationship to Core | Examples |
| --- | --- | --- |
| **Core** | Is the foundation | Core spec, FEL Grammar |
| **Companion** | Adds a sidecar document type; standalone URL + version | Mapping DSL, Screener, Assist, References, Ontology, Locale |
| **Add-on** | Extends the Response or processing model lightly | Respondent Ledger |
| **Companion Framework** | Uses Formspec as a substrate for a different domain | WOS (workflow orchestration) |

## Authoring Workflow

1. **Read the style guide** for document structure, normative language, and conformance patterns.
2. **Read the schema guide** if your spec introduces a new document type with a JSON Schema.
3. **Declare relationship to Core** in your Introduction (Section 1). State the additive invariant in your spec's own words.
4. **Define conformance roles** (Section 2). Who implements what? Provider/Consumer, Core/Extended, or your own tiers.
5. **Write property tables** using the standard format (Property | Type | Required | Description).
6. **Include at least one complete example** per major structure (YAML or JSON).
7. **Run `npm run docs:generate`** if your spec introduces a schema. Run `npm run docs:check` to validate.
8. **Cross-reference precisely.** Use "Spec-Name S#.#" format for every normative reference to another Formspec spec.

## Companion Framework Checklist

For specs like WOS that use Formspec as a substrate (not just a sidecar):

- [ ] State the additive invariant: your framework MUST NOT alter core processing semantics
- [ ] Declare which Formspec conformance tier your processors must implement
- [ ] Add normative statement: processors MUST delegate Definition evaluation to a Formspec-conformant processor
- [ ] FEL usage: use existing built-in functions (Core S3.5) and extension functions (Core S3.12) — do not define new grammar
- [ ] If wrapping the Assist protocol, frame it as your construct consuming Assist, not as a Formspec concept
- [ ] If elevating a SHOULD to MUST (e.g., Ledger checkpoints), state this explicitly as a requirement of your conformance context
- [ ] Map your provenance/audit to Formspec artifacts (ValidationReport, Respondent Ledger events) by section reference
- [ ] Address the Screener spec if your framework does routing/classification
- [ ] Use Changelog S4 impact classification for any version migration semantics
