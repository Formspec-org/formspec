# Unified Authoring Architecture — Finish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Agent roles for each task:**
>
> - **`formspec-craftsman`** — Implement the task (write code, create tests, make them pass). Dispatch via `Agent` tool with `subagent_type: "formspec-specs:formspec-craftsman"`.
> - **`formspec-scout`** — Review completed work (code quality, spec compliance, architecture). Dispatch via `Agent` tool with `subagent_type: "formspec-specs:formspec-scout"`.
> - **`spec-expert`** — Validate spec assumptions, answer questions about normative behavior, resolve ambiguities. Dispatch via `Agent` tool with `subagent_type: "formspec-specs:spec-expert"`.
> - **`test-engineer`** — Review test coverage after craftsman's work (quality, edge cases, missing scenarios, test design). Dispatch via `Agent` tool with `subagent_type: "test-engineer"`.
>
> **Workflow per task:**
>
> 1. `spec-expert` (if needed) — resolve any spec ambiguities before coding
> 2. `formspec-craftsman` — implement with TDD (failing tests → implementation → passing tests)
> 3. `test-engineer` — review test coverage, identify gaps, suggest missing edge cases
> 4. `formspec-craftsman` — fill any test gaps identified by test-engineer
> 5. `formspec-scout` — final review (code quality, spec compliance, architecture)
> 6. Fix scout findings if any, re-review if needed

**Goal:** Complete the Unified Authoring Architecture from spec v6 — reconcile branches, fix open issues, migrate helpers, expand MCP coverage, build new document types, implement Rust dependency analysis, integrate chat, and ship the convergence UI.

**Architecture:** The spec defines a 5-phase migration (documented in `thoughts/specs/2026-03-24-unified-authoring-architecture.md` v6). Phase 4a (changeset infrastructure) is mostly done on branch `claude/unified-authoring-architecture-msWWJ`. Remaining work is Phases 1-3 (foundation, MCP expansion, new document types), Phase 4a-D (Rust dependency analysis), Phase 4b (chat integration), and Phase 4c (convergence UI).

**Tech Stack:** TypeScript (formspec-core, studio-core, mcp, chat, studio), Rust (fel-core, formspec-changeset), WASM (formspec-wasm), Vitest (unit/integration tests), Playwright (E2E tests)

**Spec:** `thoughts/specs/2026-03-24-unified-authoring-architecture.md`

**Worktree:** All work happens in the existing unified-authoring worktree:

```
.claude/worktrees/unified-authoring/   ← working directory for all tasks
  Branch: claude/unified-authoring-architecture-msWWJ
```

All file paths in this plan are relative to the worktree root. All `npm`, `cargo`, and `vitest` commands must run from `.claude/worktrees/unified-authoring/`. After each milestone that changes `node_modules` or build output, run `npm install && npm run build` in the worktree. Commit all work to the worktree branch — never leave uncommitted changes.

---

## Milestone 0: Verify Baseline

**Goal:** Confirm the worktree branch builds and tests pass before starting new work.

**Context:** The worktree at `.claude/worktrees/unified-authoring/` is on branch `claude/unified-authoring-architecture-msWWJ`. The Rust layout planner work on `claude/rust-layout-planner-pdf-c2BTe` will be integrated separately — no rebase needed here.

### Task 0.1: Verify worktree is clean and tests pass

**Files:**

- No file modifications — verification only

- [ ] **Step 1: Verify worktree is clean**

```bash
cd .claude/worktrees/unified-authoring
git status --short  # Must be empty (or only expected changes)
```

- [ ] **Step 2: Rebuild and verify**

```bash
cd .claude/worktrees/unified-authoring
npm install && npm run build

# Package-level TS tests
cd packages/formspec-core && npx vitest run && cd ../..
cd packages/formspec-studio-core && npx vitest run && cd ../..
cd packages/formspec-mcp && npx vitest run && cd ../..
```

Expected: All TS tests pass. Core 613+, studio-core 480+, MCP 287+.

---

## Milestone 1: Fix Open Phase 4a Issues

**Goal:** Close the 3 open review findings (O1, F3, F4) from the changeset infrastructure review.

**Context:** Work in `.claude/worktrees/unified-authoring/`. Expected-fail tests already exist for O1 and F3. F4 is deferred (no runtime engine in structural authoring tier).

### Task 1.1: Fix O1 — bracket summary extraction

**Agents:** `formspec-craftsman` implements. `test-engineer` reviews test coverage. `formspec-scout` reviews code. If the refactoring of tool handler layers raises questions about which MCP response semantics are normative, ask `spec-expert`.

**Problem:** `withChangesetBracket` in `packages/formspec-mcp/src/tools/changeset.ts` sees the MCP response envelope (JSON with `content` array), not the raw `HelperResult`. Every `ChangeEntry` gets generic `"toolName executed"` fallback summary instead of the actual helper summary.

**Files:**

- Modify: `packages/formspec-mcp/src/tools/changeset.ts` — restructure `bracketMutation()` to wrap the raw helper call
- Modify: `packages/formspec-mcp/src/create-server.ts` — adjust how `bracketMutation` is called
- Test: `packages/formspec-mcp/tests/changeset-bracket.test.ts` — flip expected-fail tests to expected-pass

