# Grant Application Example — Amendment: Missing Feature Coverage

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-02-25
**Status:** Approved
**Amends:** `2026-02-25-grant-application-example.md`
**Trigger:** Post-implementation gap analysis against `thoughts/feature-implementation-matrix.md`

---

## What this amends

The original example omitted several non-trivial spec features that fit naturally in the grant domain. The analysis identified three tiers of missing coverage:

1. **Definition MIPs** — `required`, `readonly`, `default`, and per-bind `whitespace` are entirely absent; `required` in particular is a fundamental bind property
2. **Shape expressiveness** — no `timing: continuous` shape, no `info` severity, and no shape `context` block
3. **Component gaps** — `Summary` (review step), `FileUpload` (attachment upload), `Alert` (inline feedback), and the `Collapsible` component are all unshown despite fitting the domain naturally

Items deliberately excluded from this amendment (either wrong domain or overkill):
- Rating, Slider, Signature — not applicable to a grant form
- Shape `and`/`or` composition — the existing shapes are already clear; synthetic composition adds noise
- Mapping `bidirectional`/`reverse` — forward-only mapping is the right default for submission; bidirectional belongs in a different example
- Stdlib functions like `prev`/`next`/`parent` — need a specific nested repeat use-case, not present here

---

## Changes by file

### Task 1: `definition.json` — add missing MIPs and shape features

**Files modified:** `examples/grant-application/definition.json`

**1a. Add `required` binds for critical fields**

Append to the `binds` array. These fields are semantically required — the form cannot be submitted without them:

```json
{ "path": "applicantInfo.orgName",            "required": "true" },
{ "path": "applicantInfo.ein",                "required": "true" },
{ "path": "applicantInfo.orgType",            "required": "true" },
{ "path": "applicantInfo.contactName",        "required": "true" },
{ "path": "applicantInfo.contactEmail",       "required": "true" },
{ "path": "projectNarrative.projectTitle",    "required": "true" },
{ "path": "projectNarrative.abstract",        "required": "true" },
{ "path": "projectNarrative.startDate",       "required": "true" },
{ "path": "projectNarrative.endDate",         "required": "true" },
{ "path": "budget.requestedAmount",           "required": "true" }
```

**1b. Add `readonly: true` to computed fields**

`duration` and `lineItems[*].subtotal` are both calculated — users should not be able to overwrite them. Merge these into the existing bind entries for those paths:

```json
{ "path": "projectNarrative.duration",
  "calculate": "dateDiff($projectNarrative.startDate, $projectNarrative.endDate, 'months')",
  "readonly": "true" },

{ "path": "budget.lineItems[*].subtotal",
  "calculate": "money(moneyAmount($unitCost) * $quantity, moneyCurrency($unitCost))",
  "readonly": "true" }
```

Note: The `dateDiff` argument order in the original definition has `endDate, startDate` reversed (returns negative months). Fix while merging: it should be `dateDiff($projectNarrative.startDate, $projectNarrative.endDate, 'months')`.

**1c. Add `default` bind for currency**

```json
{ "path": "budget.requestedAmount", "default": "money(0, 'USD')" }
```

This demonstrates the `default` bind property and ensures the currency field pre-populates to USD without requiring the user to type it.

**1d. Add `whitespace` on email and EIN**

Demonstrates the `whitespace` bind MIP on two natural use cases:

```json
{ "path": "applicantInfo.contactEmail", "whitespace": "trim" },
{ "path": "applicantInfo.ein",          "whitespace": "normalize" }
```

Merge these into the existing bind entries for `ein` and `contactEmail`.

**1e. Change EIN constraint to `timing: continuous`**

The EIN format check fires immediately as the user types — that is the right UX for a format constraint. Change the existing shape (not the bind constraint) or promote this to a `continuous` bind. Since it's currently a bind `constraint`, add a separate shape entry to demonstrate `timing`:

Add to `shapes`:

```json
{
  "id": "abstractLength",
  "target": "projectNarrative.abstract",
  "severity": "info",
  "timing": "continuous",
  "constraint": "length($projectNarrative.abstract) <= 3000",
  "message": "Abstract is approaching the 500-word / 3,000-character limit.",
  "code": "ABSTRACT_NEAR_LIMIT"
}
```

