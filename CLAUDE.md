# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## HIGH PRIORITY — Writing backlog / TODO / task items

**Every backlog entry, TODO, or task description MUST carry its own context.** A reader (human or agent) opening the item cold — no surrounding conversation, no memory of the session that produced it — must know *what the work is*, *why it matters*, and *what "done" looks like*, from the words on the page alone.

Write dense, not verbose. The model is a poem or a well-contextualized meme: few words, heavy payload, still easy to read. Every sentence pulls weight — if a phrase can be cut without losing meaning, cut it; if a phrase that looks redundant is actually the anchor that makes the rest make sense, keep it. No orphan pronouns, no "see above", no "the thing we discussed" — name the thing.

**The test:** if this item sat untouched for six weeks and a different agent picked it up, could they act on it without asking a clarifying question? If no, rewrite until yes.

Applies to `TODO.md`, plan files in `thoughts/plans/`, ADR follow-ups, lint-rule backlog entries, conformance/test fixture stubs, and any inline `// TODO` comments that escape a single session.

## Project Overview

Formspec is a JSON-native declarative form specification with a dual reference implementation (TypeScript for the client, Python for the backend/tooling). It defines form fields, computed values, validation rules, conditional logic, repeatable sections, structured validation results, and `IntakeHandoff` boundary artifacts — independent of any rendering technology.

The specification is organized into three tiers: Core (data & logic), Theme (presentation), and Components (interaction). FEL (Formspec Expression Language) is a built-in expression language for calculated values and conditional logic.

## Operating Context — READ THESE BEFORE DECIDING

Formspec is one spec in a three-spec stack. Architectural decisions routinely cross spec boundaries, and the owner's operating preferences override generic defaults. Consult in order:

1. **[`.claude/operating-mode.md`](.claude/operating-mode.md)** — Behavioral interrupts. Read first, before any task. Defaults in agent training push toward time-estimation, phased delivery, option-proposing, and hedging; this file interrupts those patterns.
2. **[`.claude/user_profile.md`](.claude/user_profile.md)** — Owner's operating preferences: economic model (Importance × Debt, minutes-not-days, tokens unlimited, elegance + minimum conceptual debt as optimization target), design philosophy (opinionated, closed taxonomies, named seams), communication style (terse, opinionated, hedges labeled), maximalist one-shot delivery.
3. **[`.claude/vision-model.md`](.claude/vision-model.md)** — Stack-wide vision. Foundational Q1-Q4 answers plus per-spec architectural commitments, including data-and-workflow zero trust posture and the three deployment modes (SBA / Federal / Sovereign). Consult before any decision that crosses more than one subsystem, crosses spec boundaries, or re-opens a foundational question.
4. **[`thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md`](thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md)** — Platform decision register: end-state commitments, implementation leans, forks, kill criteria. Consult before changing cross-layer architecture, proof posture, signing semantics, custody, durable-runtime assumptions, or product-vs-engineering proof claims.
5. **[`wos-spec/crates/wos-server/VISION.md`](wos-spec/crates/wos-server/VISION.md)** — End-state architectural framing for the WOS Server reference implementation. Three trust postures, Cargo-enforced adapter cluster, EventStore port composing Trellis crates, per-class client-side decryption, build sequence DAG. Consult before any wos-server architectural decision.

For public-facing stack framing (partners, procurement, investors), see [`STACK.md`](STACK.md) — lookup-only, not required for internal decisions.

**Conflict resolution:** see [`.claude/operating-mode.md`](.claude/operating-mode.md).

## Development Philosophy — Formspec-specific

General frame lives in [`.claude/user_profile.md`](.claude/user_profile.md) and [`.claude/operating-mode.md`](.claude/operating-mode.md). Formspec-specific additions:

- **The spec is the source of truth.** Do not implement features that are not in the spec. If a capability exists (like `OptionSet`), use it; do not invent a parallel mechanism (like `choicesFrom`) that does the same thing outside the spec. Non-spec code paths add fields to core structs, require `None` initializers in every test, and create maintenance burden — all for behavior the spec already covers. When you find a non-spec feature: if the spec already covers the use case, delete the non-spec code. If the spec does not cover it and it is a genuinely new capability, consult the `formspec-specs:spec-expert` agent before implementing.
- **Extensibility where the spec demands it.** Formspec has extension points by design. Build clean seams where the spec calls for them, nowhere else.

## Monorepo Structure

- **`packages/formspec-engine/`** — Core form state management (TypeScript). FormEngine class, FEL lexer/parser/interpreter, path resolution, validation. Uses `@preact/signals-core` for reactivity and `chevrotain` for parsing.
- **`packages/formspec-webcomponent/`** — `<formspec-render>` custom element that binds FormEngine to the DOM. Component registry pattern for extensibility.
- **`src/formspec/`** — Python reference implementation and tooling backend. Contains `src/formspec/fel/` (a standalone Python parser, AST, and evaluator for FEL), `src/formspec/adapters/` (Mapping spec implementations for JSON/XML/CSV), and `src/formspec/validator/` (static linter). This powers the Python conformance suite and acts as a server-side validation/linting engine.
- **`schemas/`** — JSON Schema files (definition, response, intake-handoff, validationReport, mapping, theme, component, registry).
- **`specs/`** — Markdown specification documents organized by tier, plus generated LLM/context artifacts.
  - Canonical `*.md` specs are the source for normative behavior semantics.
  - `*.bluf.md` files hold compact "bottom line up front" summaries injected into canonical specs.
  - `*.llm.md` files are generated by `scripts/generate-spec-artifacts.mjs` and MUST NOT be hand-edited.
  - For quick context, prefer the generated `*.llm.md` files.
  - `specs/core/spec.llm.md` — Core specification (items, binds, FEL, validation shapes, processing model)
  - `specs/core/intake-handoff-spec.llm.md` — Intake Handoff boundary contract (validated intake to workflow/case host)
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
  - `thoughts/adr/` — **Active** ADRs (Proposed / in-flight / accepted-but-not-landed). Implemented and historical ADRs live in `thoughts/archive/adr/`. Next free id: **0080** (0074 = ADR-0074 *Class-Aware Response and Bucketed Encryption (Core)* — Formspec native field-level transparency, authoritative for `accessControl` / bucketed Response wire shape / Privacy Profile mechanism; 0075-0079 occupied by the workflow-consolidation cluster — see PLANNING.md "Reading guide for active clusters"; duplicate `0047` / `0048` / `0053` slugs on disk — see `thoughts/README.md`).
  - `thoughts/plans/` — **Active** implementation plans. Completed plans: `thoughts/archive/plans/`.
  - `thoughts/specs/` — **Active** design specs. Delivered / merged specs: `thoughts/archive/specs/`.
  - `thoughts/archive/` — **Implemented**, superseded, or merged precursors. `npm run docs:check` enforces that tracked links use `thoughts/archive/...` for files stored here.
  - `thoughts/reviews/` — Reference reviews and planning docs still in active use; historical reviews: `thoughts/archive/reviews/`. See `thoughts/reviews/README.md`.
  - `thoughts/research/` — Exploratory research, comparative analysis, external doc captures.
  - `thoughts/studio/` — Active Studio canon and spec-cited prior art; archived sprints and visual-review bundles: `thoughts/archive/studio/`. See `thoughts/studio/README.md`.
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

- **Use the `/formspec-specs` skill** (invoke via `Skill` tool with `skill: "formspec-specs:formspec-specs"`) whenever you need to look up spec semantics, parse or validate schemas, understand cross-tier behavior, interpret FEL grammar, or answer any question about what the Formspec specification says. Do not guess from code — the skill has authoritative spec knowledge. This applies to all agents and subagents.
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

