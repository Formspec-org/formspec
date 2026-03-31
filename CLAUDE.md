# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formspec is a JSON-native declarative form specification with a dual reference implementation (TypeScript for the client, Python for the backend/tooling). It defines form fields, computed values, validation rules, conditional logic, repeatable sections, and structured validation results — independent of any rendering technology.

The specification is organized into three tiers: Core (data & logic), Theme (presentation), and Components (interaction). FEL (Formspec Expression Language) is a built-in expression language for calculated values and conditional logic.

## Development Philosophy — READ THIS FIRST

**Code is cheap. Time is cheap. Good architecture is invaluable.** This is a greenfield, unreleased project with zero users and zero backwards compatibility constraints. Code and time are both abundant — don't hesitate to throw away code or spend time exploring. But architecture decisions compound: a good abstraction boundary pays dividends across every future feature; a bad one taxes every change. Always prioritize by value added — ask "what moves the project forward the most?" before spending effort on anything.

**Prioritize by value added.** Not all work is equal. Before starting a task, ask: does this improve the architecture, unlock future capabilities, or directly serve the spec? If the answer is "it's a nice cleanup" or "it might be useful someday," deprioritize it. Spend time on the things that create the most leverage — clean seams, correct abstractions, spec compliance, and well-tested behavior at the boundaries that matter.

**All code is ephemeral.** Nothing is precious. Any file, module, or subsystem can and should be thrown away the moment it stops serving us well. Prefer starting over to refactoring — when something isn't working, take the lessons learned and rewrite it from scratch. A clean rewrite with hindsight is almost always faster and better than a careful refactor of something that grew wrong.

- **Architecture over code** — spend your thinking time on where the seams go, what the interfaces look like, and how data flows. The implementation within those boundaries is cheap to redo; the boundaries themselves are expensive to move.
- **Delete, don't preserve** — do not work around problems. Do not add layers to avoid touching existing code. Do not band-aid. If it's wrong, throw it away and build it right. There is no legacy to protect, no users to migrate.
- **Learn then rebuild** — when you hit a wall, the answer is often "start over with what we now know." Prior code is a learning artifact, not an asset to protect.
- **Don't refactor for fun** — if code is ugly but functional and not in your way, leave it. Only restructure when it's actively blocking the current task or making things harder to understand. Sometimes three messy files that work are better than one elegant abstraction that took an hour to extract.
- **KISS always** — prefer the simplest solution that works. If the problem is genuinely complex, handle that complexity cleanly — but don't invent complexity that isn't there. Fewer lines = fewer bugs = faster iteration.
- **DRY when natural** — extract shared code when the abstraction is obvious and makes things clearer. Don't force it. Three similar lines are better than one confusing helper.
- **Extensibility where the spec demands it** — Formspec has extension points by design. Build clean seams where the spec calls for them, but nowhere else.
- **The spec is the source of truth** — do not implement features that aren't in the spec. If a capability exists in the spec (like OptionSet), use it; do not invent a parallel mechanism (like `choicesFrom`) that does the same thing outside the spec. Non-spec code paths add fields to core structs, require `None` initializers in every test, and create maintenance burden — all for behavior the spec already covers. When you encounter a non-spec feature: if the spec already covers the use case, delete the non-spec code and use the spec mechanism. If the spec does NOT cover it and it's a genuinely new capability, consult the `formspec-specs:spec-expert` agent to determine whether it should be added to the spec — don't just implement it in code and leave the spec behind.
- **No "defer" on greenfield** — when an audit finds something wrong, fix it. Do not tag issues as "fix later" or "not urgent." There are no users to break, no releases to stabilize, no backwards compatibility to preserve. The cost of fixing now is lower than it will ever be again. Every deferred fix becomes a landmine for the next person (or agent) working in that code.

## Monorepo Structure

