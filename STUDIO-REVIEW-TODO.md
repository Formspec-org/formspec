# Studio review — task list

**Scope:** `packages/formspec-studio/`, `packages/formspec-studio-core/`  
**Goal:** Remove dead code, document real gaps, cut correctness and dependency risk.  
**Last validated:** 2026-04-14 (two agent-swarm passes on the repo).

Use this file as a **backlog**: each `- [ ]` is one shippable task unless noted as a multi-step epic.

---

## P0 — Correctness and fences (do before large refactors)

- [x] Add `@formspec-org/types` as a **direct** dependency in `packages/formspec-studio/package.json` → commit `cb921792`.
- [x] Move `nextId` in `packages/formspec-studio-core/src/proposal-manager.ts` from **module scope** to an instance field → commit `e474bbe9`.
- [x] **Document and enforce** the clone-before-`restoreState` contract — JSDoc on `restoreState` + dev-only `deepFreeze` guard + contract tests → commit `e58cac18`.
- [x] Add a **snapshot isolation** test for ProposalManager → commit `e474bbe9` (`instance isolation` describe block).
- [x] Replace `as any` tree access in `packages/formspec-studio-core/src/evaluation-helpers.ts` (previewForm) with typed `CompNode` walks → commit `a44b76a7`.
- [x] **bindKeyMap collision:** `reconcileComponentTree` now stamps `definitionItemPath` on each bound/display node; layout flattening and `render-tree` prefer it over `buildBindKeyMap` when duplicate leaf keys exist (`packages/formspec-core/src/tree-reconciler.ts`, `authoring-helpers.flattenComponentTree`, `render-tree.tsx`). `bindKeyMap` remains a fallback for trees without annotations.

---

## P1 — Owner decision (one outcome per task)

- [ ] **Behavior preview:** Either wire `features/behavior-preview/` (e.g. mount `BehaviorPreview` in a real route/workspace) **or** delete the feature folder and its tests. Today nothing outside tests imports it — orphan code.

---

## P2 — Consolidation and cleanup (safe incremental PRs)

### Component tree helpers

- [x] Introduce shared **`tree-utils.ts`** and consolidate **`findComponentNodeById`** (merged with prior `findNodeById` usage; see `packages/formspec-studio-core/src/tree-utils.ts`).
- [ ] Replace **`componentTreeHasBind`** with **`componentSubtreeContainsRef`** using `{ bind }` only if behavior is identical for all callers; otherwise document why both stay.
- [ ] Factor shared **parent walk** logic between `findParentOfNodeRef` (`layout-dnd-utils.ts` ~9–29) and `_findComponentParentRef` (`project.ts` ~2928–2944) if return-type differences allow a shared core.
- [ ] Remove test-local **`findNodeById` / `findNodeByBind`** in `packages/formspec-studio-core/tests/project-methods.test.ts` (~3690–3709); import the production helper instead of a third DFS copy.

### Chat (dual product — keep both)

- [x] Add a short **“Two chat surfaces”** section to `packages/formspec-studio/README.md` → commit `1108a85d`.
- [x] Replace **500ms `setInterval`** polling of `proposalManager.changeset` in `ChatPanel.tsx` with subscribe/notify via `ProposalManager.subscribe` + `useSyncExternalStore` → commit `1108a85d`.
- [x] **Unify provider localStorage keys** under canonical `formspec:provider-config` with one-time legacy-key migration → commit `3d3ff501` (+ polish: validate legacy value before promoting).
- [x] Add a small **shared icons** module — `IconSparkle` / `IconArrowUp` extracted to `components/icons/` → commit `1108a85d`.

### Legacy / deprecated API

- [x] Remove **`formspecBaseCssHref`** from `packages/formspec-studio/src/workspaces/preview/formspec-base-css-url.ts` → commit `e474bbe9` (swept in by pre-commit hook).
- [x] Update `packages/formspec-studio/tests/setup.ts` to import only **non-deprecated** public exports → commit `e474bbe9`.

### Repo layout (thoughts / research)

- [x] After moving `packages/formspec-studio/research/` into `thoughts/archive/studio/`, add a **README banner** on the archived prototype folder explaining status and date. → [`thoughts/archive/studio/research-2026-04-14/`](thoughts/archive/studio/research-2026-04-14/README.md)
- [x] Delete the empty **`packages/formspec-studio/research/`** directory if migration is complete.
- [x] Move `packages/formspec-studio/thoughts/editor-canvas-audit.md` to repo-root **`thoughts/`** (or `thoughts/archive/...` if historical only). → [`thoughts/plans/2026-03-13-editor-canvas-audit.md`](thoughts/plans/2026-03-13-editor-canvas-audit.md)
- [x] Move `packages/formspec-studio-core/research/adr/` to repo-root **`thoughts/adr/`** or **`thoughts/archive/adr/`** per house style. → `thoughts/adr/0061-current-state-authoring-runtime.md`, `0061-current-state-authoring-runtime-tasks.md`, `0062-post-split-follow-ups.md` (renumbered from 0001/0002; next free id was 0061 per CLAUDE.md).

---

## P3 — `project.ts` modularization (epic — slice by slice)

**Context:** `packages/formspec-studio-core/src/project.ts` is ~4,739 lines; **13** private methods are pure (no `this`) and safe to extract first. Preserve **`src/index.ts`** public API.