[`context.md`](context.md) is the project's living overview — what Formspec is, why, where it's going. Update when scope, positioning, or roadmap materially changes. Do NOT update for implementation details, file paths, or internal architecture (those belong in CLAUDE.md).

## Build & commands

Full target list: read [`Makefile`](Makefile). Key invocations:

- `make build` — full monorepo compile (Rust + npm + pip).
- `make test` — unit + python + rust + e2e + studio-e2e + submodule tests.
- `npm run build` — TypeScript packages only.
- `npm run docs:generate` — regenerate schema-driven spec artifacts + filemap.
- `npm run docs:check` — enforce doc/schema gates.
- `npm run check:deps` — validate package dependency layering.
- `npm test` — full Playwright E2E (auto-starts Vite).
- `npx playwright test <file>` — single Playwright file.
- `npx playwright test --grep "<pattern>"` — pattern match across E2E suite.
- `python3 -m pytest tests/ -v` — Python conformance suite.
- `python3 -m pytest tests/test_fel_evaluator.py::TestClass::test_name -v` — single Python test.
- `python3 -m formspec.validate <dir> --registry registries/formspec-common.registry.json` — validate all artifacts in a directory.

## Package layering

Enforced by `npm run check:deps`. Rule: a package at layer N may only depend on packages at layer < N (strictly lower; same-layer dependencies forbidden). WASM is exclusive to `formspec-engine`; no other package may import from `wasm-pkg*`, `formspec-wasm`, or generated `formspec_wasm*` glue.

| Layer | Packages |
|-------|----------|
| 0 | `formspec-types` |
| 1 | `formspec-engine`, `formspec-layout` |
| 2 | `formspec-webcomponent`, `formspec-core` |
| 3 | `formspec-adapters`, `formspec-studio-core` |
| 4 | `formspec-mcp` |
| 5 | `formspec-chat` |
| 6 | `formspec-studio` |

Layer assignments and the fence checker live in [`scripts/check-dep-fences.mjs`](scripts/check-dep-fences.mjs).

## Architecture

### Logic ownership (Rust / WASM first)

**Keep spec business logic in Rust crates** (`crates/formspec-*`, `fel-core`, etc.) and expose it through **WASM** (and **Python** for server/tooling). TypeScript is for **orchestration**: reactive `FormEngine` state, webcomponent rendering, studio/project commands, and **thin bridges** to WASM — not the source of truth for FEL evaluation, validation semantics, coercion, migrations, mapping execution, or lint rules. **Do not add new spec behavior in TS** when it belongs in Rust; extend the Rust implementation and call it from the bridge. The engine uses **WASM** for FEL parse, dependency extraction, analysis, prepare, and eval (`getFELDependencies`, `analyzeFEL`, `evalFEL`, etc.); `packages/formspec-engine/src/fel/` is **API glue** (`fel-api-runtime` / `fel-api-tools`), not an in-tree Chevrotain stack.

### FormEngine (`packages/formspec-engine/src/index.ts`)

Central class that manages form state with Preact Signals. Key methods: `setDefinition()`, `setValue()`, `getResponse()`, `getValidationReport()`, `compileExpression()`.

Apps using `formspec-engine` directly must call `await initFormspecEngine()` before constructing `FormEngine`. Authoring APIs (lint, registry helpers, mapping, FEL tokenize/print) also need `await initFormspecEngineTools()`. See [`packages/formspec-engine/README.md`](packages/formspec-engine/README.md) for initialization paths, WASM bridge details, entry-point variants, and tarball/gitignore mechanics.

### FEL in the TypeScript engine

Rust/WASM (`fel-core`, `formspec-core`, `formspec-wasm`) owns the FEL grammar, parser, evaluator, and dependency extraction. The TypeScript wrappers in `packages/formspec-engine/src/fel/` are thin facades. Do NOT add FEL semantics in TypeScript; extend Rust and call through the bridge.

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
