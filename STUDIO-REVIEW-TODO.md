# Studio review — task list

**Scope:** `packages/formspec-studio/`, `packages/formspec-studio-core/`
**Goal:** Remove dead code, document real gaps, cut correctness and dependency risk, ship PRD-aligned features.
**Last validated:** 2026-04-28 (P7.1 D-3 partial — dual-toggle simplified; P5.2 test routing panel shipped; 1134/1134 Vitest green) (PRD `2026-04-28-prd-chatgpt-forms-ide.md` decomposed into ADRs 0082–0087 after 6-agent audit + 4-agent Sonnet review; three superseded `2026-03-05-*` Studio docs moved to `thoughts/archive/studio/`).

Use this file as a **backlog**: each `- [ ]` is one shippable task unless noted as a multi-step epic.

---

## Active work (open tasks, priority order)

---

### P3 — `project.ts` modularization (epic — completed)

**Context:** `packages/formspec-studio-core/src/project.ts` is ~1.1k lines; logic lives in `project-*.ts` modules. Preserve `studio-core` `src/index.ts` public API.

- [x] **Split remaining `Project` responsibilities** into focused modules: layout/page/region operations, theme/breakpoint/locale, screener/phases, mapping — re-export or compose from `project.ts` without breaking consumers.

---

### P4 — Types, tests, and polish

- [x] Extend **`ChatState`** (or equivalent) so `FormPreviewV2.tsx` does not need `(state as any).screener` — the screener section was dead code (`ChatState` never had a `screener` field; removed the entire block + `ItemPreview` component).
- [x] Reduce **`any`** in `FormPreviewV2.tsx` — replaced `ItemLike` with `FieldMockupItem` (typed `PresentationBlock`), fixed `findItem` to use `FormItem[]`, removed all `as any` casts (8 → 0). Remaining `any` reduction in other files deferred.
- [x] Reduce **`any`** in remaining hot UI files: `OutputBlueprint.tsx`, `RuleCard.tsx`, `MultiSelectSummary.tsx`, `DefinitionProperties.tsx`, `ItemRow.tsx`, and `project-layout.ts` (Done: purged ~40 residual `any` and loose `unknown` casts across studio and studio-core).
- [x] **chat-v2 a11y:** Added `aria-pressed` to mode toggles in `FormPreviewV2.tsx`; in `ChatShellV2.tsx`, `type="button"` + `aria-label` on header actions (back, issue badge, studio, export, settings, close sidebar) and on mobile Chat/Preview tab buttons.
- [x] **`mapping-serialization.ts`:** Sanitize or validate **XML element names** derived from user-controlled keys (today `escapeXml` covers text, not tag names); document client-only risk if server exposure is out of scope.
- [x] **`lib.ts` / `registerFormspecRender`:** Documented as `@experimental` embed API in `lib.ts` (dynamic import). Automated consumer test not added (optional stretch).
- [x] Add **targeted tests** for largest UI modules: `item-row.test.tsx`, `group-node.test.tsx`, `display-block.unit.test.tsx` (LayoutLeafBlock stub); extended `form-preview-v2.test.tsx` (aria-pressed, regenerate in-flight, diff highlight queries); extended `options-modal.test.tsx` (keywords → `onUpdateOptions`).
- [x] ~~Replace hardcoded `VITE_GEMINI_DEV_KEY` in standalone chat Playwright config~~ — **N/A:** standalone `chat.html` / `playwright-chat.config.ts` removed with chat v2; integrated chat E2E can be added later if needed.
- [ ] If profiling shows pain: evaluate **structural sharing** (e.g. Immer) for ProposalManager / partial merge paths that clone full `ProjectState` multiple times per operation (`_partialMerge` etc.).

---

### P5 — PRD-aligned next steps (from thoughts/studio/ synthesis)

Squashed from all markdown files in `thoughts/studio/` (oldest → newest), cross-referenced against the current implementation in `packages/formspec-studio/`. Ordered by impact.

