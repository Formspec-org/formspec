# E2E Coverage Matrix: Test Suite vs Grant-Application Features

Generated: 2026-02-28

---

## 1. E2E Test Suite Summary

| Test File | Fixture(s) | Features Validated |
|---|---|---|
| `smoke/kitchen-sink-smoke.spec.ts` | grant-application | Wizard flow, field types, calculate, repeat add, variable reactivity, response contract |
| `integration/grant-app-conformance.spec.ts` | grant-application | Identity, hydration, mixed types, validation report contract, shapes, nonRelevantBehavior, display items |
| `integration/grant-app-validation.spec.ts` | grant-application | Bind constraints, whitespace, constraint messages, shape logic (or/and/not), activeWhen, timing, context |
| `integration/grant-app-wizard-flow.spec.ts` | grant-application | Wizard pages, child fields, instance data, field metadata (labels, semanticType, prePopulate), component rendering |
| `integration/grant-app-budget-calculations.spec.ts` | grant-application | Reactive calcs, precision, money aggregation, conditional variables, structureVersion, minRepeat/maxRepeat |
| `integration/grant-app-data-types.spec.ts` | grant-application | Money coercion/badge, multiChoice, attachment, date calc, readonly, initialValue, optionSet labels, defaultCurrency |
| `integration/grant-app-visibility-and-pruning.spec.ts` | grant-application | Conditional visibility, relevance cascade, nonRelevantBehavior remove vs keep (form-level vs per-bind) |
| `integration/grant-app-discovered-issues.spec.ts` | grant-application | Null constraint short-circuit, duration null handling, phase UI, repeat nesting |
| `integration/nested-repeats-and-calculations.spec.ts` | grant-application | Nested repeatables (projectPhases[*].phaseTasks[*]), cross-level aggregation, nested response structure |
| `integration/fel-standard-library-ui.spec.ts` | grant-application | FEL stdlib: upper, coalesce, round, abs, year, dateDiff, dateAdd, isNull, not, string, sum |
| `integration/edge-case-behaviors.spec.ts` | grant-application | NaN coercion, null × number stability |
| `integration/kitchen-sink-holistic-conformance.spec.ts` | kitchen-sink-holistic/ | Full conformance: all 13 dataTypes, TS/Python parity, instance injection, migrations |
| `components/component-gap-coverage.spec.ts` | grant-app + inline | Repeat group path resolution, dataType-component compatibility matrix |
| `components/component-tree-engine-alignment.spec.ts` | grant-application | DOM/engine signal sync (required, relevant), two-way binding |
| `components/component-tree-rendering.spec.ts` | grant-app + inline | Component hierarchy, ConditionalGroup (when), Tabs+Summary sync |
| `components/grant-app-component-props.spec.ts` | grant-application | RadioGroup, Wizard nav, Toggle, CheckboxGroup, DataTable, Summary, Collapsible |
| `components/core-component-props-and-fixes.spec.ts` | inline | NumberInput, Select, DatePicker, TextInput prefix/suffix, Card, FileUpload, Alert |
| `components/progressive-component-rendering.spec.ts` | inline | Divider, Collapsible, Columns, Panel, Accordion, ProgressBar, Slider, Rating, Alert |
| `components/remote-options-binding.spec.ts` | inline | remoteOptions HTTP fetch, fallback on error |
| `components/accessibility-responsive-custom-components.spec.ts` | various | ARIA attributes, responsive breakpoints (pre-existing failure) |

---

## 2. Grant-Application Feature Inventory

