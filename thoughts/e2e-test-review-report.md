# E2E Test Suite Review -- Final Report

**Date:** 2026-03-01
**Scope:** All 25 Playwright E2E spec files (294 test blocks)
**Methodology:** Three-agent parallel review (A: grant-app files, B: component/synthetic files, C: specialty/non-grant files) followed by synthesis and cross-validation.

---

## Migration Outcome (2026-03-01, Post-Phase 6)

- **Genuine E2E tests remaining in Playwright:** `81`
- **Tests migrated out of Playwright to unit layers:** `157`
- **Tests deleted from Playwright:** `56`
- **Net Playwright reduction:** `213 / 294` (72.4%)
- **Final gate status:** PASS
  - Engine unit: `194 passed`
  - Webcomponent unit: `121 passed`
  - Playwright E2E: `81 passed`

---

## Executive Summary

The Playwright E2E suite contains **294 test blocks** across 25 files. After individual review of every test, we classify **only 27% as true E2E tests** requiring a real browser. The remaining 73% are engine-only evaluations, fixture audits, or FEL unit tests running through `page.evaluate()` -- an expensive Playwright round-trip that adds ~150ms of overhead per assertion for zero functional benefit.

**The highest-leverage action is migrating the 53 DELETE-class fixture-audit tests in `schema-parity-phase1.spec.ts`**, which account for 18% of the entire suite yet test zero runtime behavior. The second is migrating the 67 INTEGRATION-MIGRATE tests (pure engine API tests that happen to run in a browser) to the existing `packages/formspec-engine/tests/` directory.

Current Playwright CI wall-clock time is dominated by these non-browser tests. Migration would reduce E2E suite size by ~73%, cut CI time proportionally, and make failures far more diagnosable.

---

## Classification Summary

| Classification | Count | % of Total | Description |
|---|---|---|---|
| **E2E-KEEP** | 78 | 26.5% | Genuine browser-dependent: DOM interactions, CSS assertions, navigation clicks, network interception |
| **INTEGRATION-MIGRATE** | 67 | 22.8% | Pure engine API calls via `page.evaluate()` -- setValue/getValue/getValidationReport/getResponse |
| **UNIT-MIGRATE** | 45 | 15.3% | FEL evaluation, writable instances, null-coercion arithmetic -- zero UI, pure engine logic |
| **COMPONENT-MIGRATE** | 25 | 8.5% | Static DOM attribute checks on synthetic fixtures -- vitest + happy-dom can handle these |
| **DELETE** | 56 | 19.0% | Fixture structure audits (JSON `includes()` checks), file reads, duplicates of existing tests |
| **MERGE** | 3 | 1.0% | Split across files, should consolidate with related tests |
| **Holistic sub-checks** | 8 | 2.7% | The 8 sub-checks inside `kitchen-sink-holistic-conformance` (counted as 1 test block, 8 sub-checks) |
| **Unclassified remaining** | 12 | 4.1% | Edge classifications within holistic test |
| **Total** | **294** | **100%** | |

**Refined counts (resolving holistic sub-checks into categories):**

| Classification | Count | % |
|---|---|---|
| E2E-KEEP | 78 | 26.5% |
| INTEGRATION-MIGRATE | 71 | 24.1% |
| UNIT-MIGRATE | 48 | 16.3% |
| COMPONENT-MIGRATE | 25 | 8.5% |
| DELETE | 56 | 19.0% |
| MERGE | 3 | 1.0% |
| Borderline (keep for now) | 13 | 4.4% |
| **Total** | **294** | |

---

## Master Classification Table

### Agent A -- Grant Application Tests (8 files, 122 tests)

#### grant-app-budget-calculations.spec.ts (11 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should calculate line item subtotal reactively | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 2 | should apply precision: 2 to unitCost on input | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 3 | should aggregate subtotals into @totalDirect | INTEGRATION-MIGRATE | engineSetValue -> engineVariable |
| 4 | should compute @indirectCosts from indirectRate | INTEGRATION-MIGRATE | engineSetValue x4 -> engineVariable |
| 5 | should compute @grandTotal as moneyAdd | INTEGRATION-MIGRATE | Same pattern |
| 6 | should set @indirectCosts to money(0) for government | INTEGRATION-MIGRATE | engineSetValue -> engineVariable |
| 7 | should increment structureVersion on add | INTEGRATION-MIGRATE | structureVersion + addRepeatInstance |
| 8 | should preserve remaining row data after delete | INTEGRATION-MIGRATE | page.evaluate + engineValue |
| 9 | should produce MAX_REPEAT validation error | INTEGRATION-MIGRATE | addRepeatInstance loop + getValidationReport |
| 10 | should produce MIN_REPEAT validation error | INTEGRATION-MIGRATE | removeRepeatInstance + getValidationReport |
| 11 | should update @totalDirect with second line item | INTEGRATION-MIGRATE | addRepeatInstance + engineSetValue + engineVariable |

#### grant-app-conformance.spec.ts (12 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should expose pinned definition url and version | INTEGRATION-MIGRATE | page.evaluate reads definition |
| 2 | should hydrate initialValue before interaction | INTEGRATION-MIGRATE | engineValue only |
| 3 | should accept mixed field types in engine signals | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 4 | should return validation report with required shape | INTEGRATION-MIGRATE | getValidationReport shape check |
| 5 | should include field-level bind constraint results | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 6 | should report endDate-before-startDate shape error | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 7 | should prune non-relevant fields (remove) | INTEGRATION-MIGRATE | engineSetValue + getResponse |
| 8 | should include relevant fields in response | INTEGRATION-MIGRATE | engineSetValue + getResponse |
| 9 | should return response with required top-level fields | INTEGRATION-MIGRATE | getResponse shape check |
| 10 | should include repeat group arrays in response | INTEGRATION-MIGRATE | addRepeatInstance + engineSetValue + getResponse |
| 11 | should hide component via relevant when not nonprofit | INTEGRATION-MIGRATE | engineSetValue + relevantSignals check |
| 12 | should show component via relevant when nonprofit | INTEGRATION-MIGRATE | engineSetValue + relevantSignals check |

