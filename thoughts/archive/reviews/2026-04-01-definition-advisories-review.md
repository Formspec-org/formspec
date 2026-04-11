# Definition Advisories — Consolidated Review

**Date:** 2026-04-01
**Spec under review:** `thoughts/specs/2026-03-31-definition-advisories.md`
**Reviewers:** spec-expert (initial + self-review), formspec-scout (code review), formspec-service-designer (UX review)

---

## Summary

42 findings across all reviews. 4 already fixed, 6 must-fix, 15 should-fix, 6 nice-to-fix, 11 very-low/acceptable/no-fix-needed.

---

## Code Issues (editor-tree-helpers.ts)

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| C1 | `buildAdvisories` uses `Boolean(binds.required)` (truthy for any non-empty string) instead of checking for static `"true"`. Dynamic expressions like `"$adminApproved"` incorrectly trigger W900/W902. | Service-Designer P0, Spec-Expert self-review | **Blocker** | Change to `binds.required === 'true'` (and same for `binds.readonly === 'true'`). The spec says "statically determinable to be true." |
| C2 | `Advisory` interface has no `severity` field. W900/W901 are warnings, W902 is info per spec, but the type only has `code`, `message`, `actions`. | Service-Designer P1, Scout Finding B (partial) | **Should fix** | Add `severity: 'warning' \| 'info'` to `Advisory`. Set `'warning'` on W900/W901, `'info'` on W902. |
| C3 | `DefinitionAdvisoryIssue` also has no `severity` field. Form Health panel can't differentiate advisory importance. | Service-Designer P2 | **Should fix** | Add `severity: 'warning' \| 'info'` to `DefinitionAdvisoryIssue`, populated from the advisory's severity. |
| C4 | W900 action list missing `remove_readonly`. If the author's mistake was locking the field (not missing a value source), the fix is removing the lock. | Service-Designer P1 | **Should fix** | Add `'remove_readonly'` to `AdvisoryActionKey` union. Add an action with label "Remove lock" to the W900 advisory. Wire in `ItemRowCategoryPanel.tsx` `runAdvisory` switch. |
| C5 | Split-bind detection gap. `buildAdvisories` receives a single `binds` record (from `bindsFor` which filters to one bind's properties). If `required` and `readonly` are on separate bind objects targeting the same path, only one bind's properties are checked — the other's aren't aggregated. | Spec-Expert self-review | **Should fix** | `bindsFor` (or a new helper) should aggregate all bind properties for a given path across multiple bind objects before passing to `buildAdvisories`. |
| C6 | Pattern 3 message was softened (done by craftsman) but downstream test in `definition-tree-editor.test.tsx:932` had a regex that no longer matches. | Scout | **Fixed** | Already fixed — changed regex to `/mandatory rule is usually redundant/`. |
| C7 | Dead `default` bind code path in production. `bindsFor` returns `Record<string, string>` and filters out non-strings. Schema defines `default` as an object. So `binds.default?.trim()` in `buildCategorySummaries` and `buildRowSummaries` is dead code in production (but alive in tests that construct records directly). | Scout Finding E | **Worth noting** | No fix recommended. If `default` bind display becomes a product need, `bindsFor` or a parallel helper would need to handle non-string bind values. |
| C8 | Redundant null checks in `ItemRowCategoryPanel.tsx` (`!= null && !== undefined`). | Scout Finding F | **Fixed** | Already fixed — removed redundant `&& binds.X !== undefined` from 5 null checks and 2 filter callbacks. |
| C9 | No `ItemRowCategoryPanel`-specific test that renders with advisory-triggering binds and verifies `AdvisoryCallout` components appear. | Scout Finding G | **Very low** | No specific fix recommended. The wiring is straightforward (`useMemo` -> `buildAdvisories` -> map to `AdvisoryCallout`). Risk of breakage is low. |
| C10 | Missing test for Pattern 2 with `required` present but no `readonly`. Should produce only W901, not W900. | Scout Finding D | **Very low** | Add a test case with `{ required: 'true', prePopulate: '...', calculate: '...' }` (no readonly) and assert only W901 fires. |
| C11 | `useMemo` dependency on `binds` object in `ItemRowCategoryPanel.tsx` may bust on every render if parent creates a new object reference. | Scout (line 118-124) | **Negligible** | No fix recommended — `buildAdvisories` is O(1) with 3 boolean checks, so even if memo busts, cost is negligible. |
| C12 | The cast `definition.binds as FormBind[] | undefined` in `FormHealthPanel.tsx` (line 24). | Scout Finding 5 | **Acceptable** | No fix recommended — type narrowing cast, not a monkeypatch. Runtime shape is correct. |
| C13 | W900 message uses "value source" — jargon that non-technical form managers won't understand. | Service-Designer | **Should fix** | Reword to: "This field is required but locked, so respondents can't fill it in. Add a formula or pre-fill to supply the value automatically — or remove the lock to let respondents fill it in." |
| C14 | W901 message ("The formula runs immediately and replaces the starting value from pre-fill") implies pre-fill value might eventually be used. It won't. | Service-Designer | **Should fix** | Reword to: "The formula overwrites the pre-fill value immediately — the pre-fill setting has no effect. Remove one or the other." |
| C15 | W902 message says "return empty" which may confuse non-technical users. | Service-Designer | **Nice to fix** | Change "unless the formula can return empty" to "unless the formula sometimes produces no value." |

---

## Spec Document Issues (thoughts/specs/2026-03-31-definition-advisories.md)

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| S1 | DA-01 `readonly` rationale quotes MUST NOT language from S2.1.4 but cites S4.3.1, which uses SHOULD NOT. | Spec-Expert self-review | **Must fix** | Either cite S2.1.4 (which has MUST NOT) or use the SHOULD NOT wording from S4.3.1. Don't mix sources. |
| S2 | "Statically determinable to be true" is used normatively but never defined — not in this doc or the existing spec. | Spec-Expert self-review, Service-Designer P0 | **Must fix** | Add a definition. Minimum floor: the literal string `"true"`. Optional extension: constant-folding of expressions like `"1 = 1"`. Processors MAY implement deeper analysis. |
| S3 | `default` bind property omitted from DA-01 value source list. A field with `required: "true"`, `readonly: "true"`, `default: "someValue"` receives a value on relevance transitions. | Spec-Expert self-review | **Must fix** | Either add `default` to the value source list, or explicitly exclude it with reasoning (e.g., `default` only fires on relevance restoration, not on initial form load — the field is still empty on first render). |
| S4 | DA-02 doesn't acknowledge `prePopulate.editable` flag (defaults to `true`, meaning the field is NOT readonly despite the "syntactic sugar" sentence). | Spec-Expert self-review | **Should fix** | Add a note explaining that `editable` does not affect the analysis because the advisory is about the value being overwritten by `calculate`, not about the readonly state. |
| S5 | DA-03 rationale overstates: says `required` is "always redundant" but doesn't hold when calculation intentionally returns null. The `info` severity is correct but the text should be softer. | Spec-Expert self-review, Service-Designer, Scout Finding A | **Should fix** | Soften from "making the `required` check either always-satisfied or indicative of a deeper expression bug" to something that acknowledges the intentional-null case more explicitly. |
| S6 | S3.10 is titled "Error Handling" but now includes a non-error finding class (advisories). Naming inconsistency. | Spec-Expert self-review | **Should fix** | Either retitle S3.10 to "Error Handling and Static Analysis" or add a note acknowledging the naming tension. |
| S7 | DA-01 detection logic (Rust Implementation section, line 167) assumes `required` and `readonly` are on the same bind object. Separate binds targeting the same path with one having `required` and the other `readonly` would be missed. | Spec-Expert self-review | **Should fix** | Update the detection logic description to aggregate all bind properties per path before checking combinations. |
| S8 | The S3.10.2 design rationale ("form users should not be punished") is used analogically for a different context (static bind analysis vs runtime error handling). | Spec-Expert self-review | **Nice to fix** | Flag as an analogical extension in the rationale text rather than presenting it as a direct application. |
| S9 | Severity Policy says W900-W902 are suppressed "like W300 and W802" — implies this is automatic. It's not; requires explicit code changes in `suppressed_in`. | Spec-Expert self-review | **Nice to fix** | Clarify that this is a design requirement for the Rust implementation, not an existing behavior. |
| S10 | "After existing 1-7" passes is slightly imprecise given 1b and 3b exist. | Spec-Expert self-review | **Nice to fix** | Change to "after all existing passes" or enumerate them. |
| S11 | DA-02 mentions `initialValue + calculate` as a possible W903 but defers it. | Spec-Expert self-review | **No fix needed** | Correctly deferred as an open question. |

---

## Architecture / Convergence Issues

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| A1 | Two advisory systems with no convergence plan. TS `buildAdvisories` in studio-core and future Rust Pass 8 in `formspec-lint` are described as one system but are separate implementations. | Service-Designer P0, Spec-Expert initial | **Must fix** | Spec should explicitly state the plan: (a) TS is permanent for real-time Studio UI, Rust for publish-time — kept in sync manually; (b) TS is transitional, replaced by WASM-exposed Rust once Pass 8 ships; or (c) independent implementations of same spec section. CLAUDE.md doctrine favors (b). |
| A2 | MCP has no tool surface for advisories. `formspec_audit` calls `project.diagnose()` which runs Rust linter (no Pass 8 yet). `buildAdvisories` is TS-only. AI agents can't see W900-W902. | Service-Designer, Spec-Expert initial | **Should fix** | Either (a) implement Rust Pass 8 before declaring advisory system available to MCP, or (b) expose `buildDefinitionAdvisoryIssues` through a separate MCP tool (e.g., `formspec_health`), or (c) import from studio-core in `audit.ts` as the original proposal suggested. |
| A3 | Authoring mode suppression undefined for Studio UI path. Spec defines `LintMode` suppression for Rust pipeline. Studio runs `buildAdvisories` continuously — authors see advisories fire mid-construction before they've finished configuring the field. | Service-Designer P2 | **Should fix** | Spec should define whether Studio uses: (a) deferred evaluation (only on save/check), (b) debounced evaluation (delay after last edit), or (c) continuous evaluation with an explicit acknowledgment that mid-construction noise is acceptable. |
| A4 | Mapping-populated fields produce permanent false W900 advisories. Fields intended to receive values from mapping rules have no `calculate`/`initialValue`/`prePopulate` but are legitimately locked+required. | Service-Designer P1 | **Should fix** | Options: (a) add an `externallyPopulated: true` marker to item/bind schema that suppresses W900, (b) explicitly acknowledge the false positive in the spec and accept it, (c) check for mapping rules targeting the field as an additional value source. No recommendation given — needs a product decision. |

---

## UI / Form Health Panel Issues

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| U1 | Studio renders all advisories with identical amber styling regardless of code/severity. W900 (form is broken) looks identical to W902 (probably fine). | Service-Designer | **Should fix** | After adding `severity` to `Advisory` (C2), render W902 (info) with lighter visual treatment (e.g., blue/info styling vs amber/warning). |
| U2 | No same-code grouping in Form Health panel. Three W900s from three different fields show as three separate tiles instead of "3 fields are required but locked." | Service-Designer P2 | **Nice to fix** | Group multiple instances of the same advisory code in the health panel display with a count. |
| U3 | No count badge on Editor tab when advisories exist. If the author is in the Theme workspace, they have no indication advisories exist. | Service-Designer | **Nice to fix** | Add a badge/count indicator to the Editor tab title (e.g., "Editor (3)"). No specific fix recommended — product decision. |
| U4 | FormHealthPanel does not display the `code` field (W900/W901/W902). | Scout | **Acceptable** | No fix needed now — code is structural metadata, not user-facing. Will be useful when health panel adds severity-based sort/filter. |

---

## Test Coverage Gaps

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| T1 | Missing test for `buildDefinitionAdvisoryIssues` with nested items (field inside a group). | Scout Finding C | **Fixed** | Already added by craftsman — group with child field, verifies path and code. |
| T2 | Missing test for Pattern 2 with `required` present but no `readonly`. | Scout Finding D | **Very low** | Add test: `{ required: 'true', prePopulate: '...', calculate: '...' }` -> only W901 fires. |
| T3 | No `ItemRowCategoryPanel` integration test for advisory rendering. | Scout Finding G | **Very low** | Add test rendering `ItemRowCategoryPanel` with advisory-triggering binds and verifying `AdvisoryCallout` appears. |
| T4 | Tests for split-bind aggregation (C5) don't exist. | Implied by Spec-Expert self-review | **Should fix (after C5)** | Add test where `required` and `readonly` are on separate bind objects targeting the same path. Verify W900 fires. |
| T5 | Tests for dynamic expression non-triggering don't exist (once C1 is fixed). | Implied by Service-Designer, Spec-Expert | **Should fix (after C1)** | Add test: `{ required: '$needsApproval', readonly: '$locked' }` -> no advisory fires. |
| T6 | Downstream test regex in `definition-tree-editor.test.tsx:932` didn't match softened message. | Scout | **Fixed** | Already fixed — regex updated to `/mandatory rule is usually redundant/`. |

---

## Spec Gaps (from initial spec-expert analysis)

| # | Issue | Source | Severity | Recommended Fix |
|---|-------|--------|----------|-----------------|
| G1 | No spec concept of "definition quality warning" — gap between hard errors (S3.10.1) and runtime validation (S5). | Spec-Expert initial | **Addressed** | The spec proposal (S3.10.3) addresses this. Still needs the fixes listed in S1-S11 above. |
| G2 | `prePopulate` + `calculate` interaction unspecified in spec. Processing model handles it deterministically but spec never acknowledges the interaction. | Spec-Expert initial | **Addressed** | DA-02 in the proposal addresses this. |
| G3 | `required` on calculated fields not discussed in spec. | Spec-Expert initial | **Addressed** | DA-03 in the proposal addresses this. |
| G4 | No formal lint code taxonomy in the spec. E/W codes exist only in implementation. | Spec-Expert initial | **Partially addressed** | The proposal adds the W900 range taxonomy. A full lint code spec (covering E100-E807 as well) remains future work. |
| G5 | `ValidationResult.constraintKind` doesn't cover static analysis. | Spec-Expert initial | **By design** | Confirmed correct — lint diagnostics should NOT be `ValidationResult` entries. No fix needed. |

---

## Tally

| Severity | Count | Details |
|----------|-------|---------|
| Already fixed | 4 | C6, C8, T1, T6 |
| Must fix | 6 | C1, S1, S2, S3, A1, C5/S7 (same issue in code and spec) |
| Should fix | 15 | C2, C3, C4, C5, C13, C14, S4, S5, S6, S7, A2, A3, A4, T4, T5 |
| Nice to fix | 6 | C15, S8, S9, S10, U1, U2, U3 |
| Very low / acceptable / no fix needed | 11 | C7, C9, C10, C11, C12, S11, U4, T2, T3, G4, G5 |
| Addressed by proposal | 3 | G1, G2, G3 |
| **Total** | **42** | |
