# Editor/Layout Split — Post-Review TODO

Issues identified by Formspec Scout and Spec Expert reviews of the 12 commits on `feat/editor-layout-split`.

## Resolved (studio-core extraction review)

The following issues were found and fixed during the studio-core greenfield review:

- ~~Non-spec dataTypes in TYPE_MAP (`binary`, `select1`, `select`, `barcode`, `geopoint`)~~ — replaced with spec-normative types
- ~~`(project as any).core.dispatch()` x3 in layout-context-operations~~ — added `wrapComponentNode`, `reorderComponentNode`, `deleteComponentNode` to Project
- ~~Missing `text` (Long Text) entry in FIELD_TYPE_CATALOG~~ — added
- ~~`item.choices` non-spec fallback in editor-tree-helpers~~ — removed, uses `options` only
- ~~Cross-package `default-theme.json` import~~ — added sub-path export `@formspec-org/webcomponent/default-theme`
- ~~Unnecessary `@formspec-org/layout` dependency~~ — imports from `@formspec-org/types` instead
- ~~Incomplete re-export wrapper (`field-helpers.ts`)~~ — added missing `normalizeBindEntries`, `normalizeBindsView`, `getFieldTypeCatalog`
- ~~14 direct imports into `formspec-studio-core/src/`~~ — all redirected through wrappers or `@formspec-org/studio-core`
- ~~Duplicate test files (keyboard, fel-editor-utils, layout-context-menu)~~ — deleted from studio, canonical copies in studio-core

## Medium Priority

### 1. Screener `required` bind only handles literal `"true"`
- **File**: `packages/formspec-react/src/screener/use-screener.ts:31`
- **Problem**: `isItemRequired` checks `b.required === 'true' || b.required === true`. Per CoreSpec S4.3.1, `required` is a FEL expression string. Dynamic expressions like `"$awardType = 'grant'"` are silently ignored.
- **Fix**: Evaluate `required` through the FEL pipeline (`engine.evaluateExpression()`) or document as a known screener limitation.

### ~~2. FIELD_TYPE_CATALOG widgetHint values use PascalCase instead of spec lowercase~~
- **Fixed**: `'Heading'` → `'heading'`, `'Divider'` → `'divider'` (CoreSpec §4.2.5.1). Spacer moved from `itemType:'display'` with fake widgetHint to `itemType:'layout'` with `component:'Spacer'` (Component Spec §5.5).

### ~~3. JSON adapter `pretty` defaults to `true`; spec default is `false`~~
- **Fixed**: Changed `options.pretty !== false ? 2 : undefined` to `options.pretty ? 2 : undefined` (Mapping Spec §6.2 default=false). Studio passes `pretty: true` explicitly when it wants pretty output.

### 4. Screener route type inference is heuristic-based
- **File**: `packages/formspec-react/src/screener/use-screener.ts:127-143`
- **Problem**: Infers internal vs. external routing by comparing target URLs to the definition URL. If a definition URL changes post-authoring, the route type could silently flip.
- **Fix**: Add explicit `routeType: 'internal' | 'external'` to the screener route schema. Keep the heuristic as a backwards-compatible fallback.

### 5. Eliminate `lib/` re-export wrappers — use `@formspec-org/studio-core` directly
- **Files**: `packages/formspec-studio/src/lib/field-helpers.ts`, `src/lib/fel-editor-utils.ts`, `src/lib/keyboard.ts`, `src/workspaces/layout/layout-context-operations.ts`, `src/workspaces/preview/preview-documents.ts`
- **Problem**: These files are thin re-export wrappers that still import from relative `../../../formspec-studio-core/src/` paths, bypassing the published package boundary. The resolved item above redirected 14 direct imports *through* these wrappers rather than to `@formspec-org/studio-core` directly — the wrappers are an intermediate state. As studio-core reorganizes its internal file layout, these relative src/ paths will silently break. Several workspace components also bypass the wrappers and import studio-core src/ paths directly: `MappingPreview.tsx`, `UnassignedTray.tsx`, `LogicTab.tsx`, `DataSources.tsx`, `OptionSets.tsx`, `CommandPalette.tsx`, `AddItemPalette.tsx`, `StatusBar.tsx`, `DefinitionTreeEditor.tsx`.
- **Fix**: Update all consumers to import from `@formspec-org/studio-core`. Delete the now-redundant wrapper files.

