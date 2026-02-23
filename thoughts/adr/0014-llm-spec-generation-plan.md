# ADR 0014: Schema-Centric Spec Compilation Workflow

## Status
Proposed - replaces the prior markdown-only LLM extraction approach previously captured under ADR 0014.

## Objective
Eliminate schema/spec drift while improving LLM structured-output quality by making each JSON Schema file a rich, canonical source for structural truth and generation guidance.

## Context
The previous workflow treated full markdown specs as the primary editable source and generated `*.llm.md` via section omission. That reduced manual duplication for LLM docs but still left recurring drift risk between:
1. Normative markdown property tables.
2. JSON Schema constraints.
3. LLM-focused summaries.

Given current usage, richer schema annotations improve downstream model output quality. The system should treat documentation as compiled views over canonical contracts, not parallel sources.

## Decision
Adopt a schema-centric compilation pipeline with strict source boundaries:
1. `schemas/*.json` are canonical for structural constraints and LM-facing field guidance.
2. `specs/**/*.md` remain canonical for normative behavior semantics that schemas cannot express (processing model, FEL semantics, conformance behavior).
3. Generated artifacts are never hand-edited: injected spec sections, schema reference docs, and `*.llm.md`.

One schema per domain is required. No lean/secondary schema variants.

## Source-of-Truth Contract

### 1. Fat Schema Policy
Every domain schema may include:
1. Validation keywords: `type`, `enum`, `const`, `required`, `pattern`, bounds, `if/then`, `$ref`, etc.
2. Standard annotations: `title`, `description`, `examples`, `deprecated`, `$comment`.
3. Optional custom LM hint block: `x-lm` (annotation-only, no validation semantics).

`x-lm` SHOULD stay compact and focused on generation quality:
```json
{
  "x-lm": {
    "critical": true,
    "intent": "One sentence describing the field role.",
    "commonMistakes": ["..."],
    "preferredPatterns": ["..."],
    "relatedPointers": ["#/..."]
  }
}
```

### 2. Markdown Policy
1. `spec.md` contains full normative text and remains human-readable.
2. `<spec-file>.bluf.md` stores the bottom-line-up-front summary per spec (for example `theme-spec.bluf.md`).
3. `<spec-file>.llm.md` is generated and intentionally short: BLUF + critical schema tables + minimum semantics.

## Composition Contract

### 1. BLUF Injection
Each canonical spec uses explicit markers:
```md
<!-- bluf:start file=theme-spec.bluf.md -->
<!-- bluf:end -->
```

Generator behavior:
1. Replace marker block content with the referenced BLUF file.
2. Fail if the referenced file is missing.
3. Preserve stable formatting.

### 2. Schema Reference Injection
Canonical specs may include generated schema blocks:
```md
<!-- schema-ref:start id=core-top-level schema=schemas/definition.schema.json pointers=#/properties -->
<!-- schema-ref:end -->
```

Generator behavior:
1. Resolve listed JSON Pointers against the target schema.
2. Render deterministic markdown tables.
3. Include pointer links in each generated row.

## JSON Pointer Linking Policy
Pointers are mandatory in generated content and selective in hand-authored prose:
1. Generated docs must have 100% pointer coverage for structural critical nodes:
   - `required` fields
   - enum-constrained fields
   - pattern-constrained fields
   - defaults
   - conditionals (`if/then`)
   - nodes marked `x-lm.critical=true`
2. Hand-authored narrative sections should link at section scope, not sentence scope.
3. Pointer resolution failures are build-breaking.

## Tooling and Commands
Add/standardize scripts:
1. `docs:generate`
   - inject BLUF blocks
   - generate schema reference sections
   - generate `*.llm.md`
2. `docs:check`
   - run generation in check mode
   - fail on any stale output

## Critical Gates
CI must fail on only these gates:
1. `docs:check` freshness gate (stale generated files fail).
2. JSON Pointer integrity gate (all referenced pointers must resolve).
3. Critical annotation gate:
   - for every node with `x-lm.critical=true`, require `description` and `examples` with at least one item.
4. Cross-spec contract gate (`tests/test_cross_spec_contracts.py` must pass).

## Rollout Plan

### Phase 1: Pilot
Apply to:
1. `schemas/response.schema.json`
2. `schemas/theme.schema.json`
3. `schemas/mapping.schema.json`

Deliverables:
1. `<spec-file>.bluf.md` files for pilot specs.
2. Injected BLUF blocks and schema refs in canonical markdown.
3. Generated compact `*.llm.md`.

### Phase 2: Core Expansion
Apply to:
1. `schemas/definition.schema.json`
2. `schemas/registry.schema.json`
3. `schemas/changelog.schema.json`
4. `schemas/validationReport.schema.json`

### Phase 3: Component Expansion
Before enabling full generation for components:
1. Raise annotation depth in `schemas/component.schema.json`.
2. Mark critical nodes with `x-lm.critical`.
3. Enable full pointer-linked generated refs.

### Phase 4: Enforcement Tightening
1. Move all checks to hard CI failures.
2. Add contributor guidance in `CLAUDE.md`:
   - edit schemas for structural truth
   - do not hand-edit generated blocks/files

## Acceptance Criteria
1. Structural tables in specs are generated from schema, not hand-maintained.
2. One rich schema exists per domain (no duplicate lean schema).
3. All four Critical Gates are implemented and enforced as hard failures.
4. At least one full pilot spec passes editorial review for readability and no normative loss.

## Risks and Mitigations
1. Risk: schema bloat harms readability.
   - Mitigation: keep `x-lm` concise; move long rationale to `spec.md`.
2. Risk: over-reliance on generated structure hides semantic gaps.
   - Mitigation: preserve hand-authored normative sections and cross-spec tests.
3. Risk: build complexity grows.
   - Mitigation: one deterministic generator pipeline with strict checks, no optional paths.