This exercises:
- `info` severity (the only missing severity level)
- `timing: continuous` (real-time validation, not just on submit)
- A plausible field-level guidance shape

**1f. Add `context` to the budgetMatch shape**

Add a structured `context` block to the existing `budgetMatch` shape to demonstrate the `context` property:

```json
{
  "id": "budgetMatch",
  "target": "budget.requestedAmount",
  "severity": "error",
  "constraint": "abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1",
  "message": "Requested amount must match the calculated grand total (within $1). Check your line items.",
  "code": "BUDGET_MISMATCH",
  "context": {
    "grandTotal":   "string(moneyAmount(@grandTotal))",
    "requested":    "string(moneyAmount($budget.requestedAmount))",
    "difference":   "string(abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)))"
  }
}
```

**1g. Add `fileAttachments` group for the new page**

Add a new top-level group after `subcontractors`. This provides the definition backing for the FileUpload component added in Task 2:

```json
{
  "type": "group",
  "key": "attachments",
  "label": "Supporting Documents",
  "presentation": { "page": "Review & Submit" },
  "children": [
    {
      "type": "field",
      "key": "narrativeDoc",
      "label": "Project Narrative Document",
      "dataType": "string",
      "hint": "Upload a PDF or Word document with full project narrative (max 10 MB)."
    },
    {
      "type": "field",
      "key": "budgetJustification",
      "label": "Budget Justification",
      "dataType": "string",
      "hint": "Upload a spreadsheet or PDF with budget detail (max 5 MB)."
    }
  ]
}
```

Using `dataType: "string"` for file references follows the pattern that the value is a file name/URL string stored after upload processing.

---

### Task 2: `component.json` — add Review & Submit page (page 5)

**Files modified:** `examples/grant-application/component.json`

Add a fifth `Page` child to the `Wizard`. It demonstrates `Summary`, `FileUpload`, `Alert`, and `Collapsible`:

```json
{
  "component": "Page",
  "title": "Review & Submit",
  "children": [
    {
      "component": "Stack",
      "gap": "lg",
      "children": [
        {
          "component": "Alert",
          "severity": "info",
          "text": "Review all information below before submitting. Use Previous to go back and make corrections."
        },
        {
          "component": "Collapsible",
          "summary": "Applicant Information",
          "children": [
            {
              "component": "Summary",
              "items": [
                { "label": "Organization Name",  "bind": "applicantInfo.orgName" },
                { "label": "EIN",                "bind": "applicantInfo.ein" },
                { "label": "Organization Type",  "bind": "applicantInfo.orgType" },
                { "label": "Contact Name",        "bind": "applicantInfo.contactName" },
                { "label": "Contact Email",       "bind": "applicantInfo.contactEmail" },
                { "label": "Contact Phone",       "bind": "applicantInfo.contactPhone" }
              ]
            }
          ]
        },
        {
          "component": "Collapsible",
          "summary": "Project Narrative",
          "children": [
            {
              "component": "Summary",
              "items": [
                { "label": "Project Title",    "bind": "projectNarrative.projectTitle" },
                { "label": "Start Date",       "bind": "projectNarrative.startDate" },
                { "label": "End Date",         "bind": "projectNarrative.endDate" },
                { "label": "Duration",         "bind": "projectNarrative.duration" },
                { "label": "Indirect Rate",    "bind": "projectNarrative.indirectRate" }
              ]
            }
          ]
        },
        {
          "component": "Collapsible",
          "summary": "Budget",
          "children": [
            {
              "component": "Summary",
              "items": [
                { "label": "Total Direct Costs", "bind": "totalDirect" },
                { "label": "Indirect Costs",     "bind": "indirectCosts" },
                { "label": "Grand Total",        "bind": "grandTotal" },
                { "label": "Requested Amount",   "bind": "budget.requestedAmount" }
              ]
            }
          ]
        },
        {
          "component": "Stack",
          "gap": "md",
          "children": [
            { "component": "Heading", "level": 3, "text": "Supporting Documents" },
            {
              "component": "FileUpload",
              "bind": "attachments.narrativeDoc",
              "allowedTypes": ["application/pdf", "application/msword",
                               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
              "maxSize": 10485760,
              "label": "Project Narrative Document"
            },
            {
              "component": "FileUpload",
              "bind": "attachments.budgetJustification",
              "allowedTypes": ["application/pdf",
                               "application/vnd.ms-excel",
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
              "maxSize": 5242880,
              "label": "Budget Justification"
            }
          ]
        }
      ]
    }
  ]
}
```