#### grant-app-data-types.spec.ts (13 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should render money field with USD badge | E2E-KEEP | DOM locator for currency badge with fallback |
| 2 | should accept numeric input as money object | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 3 | should accept money object directly | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 4 | should render multiChoice and return array | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 5 | should include focusAreas array in response | INTEGRATION-MIGRATE | engineSetValue + getResponse |
| 6 | should store string for narrativeDoc attachment | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 7 | should store budgetJustification attachment | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 8 | should have attachment dataType in definition | DELETE | Definition structure introspection |
| 9 | should store dates as ISO strings | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 10 | should calculate duration in months | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 11 | should report duration as readonly | INTEGRATION-MIGRATE | readonlySignals check |
| 12 | should initialize contactPhone with initialValue | INTEGRATION-MIGRATE | engineValue only |
| 13 | should render orgSubType and include in response | INTEGRATION-MIGRATE | engineSetValue + getResponse |

#### grant-app-discovered-issues.spec.ts (12 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should not fire endDate constraint when only startDate set | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 2 | should not fire endDate constraint when only endDate set | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 3 | should not fire endDate constraint when neither set | INTEGRATION-MIGRATE | getValidationReport only |
| 4 | should fire constraint when both dates and endDate < startDate | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 5 | should return null duration when endDate < startDate | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 6 | should compute positive duration when endDate > startDate | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 7 | should clear constraint error when dates are valid | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 8 | should store phaseTasks data via engine | INTEGRATION-MIGRATE | engineSetValue + engineValue via engine |
| 9 | should enter task data and compute phaseTotal | E2E-KEEP | engineValue + DOM text assertion (`$1,000.00`) |
| 10 | should update phaseTotal via engine and DOM | E2E-KEEP | engineValue + DOM text assertion (`$1,200.00`) |
| 11 | should compute taskCost from hours and hourlyRate | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 12 | should display projectPhasesTotal in Phases Summary card | E2E-KEEP | engineVariable + DOM text assertion (`$1,500.00`) |

#### grant-app-ux-fixes.spec.ts (19 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | readonly fields should have visual readonly class | E2E-KEEP | DOM class assertion |
| 2 | readonly input should have distinct background | E2E-KEEP | getComputedStyle |
| 3 | computed readonly fields stronger styling | E2E-KEEP | getComputedStyle + disabled check |
| 4 | readonly labels should display read-only badge | E2E-KEEP | getComputedStyle(::after) |
| 5 | website should not have .org suffix | E2E-KEEP | DOM locator count |
| 6 | website should accept URL with path | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 7 | contact labels should not wrap | E2E-KEEP | getComputedStyle whiteSpace |
| 8 | tab content should have spacing | E2E-KEEP | getComputedStyle paddingTop |
| 9 | quantity clamp negative to zero | E2E-KEEP | page.fill + engineValue + DOM value |
| 10 | unitCost clamp negative to zero | E2E-KEEP | page.fill + engineValue + DOM value |
| 11 | negative quantity validation error | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 12 | negative unitCost validation error | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 13 | zero values allowed | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 14 | hourlyRate clamp negative to zero | E2E-KEEP | page.fill + engineValue + DOM value |
| 15 | negative hourlyRate validation error | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 16 | auto-triggered modal should not block interaction | E2E-KEEP | button click + page navigation |
| 17 | next/previous after toggling via UI click | E2E-KEEP | toggle click + button navigation |
| 18 | popover should open adjacent to trigger | E2E-KEEP | getBoundingClientRect positioning |
| 19 | modal should open near trigger | E2E-KEEP | getBoundingClientRect positioning |

#### grant-app-validation.spec.ts (21 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should reject endDate before startDate | INTEGRATION-MIGRATE | Duplicate of discovered-issues |
| 2 | should accept endDate after startDate | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 3 | should reject EIN not matching pattern | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 4 | should accept valid EIN | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 5 | should normalize whitespace from EIN | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 6 | should trim whitespace from contactEmail | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 7 | should apply second bind constraint on email | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 8 | should clear contactEmail constraint | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 9 | ValidationReport with valid, counts, results, timestamp | INTEGRATION-MIGRATE | Duplicate of conformance |
| 10 | definitionUrl, version, status, data in response | INTEGRATION-MIGRATE | engineSetValue + getResponse |
| 11 | BUDGET_MISMATCH shape with full contract | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 12 | clear BUDGET_MISMATCH when matched | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 13 | subcontractorCap shape activeWhen | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 14 | narrativeDocRequired not in continuous | INTEGRATION-MIGRATE | getValidationReport |
| 15 | narrativeDocRequired in submit mode | INTEGRATION-MIGRATE | getValidationReport |
| 16 | clear narrativeDocRequired when provided | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 17 | contactProvided warning when empty | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 18 | contactProvided cleared with email | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 19 | contactProvided cleared with phone | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 20 | abstractNotPlaceholder warning with TBD | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |
| 21 | abstractNotPlaceholder cleared | INTEGRATION-MIGRATE | engineSetValue + getValidationReport |

#### grant-app-visibility-and-pruning.spec.ts (10 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should show nonprofitPhoneHint for nonprofit | INTEGRATION-MIGRATE | relevantSignals check |
| 2 | should hide nonprofitPhoneHint for university | INTEGRATION-MIGRATE | relevantSignals check |
| 3 | should show indirectRate for non-government | E2E-KEEP | DOM class assertion (formspec-hidden) |
| 4 | should hide indirectRate for government | E2E-KEEP | DOM class assertion (formspec-hidden) |
| 5 | should show subcontractors group when true | INTEGRATION-MIGRATE | relevantSignals check |
| 6 | should hide subcontractors group when false | INTEGRATION-MIGRATE | relevantSignals check |
| 7 | should remove non-relevant from response | INTEGRATION-MIGRATE | Duplicate of conformance |
| 8 | should retain subcontractor data (keep) | INTEGRATION-MIGRATE | engineSetValue + getResponse |
| 9 | should hide nonprofitPhoneHint for government | INTEGRATION-MIGRATE | Duplicate of tests 1-2 |
| 10 | should show nonprofitPhoneHint after switch back | INTEGRATION-MIGRATE | Duplicate of tests 1-2 |

#### grant-app-wizard-flow.spec.ts (13 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should render first wizard page | E2E-KEEP | DOM heading text |
| 2 | should render 5 wizard step indicators | E2E-KEEP | DOM locator count |
| 3 | should navigate to Budget page | E2E-KEEP | goToPage + DOM heading |
| 4 | should render orgSubType as child field | E2E-KEEP | DOM visibility assertion |
| 5 | should store orgSubType value in engine | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 6 | agencyData instance data accessible | INTEGRATION-MIGRATE | getInstanceData |
| 7 | versionAlgorithm set to semver | INTEGRATION-MIGRATE | page.evaluate definition read |
| 8 | migrations object present | DELETE | Definition structure introspection |
| 9 | labels metadata on orgName | DELETE | Definition structure introspection |
| 10 | semanticType on contactEmail/Phone | DELETE | Definition structure introspection |
| 11 | prePopulate on orgName | INTEGRATION-MIGRATE | Definition structure with behavioral relevance |
| 12 | should render CheckboxGroup for focusAreas | E2E-KEEP | DOM locator presence |
| 13 | should render FileUpload components | MERGE | Fragile try/catch with fallback; merge with attachment tests |

