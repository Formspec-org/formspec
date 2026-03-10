# E2E Test Strategy

Single source of truth for Formspec E2E test coverage: what's tested, how, and what remains.

Last updated: 2026-03-02

---

## 1. Philosophy

The grant-application is the single integration fixture. It exercises the engine the way real
deployments will: a realistic multi-page wizard with repeatable groups, calculated subtotals feeding
a variable chain, shape rules at three severity levels with `activeWhen` and `context` expressions,
cross-field constraints, conditional visibility, and a full definition+component+theme stack.

Synthetic fixtures are kept only where the grant-application genuinely cannot serve: deeply nested
repeats (3+ levels), exhaustive FEL stdlib isolation, NaN coercion edge cases, types not present
in the grant-app (`uri`, `time`, `dateTime`), and kitchen-sink UI/component-specific checks.

---

## 2. Test Architecture

### 2.1 Grant-Application Integration Tests

| Test File | Features Validated |
|---|---|
| `integration/grant-app-conformance.spec.ts` | Identity, hydration, mixed types, validation report contract, shapes, nonRelevantBehavior, display items |
| `integration/grant-app-validation.spec.ts` | Bind constraints, whitespace, constraint messages, shape logic (or/and/not), activeWhen, timing, context |
| `integration/grant-app-wizard-flow.spec.ts` | Wizard pages, child fields, instance data, field metadata (labels, semanticType, prePopulate), component rendering |
| `integration/grant-app-budget-calculations.spec.ts` | Reactive calcs, precision, money aggregation, conditional variables, structureVersion, minRepeat/maxRepeat |
| `integration/grant-app-data-types.spec.ts` | Money coercion/badge, multiChoice, attachment, date calc, readonly, initialValue, optionSet labels, defaultCurrency |
| `integration/grant-app-visibility-and-pruning.spec.ts` | Conditional visibility, relevance cascade, nonRelevantBehavior remove vs keep (form-level vs per-bind) |
| `integration/grant-app-discovered-issues.spec.ts` | Null constraint short-circuit, duration null handling, phase UI, repeat nesting |
| `smoke/kitchen-sink-smoke.spec.ts` | Wizard flow, field types, calculate, repeat add, variable reactivity, response contract |

### 2.2 Kept Synthetic Fixtures

| Test File / Fixture | Why Kept |
|---|---|
| `integration/nested-repeats-and-calculations.spec.ts` | 2-level nested repeatables (projectPhases → phaseTasks); grant-app has this but the test isolates the nesting specifically |
| `integration/fel-standard-library-ui.spec.ts` | FEL stdlib coverage for 40+ functions — purpose-built isolation |
| `integration/edge-case-behaviors.spec.ts` | NaN coercion, null × number stability — not realistic in grant context |
| `browser/kitchen-sink-holistic-ui.spec.ts` | Kitchen-sink UI-only coverage for component/theme runtime and `when` vs `relevant` behavior |
| `components/*.spec.ts` | Component unit tests on minimal inline definitions (7 files) |
| `fixtures/kitchen-sink-holistic/` | Synthetic fixture for kitchen-sink UI checks and runtime re-homed engine tests |
| `fixtures/edge-cases.json` | NaN coercion fixture |
| `fixtures/fel-functions.json` | FEL stdlib fixture |
| `fixtures/data-types.json` | Types not in grant-app: `dateTime`, `uri`, `time` |

### 2.3 Deleted (Replaced by Grant-App Tests)

| Deleted File | Replaced By |
|---|---|
| `fixtures/shopping-cart.json` | grant-app-budget-calculations |
| `fixtures/repeating-sections.json` | grant-app-budget-calculations |
| `fixtures/validation.json` | grant-app-validation |
| `fixtures/static-validation.json` | grant-app-validation |
| `integration/calculation-visibility-submit.spec.ts` | grant-app-budget-calculations |
| `integration/repeating-sections-calculation.spec.ts` | grant-app-budget-calculations |
| `integration/cross-field-constraint-validation.spec.ts` | grant-app-validation |
| `integration/field-pattern-validation.spec.ts` | grant-app-validation |
| `integration/response-schema-contract.spec.ts` | grant-app-validation |
| `integration/response-pruning-behaviors.spec.ts` | grant-app-visibility-and-pruning |

