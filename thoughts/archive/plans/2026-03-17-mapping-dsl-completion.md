# Mapping DSL Completion Plan

**Date:** 2026-03-17
**Status:** Complete — all Mapping Core conformance work done
**Scope:** Complete the Mapping DSL implementation across all four packages to reach Mapping Core conformance, with the multi-mapping Studio UI and Extended adapter groundwork.

---

## Context

The multi-mapping migration (multiple `mappings` in `ProjectState`) is done and stable (518 tests passing). What remains is the runtime transform engine, missing Studio Core helpers, and the Studio authoring UI. This plan tracks all known gaps in priority order.

---

## Phase 1 — Engine: Fix broken foundations ✅ DONE

All items implemented in `packages/formspec-engine/src/runtime-mapping.ts`.

- **1.1** `valueMap` shape: reads `valueMap.forward`, supports `unmapped` strategies (error/passthrough/drop/default), auto-inverts bijective maps for reverse ✅
- **1.2** `coerce` descriptor: accepts `{ from, to, format }` object; added integer, date, datetime, money types; enforces lossy non-reversibility ✅
- **1.3** Array path notation: `[N]` index segments and `[*]` wildcard in `splitPath`/`getByPath`/`setByPath` ✅
- **1.4** Per-rule `default` fallback when sourcePath resolves to absent ✅
- **1.5** `bidirectional: false` skipped during reverse ✅
- **1.6** Document-level `direction` enforcement ✅
- **1.7** Structured `MappingDiagnostic` with `ruleIndex`, `sourcePath`, `targetPath`, `errorCode`, `message` ✅

54 unit tests passing (`runtime-mapping.test.mjs` + `runtime-mapping-phases123.test.mjs`).

---

## Phase 2 — Engine: FEL integration ✅ DONE

- **2.1** `expression` transform wired to FEL evaluator with `$` (source value) and `@source` (full doc) bindings ✅
- **2.2** `condition` evaluator replaced with FEL; `null` result → skip rule ✅

---

## Phase 3 — Engine: Missing transform types ✅ DONE

All implemented in `packages/formspec-engine/src/runtime-mapping.ts`:

- **3.1** `array.mode: "each"` — iterates source array, applies innerRules per element ✅
- **3.2** `array.mode: "whole"` — binds entire array to `$` ✅
- **3.3** `array.mode: "indexed"` — positional innerRules by index ✅
- **3.4** `flatten` — array+separator→string, array→positional keys, object→dot-flat keys ✅
- **3.5** `nest` — inverse of flatten ✅
- **3.6** `concat` — multi-source FEL string join ✅
- **3.7** `split` — FEL expression returning array or object ✅

---

## Phase 4 — Engine: Adapters ✅ DONE

- **4.1** JSON adapter: `nullHandling: "omit"` and `sortKeys: true` post-processing applied after rule execution ✅
- **4.2** CSV adapter: flat key serialization with delimiter/quote/header/lineEnding config; rejects dotted/indexed targetPaths ✅
- **4.3** XML adapter: nested element tree from object, `@attr` syntax for attributes, CDATA paths, root element config, XML declaration toggle ✅

---

## Phase 5 — Core: Gaps and verification ✅ DONE (pre-existing)

- **5.1** `previewMapping` uses `state.selectedMappingId` ✅
- **5.2** `dependency-graph` iterates `Object.entries(state.mappings)` ✅
- **5.3** `autoGenerateRules` scopePath leading-dot trim ✅

---

## Phase 6 — Studio Core: Multi-mapping helpers ✅ DONE

`packages/formspec-studio-core/src/project.ts`:

- `createMapping`, `deleteMapping`, `renameMapping`, `selectMapping` all present ✅
- `mapField` and `unmapField` accept optional `mappingId` param ✅
- `previewMapping` accepts optional `mappingId` ✅
- 4 integration tests in `mapping-behavior.test.ts` ✅

---

## Phase 7 — Studio: Multi-mapping UI ✅ DONE

- `MappingSelector` component: tab strip with create/delete/rename ✅
- `useMappingIds` hook: reactive IDs and selected ID ✅
- Inline create (Enter to confirm, Escape to cancel) ✅
- Inline rename via double-click or rename button ✅
- Delete disabled when only one mapping exists ✅
- 10 E2E Playwright tests in `mapping-workspace.spec.ts` ✅

---

## Phase 8 — Studio: Rule editor completeness ✅ DONE

`sourcePath`, `targetPath`, `transform`, `expression` all editable in RuleCard. ✅

Advanced section (collapsible, hover to reveal toggle) implemented:
- `description`, `priority` (number), `bidirectional` (checkbox), `condition` (FEL) ✅
- `default` (JSON-parsed, inline error state on invalid JSON) ✅
- `reverse.expression` (hidden when transform is 'drop', merges into existing reverse object) ✅

Still deferred (out of scope for core conformance):
- `valueMap` key-value table editor
- `coerce` from/to type selectors
- `array` mode selector with nested innerRules editor

---

## Phase 9 — Studio: AdapterConfig ✅ DONE

`packages/formspec-studio/src/workspaces/mapping/AdapterConfig.tsx`:

- **JSON**: `nullHandling` select (include/omit), `sortKeys` toggle ✅
- **XML**: `declaration` toggle, `indent` number, `cdata` path list ✅
- **CSV**: `delimiter`, `quote`, `header`, `lineEnding` controls ✅
- Falls back to helpful message when no format is set ✅

---

## Remaining work

All Mapping Core conformance work is complete. The following items remain as optional extensions:

- `valueMap` key-value table editor in RuleCard Advanced section
- `coerce` from/to type selectors in RuleCard
- `array` mode selector with nested innerRules editor in RuleCard

### Execution order

| Phase | Package | Status |
|-------|---------|--------|
| 1 — Fix foundations | engine | ✅ Done |
| 2 — FEL integration | engine | ✅ Done |
| 3 — Missing transforms | engine | ✅ Done |
| 4 — Adapters | engine | ✅ Done (JSON + CSV + XML) |
| 5 — Core verification | core | ✅ Done |
| 6 — Studio Core helpers | studio-core | ✅ Done |
| 7 — Multi-mapping UI | studio | ✅ Done |
| 8 — Rule editor | studio | ✅ Done (Advanced section complete) |
| 9 — AdapterConfig | studio | ✅ Done |
