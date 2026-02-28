# Component.json Spec Showcase — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `examples/grant-application/component.json` as a spec showcase exercising all 33 built-in components and all major Tier 3 features, with corresponding definition.json changes and test updates.

**Architecture:** The component document targets the existing grant-application definition. Two new fields are added to the definition (approverSignature, selfAssessment). The component tree is a 6-page Wizard using every component type. Tests that depend on component structure are updated; engine-only tests are untouched.

**Tech Stack:** JSON (component.json, definition.json), TypeScript/Playwright (E2E tests)

---

### Task 1: Add new fields to definition.json

**Files:**
- Modify: `examples/grant-application/definition.json`

**Step 1: Add `selfAssessment` field to projectNarrative group**

Add after the `projectedEndDate` field (around line 283):

```json
{
  "type": "field",
  "key": "selfAssessment",
  "label": "Proposal Confidence",
  "dataType": "integer",
  "hint": "Rate your confidence in this proposal from 1 (low) to 5 (high)."
}
```

**Step 2: Add `approverSignature` field to attachments group**

Add after the `budgetJustification` field (around line 483):

```json
{
  "type": "field",
  "key": "approverSignature",
  "label": "Authorizing Official Signature",
  "dataType": "attachment",
  "hint": "Draw your signature to certify this application."
}
```

**Step 3: Validate the definition still passes schema**

Run: `python3 -c "import json, jsonschema; s=json.load(open('schemas/definition.schema.json')); d=json.load(open('examples/grant-application/definition.json')); jsonschema.validate(d, s); print('VALID')"`
Expected: `VALID`

**Step 4: Run engine-only E2E tests to confirm no regressions**

Run: `npx playwright test tests/e2e/playwright/integration/grant-app-conformance.spec.ts tests/e2e/playwright/integration/grant-app-validation.spec.ts tests/e2e/playwright/integration/grant-app-budget-calculations.spec.ts --timeout 30000`
Expected: All pass

**Step 5: Commit**

```bash
git add examples/grant-application/definition.json
git commit -m "feat(grant-app): add selfAssessment and approverSignature fields to definition"
```

---

### Task 2: Write the new component.json

**Files:**
- Rewrite: `examples/grant-application/component.json`

**Step 1: Write the complete component.json**

The file should contain exactly this structure. Reference the design doc at `docs/plans/2026-02-28-component-json-redesign.md` for intent behind each section.

Document-level:
- `$formspecComponent: "1.0"`, `version: "1.0.0"`
- `targetDefinition` pointing to the grant-application definition
- `breakpoints: { sm: 576, md: 768, lg: 1024 }`
- `tokens`: Override `space.lg` to `"32px"`, add `color.accent: "#2e7d32"`, `border.card: "1px solid #dfe1e2"`
- `components` registry with `ContactField` and `SummaryRow` custom components

Tree (Wizard with 6 Pages):

**Page 1 "Applicant Info":**
- Columns [widths: ["2fr", "1fr"]]
  - Stack (main)
    - Grid [columns: 2, responsive: { sm: { columns: 1 } }] with orgName + ein TextInputs
    - RadioGroup [applicantInfo.orgType, orientation: horizontal, columns: 2]
    - ConditionalGroup [when: "$applicantInfo.orgType != null"] with orgSubType TextInput
    - Divider
    - Heading [level: 3, "Contact Details"]
    - Grid [columns: 3, responsive: { sm: { columns: 1 }, md: { columns: 2 } }] with 3x ContactField custom components
    - Text [when: nonprofit, format: markdown]
  - Panel [position: right, title: "Applicant Help", width: "280px"]
    - Alert [severity: info, EIN help]
    - Text [format: markdown, org type guidance]

**Page 2 "Project Narrative":**
- Stack
  - TextInput [projectTitle]
  - TextInput [abstract, maxLines: 8]
  - Badge [text: "Draft", variant: warning, when: empty abstract]
  - Rating [selfAssessment, max: 5, icon: star]
  - Tabs [tabLabels: ["Schedule", "Rates & Areas"]]
    - Stack (Schedule tab)
      - Grid [columns: 2] with DatePickers (startDate with format, endDate), NumberInput (duration), Spacer [size]
    - Stack (Rates & Areas tab)
      - Slider [indirectRate, min: 0, max: 60, step: 0.5, showValue, showTicks, when: not government]
      - CheckboxGroup [focusAreas, columns: 2, selectAll: true]
  - ProgressBar [value: 3, max: 6, label, showPercent]

