# Studio review — task list

**Scope:** `packages/formspec-studio/`, `packages/formspec-studio-core/`
**Last validated:** 2026-04-29 (139/139 Vitest green, 1191/1191 tests, TypeScript clean. ADRs 0082–0087 implemented. Assistant↔Workspace full toggle shipped. Code review findings F1–F6 addressed.)

Use this file as a **backlog**: each `- [ ]` is one shippable task unless noted as a multi-step epic.

---

## Open items

### Blocked on external dependencies

- [ ] **0083 D-5** — Mock-data strategy for empty/conditionally-hidden preview elements. Source `example` value if present, else type-derived placeholder. Conditionally-hidden elements render dimmed with "would appear when …" state. **Blocked:** needs product ADR for `example` field semantics.
- [ ] **0087 D-3** — Accept-gate: `Accept this proposal` does not commit until provenance panel has scrolled into view at least once or been explicitly dismissed. **Blocked:** needs telemetry infra + scroll tracking.
- [ ] **0087 D-4** — Telemetry pair: `studio_provenance_panel_viewed` and `studio_provenance_panel_dismissed_unread`. **Blocked:** needs telemetry infra.

### P5.6 — Document-first editing (long-term)

The PRD's most ambitious UX goal. Transform from "tree + inspector" to Notion-like document. Approach incrementally.

- [ ] Inline label editing on the form surface (click label → edit in place)
- [ ] Slash commands (`/`) for field insertion (Notion-style)
- [ ] Smart inline add — hover between nodes reveals `+` insertion line
- [ ] Logic badges on fields: required (dot), conditional (?), calculated (=), validated (!), readonly (lock)
- [ ] Full document model (the form IS the editor)

---

## ADR kill criteria (live reference)

| ADR | Criterion | Status |
|---|---|---|
| 0082 | Hook extraction fails green Vitest+Playwright after one attempt | Survived — green |
| 0083 | `studio_preview_toggled` collapses >50% in first session | Unmeasured (no telemetry) |
| 0084 | `studio_advanced_toggled_within_first_session` >40% of new users | Unmeasured |
| 0085 | AI prompts degrade meaningfully without selection | No reports |
| 0086 | >5 UI tools accumulate without ADRs | 2 tools, taxonomy closed |
| 0087 | `studio_provenance_panel_dismissed_unread` >60% of accepts | Unmeasured (no telemetry) |
| 0087 | Panel ever made auto-dismissible for UX metrics | Not applicable |

---

## Completed (reference only — do not reopen)

<details>
<summary><strong>P3 — project.ts modularization</strong></summary>

`packages/formspec-studio-core/src/project.ts` split into focused modules (layout/page/region, theme/breakpoint/locale, screener/phases, mapping). Public API preserved.

</details>

<details>
<summary><strong>P4 — Types, tests, and polish</strong></summary>

- Dead `screener` block removed from `FormPreviewV2.tsx`; `ItemLike` → `FieldMockupItem`; all `as any` casts purged.
- ~40 residual `any`/`unknown` casts removed across studio + studio-core.
- Chat-v2 a11y: `aria-pressed` on mode toggles, `type="button"` + `aria-label` on header actions.
- XML element name sanitization documented in `mapping-serialization.ts`.
- `registerFormspecRender` documented as `@experimental`.
- Targeted tests: `item-row`, `group-node`, `display-block`, extended `form-preview-v2`, `options-modal`.
- Structural sharing: closed (audited, no measured pain; sub-ms clone at ~26KB).
- Four type shadows replaced with canonical `formspec-types` exports (`FormVariable`, `FormShape`, `FormOption`/`OptionSet`, `FormInstance`).
- URL minting: editable in SettingsDialog, auto-mints from name on first commit. `slugifyForUrl`/`mintUrlFromName` exported.

</details>

<details>
<summary><strong>P5.1–5.5 — PRD-aligned features (all shipped)</strong></summary>