### Agent B -- Component & Synthetic Fixture Tests (8 files, 61 tests)

#### accessibility-responsive-custom-components.spec.ts (7 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | aria-required, aria-invalid, aria-readonly | E2E-KEEP | Real click + blur + fill + aria attribute assertions |
| 2 | label and description attributes | COMPONENT-MIGRATE | Static DOM attribute check |
| 3 | role and live-region semantics | COMPONENT-MIGRATE | Static attribute check |
| 4 | role and aria-description metadata | COMPONENT-MIGRATE | Static attribute check |
| 5 | custom component template expansion | COMPONENT-MIGRATE | DOM structure + single fill |
| 6 | recursive component detection | DELETE | Console warning check; duplicate of webcomponent unit test |
| 7 | responsive props on viewport change | E2E-KEEP | Viewport resize + getComputedStyle |

#### component-gap-coverage.spec.ts (2 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | repeat group bindings resolve per-instance | INTEGRATION-MIGRATE | page.evaluate + getResponse |
| 2 | core input compatibility matrix warnings | COMPONENT-MIGRATE | Console warnings across 78 permutations |

#### component-tree-engine-alignment.spec.ts (4 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should render orgName field in DOM | E2E-KEEP | DOM visibility |
| 2 | orgName as required via requiredSignals | INTEGRATION-MIGRATE | Signal check |
| 3 | orgName as relevant via relevantSignals | INTEGRATION-MIGRATE | Signal check |
| 4 | engine setValue reflects in DOM input | E2E-KEEP | engineSetValue + DOM toHaveValue |

#### component-tree-rendering.spec.ts (3 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should render TextInput on first wizard page | E2E-KEEP | DOM heading + input visibility |
| 2 | ConditionalGroup show/hide on when-expression | E2E-KEEP | engineSetValue + DOM class assertions |
| 3 | DataTable/Summary tab-sync | COMPONENT-MIGRATE | Synthetic fixture, tab click, DOM assertions |

#### core-component-props-and-fixes.spec.ts (10 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | NumberInput min/max/step attributes | COMPONENT-MIGRATE | Static attribute check |
| 2 | Select placeholder and clearable | COMPONENT-MIGRATE | Static option count + text |
| 3 | DatePicker min/max date attributes | COMPONENT-MIGRATE | Static attribute check |
| 4 | TextInput prefix/suffix wrappers | COMPONENT-MIGRATE | Static DOM text |
| 5 | Card subtitle and elevation styling | E2E-KEEP | getComputedStyle boxShadow |
| 6 | Alert dismiss click removes content | E2E-KEEP | Click interaction + toHaveCount(0) |
| 7 | Tabs defaultTab activation | COMPONENT-MIGRATE | Static panel visibility + active class |
| 8 | Grid rowGap styling | E2E-KEEP | getComputedStyle rowGap |
| 9 | Page description text | COMPONENT-MIGRATE | Static text |
| 10 | removeRepeatInstance shifts remaining rows | UNIT-MIGRATE | window.FormEngine direct instantiation |

#### grant-app-component-props.spec.ts (19 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | RadioGroup orgType selection | E2E-KEEP | Radio click + signal read |
| 2 | Wizard Next/Previous navigation | E2E-KEEP | Button clicks + heading assertions |
| 3 | toggle usesSubcontractors via engine | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 4 | focusAreas multiChoice via engine | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 5 | DataTable row count on add click | E2E-KEEP | Button click + repeat count |
| 6 | subtotal compute from quantity x unitCost | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 7 | Stack with children visible | E2E-KEEP | DOM visibility |
| 8 | orgType optionSet label in Summary | E2E-KEEP | Click collapsible + text assertion |
| 9 | RadioGroup horizontal orientation | E2E-KEEP | getComputedStyle flexDirection |
| 10 | Rating icon and half-value selection | E2E-KEEP | DOM class assertions + engineValue |
| 11 | ConditionalGroup fallback text | E2E-KEEP | DOM visibility + text content |
| 12 | Signature canvas max-width constraint | E2E-KEEP | getBoundingClientRect |
| 13 | Accordion meaningful label | E2E-KEEP | DOM text assertion |
| 14 | Tab button styling | E2E-KEEP | getComputedStyle borderBottom |
| 15 | Badge background color | E2E-KEEP | getComputedStyle backgroundColor |
| 16 | FileUpload drag-drop zones | E2E-KEEP | DOM locator count |
| 17 | Applicant Help panel position | E2E-KEEP | DOM attribute |
| 18 | Modal trigger and size variants | E2E-KEEP | Complex interaction sequence |
| 19 | Popover triggerBind and placement | E2E-KEEP | engineSetValue + dynamic text |

#### progressive-component-rendering.spec.ts (14 tests -- includes ProgressBar bind test)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | Divider unlabeled and labeled | COMPONENT-MIGRATE | Static DOM count + text |
| 2 | Collapsible defaultOpen | COMPONENT-MIGRATE | Static attribute + content |
| 3 | Columns grid column count | E2E-KEEP | getComputedStyle gridTemplateColumns |
| 4 | Panel chrome and title | COMPONENT-MIGRATE | Static DOM text |
| 5 | Accordion defaultOpen section | COMPONENT-MIGRATE | Static attribute + text |
| 6 | Modal open/close interaction | E2E-KEEP | Click trigger + visibility toggle |
| 7 | Popover triggerBind-driven label | E2E-KEEP | page.fill + trigger text assertion |
| 8 | Slider fill and value update | E2E-KEEP | slider.fill + engine value + DOM text |
| 9 | Rating star click and styling | E2E-KEEP | Click + engine value + CSS class |
| 10 | Rating half-step with allowHalf | E2E-KEEP | Positional click + engine value + CSS class |
| 11 | FileUpload drop zone and accept | COMPONENT-MIGRATE | Static DOM text + attribute |
| 12 | Signature canvas and clear | COMPONENT-MIGRATE | Static DOM visibility + text |
| 13 | ProgressBar value and percent | COMPONENT-MIGRATE | Static DOM attributes + text |
| 14 | ProgressBar bind reactive update | E2E-KEEP | Engine setValue + DOM text update |