**Page 3 "Budget":**
- Stack
  - Text [instructional]
  - DataTable [lineItems, allowAdd, allowRemove, showRowNumbers]
  - Card [title: "Budget Summary", elevation: 1]
    - Summary [items: totalDirect, indirectCosts, grandTotal]
  - Grid [columns: 2] with MoneyInput [requestedAmount, currency: USD, showCurrency] + Spacer
  - Toggle [usesSubcontractors, onLabel: Yes, offLabel: No]
  - Popover [triggerLabel: "Budget Guidelines", placement: bottom]
    - Text [format: markdown, budget guidance]

**Page 4 "Project Phases":**
- Stack
  - Text [instructional]
  - Accordion [allowMultiple: true, defaultOpen: 0]
    - Card [title: "Phase"]
      - TextInput [phaseName]
      - DataTable [phaseTasks, allowAdd, allowRemove]
      - Grid [columns: 2] with phase total Text displays
  - Card [title: "Phases Summary"]
    - Grid [columns: 2] with projectPhasesTotal Text display

**Page 5 "Subcontractors":**
- ConditionalGroup [when: usesSubcontractors, fallback: "No subcontractors needed..."]
  - Stack
    - Alert [severity: info, dismissible: true, 49% cap]
    - DataTable [subcontractors, allowAdd, allowRemove]
    - Modal [title: "Certification Requirements", trigger: button, triggerLabel: "View Requirements", size: md, closable]
      - Text [format: markdown, certification text]

**Page 6 "Review & Submit":**
- Stack [accessibility: { role: region, description: "Application review and submission" }]
  - Alert [severity: info]
  - Collapsible [Applicant Information, defaultOpen: true] → Summary with optionSet
  - Collapsible [Project Narrative, defaultOpen: true] → Summary
  - Collapsible [Budget, defaultOpen: true] → Summary
  - Collapsible [Project Phases, defaultOpen: false] → Summary
  - Divider [label: "Supporting Documents"]
  - Stack
    - FileUpload [narrativeDoc, accept, maxSize, dragDrop: true]
    - FileUpload [budgetJustification, accept, maxSize]
    - Signature [approverSignature, strokeColor: "#000", height: 200, penWidth: 2, clearable: true]
  - Alert [severity: warning, cssClass: "review-alert", when: submit validation warning, text about checking before submitting]

**Step 2: Validate against schema**

Run: `python3 -c "import json, jsonschema; s=json.load(open('schemas/component.schema.json')); d=json.load(open('examples/grant-application/component.json')); jsonschema.validate(d, s); print('VALID')"`
Expected: `VALID`

**Step 3: Commit**

```bash
git add examples/grant-application/component.json
git commit -m "feat(grant-app): rewrite component.json as spec showcase with all 33 component types"
```

---

### Task 3: Run full E2E suite and triage failures

**Files:**
- None (diagnostic task)

**Step 1: Run the full E2E suite**

Run: `npx playwright test tests/e2e/playwright/ --timeout 30000 2>&1 | tail -50`

**Step 2: Categorize failures**

Sort each failure into one of these buckets:
1. **Structure-dependent** — test checks DOM selectors that changed (page titles, component classes, field positions). These need updating.
2. **Engine-dependent** — test checks engine values that should still work. These are bugs if they fail.
3. **Pre-existing** — tests that were already failing before (e.g., accessibility-responsive "responsive props" test).

Capture the exact list of failing tests and their failure messages.

**Step 3: No commit (diagnostic only)**

---

### Task 4: Update structure-dependent component tests

Based on the test dependency analysis, these files are at risk:

**Files that use `mountGrantApplication` and check DOM structure:**
- Modify: `tests/e2e/playwright/components/component-tree-rendering.spec.ts`
- Modify: `tests/e2e/playwright/components/grant-app-component-props.spec.ts`
- Modify: `tests/e2e/playwright/components/component-tree-engine-alignment.spec.ts`
- Modify: `tests/e2e/playwright/components/component-gap-coverage.spec.ts`

**Files that use synthetic fixtures (should NOT break from component.json changes, but verify):**
- Verify: `tests/e2e/playwright/components/progressive-component-rendering.spec.ts`
- Verify: `tests/e2e/playwright/components/accessibility-responsive-custom-components.spec.ts`
- Verify: `tests/e2e/playwright/components/core-component-props-and-fixes.spec.ts`

**Step 1: Fix each failing test**

For each broken test:
- Read the test to understand what it's actually verifying
- If it verifies engine behavior (signals, values) → keep the assertion, update the selector
- If it verifies component structure that changed → update to match new structure
- If it verifies a feature we no longer use → delete the test
- If it verifies a feature the new component.json exercises differently → rewrite the test

Key structural changes to account for:
- Page 1 now uses Columns + Panel instead of flat Stack+Grid
- Page 2 now uses Tabs wrapping schedule/rates content
- Page 3 Budget Summary now uses Summary component instead of Grid+Text pairs
- Page 4 now uses Accordion instead of Card-with-bind
- Page 5 now has Modal and fallback text
- Page 6 now has accessibility block, Signature, Divider with label, cssClass

**Step 2: Run the updated tests**

Run: `npx playwright test tests/e2e/playwright/components/ --timeout 30000`
Expected: All pass (except pre-existing failures)

**Step 3: Commit**

```bash
git add tests/e2e/playwright/components/
git commit -m "test(grant-app): update component tests for new spec-showcase component tree"
```

---

### Task 5: Update integration tests if any broke

**Files:**
- Possibly modify: `tests/e2e/playwright/integration/grant-app-discovered-issues.spec.ts`
- Possibly modify: `tests/e2e/playwright/integration/grant-app-wizard-flow.spec.ts`
- Possibly modify: `tests/e2e/playwright/integration/grant-app-visibility-and-pruning.spec.ts`
- Possibly modify: `tests/e2e/playwright/integration/grant-app-data-types.spec.ts`

Most integration tests are engine-only and should not break. The ones that might:
- `grant-app-discovered-issues.spec.ts` — 4 tests that look for `input[name*="phaseTasks"]` inputs (Project Phases structure changed to Accordion)
- `grant-app-wizard-flow.spec.ts` — checks wizard step count (still 6 pages, should be fine)
- `grant-app-visibility-and-pruning.spec.ts` — checks `[data-name="projectNarrative.indirectRate"]` visibility

**Step 1: Fix each failing integration test using same triage approach as Task 4**

**Step 2: Run integration tests**

Run: `npx playwright test tests/e2e/playwright/integration/ --timeout 30000`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/e2e/playwright/integration/
git commit -m "test(grant-app): update integration tests for new component structure"
```

---

### Task 6: Full regression verification

**Step 1: Run the complete E2E suite**

Run: `npx playwright test tests/e2e/playwright/ --timeout 30000`
Expected: All pass (except pre-existing: accessibility-responsive "responsive props" test)

**Step 2: Run Python conformance suite**

Run: `python3 -m pytest tests/ -q`
Expected: All pass

**Step 3: Validate all schemas**

Run: `python3 -c "import json, jsonschema; [jsonschema.validate(json.load(open(f'examples/grant-application/{f}')), json.load(open(f'schemas/{s}'))) or print(f'{f}: VALID') for f, s in [('definition.json', 'definition.schema.json'), ('component.json', 'component.schema.json'), ('theme.json', 'theme.schema.json')]]"`
Expected: All VALID

**Step 4: Commit (if any fixes were needed)**

---

### Task 7: Final commit and cleanup

**Step 1: Commit the design doc**

```bash
git add docs/plans/2026-02-28-component-json-redesign.md docs/plans/2026-02-28-component-json-implementation.md
git commit -m "docs: add component.json redesign design and implementation plans"
```