**Architecture of the problem:** Each tool handler function (e.g., `handleField` in `tools/structure.ts`) internally does TWO things: (1) calls the raw `Project` helper method (e.g., `project.addField()`) which returns a `HelperResult`, and (2) wraps the result with `wrapHelperCall()` to produce an MCP response envelope. The current `bracketMutation()` wraps the OUTER function (which returns the MCP envelope), so it only sees the envelope — not the raw `HelperResult.summary`.

**Fix approach:** Split each tool handler into two layers:

1. A raw helper lambda: `(project, params) => HelperResult` — the actual business logic
2. The MCP wrapping: `wrapHelperCall(() => rawHelper(project, params))` — response formatting

`bracketMutation()` takes the raw helper lambda. Inside the bracket:

1. Call `beginEntry(toolName)`
2. Run the raw helper → get `HelperResult`
3. Extract `result.summary` and `result.warnings`
4. Call `endEntry(summary, warnings)`
5. Return `wrapHelperCall()` of the result

This requires refactoring each handler in `tools/structure.ts`, `tools/behavior.ts`, `tools/data.ts`, `tools/screener.ts`, `tools/style.ts`, `tools/flow.ts` to expose a raw helper extraction point. The simplest approach: have `bracketMutation` accept a `(registry, projectId, params) => HelperResult` function, and handle the `wrapHelperCall` wrapping itself.

- [ ] **Step 1: Read the existing bracket implementation and tool handlers**

Read `packages/formspec-mcp/src/tools/changeset.ts` (understand `bracketMutation()` signature).
Read `packages/formspec-mcp/src/tools/structure.ts` (understand how `handleField` etc. internally call `wrapHelperCall`).
Read `packages/formspec-mcp/src/errors.ts` (understand `wrapHelperCall` signature).

- [ ] **Step 2: Read and flip the expected-fail tests**

Read `packages/formspec-mcp/tests/changeset-bracket.test.ts` — find `it.fails` tests for O1. Change to `it(...)`. Run — should fail (RED).

Run: `cd packages/formspec-mcp && npx vitest run tests/changeset-bracket.test.ts`
Expected: FAIL — summaries still contain generic fallback.

- [ ] **Step 3: Refactor bracketMutation to accept raw helper lambdas**

Change `bracketMutation(toolName, handler)` so `handler` has type `(registry: ProjectRegistry, projectId: string, params: Record<string, unknown>) => HelperResult`. Inside `bracketMutation`:

```typescript
const result = handler(registry, projectId, params);  // raw HelperResult
pm.endEntry(result.summary, result.warnings?.map(w => w.message) ?? []);
return successResponse(result);  // wrap AFTER extracting summary
```

- [ ] **Step 4: Update each tool registration in create-server.ts**

For each of the 13 mutation tools wrapped with `bracketMutation()`, change the handler lambda to return a `HelperResult` instead of an MCP response. Example for `formspec_field`:

```typescript
// Before: bracketMutation('formspec_field', (reg, pid, p) => handleField(reg, pid, p))
// After:  bracketMutation('formspec_field', (reg, pid, p) => rawHandleField(reg, pid, p))
```

Where `rawHandleField` calls `project.addField()` directly and returns the `HelperResult`.

- [ ] **Step 5: Run tests — verify pass**

Run: `cd packages/formspec-mcp && npx vitest run`
Expected: ALL PASS — including the previously-expected-fail O1 tests.

- [ ] **Step 6: Run tests — verify pass**

Run: `cd packages/formspec-mcp && npx vitest run`
Expected: ALL PASS — including the previously-expected-fail O1 tests.

- [ ] **Step 7: Commit**

```
fix: extract real helper summary in changeset bracket (O1)
```

### Task 1.2: Fix F3 — capturedValues for `=`-prefix expressions

**Agents:** `spec-expert` first — confirm the exact semantics of `=`-prefix `initialValue` evaluation timing (S4.2.3) and whether the authoring tier has access to evaluated values or only the definition-level expression string. Then `formspec-craftsman` implements. `test-engineer` reviews test coverage (edge cases: nested groups, `prePopulate` with `=` prefix, `default` with `=` prefix). `formspec-scout` reviews code.

**Problem:** When the recording middleware captures commands that create items with `initialValue: "=today()"` or `default: "=$otherField"`, the evaluated result is not stored in `ChangeEntry.capturedValues`. On replay, the expression re-evaluates to a different value.

**Files:**

- Modify: `packages/formspec-studio-core/src/proposal-manager.ts` — populate `capturedValues` during recording
- Test: `packages/formspec-studio-core/tests/proposal-manager.test.ts` — flip expected-fail F3 tests

**Architecture of the problem:** The `onCommandsRecorded` callback receives `priorState` (before execution) but the evaluated value of `=today()` exists only AFTER execution in the engine's instance data. The ProposalManager has access to `this.project.state` (post-execution). For `initialValue` with `=` prefix, the spec (S4.2.3) says the expression is evaluated once at creation time and the result is stored as the field's value. So the evaluated result is in the post-execution definition's instance data at the field's path.

**Capturing approach:**