| Feature | How Exercised |
|---|---|
| `string` field | orgName, ein, contactName, contactEmail, contactPhone, subName, subOrg |
| `text` field | abstract (projectNarrative), subScope |
| `integer` field | duration (calculated), budget.lineItems[*].quantity |
| `decimal` field | indirectRate, budget.lineItems[*].unitCost + subtotal, subAmount |
| `date` field | startDate, endDate |
| `choice` field | orgType (optionSet ref), budget.lineItems[*].category (optionSet ref) |
| `multiChoice` field | focusAreas (5 options) |
| `boolean` field | budget.usesSubcontractors |
| `money` field | budget.requestedAmount, hourlyRate (in phaseTasks) |
| `attachment` field | narrativeDoc, budgetJustification |
| `display` item | applicantInfo.nonprofitPhoneHint (conditional text) |
| `optionSets` (named) | budgetCategories (7), orgTypes (4), focusAreaOptions (5) |
| `formPresentation.pageMode = wizard` | 5-page wizard navigation |
| `formPresentation.defaultCurrency` | `"USD"` — drives money field badge |
| `formPresentation.labelPosition` | `"top"` |
| `formPresentation.density` | `"comfortable"` |
| `presentation.page` on groups | Maps groups to wizard pages by title |
| `repeatable` group (top-level) | subcontractors: min=1, max=10; projectPhases: min=1, max=10 |
| `repeatable` group (nested in group) | budget.lineItems: min=1, max=20; phaseTasks: min=1, max=20 |
| `required` bind | 8+ fields |
| `relevant` bind | nonprofitPhoneHint (orgType=nonprofit), indirectRate (orgType≠government), subcontractors (usesSubcontractors) |
| `calculate` bind | duration = dateDiff(), lineItems[*].subtotal = qty × unitCost, taskCost = hours × hourlyRate |
| `readonly` bind | duration, lineItems[*].subtotal, taskCost |
| `constraint` bind | EIN format (matches()), endDate > startDate, email contains @ |
| `constraintMessage` | Both constraint binds |
| `whitespace` bind | normalize on EIN, trim on contactEmail |
| `default` bind | requestedAmount = money(0, 'USD') |
| `initialValue` | contactPhone = "202-555-0100" |
| `prefix` on field | unitCost: "$" |
| `hint` on fields | abstract, ein, indirectRate, requestedAmount, contact fields |
| `precision` on field/bind | unitCost: precision=2 |
| `labels` (short/aria) | Field label variants |
| `semanticType` | email, phone on contact fields |
| `prePopulate` | orgName from agencyData instance |
| `instances` (inline data) | agencyData: maxAward, fiscalYear |
| Global `variables` | totalDirect, indirectCosts (conditional), grandTotal, projectPhasesTotal |
| `@variable` references in FEL | @totalDirect, @indirectCosts, @grandTotal, @projectPhasesTotal |
| `if/then/else` in FEL | indirectCosts: if orgType=government then 0 else ... |
| `sum()` over wildcard path | sum($budget.lineItems[*].subtotal), sum($phaseTasks[*].taskCost) |
| `money()` / `moneyAmount()` / `moneyAdd()` | variables, shapes |
| `dateDiff()` | calculate on duration |
| `dateAdd()` | projectedEndDate |
| `matches()` | EIN constraint |
| `abs()` | budgetDeviation |
| `upper()` | orgNameUpper |
| `coalesce()` | contactPhoneFallback |
| `round()` | indirectRateRounded |
| `year()` | projectYear |
| `isNull()` / `not` | hasLineItems |
| `length()` | abstractLength shape |
| Shape: `severity: info` | abstractLength (continuous) |
| Shape: `severity: error` | budgetMatch, subcontractorCap, narrativeDocRequired, subcontractorEntryRequired |
| Shape: `severity: warning` | budgetReasonable, contactProvided, abstractNotPlaceholder |
| Shape: `timing: continuous` | abstractLength |
| Shape: `timing: submit` | narrativeDocRequired |
| Shape: `activeWhen` | subcontractorCap, subcontractorEntryRequired (activeWhen usesSubcontractors) |
| Shape: `context` expressions | budgetMatch (grandTotal, requested, difference) |
| Shape logic: `or` | contactProvided (email OR phone) |
| Shape logic: `not` | abstractNotPlaceholder (not contains "tbd") |
| Shape logic: `and` | subcontractorEntryRequired (usesSubcontractors AND count≥1) |
| `nonRelevantBehavior: "remove"` | Form-level setting |
| `nonRelevantBehavior: "keep"` | Per-bind on subcontractors |
| 3-document stack (def+component+theme) | Full stack loaded |
| `structureVersion` reactive effect | Increments on add/remove repeat |
| `variableSignals` access | @grandTotal, @totalDirect, @indirectCosts |
| `getValidationReport(mode)` | continuous + submit modes |
| `getResponse(mode)` | submit mode |
| `child fields` | applicantInfo.orgType.orgSubType nested path |

---

## 3. Coverage Matrix

Symbols: ✓ covered · ~ partial · ✗ not covered