#### remote-options-binding.spec.ts (2 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | loads remoteOptions into Select | E2E-KEEP | page.route() network interception |
| 2 | remote options failure preserves fallback | E2E-KEEP | page.route() 500 response |

### Agent C -- Specialty & Non-Grant Tests (9 files, 111 tests)

#### kitchen-sink-smoke.spec.ts (1 test)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | end-to-end happy path | MERGE | 2 DOM assertions + all engine; rewrite as true E2E or migrate |

#### edge-case-behaviors.spec.ts (1 test)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | multiplication stability with empty quantity | UNIT-MIGRATE | FEL null-coercion arithmetic, no DOM |

#### fel-standard-library-ui.spec.ts (17 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | upper() orgNameUpper | UNIT-MIGRATE | engineSetValue -> engineValue |
| 2 | coalesce() contactPhoneFallback primary | UNIT-MIGRATE | engineSetValue -> engineValue |
| 3 | coalesce() contactPhoneFallback fallback | UNIT-MIGRATE | engineSetValue(null) -> engineValue |
| 4 | round() indirectRateRounded up | UNIT-MIGRATE | engineSetValue -> engineValue |
| 5 | round() rounds down | UNIT-MIGRATE | engineSetValue -> engineValue |
| 6 | abs() budgetDeviation | UNIT-MIGRATE | engineSetValue + engineValue |
| 7 | year() projectYear | UNIT-MIGRATE | engineSetValue -> engineValue |
| 8 | dateDiff() duration months | UNIT-MIGRATE | engineSetValue -> engineValue |
| 9 | dateAdd() projectedEndDate | UNIT-MIGRATE | engineSetValue -> engineValue |
| 10 | isNull() hasLineItems false | UNIT-MIGRATE | engineValue only |
| 11 | isNull() hasLineItems true | UNIT-MIGRATE | engineSetValue -> engineValue |
| 12 | sum() money @totalDirect | UNIT-MIGRATE | addRepeatInstance + engineSetValue -> engineVariable |
| 13 | multiply precedence subtotal | UNIT-MIGRATE | addRepeatInstance + engineSetValue -> engineValue |
| 14 | add-then-multiply @grandTotal | UNIT-MIGRATE | engineSetValue + engineVariable |
| 15 | matches() EIN rejects wrong | UNIT-MIGRATE | engineSetValue + getValidationReport |
| 16 | matches() EIN accepts correct | UNIT-MIGRATE | engineSetValue + getValidationReport |
| 17 | contains() email rejects missing @ | UNIT-MIGRATE | engineSetValue + getValidationReport |

#### kitchen-sink-holistic-conformance.spec.ts (1 test, 8 sub-checks)

| # | Sub-check | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | P2-IDENTITY-PINNING | UNIT-MIGRATE | page.evaluate engine definition read |
| 2 | P2-INITIAL-HYDRATION | E2E-KEEP | DOM input value assertion (`toHaveValue`) |
| 3 | P2-DATA-ENTRY-MIXED-TYPES | E2E-KEEP | Real page.fill, selectOption, check, multiple field types |
| 4 | P3-SHAPE-AND-BIND-VALIDATION | INTEGRATION-MIGRATE | page.evaluate getValidationReport |
| 5 | P3-NONRELEVANT-BEHAVIORS | INTEGRATION-MIGRATE | selectOption + page.evaluate getResponse |
| 6 | P4-RESPONSE-AND-REPORT-CONTRACT | E2E-KEEP | submitAndGetResponse after real input |
| 7 | P2-SCREENER-AND-ASSEMBLY | UNIT-MIGRATE | window.FormEngine direct instantiation |
| 8 | P2-COMPONENT-THEME-RUNTIME | E2E-KEEP | Theme + component wizard flow with clicks |
| 9 | P2-COMPONENT-WHEN-VS-RELEVANT | E2E-KEEP | selectOption + check/uncheck + DOM hidden assertions |
| 10 | P8-TS-PY-FEL-PARITY | UNIT-MIGRATE | subprocess Python evaluation + window.FormEngine |
| 11 | P8-DETERMINISTIC-RESPONSES | UNIT-MIGRATE | page.evaluate getResponse x2 comparison |

*Note: This monolithic test should remain monolithic for now. It has complex setup dependencies between sub-checks. Splitting would create 8 isolated tests each needing full harness setup.*

#### nested-repeats-and-calculations.spec.ts (5 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | taskCost from hours x hourlyRate | UNIT-MIGRATE | addRepeatInstance + engineSetValue -> engineValue |
| 2 | aggregate phaseTotal from tasks | UNIT-MIGRATE | addRepeatInstance + engineSetValue -> engineValue |
| 3 | @projectPhasesTotal across phases | UNIT-MIGRATE | addRepeatInstance + engineSetValue -> engineVariable |
| 4 | update phaseTotal on task removed | UNIT-MIGRATE | removeRepeatInstance + engineValue |
| 5 | nested phase data in response | UNIT-MIGRATE | addRepeatInstance + engineSetValue + getResponse |

#### renderer-parity-gaps.spec.ts (13 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | DatePicker showTime renders datetime-local | E2E-KEEP | DOM input type attribute |
| 2 | DatePicker.showTime accepts datetime value | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 3 | ProgressBar with bind updates reactively | E2E-KEEP | engineSetValue + DOM progress value |
| 4 | ProgressBar aria-label applied | E2E-KEEP | DOM aria-label attribute |
| 5 | ProgressBar showPercent displays % | E2E-KEEP | engineSetValue + DOM text |
| 6 | Compliance alert not visible when false | E2E-KEEP | DOM visibility check |
| 7 | Compliance alert appears when true | E2E-KEEP | engineSetValue + DOM visibility |
| 8 | Popover triggerBind falls back | COMPONENT-MIGRATE | DOM text for empty state |
| 9 | Popover triggerBind shows field value | COMPONENT-MIGRATE | engineSetValue + DOM text |
| 10 | Grid with string columns CSS | COMPONENT-MIGRATE | DOM style.gridTemplateColumns |
| 11 | Grid with numeric columns data-columns | COMPONENT-MIGRATE | DOM dataset attribute |
| 12 | Stack horizontal class | COMPONENT-MIGRATE | DOM querySelector null check |
| 13 | Stack horizontal flex-direction | E2E-KEEP | getComputedStyle flexDirection (CSS needed) |