1. In `onCommandsRecorded()`, scan command payloads for `=`-prefixed `initialValue` or `default` values
2. For each match, extract the field path from the command payload
3. Look up the field's current value in `this.project.state` (post-execution state) — specifically, if the project has a runtime engine, read the field's evaluated value; if not (structural authoring only), read from definition instance data
4. Store as `capturedValues[fieldPath] = evaluatedValue`

**Replay approach:**

1. In `_replayCommands()`, for each command with a `capturedValues` entry:
2. Clone the command, replace the `=`-prefixed expression in `initialValue`/`default` with the captured literal value
3. Dispatch the patched command

**Note:** In the structural authoring tier (no runtime engine), `=`-prefix expressions may not actually evaluate during `addItem`. In that case, `capturedValues` remains empty and replay uses the original expression. This is acceptable — the edge case only matters when a runtime engine is present (e.g., preview mode). The expected-fail tests should reflect this nuance.

- [ ] **Step 1: Read the expected-fail F3 tests**

Read `packages/formspec-studio-core/tests/proposal-manager.test.ts` — find `it.fails` tests for F3. Understand what scenario they test (structural-only vs runtime engine).

- [ ] **Step 2: Flip expected-fail tests to expected-pass**

Change `it.fails(...)` to `it(...)`. Run — should fail (RED).

Run: `cd packages/formspec-studio-core && npx vitest run tests/proposal-manager.test.ts`

- [ ] **Step 3: Implement capturedValues scanning in `onCommandsRecorded`**

In the `onCommandsRecorded` callback of ProposalManager, after appending to the current entry's `commands`:

```typescript
// Scan for =-prefix expressions
for (const phase of commands) {
  for (const cmd of phase) {
    if (cmd.type === 'definition.addItem' && typeof cmd.payload?.initialValue === 'string' && cmd.payload.initialValue.startsWith('=')) {
      const path = cmd.payload.key ?? cmd.payload.path;
      // Look up evaluated value from post-execution state
      const value = this._project.itemAt(path)?.value;  // or engine signal
      if (value !== undefined) {
        entry.capturedValues ??= {};
        entry.capturedValues[path] = value;
      }
    }
    // Same pattern for definition.setBind with calculate/default/initialValue
  }
}
```

- [ ] **Step 4: Implement capturedValues patching in `_replayCommands`**

Before dispatching each command during replay:

```typescript
for (const cmd of phase) {
  if (entry.capturedValues?.[cmd.payload?.key]) {
    cmd = structuredClone(cmd);
    cmd.payload.initialValue = entry.capturedValues[cmd.payload.key];
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

- [ ] **Step 4: Run tests — verify pass**

Run: `cd packages/formspec-studio-core && npx vitest run`

- [ ] **Step 5: Commit**

```
fix: populate capturedValues for =-prefix expressions during recording (F3)
```

---

## Milestone 2: Phase 1 Foundation (E1-E3, C1-C11)

**Goal:** Push spec-level logic and structural queries down from studio into engine and core packages. These are prerequisites for Phase 2 MCP tool expansion.

**Context:** Spec Section 5, Phase 1. Four passes (1a-1d). Most items are TS-side work in `formspec-core`. E1 is Rust (`fel-core`).

**Agents per task:** `formspec-craftsman` implements each task. `test-engineer` reviews test coverage after each implementation. `formspec-scout` reviews after each commit. `spec-expert` consulted for E1 (FEL identifier grammar rules, reserved keywords) and C4 (which page mode behaviors are normative vs implementation choice).

### Task 2.1: Pass 1a — E1 FEL identifier validation (Rust)

**Files:**

- Modify: `crates/fel-core/src/lexer.rs` — add `pub fn is_valid_fel_identifier(s: &str) -> bool` and `pub fn sanitize_fel_identifier(s: &str) -> String`
- Modify: `crates/formspec-wasm/src/lib.rs` — expose via WASM
- Test: `crates/fel-core/src/tests.rs` — unit tests for identifier validation
- Modify: `packages/formspec-engine/src/fel/fel-api-tools.ts` — add TS bridge functions

**Why:** 3 divergent inline copies of FEL identifier validation exist in studio. The canonical definition is in the Rust lexer but not exported.

- [ ] **Step 1: Write failing Rust tests for `is_valid_fel_identifier`**

Test cases: valid identifiers (`foo`, `_bar`, `camelCase123`), invalid (`123abc`, `$ref`, `foo-bar`, empty string, keywords like `true`/`false`/`null`/`and`/`or`/`not`).

- [ ] **Step 2: Implement `is_valid_fel_identifier` in `lexer.rs`**

Use the existing lexer's identifier token rule. An identifier is valid if it matches `[a-zA-Z_][a-zA-Z0-9_]*` and is not a reserved keyword.

- [ ] **Step 3: Write tests and implement `sanitize_fel_identifier`**

Strips invalid chars, prepends `_` if starts with digit, appends `_` if reserved keyword.

- [ ] **Step 4: Expose via WASM in `formspec-wasm`**

Add `#[wasm_bindgen] pub fn is_valid_fel_identifier(s: &str) -> bool` and `sanitize_fel_identifier`.

- [ ] **Step 5: Add TS bridge in `fel-api-tools.ts`**

