# Reference Examples — Smoke Test Issues

> Generated 2026-03-09 from automated Playwright smoke tests of all 5 reference
> forms at `examples/refrences/`. Organized into parallel work tracks.
>
> **Status: All tracks resolved (2026-03-09).**

---

## Track A: FEL Engine Fixes ✓

Owner: engine specialist — `packages/formspec-engine/src/fel/`

### A1 · `let...in` parser conflict with subsequent function calls ✓ RESOLVED

**Severity:** Bug
**Affected:** Clinical Intake (Insurance ID masked field), any FEL expression using `let...in`
**Repro:**

```fel
let id = string($patient.insuranceMemberId) in if empty(id) then null else concat(substr(id, 0, 3), '•••••', substr(id, -3))
```

The lexer tokenizes the `in` keyword, then sees `if empty(id)` — the parser
fails with `MismatchedTokenException: Expecting token of type --> In <-- but
found --> 'empty'`. The `let...in` construct collides with function calls
immediately after `in`.

**Root cause:** The `membership` parser rule has an `OPTION` that consumes `In`
as a membership operator (e.g., `x in [1, 2, 3]`). Since `in` is a single token
type, `membership` greedily consumed the `in` that `letExpr` needed.

**Fix:** Added a `_letDepth` counter to `FelParser`. Incremented before parsing
the let-value, decremented after. The `membership` rule's `In` option is gated
with `GATE: () => this._letDepth === 0`. Also implemented the actual let-scope
binding in the interpreter (it was previously a no-op — `letScopes` stack with
push/pop per binding).

**Files changed:**
- `packages/formspec-engine/src/fel/parser.ts` — `_letDepth` gate
- `packages/formspec-engine/src/fel/interpreter.ts` — `letScopes` stack, `fieldRef` scope lookup

**Tests:** `packages/formspec-engine/tests/fel/let-in-expression.test.mjs` — 7 tests

---

### A2 · `date("")` throws instead of returning null ✓ RESOLVED

**Severity:** Minor
**Affected:** Clinical Intake (`patientAgeYears` calculate expression)

**Root cause:** `date()` stdlib only guarded `null`/`undefined`, not empty string.
`new Date("")` produces an invalid date, triggering the `isNaN` throw.

**Fix:** Added `v === ''` to the early-return null guard in `date()`, matching
`number("")` → `null` behavior.

**Files changed:**
- `packages/formspec-engine/src/fel/interpreter.ts` — `date()` empty-string guard

**Tests:** `packages/formspec-engine/tests/fel/date-empty-null.test.mjs` — 6 tests

---

## Track B: Validation & Wizard UX ✓

Owner: webcomponent specialist — `packages/formspec-webcomponent/src/`

### B1 · Decision: per-page wizard validation on Next ✓ RESOLVED

**Severity:** Design decision
**Affected:** All 4 wizard forms (Grant App, Tribal Short, Tribal Long, Clinical Intake)

**Decision (2026-03-09):** Option 2 — **soft per-page validation**. Clicking Next
touches all fields in the current panel, making inline errors visible, then
advances immediately. Users see errors but are never blocked.

**Implementation:** Added `touchedFields: Set<string>` and `touchedVersion: Signal<number>`
to `RenderContext`. The wizard's Next click handler calls `touchFieldsInContainer()`
on the current panel before advancing. Error-display effects subscribe to
`touchedVersion` and re-evaluate when it increments.

**Files changed:**
- `packages/formspec-webcomponent/src/types.ts` — `touchedFields`, `touchedVersion` on `RenderContext`
- `packages/formspec-webcomponent/src/rendering/emit-node.ts` — wire context fields from `RenderHost`
- `packages/formspec-webcomponent/src/submit/index.ts` — `touchFieldsInContainer()` utility
- `packages/formspec-webcomponent/src/components/interactive.ts` — wizard Next handler

**Tests:** `packages/formspec-webcomponent/tests/components/interactive-plugins.test.ts` — 4 tests

---

### B2 · Invoice: validation banner shows eagerly on initial load ✓ RESOLVED

**Severity:** Minor UX
**Affected:** Invoice form