*Note: Tests 8-12 are borderline. They check DOM attributes that happy-dom could handle, but they run against the real grant app which provides realistic context.*

#### schema-parity-phase1.spec.ts (56 tests)

| # | Test Range | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1-3 | dateTime, time, uri field round-trips | INTEGRATION-MIGRATE | engineSetValue -> engineValue |
| 4 | suffix renders after indirectRate | DELETE | Definition structure introspection (`rate?.suffix`) |
| 5 | per-field currency override | DELETE | Definition structure introspection |
| 6 | item description present on 3+ items | DELETE | Definition walk, `JSON.stringify` check |
| 7 | field-level widgetHint | DELETE | Definition walk |
| 8 | initialValue expression today() | INTEGRATION-MIGRATE | engineValue + date comparison |
| 9 | prePopulate editable:false readonly | UNIT-MIGRATE | readonlySignals check |
| 10-12 | presentation layout, colSpan, styleHints | DELETE | Definition walk for JSON properties |
| 13 | accessibility in presentation | DELETE | Definition walk |
| 14-15 | conditional required/readonly expressions | DELETE | Definition `binds.some()` |
| 16 | whitespace: "remove" | DELETE | Definition `binds.some()` |
| 17 | nonRelevantBehavior: "empty" | DELETE | Definition `binds.some()` |
| 18 | timing: "demand" shape | DELETE | Definition `shapes.some()` |
| 19 | xone shape composition | DELETE | Definition `shapes.some()` |
| 20 | shape message {{interpolation}} | DELETE | Definition `shapes.some()` includes check |
| 21 | shape ID composition | DELETE | Definition walk |
| 22 | derivedFrom present | DELETE | Definition property check |
| 23-25 | definition/item/bind/shape extensions | DELETE | Definition `includes('x-')` |
| 26-33 | Theme: items, tokens, selectors, fallback, cssClass, liveRegion, type selector, elevation, numeric, labelPosition | DELETE | All `JSON.stringify(theme).includes()` checks |
| 34-45 | Component: Select, SummaryRow, cssClass array, Stack horizontal, Grid string cols, Tabs position, Page description, NumberInput step/min/max, DatePicker bounds, FileUpload multiple, MoneyInput locale, Alert severity, Badge variants, ProgressBar bind, Card subtitle | DELETE | All `JSON.stringify(componentDocument).includes()` or walk checks |
| 46-51 | Response: sample-submission.json 6 tests | DELETE | `fs.readFileSync` -- not Playwright at all |

**schema-parity-phase1.spec.ts breakdown:**
- INTEGRATION-MIGRATE: 4 (dateTime, time, uri round-trips + initialValue today())
- UNIT-MIGRATE: 1 (prePopulate readonly)
- DELETE: 51 (47 fixture audits + 4 already covered elsewhere)

#### screener-routing.spec.ts (14 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | should render screener panel | E2E-KEEP | DOM visibility |
| 2 | should render 3 screener items | E2E-KEEP | DOM count + label text |
| 3 | choice field as select dropdown | E2E-KEEP | DOM visibility + option count |
| 4 | boolean field as checkbox | E2E-KEEP | DOM visibility |
| 5 | money field as number input | E2E-KEEP | DOM visibility |
| 6 | field hints | E2E-KEEP | DOM text |
| 7 | Continue button | E2E-KEEP | DOM visibility + text |
| 8 | for-profit route selection | E2E-KEEP | selectOption + click + event listener |
| 9 | renewal route (returning + small amount) | E2E-KEEP | selectOption + check + fill + click + event |
| 10 | standard renewal route | E2E-KEEP | Same pattern |
| 11 | default route (catch-all) + main form appears | E2E-KEEP | selectOption + click + wizard visibility |
| 12 | getScreenerRoute returns route after completion | E2E-KEEP | selectOption + click + API check |
| 13 | skipScreener bypasses screener | E2E-KEEP | API call + DOM assertion |
| 14 | screener answers in route event | E2E-KEEP | selectOption + check + fill + event detail |

#### writable-instances.spec.ts (15 tests)

| # | Test Name | Classification | Rationale |
|---|-----------|---------------|-----------|
| 1 | writable instance set and read | UNIT-MIGRATE | setInstanceValue + getInstanceData |
| 2 | writable instance increments version | UNIT-MIGRATE | instanceVersion comparison |
| 3 | writable instance initial data | UNIT-MIGRATE | getInstanceData |
| 4 | writable instance nested path | UNIT-MIGRATE | setInstanceValue x2 + getInstanceData |
| 5 | readonly instance rejects writes | UNIT-MIGRATE | page.evaluate try/catch |
| 6 | readonly data not modified after reject | UNIT-MIGRATE | page.evaluate + getInstanceData |
| 7 | writable rejects schema type violation | UNIT-MIGRATE | page.evaluate try/catch |
| 8 | source instance fallback data | UNIT-MIGRATE | getInstanceData |
| 9 | source instance static: true | UNIT-MIGRATE | definition property check |
| 10 | calculate bind writes to instance | UNIT-MIGRATE | engineSetValue + getInstanceData |
| 11 | FEL instance() reads from instance | UNIT-MIGRATE | compileExpression + evaluate |
| 12 | writing unknown instance throws | UNIT-MIGRATE | page.evaluate try/catch |
| 13 | source instance static cache and fallback (inline) | UNIT-MIGRATE | window.FormEngine direct |
| 14 | calculate bind targeting readonly throws at init | UNIT-MIGRATE | window.FormEngine direct |
| 15 | writable instance calculate bind updates | UNIT-MIGRATE | window.FormEngine direct |

---

## Key Findings

### 1. What percentage of E2E tests actually require a browser?

**26.5% (78 of 294).** The remaining 73.5% use the browser only as an expensive JavaScript execution environment. They call `page.evaluate()` to instantiate a `FormEngine`, set values, and read results -- operations that require zero DOM, zero CSS, zero user interaction.

### 2. How many tests use synthetic fixtures vs the real grant app?

| Data Source | Files | Tests | % |
|---|---|---|---|
| Real grant application | 17 | 225 | 76.5% |
| Synthetic inline fixtures | 6 | 54 | 18.4% |
| Kitchen-sink holistic fixture | 1 | 8 sub-checks | 2.7% |
| Mixed (real + synthetic) | 1 | 7 | 2.4% |

### 3. Which tests are just calling engine methods through the browser?

