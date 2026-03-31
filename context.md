---
title: Formspec — Project Context
description: >
  The canonical source of truth for Formspec's features, design reasoning,
  architectural vision, target audiences, and project roadmap. Intended for
  both human contributors and AI agents as the single document that answers
  "what is Formspec, why does it exist, and where is it going?"
purpose:
  - Feature inventory — what Formspec does and how the pieces fit together
  - Design reasoning — why each architectural choice was made
  - Vision and roadmap — where the project is headed and what's next
  - Conceptual grounding — the mental model behind the spec, not just the spec itself
  - Audience alignment — who this is for and what problems it solves for them
audience:
  - New contributors and maintainers seeking project orientation
  - AI agents needing full-context project understanding
  - Stakeholders evaluating Formspec's scope and direction
status: living document — update as the project evolves
---

# Formspec — Project Context

## What Is Formspec?

Formspec is an open-source, JSON-native declarative form specification. It targets high-stakes, low-connectivity environments: grant applications, field inspections, compliance reporting, and clinical intake.

It is a **specification**, not a platform. A single JSON definition renders on web, React, iOS, and server-side without modification. The specification is the normative source of truth; reference implementations are derived from it, not the other way around.

The specification is organized into three tiers:
- **Core** — data model, field logic, validation, expressions (FEL)
- **Theme** — presentation tokens, widget catalog, page layout
- **Components** — 33 built-in interaction components, slot binding, responsive design

Two reference implementations exist: TypeScript (client-side engine + web component + React hooks) and Python (server-side evaluation, linting, mapping). A Rust shared kernel (compiled to WASM and PyO3) ensures identical evaluation across all platforms.

**Project status:** Pre-release, open source (AGPL-3.0). No production users yet.

---

## Who It's For

Formspec targets four primary audiences:

1. **Form Authoring Teams** — Build 200-field forms in minutes via AI-powered structured tool calls (MCP server with ~48 typed tools). Three validation layers catch errors automatically. Human review stays in the loop.

2. **Grant Program Managers** — Complex conditional logic, built-in calculations (base-10 decimal arithmetic — `$0.10 + $0.20 = $0.30`, not `$0.30000000000000004`), multi-format output (JSON/XML/CSV via the Mapping DSL), contextual help via References and Ontology sidecars. Version-locked definitions prevent mid-cycle rule changes from invalidating submissions.

3. **Field Operations** — Offline-first with on-device validation (the Rust/WASM kernel evaluates locally — no server round-trip needed). Native rendering on iOS (Swift/SwiftUI); Android (Kotlin/Compose) architecture is finalized. Multilingual support via Locale Documents — add languages by adding files, never edit originals. Warning/error distinction lets inspectors flag issues without blocking submission.

4. **Agency Evaluators** — AGPL-3.0 open source. No vendor lock-in. Designed to support WCAG 2.2 AA conformance with built-in accessibility primitives. USWDS adapter included; headless architecture supports Bootstrap, Tailwind, Material, and custom design systems. Spec-defined interoperability.

The primary site audience is **non-technical form managers**, not developers — though developers get dedicated technical depth (architecture, code examples, extension points).

---

## Key Differentiators

1. **Specification, not platform** — Portable, vendor-independent, version-controlled definitions
2. **One definition, multiple runtimes** — Identical behavior on web, React, iOS, and server, including offline. Android is architecture-finalized.
3. **Deterministic expressions** — FEL is auditable, statically analyzable, non-Turing-complete, with base-10 decimal arithmetic
4. **Separation of concerns** — Ten independent document types (Definition, Theme, Component, Locale, References, Ontology, Registry, Mapping, Changelog, Assist), each with its own authoring team and review cycle
5. **AI-safe by design** — Typed tool calls + schema validation + static linting = trustworthy AI-generated forms
6. **High-stakes focus** — Built for grants, compliance, clinical, inspection — not contact forms or surveys
7. **Accessibility-aware** — Designed for WCAG 2.2 AA conformance; accessibility primitives (ARIA, keyboard navigation, focus management) built into the behavior layer. USWDS adapter for federal projects.
8. **Semantic data** — Ontology layer gives fields machine-readable identity, enabling deterministic AI data engineering
9. **Non-relevant field handling** — Configurable per-bind `nonRelevantBehavior` (remove/empty/keep) controls what happens to data when fields become irrelevant — a nuance most form specs ignore

---

## Core Architecture

### Rust Shared Kernel