### 2.4 Test Helper: `helpers/grant-app.ts`

All grant-app integration tests import from `tests/e2e/playwright/helpers/grant-app.ts`:

- `mountGrantApplication(page)` — loads definition + component + theme, waits for render
- `goToPage(page, title)` — navigates wizard to named page
- `engineValue(page, path)` / `engineSetValue(page, path, value)` — read/write field signals
- `engineVariable(page, name)` — read global variable (`variableSignals['#:name']`)
- `getValidationReport(page, mode)` — get validation report (continuous/submit/demand)
- `getResponse(page, mode)` — get response object
- `structureVersion(page)` — read structureVersion signal
- `addRepeatInstance(page, itemName)` — add a repeat row programmatically
- `getInstanceData(page)` — read instance data from engine

---

## 3. Definition Changes Made

All changes to `examples/grant-application/definition.json` that closed E2E gaps. Grouped by
category.

### Field Types & Properties

| Change | Field | Closes |
|---|---|---|
| Fix `attachment` dataType | narrativeDoc, budgetJustification | `attachment` dataType gap |
| Add `multiChoice` field | focusAreas (5 options) | `multiChoice` dataType |
| Add `initialValue` | contactPhone = "202-555-0100" | `initialValue` on field items |
| Add `precision: 2` | unitCost, subtotal | `precision` field property |
| Add `semanticType` | contactEmail (email), contactPhone (phone) | `semanticType` metadata |
| Add `labels` (short/aria) | orgName | `labels` context-keyed metadata |
| Add `prePopulate` | orgName from agencyData instance | `prePopulate` definition property |
| Add `children` | orgType → orgSubType | Field `children` (dependent sub-questions) |

### Bind Properties

| Change | Target | Closes |
|---|---|---|
| Add `default` expression | orgType = 'nonprofit' | `default` FEL expression on choice field |
| Add `nonRelevantBehavior: "keep"` | subcontractors bind | Per-bind override of form-level "remove" |
| Add `excludedValue: "null"` | requestedAmount bind | `excludedValue` bind |
| Add `disabledDisplay: "protected"` | duration bind | `disabledDisplay` rendering |
| Add second bind (constraint) | contactEmail | Bind inheritance AND/OR semantics |
| Add `whitespace` binds | EIN (normalize), contactEmail (trim) | `whitespace` bind processing |

### Shapes

| Change | Shape ID | Closes |
|---|---|---|
| Add `timing: "submit"` shape | narrativeDocRequired | Submit-only timing, `present()` FEL function |
| Add `or` composition | contactProvided | `or` shape composition |
| Add `not` composition | abstractNotPlaceholder | `not` shape composition |
| Add `and` composition + `activeWhen` | subcontractorEntryRequired | `and` composition, `activeWhen` |
| Add `context` expressions | budgetMatch | Shape `context` block |
| Add severity levels | error/warning/info across shapes | Severity level differentiation |

### Top-Level Definition

| Change | Closes |
|---|---|
| Add `instances.agencyData` (inline data, readonly) | `instances` data source access |
| Add `versionAlgorithm: "semver"` | `versionAlgorithm` metadata |
| Add `migrations: { "from": {} }` | `migrations` structure |
| `nonRelevantBehavior: "remove"` (form-level) | Form-level pruning behavior |

---

## 4. Grant-Application Feature Inventory

What the grant-application definition exercises (condensed).

**Data Types**: string, text, integer, decimal, date, choice, multiChoice, boolean, money, attachment, display item

**Structure**: Groups, top-level repeatables (subcontractors, projectPhases), nested repeatables (budget.lineItems, phaseTasks), child fields (orgType.orgSubType)

