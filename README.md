# Formspec

**A declarative form specification where structure, behavior, and presentation are independent, composable JSON documents.**

Formspec separates *what data to collect* from *how it behaves* from *how it looks*. A single definition drives validation, computed fields, conditional logic, and repeatable sections across any runtime — browser, server, mobile, offline. Every artifact is a JSON document backed by a JSON Schema, so the entire system is machine-readable.

## Architecture

### The Specification as Abstraction Boundary

Formspec inverts the usual dependency between frontend and backend. Neither implementation knows about the other; both depend inward on the specification:

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
   ┌─────────────────────┐    ┌──────────────────────────────────┐
   │  TypeScript Engine   │    │  Rust Shared Kernel (in progress) │
   │                      │◄───│                                   │
   │  Reactive signals    │WASM│  FEL runtime (rust_decimal)       │
   │  4-phase processing  │    │  Assembler, path utils            │
   │  Live state mgmt     │    │  Definition evaluator             │
   │                      │    │  7-pass static linter             │
   └──────┬───────┬───────┘    │  Mapping engine, registry,       │
          │       │            │  changelog                        │
          │       │            └──────────┬────────────────────────┘
          │       │                       │ PyO3
          │       │            ┌──────────▼───────────────┐
          │       │            │  Python Implementation    │
          │       │            │                           │
          │       │            │  Format adapters (JSON,   │
          │       │            │    XML, CSV)              │
          │       │            │  Artifact orchestrator    │
          │       └────────┐   └──────────────────────────┘
          │  (presentation)│  (authoring)
          ▼                ▼
   ┌──────────────────┐    ┌─────────────────────┐
   │  Web Component    │    │  Studio Core         │
   │                   │    │                      │
   │  <formspec-render>│    │  Command model       │
   │  33 plugin types  │    │  Queries & diagnostics│
   │  Theme resolver   │    │  Undo/redo, replay   │
   └──────────────────┘    └──────────┬────────────┘
                                      │
                        ┌─────┬───────┼───────┬──────┐
                        ▼     ▼       ▼       ▼      ▼
                      MCP   Chat   CLI tool  Studio  LLM
```

The specification — schemas, normative prose, and FEL grammar — is the stable abstraction that all implementations conform to. A Rust shared kernel (in progress) is replacing the duplicated pure logic in both the TypeScript and Python implementations. The TypeScript engine keeps Preact Signals for reactive UI state; everything else — FEL evaluation, assembly, linting, mapping, registry, changelog — moves to Rust, exposed via WASM to TypeScript and PyO3 to Python. One implementation, every platform.

This inversion runs deeper than just client/server. The TypeScript side itself has two dependency boundaries below the engine:

The **web component** is a presentation adapter — it reads engine signals and dispatches to a plugin registry. The engine drives any rendering surface: a React component tree, a native mobile form, a PDF generator, or a server-rendered page. Build a new presentation layer by subscribing to engine signals; the behavioral core stays constant.

**Studio Core** is an authoring adapter — it uses the engine's FEL compiler, dependency analysis, and schema validation to power a command-based editing model for creating Formspec artifacts. Every edit is a serializable command with undo/redo, replay, and cross-artifact diagnostics. Studio Core produces the definition, theme, component, and mapping documents that the engine and web component consume at runtime. It has no UI of its own — CLI tools, LLM agents, and visual editors like the Form Builder all drive it through the same command API.

### Document Layers

The specification uses composable document layers. Each layer adds a concern without modifying the layers below.

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
║  33 built-in components + custom templates                       ║
╠══════════════════════════════════════════════════════════════════╣
║  COMPANION SPECS                                                 ║
║  Mapping DSL · Extension Registry · Changelog Format · FEL Grammar║
╚══════════════════════════════════════════════════════════════════╝
```

Presentation layers (Theme, Components) never affect data collection, validation, or behavioral semantics. They are swappable overlays on an unchanging behavioral core.

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

Neither runtime imports or wraps the other. They deploy and test independently, coupled only through the specification's JSON Schema contracts and FEL semantic rules.

## Specification