- **5.1 Visual Logic Builder:** `ConditionBuilder` + `GuidedBindEditor` for all bind types + screener routes. 80 core + 15 UI tests.
- **5.2 Screener:** condition builder + test routing (`ScreenerTestRouting.tsx`).
- **5.3 FEL rewriting:** migrated to Rust/WASM (`assembler.rs` + `assembly_fel_rewrite.rs`).
- **5.4 Effective value display:** 5-level cascade resolver (`resolveThemeCascade` → `getPresentationCascade`), `PresentationCascadeSection` UI. 24 tests.
- **5.5 Widget constraints:** `widget-constraints.ts` + `Project.setWidgetConstraints`/`getWidgetConstraints` + `WidgetConstraintSection`. 59 tests.

</details>

<details>
<summary><strong>P6 — DRY/KISS refactoring audit (all completed)</strong></summary>

**6.1 Shared primitives:** `useEscapeKey`, `InlineCreateForm`, `ExpandableCard`, `Pillar`, `SectionFilterBar`, icons consolidation, `CollapsibleSection` unification, `useControllableState`, `exportProjectZip`, `RenderableBindCard`, FEL quoting utilities, `EmptyBlueprintState`, `EmptyWorkspaceState`, `useProjectSlice`, `useFieldOptions`, `OverflowButton`, `useDirtyGuard`, `window.confirm` → `ConfirmDialog`, `BindEntry`/`bindTypes` extraction.

**6.2 God components decomposed:** `LayoutLeafBlock` extracted (−400 lines), `Shell.tsx` → `BlueprintSidebar` + `WorkspaceContent` + `ShellDialogs` + `useBlueprintSectionResolution` + `ShellConstants`, `LayoutCanvas.tsx` → `LayoutCanvasHeader` + `useLayoutPageMaterializer` + `layout-tree-utils`, `useInlineIdentityEdit` extracted, `FELEditor.tsx` → `useFELAutocomplete` + `FELHighlightOverlay` + `FELAutocompleteMenu`, `render-tree.tsx` cleaned, `ItemListEditor.tsx` → `WrapInGroupDialog`.

**6.3 Bugs:** `useOptionalDefinition` stale data, `manageCount` non-reactive, `ActiveGroupProvider` memo, `useMappingIds` identity, `ConditionBuilder` stale props, `FELEditor` blur-save race, `ShapesSection.handleAdd` ID discard, `MappingConfig` Enter double-fire, DnD pointer-move re-renders, `RuleCard` typing, `SettingsDialog` duplicates, dead `collisionPriority`, dead code cleanup.

**6.4 Architecture:** dual chat/CSS resolved (chat v2 removed), 5-level imports fixed, `DataSources`/`OptionSets` → `workspaces/shared/`, DnD naming consolidated, `layout-node-styles`/`layout-canvas-drag-chrome` merged, dead code deleted (`ComponentRenderer`, `LayoutPreviewPanel`, `LayoutWorkspace`), `ThemeTab` added, `useWorkspaceRouter` validation, `<span onClick>` → `<button>`.

</details>

<details>
<summary><strong>P7 — ADRs 0082–0087 (all implemented)</strong></summary>

- **0082** — `useChatSessionController` hook extracted; `ChatSessionControllerProvider` mounted above `studioView` branch; dual-toggle stack deleted; repo prop threading removed; ChatPanel reads controller from context with standalone fallback.
- **0083** — `PreviewCompanionPanel` mounted in Shell + AssistantWorkspace; `showPreview` persisted via `useShellPanels`; bidirectional selection bridge (`onFieldClick` + `highlightFieldPath`); `ChangesetReviewSection` compact mode with drawer; assistant↔workspace full toggle (`onSwitchToAssistant` prop chain).
- **0084** — Sidebar renames (Calculations, External data, Field mappings, Reusable choices); status bar chips redesigned; metric labels renamed; health chip; `advanced` depth control.
- **0085** — `ToolContext.getWorkspaceContext()` wired from `useSelection` (exposes `activeTab`); synchronous selection clear on path removal.
- **0086** — `studio-ui-tools.ts` (closed taxonomy: `revealField` + `setRightPanelOpen`); `reveal(path)` signal in `useSelection`; `StructureTree` subscribes to `revealedPath`; studio handlers composed before MCP fallback; structured-response recovery.
- **0087** — `MutationProvenancePanel` rendered in `ChangesetReviewSection` (full + drawer); 5 mutation classes (bind, shape, Variable, Mapping, OptionSet); provenance sourced from `FieldProvenance` records. Accept-gate and telemetry deferred (blocked).

</details>