### ~~6. `src/chat/` (v1) and `tests/chat/` are dead code — false test coverage~~
- **Fixed**: Deleted `src/chat/` (8 source files) and `tests/chat/` (8 test files). Verified `main-chat.tsx` and `Shell.tsx` import only from `chat-v2/`. The integrated `components/ChatPanel.tsx` (which imports from `@formspec-org/chat`) is unaffected.

### ~~7. `PropertiesPanel.tsx` is a dead prototype scaffold~~
- **Fixed**: Deleted `PropertiesPanel.tsx` and its test. Zero production imports confirmed.

## Low Priority

### ~~8. `Spacer` is not a valid display widgetHint~~
- **Fixed**: Resolved as part of item 2. Spacer moved from `itemType:'display'` with fake widgetHint to `itemType:'layout'` with `component:'Spacer'` (Component Spec §5.5).

### ~~9. ITEM_TYPE_WIDGETS group list missing `Tabs`~~
- **Fixed**: Added `'Tabs'` to `ITEM_TYPE_WIDGETS.group`. CoreSpec §4.2.5.1 `tab` group hint → Tabs component (ComponentSpec §6.2).

### 10. Row summaries/pills don't surface secondary bind properties
- **File**: `packages/formspec-studio-core/src/editor-tree-helpers.ts:75-92,105-114`
- **Problem**: `buildRowSummaries` and `buildStatusPills` cover the 6 primary MIPs but omit `default`, `whitespace`, `excludedValue`, `nonRelevantBehavior`, `disabledDisplay` (all normative per CoreSpec S4.3.1).
- **Fix**: Add pills/summaries for at least `default` (re-relevance value). Others are rarely used and could be deferred.

### 11. Missing CSV `encoding` option in AdapterOptions
- **File**: `packages/formspec-studio-core/src/mapping-serialization.ts:3-17`
- **Problem**: Mapping Spec S6.4 defines `encoding: string, default "utf-8"`. The AdapterOptions type omits it.
- **Fix**: Add `encoding?: string` to AdapterOptions. Acceptable to leave unimplemented in the JS string serializer since encoding only matters at byte-level transport.

### 12. `isStudioGeneratedComponentDoc` — not dead code, but usage is subtle
- **File**: `packages/formspec-layout/src/planner.ts:756`
- **Problem (original claim — INCORRECT)**: Originally reported as always returning `false`. However, `formspec-layout` is a standalone package — `formspec-react` passes `componentDocument` directly to `planComponentTree` without going through `RawProject._syncComponentTree`. A raw component document without `$formspecComponent` will hit the `== null` branch and return `true`. The function guards against applying auto-generation to externally-authored documents.
- **Action**: Keep. Add a comment clarifying the standalone planner use case. The test fixtures at lines 449/516/570 exercise a real path for direct planner usage (not via `RawProject`).

### 13. Story fixtures use PascalCase widgetHints (systemic)
- **File**: `stories/helpers/definitions.ts`
- **Problem**: Contact form fixture uses `"Checkbox"` (PascalCase). CoreSpec S4.2.5.1 requires camelCase: `"checkbox"`. This is systemic — the file also uses `"CheckboxGroup"` (should be `"checkboxGroup"`), `"NumberInput"` (should be `"numberInput"`), and references `component: "Checkbox"` which does not exist in the Component schema (only `Toggle` and `CheckboxGroup` exist for boolean/multiChoice rendering).
- **Fix**: Audit all widgetHint values in story fixtures for camelCase compliance. Fix component references to use valid Component spec names.