- **`packages/formspec-engine/`** — Core form state management (TypeScript). FormEngine class, FEL lexer/parser/interpreter, path resolution, validation. Uses `@preact/signals-core` for reactivity and `chevrotain` for parsing.
- **`packages/formspec-webcomponent/`** — `<formspec-render>` custom element that binds FormEngine to the DOM. Component registry pattern for extensibility.
- **`src/formspec/`** — Python reference implementation and tooling backend. Contains `src/formspec/fel/` (a standalone Python parser, AST, and evaluator for FEL), `src/formspec/adapters/` (Mapping spec implementations for JSON/XML/CSV), and `src/formspec/validator/` (static linter). This powers the Python conformance suite and acts as a server-side validation/linting engine.
- **`schemas/`** — JSON Schema files (definition, response, validationReport, mapping, theme, component, registry).
- **`specs/`** — Markdown specification documents organized by tier, plus generated LLM/context artifacts.
  - Canonical `*.md` specs are the source for normative behavior semantics.
  - `*.bluf.md` files hold compact "bottom line up front" summaries injected into canonical specs.
  - `*.llm.md` files are generated by `scripts/generate-spec-artifacts.mjs` and MUST NOT be hand-edited.
  - For quick context, prefer the generated `*.llm.md` files.
  - `specs/core/spec.llm.md` — Core specification (items, binds, FEL, validation shapes, processing model)
  - `specs/fel/fel-grammar.llm.md` — FEL normative grammar (lexical rules, operator precedence, path references)
  - `specs/theme/theme-spec.llm.md` — Theme specification (tokens, widget catalog, selector cascade, page layout)
  - `specs/component/component-spec.llm.md` — Component specification (33 built-in components, slot binding, custom components, responsive design)
  - `specs/mapping/mapping-spec.llm.md` — Mapping DSL (bidirectional transforms, coercion, value maps, adapters)
  - `specs/registry/extension-registry.llm.md` — Extension registry (publishing, discovery, lifecycle)
  - `specs/registry/changelog-spec.llm.md` — Changelog format (change objects, impact classification, migration generation)
- **`docs/api/`** — Generated HTML API docs (pdoc for Python, TypeDoc for TypeScript). Regenerate with `make api-docs`.
  - `docs/api/formspec/` — Python (pdoc)
  - `docs/api/formspec-engine/` — TypeScript engine (TypeDoc)
  - `docs/api/formspec-webcomponent/` — TypeScript webcomponent (TypeDoc)
  - `docs/api/formspec-core/` — TypeScript project core (TypeDoc)
  - `docs/api/formspec-chat/` — TypeScript chat adapter (TypeDoc)
  - `docs/api/formspec-mcp/` — TypeScript MCP server (TypeDoc)
- **API LLM docs** — Colocated `API.llm.md` files generated by `make api-docs`. Not committed; prefer these over reading source for API context.
  - `src/formspec/API.llm.md` — Python package API reference (all subpackages: fel, validator, adapters, mapping, changelog, registry).
  - `packages/formspec-engine/API.llm.md` — TypeScript engine API reference (FormEngine, interfaces, assembler, runtime mapping).
  - `packages/formspec-webcomponent/API.llm.md` — TypeScript webcomponent API reference (FormspecRender, ComponentRegistry, theme resolver, RenderContext).
  - `packages/formspec-core/API.llm.md` — TypeScript project core API reference (RawProject, IProjectCore, handlers, undo/redo).
  - `packages/formspec-chat/API.llm.md` — TypeScript chat API reference (AIAdapter, ChatSession, scaffolding, templates).
  - `packages/formspec-mcp/API.llm.md` — TypeScript MCP server API reference (tool declarations, server setup).
  - `packages/formspec-studio-core/API.llm.md` — TypeScript studio-core API reference (Project, helpers, evaluation).
- **`thoughts/`** — All plans, ADRs, research, and design artifacts. **Never put plans in `docs/`.** See `thoughts/README.md` for full index.
  - `thoughts/adr/` — Architecture decision records (decisions with Status). `NNNN-short-name.md`. Next: **0053**.
  - `thoughts/plans/` — Implementation and execution plans. `YYYY-MM-DD-short-name.md`.
  - `thoughts/specs/` — Design specifications and PRDs. `YYYY-MM-DD-short-name.md`.
  - `thoughts/reviews/` — Code reviews, audits, post-mortems. `YYYY-MM-DD-short-name.md`.
  - `thoughts/research/` — Exploratory research, comparative analysis, external doc captures.
  - `thoughts/studio/` — Formspec Studio subdomain (plans, bugs, designs).
  - `thoughts/examples/` — Reference example implementation plans.