#### 5.1 Visual Logic Builder (highest impact)

Shipped. The ConditionBuilder component provides guided/advanced FEL editing for all bind types. Integrated into `ItemRowCategoryPanel` (relevant/required/readonly/constraint) and `RouteCard` (screener route conditions). Core logic in `fel-condition-builder.ts`, UI in `ConditionBuilder.tsx` + `GuidedBindEditor.tsx`.

- [x] Build a reusable **ConditionBuilder** component (field / operator / value rows → FEL)
- [x] Apply to: `relevant`, `required`, `readonly`, `constraint` (`calculate` uses InlineExpression)
- [x] "Advanced" toggle to raw FEL for power users
- [x] Screener route conditions use the same ConditionBuilder (see 5.2)
- [x] 80 core tests + 15 UI tests (`fel-condition-builder.test.ts`, `condition-builder*.test.tsx`), all green

#### 5.2 Screener: condition builder + test routing

Screener CRUD works with raw FEL. Steps 3–5 of `thoughts/studio/2026-03-30-screener-authoring-design.md` remain.

- [x] **Condition builder** for route conditions (visual field/operator/value rows generating FEL)
- [x] **Test routing panel** — interactive verifier that evaluates routes against sample answers. Component: `ScreenerTestRouting.tsx`; evaluates via `wasmEvaluateScreenerDocument`; mounted at bottom of `ScreenerWorkspace` below phase list. 9 tests green.
- [x] **Blueprint summary** — already exists as `ScreenerSummary`; verify completeness

#### 5.3 Definition assembler FEL rewriting

Already implemented in Rust (`crates/formspec-core/src/assembler.rs` + `assembly_fel_rewrite.rs`). The assembler was migrated from TS to Rust/WASM after the TDD plan was written, and FEL rewriting was included in the migration. All bind types (relevant, required, readonly, calculate, constraint), default expressions, shapes, and variables are rewritten. WASM exposes `rewriteFelForAssembly` for standalone use.

- [x] Phase 1: `rewriteFEL(expression, keyMap)` core — implemented in Rust
- [x] Phase 2: Bind FEL integration (relevant, required, readonly, calculate, constraint) — `rewrite_bind()` at `assembler.rs:763`
- [x] Phase 3: Shape FEL integration (target paths, composition expressions) — `rewrite_shape()` at `assembler.rs:792`
- [x] Phase 4: Variable import (key remapping in expressions) — `import_variables()` at `assembler.rs:535`
- [x] Phase 5: Full integration smoke tests — `assembly_fel_rewrite.rs` (formspec-core) + WASM FEL tests (`formspec-wasm`)

#### 5.4 "Effective value" display in properties panel

Show which tier (Definition → Theme → Component) produced each presentation decision. Makes the 3-tier cascade comprehensible to non-technical users. The cascade resolver was extended from 3 theme levels to the full 5 spec levels (formPresentation → item.presentation → theme defaults → selectors → item overrides).

- [x] Extend `resolveThemeCascade` to 5-level cascade with definition-level inputs
- [x] Add `getPresentationCascade` convenience wrapper in studio-core
- [x] Compute and display **source layer** for each property in the inspector
- [x] Visual indicator (color-coded badges) showing "Form Default", "Definition", "Theme Default", "Selector", "Override"
- [x] `PresentationCascadeSection` in Editor properties panel
- [x] Tests: 11 cascade resolver + 6 wrapper + 7 UI = 24 tests, all green

#### 5.5 Widget constraints → semantic enforcement

Widget properties (min/max, step, date ranges) generate bind constraints at the definition level with two-way sync. Custom constraints are detected and preserved. Implemented as `widget-constraints.ts` (pure FEL conversion) + `Project.setWidgetConstraints`/`getWidgetConstraints` + `WidgetConstraintSection` UI.

