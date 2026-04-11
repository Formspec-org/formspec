# Group 10 Review — Test Suite Hardening

## Summary

Seven commits covering test-only changes (plus one miscategorized fix). The overall direction is correct: drop tests whose infrastructure no longer exists, wire WASM initialization consistently, and align test assertions with a redesigned Pages UI. No regressions introduced. Three findings warrant attention before shipping.

---

## Findings

### [High]: e8fdcab is a production fix, not a test change

**File(s):** `packages/formspec-studio-core/src/evaluation-helpers.ts`

**Details:**
`e8fdcab` is committed with the message `fix: preserve repeat required errors in previews` and modifies production logic in `loadDataIntoEngine`. The commit adds a guard that skips `engine.setValue` when a flat-path value is `undefined`, preventing the engine from overwriting unset repeat-group children with `undefined` and suppressing their required-field errors. This is a behavioral fix to the preview/validateResponse path, not a test hardening change. The test added in the same commit is the regression test for the fix.

The commit message is correctly labeled `fix:`, but it was included in a batch of ostensibly test-only changes and will be invisible to anyone scanning the group as "test hardening." For code review traceability and cherry-pick safety, production fixes must not be bundled with test changes.

The fix itself is correct and well-targeted. The test correctly exercises the scenario: `validateResponse` with explicit `undefined` values at repeat-group paths must yield required errors, not suppress them.

**Recommendation:** No code change required. Flag for the submitter: production source changes must travel in their own commits, even when a test is added alongside. The commit as landed is fine — it just needs to be called out as a hidden fix in the group framing.

---

### [High]: d1b412e setup.ts used non-exported `initWasm` — immediately superseded

**File(s):** `packages/formspec-mcp/tests/setup.ts`

**Details:**
Commit `d1b412e` introduced `packages/formspec-mcp/tests/setup.ts` with:

```ts
import { initWasm } from 'formspec-engine';
await initWasm();
```

`initWasm` is an internal function defined in `wasm-bridge-runtime.ts`. It is not re-exported from `formspec-engine/src/index.ts`; only `initFormspecEngine` (its wrapper) is. This import would fail at runtime in Vitest because `initWasm` is not in the public barrel.