Columns use short names:
- **conform** = grant-app-conformance
- **valid** = grant-app-validation
- **wizard** = grant-app-wizard-flow
- **budget** = grant-app-budget-calculations
- **dtypes** = grant-app-data-types
- **visprune** = grant-app-visibility-and-pruning
- **issues** = grant-app-discovered-issues
- **nested** = nested-repeats-and-calculations
- **fel** = fel-standard-library-ui
- **edge** = edge-case-behaviors
- **holistic** = kitchen-sink-holistic-conformance
- **cgap** = component-gap-coverage
- **calign** = component-tree-engine-alignment
- **ctree** = component-tree-rendering
- **gaprops** = grant-app-component-props
- **cprops** = core-component-props-and-fixes
- **prog** = progressive-component-rendering
- **smoke** = kitchen-sink-smoke

| Feature | conform | valid | wizard | budget | dtypes | visprune | issues | nested | fel | edge | holistic | cgap | calign | ctree | gaprops | cprops | prog | smoke | Gap |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Field Types** | | | | | | | | | | | | | | | | | | | |
| string | ✓ | ✓ | ✓ | | ✓ | | | | ✓ | | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | | ✓ | none |
| text | ✓ | | ✓ | | | | | | | | ✓ | | | | | | | | none |
| integer | ✓ | | | ✓ | | | | | | ✓ | ✓ | | | | ✓ | ✓ | | ✓ | none |
| decimal | ✓ | | | ✓ | ✓ | | | | | ✓ | ✓ | | | | ✓ | ✓ | | | none |
| date | ✓ | ✓ | ✓ | | ✓ | | ✓ | | ✓ | | ✓ | | | | ✓ | ✓ | | ✓ | none |
| choice | ✓ | | ✓ | | ✓ | | | | | | ✓ | ✓ | | ✓ | ✓ | | ✓ | ✓ | none |
| multiChoice | ✓ | | ✓ | | ✓ | | | | | | ✓ | | | | ✓ | | | | none |
| boolean | ✓ | | | ✓ | | ✓ | | | | | ✓ | ✓ | ✓ | | ✓ | | ✓ | ✓ | none |
| money | ✓ | | | ✓ | ✓ | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| attachment | | | ✓ | | ✓ | | | | | | ✓ | | | | | ✓ | | | none |
| display item | ✓ | | ✓ | | | ✓ | | | | | | | | ✓ | | | | | none |
| **Structure** | | | | | | | | | | | | | | | | | | | |
| Groups | ✓ | | ✓ | | | ✓ | | | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | none |
| Nested repeatable groups | | | | | | | ✓ | ✓ | | | ✓ | | | | | | | | none |
| Top-level repeatable group | ✓ | | | ✓ | | ✓ | ✓ | | | | ✓ | ✓ | | | ✓ | | | ✓ | none |
| Child fields | ✓ | | ✓ | | ✓ | | | | | | ✓ | | | | | | | | none |
| **Binds** | | | | | | | | | | | | | | | | | | | |
| required | ✓ | ✓ | | | | | | | | | ✓ | | ✓ | | ✓ | | | ✓ | none |
| relevant | ✓ | | ✓ | | | ✓ | | | | | ✓ | ✓ | ✓ | ✓ | | | | ✓ | none |
| constraint | ✓ | ✓ | | | | | ✓ | | | | ✓ | | | | | | | | none |
| constraintMessage | ✓ | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| whitespace (normalize/trim) | | ✓ | | | ✓ | | | | | | ✓ | | | | | | | | none |
| calculate | ✓ | | | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| readonly | ✓ | | | ✓ | ✓ | | ✓ | | | | ✓ | | | | ✓ | | | ✓ | none |
| default | | | | | | | | | | | ✓ | | | | | | | | ~ (only holistic) |
| initialValue | | | | | ✓ | | | | | | ✓ | | | | | | | | none |
| prefix/suffix | | | | | | | | | | | ✓ | | | | | ✓ | | | none |
| hint | | | | | | | | | | | ✓ | | | ✓ | ✓ | | | | none |
| precision | | | | ✓ | | | | | | | | | | | | | | | none |
| prePopulate | | | ✓ | | | | | | | | | | | | | | | | none |
| minRepeat/maxRepeat | | | | ✓ | | | | | | | | | | | | | | | none |
| **Variables** | | | | | | | | | | | | | | | | | | | |
| Global variables | ✓ | | | ✓ | | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| @variable FEL references | ✓ | | | ✓ | | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| if/then/else in variables | ✓ | | | ✓ | | | | | ✓ | | ✓ | | | | | | | | none |
| Money arithmetic chain | | | | ✓ | ✓ | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| **Shapes** | | | | | | | | | | | | | | | | | | | |
| Shape severity: error | ✓ | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape severity: warning | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape severity: info | | ✓ | | | | | | | | | ✓ | | | | | | | | ~ |
| Shape timing: continuous | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape timing: submit | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape timing: demand | | | | | | | | | | | ✓ | | | | | | | | ~ (only holistic) |
| Shape activeWhen | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape context block | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| Shape logic: or | | ✓ | | | | | | | | | | | | | | | | | none |
| Shape logic: not | | ✓ | | | | | | | | | | | | | | | | | none |
| Shape logic: and | | ✓ | | | | | | | | | | | | | | | | | none |
| **optionSets (named)** | ✓ | | ✓ | | ✓ | | | | | | ✓ | ✓ | | | ✓ | | | ✓ | none |
| **Presentation** | | | | | | | | | | | | | | | | | | | |
| pageMode: wizard | ✓ | | ✓ | | | | | | | | ✓ | | | | ✓ | | | ✓ | none |
| defaultCurrency | | | | | ✓ | | | | | | | | | | | | | | none |
| labelPosition / density | | | ✓ | | | | | | | | ✓ | | | | | | | | ~ |
| presentation.page targeting | ✓ | | ✓ | | | | | | | | ✓ | | | | ✓ | | | ✓ | none |
| nonRelevantBehavior (form-level) | ✓ | | | | | ✓ | | | | | ✓ | | | | | | | | none |
| nonRelevantBehavior (per-bind) | | | | | | ✓ | | | | | ✓ | | | | | | | | none |
| **Engine APIs** | | | | | | | | | | | | | | | | | | | |
| Response contract | ✓ | ✓ | | | | | | ✓ | | | ✓ | | | | | | | ✓ | none |
| structureVersion reactivity | | | | ✓ | | | | | | | ✓ | | | | | | | | none |
| variableSignals reactive | ✓ | | | ✓ | | | | ✓ | ✓ | | | | | | | | | ✓ | none |
| getValidationReport modes | ✓ | ✓ | | ✓ | | | | | | | ✓ | | | | | | | | none |
| getResponse modes | ✓ | ✓ | | | | ✓ | | ✓ | | | ✓ | | | | | | | ✓ | none |
| instanceData access | | | ✓ | | | | | | | | ✓ | | | | | | | | none |
| **FEL Functions** | | | | | | | | | | | | | | | | | | | |
| upper() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| coalesce() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| round() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| abs() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| year() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| dateDiff() | ✓ | | | | ✓ | | ✓ | | ✓ | | ✓ | | | | | | | | none |
| dateAdd() | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| isNull() / not | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| sum() wildcard | ✓ | | | ✓ | | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| money() / moneyAmount() / moneyAdd() | ✓ | | | ✓ | ✓ | | | ✓ | ✓ | | ✓ | | | | | | | ✓ | none |
| matches() / contains() / length() | | ✓ | | | | | | | | | ✓ | | | | | | | | none |
| string() type coercion | | | | | | | | | ✓ | | ✓ | | | | | | | | none |
| **Components** | | | | | | | | | | | | | | | | | | | |
| Wizard | ✓ | | ✓ | | | | | | | | ✓ | | | | ✓ | | | ✓ | none |
| TextInput | | | ✓ | | | | | | | | ✓ | | ✓ | ✓ | ✓ | ✓ | | | none |
| RadioGroup | ✓ | | ✓ | | | | | | | | ✓ | | | | ✓ | | | | none |
| DatePicker | | | ✓ | | ✓ | | | | | | ✓ | | | | ✓ | ✓ | | | none |
| NumberInput | | | | ✓ | | | | | | | ✓ | | | | ✓ | ✓ | | | none |
| Select | | | | | | | | | | | ✓ | ✓ | | ✓ | | ✓ | ✓ | | none |
| Toggle | | | | | | ✓ | | | | | ✓ | ✓ | ✓ | | ✓ | | ✓ | | none |
| CheckboxGroup | ✓ | | ✓ | | ✓ | | | | | | ✓ | | | | ✓ | | | | none |
| MoneyInput | | | | ✓ | ✓ | | | | | | | | | | | | | | none |
| FileUpload | | | ✓ | | ✓ | | | | | | ✓ | | | | | ✓ | | | none |
| DataTable | | | | ✓ | | | ✓ | | | | ✓ | ✓ | | | ✓ | | | | none |
| Card | | | | | | | | | | | ✓ | | | | ✓ | ✓ | | | none |
| Stack / Grid | | | ✓ | | | | | | | | ✓ | | | | ✓ | | | | none |
| Summary | | | | | | | | | | | ✓ | | | ✓ | ✓ | | | | none |
| ConditionalGroup (when) | | | | | | ✓ | | | | | | | | ✓ | | | | | none |
| Collapsible | | | | | | | | | | | | | | | ✓ | | ✓ | | none |
| Tabs | | | | | | | | | | | | | | ✓ | | | | | none |
| Divider | | | | | | | | | | | | | | | | | ✓ | | none |
| Panel | | | | | | | | | | | | | | | | | ✓ | | none |
| Accordion | | | | | | | | | | | | | | | | | ✓ | | none |
| ProgressBar | | | | | | | | | | | | | | | | | ✓ | | none |
| Slider | | | | | | | | | | | | | | | | | ✓ | | none |
| Rating | | | | | | | | | | | | | | | | | ✓ | | none |
| Alert | | | | | | | | | | | | | | | | ✓ | ✓ | | none |
| remoteOptions | | | | | | | | | | | | | | | | | | | ✓ (dedicated test) |