- [x] When widget sets `min`/`max`/`step` → generate corresponding bind `constraint` expression
- [x] Guard optional values: `not(present($)) or <constraint>`
- [x] Two-way sync: editing the widget updates the constraint; custom FEL constraints are preserved (not overwritten)
- [x] UI: `WidgetConstraintSection` in properties panel for NumberInput/MoneyInput/Slider/DatePicker
- [x] Tests: 49 core + 10 UI = 59 tests, all green

#### 5.6 Document-first editing (longer term)

The PRD's most ambitious UX goal. Transform from "tree + inspector" to Notion-like document. Approach incrementally.

- [ ] Inline label editing on the form surface (click label → edit in place)
- [ ] Slash commands (`/`) for field insertion (Notion-style)
- [ ] Smart inline add — hover between nodes reveals `+` insertion line
- [ ] Logic badges on fields: required (dot), conditional (?), calculated (=), validated (!), readonly (lock)
- [ ] Full document model (the form IS the editor)

---

### P6 — DRY / KISS refactoring audit (2026-04-22)

Full file-by-file review of `packages/formspec-studio/src/` (~29k lines, 175+ files). Found 50 issues across 4 tiers: ~2,500 lines of duplicated code, 6 god components (3,800+ lines), 10+ `any`-typed boundaries, and a dual-chat architecture with zero shared code. Organized into 4 phases below.

Items already tracked in P4 are cross-referenced, not duplicated.

#### 6.1 Shared primitives (highest leverage — completed)

- [x] **`useEscapeKey(callback, active)`** — escape-key handler duplicated in 5 dialogs.
- [x] **`<InlineCreateForm>`** — inline add/create pattern duplicated in 10 files.
- [x] **`<ExpandableCard>`** — card-with-collapsible-header duplicated in 5 files.
- [x] **`<Pillar>`** — workspace section pillar triplicated.
- [x] **`<SectionFilterBar>`** — tab strip triplicated.
- [x] **Consolidate icons** — inline SVGs copy-pasted in 10+ files. Move all to `components/icons/index.tsx`.
- [x] **Consolidate `Section` arrows** — Replaced text `▶▼` with shared `IconChevronDown` in `Section.tsx`.
- [x] **Unify `CollapsibleSection`** — Consolidated `Section`, `CollapsibleSection`, and `AccordionSection` into a single pattern.
- [x] **`useControllableState`** — "controlled if prop provided, uncontrolled otherwise" pattern. Consolidated into `useControllableState.ts`.
- [x] **`exportProjectZip(project)`** — ZIP export logic. Move to `lib/`.
- [x] **`<RenderableBindCard>`** — `BindCard`+`GuidedBindEditor` wrapper copy-pasted 7 times in `ItemRowCategoryPanel.tsx`.
- [x] **FEL quoting utilities** — `quoteFELValue`/`unquoteFELValue` logic. Extract to shared utility.
- [x] **`<EmptyBlueprintState>`** — dashed-border empty state repeated in 6 blueprint files.
- [x] **`<EmptyWorkspaceState>`** — large dashed-border empty state extracted.
- [x] **`useProjectSlice(selector)`** — `useSyncExternalStore` subscription boilerplate.
- [x] **`useFieldOptions()`** — field-options construction. Consolidated into a shared hook.
- [x] **`<OverflowButton>`** — inline toolbar overflow button triplicated in `InlineToolbar.tsx`.
- [x] **Adopt `useDirtyGuard`** — Integrated into popovers.
- [x] **Replace `window.confirm()`** — used in 7 locations despite `<ConfirmDialog>` existing.
- [x] **`BindEntry` interface + `bindTypes`** — duplicated verbatim. Extract to shared types file.

#### 6.2 Decompose god components (epic — completed)