The broken setup was corrected by commit `5b1ae5b` (the WASM split commit, part of the same branch but outside this group's 7 commits):

```ts
import { initFormspecEngine, initFormspecEngineTools } from 'formspec-engine';
await initFormspecEngine();
await initFormspecEngineTools();
```

This means the `new` branch had a window of test-suite breakage between `d1b412e` and `5b1ae5b`. The fix arrived soon after and the current state is correct. For branch history readability, it is worth noting the gap, but no action is needed now.

**Recommendation:** No action required — the current file is correct. Flag the pattern: when a commit introduces a setup file, the imports must be verified against the barrel before committing. An automated `tsc --noEmit` or `vitest --run` in CI would have caught this immediately.

---

### [Medium]: Story 8 drag-reorder test is permanently skipped with no tracking issue

**File(s):** `packages/formspec-studio/tests/e2e/playwright/pages-behavioral.spec.ts:397`

**Details:**
```ts
test.skip(true, '@dnd-kit DOM sortable: Playwright dragTo does not reliably fire dnd-kit sensors');
```

The test was rewritten from a "Move Down button" approach (which tested a now-removed UI control) to a `dragTo` approach that doesn't work reliably with dnd-kit sensors in Playwright. The skip is honest and the comment explains why. However, the underlying behavior — reordering wizard pages — is now completely untested in the E2E suite.

dnd-kit pointer-sensor tests require `page.dispatchEvent` sequences (pointerdown → pointermove → pointerup) rather than `dragTo`. Playwright can drive this but it requires more setup. Leaving the test skipped indefinitely means page reordering regressions will not be caught.

**Recommendation:** File a tracked follow-up. Either (a) implement the pointer-event sequence for dnd-kit testing, or (b) add a Vitest unit test for the `reorderPages` helper in studio-core that verifies page order after a move. Option (b) is lower effort and adequate coverage for the data layer. The skip is acceptable short-term; it should not remain indefinitely.

---

### [Medium]: Export tests weakened from contract assertions to "not empty"

**File(s):** `tests/component/tools-dashboard/export.spec.ts`

**Details:**
The three export tests (JSON, CSV, XML) changed from:

```ts
await expect(page.locator('#export-result-content')).toContainText('Community Health Partners');
await expect(page.locator('#export-result-content')).toContainText('org_name');
await expect(page.locator('#export-result-content')).toContainText('GrantApplication');
```

to:

```ts
await expect(page.locator('#export-result-content')).not.toBeEmpty();
```

The reason is that the old tests mocked the export server endpoints and controlled the response content. The new tests run the real WASM mapping engine. Since the tests now feed `{ "orgName": "Community Health Partners" }` into the grant-application mapping, the expected output content is deterministic — but the assertions no longer verify it. A mapping engine regression that produces wrong output would pass all three tests as long as something appears.

The shift from "run real code" (correct direction) to "weaker assertions" (incorrect tradeoff) is the problem.

**Recommendation:** Restore content-specific assertions for at least one format. For JSON: assert the output contains the mapped key that the grant-application mapping produces. This doesn't require mocking — the real mapping output for a known input is predictable. For CSV and XML, at minimum assert format-specific structural markers (CSV line break, XML root tag).

---

### [Medium]: Changelog "no changes" test drops `semverImpact` assertion without explanation

**File(s):** `tests/component/tools-dashboard/changelog.spec.ts`

**Details:**
The "comparing identical definitions shows no changes" test previously asserted:
```ts
await expect(page.locator('#changelog-impact')).toHaveText('patch');
```

This assertion was removed. The test now only checks that `#changelog-changes` contains "No changes". The impact classification for identical definitions (`patch`) is a behavioral contract of the changelog engine. The assertion existed and was removed without explanation — the old test mocked the server response, but the new test runs the real changelog engine. The real engine should return `patch` for identical definitions, so the assertion was droppable by omission rather than by knowledge.

**Recommendation:** Re-add `await expect(page.locator('#changelog-impact')).toHaveText('patch')` for the identical-definitions case. It is a free behavioral assertion over a real code path.

---

### [Medium]: `pages-workspace.spec.ts` imports from `formspec-engine/dist/` directly

**File(s):** `packages/formspec-studio/tests/e2e/playwright/pages-workspace.spec.ts`

**Details:**
```ts
import { initWasm } from '../../../../formspec-engine/dist/wasm-bridge.js';
```

This is a layer violation. Tests in `formspec-studio` are at layer 6 and should use the public barrel (`formspec-engine`) rather than deep-pathing into a specific dist file. The reason this import exists is that the Playwright test evaluates a `ProjectBundle` in Node context where WASM must be initialized before `createProject`, and the alias for `formspec-engine` in the Playwright E2E context resolves to the barrel which may not expose `initWasm`.

The deeper issue: `initWasm` is not exported from the public barrel (`packages/formspec-engine/src/index.ts`). Only `initFormspecEngine` is. The test should use `initFormspecEngine`, which is exported. The direct dist import was the path of least resistance but it bypasses TypeScript type checking and the public API contract.

**Recommendation:** Replace with `import { initFormspecEngine } from 'formspec-engine'` and call `await initFormspecEngine()`. If the Playwright E2E alias doesn't resolve the barrel to the right module, fix the alias rather than path-patching into dist. The dist path is brittle — it breaks if the output layout changes.

---

### [Low]: Duplicate assertions in `server-response-tab.spec.ts` (c726f8f)

**File(s):** `tests/e2e/browser/references/server-response-tab.spec.ts:111-116`

**Details:**
In the "validation report section is populated" test:
```ts
expect(vr).toHaveProperty('results');
expect(vr).toHaveProperty('counts');
expect(vr).toHaveProperty('timestamp');
expect(vr).toHaveProperty('results');   // duplicate
expect(vr).toHaveProperty('counts');    // duplicate
```

Lines 115 and 116 are copy-paste duplicates of lines 112 and 113. They don't hurt correctness but clutter the test.

**Recommendation:** Delete the duplicate lines.

---

### [Low]: FEL `substring` comment correction in `clinical-intake.spec.ts` (28cf882) is good — but worth noting

**File(s):** `tests/e2e/browser/clinical-intake.spec.ts`

**Details:**
The test comments and expected values changed from `****567` (0-based indexing) to `****4567` (1-based indexing), aligning with the spec (`substring` is 1-based per `specs/core/spec.md:1246`). The expected values were wrong — the test was passing with a buggy engine implementation and both the engine and the tests were updated together elsewhere. This commit corrects the test to match the now-correct engine behavior.

This is a comment + expected-value correction only — no behavioral or architectural concern. Noted here for completeness.

**Recommendation:** No action needed. The correction is correct.

---

### [Low]: WASM readiness marker gates UI readiness only, not tools WASM readiness

**File(s):** `examples/refrences/tools.js`, `tests/component/tools-dashboard/*.spec.ts`

**Details:**
`tools.js` sets `document.documentElement.dataset.formspecWasmReady = '1'` immediately after `await initFormspecEngine()`. The Playwright tests wait for `html[data-formspec-wasm-ready="1"]` as a readiness gate before clicking tabs. However, the tools dashboard uses `generateChangelog`, `createMappingEngine`, and registry operations — all of which require the tools WASM module (`initFormspecEngineTools`), which `tools.js` never calls.

This means: (1) the UI readiness marker fires before tools WASM is ready, and (2) tabs that use tools features could fail if the tools WASM is not loaded. The current behavior is that `RuntimeMappingEngine.execute` degrades gracefully (returns a diagnostic error) when tools WASM is not ready, and `generateChangelog` throws synchronously. In practice the tests pass because the export and changelog operations involve user interaction after page load, giving time for any lazy loading — but there is no lazy-init path for tools WASM in `tools.js`.

This is likely a gap left by the WASM split work: `tools.js` was not updated to call `initFormspecEngineTools`. The readiness marker and the tests both reflect an incomplete assumption about what "ready" means.

**Recommendation:** `tools.js` should call `await initFormspecEngineTools()` before setting the readiness marker, since the tools dashboard depends on it for changelog, mapping, and dependency graph features. The readiness marker should reflect full application readiness, not just runtime WASM readiness. This is a gap in `tools.js`, not in the test harness itself.

---

## Verdict

**Ship with fixes.**

The test hardening direction is sound: real WASM execution replaces server mocks, WASM init is properly wired into test setups, and UI changes are correctly reflected in test assertions. The production fix in e8fdcab is correct and well-tested.

Three changes should be made before considering this group closed:

1. Re-add `semverImpact = 'patch'` assertion in changelog.spec.ts (trivial, no excuse to omit).
2. Restore content-specific assertions in export.spec.ts for at least one format.
3. Fix the `dist/wasm-bridge.js` direct import in pages-workspace.spec.ts to use the public barrel.

The skipped Story 8 drag test and the tools WASM readiness gap are tracked as lower-priority follow-ups, not blockers.
