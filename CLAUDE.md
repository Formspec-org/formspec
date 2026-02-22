# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formspec is a JSON-native declarative form specification with a dual reference implementation (TypeScript for the client, Python for the backend/tooling). It defines form fields, computed values, validation rules, conditional logic, repeatable sections, and structured validation results — independent of any rendering technology.

The specification is organized into three tiers: Core (data & logic), Theme (presentation), and Components (interaction). FEL (Formspec Expression Language) is a built-in expression language for calculated values and conditional logic.

## Development Philosophy — READ THIS FIRST

**This is a greenfield, unreleased project. There are ZERO users, ZERO backwards compatibility constraints, ZERO production deployments. Any code can and should be thrown away and rebuilt if it isn't right.**

Do not preserve bad code. Do not work around problems. Do not add layers to avoid touching existing code. Rip it out and redo it.

- **ZERO tech debt tolerance** — if something is wrong, delete it and rebuild it correctly. Never band-aid, never "fix later", never leave TODOs. There is no legacy to protect.
- **DRY where it doesn't add complexity** — duplicated logic is a smell. Extract shared code when the abstraction is natural and makes things clearer. But don't force DRY if the shared abstraction is harder to understand than the duplication — three similar lines are better than one confusing helper.
- **KISS where appropriate** — prefer the simplest solution that works, but don't oversimplify. Simple does not mean naive. If the problem is genuinely complex, the solution should handle that complexity cleanly — not pretend it doesn't exist.
- **Eliminate unnecessary complexity** — if a simpler approach exists, use it. If code isn't pulling its weight, delete it. Fewer lines = fewer bugs = faster iteration. But keep an eye on **extensibility** — Formspec is a spec-driven system with extension points by design. Build clean seams where the spec calls for them.

## Monorepo Structure

- **`packages/formspec-engine/`** — Core form state management (TypeScript). FormEngine class, FEL lexer/parser/interpreter, path resolution, validation. Uses `@preact/signals-core` for reactivity and `chevrotain` for parsing.
- **`packages/formspec-webcomponent/`** — `<formspec-render>` custom element that binds FormEngine to the DOM. Component registry pattern for extensibility.
- **`src/`** — Python reference implementation and tooling backend. Contains `src/fel/` (a standalone Python parser, AST, and evaluator for FEL) and `src/adapters/` (Mapping spec implementations for JSON/XML/CSV). This powers the Python conformance suite and acts as a server-side validation/linting engine.
- **`schemas/`** — JSON Schema files (definition, response, validationReport, mapping, theme, component, registry).
- **`specs/`** — Markdown specification documents organized by tier. Each spec has a compact `*.llm.md` version optimized for LLM context — **prefer reading the `.llm.md` files** for fast context.
  - `*.llm.md` files are generated artifacts. Do not hand-edit them.
  - For spec changes, edit canonical `*.md` files and regenerate `*.llm.md` via the docs generation workflow.
  - `specs/core/spec.llm.md` — Core specification (items, binds, FEL, validation shapes, processing model)
  - `specs/fel/fel-grammar.llm.md` — FEL normative grammar (lexical rules, operator precedence, path references)
  - `specs/theme/theme-spec.llm.md` — Theme specification (tokens, widget catalog, selector cascade, page layout)
  - `specs/component/component-spec.llm.md` — Component specification (33 built-in components, slot binding, custom components, responsive design)
  - `specs/mapping/mapping-spec.llm.md` — Mapping DSL (bidirectional transforms, coercion, value maps, adapters)
  - `specs/registry/extension-registry.llm.md` — Extension registry (publishing, discovery, lifecycle)
  - `specs/registry/changelog-spec.llm.md` — Changelog format (change objects, impact classification, migration generation)
- **`tests/`** — Python conformance test suite (pytest + jsonschema + hypothesis).
- **`tests/e2e/`** — Playwright E2E tests and JSON fixtures.

## Build & Development Commands

```bash
# Build TypeScript packages
npm run build                    # runs tsc in each package

# Generate llm-friendly spec docs from canonical specs/*.md
npm run docs:generate

# Verify generated llm docs are up to date (fails on drift)
npm run docs:check

# Start Vite dev server (serves demo pages and test fixtures)
npm run start:test-server        # http://127.0.0.1:8080

# Run Playwright E2E tests (auto-starts Vite server)
npm test

# Run a single Playwright test file
npx playwright test tests/e2e/playwright/fel-functions.spec.ts

# Run Playwright tests matching a pattern
npx playwright test --grep "pattern"

# Run Python conformance tests
python3 -m pytest tests/ -v

# Run a single Python test file
python3 -m pytest tests/test_fel_evaluator.py -v

# Run a specific Python test
python3 -m pytest tests/test_fel_evaluator.py::TestClassName::test_name -v
```

## Architecture

### FormEngine (`packages/formspec-engine/src/index.ts`)
Central class that manages form state. Maintains separate Preact Signals for: field values, relevance, required state, readonly state, validation results, and repeat counts. Computed signals auto-update when dependencies change. Key methods: `setDefinition()`, `setValue()`, `getResponse()`, `getValidationReport()`, `compileFEL()`.

### FEL Pipeline (`packages/formspec-engine/src/fel/` — TypeScript)
1. **Lexer** (`lexer.ts`) — Chevrotain-based tokenization
2. **Parser** (`parser.ts`) — Chevrotain CstParser producing CST
3. **Interpreter** (`interpreter.ts`) — CstVisitor that evaluates expressions; includes ~40+ stdlib functions (aggregates, strings, dates, logical, math, type checking)
4. **DependencyVisitor** (`dependency-visitor.ts`) — Extracts field references from CST to wire up reactive dependencies

### Python Backend & Tooling (`src/` — Python)
A separate Python implementation designed for server-side evaluation, strict validation, and static analysis:
- **`src/fel/parser.py`** & **`src/fel/evaluator.py`**: A complete parsing and evaluation engine that executes FEL on backend servers (e.g., re-verifying validation on submit).
- **`src/fel/dependencies.py`**: Builds dependency graphs and enables static analysis/linting of FEL expressions.
- **`src/adapters/`**: Implements the Mapping spec, allowing server-side conversion of Formspec data into CSV, XML, and alternate JSON layouts.

### Web Component (`packages/formspec-webcomponent/src/`)
`<formspec-render>` element with a component registry. Components are organized by category (layout, inputs, display, interactive, special). Each component implements a type string and render function receiving a `RenderContext` with engine access and path resolution.

### Validation
Two mechanisms: **bind constraints** (field-level: required, constraint, readonly, calculate) and **shape rules** (cross-field/form-level constraints). `ValidationReport` contains results with severity levels (error/warning/info) and constraint kinds. Path-based field targeting supports wildcards (e.g., `items[*].field`).

### Repeatable Groups
Tracked via separate `repeats` signals mapping group names to instance counts. Uses indexed paths like `group[0].field`. Supports nesting and min/max cardinality validation.

## Testing Layers

**Python conformance suite** (`tests/`): Schema conformance, spec example extraction, property-based generative testing (hypothesis), cross-spec contracts, FEL implementation validation.

**Playwright E2E** (`tests/e2e/playwright/`): Browser automation tests loading JSON fixture definitions, filling inputs, and asserting DOM state and engine output. Fixtures live in `tests/e2e/fixtures/`.

## Commit Convention

Use semantic prefixes: `feat:`, `fix:`, `build:`, `docs:`, `test:`, `refactor:`.