- **`tests/`** — Python conformance test suite (pytest + jsonschema + hypothesis).
- **`tests/e2e/`** — Playwright E2E tests and JSON fixtures.
- **`filemap.json`** — Auto-generated file→description index for agent navigation. Regenerate with `npm run docs:filemap`. See "Filemap Convention" below.

## Filemap Convention

`filemap.json` is a generated JSON index mapping every source file to a one-line description. It lets agents instantly understand the codebase without re-exploring it.

**How it works:**

- A script (`scripts/generate-filemap.mjs`) walks the source tree and extracts file-level descriptions using language-native conventions.
- Run `npm run docs:filemap` to regenerate, or `npm run docs:filemap:check` to verify freshness.
- `npm run docs:generate` also regenerates it automatically.

**Adding a description to your file:**

- **TypeScript / JavaScript**: Add `@filedesc` in a JSDoc comment at the top of the file, before imports:

  ```ts
  /** @filedesc Resolves $ref inclusions to produce a self-contained definition. */
  import { ... } from '...';
  ```

- **Python**: Use the module docstring first line (already standard):

  ```python
  """FEL recursive-descent parser — tokens to AST."""
  ```

- **JSON**: Top-level `title` and/or `description` fields (schemas already have these).
- **CSS**: `/* @filedesc ... */` block comment at the top.
- **Markdown**: First `# heading` is used automatically.

**Rules:**

- Keep descriptions under 100 characters — concise and informative.
- Focus on WHAT the file does, not HOW.
- `filemap.json` MUST NOT be hand-edited. Always regenerate via the script.

## Spec Authoring Contract

- Structural truth lives in `schemas/*.json`.
- Behavioral semantics that schemas cannot encode live in canonical spec markdown (`specs/**/*.md`).
- Nodes marked `x-lm.critical=true` in schemas MUST include both `description` and at least one `examples` entry.
- Generated marker blocks in specs (for example `<!-- bluf:start ... -->` and `<!-- schema-ref:start ... -->`) MUST NOT be hand-edited.
- Generated `*.llm.md` files MUST NOT be hand-edited.
- Required authoring workflow for any schema/spec change:
  1. Edit schema, canonical spec prose, and/or BLUF files as needed.
  2. Run `npm run docs:generate`.
  3. Run `npm run docs:check`.

## Keeping `context.md` Current

`context.md` is the project's living source of truth for features, reasoning, vision, and roadmap. It must stay current. Update it when any of the following happen:

- **New spec added or existing spec materially changed** — update the relevant section (Core Architecture, Companion Documents, Key Differentiators) to reflect the new capability or changed semantics.
- **New blog post or public content published** — if it introduces concepts, positioning, or messaging not already captured, update "How We Talk About This" or add to the appropriate section.
- **Major feature developed** — when a feature lands that changes what Formspec *is* or *can do* (new runtime, new sidecar document type, new AI integration, new platform support), update the relevant sections. Bug fixes and internal refactors don't qualify.
- **Audience or positioning shift** — if the target audience expands, narrows, or the competitive framing changes, update "Who It's For" and "Key Differentiators."
- **Roadmap milestone reached** — when something moves from planned to shipped (e.g., Android runtime, UniFFI), update the status in the relevant table or section.

**What NOT to update:** Implementation details, file paths, internal architecture that changes frequently — those belong in `CLAUDE.md`, not `context.md`. The context doc is about *what* and *why*, not *how*.

## Build & Development Commands

