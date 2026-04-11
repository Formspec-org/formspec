# Group 5 Review — TS Engine Split & WASM Init API

## Summary

The monolithic `packages/formspec-engine/src/index.ts` (~3000 lines) was split into focused submodules across two commits. The structural decomposition is clean and the public API surface is fully preserved. The WASM split into runtime vs tools artifacts is the architecturally significant change: `initFormspecEngine()` loads only the runtime WASM; tools WASM loads lazily on first use or explicitly via `initFormspecEngineTools()`. All call sites were updated correctly.

The split is largely well-executed. There are a small number of findings, none of them blocking — one medium-priority concern about incomplete enforcement of the tools-lazy guarantee, one low-priority internal coupling issue, and several plan tracking items that are not yet marked complete.

---

## Findings

### Medium: `RuntimeMappingEngine.execute()` silently degrades rather than throwing when tools not loaded

**File:** `packages/formspec-engine/src/mapping/RuntimeMappingEngine.ts:131-144`

**Details:**
When `isWasmToolsReady()` is false, `RuntimeMappingEngine.execute()` returns a result object with `output: {}` and a diagnostic rather than throwing or deferring. This is inconsistent with the rest of the tools-tier surface: `wasmTokenizeFEL`, `assembleDefinitionSync`, `wasmLintDocument`, etc. all throw immediately when tools are not ready. The silent-return path is effectively a hidden API contract that callers must opt in to checking diagnostics to discover.

More critically: the ADR and plan both state that `RuntimeMappingEngine` requires explicit `initFormspecEngineTools()` — the error message in the diagnostic even says so. But a caller who doesn't read the diagnostic gets back `{ output: {}, appliedRules: 0 }`, which can silently corrupt a mapping round-trip. The silent path only makes sense if `RuntimeMappingEngine` were designed to be "eventually consistent" and retry — but it is not. It's synchronous and final.

`assembleDefinitionSync` (same tier, same initialization contract) throws immediately with a clear message. `RuntimeMappingEngine` should match this behavior.

**Recommendation:**
Change the `!isWasmToolsReady()` guard in `execute()` to throw rather than return a degraded result. The diagnostic path was likely added defensively during development; it's now a trap. If a soft-fail is truly required by callers (there is currently no evidence of this), that decision should be explicit and documented.

---

### Low: `assembly/assembleDefinition.ts` reaches into `engine/helpers.ts` for `cloneValue`

**File:** `packages/formspec-engine/src/assembly/assembleDefinition.ts:5`

**Details:**
`assembleDefinition.ts` imports `cloneValue` from `../engine/helpers.js`. `helpers.ts` is the internal helper module for `FormEngine` and its sibling modules in the `engine/` subdirectory. `assembly/` is a peer namespace, not a subordinate of `engine/`. This creates a lateral coupling: `assembly` depends on an `engine`-internal module.

The impact is low — `cloneValue` is a pure structural-copy utility with no engine state dependency — but the import creates a conceptual boundary violation. If `helpers.ts` ever needs to be engine-specific (e.g., gains a dependency on `EngineBindConfig` or engine-specific types), `assembly/assembleDefinition.ts` would be dragged in.

**Recommendation:**
Extract `cloneValue` to a shared utility module (`packages/formspec-engine/src/util.ts` or similar) that neither `engine/` nor `assembly/` owns. Both import from the shared location. This is a small mechanical change that enforces the intended peer relationship. Not urgent — `cloneValue` is stable — but worth noting as cleanup.

---

### Low: `FormEngine.instanceSourceCache` is a public static — cross-instance shared mutable state

**File:** `packages/formspec-engine/src/engine/FormEngine.ts:85`

**Details:**
`public static instanceSourceCache = new Map<string, any>()` is a class-level singleton. In a browser environment with multiple `FormEngine` instances created for different forms, `static` instances sharing the same URL key will reuse cached data without a refresh path. This was presumably present before the split, but the split makes it visible as an architectural choice worth flagging.

The cache is keyed by `instance.source` URL and only populated for `instance.static === true` instances. The semantics ("this URL's content never changes for the lifetime of the page") make the behavior intentional. But `public` visibility means external code could mutate or inspect it, which is unexpected for a cache.

**Recommendation:**
Change to `private static` or at minimum `readonly static`. The public visibility provides no consumer benefit and makes the API surface unnecessarily wide. If external cache invalidation is needed (e.g., tests), add an explicit `static clearInstanceCache()` method.

---

### Low (Plan tracking): Several ADR 0050 / plan checklist items not yet marked complete

**File:** `thoughts/archive/plans/2026-03-23-wasm-runtime-tools-split.md`

**Details:**
The plan correctly tracks completion status. A number of items are still open that should be resolved or tracked as explicit follow-up tasks before the branch merges to main:

- `wasm-bridge.ts` was not split into `wasm-bridge-runtime.ts` / `wasm-bridge-tools.ts` (section 5, item 3). The current single-file bridge is functional but the plan marks this as a pending task. The current design works fine — the split was marked as the intended architecture but the monolithic bridge is actually cleaner given the compatibility barrel pattern already achieves the same isolation. This item should either be marked done (accepted alternative: one bridge file, not three) or explicitly deferred.
- The Makefile / CI artifact path updates (section 6) and browser build network-tab proof (section 8) are open. These are real gaps if the branch ships to production, but not blockers for a code review approval.
- The "ambiguous" `wasmParseFEL` / `wasmExtractDependencies` entries in the export ownership matrix (section 4) are unresolved. Looking at actual code: `wasmParseFEL` is only used in `wasm-bridge.ts` and is behind `assertWasmToolsReadySync()` (correctly tools-tier). `wasmExtractDependencies` similarly uses `assertWasmToolsReadySync()`. Both are correctly implemented; the plan just didn't mark them resolved.

**Recommendation:**
Close the open plan items that are already correctly implemented (the ambiguous wrappers, the wasm-bridge consolidation). File concrete follow-up issues for the CI and browser-build proof items rather than leaving them as open checkboxes. Stale plan checkboxes create false uncertainty during future reviews.

---

### Informational: `initFormspecEngineTools()` required ordering (runtime first) creates a foot-gun

**File:** `packages/formspec-engine/src/wasm-bridge.ts:72-74`

**Details:**
`initWasmTools()` throws `'Formspec tools WASM requires runtime WASM first. Call await initFormspecEngine() before initFormspecEngineTools()'` if runtime is not loaded. This is a correct and intentional constraint, and the error message is clear. It is noted here because the dependency is implicit — a caller who only calls `initFormspecEngineTools()` gets a confusing failure. The constraint is documented in `CLAUDE.md` and the function JSDoc.

No code change needed. Documenting this as "correct but worth keeping the ordering test in the isolation suite."

---

## Verdict

**Ship with fixes.**

The split is clean, the public API surface is fully preserved, and all call sites were updated. The WASM initialization architecture correctly gates tools loading and the isolation test provides meaningful proof of the runtime-first guarantee.

The one actionable fix is converting `RuntimeMappingEngine.execute()`'s silent-return path to a throw, consistent with the rest of the tools-tier surface. This is a small change and should not require a re-review. The `instanceSourceCache` visibility and the `assembly` lateral coupling are low-priority cleanup items that can land in a follow-up. The plan tracking items should be tidied before merging.