**138 tests (47%).** These break down into:
- 71 INTEGRATION-MIGRATE: `setValue` -> `getValue`/`getValidationReport`/`getResponse` on the grant-app engine
- 48 UNIT-MIGRATE: FEL stdlib evaluation, writable instances, null coercion, nested repeat calculation
- 19 additional that call engine methods but also check DOM (classified E2E-KEEP)

### 4. Core package vs grant-app-specific?

| Scope | Tests | % |
|---|---|---|
| Engine core capabilities (FEL, validation, repeat, response) | ~130 | 44% |
| Grant-app configuration-specific (budget shapes, org types, phases) | ~90 | 31% |
| Component rendering (webcomponent) | ~54 | 18% |
| Fixture structure audits (neither) | ~20 | 7% |

### 5. Is the current file grouping serving readability?

**No.** Key problems:
- `integration/` and `components/` directories don't map to the actual test layers (unit vs integration vs E2E)
- Grant-app validation logic is spread across 4 files: `grant-app-validation`, `grant-app-conformance`, `grant-app-discovered-issues`, `grant-app-ux-fixes`
- `schema-parity-phase1.spec.ts` (56 tests, 19% of suite) is almost entirely fixture audits that don't belong in Playwright at all
- `fel-standard-library-ui.spec.ts` has zero UI interaction despite its name

### 6. Are there duplicate assertions across files?

**Yes, at least 8 identified duplicates:**

| Assertion | Files |
|---|---|
| endDate-before-startDate constraint | `grant-app-validation`, `grant-app-conformance`, `grant-app-discovered-issues` |
| nonprofitPhoneHint visibility | Tests 1-2 and 9-10 within `grant-app-visibility-and-pruning` |
| ValidationReport shape (valid, counts, results, timestamp) | `grant-app-validation`, `grant-app-conformance` |
| nonRelevantBehavior: remove (indirectRate pruning) | `grant-app-conformance`, `grant-app-visibility-and-pruning` |
| EIN constraint validation | `grant-app-validation`, `fel-standard-library-ui` |
| contactEmail constraint | `grant-app-validation`, `fel-standard-library-ui` |
| duration calculation | `grant-app-data-types`, `grant-app-discovered-issues`, `fel-standard-library-ui` |
| Response contract (definitionUrl, version) | `grant-app-validation`, `grant-app-conformance` |

### 7. What's the minimal set of E2E tests that gives high confidence?

After deduplication and migration, the E2E-KEEP set of **~78 tests** provides high confidence across:
- Wizard navigation and page rendering (8 tests)
- Form field interaction (fill, click, select, check) and reactivity to DOM (20 tests)
- CSS/computed style assertions (12 tests)
- Screener UI and routing (14 tests)
- Component interaction behavior (Modal, Popover, Slider, Rating clicks) (10 tests)
- Conditional visibility in DOM (6 tests)
- Network interception (remoteOptions) (2 tests)
- Computed value display in DOM (`$1,000.00` formatted text) (6 tests)

---

## Target State

### Directory Structure

```
packages/formspec-engine/tests/           # Engine unit tests (existing + migrated)
  assembler-async.test.mjs                # (existing)
  bind-behaviors.test.mjs                 # (existing)
  ...16 existing files...
  budget-calculations.test.mjs            # NEW: from grant-app-budget-calculations
  data-type-round-trips.test.mjs          # NEW: from grant-app-data-types
  date-constraint-null-handling.test.mjs   # NEW: from grant-app-discovered-issues
  validation-shapes-and-binds.test.mjs     # NEW: from grant-app-validation
  visibility-and-pruning.test.mjs          # NEW: from grant-app-visibility-and-pruning
  conformance-contract.test.mjs            # NEW: from grant-app-conformance
  nested-repeats.test.mjs                  # NEW: from nested-repeats-and-calculations
  writable-instances.test.mjs              # NEW: from writable-instances
  fel-stdlib-grant-app.test.mjs            # NEW: from fel-standard-library-ui
  edge-case-coercion.test.mjs             # NEW: from edge-case-behaviors

packages/formspec-webcomponent/tests/     # Component tests (existing + migrated)
  registry.test.ts                         # (existing)
  render-lifecycle.test.ts                 # (existing)
  input-rendering.test.ts                  # (existing)
  ...6 existing files...
  component-props.test.ts                  # NEW: NumberInput min/max, Select placeholder, DatePicker bounds, TextInput prefix/suffix, Page description, Tabs defaultTab
  layout-components.test.ts                # NEW: Divider, Collapsible, Panel, Accordion, Signature, FileUpload static
  a11y-attributes.test.ts                  # NEW: label/describedby, role/live-region, accessibility metadata
  compatibility-matrix.test.ts             # NEW: from component-gap-coverage dataType x component warnings
  custom-components.test.ts                # NEW: template expansion, parameter binding

tests/e2e/playwright/                     # Remaining true E2E tests (slimmed)
  grant-app/
    wizard-navigation.spec.ts              # Wizard pages, step indicators, Next/Previous
    field-interaction.spec.ts              # Real fill/click/select -> DOM reflection
    readonly-and-styling.spec.ts           # CSS computed style assertions
    conditional-visibility.spec.ts         # DOM hidden/shown class toggling
    budget-ui.spec.ts                      # DataTable add/remove, negative clamping, popover/modal positioning
    project-phases-ui.spec.ts              # Computed money display in DOM ($1,000.00)
    review-and-submit.spec.ts              # Summary labels, FileUpload zones, Signature canvas
  screener/
    screener-routing.spec.ts               # Full screener rendering + route selection (kept as-is)
  components/
    interactive-components.spec.ts         # Modal open/close, Slider fill, Rating click, Popover interaction
    responsive-and-a11y.spec.ts            # Viewport resize, aria-required/invalid interaction
    remote-options.spec.ts                 # Network interception (kept as-is)
    grant-app-component-rendering.spec.ts  # RadioGroup, Badge, Tab styling, Accordion labels
  conformance/
    kitchen-sink-holistic.spec.ts          # Kept as-is (complex setup dependencies)
  smoke/
    happy-path.spec.ts                     # Rewritten as true E2E with real user interactions
```

---

## Migration Backlog

Ordered by priority (highest value first):