**Binds**: required (8+), relevant (3 conditional paths), calculate (duration, subtotal, taskCost), readonly (duration, subtotal, taskCost), constraint (EIN pattern, date range, email format), constraintMessage, whitespace (normalize, trim), default (orgType), initialValue (contactPhone), prefix ($), hint (6+ fields), precision (2), prePopulate (orgName), excludedValue (requestedAmount), disabledDisplay (duration)

**Variables**: totalDirect, indirectCosts (conditional on orgType), grandTotal, projectPhasesTotal — all using @variable FEL references, if/then/else, money arithmetic chains

**Shapes**: 7 shapes across 3 severity levels. Compositions: or, not, and. Features: activeWhen, context expressions, timing (continuous + submit)

**FEL Functions Exercised**: sum(), money()/moneyAmount()/moneyAdd(), dateDiff(), dateAdd(), matches(), contains(), length(), abs(), upper(), coalesce(), round(), year(), isNull(), not, string(), present()

**Presentation**: pageMode wizard (5 pages), defaultCurrency USD, labelPosition top, density comfortable, nonRelevantBehavior remove (form-level) + keep (per-bind)

**Engine APIs**: getResponse(), getValidationReport() (continuous + submit), variableSignals, structureVersion, instanceData, addRepeatInstance

---

## 5. Test Specifications

### `grant-app-budget-calculations.spec.ts`

- Calculate line item subtotal reactively as quantity and unitCost change
- Round subtotal to 2 decimal places (precision: 2 on unitCost/subtotal)
- Aggregate subtotals into @totalDirect variable
- Compute @indirectCosts from indirectRate percentage of @totalDirect
- Compute @grandTotal as moneyAdd(@totalDirect, @indirectCosts)
- Set @indirectCosts to money(0, USD) when orgType switches to government
- Increment structureVersion when a line item is added
- Increment structureVersion when a line item is removed
- Preserve remaining row data after a line item is deleted
- Disable Add Row button when lineItems reaches maxRepeat of 20
- Disable Remove button when lineItems is at minRepeat of 1

### `grant-app-validation.spec.ts`

**Bind Constraints:**
- Reject endDate before startDate with constraintMessage
- Accept endDate after startDate and clear the constraint error
- Reject EIN not matching XX-XXXXXXX pattern via constraint bind
- Reject contactPhone not matching pattern via bind constraint (matches())
- Normalize whitespace from EIN input (whitespace: normalize)
- Trim whitespace from contactEmail input (whitespace: trim)
- Apply constraint from second bind on contactEmail (bind inheritance AND semantics)

**Shape Validation:**
- Surface BUDGET_MISMATCH shape with full ValidationResult contract (severity, path, message, constraintKind, code, source, shapeId, constraint, context)
- Clear BUDGET_MISMATCH when requestedAmount matches @grandTotal
- Activate subcontractorCap shape only when usesSubcontractors is true (activeWhen)
- Not fire narrativeDocRequired in continuous mode (timing: submit)
- Fire narrativeDocRequired in submit mode when no attachment present
- Fire contactProvided warning when both email and phone are empty (or composition)
- Clear contactProvided warning when only email is provided
- Fire abstractNotPlaceholder warning when abstract contains TBD (not composition)
- Fire subcontractorEntryRequired when usesSubcontractors is true but no entries (and composition)

**API Contracts:**
- Return ValidationReport with valid boolean, counts, results, and timestamp
- Include definitionUrl, version, status, data, authored in submit response
- Reject requestedAmount of $0 due to excludedValue

### `grant-app-visibility-and-pruning.spec.ts`

- Show nonprofitPhoneHint display item when orgType defaults to nonprofit
- Hide nonprofitPhoneHint when orgType changes to university
- Show indirectRate field for non-government org types
- Hide indirectRate field when orgType is government
- Hide entire subcontractors section when usesSubcontractors is false
- Show subcontractors when usesSubcontractors is checked
- Cascade default orgType through relevance binds immediately on load
- Remove non-relevant fields from submit response (form-level nonRelevantBehavior: remove)
- Retain subcontractor data in response when usesSubcontractors toggled off (per-bind keep)

