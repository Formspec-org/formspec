# Formspec

**A declarative form specification where structure, behavior, and presentation are independent, composable JSON documents.**

Formspec separates *what data to collect* from *how it behaves* from *how it looks*. A single definition drives validation, computed fields, conditional logic, and repeatable sections across any runtime — browser, server, mobile, offline — without coupling to a rendering technology. Every artifact is a JSON document backed by a JSON Schema, making the entire system machine-readable by construction.

## Architecture

### The Specification as Abstraction Boundary

Formspec inverts the usual dependency between frontend and backend. Neither implementation knows about the other — both depend inward on the specification:

```
                  ┌─────────────────────────────┐
                  │     Formspec Specification    │
                  │                               │
                  │  schemas/    (structural truth)│
                  │  specs/      (behavioral truth)│
                  │  FEL grammar (expression truth)│
                  └──────────┬──────────┬─────────┘
                             │          │
              ┌──────────────┘          └──────────────┐
              ▼                                        ▼
   ┌─────────────────────┐              ┌─────────────────────────┐
   │  TypeScript Engine   │              │  Python Implementation   │
   │                      │              │                          │
   │  Reactive signals    │              │  CLI & server tooling     │
   │  FEL compiler        │              │  FEL compiler            │
   │  Live validation     │              │  Static linting          │
   │                      │              │  Mapping engine           │
   └──────────┬───────────┘              └──────────────────────────┘
              │
              │  (presentation boundary — any renderer)
              ▼
   ┌─────────────────────┐
   │  Web Component       │  ← included adapter
   │  React, Mobile,      │  ← build your own
   │  PDF, Server-render  │
   └──────────────────────┘
```

The specification — schemas, normative prose, and FEL grammar — is the stable abstraction that both runtimes implement against. The TypeScript engine and Python evaluator share no code, but produce identical results for the same definition and data because they conform to the same contracts. A form submitted in the browser can be re-validated on the server with full confidence in semantic equivalence.

This inversion runs deeper than just client/server. The TypeScript side itself has a dependency boundary: the **engine** (state, FEL, validation) is a pure logic layer with no DOM dependency. The **web component** is one possible presentation adapter — it reads engine signals and dispatches to a plugin registry. The engine is designed to drive any rendering surface: a React component tree, a native mobile form, a PDF generator, or a server-rendered page. Build a new presentation layer by subscribing to engine signals; the behavioral core doesn't change.

### Document Layers

The specification is organized as composable document layers. Each adds a concern without modifying the layers below.

```
╔══════════════════════════════════════════════════════════════════╗
║  DEFINITION (Core)                                               ║
║  Structure: items (fields, groups, displays)                     ║
║  Behavior:  binds (calculate, relevant, required, readonly)      ║
║             shapes (composable cross-field validation rules)     ║
║  Language:  FEL expressions throughout                           ║
╠══════════════════════════════════════════════════════════════════╣
║  THEME SIDECAR (Presentation)                                    ║
║  Design tokens, widget catalog, selector cascade, grid layout    ║
║  Multiple themes per definition (web, mobile, print, kiosk)      ║
╠══════════════════════════════════════════════════════════════════╣
║  COMPONENT SIDECAR (Interaction)                                 ║
║  Explicit component tree, slot binding, responsive breakpoints   ║
║  34 built-in components + custom templates                       ║
╠══════════════════════════════════════════════════════════════════╣
║  COMPANION SPECS                                                 ║
║  Mapping DSL · Extension Registry · Changelog Format · FEL Grammar║
╚══════════════════════════════════════════════════════════════════╝
```

Presentation layers (Theme, Components) never affect data collection, validation, or behavioral semantics. They are swappable overlays on an immutable behavioral core.

### FEL (Formspec Expression Language)

A small, deterministic expression language embedded in bind and shape declarations. FEL handles calculated fields, conditional visibility, cross-field constraints, and aggregation — no custom code required. Defined once as a PEG grammar with 40+ stdlib functions, implemented identically in both runtimes.

### Runtime Architectures

**Client (TypeScript)** — The engine compiles FEL expressions, builds a reactive dependency graph using Preact Signals, and maintains live state for every field (value, relevance, required, readonly, validation). User input flows through `setValue()` → signals recompute → the web component's effects update the DOM. On submit, `getResponse()` + `getValidationReport()` produce schema-valid JSON documents ready for server-side re-verification.

**Server (Python)** — A CLI and library toolkit for offline and server-side use. The Python package is a plain library — import it into any backend framework:

```python
# FastAPI example
from formspec.evaluator import DefinitionEvaluator
from formspec.validator import lint

@app.post("/submit")
def submit(definition: dict, data: dict):
    # Re-verify submitted data server-side (same rules the client enforced live)
    evaluator = DefinitionEvaluator(definition)
    result = evaluator.process(data)
    if not result.valid:
        return {"errors": result.results}
    return {"data": result.data}

@app.post("/lint")
def lint_definition(definition: dict):
    # Static analysis — schema, references, FEL, dependency cycles
    diagnostics = lint(definition, mode="strict")
    return {"diagnostics": diagnostics}
```

The mapping engine transforms response data to/from external formats (JSON, XML, CSV) using a declarative rule DSL — useful for feeding form data into downstream systems without glue code.

Neither runtime imports or wraps the other. They are independently deployable, independently testable, and coupled only through the specification's JSON Schema contracts and FEL semantic rules.

## Specification