**Root cause:** `ValidationSummaryPlugin` used `source: 'live'` mode which called
`engine.getValidationReport()` on render — showing the error banner before any
user interaction.

**Fix:** Added a guard in the `source === 'live'` branch that checks
`ctx.latestSubmitDetailSignal.value === null`. If no submit has happened, the
element is cleared and the effect returns early. Once the user clicks Submit,
the banner reactively appears.

**Files changed:**
- `packages/formspec-webcomponent/src/components/display.ts` — submit-gate guard

**Tests:** `packages/formspec-webcomponent/tests/components/validation-summary.test.ts` — 6 tests

---

### B3 · Empty conditional pages need a hint ✓ RESOLVED

**Severity:** Minor UX
**Affected:** Tribal Short (Expenditure Details page), Tribal Long (Expenditure Details page)

**Fix (Option 1):** Added an `Alert` component with `when: "empty($applicableTopics)"`
as the first child of the Expenditure Details `Stack` in both component files.
Displays "Select expenditure categories on the previous page to see expenditure
detail fields here." when no categories are selected.

**Files changed:**
- `examples/grant-report/tribal-short.component.json`
- `examples/grant-report/tribal-long.component.json`

---

### B4 · Grant App: theme intro pages create empty navigation steps ✓ RESOLVED

**Severity:** Minor UX
**Affected:** Grant Application

**Decision (2026-03-09):** Option 3 — accepted as intentional section dividers. These
wrapper pages provide context and orientation before each major section of the grant
application. No code change needed.

---

## Track C: Clinical Intake Fixture & Constraint Fixes ✓

Owner: example/fixture author — `examples/clinical-intake/`

### C1 · Pre-populated data fails its own validation constraints ✓ RESOLVED

**Severity:** Bug
**Affected:** Clinical Intake (and all other example forms with email constraints)

**Root cause:** Double-escaped backslashes in JSON constraint regexes. The FEL
interpreter's `literal()` method does not process backslash escape sequences —
it returns raw content between quotes. So `'^[^@\\\\s]+@...'` in JSON becomes
`^[^@\\s]+@...` after JSON parse, but FEL passes the two-backslash sequence to
`new RegExp()`, which interprets `\\s` as literal backslash + `s` instead of
the whitespace character class.

**Fix:** Rewrote all constraint regexes to use character class syntax that avoids
backslash escapes:
- **Phone:** `'^[(][2-9][0-9]{2}[)] [2-9][0-9]{2}-[0-9]{4}$'` (uses `[(]`/`[)]` for literal parens, `[0-9]` for `\d`)
- **Email:** `'^[^@ ]+@[^@ .]+[.][^@ ]+$'` (explicit space exclusion, `[.]` for literal dot)

**Files changed:**
- `examples/clinical-intake/intake.definition.json` — phone + email constraints
- `examples/invoice/invoice.definition.json` — email constraint
- `examples/grant-application/definition.json` — email constraint
- `examples/grant-report/tribal-long.definition.json` — email constraint
- `examples/grant-report/tribal-short.definition.json` — email constraint
- `examples/grant-report/tribal-base.definition.json` — email constraint

---

### C2 · "Loading clinic options..." dropdown never resolves ✓ RESOLVED

**Severity:** Minor
**Affected:** Clinical Intake (Current Visit page, Preferred Clinic dropdown)

**Root cause:** The component had `"placeholder": "Loading clinic options..."` as
a static placeholder — there was never any dynamic loading. The definition already
defines 5 static options for the `provider` field.

**Fix:** Changed placeholder to `"Select a clinic type"`.

**Files changed:**
- `examples/clinical-intake/intake.component.json`

---

## Track D: Grant App Instance Source ✓

Owner: example/infra — `examples/grant-application/`

### D1 · `priorYearData` instance source CORS error ✓ RESOLVED

**Severity:** Minor
**Affected:** Grant Application

**Root cause:** The `source` field pointed to `http://localhost:8000/api/prior-year-data`.
The engine's `.catch()` handler suppresses the JS exception, but cannot suppress
the browser's network-layer CORS console errors.

**Fix (Option 1):** Removed the `source` and `static` fields. The inline `data`
object (`priorAwardAmount: 250000`, `performanceRating: "satisfactory"`) was
already present and sufficient. Added `readonly: true` for consistency.