FEL parsing/evaluation, validation semantics, coercion, mapping execution, and lint rules live in Rust crates (`fel-core`, `formspec-core`, `formspec-eval`, `formspec-lint`). Compiled to:
- **WASM** — browser and TypeScript engine (this is how offline validation works: the kernel runs on-device)
- **PyO3** — Python server-side evaluation
- **Future: UniFFI** — native mobile FFI without WebView bridge

The TypeScript engine (`FormEngine`) handles reactive state management via Preact Signals. The Rust kernel handles all spec business logic. This hybrid avoids rewriting the reactive layer while eliminating double-implementation maintenance.

### Runtimes

| Runtime | Package | Status | Technology |
|---------|---------|--------|------------|
| Web Component | `formspec-webcomponent` | Shipped | `<formspec-render>` custom element, accessibility primitives |
| React | `formspec-react` | Shipped | Hooks-first (`useField`, `useFieldValue`), bring-your-own-components |
| iOS/macOS | `formspec-swift` | Shipped | SwiftUI renderer with WebView bridge |
| Android | `formspec-kotlin` | Architecture finalized | Jetpack Compose renderer with WebView bridge (planned) |
| Python | `formspec-py` | Shipped | Server-side re-validation, linting, mapping |

Same JSON definition, same Rust kernel evaluation, native UI on each platform. Zero validation divergence — guaranteed by the shared Rust kernel.

### FEL (Formspec Expression Language)

Purpose-built, non-Turing-complete expression language for calculated values and conditional logic. Design synthesis of Power Fx syntax + JSONata's JSON model + XForms' bind semantics.

Key properties:
- **Deterministic** — side-effect-free; individual expressions always terminate (no loops, no recursion, no I/O)
- **Spreadsheet-familiar** — `sum(items[*].amount)`, not map/reduce
- **Form-domain-specific** — `$quantity` auto-scopes to current repeat row; `valid()`, `relevant()`, `readonly()` query bind state; `let`/`if-then-else` for inline conditionals
- **Statically analyzable** — dependency extraction, circular reference detection, type checking at author time
- **Base-10 decimal arithmetic** — financial calculations are exact, not floating-point

### Processing Model

The engine evaluates form state in a four-phase reactive cycle:
1. **Rebuild** — reconstruct the item tree (repeat instances, relevance)
2. **Recalculate** — re-evaluate all `calculate` expressions in dependency order
3. **Revalidate** — run bind constraints and shape rules
4. **Notify** — push changes to subscribers (UI, signals)

This cycle runs until stable, with a convergence cap of 100 iterations to prevent infinite loops from circular calculations.

### Validation

Two mechanisms:
- **Bind constraints** — field-level: required, constraint, readonly, calculate, default
- **Shape rules** — cross-field/form-level constraints with per-shape validation timing

`ValidationReport` contains structured results with severity levels (error/warning/info), constraint kinds, and path-based field targeting with wildcard support.

Non-relevant fields receive special treatment: validation is suppressed, and the `nonRelevantBehavior` property (remove/empty/keep) controls whether their data is preserved, cleared, or excluded from the response.

### Extension Model

Extensions use an `x-` namespace prefix and resolve against loaded registry entries. The Registry spec defines extension publishing, discovery, and lifecycle. Unresolved extensions emit validation errors — they don't silently pass through. Extension functions can be registered and called from FEL expressions.

---

## Companion Documents (Sidecar Architecture)

Formspec separates concerns into independent, composable sidecar documents — files that ship alongside a Definition, each authored, reviewed, and versioned separately by different teams:

| Document | Purpose |
|----------|---------|
| **Definition** | Data model, fields, logic, validation rules |
| **Theme** | Visual presentation tokens, widget catalog, page layout |
| **Component** | Interaction widgets, slot binding, responsive design |
| **Locale** | Translations with cascade fallback (regional → language → inline). Supports FEL expressions in strings and context suffixes (`@accessibility`, `@pdf`) for variant text |
| **References** | Per-field bibliography: regulations, help articles, vector stores, tools. Audience-tagged (human/agent/both) so AI assistants and human readers get different context |
| **Ontology** | Concept identity: stable URIs with cross-system equivalences (FHIR, schema.org, coding standards). Transforms "what does this field mean?" from inference to lookup |
| **Registry** | Extension publishing, discovery, lifecycle |
| **Mapping** | Bidirectional output transforms. Submit once, get JSON, XML, and CSV — no re-entry, no export macros. The Mapping DSL defines field-level transforms, value maps, and coercion rules |
| **Changelog** | Change objects, impact classification, migration generation |
| **Assist** | Form-filling interoperability: tool catalog, profile-matching algorithm, and transport bindings for AI/extension-assisted completion |