```typescript
export function isValidFELIdentifier(s: string): boolean { ... }
export function sanitizeFELIdentifier(s: string): string { ... }
```

- [ ] **Step 6: Run all tests**

```bash
cargo test -p fel-core
npm run build && cd packages/formspec-engine && npx vitest run
```

- [ ] **Step 7: Commit**

```
feat(fel-core): export FEL identifier validation and sanitization (E1)
```

### Task 2.2: Pass 1a — E3 FEL function catalog consolidation

**Files:**

- Modify: `crates/fel-core/src/builtins.rs` (or wherever `BUILTIN_FUNCTIONS` is defined) — ensure all function metadata (description, parameter names, return types) is complete
- Delete: `packages/formspec-studio/src/lib/fel-catalog.ts` (111 lines) — studio's supplemental `FUNCTION_DETAILS`
- Modify: Studio components importing from `fel-catalog.ts` → import from engine's WASM-bridged catalog

**Why:** E3 is "Already done" for the core implementation but studio still has a separate `FUNCTION_DETAILS` catalog in `fel-catalog.ts` that duplicates/supplements the Rust `BUILTIN_FUNCTIONS`. The supplemental metadata (descriptions, parameter info) needs to be consolidated into the Rust catalog, then the studio file deleted.

- [ ] **Step 1: Compare `fel-catalog.ts` entries against Rust `BUILTIN_FUNCTIONS`**

Read both files. Identify any metadata in the studio catalog not present in Rust.

- [ ] **Step 2: Add missing metadata to Rust catalog if needed**

If Rust `BUILTIN_FUNCTIONS` lacks descriptions or parameter names that studio's `FUNCTION_DETAILS` has, add them to the Rust side.

- [ ] **Step 3: Update studio imports to use engine's catalog export**

Replace `import { FUNCTION_DETAILS } from '../lib/fel-catalog'` with the engine's WASM-bridged function catalog.

- [ ] **Step 4: Delete `fel-catalog.ts`**
- [ ] **Step 5: Build and test**

```bash
cargo test -p fel-core
npm run build && cd packages/formspec-studio && npx vitest run
```

- [ ] **Step 6: Commit**

```
refactor: consolidate FEL function catalog into Rust, delete studio duplicate (E3)
```

### Task 2.3: Pass 1a — E2 Data type taxonomy predicates (TS engine)

**Files:**

- Create: `packages/formspec-engine/src/taxonomy.ts` — `isNumericType()`, `isDateType()`, `isChoiceType()` etc.
- Modify: `packages/formspec-engine/src/index.ts` — export new predicates from barrel
- Test: `packages/formspec-engine/tests/taxonomy.test.mjs` (engine tests use `.test.mjs`)

**Why:** Studio has 3-line functions for data type classification scattered across field-helpers.ts. These belong in the engine as canonical predicates.

- [ ] **Step 1: Write failing tests for type predicates**

```typescript
// isNumericType('integer') → true, isNumericType('string') → false
// isDateType('date') → true, isChoiceType('select') → true
// isTextType('string') → true, isTextType('text') → true
```

- [ ] **Step 2: Implement predicates**

Group data types per spec S4.2.3 into: numeric (`integer`, `decimal`, `money`), date (`date`, `time`, `dateTime`), choice (`select`, `selectMany`), text (`string`, `text`), boolean, binary (`file`, `image`, `signature`, `barcode`).

- [ ] **Step 3: Run tests, commit**

```
feat(engine): add data type taxonomy predicates (E2)
```

### Task 2.3: Pass 1b — C1 normalizeBinds, C8 field/bind/shape lookups

**Files:**

- Create: `packages/formspec-core/src/queries/bind-normalization.ts` — `normalizeBinds(state, path)`
- Modify: `packages/formspec-core/src/queries/field-queries.ts` — add/consolidate lookup functions
- Modify: `packages/formspec-core/src/queries/index.ts` — re-export new functions
- Test: `packages/formspec-core/tests/bind-normalization.test.ts`

**Why:** `normalizeBinds` has two divergent copies in studio (LogicTab.tsx, CommandPalette.tsx). Field/bind/shape lookups are scattered across studio + studio-core.

- [ ] **Step 1: Write failing tests for `normalizeBinds`**

Test: given a definition with binds and prePopulate on a field, returns a merged view of all constraints affecting that field path.

- [ ] **Step 2: Implement `normalizeBinds`**

Merge all binds targeting a path with any `prePopulate` on the item. Return a flat record of constraint types to their values/expressions.

- [ ] **Step 3: Consolidate field/bind/shape lookups into `field-queries.ts`**

Add: `findItem(state, key)`, `bindsForPath(state, path)`, `shapesForPath(state, path)`, `allFieldKeys(state)`.

- [ ] **Step 4: Run tests, commit**

```
feat(core): add normalizeBinds and consolidated field/bind/shape lookups (C1, C8)
```

### Task 2.4: Pass 1c — C5 drop targets, C6 tree flattening, C7 multi-select ops

**Files:**

- Create: `packages/formspec-core/src/queries/drop-targets.ts` — `computeDropTargets(state, draggedPaths)`
- Create: `packages/formspec-core/src/queries/tree-flattening.ts` — `flattenDefinitionTree(state)`
- Create: `packages/formspec-core/src/queries/selection-ops.ts` — `commonAncestor(paths)`, `pathsOverlap(a, b)`, `expandSelection(paths, state)`
- Tests for each