```bash
# Full monorepo compile (Rust workspace + npm build + pip install formspec-py / formspec_rust)
make build

# Build TypeScript packages only
npm run build                    # runs tsc in each package (formspec-engine runs wasm-pack first)

# Regenerate schema-driven spec artifacts (BLUF injection, schema refs, LLM docs) + filemap
npm run docs:generate

# Regenerate filemap.json only
npm run docs:filemap

# Validate package dependency layering (no upward/lateral deps, WASM exclusivity)
npm run check:deps

# Enforce critical doc/schema gates (staleness + critical annotations + cross-spec contracts)
npm run docs:check

# Build all docs: HTML specs + Python API reference (requires pandoc, pdoc)
make docs

# Generate Python API docs only (HTML + LLM markdown)
make api-docs

# Set up pre-commit hooks (one-time)
make setup

# Start Vite dev server for Playwright E2E test harness
npm run test:serve               # http://127.0.0.1:8080

# Run Playwright E2E tests (auto-starts Vite server)
npm test

# Run a single Playwright test file
npx playwright test tests/e2e/playwright/fel-functions.spec.ts

# Run Playwright tests matching a pattern
npx playwright test --grep "pattern"

# Validate all artifacts in a directory (auto-discovery, 9 passes)
python3 -m formspec.validate examples/grant-report/ --registry registries/formspec-common.registry.json

# Run Python conformance tests
python3 -m pytest tests/ -v

# Run a single Python test file
python3 -m pytest tests/test_fel_evaluator.py -v

# Run a specific Python test
python3 -m pytest tests/test_fel_evaluator.py::TestClassName::test_name -v
```

## Package Dependency Fences

Internal package dependencies must flow strictly downward through defined layers. Run `npm run check:deps` to validate.

| Layer | Packages |
|-------|----------|
| 0 | `formspec-types` |
| 1 | `formspec-engine`, `formspec-layout` |
| 2 | `formspec-webcomponent`, `formspec-core` |
| 3 | `formspec-adapters`, `formspec-studio-core` |
| 4 | `formspec-mcp` |
| 5 | `formspec-chat` |
| 6 | `formspec-studio` |

**Rules:**

- A package at layer N may only depend on packages at layer < N (strictly lower). Same-layer dependencies are forbidden — they create lateral coupling that easily becomes circular.
- **WASM is exclusive to `formspec-engine`.** No other package may import from `wasm-pkg`, `wasm-pkg-runtime`, `wasm-pkg-tools`, `formspec-wasm`, or generated `formspec_wasm*` glue. The engine is the sole bridge between the Rust/WASM tier and the TypeScript tier.
- When adding a new package, assign it a layer in `scripts/check-dep-fences.mjs` before adding any internal dependencies.
- The fence checker validates `dependencies`, `peerDependencies`, and `devDependencies` — test-only imports count.

## Architecture

### Logic ownership (Rust / WASM first)

**Keep spec business logic in Rust crates** (`crates/formspec-*`, `fel-core`, etc.) and expose it through **WASM** (and **Python** for server/tooling). TypeScript is for **orchestration**: reactive `FormEngine` state, webcomponent rendering, studio/project commands, and **thin bridges** to WASM — not the source of truth for FEL evaluation, validation semantics, coercion, migrations, mapping execution, or lint rules. **Do not add new spec behavior in TS** when it belongs in Rust; extend the Rust implementation and call it from the bridge. The engine uses **WASM** for FEL parse, dependency extraction, analysis, prepare, and eval (`getFELDependencies`, `analyzeFEL`, `evalFEL`, etc.); `packages/formspec-engine/src/fel/` is **API glue** (`fel-api-runtime` / `fel-api-tools`), not an in-tree Chevrotain stack.

### FormEngine (`packages/formspec-engine/src/index.ts`)

Central class that manages form state. Maintains separate Preact Signals for: field values, relevance, required state, readonly state, validation results, and repeat counts. Computed signals auto-update when dependencies change. Key methods: `setDefinition()`, `setValue()`, `getResponse()`, `getValidationReport()`, `compileExpression()`.