---

## 4. Coverage Gaps Summary

### Resolved since last review (2026-02-26)

The following gaps from the previous matrix have been **closed** by new grant-app test files:

1. **`activeWhen` on shapes** — Now tested in `grant-app-validation.spec.ts`: subcontractorCap activates/deactivates when toggling usesSubcontractors.
2. **Shape `context` block** — Now tested in `grant-app-validation.spec.ts`: budgetMatch context values (grandTotal, requested, difference) asserted.
3. **Shape `timing: submit` vs `continuous`** — Now tested in `grant-app-validation.spec.ts`: narrativeDocRequired fires only in submit mode.
4. **`whitespace` bind processing** — Now tested in `grant-app-validation.spec.ts`: EIN normalize and email trim asserted.
5. **`defaultCurrency` presentation property** — Now tested in `grant-app-data-types.spec.ts`: USD badge rendering validated.
6. **`nonRelevantBehavior` hierarchy** — Now tested in `grant-app-visibility-and-pruning.spec.ts`: form-level remove + per-bind keep response assertions.
7. **`multiChoice` data type** — Now present in grant-app (focusAreas), tested in `grant-app-data-types.spec.ts` and `grant-app-wizard-flow.spec.ts`.
8. **`display` item relevance in wizard** — Now tested in `grant-app-conformance.spec.ts` and `grant-app-wizard-flow.spec.ts`: nonprofitPhoneHint visibility toggle.
9. **`minRepeat`/`maxRepeat` enforcement** — Now tested in `grant-app-budget-calculations.spec.ts`: MIN_REPEAT and MAX_REPEAT validation errors.
10. **Variable chain reactive update** — Now tested in `grant-app-budget-calculations.spec.ts` and `grant-app-conformance.spec.ts`: variable signals read reactively.
11. **`structureVersion` reactivity** — Now tested in `grant-app-budget-calculations.spec.ts`: signal increments on add/remove.
12. **`initialValue`** — Now tested in `grant-app-data-types.spec.ts`: contactPhone hydration.

### Remaining gaps

**Low-impact (acceptable):**

1. **`default` bind** — Only tested in holistic fixture. Grant-app has `requestedAmount = money(0, 'USD')` but no dedicated assertion that the default fires on load. Covered implicitly via response tests.
2. **Shape timing: demand** — Only tested in holistic. Grant-app doesn't use demand timing.
3. **Shape severity: info** — Tested as part of validation report counts, but no dedicated UI assertion for info-level display.

**Out of scope for grant-application (keep in synthetic fixtures):**

- Deeply nested repeats (3+ levels) — grant-app has 2 levels (projectPhases → phaseTasks), adequate
- Exhaustive FEL stdlib function coverage — grant-app now exercises 15+ FEL functions; remaining coverage in holistic parity cases
- NaN/edge-case coercion — tested in `edge-case-behaviors.spec.ts`
- `screener` routing — not used in the grant-app
- `remoteOptions` — not used in the grant-app; tested with dedicated mock
- Component unit tests (Slider, Rating, Signature, etc.) — tested with minimal inline definitions
- `uri`, `time`, `dateTime` data types — not used in grant-app; tested in holistic fixture