- [x] **`LayoutLeafBlock`** — Extracted from `FieldBlock.tsx` and `DisplayBlock.tsx`, eliminating ~400 lines of identical code.
- [x] **Decompose `Shell.tsx`** — Extracted `BlueprintSidebar`, `WorkspaceContent`, `ShellDialogs`, `useBlueprintSectionResolution`, and `ShellConstants`. ~479 lines post-extraction (further splits optional).
- [x] **Decompose `LayoutCanvas.tsx`** — Extracted `LayoutCanvasHeader`, `useLayoutPageMaterializer`, and `layout-tree-utils`. ~449 lines.
- [x] **Extract `useInlineIdentityEdit`** — identity editing state machine. Provided keyboard handlers and shared logic for `ItemRow`, `GroupNode`, and `ItemRowContent`.
- [x] **Decompose `FELEditor.tsx`** — Extracted `useFELAutocomplete`, `FELHighlightOverlay`, and `FELAutocompleteMenu`. ~274 lines.
- [x] **Decompose `render-tree.tsx`** (`workspaces/layout/render-tree.tsx`) — Extracted helpers and cleaned up the main recursive loop (~429 lines).
- [x] **Decompose `ItemListEditor.tsx`** — Extracted `WrapInGroupDialog` (~553 lines; still largest editor surface).

#### 6.3 Bugs and correctness (completed)

- [x] **`useOptionalDefinition()` reads stale data** — Fixed via `useSyncExternalStore`.
- [x] **`manageCount` non-reactive** — Fixed via `useProjectState`.
- [x] **`ActiveGroupProvider` context not memoized** — Fixed.
- [x] **`useMappingIds` new array every render** — Fixed.
- [x] **`ConditionBuilder` stale on prop change** — Fixed.
- [x] **`FELEditor` blur-to-save race** — Fixed.
- [x] **`ShapesSection.handleAdd` discards user ID** — Fixed.
- [x] **`MappingConfig.tsx` Enter double-fires setter** — Fixed.
- [x] **DnD context re-renders on every pointer move** — Fixed.
- [x] **`RuleCard.tsx` `any` typing** — Fixed.
- [x] **`SettingsDialog.tsx` duplicate functions** — Fixed.
- [x] **Remove dead `collisionPriority` prop** — Removed.
- [x] **Dead code cleanup** — Verified and removed identical branches and stale ternaries.

#### 6.4 Architecture and DX

- [ ] **Dual chat: shared abstractions** — (SKIPPED per user request)
- [ ] **Provider config UI 3-way duplication** — (SKIPPED per user request)
- [x] **Dual CSS systems** — resolved by removing chat v2 (`chat-v2.css`); studio remains Tailwind + semantic tokens.
- [x] **5-level relative imports** — Fixed by re-exporting from `studio-core`.
- [x] **Cross-workspace dependency** — Moved `DataSources` and `OptionSets` to `workspaces/shared/`.
- [x] **DnD file naming inconsistency** — Consolidated all layout DnD files into `workspaces/layout/dnd/` with unified naming (Pdnd).
- [x] **`layout-node-styles.ts` + `layout-canvas-drag-chrome.ts` overlap** — Merged into `layout-dnd-styles.ts`.
- [x] **Delete dead code** — `ComponentRenderer.tsx`, `LayoutPreviewPanel.tsx`, `LayoutWorkspace.tsx`.
- [x] **Add `ThemeTab.tsx`** — Introduced top-level Theme workspace and tab orchestrator.
- [ ] **`handleResend`/`handleEdit` near-duplicate** — (SKIPPED per user request)
- [x] **`useWorkspaceRouter` unsafe casts** — Fixed via validation.
- [x] **`<span onClick>` a11y** — Replaced with `<button>`.

---

### P7 — Studio surface unification (ADRs 0082–0087)

**Context:** PRD `thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md` decomposed into six sequential ADRs after multi-agent audit. The PRD is now archived in spirit (not yet on disk) — ADRs are the canonical direction. Each ADR is independently shippable; 7.1 is the architectural foundation everything else composes on. Cuts deliberately omitted from the ADR set: `MiniFormPreview`, three-mode toggle (`Chat | Edit | Preview`), floating composer pill, `switchWorkspaceTab` MCP tool, "ChatGPT for Forms" framing.