### 14. `materializePagedLayout` called on every interaction (minor perf)
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:~119`
- **Problem (original claim — overstated)**: Originally reported as a race condition. In React 18+, all state updates within a synchronous event handler are batched — there is no actual race. The real issue is that `materializePagedLayout` is called before every interaction rather than once. After the first call, subsequent calls find zero synthetic pages and become no-ops, so correctness is not affected — only minor perf overhead.
- **Fix**: Materialize once on first interaction using a `useRef` flag, not before every action.

### 15. `@faker-js/faker` is a production dependency (~6MB)
- **File**: `packages/formspec-studio-core/package.json`
- **Problem**: Only used by `mapping-sample-data.ts` for preview sample generation. All consumers of `@formspec-org/studio-core` inherit the weight.
- **Fix**: Move to dynamic `import()` for lazy loading, or relocate `mapping-sample-data.ts` back to `formspec-studio`.

### ~~16. Upstream `COMPONENT_TO_HINT` maps `Collapsible` → `'accordion'`~~
- **Fixed**: Removed `Collapsible: 'accordion'` from `COMPONENT_TO_HINT`. Collapsible (ComponentSpec §5.17) has no Tier 1 widgetHint; the lossy round-trip `Collapsible → 'accordion' → Accordion` is eliminated.

### 17. Test file naming ambiguity in `tests/styles/`
- **Files**: `packages/formspec-studio/tests/styles/theme-tokens.test.ts`, `tests/styles/theme-tokens.test.tsx`
- **Problem**: Two files with the same stem but different extensions and completely different strategies: `.ts` scans source files for disallowed token usage (static analysis, pure Node); `.tsx` renders components to verify token values resolve correctly (integration test). Same name causes discoverability confusion and potential test runner ambiguity.
- **Fix**: Rename to `theme-token-usage.test.ts` and `theme-token-rendering.test.tsx`.

### 18. Orphaned E2E spec outside `playwright/` subdir
- **File**: `packages/formspec-studio/tests/e2e/chat-e2e.spec.ts`
- **Problem**: All 26 other Playwright specs live in `tests/e2e/playwright/`. This file sits at the parent `e2e/` level and may be excluded by the Playwright config glob if it targets only `playwright/**/*.spec.ts`.
- **Fix**: Move to `tests/e2e/playwright/chat-e2e.spec.ts` and verify `playwright.config.ts` picks it up.

## Track / Document

### 19. Component tree always reconciles on every dispatch
- **File**: `packages/formspec-core/src/raw-project.ts:247`
- **Problem**: `_syncComponentTree` runs unconditionally. Previously gated by `!hasAuthoredComponentTree`. Reconciler is incremental so cost is proportional to tree size.
- **Action**: Monitor. Add a dirty flag or definition-hash check if perf becomes a concern on large forms.

### 20. `SubmitButton` lacks dedicated spec prose section (pre-existing)
- **File**: `specs/component/component-spec.md`
- **Problem**: Fully defined in schema but has no subsection in ComponentSpec S5/S6. Normative Appendix B lists 33 components (post-Wizard removal at S5.4 [Reserved]); the reference map header says 34. SubmitButton has `"category": "display"`, `"level": "core"` in schema — should appear in S5 among Core Display components.
- **Action**: Add a `SubmitButton` subsection to ComponentSpec S5 (Core Components). Reconcile the 33 vs 34 component count discrepancy in Appendix B.
- **Additional**: Appendix B lists Accordion as "Bind: Forbidden" but S6.3 prose and schema say "Bind: Optional (repeatable group key)". Fix the Appendix B entry.

### 21. ~25 pre-existing `as any` casts in `project.ts`
- **File**: `packages/formspec-studio-core/src/project.ts`
- **Problem**: Type gaps in `IProjectCore` force `as any` for properties like `tree`, `screener`, `selectors`, `defaults`. Pre-existing debt, not a regression.
- **Action**: Track. Resolve as `IProjectCore` interface is refined with more granular typed accessors.