### `grant-app-wizard-flow.spec.ts`

- Render all 5 wizard pages accessible by clicking Next
- Render orgSubType as a child field nested under orgType
- Make instance data accessible via engine (agencyData.maxAward, fiscalYear)
- Render CheckboxGroup for focusAreas on Project Narrative page
- Render FileUpload components for both attachment fields on Review page
- Have versionAlgorithm set to semver in the loaded definition
- Have migrations object present in the loaded definition
- Have labels metadata on orgName field (short and aria keys)
- Have semanticType metadata on contactEmail (email) and contactPhone (phone)
- Have prePopulate property on orgName referencing agencyData instance

### `grant-app-data-types.spec.ts`

- Render money field with USD badge from formPresentation.defaultCurrency
- Accept numeric input and store requestedAmount as { amount, currency } object
- Render multiChoice CheckboxGroup and return array of selected values
- Render attachment FileUpload for narrativeDoc and budgetJustification
- Render date pickers for startDate and endDate
- Calculate duration in months from date range (readonly calculate bind)
- Render duration as disabled input (disabledDisplay: protected)
- Render orgSubType child field and submit its value in response
- Initialize contactPhone with initialValue of 202-555-0100

### `grant-app-conformance.spec.ts`

- Validate definition identity (url, version, name)
- Hydrate form and verify mixed data types in response
- Validate full validation report contract
- Verify shape validation results with proper severity
- Verify nonRelevantBehavior response pruning
- Verify display item rendering and relevance

### `grant-app-discovered-issues.spec.ts`

- Handle null constraint evaluation without short-circuit errors
- Handle duration calculation when dates are null
- Render project phase UI correctly
- Handle repeat nesting edge cases

---

## 6. Remaining Gaps

### Low-Impact (Acceptable)

| Feature | Current State | Why Acceptable |
|---|---|---|
| `default` bind (FEL expression) | Only holistic tests string defaults. Grant-app has `money(0, 'USD')` default on requestedAmount but no dedicated assertion it fires on load. | Covered implicitly via response tests — if the default breaks, the response changes. |
| Shape timing: `demand` | Only holistic fixture uses demand timing. Grant-app doesn't use it. | Demand is a niche timing mode. Holistic coverage is sufficient. |
| Shape severity: `info` UI rendering | Tested as part of validation report counts, no dedicated UI assertion for info-level display. | Info severity exists in the report; visual rendering is a component concern. |
| `formPresentation.labelPosition` / `density` | Set on grant-app definition, not specifically asserted. | These affect CSS layout. Visual regression testing would be more appropriate. |
| `derivedFrom` | Pure metadata property, no runtime behavior. | Schema tests validate acceptance. Pass-through property. |
| `extensions` (x- prefixed keys) | Pass-through on items and definition. Schema tests validate acceptance. | No runtime behavior to test E2E. |

### Deferred (Needs Dedicated Fixture or Approach)

| Feature | Severity | Why Deferred |
|---|---|---|
| Theme selector cascade (Level 2 selectors) | Medium | Requires a theme-focused test with non-trivial selectors. Grant-app theme is too simple. |
| Theme null suppression (`"none"` sentinel) | Low-Medium | Specific suppression mechanism for inherited theme values. Needs theme-focused test. |
| `$ref` / `keyPrefix` composition | Low-Medium | Requires external definition fragments and the assembler. Grant-app is a single file. Holistic covers the basic case. |
| `prePopulate` runtime resolution | Medium | Definition property is present and tested. Verifying actual pre-population at runtime requires host injection or a mock data source. |
| Dependency cycle detection | Medium-High | Unit-test-shaped: engine throws on invalid input. Not an E2E concern. Covered by Python unit tests. |
| FEL: `countWhere()` | Low | Niche aggregate function. Covered by Python unit tests. |
| FEL: `relevant()`, `required()`, `readonly()` | Low | MIP state functions require FEL expressions that read MIP state — fundamentally a unit-test domain. |