Apps that use `formspec-engine` directly (not only `formspec-webcomponent`) must call **`await initFormspecEngine()`** (alias: **`initEngine`**) once before constructing `FormEngine` or calling WASM-backed helpers. The web component package starts this automatically on import. Authoring/tooling APIs (lint, registry helpers, mapping, sync assembly, FEL tokenize/print, etc.) need **`await initFormspecEngineTools()`** as well, unless they use **`await assembleDefinition()`**, which loads tools lazily. Runtime and tools ship as separate generated artifacts under `wasm-pkg-runtime/` and `wasm-pkg-tools/` (see `packages/formspec-engine/README.md`). Those dirs are **untracked** (not root-gitignored) so `npm pack` can ship them; **`npm run build` removes wasm-pack’s pkg-local `.gitignore`** (`*`) that would otherwise exclude them from the tarball — **do not commit** WASM outputs. **`import 'formspec-engine'`** still loads **`fel-api`**, which composes **`fel-runtime`** + **`fel-tools`** (tools JS glue). **`formspec-core`** imports **`formspec-engine/fel-runtime`** and **`/fel-tools`** where possible so path/diagnostic code does not need the main **`index`** graph. **`FormEngine`** internals use **`wasm-bridge-runtime`** only. Embedders that only need runtime startup use **`formspec-engine/init-formspec-engine`**; for **`FormEngine`** / **`createFormEngine`** without the full fel facade, use **`formspec-engine/render`**. The **`wasm-bridge.ts`** barrel remains for compatibility and tests.

### FEL in the TypeScript engine (`packages/formspec-engine/src/fel/`)

**Rust / WASM** (`fel-core`, `formspec-core`, `formspec-wasm`) owns the FEL grammar, parser, evaluator, and dependency extraction. **Runtime WASM** exposes `evalFEL`, `getFELDependencies`, `analyzeFEL`, `prepareFelExpression`, path helpers, etc. **`FormEngine.compileExpression()`** returns a reactive closure that calls **`wasmEvalFELWithContext`**. **`fel-api-runtime.ts`** / **`fel-api-tools.ts`** are thin WASM facades and re-exports; optional small TS helpers (e.g. `itemLocationAtPath` for host tree walks) are not normative spec logic.

### Python Backend & Tooling (`src/formspec/` — Python)

A separate Python implementation designed for server-side evaluation, strict validation, and static analysis:

- **`src/formspec/fel/parser.py`** & **`src/formspec/fel/evaluator.py`**: A complete parsing and evaluation engine that executes FEL on backend servers (e.g., re-verifying validation on submit).
- **`src/formspec/fel/dependencies.py`**: Builds dependency graphs and enables static analysis/linting of FEL expressions.
- **`src/formspec/adapters/`**: Implements the Mapping spec, allowing server-side conversion of Formspec data into CSV, XML, and alternate JSON layouts.

### Web Component (`packages/formspec-webcomponent/src/`)

`<formspec-render>` element with a component registry. Components are organized by category (layout, inputs, display, interactive, special). Each component implements a type string and render function receiving a `RenderContext` with engine access and path resolution.

### Validation

Two mechanisms: **bind constraints** (field-level: required, constraint, readonly, calculate) and **shape rules** (cross-field/form-level constraints). `ValidationReport` contains results with severity levels (error/warning/info) and constraint kinds. Path-based field targeting supports wildcards (e.g., `items[*].field`).

### Repeatable Groups

Tracked via separate `repeats` signals mapping group names to instance counts. Uses indexed paths like `group[0].field`. Supports nesting and min/max cardinality validation.

## Git Worktrees

**Default: work directly on `main` or a local branch.** Do NOT use worktrees unless absolutely necessary. The overhead of `npm install` + `npm run build` per worktree is significant and rarely justified.

**When to use a worktree:** Only when you must run truly parallel implementations that would conflict on the same working tree (e.g., two agents modifying the same files simultaneously). A simple feature branch does NOT require a worktree — just `git checkout -b <branch>`.

All worktrees live in `.claude/worktrees/`. This directory is already gitignored (via `.claude/*`).

**Creating a worktree:**

```bash
# Create worktree with a new branch
git worktree add .claude/worktrees/<name> -b <branch-name>
cd .claude/worktrees/<name>
npm install          # node_modules is NOT shared between worktrees
npm run build        # rebuild TS packages in the new worktree
```

**Running tests in a worktree:** Same commands as the main tree — `npm test`, `python3 -m pytest tests/ -v`, etc. Always verify a clean baseline before starting work.

**Cleaning up when done:**

```bash
# From the main worktree
git worktree remove .claude/worktrees/<name>
# If the branch was merged, delete it too
git branch -d <branch-name>
```

**Rules:**