#### 7.1 ADR 0082 — Lift `ChatSession` above `StudioApp`

[`thoughts/studio/adr/0082-lift-chat-session-above-studio.md`](thoughts/studio/adr/0082-lift-chat-session-above-studio.md). Foundation — every other 7.x ADR depends on this.

- [x] Extract **`useChatSessionController({ project, repos })`** hook from `packages/formspec-studio/src/components/ChatPanel.tsx` — hook landed at `src/hooks/useChatSessionController.ts`. ChatPanel wiring deferred to avoid reactive contamination (ADR kill criterion). (currently 1,478 lines). Hook owns `ChatSession` instantiation (today `ChatPanel.tsx:316–325`), `ToolContext` + `ProjectRegistry` + `createToolDispatch` triple (lines 297–314), thread-list state, `activeSessionId`, `compareBaseId/TargetId`, adapter selection, persist/restore lifecycle (lines 347–398). Repositories injected, not constructed inside.
- [x] Mount controller provider above the `studioView` branch in `StudioApp.tsx:155`. `ChatSessionControllerProvider` wraps the `{studioView === 'assistant' ? ... : ...}` branch; both `AssistantWorkspace` and `Shell` are children. Neither consumes the context yet — `useChatSessionControllerContext()` is defined but unwired. ChatPanel still constructs its own session internally.
- [ ] **Delete dual-toggle stack (partial):** Deleted `StudioWorkspaceViewContext` + React context provider; `useShellPanels.{showChatPanel, primaryAssistantOpen, chatPrompt}` replaced with single `assistantOpen` boolean; `formspec:ai-action` listener removed; `AssistantEntryMenu` simplified to open/close toggle (no overlay mode, no "open full workspace"); `AppSettingsDialog` dispatches `formspec:open-assistant-workspace` directly. **Remaining:** `studioView` enum retained (onboarding flow depends on it — new users see `AssistantWorkspace`, existing users see `Shell`); ChatPanel still constructs its own session internally (ADR kill criterion — reactive contamination risk in `initNotice`/`readyToScaffold`/`initializingRef`). Session persists across `studioView` switches because `ChatSessionControllerProvider` is above the branch.
- [x] Construct `ChatThreadRepository` + `VersionRepository` once at provider; converges `Shell.tsx:51–52` and `AssistantWorkspace.tsx:187–188` per-mount duplicates. `ChatPanel.tsx` fallbacks retained as safety net for test callers.
- **Kill criterion:** if hook extraction fails to compile green Vitest+Playwright after one complete attempt, audit `ChatPanel` UI state for reactive contamination (the ADR 0036 §15–28 pattern) before re-attempting. Likely cause: `initNotice` / `readyToScaffold` / scaffold `initializingRef` entanglement with session lifecycle.

#### 7.2 ADR 0083 — Right-panel live preview companion

[`thoughts/studio/adr/0083-right-panel-live-preview-companion.md`](thoughts/studio/adr/0083-right-panel-live-preview-companion.md). Replaces the PRD's three-mode toggle with a layout knob.

- [ ] Mount `FormspecPreviewHost` once inside `Shell` and once inside `AssistantWorkspace` as a collapsible right-panel companion. Single instance per shell; persists across composer/sidebar shifts. Visibility = `showPreview` boolean persisted per user via `useShellPanels`.
- [ ] Reuse the existing right-rail container shape at `Shell.tsx:373–414` (today wraps in `LayoutLivePreviewSection`).
- [ ] **`ChangesetReviewSection` width-aware compact mode:** at narrow widths (e.g., 360px rail) collapses to `Accept · Reject · View →` affordance opening a drawer with the full review. CSS container query + Vitest snapshot.
- [ ] **Bidirectional selection bridge:** delegated click handler on host's `data-name` attribute → `useSelection.select()`. New wiring: `<formspec-render>` does not emit field-selected events into React today (only `ThemeAuthoringOverlay` wrapper does).
- [ ] **Mock-data strategy** for empty / conditionally-hidden elements: source `example` value if present, else type-derived placeholder. Conditionally-hidden elements render dimmed in a "would appear when …" state.
- **Kill criterion:** if `studio_preview_toggled` collapses >50% in first session → companion-preview thesis dead; reopen whether preview belongs in shell at all or behind a `Test →` action.