**Why:** DnD logic (294 lines in studio's tree-helpers.ts), tree flattening, and path selection algebra need to move to core for reuse.

- [ ] **Step 1: Write failing tests for each module**
- [ ] **Step 2: Implement — port logic from studio originals, adapt to core's state/types**
- [ ] **Step 3: Run tests, commit**

```
feat(core): add drop targets, tree flattening, and selection ops (C5-C7)
```

### Task 2.5: Pass 1d — C2-C4, C9-C11

**Files:**

- Create: `packages/formspec-core/src/queries/shape-display.ts` — `describeShapeConstraint(shape)` (C2)
- Create: `packages/formspec-core/src/queries/optionset-usage.ts` — `optionSetUsageCount(state, name)` (C3)
- Create: `packages/formspec-core/src/queries/artifact-mapping.ts` — `artifactTypeFor(key)` (C9)
- Create: `packages/formspec-core/src/queries/search-index.ts` — `buildSearchIndex(state)` (C10)
- Create: `packages/formspec-core/src/queries/serialization.ts` — `serializeToJSON/CSV/XML(state, mapping)` (C11)
- Tests for each

C4 (page mode) is already done in both TS (`resolvePageStructure()`) and Rust (`plan_theme_pages()`). Studio needs to import from core instead of re-deriving — update imports only, no new implementation.

- [ ] **Step 1-5: TDD each module (tests first, then implement)**
- [ ] **Step 6: Update studio to import C4 from core instead of re-deriving**
- [ ] **Step 7: Run full suite, commit per logical group**

```
feat(core): add shape display, optionset usage, search index, serialization (C2-C3, C9-C11)
refactor(studio): use core page mode resolution instead of re-deriving (C4)
```

### Task 2.7: Delete studio originals

**Files:**

- Delete: `packages/formspec-studio/src/lib/tree-helpers.ts`
- Delete: `packages/formspec-studio/src/lib/selection-helpers.ts`
- Delete: `packages/formspec-studio/src/lib/humanize.ts`
- Delete: `packages/formspec-studio/src/lib/fel-catalog.ts` (if not already deleted in Task 2.2)
- Modify: `packages/formspec-studio/src/lib/field-helpers.ts` — delete migrated functions, keep UI-only remnants (icons, colors)
- Defer to Milestone 3: `packages/formspec-studio/src/lib/fel-editor-utils.ts` (depends on pass 2b FEL editing)
- Defer to Milestone 4: `packages/formspec-studio/src/workspaces/mapping/adapters.ts` (depends on pass 3e mapping full coverage), `packages/formspec-studio/src/workspaces/preview/preview-documents.ts` (depends on pass 2d preview expansion)
- Modify: Studio components that imported from deleted files → import from core/studio-core

- [ ] **Step 1: Update imports across studio to use new core exports**
- [ ] **Step 2: Delete the original files**
- [ ] **Step 3: Build studio, fix any remaining import errors**
- [ ] **Step 4: Run Playwright E2E tests to verify no regressions**

Run: `npm test` (runs Playwright suite)

- [ ] **Step 5: Commit**

```
refactor(studio): replace local helpers with formspec-core imports, delete originals
```

---

## Milestone 3: Phase 2 — MCP Tool Expansion (S1-S18)

**Goal:** Each studio-core business logic migration ships with its MCP tool. 7 passes.

**Context:** Spec Section 5, Phase 2. These items represent helper methods that need to be:

1. Implemented in studio-core (if not already)
2. Exposed as MCP tools (new tools or expanded existing tools)
3. Wrapped with `bracketMutation()` for changeset support

**Agents per pass:** `spec-expert` to clarify S1-S18 semantics before each pass. `formspec-craftsman` implements. `test-engineer` reviews test coverage. `formspec-scout` reviews code + spec compliance.

**Pattern for each pass:**

1. `spec-expert`: clarify what the S-items in this pass require (normative behavior, edge cases)
2. `formspec-craftsman`: write failing tests for the studio-core helper
3. `formspec-craftsman`: implement the helper in `packages/formspec-studio-core/src/project.ts`
4. `formspec-craftsman`: write failing tests for the MCP tool
5. `formspec-craftsman`: register the tool in `packages/formspec-mcp/src/create-server.ts`
6. `formspec-craftsman`: implement the tool handler in the appropriate `tools/*.ts` file
7. `formspec-craftsman`: wrap with `bracketMutation()` for changeset support
8. `test-engineer`: review test coverage, identify gaps
9. `formspec-craftsman`: fill test gaps
10. `formspec-scout`: review code quality + spec compliance
11. Run all tests, commit

### Task 3.1: Pass 2a — S1-S5 Catalogs, type metadata, widget compatibility → `formspec_widget`

**Files:**

- Modify: `packages/formspec-studio-core/src/project.ts` — add catalog/widget methods
- Create: `packages/formspec-mcp/src/tools/widget.ts` — new tool handler
- Modify: `packages/formspec-mcp/src/create-server.ts` — register `formspec_widget`
- Tests for both layers

**Operations:** Widget hint resolution, compatibility matrix query (which widgets work with which data types), widget ↔ component mapping, field type catalog.

### Task 3.2: Pass 2b — S6-S8 FEL editing → expand `formspec_fel`

**Files:**

- Modify: `packages/formspec-mcp/src/tools/fel.ts` — add editing support modes
- Modify: `packages/formspec-studio-core/src/project.ts` — FEL editing helpers
- Tests

**Operations:** FEL expression validation with diagnostics, syntax highlighting token stream, autocomplete suggestions (field refs, function names), expression humanization (FEL → English).

### Task 3.3: Pass 2c — S9-S13 Parsing, defaults, sanitization → expand `formspec_update`, `formspec_structure`

**Files:**

- Modify: `packages/formspec-mcp/src/tools/structure.ts` — add batch operations
- Create: `packages/formspec-mcp/src/tools/structure-batch.ts` — `wrapItemsInGroup`, `batchDeleteItems`, `batchDuplicateItems`
- Tests

**Operations:** Input parsing, smart defaults for field creation, key sanitization, item placement, widget ↔ component auto-mapping.

### Task 3.4: Pass 2d — S14-S16 Document normalization, sample data → expand `formspec_preview`

**Files:**

- Modify: `packages/formspec-mcp/src/tools/query.ts` — expand preview tool
- Tests

**Operations:** Document normalization (strip defaults, canonicalize), sample data generation (plausible values per data type), engine seeding (populate engine from state snapshot).

### Task 3.5: Pass 2e — S17-S18 Item classification, bind behavior → expand `formspec_audit`

**Files:**

- Create: `packages/formspec-mcp/src/tools/audit.ts` — new comprehensive audit tool
- Tests

**Operations:** Item classification (display vs field vs group), bind behavior enumeration (which binds affect a field, what they do).

### Task 3.6: Pass 2f — Theme full coverage → expand `formspec_theme`

**Files:**

- Create: `packages/formspec-mcp/src/tools/theme.ts` — new tool handler
- Modify: `packages/formspec-mcp/src/create-server.ts` — register `formspec_theme`
- Tests

**Operations:** Token CRUD, defaults CRUD, selector CRUD + reorder, item overrides, breakpoints, platform, responsive region overrides, `stylesheets`, document metadata. Note: Rust `formspec-theme` crate already implements cascade/tokens/widget — MCP tool is TS orchestration.

### Task 3.7: Pass 2g — Component full coverage → expand `formspec_component`

**Files:**

- Create: `packages/formspec-mcp/src/tools/component.ts` — new tool handler
- Modify: `packages/formspec-mcp/src/create-server.ts` — register `formspec_component`
- Tests

**Operations:** Tree node CRUD, `when` conditional rendering, custom component registry, tokens, responsive, id, breakpoints. Note: Rust `formspec-plan` already implements custom component expansion + cycle detection.

---

## Milestone 4: Phase 3 — New Document Types + Remaining Tools

**Goal:** Add MCP tools for locale, ontology, references, migration, advanced mapping, advanced behavior, advanced publish, composition, changelog, response, and cross-document audit.

**Context:** Spec Section 5, Phase 3. 12 passes (3a-3l). Each pass adds a new tool or expands an existing one.

**Agents:** Same pattern as Milestone 3 — `spec-expert` before each pass (new document types have complex normative semantics), `formspec-craftsman` implements, `test-engineer` reviews test coverage, `formspec-scout` reviews code. Locale (3a), ontology (3b), and references (3c) particularly benefit from `spec-expert` consultation since they introduce entirely new document schemas.

### Task 4.1-4.12: One task per pass (3a through 3l)

Each follows the same pattern:

1. Define the document type's handlers in `formspec-core` if structural mutations are needed
2. Add studio-core helpers for the authoring workflow
3. Register MCP tool with schema + handler
4. Wrap mutation tools with `bracketMutation()`
5. Test at each layer

| Pass | Tool | Key complexity |
|------|------|---------------|
| 3a | `formspec_locale` | Full key taxonomy (item strings, context variants, form strings, shape messages, page strings, option set strings, component strings). Fallback cascade. FEL interpolation validation. |
| 3b | `formspec_ontology` | Concept bindings, vocabulary bindings, SKOS alignments, JSON-LD fragments. |
| 3c | `formspec_reference` | Bound references with all properties. `referenceDefs` for DRY reuse. Multiple URI schemes. |
| 3d | `formspec_migration` | Migration rule CRUD, transform types. |
| 3e | `formspec_mapping` (expand) | Multi-mapping CRUD, adapters, direction, autoMap, autoGenerateMappingRules. |
| 3f | `formspec_update`/`formspec_behavior` (expand) | Bind fine-grained properties. |
| 3g | `formspec_behavior` (expand) | Shape composition (`and`/`or`/`not`/`xone`), `updateValidation`. |
| 3h | `formspec_publish` (expand) | Version lifecycle, sidecar version coordination. |
| 3i | `formspec_composition` | `$ref` management on groups. |
| 3j | `formspec_changelog` | Changelog document CRUD, `diffFromBaseline`. |
| 3k | `formspec_response` | Test response management, external validation injection. |
| 3l | `formspec_audit` (expand) | Cross-document consistency checking, accessibility audit. |

---

## Milestone 5: Phase 4a-D — Rust Dependency Analysis

**Goal:** Replace the stub `_computeDependencyGroups()` (returns single group) with a real Rust implementation that extracts dependency edges and computes connected components.

**Context:** Spec Section 2, "Dependency Analysis Engine." The `formspec-changeset` crate is a new Rust workspace member. **This milestone can start immediately after Milestone 0** (branch reconciliation) — Tasks 5.1-5.4 (Rust crate creation + WASM bridge) have zero dependency on Milestones 1-3 (TS work). Only Task 5.5 (wire into ProposalManager) depends on the changeset infrastructure from Milestone 1.

**Agents:** `spec-expert` before Tasks 5.2 — the dependency edge catalog (spec Section 2 "Dependency edges to track") has 20+ edge types; confirm completeness and priority. `formspec-craftsman` implements the Rust crate. `test-engineer` reviews test coverage (critical — dependency analysis correctness determines partial merge safety). `formspec-scout` reviews architecture and spec compliance.

### Task 5.1: Create `formspec-changeset` crate scaffold

**Files:**

- Create: `crates/formspec-changeset/Cargo.toml`
- Create: `crates/formspec-changeset/src/lib.rs`
- Create: `crates/formspec-changeset/src/types.rs`
- Modify: `Cargo.toml` — add to workspace members

**Dependencies:** `fel-core` (FEL expression scanning), `formspec-core` (definition types), `serde`, `serde_json`.

### Task 5.2: Implement key extraction — what each entry creates and references

**Files:**

- Create: `crates/formspec-changeset/src/extract.rs`
- Test: `crates/formspec-changeset/src/tests.rs`

For each `RecordedEntry`:

1. Extract keys it **creates** (from `definition.addItem`, `definition.addBind`, `definition.addShape`, `definition.addVariable`, etc.)
2. Extract keys it **references** — by scanning:
   - FEL expressions via `fel-core` dependency extraction (`$key` tokens, `@instance('name')`, `@variableName`)
   - Shape composition `id` references (`and`/`or`/`not`/`xone`)
   - Bind `path` targets
   - Shape `activeWhen`, `context`, `message` interpolation
   - Screener route `condition` expressions
   - Component `when` expressions, slot bindings, Summary/DataTable/Accordion `bind`
   - Locale string keys, ontology bindings, reference targets, mapping sourcePaths
   - `optionSet` name references, `prePopulate.instance`, field `children`
   - Migration `expression` FEL references

### Task 5.3: Implement dependency graph and connected components

**Files:**

- Create: `crates/formspec-changeset/src/graph.rs`
- Test additions to `tests.rs`

1. Build directed graph: entry B depends on entry A if B references a key A created
2. Add order-dependent edges: all screener route mutations → same group, all theme selector mutations → same group
3. Compute connected components → dependency groups

### Task 5.4: Expose via WASM

**Files:**

- Modify: `crates/formspec-wasm/Cargo.toml` — add `formspec-changeset` dependency
- Modify: `crates/formspec-wasm/src/lib.rs` — add `changeset-api` feature flag
- Create: `crates/formspec-wasm/src/changeset.rs` — WASM bridge function

```rust
#[wasm_bindgen]
pub fn compute_dependency_groups(entries_json: &str, definition_json: &str) -> String
```

### Task 5.5: Wire into ProposalManager

**Files:**

- Modify: `packages/formspec-engine/src/fel/fel-api-tools.ts` — add `computeDependencyGroups` bridge
- Modify: `packages/formspec-studio-core/src/proposal-manager.ts` — replace stub with WASM call
- Tests: update existing tests that assumed single-group behavior

### Task 5.6: Integration tests with multi-group changesets

**Files:**

- Modify: `packages/formspec-studio-core/tests/proposal-manager.test.ts`

Test: create a changeset with two independent field additions → dependency analysis produces two groups → partial accept works per group.

---

## Milestone 6: Phase 4b — Chat Integration

**Goal:** Refactor `formspec-chat` to stop owning a `Project`. Make it a thin conversation orchestrator that accepts a `ToolContext` from the host.

**Context:** Spec Section 4. Depends on Phase 2 MCP coverage (Milestone 3) being substantially complete.

**Agents:** `formspec-craftsman` implements. `test-engineer` reviews test coverage. `formspec-scout` reviews code and architecture. `spec-expert` consulted for Task 6.1 (ToolContext interface extension — confirm `getProjectSnapshot()` return type and nullability semantics) and Task 6.5 (scaffold-to-changeset bridge — confirm S6.6.2 assembly timing).

### Task 6.1: Pass 4b-A — ChatSession refactor

**Files:**

- Modify: `packages/formspec-chat/src/chat-session.ts` — remove McpBridge dependency, accept ToolContext
- Modify: `packages/formspec-chat/src/types.ts` — extend ToolContext with `getProjectSnapshot()`
- Delete: `packages/formspec-chat/src/mcp-bridge.ts`
- Tests

**Key change:**

```typescript
// Before: session internally creates McpBridge + Project
const session = new ChatSession({ adapter });
await session.scaffold(requirements);

// After: session receives ToolContext from host
const session = new ChatSession({ adapter });
session.setToolContext(toolContext);
```

### Task 6.2: Pass 4b-B — Adapter interface update

**Files:**

- Modify: `packages/formspec-chat/src/gemini-adapter.ts` — keep `generateScaffold()`, remove bridge creation
- Modify: `packages/formspec-chat/src/mock-adapter.ts`

### Task 6.3: Pass 4b-C — Studio chat panel + canvas layout

**Files:**

- Modify: `packages/formspec-studio/src/` — consolidate `main-chat.tsx`, `chat/`, `chat-v2/` into integrated chat panel
- Create: `packages/formspec-studio/src/components/ChatPanel.tsx`

### Task 6.4: Pass 4b-D — Inline canvas AI actions

**Files:**

- Modify: `packages/formspec-studio/src/components/` — add AI-powered context menu items

### Task 6.5: Pass 4b-E — Interview → scaffold flow

**Files:**

- Modify: `packages/formspec-studio/` — scaffold via `generateScaffold()` loaded as changeset

---

## Milestone 7: Phase 4c — Convergence UI

**Goal:** Build the changeset merge review UI in the chat panel. This is where ProposalManager (Track A) meets chat integration (Track B).

**Context:** Spec Section 4, "Merge UX: The Git Model." Depends on Milestones 5 (dependency analysis) and 6 (chat panel).

**Agents:** `formspec-craftsman` implements UI components. `test-engineer` reviews test coverage (E2E tests are critical here — full changeset lifecycle through the UI). `formspec-scout` reviews code and UX. `spec-expert` consulted for conflict diagnostics display (Task 7.3 — which `diagnose()` errors should block merge vs warn).

### Task 7.1: Changeset review component

**Files:**

- Create: `packages/formspec-studio/src/components/ChangesetReview.tsx`
- Create: `packages/formspec-studio/src/components/DependencyGroup.tsx`

**Shows:** Dependency-grouped AI entries with accept/reject controls per group. User overlay entries shown separately. Visual distinction for AI-created elements.

### Task 7.2: Wire review UI to ProposalManager

**Files:**

- Modify: `packages/formspec-studio/src/components/ChatPanel.tsx`

When changeset status is `pending`, the chat panel shows the review UI. Accept/reject buttons dispatch `formspec_changeset_accept`/`formspec_changeset_reject` MCP calls.

### Task 7.3: Conflict diagnostics display

**Files:**

- Modify: `packages/formspec-studio/src/components/ChangesetReview.tsx`

After partial merge, if `diagnose()` returns errors, display them inline with guidance for resolution.

### Task 7.4: E2E tests

**Files:**

- Create: `tests/e2e/playwright/changeset-review.spec.ts`

Test the full flow: open changeset → AI adds fields → close → review groups → partial accept → verify state.

---

## Execution Order and Dependencies

```
Milestone 0 (verify baseline)
    │
    ▼
Milestone 1 (fix O1, F3)
    │
    ├──────────────────────────┐
    ▼                          ▼
Milestone 2 (Phase 1)    Milestone 5 (4a-D Rust dep analysis)
    │                          │
    ▼                          │
Milestone 3 (Phase 2)         │
    │                          │
    ├──────────────┐           │
    ▼              ▼           │
Milestone 4    Milestone 6     │
(Phase 3)      (4b chat)      │
    │              │           │
    │              ▼           │
    │         ┌────┴───────────┘
    │         ▼
    │    Milestone 7 (4c convergence)
    │         │
    └─────────┘
```

**Key parallelism opportunities:**

- **Milestone 5** (Rust crate) can run in parallel with Milestones 2-3 (TS work) — no dependencies between them until Task 5.5 (wire into ProposalManager)
- **Milestone 4** (Phase 3 new doc types) can overlap with Milestone 6 (chat integration) — different packages
- **Milestone 2 tasks 2.1-2.5** are independent and can run in parallel (but all within the same worktree — serialize if needed)

**Critical path:** 0 → 1 → 2 → 3 → 6 → 7

---

## Testing Strategy

**All commands run from the worktree root:** `cd .claude/worktrees/unified-authoring/` first.

**Per milestone:**

- **Unit tests** (Vitest) for every new function in core/studio-core/MCP
- **Integration tests** (Vitest) for MCP tool round-trips (register tool, call it, verify project state changed)
- **E2E tests** (Playwright) for Milestones 6-7 (UI changes)

**Test commands (from worktree root):**

```bash
cd .claude/worktrees/unified-authoring

# Per-package unit/integration
cd packages/formspec-core && npx vitest run && cd ../..
cd packages/formspec-studio-core && npx vitest run && cd ../..
cd packages/formspec-mcp && npx vitest run && cd ../..

# Rust workspace
cargo test --workspace

# E2E (starts Vite server)
npm test

# Full suite
make build && npm test && cargo test --workspace
```

**Red-green-refactor discipline:** Every task starts with a failing test. Write the test, run it (RED), implement (GREEN), then clean up if needed. See CLAUDE.md "Development Workflow."

**Commit discipline:** Commit at every logical stopping point within the worktree. Uncommitted changes in a worktree are invisible to `git log` and will be lost when the worktree is removed. See CLAUDE.md "Git Worktrees."