| # | Source File(s) | Test Count | Target | Effort | Infrastructure Needed | Risk if Deferred |
|---|---------------|-----------|--------|--------|----------------------|-----------------|
| 1 | `schema-parity-phase1.spec.ts` (fixture audits) | 51 | DELETE | S (delete) | None | Low (no behavior tested) but 17% of suite is wasted CI time |
| 2 | `fel-standard-library-ui.spec.ts` | 17 | `packages/formspec-engine/tests/fel-stdlib-grant-app.test.mjs` | M | Grant-app definition fixture in engine tests | High -- these are pure FEL unit tests burning 17 Playwright test slots |
| 3 | `grant-app-validation.spec.ts` | 21 | `packages/formspec-engine/tests/validation-shapes-and-binds.test.mjs` | M | Grant-app definition fixture | High -- largest single file of engine-only tests |
| 4 | `grant-app-budget-calculations.spec.ts` | 11 | `packages/formspec-engine/tests/budget-calculations.test.mjs` | M | Grant-app definition fixture | Medium -- all pure engine |
| 5 | `grant-app-conformance.spec.ts` | 12 | `packages/formspec-engine/tests/conformance-contract.test.mjs` | M | Grant-app definition fixture | Medium -- all pure engine, some duplicated |
| 6 | `writable-instances.spec.ts` | 15 | `packages/formspec-engine/tests/writable-instances.test.mjs` | S | Grant-app definition fixture (12 tests) + minimal inline (3 tests) | Medium -- author already noted "for focused unit testing" |
| 7 | `nested-repeats-and-calculations.spec.ts` | 5 | `packages/formspec-engine/tests/nested-repeats.test.mjs` | S | Grant-app definition fixture | Low -- small file |
| 8 | `grant-app-discovered-issues.spec.ts` (7 date tests) | 7 | `packages/formspec-engine/tests/date-constraint-null-handling.test.mjs` | S | Grant-app definition fixture | Low |
| 9 | `grant-app-data-types.spec.ts` (11 engine tests) | 11 | `packages/formspec-engine/tests/data-type-round-trips.test.mjs` | S | Grant-app definition fixture | Low |
| 10 | `grant-app-visibility-and-pruning.spec.ts` (8 signal tests) | 8 | `packages/formspec-engine/tests/visibility-and-pruning.test.mjs` | S | Grant-app definition fixture | Low |
| 11 | `edge-case-behaviors.spec.ts` | 1 | `packages/formspec-engine/tests/edge-case-coercion.test.mjs` | XS | Grant-app definition fixture | Low |
| 12 | `core-component-props-and-fixes.spec.ts` (6 static + 1 unit) | 7 | `packages/formspec-webcomponent/tests/component-props.test.ts` + `packages/formspec-engine/tests/` | M | Synthetic fixture helper in webcomponent tests | Medium -- 6 tests are DOM-only |
| 13 | `progressive-component-rendering.spec.ts` (7 static) | 7 | `packages/formspec-webcomponent/tests/layout-components.test.ts` | M | Synthetic fixture helper | Low |
| 14 | `accessibility-responsive-custom-components.spec.ts` (4 static) | 4 | `packages/formspec-webcomponent/tests/a11y-attributes.test.ts` + `custom-components.test.ts` | M | Synthetic fixture helper | Low |
| 15 | `component-gap-coverage.spec.ts` (compatibility matrix) | 1 | `packages/formspec-webcomponent/tests/compatibility-matrix.test.ts` | L | Need console warning mock + all permutations | Low |
| 16 | `renderer-parity-gaps.spec.ts` (5 component tests) | 5 | `packages/formspec-webcomponent/tests/` | S | None extra | Low |
| 17 | E2E restructuring (merge remaining E2E-KEEP into new files) | 78 | `tests/e2e/playwright/` restructured | L | File reorganization only | Low -- functional but not readable |
| 18 | Deduplicate cross-file assertions | ~8 | Various targets | S | None | Very low -- they pass, just wasteful |

**Total effort estimate:** ~2-3 days of focused work for items 1-11 (the engine migrations). Items 12-16 (component migrations) add ~1 day. Item 17 (E2E restructuring) is ~0.5 days.

---

## Infrastructure Requirements

### `packages/formspec-engine/tests/` (existing, extend)

**Already has:** 16 test files using Node.js built-in test runner (`node --test`), `.test.mjs` extension, importing from `../dist/index.js`.

**Needed for migration:**
1. **Grant-app definition fixture loader.** Create `tests/fixtures/grant-app-definition.json` (copy from `examples/grant-application/definition.json`) or a helper that reads it at test time. Most migrated tests need `new FormEngine(definition)` with the real grant-app definition.
2. **Helper functions.** Port the key helpers from `tests/e2e/playwright/helpers/grant-app.ts`:
   - `engineSetValue(engine, path, value)` -> `engine.setValue(path, value)`
   - `engineValue(engine, path)` -> `engine.signals[path]?.value`
   - `engineVariable(engine, name)` -> `engine.variableSignals['#:' + name]?.value`
   - `getValidationReport(engine, mode)` -> `engine.getValidationReport({ mode })`
   - `getResponse(engine, mode)` -> `engine.getResponse({ mode })`
   - `addRepeatInstance(engine, name)` -> `engine.addRepeatInstance(name)`
3. **No new dependencies.** The existing `node --test` runner with `assert` is sufficient. No vitest, no happy-dom needed.

### `packages/formspec-webcomponent/tests/` (existing, extend)

**Already has:** 8 test files using vitest + happy-dom, `.test.ts` extension, `helpers/engine-fixtures.ts` for creating definitions.

**Needed for migration:**
1. **Synthetic fixture builder helper.** Extend `engine-fixtures.ts` with helpers for common patterns:
   - `createDefinitionWithComponent(definition, componentDocument)` -> returns rendered DOM
   - `renderComponent(componentNode, fields?)` -> quick single-component render
2. **Console warning capture.** For compatibility-matrix test, need vitest spy on `console.warn`.
3. **No new dependencies.** happy-dom handles DOM attribute assertions. Note: `getComputedStyle` tests must stay in Playwright (happy-dom does not compute CSS).

### `tests/integration/` (NOT recommended)

After analysis, a separate `tests/integration/` directory is **not needed**. The tests classified as INTEGRATION-MIGRATE are actually unit tests of the FormEngine API surface using the grant-app definition as a fixture. They belong in `packages/formspec-engine/tests/` alongside the existing 16 test files that do exactly the same thing.

---

## E2E Restructuring

### New file structure and rationale

The restructured `tests/e2e/playwright/` directory groups tests by **user-facing concern** rather than implementation detail:

#### `grant-app/wizard-navigation.spec.ts`
- From: `grant-app-wizard-flow.spec.ts` (tests 1-4), `grant-app-component-props.spec.ts` (test 2)
- Content: First page rendering, step indicators, Next/Previous navigation, page headings

#### `grant-app/field-interaction.spec.ts`
- From: `grant-app-component-props.spec.ts` (tests 1, 5, 8), `component-tree-engine-alignment.spec.ts` (tests 1, 4), `grant-app-ux-fixes.spec.ts` (tests 9-10, 14)
- Content: RadioGroup selection, DataTable add button, Summary optionSet labels, input value reflection, negative clamping

#### `grant-app/readonly-and-styling.spec.ts`
- From: `grant-app-ux-fixes.spec.ts` (tests 1-4, 7-8)
- Content: Readonly class, background color, read-only badge, label nowrap, tab spacing

#### `grant-app/conditional-visibility.spec.ts`
- From: `grant-app-visibility-and-pruning.spec.ts` (tests 3-4), `component-tree-rendering.spec.ts` (test 2)
- Content: indirectRate hidden/shown, ConditionalGroup when-expression

#### `grant-app/budget-ui.spec.ts`
- From: `grant-app-ux-fixes.spec.ts` (tests 16-19), `grant-app-component-props.spec.ts` (test 19)
- Content: Modal not blocking, popover/modal positioning, popover triggerBind

#### `grant-app/project-phases-ui.spec.ts`
- From: `grant-app-discovered-issues.spec.ts` (tests 9-10, 12)
- Content: Computed money display in DOM

#### `grant-app/review-and-submit.spec.ts`
- From: `grant-app-component-props.spec.ts` (tests 12, 16)
- Content: Signature canvas, FileUpload drag-drop zones

#### `screener/screener-routing.spec.ts`
- Kept as-is. Cleanest file in the suite.

#### `components/interactive-components.spec.ts`
- From: `progressive-component-rendering.spec.ts` (tests 3, 6-10), `core-component-props-and-fixes.spec.ts` (tests 5-6, 8)
- Content: Modal open/close, Slider fill, Rating click/half-star, Columns grid CSS, Card elevation, Alert dismiss, Grid rowGap

#### `components/responsive-and-a11y.spec.ts`
- From: `accessibility-responsive-custom-components.spec.ts` (tests 1, 7)
- Content: aria-required/invalid interaction, responsive viewport resize

#### `components/remote-options.spec.ts`
- Kept as-is.

#### `components/grant-app-component-rendering.spec.ts`
- From: `grant-app-component-props.spec.ts` (tests 7, 9-11, 13-15, 17-18), `renderer-parity-gaps.spec.ts` (tests 1, 3-7, 13)
- Content: Stack children, RadioGroup orientation, Rating heart icon, ConditionalGroup fallback, Accordion labels, Tab styling, Badge color, Help panel, Modal size variants, DatePicker showTime, ProgressBar bind/aria/percent, compliance alert, Stack horizontal CSS

#### `conformance/kitchen-sink-holistic.spec.ts`
- Kept as-is with all sub-checks.

#### `smoke/happy-path.spec.ts`
- Rewrite of `kitchen-sink-smoke.spec.ts` to use real `page.fill()` / `page.click()` instead of `engineSetValue()`. Currently it is a hybrid that doesn't provide true smoke-test value.

---

## Top Actions

### 1. Delete `schema-parity-phase1.spec.ts` fixture audits (51 tests)

**Impact:** Removes 17% of the E2E suite. These tests verify that `definition.json`, `theme.json`, and `component.json` contain certain JSON properties. They run `JSON.stringify(theme).includes('"cssClass"')` -- this is not behavioral testing. If fixture integrity matters, add JSON Schema validation in the Python conformance suite (which already has schema tests).

**Action:** Delete 51 tests. Keep the 4 INTEGRATION-MIGRATE tests (dateTime/time/uri round-trips + initialValue today()) and move them to `packages/formspec-engine/tests/`.

### 2. Migrate `fel-standard-library-ui.spec.ts` to engine unit tests (17 tests)

**Impact:** These 17 tests have zero UI interaction. Every test is `engineSetValue -> engineValue`. They test FEL stdlib functions (upper, coalesce, round, year, dateAdd, dateDiff, abs, isNull, sum, matches, contains) using the grant-app definition's computed fields.

**Action:** Create `packages/formspec-engine/tests/fel-stdlib-grant-app.test.mjs`. Load the grant-app definition as a fixture. Each test becomes `engine.setValue(...); assert.strictEqual(engine.signals[...].value, expected)`.

### 3. Migrate `grant-app-validation.spec.ts` to engine unit tests (21 tests)

**Impact:** Largest single file of pure engine tests. Tests bind constraints, whitespace normalization, shape rules, activeWhen, timing, or/not composition -- all via `getValidationReport()`.

**Action:** Create `packages/formspec-engine/tests/validation-shapes-and-binds.test.mjs`. Same fixture approach.

### 4. Create grant-app definition fixture for engine tests

**Impact:** Unblocks items 2, 3, and all subsequent INTEGRATION-MIGRATE/UNIT-MIGRATE work.

**Action:** Create `packages/formspec-engine/tests/fixtures/` directory. Copy `examples/grant-application/definition.json` there (or symlink). Create a helper `loadGrantDefinition()` that returns the parsed JSON. This one-time infrastructure investment enables ~120 test migrations.

### 5. Deduplicate cross-file assertions

**Impact:** At least 8 duplicated assertions across files. The endDate constraint test appears in 3 different files.

**Action:** After completing items 1-3, audit the remaining E2E tests for duplicates and remove them. Particularly:
- endDate constraint: keep in `date-constraint-null-handling.test.mjs`, remove from `grant-app-validation` and `grant-app-conformance`
- ValidationReport shape: keep in `conformance-contract.test.mjs`, remove from `grant-app-validation`
- nonprofitPhoneHint visibility: remove duplicate tests 9-10 from `grant-app-visibility-and-pruning`

---

## Appendix: Files Not Requiring Changes

These files are well-structured and should remain as-is:

| File | Tests | Status |
|---|---|---|
| `screener-routing.spec.ts` | 14 | All E2E-KEEP. Clean, focused, real interactions. |
| `remote-options-binding.spec.ts` | 2 | Both E2E-KEEP. Network interception requires Playwright. |
| `kitchen-sink-holistic-conformance.spec.ts` | 1 (8 sub) | Mixed but monolithic by design. Complex setup dependencies make splitting counterproductive. |