| Tier | Spec | Schema |
|------|------|--------|
| Core | [Core Spec](specs/core/spec.md) · [FEL Grammar](specs/fel/fel-grammar.md) | [`definition`](schemas/definition.schema.json) · [`response`](schemas/response.schema.json) · [`validationReport`](schemas/validationReport.schema.json) |
| Theme | [Theme Spec](specs/theme/theme-spec.md) | [`theme`](schemas/theme.schema.json) |
| Components | [Component Spec](specs/component/component-spec.md) | [`component`](schemas/component.schema.json) |
| Mapping | [Mapping DSL](specs/mapping/mapping-spec.md) | [`mapping`](schemas/mapping.schema.json) |
| Extensions | [Extension Registry](specs/registry/extension-registry.md) · [Changelog](specs/registry/changelog-spec.md) | [`registry`](schemas/registry.schema.json) · [`changelog`](schemas/changelog.schema.json) |
| Catalogs | — | [`FEL functions`](schemas/fel-functions.schema.json) · [`Core commands`](schemas/core-commands.schema.json) · [`Conformance suite`](schemas/conformance-suite.schema.json) |

## Repository Structure

`schemas/` — JSON Schema files (the structural source of truth):
[`definition`](schemas/definition.schema.json) ·
[`response`](schemas/response.schema.json) ·
[`validationReport`](schemas/validationReport.schema.json) ·
[`validationResult`](schemas/validationResult.schema.json) ·
[`theme`](schemas/theme.schema.json) ·
[`component`](schemas/component.schema.json) ·
[`mapping`](schemas/mapping.schema.json) ·
[`registry`](schemas/registry.schema.json) ·
[`changelog`](schemas/changelog.schema.json) ·
[`fel-functions`](schemas/fel-functions.schema.json) ·
[`core-commands`](schemas/core-commands.schema.json) ·
[`conformance-suite`](schemas/conformance-suite.schema.json)

`specs/` — Normative specifications organized by tier
`registries/` — Extension registries (common: email, phone, currency, SSN, etc.)

### TypeScript Packages

| Package | Description |
|---|---|
| [`formspec-types`](packages/formspec-types/README.md) | Types auto-generated from JSON Schemas — zero-runtime, shared across all packages |
| [`formspec-engine`](packages/formspec-engine/README.md) | FormEngine, FEL pipeline, assembler, reactive signals |
| [`formspec-webcomponent`](packages/formspec-webcomponent/README.md) | `<formspec-render>` — component registry, theme resolver, 33 plugins |
| [`formspec-layout`](packages/formspec-layout/README.md) | Theme cascade resolution, responsive design, grid layout |
| [`formspec-core`](packages/formspec-core/README.md) | Project core — 17 handlers, normalization, page resolution, theme cascade |
| [`formspec-studio-core`](packages/formspec-studio-core/README.md) | Authoring core — command model, undo/redo, queries, diagnostics |
| [`formspec-studio`](packages/formspec-studio/README.md) | Visual form editor (React 19) — desktop-first authoring, inspector, logic builders |
| [`formspec-mcp`](packages/formspec-mcp/README.md) | MCP server — 28 consolidated tools for LLM-driven form authoring (stdio transport) |
| [`formspec-chat`](packages/formspec-chat/README.md) | Chat core — conversational form builder logic, AI adapter interface, issue queue |

### Rust Crates — `crates/` *(in progress)*

| Crate | Description |
|---|---|
| `fel-core` | FEL lexer, parser, evaluator (rust_decimal), environment, extensions, dependency extraction, AST printer |
| `formspec-core` | FEL analysis, path utils, schema validator, extension analysis, runtime mapping, assembler, registry client, changelog |
| `formspec-eval` | Definition Evaluator — 4-phase batch processor with topo sort, inheritance, NRB, wildcards |
| `formspec-lint` | 7-pass static linter — 35 diagnostic codes, pass gating, authoring/runtime modes |
| `formspec-wasm` | WASM bindings (wasm-bindgen) — exposes all capabilities to TypeScript |
| `formspec-py` | PyO3 bindings — exposes all capabilities to Python |

### Python — [`src/formspec/`](src/formspec/README.md)