| Tier | Spec | Schema |
|------|------|--------|
| Core | [Core Spec](specs/core/spec.md) · [FEL Grammar](specs/fel/fel-grammar.md) | [`definition`](schemas/definition.schema.json) · [`response`](schemas/response.schema.json) · [`validationReport`](schemas/validationReport.schema.json) |
| Theme | [Theme Spec](specs/theme/theme-spec.md) | [`theme`](schemas/theme.schema.json) |
| Components | [Component Spec](specs/component/component-spec.md) | [`component`](schemas/component.schema.json) |
| Mapping | [Mapping DSL](specs/mapping/mapping-spec.md) | [`mapping`](schemas/mapping.schema.json) |
| Extensions | [Extension Registry](specs/registry/extension-registry.md) · [Changelog](specs/registry/changelog-spec.md) | [`registry`](schemas/registry.schema.json) · [`changelog`](schemas/changelog.schema.json) |

## Repository Structure

```
schemas/                        JSON Schema files (10 schemas — the structural source of truth)
specs/                          Normative specifications organized by tier
registries/                     Extension registries (common: email, phone, currency, SSN, etc.)

packages/
  formspec-engine/              TypeScript engine — FormEngine, FEL pipeline, assembler, signals
  formspec-webcomponent/        <formspec-render> — component registry, theme resolver, 34 plugins

src/formspec/                   Python implementation
  fel/                            FEL parser, AST, evaluator, dependency extractor
  validator/                      Multi-pass static linter
  mapping/                        Bidirectional rule engine
  adapters/                       JSON, XML, CSV serializers
  evaluator.py                    4-phase form processor (rebuild → recalculate → revalidate → apply NRB)
  validate.py                     Directory-level artifact validator (9-pass, auto-discovery)

examples/
  grant-application/            Full-stack demo — 6-page federal grant form, all tiers exercised

tests/
  unit/                         Pure logic unit tests (Python)
  integration/                  Integration tests (CLI, pipelines)
  conformance/                  Schema validation, spec examples, fuzzing, parity
  component/                    Component-level Playwright tests
  fixtures/                     Shared JSON test fixtures
  e2e/
    api/                        Server API tests (Python)
    browser/                    Browser E2E tests (Playwright)
    headless/                   Headless evaluation tests (Python)
```

## Quick Start

### Install and Build

```bash
npm install
npm run build
```

### Render a Form (Browser)

```html
<script type="module">
  import "formspec-webcomponent";
</script>

<formspec-render></formspec-render>

<script>
  const el = document.querySelector("formspec-render");
  el.definition = { /* Formspec definition JSON */ };
  el.addEventListener("formspec-submit", (e) => {
    console.log(e.detail.response);         // response payload
    console.log(e.detail.validationReport); // { valid, results, counts, timestamp }
  });
  const detail = el.submit({ mode: "submit" });
</script>
```

### Validate a Definition (Python)

```bash
# Authoring mode — recoverable issues are warnings
python3 -m formspec.validator path/to/definition.json

# Strict mode — warnings escalated to errors (for CI)
python3 -m formspec.validator --mode strict path/to/definition.json
```

### Validate a Project Directory (Python)

Point the validator at a directory containing any mix of Formspec artifacts — definitions, themes, components, mappings, responses, changelogs, registries — and it auto-discovers, classifies, cross-references, and runs 9 validation passes:

```bash
python3 -m formspec.validate path/to/project/

# Include an external registry and custom fixture subdirectory
python3 -m formspec.validate path/to/project/ \
  --registry registries/common.registry.json \
  --fixtures test-data \
  --title "My Form Suite"
```

The 9 passes: definition linting, sidecar linting (theme/mapping/changelog), component linting with definition context, response schema validation, runtime evaluation, mapping forward transforms, changelog generation, registry resolution, and FEL expression parsing.

### Server-Side Evaluation (Python)

```python
from formspec.evaluator import DefinitionEvaluator

evaluator = DefinitionEvaluator(definition)
result = evaluator.process(submitted_data)
# result.valid, result.data, result.results
```

## LLM Integration

Every Formspec artifact has a JSON Schema. Pass the schema as a structured-output constraint and the LLM produces valid documents directly:

1. **Generate forms** — constrain output to `definition.schema.json`
2. **Fill responses** — constrain output to `response.schema.json`
3. **Interpret validation** — feed `validationReport` documents back for natural-language error explanations

Compact `*.llm.md` spec variants under `specs/` are optimized for LLM context windows.

## Development

```bash
npm run build              # Build TypeScript packages
npm run docs:generate      # Regenerate spec artifacts
npm run docs:check         # Enforce doc/schema freshness gates
python3 -m pytest tests/   # Python conformance suite
npm run test:unit          # TypeScript unit tests
npm test                   # Playwright E2E (auto-starts dev server)
npm run test:all           # Everything
```

## Roadmap

- [ ] **Rust linter core** — Rewrite the linter in Rust and expose it via PyO3 (Python bindings) and WASM (browser/Node). Single implementation, three targets: CLI, server library, in-browser studio diagnostics.
- [ ] **Variable name shadowing validation** — FEL uses `@name` for both reserved context references (`@current`, `@index`, `@count`, `@instance`) and user-defined variable references. Variable names that collide with reserved context names silently shadow them. Add a validation rule (linter + schema `not enum`) that rejects variable names matching the reserved set.

## Status

**Version**: 1.0.0-draft.1 — Draft specification under active development.

Design rationale is documented in [Architecture Decision Records](thoughts/adr/).