#### 7.3 ADR 0084 — Studio chrome rename, not hide

[`thoughts/studio/adr/0084-studio-chrome-rename-not-hide.md`](thoughts/studio/adr/0084-studio-chrome-rename-not-hide.md). Pure UX/labels work — no architectural prerequisites.

- [x] **Rename sidebar section labels** in `BlueprintSidebar` (internal keys at `ShellConstants.tsx:37–40` + `BLUEPRINT_SECTIONS_BY_TAB:62–67` unchanged):
    - `Variables` → "Calculations"
    - `Data Sources` → "External data"
    - `Mappings` → "Field mappings"
    - `Option Sets` → "Reusable choices"
  Each section always visible. Zero-count → empty-state line ("No calculations yet"), collapsible. Non-zero → count badge inline (`Calculations ●3`).
- [x] **Status bar default chips:** `Draft · N fields · Healthy · Ask AI`. Move metric details (renamed) behind `⋯` menu next to health chip. Internal symbol names at `StatusBar.tsx:24,25,28,30,93,97,103,107,115` unchanged.
- [x] Renamed metric labels behind `⋯`: `bind` count → "Data connections", `shape` count → "Cross-field rules", `Evidence` → "Documents attached", `Provenance` → "AI changes", `Layout drift` → "Layout warnings". Drop `Wizard` from default chip set (becomes Appearance setting).
- [x] **`Healthy` chip:** computes from union of validation errors, layout drift, open patches, evidence gaps. Display: `Healthy` / `2 warnings` / `1 error`. Click opens issue panel using renamed labels.
- [x] **`advanced` boolean** (persisted per user) controls *depth* (raw JSON, FEL expressions, internal symbol names alongside renamed labels) — MUST NOT control artifact-section visibility.
- **Kill criterion:** if `studio_advanced_toggled_within_first_session` >40% of new users → rename strategy alone hasn't fixed defaults; content-design problem, do not revert to hiding.

#### 7.4 ADR 0085 — `ToolContext` workspace selection

[`thoughts/studio/adr/0085-toolcontext-workspace-selection.md`](thoughts/studio/adr/0085-toolcontext-workspace-selection.md). L5 interface change with L6 implementation.