| Module | Description | Status |
|---|---|---|
| `fel/` | FEL parser, AST, evaluator, dependency extractor | → Rust (`fel-core`) |
| `validator/` | Multi-pass static linter | → Rust (`formspec-lint`) |
| `mapping/` | Bidirectional rule engine | → Rust (`formspec-core`) |
| `adapters/` | JSON, XML, CSV serializers | Stays Python |
| `evaluator.py` | 4-phase form processor (rebuild → recalculate → revalidate → apply NRB) | → Rust (`formspec-eval`) |
| `registry.py` | Extension registry client, semver matching, lifecycle validation | → Rust (`formspec-core`) |
| `changelog.py` | Definition version diffing, change classification | → Rust (`formspec-core`) |
| `validate.py` | Directory-level artifact validator (10-pass, auto-discovery) | Stays Python (calls Rust via PyO3) |

### [Examples](examples/README.md)

| Example | Description |
|---|---|
| [`invoice`](examples/invoice/README.md) | Line-item invoice with repeat groups and calculated totals |
| [`clinical-intake`](examples/clinical-intake/README.md) | Healthcare intake form with screener routing and nested repeats |
| `grant-report` | Grant reporting variants (tribal-long, tribal-short) |
| [`grant-application`](examples/grant-application/README.md) | 6-page federal grant form — all tiers exercised |
| `refrences` | Cross-reference dashboard — fields, binds, FEL, shapes |

### Other

```
docs/                           Generated HTML specs and API reference (Pandoc, pdoc, TypeDoc)
thoughts/                       ADRs, research, and design artifacts

tests/
  unit/                         Pure logic unit tests (Python)
  integration/                  Integration tests (CLI, pipelines)
  conformance/                  Schema validation, spec examples, parity verification, fuzzing
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

Point the validator at a directory containing any mix of Formspec artifacts — definitions, themes, components, mappings, responses, changelogs, registries — and it auto-discovers, classifies, cross-references, and runs 10 validation passes:

```bash
python3 -m formspec.validate path/to/project/

# Include an external registry and custom fixture subdirectory
python3 -m formspec.validate path/to/project/ \
  --registry registries/common.registry.json \
  --fixtures test-data \
  --title "My Form Suite"
```

The 10 passes: definition linting, sidecar linting (mapping/changelog), theme linting with definition context, component linting with definition context, response schema validation, runtime evaluation, mapping forward transforms, changelog generation, registry resolution, and FEL expression parsing.

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

Compact `*.llm.md` spec variants under `specs/` fit LLM context windows.

## Development

```bash
npm run build              # Build TypeScript packages
npm run docs:generate      # Regenerate spec artifacts
npm run docs:check         # Enforce doc/schema freshness gates
make api-docs              # Generate Python + TypeScript API reference
make docs                  # Full doc build (specs + API + HTML)

python3 -m pytest tests/   # Python conformance suite
npm run test:unit          # TypeScript unit tests (engine, layout, core, studio-core)
npm test                   # Playwright E2E (auto-starts dev server)
npm run test:all           # Everything
```

## Roadmap

- [x] **Rust shared kernel** — FEL runtime, assembler, path utils, schema validator, definition evaluator, and 7-pass linter implemented in Rust (6 crates, 10,931 lines, 239 tests). WASM and PyO3 bindings cover all capabilities.
- [ ] **Wire WASM into TypeScript** — Connect `formspec-wasm` to the TypeScript engine, replacing ~3,900 lines of duplicated TS logic. Delete old FEL pipeline, assembler, and utility files.
- [ ] **Wire PyO3 into Python** — Connect `formspec-py` to the Python backend, replacing FEL, mapping engine, registry, and changelog. Only format adapters stay Python.
- [ ] **Variable name shadowing validation** — FEL uses `@name` for both reserved context references (`@current`, `@index`, `@count`, `@instance`) and user-defined variable references. Variable names that collide with reserved context names silently shadow them. Add a validation rule (linter + schema `not enum`) that rejects variable names matching the reserved set.

## Status

**Version**: 1.0.0-draft.1 — Draft specification under active development.

Design rationale lives in [Architecture Decision Records](thoughts/adr/).

## Authors

Created by [Michael Deeb](https://www.linkedin.com/in/michael-deeb/) at [TealWolf Consulting](https://tealwolf.consulting/) in partnership with [Focus Consulting](https://focusconsulting.io/).

## License

[MIT](LICENSE)