Also add `"Subcontractors"` step-icon entry to the progress nav sidebar in `index.html` and a new `"Review & Submit"` entry:

```html
<li data-page="Review &amp; Submit">
  <span class="step-icon"></span>
  Review &amp; Submit
</li>
```

---

### Task 3: `mapping.json` — add `coerce` and `array: each`

**Files modified:** `examples/grant-application/mapping.json`

**3a. Add `coerce` on duration**

```json
{
  "sourcePath": "projectNarrative.duration",
  "targetPath": "project.duration_months",
  "transform": "coerce",
  "coerce": "number",
  "priority": 80
}
```

This demonstrates the `coerce` transform type. Remove the existing `preserve` rule for this path.

**3b. Change `lineItems` from `array: whole` to `array: each` with per-field rules**

Replace the current whole-array `lineItems` rule with an `array: each` rule that maps fields individually. This demonstrates nested per-element mapping:

```json
{
  "sourcePath": "budget.lineItems",
  "targetPath": "budget.line_items",
  "transform": "preserve",
  "array": {
    "mode": "each",
    "rules": [
      { "sourcePath": "category",    "targetPath": "cat",         "transform": "preserve" },
      { "sourcePath": "description", "targetPath": "desc",        "transform": "preserve" },
      { "sourcePath": "quantity",    "targetPath": "qty",         "transform": "coerce", "coerce": "number" },
      { "sourcePath": "unitCost",    "targetPath": "unit_cost",   "transform": "expression",
        "expression": "moneyAmount(@source.unitCost)" },
      { "sourcePath": "subtotal",    "targetPath": "line_total",  "transform": "expression",
        "expression": "moneyAmount(@source.subtotal)" }
    ]
  },
  "priority": 60
}
```

**3c. Add a `concat` rule for the contact full address**

Demonstrates the `concat` transform:

```json
{
  "targetPath": "organization.contact.display",
  "transform": "concat",
  "expression": "$applicantInfo.contactName & ' <' & $applicantInfo.contactEmail & '>'",
  "priority": 90
}
```

---

### Task 4: update `docs/grant-application-guide.md`

**Files modified:** `docs/grant-application-guide.md`

Add a new section 9 (before the current conclusion) covering:

- **Section 9: Bind completeness** — explain `required`, `readonly`, `default`, `whitespace` with the specific examples from this amendment
- **Section 10: Shapes — severity, timing, and context** — explain the three severity levels using the new `abstractLength` (info/continuous) and updated `budgetMatch` (with context) shapes
- **Section 11: Review & Submit page** — walk through Summary inside Collapsible, FileUpload, and Alert; explain why a review step is important for multi-page forms

Renumber the former section 9 (conclusion) to section 12.

---

## Acceptance criteria

- [ ] All currently-absent bind MIPs are demonstrated: `required`, `readonly`, `default`, `whitespace`
- [ ] `info` severity and `timing: continuous` appear in at least one shape each
- [ ] A shape `context` block is present with FEL-computed values
- [ ] `Summary` component renders review data from all preceding pages
- [ ] `Collapsible` wraps each review section
- [ ] `FileUpload` appears with `allowedTypes` and `maxSize`
- [ ] `Alert` appears at least once in the component tree
- [ ] Mapping uses `coerce`, `array: each` with nested rules, and `concat`
- [ ] `docs/grant-application-guide.md` covers the new features
- [ ] `npm run docs:check` passes with no regressions
- [ ] The form still renders correctly end-to-end in the browser
- [ ] The calculated `duration` and `subtotal` fields are not editable in the UI (readonly enforced)