**Files changed:**
- `examples/grant-application/definition.json`
- `examples/grant-application/README.md`

---

## Track E: E2E Test Coverage ✓

Owner: test author — `tests/e2e/playwright/`

### E1 · Invoice form E2E tests ✓ RESOLVED

**Tests:** `tests/e2e/playwright/smoke/invoice.spec.ts` — 20 tests across 5 groups:
smoke, repeat groups (add/remove/renumbering), calculations (line total, subtotal,
grand total, tax, discount), validation (required fields, constraints),
response contract.

**Helper:** `tests/e2e/playwright/helpers/invoice.ts`

**Notable findings:** 1-based external paths in validation reports (`lineItems[0]`
internally → `lineItems[1]` in reports). Email constraint double-escape bug
(same as C1, fixed separately).

---

### E2 · Clinical Intake E2E tests ✓ RESOLVED

**Tests:** `tests/e2e/playwright/clinical-intake.spec.ts` — 72 tests across 8 groups:
screener (9), instance pre-population (11), read-only fields (7), wizard
navigation (10), computed fields (12), conditional visibility (5),
validation (10), response contract (4), nested repeats (3).

**Helper:** `tests/e2e/playwright/helpers/clinical-intake.ts`

**Notable findings:** `maskedInsuranceId` substring indexing produces `"****567"`
not `"****4567"`. Submit button triggers `focusField()` which navigates wizard
away from summary page.

---

### E3 · Tribal Long E2E tests ✓ RESOLVED

**Tests:** `tests/e2e/playwright/grant-report/tribal-long.spec.ts` — 23 tests across
6 groups: smoke (3), wizard navigation (3), expenditure category relevance (3),
expenditure details page with B3 hint (4), demographics grid auto-calculation (4),
shape constraints (5), expenditure total calculation (1).

**Helper:** Extended `tests/e2e/playwright/helpers/grant-report.ts` with
`loadTribalLongArtifacts()` and `mountTribalLong()`.

**Notable findings:** Back button class is `formspec-wizard-prev` (not `formspec-wizard-back`).
Money total returns `{amount, currency}` object from `moneySum`.

---

## Track F: Consolidate Smoke Test Scripts ✓

Owner: test infrastructure — `tests/e2e/`

### F1–F4 · Smoke test infrastructure ✓ RESOLVED

All 5 scripts migrated from `tmp-smoke-tests/` to `tests/e2e/smoke/` with
7 shared helper modules and a parallel runner.

**Files created:**

```
tests/e2e/smoke/
├── references.config.ts
├── run-all.mjs
├── lib/
│   ├── browser.mjs
│   ├── screenshots.mjs
│   ├── engine-helpers.mjs
│   ├── wizard-nav.mjs
│   ├── screener.mjs
│   └── errors.mjs
├── grant-application.smoke.mjs
├── tribal-short.smoke.mjs
├── tribal-long.smoke.mjs
├── invoice.smoke.mjs
└── clinical-intake.smoke.mjs
```

**npm script:** `"test:smoke": "node tests/e2e/smoke/run-all.mjs"`

### F5 · Gitignore and cleanup ✓ RESOLVED

- `tests/e2e/smoke/screenshots/` added to `.gitignore`
- `tmp-smoke-tests/` left in place for manual cleanup after verification

---

## Summary

| Track | Items | New Tests | Status |
|-------|-------|-----------|--------|
| A — FEL Engine | A1: `let...in` parser, A2: `date("")` guard | 13 | ✓ |
| B — Wizard UX | B1: soft validation, B2: banner gate, B3: empty page hints, B4: documented | 10 | ✓ |
| C — Clinical Fixtures | C1: regex escaping (6 files), C2: placeholder text | — | ✓ |
| D — Grant App | D1: inline instance data | — | ✓ |
| E — E2E Tests | E1: invoice (20), E2: clinical (72), E3: tribal-long (23) | 115 | ✓ |
| F — Smoke Infra | F1–F5: 13 files, shared libs, runner, npm script | — | ✓ |
| **Total** | **19 items** | **138 tests** | **All resolved** |