- Always use `.claude/worktrees/` — no other location. Already gitignored.
- Run `npm install` after creating a worktree. Dependencies are per-worktree.
- Verify tests pass in the worktree before starting work. Report failures before proceeding.
- **Commit your work at logical moments.** Every worktree agent MUST commit before finishing. Uncommitted changes in a worktree are invisible to `git log`, unreviewable, and will be lost when the worktree is removed. Commit at natural stopping points — a passing test suite, a completed feature slice, a coherent refactor — not after every small change. Each commit should represent a meaningful, self-contained unit of work with a descriptive message. A worktree with uncommitted changes is a worktree that wasted its work.
- Do not leave stale worktrees around. Clean up after merging or abandoning a branch.

## Development Workflow — Red-Green-Refactor

Every feature or bugfix follows this loop. Do NOT write implementation before a failing test exists.

1. **Red** — Write one minimal failing test. Run it, confirm it fails for the right reason.
2. **Green** — Make it pass with the simplest change that works.
3. **Expand** — Add tests for edge cases and the full requirement. See which fail, make them pass.
4. **Verify** — Run the full suite to confirm zero regressions.

## Code Review Workflow — Test Before Fix

When a code review (manual or automated) identifies a bug, do NOT fix it directly. Follow the same red-green discipline:

1. **Write a failing test** that reproduces the bug. Run it, confirm it fails for the right reason.
2. **Fix the bug** with the simplest change that makes the test pass.
3. **Expand coverage** — add edge-case tests around the bug site. If the review found one bug here, there may be others nearby.
4. **Verify** — run the full suite to confirm zero regressions.

This applies to every bug found during review — correctness issues, safety problems, silent data loss, off-by-one errors, all of it. The test is proof the bug existed and proof it's fixed. A fix without a test is an unverified claim.

## Testing Philosophy

**The goal is confidence in correctness, not test quantity.** Write the fewest tests that give you high confidence the code works. One well-chosen integration test that exercises the real path is worth more than ten unit tests mocking every seam.

**When to use each layer:**

- **Unit tests** — Pure logic with no dependencies: parsers, transformers, expression evaluators, utility functions. Use when the function is complex enough that its behavior isn't obvious from reading it, or when it has meaningful edge cases.
- **Integration tests** — Components interacting with real collaborators (engine + signals, store + rendering, assembler + resolver). This is the default and most valuable layer. Test through the public API surface, not internal wiring.
- **E2E tests** (Playwright) — User-visible behavior in the browser: form rendering, navigation, submission, validation feedback. Use for workflows that cross the component/engine/DOM boundary. Don't duplicate what integration tests already cover.

**What NOT to test:** Trivial getters/setters, framework glue, type-system-enforced invariants, or implementation details that would break on any reasonable refactor. If a test only passes because it knows about internal structure, it's testing the wrong thing.

**Check all layers on every change.** Before implementing any feature or fix, identify which test files cover the affected code at **each** layer (unit, integration, E2E). Run them to establish a baseline. Write new failing tests at the appropriate layers BEFORE implementing. After implementation, verify all layers pass. If a layer has no tests for the affected code, that's a gap — fill it. Red-green-refactor applies at every layer, not just one.

**Test locations:**

- `tests/` — Python conformance suite (schema, FEL, cross-spec contracts, hypothesis)
- `tests/e2e/playwright/` — Browser E2E tests (fixtures in `tests/e2e/fixtures/`)
- `packages/formspec-studio/tests/e2e/playwright/` — Studio E2E tests
- `form-builder/src/__tests__/` — Form builder unit/integration tests (Vitest)
- `packages/formspec-engine/tests/` — Engine unit/integration tests
- `packages/formspec-core/tests/` — Core handler unit/integration tests
- `packages/formspec-studio-core/tests/` — Studio-core helper tests

## Commit Convention

Use semantic prefixes: `feat:`, `fix:`, `build:`, `docs:`, `test:`, `refactor:`.

**When to commit:** At logical stopping points — not after every file edit, but when a coherent unit of work is complete. Good commit boundaries: a feature slice that passes its tests, a complete bugfix, a self-contained refactor, a full test expansion pass. Bad commit boundaries: mid-refactor with broken tests, after editing one file of a multi-file change, or "save my progress" checkpoints. When in doubt, finish the thought before committing.