---

## AI Integration

### Authoring (MCP Server)

~48 typed tools for structured form building. AI generates forms through constrained tool calls, not freeform text. Three verification layers:
1. **Tool schemas** — reject invalid field types before execution
2. **JSON Schema validation** — catch structural errors
3. **Static linting** — catch semantic errors (undefined references, circular dependencies, type mismatches)

FEL's determinism means AI-generated expressions are auditable and statically verifiable — the linter catches plausible-but-wrong bugs before they reach a human.

### Filling (Formspec Assist)

14 tools across 5 categories (introspection, mutation, validation, profile, navigation) help people understand and complete forms using metadata the form already carries. This is where the References and Ontology sidecars pay off: an AI assistant resolving "what does EIN mean?" performs a deterministic lookup against the Ontology's concept URIs, not a probabilistic guess from training data.

Key capabilities:
- **Field help** — regulations, examples, concept identity pulled from References
- **Profile matching** — auto-fill from saved profiles using semantic concept identity (not field name heuristics)
- **Context resolution** — deterministic, grounded in form metadata
- **Transport-agnostic** — works over postMessage, WebMCP (W3C draft), MCP, HTTP

For the primary audience (grant program managers, field ops), the filling side matters as much as the building side — their users struggle with 50-page grant applications, not with authoring them.

### Studio

Real-time AI form building with human review. Visual editor + AI agent collaboration. Preview, validate, deploy from a single interface.

---

## Prior Art

Formspec is a synthesis, not a reinvention. The design team decomposed XForms, SHACL, FHIR, JSON Forms, SurveyJS, and ODK into 517 testable features. 98 critical features are all Adopted or Adapted from prior art.

| Standard | What Formspec Adopts |
|----------|---------------------|
| XForms | Instance/bind separation, Model Item Properties |
| SHACL | Validation shapes, cross-field constraints |
| FHIR | Versioning model, extension registry |
| ODK | Readability, field-first ergonomics |
| SurveyJS | Expression validation patterns |
| JSON Forms | JSON Schema grounding |

---

## Example

A minimal grant budget form definition (5 fields, 2 binds):

```json
{
  "formspec": "1.0",
  "meta": { "title": "Grant Budget", "id": "grant-budget-v1" },
  "items": [
    { "key": "org_name", "type": "string", "label": "Organization Name" },
    { "key": "personnel", "type": "number", "label": "Personnel Costs" },
    { "key": "travel", "type": "number", "label": "Travel Costs" },
    { "key": "equipment", "type": "number", "label": "Equipment Costs" },
    { "key": "total", "type": "number", "label": "Total Budget", "readonly": true }
  ],
  "binds": [
    { "target": "total", "calculate": "$personnel + $travel + $equipment" },
    { "target": "total", "constraint": ". <= 500000", "constraintMsg": "Total budget must not exceed $500,000" }
  ]
}
```

`$personnel` references the field value. The `calculate` bind auto-computes the total. The `constraint` bind enforces a ceiling. All of this evaluates identically on every runtime.

---

## What Formspec Is Not

Formspec is a **form engine** — data, logic, validation, rendering. It defines what forms are and how they behave.

It is **not**:
- A form builder SaaS (Studio is a reference implementation, not a hosted product)
- A drag-and-drop UI builder
- A workflow engine (submission routing, approvals, notifications are your stack)
- A database (it produces structured responses; where you store them is up to you)
- Hosting, auth, or infrastructure

---

## How We Talk About This

The project communicates with an **evidence-based, principled stance**:
- Heavy citations of prior art; scorecards showing what was adopted vs. adapted vs. novel
- Honest about tradeoffs (WASM call overhead, WebView bridge latency, bundle size costs)
- "We evaluated X and chose Y because..." — every decision is reasoned, not dogmatic
- Pain-first messaging: opens with friction, closes with proof
- Targets both architects (deep specification dives) and practitioners (grant officers, form fillers)

---

## Resources

- **Repository:** `github.com/formspec/formspec` (AGPL-3.0)
- **Specifications:** `specs/` directory — Core, FEL Grammar, Theme, Component, Mapping, Registry, Locale, References, Ontology, Assist, Changelog
- **Schemas:** `schemas/` — JSON Schema files for all document types
- **API docs:** `docs/api/` or regenerate with `make api-docs`
- **LLM-optimized specs:** `specs/**/*.llm.md` — compact summaries for AI context injection