### Out of Scope for Grant-Application (Covered Elsewhere)

| Feature | Where Covered |
|---|---|
| Deeply nested repeats (3+ levels) | `nested-repeats-and-calculations.spec.ts` (2 levels; 3+ not in any fixture) |
| Exhaustive FEL stdlib (40+ functions) | `fel-standard-library-ui.spec.ts` |
| NaN/edge-case coercion | `edge-case-behaviors.spec.ts` |
| `screener` routing | Not used in grant-app; holistic conformance covers |
| `remoteOptions` | `remote-options-binding.spec.ts` (dedicated mock) |
| `uri`, `time`, `dateTime` data types | Holistic conformance fixture |
| Component unit tests (Slider, Rating, etc.) | `components/progressive-component-rendering.spec.ts` and other component files |
| Custom component registry + cycle detection | `accessibility-responsive-custom-components.spec.ts` |
| Responsive design (breakpoints) | `accessibility-responsive-custom-components.spec.ts` |

---

## 7. Coverage Tracking

Resolved gaps, tracked for historical reference. All items below were identified in the gap
analysis (2026-02-26) and closed by subsequent grant-app test files.

| Feature | Severity | Closed By |
|---|---|---|
| `activeWhen` on shapes | Critical | grant-app-validation: subcontractorCap activates/deactivates |
| Shape `context` expressions | Critical | grant-app-validation: budgetMatch context (grandTotal, requested, difference) |
| `validationResults` full shape | High | grant-app-validation: full ValidationResult contract assertion |
| `ValidationReport` full shape | Medium | grant-app-validation: valid, counts, results, timestamp |
| `structureVersion` reactivity | Medium-High | grant-app-budget-calculations: increments on add/remove |
| `variableSignals` access | Medium-High | grant-app-budget-calculations + conformance: reactive read |
| Shape timing: submit vs continuous | Medium-High | grant-app-validation: narrativeDocRequired fires only in submit mode |
| Shape composition: `or`/`not`/`and` | Medium | grant-app-validation: contactProvided, abstractNotPlaceholder, subcontractorEntryRequired |
| Bind inheritance (AND/OR semantics) | Medium | grant-app-validation: dual bind on contactEmail |
| `precision` on field items | Medium | grant-app-budget-calculations: subtotal rounding |
| `whitespace` bind processing | Medium | grant-app-validation: EIN normalize, email trim |
| `defaultCurrency` rendering | Medium | grant-app-data-types: USD badge |
| `nonRelevantBehavior` hierarchy | Medium | grant-app-visibility-and-pruning: form-level remove + per-bind keep |
| `minRepeat`/`maxRepeat` enforcement | Medium | grant-app-budget-calculations: validation errors at boundaries |
| `disabledDisplay` rendering | Medium | grant-app-data-types: duration disabled but visible |
| `excludedValue` bind | Medium | grant-app-validation: requestedAmount $0 rejection |
| Field `children` | Medium | grant-app-wizard-flow: orgSubType nested under orgType |
| `instances` data sources | Medium | grant-app-wizard-flow: agencyData access |
| `multiChoice` data type | Medium | grant-app-data-types + wizard-flow: focusAreas CheckboxGroup |
| `display` item relevance | Medium | grant-app-conformance + visibility: nonprofitPhoneHint toggle |
| `initialValue` on fields | Medium | grant-app-data-types: contactPhone hydration |
| `semanticType` metadata | Low | grant-app-wizard-flow: email/phone semanticType presence |
| `labels` metadata | Low | grant-app-wizard-flow: orgName short/aria labels |
| `prePopulate` definition | Low | grant-app-wizard-flow: orgName property presence |
| `versionAlgorithm` | Low | grant-app-wizard-flow: semver in loaded definition |
| `migrations` structure | Low | grant-app-wizard-flow: migrations object presence |
| `default` bind (choice field) | Low | grant-app-visibility: orgType defaults to nonprofit on load |