- [x] Extend `ToolContext` (`packages/formspec-chat/src/types.ts:107`) with optional `getWorkspaceContext?()`: { selection: { path, sourceTab }|null; viewport: 'desktop'|'tablet'|'mobile'|null }`. Match `getProjectSnapshot?` precedent at line 111. Synchronous (in-memory).
- [x] Implement at the controller from 7.1, reading from `useSelection`. `sourceTab` mirrors per-tab keying at `useSelection.tsx:38`.
- [x] **Synchronous selection clear on path-removal:** subscribe `useSelection` to definition changes; clear active `TabSelection` (`useSelection.tsx:13`) when its `primaryKey` no longer resolves. AI never sees a dangling path.
- [ ] Only `useSelection.select()` (line 82) propagates — scroll, hover, structure-tree keyboard arrow-nav do NOT. (Blocked until ChatPanel fully consumes controller.)
- **Kill criterion:** if AI prompts degrade meaningfully without selection (adapters need a non-optional shape), gate a required form behind a feature flag — do not break the optional contract for adapters that ignore it.

#### 7.5 ADR 0086 — Studio-local UI tool injection

[`thoughts/studio/adr/0086-studio-local-ui-tool-injection.md`](thoughts/studio/adr/0086-studio-local-ui-tool-injection.md). Keeps `formspec-mcp` (L4) UI-blind.

- [x] New module `packages/formspec-studio/src/chat/studio-ui-tools.ts` exporting `{ declarations, handlers }`. **Closed taxonomy** of two tools:
    - **`revealField({ path: string })`** — scrolls structure tree, expands collapsed parents. Does NOT change selection. Declaration MUST cross-reference selection per ADR 0040 disambiguation convention.
    - **`setRightPanelOpen({ open: boolean })`** — toggles preview companion (7.2) via `showPreview` signal in `useShellPanels`.
  New tools require a new ADR slot.
- [x] Add **`reveal(path)`** method to `packages/formspec-studio/src/state/useSelection.tsx` — emits scroll-and-expand intent without touching `select`/`deselect` state. Structure tree subscribes and scrolls into view.
- [ ] At `ChatPanel.tsx:303`, compose `[...mcpDispatch.declarations, ...studioUITools.declarations]` — blocked until ChatPanel consumes controller.; merge `callTool` to try studio handlers first, fall through to MCP. Studio UI tools never enter `formspec-mcp`.
- [x] **Reject** `switchWorkspaceTab` (documented in ADR 0086; no implementation needed). (no tab abstraction post-7.2; `LayoutDocument` (M3 of `2026-04-26-studio-unified-feature-matrix.md`) is the explicit *reopening trigger*, not a deferred slot). Collapse `openPreview` from PRD §7.4 into `setRightPanelOpen({ open: true })`.
- [x] Handlers: structured-response recovery, never silent no-op (implemented in `studio-ui-tools.ts`). `revealField` with collapsed sidebar → expand sidebar first, return `{ ok: true, recovered: "sidebar collapsed; expanded it before revealing" }`. Stale path → `{ ok: false, reason: "path not found" }`.
- **Kill criterion:** if >5 UI tools accumulate without ADRs, taxonomy is open — either ADR-gate retroactively or move to registry-with-policy.

#### 7.6 ADR 0087 — AI mutation provenance surface

[`thoughts/studio/adr/0087-ai-mutation-provenance-surface.md`](thoughts/studio/adr/0087-ai-mutation-provenance-surface.md). Closes the trust gap every audit agent flagged. Builds on M2 `FieldProvenance` (already landed at `packages/formspec-studio-core/src/studio-intelligence.ts:10`).

- [x] In `packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx:21`: render a sibling **"What changes behind the scenes"** panel adjacent to the inline preview when a proposed changeset includes any of the closed mutation-class list:
    - `bind` (`required`, `constraint`, `readonly`, `calculate`)
    - `shape` (cross-field validation rules)
    - `Variable` (add/edit/remove — top-level computed value, distinct from `bind.calculate`)
    - `Mapping` (add/edit/remove)
    - `OptionSet` (content change, not reference swap)
- [x] Per affected entry, sourced from the corresponding `FieldProvenance` record: field path, mutation class, before/after summary, one-line AI-authored rationale. Panel rendered by `MutationProvenancePanel.tsx`.
- [ ] **Accept-gate:** `Accept this proposal` does NOT commit until the provenance panel has scrolled into view at least once OR has been explicitly dismissed. (Deferred — needs telemetry infra + scroll tracking.)
- [ ] **Telemetry pair:** `studio_provenance_panel_viewed` and `studio_provenance_panel_dismissed_unread`. (Deferred — needs telemetry infra.)
- **Kill criterion:** if `studio_provenance_panel_dismissed_unread` >60% of accepts in production, panel is theatre — redesign the affordance, do not remove. If panel is ever made auto-dismissible in service of feel-good UX metrics, the ADR is dead — re-open before shipping that change.

---

## Completed (reference only — do not reopen)

<details>
<summary><strong>P0 — Correctness and fences</strong> (all done)</summary>
...
</details>

---

## Reference (not tasks)

...
