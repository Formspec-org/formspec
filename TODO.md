# Formspec — Consolidated TODO

**Validated 2026-04-10** against the current codebase by formspec-scout.

Sources: editor/layout split review, chaos-test phase 1 findings + phase 4 follow-ups, layout DnD review, studio plans.

## Open

*No open items.*

## Track / Monitor

### 14. `materializePagedLayout` — by design
- **Source**: editor/layout split review
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:361-380`
- **Status**: Guarded by `useRef<boolean>` flag — no-op after first call. Negligible overhead.

### 19. Component tree reconciles on every dispatch
- **Source**: editor/layout split review
- **File**: `packages/formspec-core/src/raw-project.ts:350-373`
- **Action**: Monitor. Resolution path documented: add dirty flag. Not yet implemented.

### ~~21. `as any` casts in `project.ts`~~ — resolved
- All 33 casts eliminated. `CommandResult` typed with `nodeRef`/`nodeNotFound`, `Diagnostic` with `line`/`column`, `CompNode` structured type replaces `Record<string, unknown>`.

### LayoutContainer dual-droppable
- **Source**: layout DnD review (2026-04-07)
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx:194-209`
- **Status**: `useSortable` + `useDroppable(container-drop)` on same element. No code change until a mis-hit is reproduced.

## Resolved

<details>
<summary>Resolved items from editor/layout split review (click to expand)</summary>

### Studio-core extraction review (batch)
- ~~Non-spec dataTypes in TYPE_MAP~~ — replaced with spec-normative types
- ~~`(project as any).core.dispatch()` x3~~ — added typed methods to Project
- ~~Missing `text` (Long Text) entry in FIELD_TYPE_CATALOG~~ — added
- ~~`item.choices` non-spec fallback~~ — removed, uses `options` only
- ~~Cross-package `default-theme.json` import~~ — added sub-path export
- ~~Unnecessary `@formspec-org/layout` dependency~~ — imports from `@formspec-org/types`
- ~~Incomplete re-export wrapper (`field-helpers.ts`)~~ — added missing exports
- ~~14 direct imports into `formspec-studio-core/src/`~~ — redirected
- ~~Duplicate test files~~ — deleted, canonical copies in studio-core

### Individual items
- **1.** ~~Screener `required` literal-only~~ — evaluates FEL via `evalFEL`
- **2.** ~~PascalCase widgetHints~~ — corrected to camelCase
- **3.** ~~JSON adapter `pretty` default~~ — changed to spec default `false`
- **4.** ~~Screener route heuristic fallback~~ — heuristic documented with trade-off comment
- **5.** ~~`lib/` re-export wrappers~~ — eliminated
- **6.** ~~`src/chat/` v1 dead code~~ — deleted
- **7.** ~~`PropertiesPanel.tsx` dead prototype~~ — deleted
- **8.** ~~`Spacer` invalid widgetHint~~ — moved to layout
- **9.** ~~ITEM_TYPE_WIDGETS missing `Tabs`~~ — added
- **10.** ~~Row summaries secondary bind properties~~ — `nonRelevantBehavior` pill added (keep/empty)
- **11.** ~~Missing CSV `encoding` option~~ — added
- **12.** ~~`isStudioGeneratedComponentDoc` comment~~ — JSDoc added
- **13.** ~~Story fixtures PascalCase~~ — corrected
- **15.** ~~`@faker-js/faker` prod dep~~ — removed
- **16.** ~~`COMPONENT_TO_HINT` Collapsible→accordion~~ — removed
- **17.** ~~Test file naming ambiguity~~ — renamed
- **18.** ~~Orphaned E2E spec~~ — moved
- **20.** ~~`SubmitButton` spec prose~~ — S5.19 added

</details>

<details>
<summary>Resolved items from chaos-test + DnD review + studio plans (click to expand)</summary>

- ~~ARCH-3: `analyze_fel_with_field_types` end-to-end~~ — full chain wired: WASM → bridge → API → parseFEL with `FEL_TYPE_MISMATCH`
- ~~Sigil hint ($name vs @name)~~ — `expression-index.ts:129` emits `FEL_SIGIL_HINT`
- ~~BUG-5: Shape per-row evaluation~~ — `shapes.rs:117-227` evaluates per-instance correctly
- ~~UX-5: Theme token validation/listing~~ — `theme.ts:64` validates, `:73` lists
- ~~CONF-3: Variables in bind expressions~~ — `parseFEL` includes variables in known refs
- ~~addPage standalone-only refactor~~ — code matches plan; `standalone` option and `groupKey` removed
- ~~BUG-1: `parentPath` doubles path~~ — fixed in `_resolvePath`
- ~~BUG-2: Date comparison with `today()`~~ — `json_to_runtime_fel_typed` coerces dates
- ~~BUG-4: Conditional required on calculated fields~~ — `refresh_required_state()` re-evaluates after calculate
- ~~BUG-6: Required fires on repeat template at 0 instances~~ — `repeat_expand.rs` clears children
- ~~BUG-7: `remove_rule` ambiguous~~ — `removeValidation` normalizes target
- ~~BUG-8: `sample_data` ignores scenario~~ — `generateSampleData(overrides?)` added
- ~~BUG-9: Cross-document audit leaf key~~ — broken check removed
- ~~BUG-10: Content items not findable by `placeOnPage`~~ — `_nodeRefForItem()` added
- ~~BUG-12: Save omits `status`~~ — `createDefaultDefinition` includes `status: 'draft'`
- ~~BUG-13: Unknown `Checkbox` component~~ — mapped to `Toggle`
- ~~BUG-14: Unevaluated `widgetHint` on component nodes~~ — allowlist export strips it
- ~~BUG-16: Repeat component unevaluated props~~ — allowlist export strips them
- ~~UX-1: No shape listing~~ — `formspec_describe(mode: 'shapes')` added
- ~~UX-2: `choices` silently ignored~~ — `.strict()` on Zod schemas
- ~~UX-3: Sample data dates~~ — dynamic today() dates, nested repeat arrays
- ~~UX-4: `formspec_create` skips bootstrap~~ — guide shows both paths
- ~~UX-6: `humanize` FEL limitation~~ — MCP surfaces `note` explaining supported patterns
- ~~UX-7: Flat sample data for repeat groups~~ — nested arrays with 2 sample instances
- ~~UX-8: Content appended at end~~ — `insertIndex` added to content schema
- ~~UX-9: `describe` vs `place` identifier mismatch~~ — `id` → `page_id`
- ~~UX-10: No unsaved indicator~~ — `isDirty` / `markClean()` on Project, surfaced in MCP statistics
- ~~CONF-1: Three parent-context mechanisms~~ — precedence notes in tool descriptions
- ~~CONF-2: Money diagnostic gap~~ — evaluator.rs now suggests `moneyAmount()` for money/number and money/money ordering
- ~~BUG-3: Money comparison diagnostic~~ — evaluator.rs suggests `moneyAmount()` in all money comparison failures
- ~~FIX 8: FEL rewrite for repeat wildcard shapes~~ — `addValidation` rewrites FEL at write time via `rewriteFELReferences`/`rewriteMessageTemplate`
- ~~Sortable-only E2E test gap~~ — skip reasons documented (dnd-kit simulation limitation)
- ~~Layout DnD Finding 1: Sibling fallback~~ — `siblingIndicesForTreeReorder` derives from tree
- ~~Layout DnD Finding 3: Stale `isDragging` comment~~ — fixed
- ~~Layout DnD Finding 5: `bind:` prefix encoding~~ — JSDoc added

</details>