- [ ] **Extract pure helpers (batch 1 — sample / object):**  
  `_pruneObject`, `_sampleValues`, `_sampleValueForField`, `_filterByRelevance` → `lib/sample-data.ts`; `_editDistance`, `_resolvePath` → `lib/object-utils.ts`.
- [ ] **Extract pure helpers (batch 2 — FEL / tree):**  
  `_buildRepeatScopeRewriter`, `_checkVariableSelfReference` → `lib/fel-rewriter.ts`; `_nodeRefFor`, `_pageChildren`, `_findKeyInItems`, `_findComponentParentRef`, `_componentTargetRef` → `lib/tree-utils.ts` (coordinate with P2 tree-utils merge to avoid duplicate modules).
- [ ] **Split remaining `Project` responsibilities** into focused modules (names indicative): layout/page/region operations, theme/breakpoint/locale, screener/phases, mapping — re-export or compose from `project.ts` without breaking consumers.
- [ ] Add a **file size guardrail** (e.g. warn in CI or a script when a single source file exceeds ~1000 lines) scoped to studio packages if desired.

---

## P4 — Types, tests, and polish

- [ ] Extend **`ChatState`** (or equivalent) so `FormPreviewV2.tsx` does not need `(state as any).screener` (~173, 180, 184); align types with actual runtime state.
- [ ] Reduce **`any`** in hot UI files: prioritize `OutputBlueprint.tsx`, `FormPreviewV2.tsx`, `RuleCard.tsx`, `MultiSelectSummary.tsx`, `DefinitionProperties.tsx` (counts from audit: ~24 studio, ~14 studio-core).
- [ ] **`mapping-serialization.ts`:** Sanitize or validate **XML element names** derived from user-controlled keys (today `escapeXml` covers text, not tag names); document client-only risk if server exposure is out of scope.
- [ ] **`lib.ts` / `registerFormspecRender`:** Either add a real consumer + test, remove from public surface, or document as experimental embed API.
- [ ] Add **targeted tests** for largest untested UI modules (pick order): `FormPreviewV2.tsx`, `ItemRow.tsx`, `GroupNode.tsx`, `DisplayBlock.tsx`, `OptionsModal.tsx`.
- [ ] **chat-v2 a11y:** Add `aria-pressed` to mode toggles in `FormPreviewV2.tsx` (~119–130) to match `ChatShellV2.tsx` (~254–263); add `type="button"` and `aria-label` to header buttons in `ChatShellV2.tsx` (~227, 266, 273).
- [ ] Replace hardcoded **`VITE_GEMINI_DEV_KEY=mock-key-for-playwright`** in `playwright-chat.config.ts` (~24) with a dedicated mock server or Playwright network interception pattern.

### Explicit gaps (document, do not “fix” without product)

- [ ] Document **`Project.renameVariable()`** as `NOT_IMPLEMENTED`: add issue link in a code comment and a “Known limitations” bullet in the studio README.
- [ ] **Triage `packages/formspec-studio-core/tests/repro.test.ts`:** convert to a named regression test with a single assertion path, or delete.

### Optional performance (large forms / MCP-heavy use)

- [ ] If profiling shows pain: evaluate **structural sharing** (e.g. Immer) for ProposalManager / partial merge paths that clone full `ProjectState` multiple times per operation (`_partialMerge` etc.).

---

## Done (reference — do not reopen)

- [x] Confirm **dual chat architecture** intentional: `ChatPanel.tsx` (sidebar, `Project` + MCP + changesets) **and** `chat-v2` MPA at `/studio/chat.html` (`ChatSession`, `?h=` handoff) — different surfaces, not a migration.
- [x] Delete dead **`pre-populate-combined.ts`** and its test (only consumed by its own test).
- [x] Fix stale “stubbed” comment in **`proposal-manager.ts`** near wasm dependency grouping.
- [x] Decide **`packages/formspec-studio/research/`** → archive under `thoughts/archive/studio/` (adr, prototypes, markdown); follow-up tasks live in P2.
- [x] **Screener:** Treat as **shipped** (workspace, MCP, E2E, Rust evaluator) — not “pre-work.”
- [x] `useSyncExternalStore` snapshot identity in `packages/formspec-studio-core/src/useComponent.ts` (verified: invariant holds at Project/RawProject; regression test added in commit `137e9954`).

---

## Verification (run after each significant PR)

- [ ] `npm run build` (repo root)
- [ ] `npm run check:deps`
- [ ] `packages/formspec-studio` unit tests (include screener if touched)
- [ ] `packages/formspec-studio-core` unit tests
- [ ] Playwright: chat / changeset specs if chat or ProposalManager behavior changed
- [ ] Manual smoke: Screener workspace; ChatPanel open + changeset review; standalone `/studio/chat.html` if keys or chat code changed
- [ ] No broken imports / stale re-exports; README matches final decisions

---

## Quick reference (not tasks)

| Label | What it is |
|--------|----------------|
| `integrated-studio-ai` | `src/components/ChatPanel.tsx` — sidebar assistant on `Project` |
| `standalone-conversational-entry` | `src/chat-v2/` + `main-chat.html` route `/studio/chat.html` |

**Suggested PR labels:** `correctness-hazard` (restoreState, useSyncExternalStore), `needs-owner-decision` (BehaviorPreview), `archive-reference` (moved research), `delete-now` (orphan runtime — pre-populate already removed).
