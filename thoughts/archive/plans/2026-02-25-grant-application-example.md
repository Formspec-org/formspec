# Grant Application Vertical Slice — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete, runnable grant application example that demonstrates the full Formspec lifecycle: authoring → browser rendering → submission → server re-validation → mapping output.

**Architecture:** A self-contained `examples/grant-application/` directory containing all JSON artifacts (definition, component, theme, mapping), a static `index.html` that renders the form via `<formspec-render>`, and a FastAPI server that re-validates and maps submissions. A narrative guide in `docs/grant-application-guide.md` is added to the Makefile docs target.

**Tech Stack:** Formspec engine + webcomponent (TypeScript, built), FastAPI + uvicorn (Python), jsonschema, pandoc (docs generation)

---

### Task 1: `definition.json` — 4-page grant application form

**Files:**
- Create: `examples/grant-application/definition.json`

**Context:** This is the core artifact. Read `specs/core/spec.llm.md` if anything below is unclear. Key things to know:
- `optionSets` is an object keyed by set name, each with an `options` array of `{value, label}`
- `variables` is an array, each with `name` (referenced as `@name` in FEL) and `expression`
- `binds` is an array; each bind has `path` (dot-notation, use `[*]` for repeats) plus any MIP properties
- `shapes` is an array; `target: "#"` means form-root scope
- `presentation.page` on a group item sets the wizard page name
- Money fields are objects `{amount: "123.00", currency: "USD"}` — use `moneyAmount()`, `moneyCurrency()`, `moneyAdd()`, `moneySum()` in FEL
- `dateDiff($a, $b, 'months')` returns an integer
- `matches($str, "regex")` returns boolean

**Step 1: Create the definition**

```json
{
  "$formspec": "1.0",
  "url": "https://example.gov/forms/grant-application",
  "version": "1.0.0",
  "status": "active",
  "title": "Federal Grant Application",
  "description": "Standard federal grant application demonstrating the full Formspec feature set.",
  "date": "2026-02-25",
  "name": "grant-application",
  "nonRelevantBehavior": "remove",
  "formPresentation": {
    "pageMode": "wizard",
    "labelPosition": "top",
    "density": "comfortable"
  },
  "optionSets": {
    "budgetCategories": {
      "options": [
        { "value": "personnel",    "label": "Personnel" },
        { "value": "fringe",       "label": "Fringe Benefits" },
        { "value": "travel",       "label": "Travel" },
        { "value": "equipment",    "label": "Equipment" },
        { "value": "supplies",     "label": "Supplies" },
        { "value": "contractual",  "label": "Contractual" },
        { "value": "other",        "label": "Other Direct Costs" }
      ]
    },
    "orgTypes": {
      "options": [
        { "value": "nonprofit",    "label": "Nonprofit Organization" },
        { "value": "university",   "label": "University / Research Institution" },
        { "value": "government",   "label": "State / Local Government" },
        { "value": "forprofit",    "label": "For-Profit Entity" }
      ]
    }
  },
  "variables": [
    {
      "name": "totalDirect",
      "expression": "moneySum($lineItems[*].subtotal)"
    },
    {
      "name": "indirectCosts",
      "expression": "if($orgType = 'government') then money(0, 'USD') else money(moneyAmount(@totalDirect) * ($indirectRate ?? 0) / 100, moneyCurrency(@totalDirect))"
    },
    {
      "name": "grandTotal",
      "expression": "moneyAdd(@totalDirect, @indirectCosts)"
    }
  ],
  "items": [
    {
      "type": "group",
      "key": "applicantInfo",
      "label": "Applicant Information",
      "presentation": { "page": "Applicant Info" },
      "children": [
        {
          "type": "field",
          "key": "orgName",
          "label": "Organization Name",
          "dataType": "string",
          "hint": "Legal name of the applying organization."
        },
        {
          "type": "field",
          "key": "ein",
          "label": "Employer Identification Number (EIN)",
          "dataType": "string",
          "hint": "Format: XX-XXXXXXX"
        },
        {
          "type": "field",
          "key": "orgType",
          "label": "Organization Type",
          "dataType": "choice",
          "optionSet": "orgTypes"
        },
        {
          "type": "field",
          "key": "contactName",
          "label": "Primary Contact Name",
          "dataType": "string"
        },
        {
          "type": "field",
          "key": "contactEmail",
          "label": "Contact Email",
          "dataType": "string"
        },
        {
          "type": "field",
          "key": "contactPhone",
          "label": "Contact Phone",
          "dataType": "string"
        },
        {
          "type": "display",
          "key": "nonprofitPhoneHint",
          "label": "Include area code for nonprofit reporting requirements (e.g. 202-555-0100)."
        }
      ]
    },
    {
      "type": "group",
      "key": "projectNarrative",
      "label": "Project Narrative",
      "presentation": { "page": "Project Narrative" },
      "children": [
        {
          "type": "field",
          "key": "projectTitle",
          "label": "Project Title",
          "dataType": "string"
        },
        {
          "type": "field",
          "key": "abstract",
          "label": "Project Abstract",
          "dataType": "text",
          "hint": "Summarize your project in 500 words or fewer."
        },
        {
          "type": "field",
          "key": "startDate",
          "label": "Project Start Date",
          "dataType": "date"
        },
        {
          "type": "field",
          "key": "endDate",
          "label": "Project End Date",
          "dataType": "date"
        },
        {
          "type": "field",
          "key": "duration",
          "label": "Duration (months)",
          "dataType": "integer"
        },
        {
          "type": "field",
          "key": "indirectRate",
          "label": "Indirect Cost Rate (%)",
          "dataType": "decimal",
          "hint": "Enter your organization's negotiated indirect cost rate. Government entities are not eligible."
        }
      ]
    },
    {
      "type": "group",
      "key": "budget",
      "label": "Budget",
      "presentation": { "page": "Budget" },
      "children": [
        {
          "type": "group",
          "key": "lineItems",
          "label": "Budget Line Items",
          "repeatable": true,
          "minRepeat": 1,
          "maxRepeat": 20,
          "children": [
            {
              "type": "field",
              "key": "category",
              "label": "Category",
              "dataType": "choice",
              "optionSet": "budgetCategories"
            },
            {
              "type": "field",
              "key": "description",
              "label": "Description",
              "dataType": "string"
            },
            {
              "type": "field",
              "key": "quantity",
              "label": "Qty",
              "dataType": "integer"
            },
            {
              "type": "field",
              "key": "unitCost",
              "label": "Unit Cost",
              "dataType": "money"
            },
            {
              "type": "field",
              "key": "subtotal",
              "label": "Subtotal",
              "dataType": "money"
            }
          ]
        },
        {
          "type": "field",
          "key": "requestedAmount",
          "label": "Total Requested Amount",
          "dataType": "money",
          "hint": "Must match the calculated grand total."
        },
        {
          "type": "field",
          "key": "usesSubcontractors",
          "label": "Does this project use subcontractors?",
          "dataType": "boolean"
        }
      ]
    },
    {
      "type": "group",
      "key": "subcontractors",
      "label": "Subcontractors",
      "presentation": { "page": "Subcontractors" },
      "repeatable": true,
      "minRepeat": 1,
      "maxRepeat": 10,
      "children": [
        {
          "type": "field",
          "key": "subName",
          "label": "Contact Name",
          "dataType": "string"
        },
        {
          "type": "field",
          "key": "subOrg",
          "label": "Organization",
          "dataType": "string"
        },
        {
          "type": "field",
          "key": "subAmount",
          "label": "Contracted Amount",
          "dataType": "money"
        },
        {
          "type": "field",
          "key": "subScope",
          "label": "Scope of Work",
          "dataType": "text"
        }
      ]
    }
  ],
  "binds": [
    {
      "path": "applicantInfo.nonprofitPhoneHint",
      "relevant": "$applicantInfo.orgType = 'nonprofit'"
    },
    {
      "path": "applicantInfo.ein",
      "constraint": "matches($applicantInfo.ein, '^\\d{2}-\\d{7}$')",
      "constraintMessage": "EIN must be in the format XX-XXXXXXX (e.g. 12-3456789)."
    },
    {
      "path": "projectNarrative.endDate",
      "constraint": "$projectNarrative.endDate > $projectNarrative.startDate",
      "constraintMessage": "End date must be after start date."
    },
    {
      "path": "projectNarrative.duration",
      "calculate": "dateDiff($projectNarrative.startDate, $projectNarrative.endDate, 'months')",
      "readonly": true
    },
    {
      "path": "projectNarrative.indirectRate",
      "relevant": "$applicantInfo.orgType != 'government'"
    },
    {
      "path": "lineItems[*].subtotal",
      "calculate": "money(moneyAmount($unitCost) * $quantity, moneyCurrency($unitCost))",
      "readonly": true
    },
    {
      "path": "subcontractors",
      "relevant": "$budget.usesSubcontractors"
    }
  ],
  "shapes": [
    {
      "id": "budgetMatch",
      "target": "budget.requestedAmount",
      "severity": "error",
      "constraint": "abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1",
      "message": "Requested amount must match the calculated grand total (within $1). Check your line items.",
      "code": "BUDGET_MISMATCH"
    },
    {
      "id": "budgetReasonable",
      "target": "#",
      "severity": "warning",
      "constraint": "moneyAmount(@grandTotal) < 500000",
      "message": "Projects over $500,000 require additional narrative justification in the abstract.",
      "code": "BUDGET_OVER_THRESHOLD"
    },
    {
      "id": "subcontractorCap",
      "target": "#",
      "severity": "error",
      "activeWhen": "$budget.usesSubcontractors",
      "constraint": "moneyAmount(moneySum($subcontractors[*].subAmount)) <= moneyAmount(@grandTotal) * 0.49",
      "message": "Subcontractor costs may not exceed 49% of the total project budget (federal requirement).",
      "code": "SUBCONTRACTOR_CAP_EXCEEDED"
    }
  ]
}
```

**Step 2: Verify it lints cleanly**

```bash
cd /home/exedev/formspec
python3 -m formspec.validator examples/grant-application/definition.json
```

Expected: zero errors. Warnings about missing required fields on draft are acceptable; errors are not.

**Step 3: Commit**

```bash
git add examples/grant-application/definition.json
git commit -m "feat(example): add grant application definition"
```

---

### Task 2: `theme.json` — USWDS-flavored token set

**Files:**
- Create: `examples/grant-application/theme.json`

**Context:** Themes are Tier 2 sidecar documents. Required fields: `$formspecTheme`, `version`, `targetDefinition`. Tokens use flat dot-notation keys (e.g. `"color.primary"`) — see kitchen-sink-holistic theme for reference structure. The `selectors` array matches items by `type`/`dataType` and applies presentation overrides. `defaults` applies to all items.

**Step 1: Create the theme**

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "name": "grant-application-theme",
  "title": "Grant Application Theme",
  "platform": "web",
  "targetDefinition": {
    "url": "https://example.gov/forms/grant-application",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tokens": {
    "color.primary":       "#005ea2",
    "color.primaryDark":   "#1a4480",
    "color.primaryLight":  "#d9e8f6",
    "color.success":       "#00a91c",
    "color.warning":       "#ffbe2e",
    "color.error":         "#e52207",
    "color.neutral50":     "#f9f9f9",
    "color.neutral100":    "#f0f0f0",
    "color.neutral200":    "#dfe1e2",
    "color.neutral400":    "#a9aeb1",
    "color.neutral700":    "#565c65",
    "color.text":          "#1b1b1b",
    "color.textMuted":     "#71767a",
    "space.xs":            "4px",
    "space.sm":            "8px",
    "space.md":            "16px",
    "space.lg":            "24px",
    "space.xl":            "40px",
    "type.fontFamily":     "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "type.baseSize":       "16px",
    "type.lineHeight":     "1.5",
    "radius.sm":           "4px",
    "radius.md":           "8px",
    "focusRing":           "0 0 0 3px #2491ff"
  },
  "defaults": {
    "labelPosition": "top",
    "style": {
      "fontFamily": "$token.type.fontFamily",
      "fontSize":   "$token.type.baseSize"
    }
  },
  "selectors": [
    {
      "match": { "dataType": "text" },
      "apply": {
        "style": { "lineHeight": "$token.type.lineHeight" }
      }
    },
    {
      "match": { "dataType": "money" },
      "apply": { "widget": "MoneyInput" }
    },
    {
      "match": { "dataType": "choice" },
      "apply": { "widget": "RadioGroup" }
    },
    {
      "match": { "dataType": "boolean" },
      "apply": { "widget": "Toggle" }
    }
  ]
}
```

**Step 2: Commit**

```bash
git add examples/grant-application/theme.json
git commit -m "feat(example): add grant application theme"
```

---

### Task 3: `component.json` — Wizard layout tree

**Files:**
- Create: `examples/grant-application/component.json`

**Context:** Component documents are Tier 3. Required fields: `$formspecComponent`, `version`, `targetDefinition`, `tree`. The `tree` must have exactly one root node. `bind` on input components takes an item `key` (not a dotted path — the engine resolves scope from context). Inside a `DataTable` bound to a repeat group, child `bind` values are sibling keys within that group. `ConditionalGroup` with `when` hides/shows its children visually without affecting data semantics — use it for the subcontractors page wrapper. The `Wizard` component's children must all be `Page` nodes.

**Step 1: Create the component document**

```json
{
  "$formspecComponent": "1.0",
  "version": "1.0.0",
  "name": "grant-application-component",
  "title": "Grant Application Layout",
  "targetDefinition": {
    "url": "https://example.gov/forms/grant-application",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tree": {
    "component": "Wizard",
    "allowSkip": false,
    "children": [
      {
        "component": "Page",
        "title": "Applicant Info",
        "children": [
          {
            "component": "Stack",
            "gap": "lg",
            "children": [
              { "component": "Heading", "level": 2, "text": "Applicant Information" },
              {
                "component": "Grid",
                "columns": 2,
                "children": [
                  { "component": "TextInput",  "bind": "orgName",      "placeholder": "Acme Nonprofit, Inc." },
                  { "component": "TextInput",  "bind": "ein",          "placeholder": "12-3456789" },
                  { "component": "RadioGroup", "bind": "orgType" },
                  { "component": "Spacer" },
                  { "component": "TextInput",  "bind": "contactName",  "placeholder": "Jane Smith" },
                  { "component": "TextInput",  "bind": "contactEmail", "placeholder": "jane@example.org" }
                ]
              },
              {
                "component": "Grid",
                "columns": 2,
                "children": [
                  { "component": "TextInput", "bind": "contactPhone", "placeholder": "202-555-0100" },
                  { "component": "Spacer" }
                ]
              },
              { "component": "Text", "bind": "nonprofitPhoneHint" }
            ]
          }
        ]
      },
      {
        "component": "Page",
        "title": "Project Narrative",
        "children": [
          {
            "component": "Stack",
            "gap": "lg",
            "children": [
              { "component": "Heading", "level": 2, "text": "Project Narrative" },
              { "component": "TextInput", "bind": "projectTitle", "placeholder": "Community Health Outreach Initiative" },
              { "component": "TextInput", "bind": "abstract",     "multiline": true, "rows": 8 },
              {
                "component": "Grid",
                "columns": 2,
                "children": [
                  { "component": "DatePicker", "bind": "startDate" },
                  { "component": "DatePicker", "bind": "endDate" },
                  { "component": "NumberInput", "bind": "duration", "readonly": true },
                  { "component": "NumberInput", "bind": "indirectRate", "suffix": "%" }
                ]
              }
            ]
          }
        ]
      },
      {
        "component": "Page",
        "title": "Budget",
        "children": [
          {
            "component": "Stack",
            "gap": "lg",
            "children": [
              { "component": "Heading", "level": 2, "text": "Project Budget" },
              { "component": "Text", "text": "Add one row per budget line item. Subtotals are calculated automatically." },
              {
                "component": "DataTable",
                "bind": "lineItems",
                "columns": [
                  { "component": "Select",      "bind": "category",    "label": "Category" },
                  { "component": "TextInput",   "bind": "description", "label": "Description" },
                  { "component": "NumberInput", "bind": "quantity",    "label": "Qty" },
                  { "component": "MoneyInput",  "bind": "unitCost",    "label": "Unit Cost" },
                  { "component": "Text",        "bind": "subtotal",    "label": "Subtotal", "style": { "textAlign": "right" } }
                ]
              },
              {
                "component": "Card",
                "style": { "background": "$token.color.primaryLight", "padding": "$token.space.lg" },
                "children": [
                  { "component": "Heading", "level": 4, "text": "Budget Summary" },
                  {
                    "component": "Grid",
                    "columns": 2,
                    "children": [
                      { "component": "Text", "text": "Total Direct Costs" },
                      { "component": "Text", "bind": "totalDirect",   "style": { "textAlign": "right", "fontWeight": "bold" } },
                      { "component": "Text", "text": "Indirect Costs" },
                      { "component": "Text", "bind": "indirectCosts", "style": { "textAlign": "right" } },
                      { "component": "Divider" },
                      { "component": "Divider" },
                      { "component": "Text", "text": "Grand Total", "style": { "fontWeight": "bold" } },
                      { "component": "Text", "bind": "grandTotal",    "style": { "textAlign": "right", "fontWeight": "bold" } }
                    ]
                  }
                ]
              },
              {
                "component": "Grid",
                "columns": 2,
                "children": [
                  { "component": "MoneyInput", "bind": "requestedAmount" },
                  { "component": "Spacer" }
                ]
              },
              { "component": "Toggle", "bind": "usesSubcontractors" }
            ]
          }
        ]
      },
      {
        "component": "Page",
        "title": "Subcontractors",
        "children": [
          {
            "component": "ConditionalGroup",
            "when": "$budget.usesSubcontractors",
            "children": [
              {
                "component": "Stack",
                "gap": "lg",
                "children": [
                  { "component": "Heading", "level": 2, "text": "Subcontractors" },
                  { "component": "Text", "text": "List all subcontractors. Total subcontractor costs may not exceed 49% of the project budget." },
                  {
                    "component": "DataTable",
                    "bind": "subcontractors",
                    "columns": [
                      { "component": "TextInput",  "bind": "subName",   "label": "Contact Name" },
                      { "component": "TextInput",  "bind": "subOrg",    "label": "Organization" },
                      { "component": "MoneyInput", "bind": "subAmount", "label": "Amount" },
                      { "component": "TextInput",  "bind": "subScope",  "label": "Scope of Work" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add examples/grant-application/component.json
git commit -m "feat(example): add grant application component tree"
```

---

### Task 4: `mapping.json` — response → grants-management transform

**Files:**
- Create: `examples/grant-application/mapping.json`

**Context:** The mapping doc transforms the Formspec response `data` object into a flat JSON structure suitable for a grants management system. Key things to know:
- `transform: "preserve"` copies value as-is
- `transform: "valueMap"` uses the `valueMap` object for key→value substitution
- `transform: "expression"` evaluates a FEL-like expression using `@source` and `@target` bindings
- `transform: "drop"` explicitly excludes a field
- `condition` is a guard expression; if false the rule is skipped
- `array.mode: "whole"` copies the entire array; `array.mode: "expand"` flattens it
- For money fields (objects), use `expression` to extract just the `amount` string

**Step 1: Create the mapping document**

```json
{
  "version": "1.0.0",
  "definitionRef": "https://example.gov/forms/grant-application",
  "definitionVersion": ">=1.0.0 <2.0.0",
  "direction": "forward",
  "targetSchema": {
    "format": "json",
    "name": "Grants Management System Payload"
  },
  "rules": [
    {
      "sourcePath": "applicantInfo.orgName",
      "targetPath": "organization.name",
      "transform": "preserve",
      "priority": 100
    },
    {
      "sourcePath": "applicantInfo.ein",
      "targetPath": "organization.ein",
      "transform": "preserve",
      "priority": 100
    },
    {
      "sourcePath": "applicantInfo.orgType",
      "targetPath": "organization.type_code",
      "transform": "valueMap",
      "valueMap": {
        "nonprofit":   "NPO",
        "university":  "EDU",
        "government":  "GOV",
        "forprofit":   "FP"
      },
      "priority": 100
    },
    {
      "sourcePath": "applicantInfo.contactName",
      "targetPath": "organization.contact.name",
      "transform": "preserve",
      "priority": 90
    },
    {
      "sourcePath": "applicantInfo.contactEmail",
      "targetPath": "organization.contact.email",
      "transform": "preserve",
      "priority": 90
    },
    {
      "sourcePath": "applicantInfo.contactPhone",
      "targetPath": "organization.contact.phone",
      "transform": "preserve",
      "priority": 90
    },
    {
      "sourcePath": "projectNarrative.projectTitle",
      "targetPath": "project.title",
      "transform": "preserve",
      "priority": 80
    },
    {
      "sourcePath": "projectNarrative.abstract",
      "targetPath": "project.abstract",
      "transform": "preserve",
      "priority": 80
    },
    {
      "sourcePath": "projectNarrative.startDate",
      "targetPath": "project.start_date",
      "transform": "preserve",
      "priority": 80
    },
    {
      "sourcePath": "projectNarrative.endDate",
      "targetPath": "project.end_date",
      "transform": "preserve",
      "priority": 80
    },
    {
      "sourcePath": "projectNarrative.duration",
      "targetPath": "project.duration_months",
      "transform": "preserve",
      "priority": 80
    },
    {
      "sourcePath": "projectNarrative.indirectRate",
      "targetPath": "budget.indirect_rate_pct",
      "transform": "expression",
      "expression": "string(@source) & '%'",
      "priority": 70
    },
    {
      "sourcePath": "budget.requestedAmount",
      "targetPath": "budget.requested_amount",
      "transform": "expression",
      "expression": "@source.amount",
      "priority": 70
    },
    {
      "sourcePath": "budget.requestedAmount",
      "targetPath": "budget.currency",
      "transform": "expression",
      "expression": "@source.currency",
      "priority": 70
    },
    {
      "sourcePath": "lineItems",
      "targetPath": "budget.line_items",
      "transform": "preserve",
      "array": { "mode": "whole" },
      "priority": 60
    },
    {
      "sourcePath": "subcontractors",
      "targetPath": "subcontractors",
      "transform": "preserve",
      "array": { "mode": "whole" },
      "condition": "present($budget.usesSubcontractors)",
      "priority": 50
    }
  ]
}
```

**Step 2: Commit**

```bash
git add examples/grant-application/mapping.json
git commit -m "feat(example): add grant application mapping document"
```

---

### Task 5: `sample-submission.json` — complete valid response

**Files:**
- Create: `examples/grant-application/sample-submission.json`

**Context:** A `FormspecResponse` has required fields: `definitionUrl`, `definitionVersion`, `status`, `data` (the instance mirroring the item tree), `authored` (ISO 8601). The `data` object mirrors the item tree structure: top-level group keys are nested objects, repeat groups are arrays. Money fields are `{amount: "string", currency: "USD"}`. This sample should be valid — no errors — with a budget that matches the grand total.

Numbers for the sample:
- 2 budget line items: Personnel (2 FTE × $50,000 = $100,000) + Travel (1 × $5,000 = $5,000)
- Indirect rate: 20% → indirect = $21,000 → grand total = $126,000
- 1 subcontractor at $40,000 (< 49% of $126,000 = $61,740 ✓)
- Requested amount: $126,000

**Step 1: Create the sample submission**

```json
{
  "definitionUrl": "https://example.gov/forms/grant-application",
  "definitionVersion": "1.0.0",
  "status": "completed",
  "authored": "2026-02-25T12:00:00.000Z",
  "author": {
    "id": "user-001",
    "name": "Jane Smith"
  },
  "data": {
    "applicantInfo": {
      "orgName": "Community Health Partners, Inc.",
      "ein": "47-1234567",
      "orgType": "nonprofit",
      "contactName": "Jane Smith",
      "contactEmail": "jane.smith@chp.example.org",
      "contactPhone": "202-555-0142"
    },
    "projectNarrative": {
      "projectTitle": "Rural Telehealth Access Initiative",
      "abstract": "This project will expand telehealth services to underserved rural communities in three counties, providing access to primary care, mental health, and chronic disease management for an estimated 4,200 residents currently lacking regular healthcare access.",
      "startDate": "2026-09-01",
      "endDate": "2027-08-31",
      "duration": 12,
      "indirectRate": 20
    },
    "budget": {
      "lineItems": [
        {
          "category": "personnel",
          "description": "Program Director (0.5 FTE) + Care Coordinator (1.5 FTE)",
          "quantity": 2,
          "unitCost": { "amount": "50000.00", "currency": "USD" },
          "subtotal":  { "amount": "100000.00", "currency": "USD" }
        },
        {
          "category": "travel",
          "description": "Site visits and stakeholder meetings",
          "quantity": 1,
          "unitCost": { "amount": "5000.00", "currency": "USD" },
          "subtotal":  { "amount": "5000.00", "currency": "USD" }
        }
      ],
      "requestedAmount": { "amount": "126000.00", "currency": "USD" },
      "usesSubcontractors": true
    },
    "subcontractors": [
      {
        "subName": "Dr. Maria Gonzalez",
        "subOrg": "Regional Medical Consulting Group",
        "subAmount": { "amount": "40000.00", "currency": "USD" },
        "subScope": "Clinical protocol development and physician oversight for telehealth platform deployment."
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add examples/grant-application/sample-submission.json
git commit -m "feat(example): add grant application sample submission"
```

---

### Task 6: FastAPI server

**Files:**
- Create: `examples/grant-application/server/requirements.txt`
- Create: `examples/grant-application/server/main.py`

**Context:**
- Python FEL public API: `from formspec.fel import evaluate, parse` — `evaluate(expr, data)` returns `EvalResult` with `.value` and `.diagnostics`
- Python linter: `from formspec.validator.linter import lint` — `lint(doc, mode="authoring")` returns `list[LintDiagnostic]`; each diagnostic has `.severity`, `.message`, `.code`, `.path`
- MappingEngine: `from formspec.mapping.engine import MappingEngine` — `MappingEngine(mapping_doc).forward(data_dict)`
- The server lives inside `examples/grant-application/server/` but needs to import from `src/formspec/`. Run it from the repo root with `PYTHONPATH=src uvicorn examples.grant-application.server.main:app` — or set `sys.path` in `main.py`
- FastAPI: `from fastapi import FastAPI`, `from fastapi.middleware.cors import CORSMiddleware`, `from pydantic import BaseModel`

**Step 1: Create requirements.txt**

```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
jsonschema>=4.21.0
pydantic>=2.0.0
```

**Step 2: Create main.py (~90 lines)**

```python
"""Grant Application — Formspec reference server.

Run from repo root:
    PYTHONPATH=src uvicorn examples.grant_application.server.main:app --reload --port 8000

Or with the helper script:
    cd examples/grant-application && python -m uvicorn server.main:app --reload --port 8000
"""

import json
import sys
from pathlib import Path

# Allow running from the examples directory or repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from formspec.validator.linter import lint
from formspec.mapping.engine import MappingEngine
from formspec.fel import evaluate
from formspec.fel.types import to_python

EXAMPLE_DIR = Path(__file__).resolve().parent.parent
DEFINITION_PATH = EXAMPLE_DIR / "definition.json"
MAPPING_PATH = EXAMPLE_DIR / "mapping.json"

_definition: dict = json.loads(DEFINITION_PATH.read_text())
_mapping_doc: dict = json.loads(MAPPING_PATH.read_text())
_mapping_engine = MappingEngine(_mapping_doc)

app = FastAPI(title="Grant Application — Formspec Reference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubmitRequest(BaseModel):
    definitionUrl: str
    definitionVersion: str
    status: str
    authored: str
    data: dict
    author: dict | None = None
    subject: dict | None = None


class SubmitResponse(BaseModel):
    valid: bool
    validationResults: list[dict]
    mapped: dict
    diagnostics: list[str]


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/definition")
def get_definition():
    return _definition


@app.post("/submit", response_model=SubmitResponse)
def submit(request: SubmitRequest):
    if request.definitionUrl != _definition["url"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown definition URL: {request.definitionUrl}",
        )

    # 1. Re-lint the definition (catches any drift)
    lint_diags = lint(_definition, mode="authoring")
    diagnostics = [
        f"[{d.severity}] {d.path or '(root)'}: {d.message}"
        for d in lint_diags
        if d.severity in ("error", "warning")
    ]

    # 2. Server-side FEL re-validation of key constraints
    data = request.data
    validation_results: list[dict] = []

    def _check_constraint(expression: str, field_data: dict, path: str, message: str, code: str) -> None:
        result = evaluate(expression, field_data)
        value = to_python(result.value)
        if value is False:
            validation_results.append({
                "severity": "error",
                "path": path,
                "message": message,
                "constraintKind": "constraint",
                "code": code,
                "source": "bind",
            })

    applicant = data.get("applicantInfo", {})
    narrative = data.get("projectNarrative", {})
    budget_data = data.get("budget", {})
    line_items = budget_data.get("lineItems", [])
    subcontractors = data.get("subcontractors", [])

    # EIN format
    if applicant.get("ein"):
        _check_constraint(
            r"matches($ein, '^\d{2}-\d{7}$')",
            {"ein": applicant["ein"]},
            "applicantInfo.ein",
            "EIN must be in the format XX-XXXXXXX.",
            "CONSTRAINT_FAILED",
        )

    # Date ordering
    if narrative.get("startDate") and narrative.get("endDate"):
        _check_constraint(
            "$endDate > $startDate",
            {"startDate": narrative["startDate"], "endDate": narrative["endDate"]},
            "projectNarrative.endDate",
            "End date must be after start date.",
            "CONSTRAINT_FAILED",
        )

    # Budget match shape
    requested = budget_data.get("requestedAmount", {})
    total_direct = sum(
        float(li.get("subtotal", {}).get("amount", 0)) for li in line_items
    )
    indirect_rate = float(narrative.get("indirectRate") or 0)
    indirect = total_direct * indirect_rate / 100 if applicant.get("orgType") != "government" else 0.0
    grand_total = total_direct + indirect

    if requested.get("amount"):
        diff = abs(float(requested["amount"]) - grand_total)
        if diff >= 1:
            validation_results.append({
                "severity": "error",
                "path": "budget.requestedAmount",
                "message": "Requested amount must match the calculated grand total (within $1).",
                "constraintKind": "shape",
                "code": "BUDGET_MISMATCH",
                "source": "shape",
                "shapeId": "budgetMatch",
            })

    if grand_total >= 500000:
        validation_results.append({
            "severity": "warning",
            "path": "#",
            "message": "Projects over $500,000 require additional narrative justification.",
            "constraintKind": "shape",
            "code": "BUDGET_OVER_THRESHOLD",
            "source": "shape",
            "shapeId": "budgetReasonable",
        })

    # Subcontractor 49% cap
    if budget_data.get("usesSubcontractors") and subcontractors:
        sub_total = sum(float(s.get("subAmount", {}).get("amount", 0)) for s in subcontractors)
        if grand_total > 0 and sub_total > grand_total * 0.49:
            validation_results.append({
                "severity": "error",
                "path": "#",
                "message": "Subcontractor costs may not exceed 49% of the total project budget.",
                "constraintKind": "shape",
                "code": "SUBCONTRACTOR_CAP_EXCEEDED",
                "source": "shape",
                "shapeId": "subcontractorCap",
            })

    # 3. Map to grants-management format
    mapped = _mapping_engine.forward(data)

    valid = not any(r["severity"] == "error" for r in validation_results)

    return SubmitResponse(
        valid=valid,
        validationResults=validation_results,
        mapped=mapped,
        diagnostics=diagnostics,
    )
```

**Step 3: Verify the server starts**

```bash
cd /home/exedev/formspec
PYTHONPATH=src uvicorn examples.grant_application.server.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/health
# Expected: {"ok":true}
curl -s http://localhost:8000/definition | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['title'])"
# Expected: Federal Grant Application
kill %1
```

**Step 4: Test with sample submission**

```bash
cd /home/exedev/formspec
PYTHONPATH=src uvicorn examples.grant_application.server.main:app --port 8000 &
sleep 2
curl -s -X POST http://localhost:8000/submit \
  -H "Content-Type: application/json" \
  -d @examples/grant-application/sample-submission.json | python3 -m json.tool
# Expected: {"valid": true, "validationResults": [], "mapped": {...}, "diagnostics": [...]}
kill %1
```

**Step 5: Commit**

```bash
git add examples/grant-application/server/
git commit -m "feat(example): add grant application FastAPI server"
```

---

### Task 7: `index.html` — styled portal page

**Files:**
- Create: `examples/grant-application/index.html`

**Context:**
- The built packages are at `../../packages/formspec-engine/dist/index.js` and `../../packages/formspec-webcomponent/dist/index.js` relative to the example directory
- `<formspec-render>` is registered automatically when the webcomponent module is imported
- Set `element.definition`, `element.componentDocument`, `element.themeDocument` as JS properties (not attributes)
- Access the engine via `element.getEngine()`
- Use `effect()` from `@preact/signals-core` — import it from the engine dist or from the signals package. The simplest approach: import `FormEngine` from the engine and use `computed`/`effect` from `@preact/signals-core` if bundled, otherwise poll with `requestAnimationFrame` for the demo. For simplicity in a static HTML file, use the engine's signals directly and update the footer with a `setInterval` or `effect` if available.
- The simplest signal subscription that works without a bundler: read `engine.variableSignals['#:grandTotal']?.value` and `engine.signals['budget.requestedAmount']?.value` inside an `effect()` imported via the same module. Alternatively, listen to `structureVersion` signal changes.
- The server runs on `http://localhost:8000`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Federal Grant Application — Formspec Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --color-primary:      #005ea2;
      --color-primary-dark: #1a4480;
      --color-primary-light:#d9e8f6;
      --color-success:      #00a91c;
      --color-warning:      #ffbe2e;
      --color-error:        #e52207;
      --color-neutral-50:   #f9f9f9;
      --color-neutral-100:  #f0f0f0;
      --color-neutral-200:  #dfe1e2;
      --color-neutral-700:  #565c65;
      --color-text:         #1b1b1b;
      --font:               -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --radius:             4px;
    }

    body {
      font-family: var(--font);
      font-size: 16px;
      color: var(--color-text);
      background: var(--color-neutral-50);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .site-header {
      background: var(--color-primary);
      color: #fff;
      padding: 12px 40px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .site-header .gov-logo {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid rgba(255,255,255,0.6);
      padding: 3px 8px;
      border-radius: 2px;
    }
    .site-header h1 {
      font-size: 18px;
      font-weight: 600;
    }

    /* ── Layout ── */
    .app-body {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 0;
      flex: 1;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
      padding: 32px 40px;
      align-items: start;
    }

    /* ── Sidebar progress nav ── */
    .progress-nav {
      position: sticky;
      top: 24px;
      background: #fff;
      border: 1px solid var(--color-neutral-200);
      border-radius: var(--radius);
      padding: 16px;
    }
    .progress-nav h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-neutral-700);
      margin-bottom: 12px;
    }
    .progress-nav ol {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .progress-nav li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      padding: 6px 8px;
      border-radius: var(--radius);
      color: var(--color-neutral-700);
    }
    .progress-nav li.active {
      background: var(--color-primary-light);
      color: var(--color-primary-dark);
      font-weight: 600;
    }
    .progress-nav li .step-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid currentColor;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
    }
    .progress-nav li.valid .step-icon::after { content: "✓"; }
    .progress-nav li.invalid .step-icon { border-color: var(--color-error); color: var(--color-error); }
    .progress-nav li.invalid .step-icon::after { content: "!"; }

    /* ── Main form area ── */
    .form-area {
      background: #fff;
      border: 1px solid var(--color-neutral-200);
      border-radius: var(--radius);
      padding: 32px;
      margin-left: 24px;
    }

    formspec-render {
      display: block;
    }

    /* ── Shape error callout ── */
    .shape-errors {
      margin-top: 24px;
      display: none;
    }
    .shape-errors.visible { display: block; }
    .shape-error-callout {
      background: #fff3f2;
      border-left: 4px solid var(--color-error);
      padding: 12px 16px;
      border-radius: 0 var(--radius) var(--radius) 0;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--color-error);
    }
    .shape-warning-callout {
      background: #faf3d1;
      border-left: 4px solid var(--color-warning);
      padding: 12px 16px;
      border-radius: 0 var(--radius) var(--radius) 0;
      margin-bottom: 8px;
      font-size: 14px;
      color: #7a4f00;
    }

    /* ── Submit button ── */
    .submit-area {
      margin-top: 32px;
      display: flex;
      justify-content: flex-end;
    }
    .btn-submit {
      background: var(--color-primary);
      color: #fff;
      border: none;
      padding: 12px 32px;
      font-size: 16px;
      font-weight: 600;
      border-radius: var(--radius);
      cursor: pointer;
      font-family: var(--font);
    }
    .btn-submit:hover { background: var(--color-primary-dark); }
    .btn-submit:focus { outline: 0 0 0 3px #2491ff; }
    .btn-submit:disabled { opacity: 0.5; cursor: default; }

    /* ── Sticky footer totals bar ── */
    .totals-bar {
      position: sticky;
      bottom: 0;
      background: var(--color-primary-dark);
      color: #fff;
      padding: 12px 40px;
      display: flex;
      align-items: center;
      gap: 40px;
      font-size: 14px;
      z-index: 100;
    }
    .totals-bar .totals-label { color: rgba(255,255,255,0.75); margin-right: 8px; }
    .totals-bar .totals-amount { font-weight: 700; font-size: 16px; }
    .totals-bar .totals-match { margin-left: auto; font-size: 13px; }
    .totals-bar .totals-match.ok { color: #9ef0a3; }
    .totals-bar .totals-match.mismatch { color: #ff8c7c; }

    /* ── Server response panel ── */
    .server-response {
      margin-top: 24px;
      display: none;
    }
    .server-response.visible { display: block; }
    .server-response h3 {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--color-neutral-700);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .server-response pre {
      background: #f6f8fa;
      border: 1px solid var(--color-neutral-200);
      border-radius: var(--radius);
      padding: 16px;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>

<header class="site-header">
  <span class="gov-logo">U.S. Gov</span>
  <h1>Federal Grant Application Portal</h1>
</header>

<div class="app-body">
  <!-- Progress sidebar -->
  <nav class="progress-nav" aria-label="Form progress">
    <h3>Progress</h3>
    <ol id="progress-steps">
      <li data-page="Applicant Info">
        <span class="step-icon"></span>
        Applicant Info
      </li>
      <li data-page="Project Narrative">
        <span class="step-icon"></span>
        Project Narrative
      </li>
      <li data-page="Budget">
        <span class="step-icon"></span>
        Budget
      </li>
      <li data-page="Subcontractors">
        <span class="step-icon"></span>
        Subcontractors
      </li>
    </ol>
  </nav>

  <!-- Main form content -->
  <main class="form-area">
    <formspec-render id="form"></formspec-render>

    <!-- Shape-level error/warning callouts -->
    <div class="shape-errors" id="shape-errors" aria-live="polite"></div>

    <!-- Submit -->
    <div class="submit-area">
      <button class="btn-submit" id="btn-submit">Submit Application</button>
    </div>

    <!-- Server response -->
    <div class="server-response" id="server-response">
      <h3>Server Response</h3>
      <pre id="server-response-pre"></pre>
    </div>
  </main>
</div>

<!-- Sticky totals footer -->
<footer class="totals-bar" aria-live="polite" aria-label="Budget totals">
  <span>
    <span class="totals-label">Grand Total</span>
    <span class="totals-amount" id="footer-grand-total">—</span>
  </span>
  <span>
    <span class="totals-label">Requested</span>
    <span class="totals-amount" id="footer-requested">—</span>
  </span>
  <span class="totals-match" id="footer-match"></span>
</footer>

<script type="module">
  import { FormEngine, effect } from '../../packages/formspec-engine/dist/index.js';
  import '../../packages/formspec-webcomponent/dist/index.js';

  const SERVER = 'http://localhost:8000';

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  function formatMoney(moneyVal) {
    if (!moneyVal || moneyVal.amount == null) return '—';
    const n = parseFloat(moneyVal.amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: moneyVal.currency || 'USD' }).format(n);
  }

  const formEl = document.getElementById('form');
  const btnSubmit = document.getElementById('btn-submit');
  const shapeErrorsEl = document.getElementById('shape-errors');
  const serverResponseEl = document.getElementById('server-response');
  const serverResponsePre = document.getElementById('server-response-pre');
  const footerGrandTotal = document.getElementById('footer-grand-total');
  const footerRequested = document.getElementById('footer-requested');
  const footerMatch = document.getElementById('footer-match');

  // Load all artifacts in parallel
  const [definition, componentDoc, themeDoc] = await Promise.all([
    loadJSON('./definition.json'),
    loadJSON('./component.json'),
    loadJSON('./theme.json'),
  ]);

  formEl.definition = definition;
  formEl.componentDocument = componentDoc;
  formEl.themeDocument = themeDoc;

  const engine = formEl.getEngine();

  // ── Reactive footer totals ──
  effect(() => {
    // Touch structureVersion to re-run on structural changes
    engine.structureVersion.value;

    const grandTotalSignal = engine.variableSignals['#:grandTotal'];
    const requestedSignal  = engine.signals['budget.requestedAmount'];

    const gt = grandTotalSignal?.value;
    const rq = requestedSignal?.value;

    footerGrandTotal.textContent = formatMoney(gt);
    footerRequested.textContent  = formatMoney(rq);

    if (gt && rq && gt.amount != null && rq.amount != null) {
      const diff = Math.abs(parseFloat(gt.amount) - parseFloat(rq.amount));
      if (diff < 1) {
        footerMatch.textContent = '✓ Amounts match';
        footerMatch.className = 'totals-match ok';
      } else {
        footerMatch.textContent = `⚠ Difference: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(diff)}`;
        footerMatch.className = 'totals-match mismatch';
      }
    } else {
      footerMatch.textContent = '';
    }
  });

  // ── Shape error display ──
  function refreshShapeErrors() {
    const report = engine.getValidationReport({ mode: 'submit' });
    const shapeResults = report.results.filter(r => r.source === 'shape' || r.constraintKind === 'shape');
    shapeErrorsEl.innerHTML = '';
    if (shapeResults.length === 0) {
      shapeErrorsEl.classList.remove('visible');
      return;
    }
    shapeErrorsEl.classList.add('visible');
    for (const r of shapeResults) {
      const div = document.createElement('div');
      div.className = r.severity === 'warning' ? 'shape-warning-callout' : 'shape-error-callout';
      div.textContent = r.message;
      shapeErrorsEl.appendChild(div);
    }
  }

  effect(() => {
    engine.structureVersion.value;
    refreshShapeErrors();
  });

  // ── Submit ──
  btnSubmit.addEventListener('click', async () => {
    const report = engine.getValidationReport({ mode: 'submit' });
    if (!report.valid) {
      refreshShapeErrors();
      alert(`Please fix ${report.counts.error} error(s) before submitting.`);
      return;
    }

    const response = engine.getResponse({ mode: 'submit' });
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting…';

    try {
      const res = await fetch(`${SERVER}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      });
      const result = await res.json();
      serverResponsePre.textContent = JSON.stringify(result, null, 2);
      serverResponseEl.classList.add('visible');
      serverResponseEl.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      serverResponsePre.textContent = `Error contacting server: ${e.message}\n\nMake sure the server is running:\n  cd examples/grant-application\n  pip install -r server/requirements.txt\n  PYTHONPATH=../../src uvicorn server.main:app --port 8000`;
      serverResponseEl.classList.add('visible');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit Application';
    }
  });
</script>
</body>
</html>
```

**Step 2: Build the packages first (required before opening the page)**

```bash
cd /home/exedev/formspec
npm run build
```

Expected: tsc compiles both packages to `dist/` with no errors.

**Step 3: Verify the page loads**

```bash
cd /home/exedev/formspec
npm run start:test-server &
sleep 2
# Open http://127.0.0.1:8080/examples/grant-application/index.html in a browser
# Expected: 4-page grant form renders with progress sidebar and sticky footer
```

**Step 4: Commit**

```bash
git add examples/grant-application/index.html
git commit -m "feat(example): add grant application portal page"
```

---

### Task 8: `README.md` for the example

**Files:**
- Create: `examples/grant-application/README.md`

**Step 1: Create the README**

```markdown
# Grant Application — Formspec Reference Implementation

A complete vertical slice demonstrating the full Formspec lifecycle:
**form authoring → browser rendering → submission → server re-validation → mapping output**

## What's here

| File | Purpose |
|---|---|
| `definition.json` | 4-page grant application definition (items, binds, variables, shapes) |
| `component.json` | Wizard layout tree with DataTable budget and ConditionalGroup subcontractors page |
| `theme.json` | USWDS-flavored token set |
| `mapping.json` | Transforms submission → grants-management flat JSON |
| `sample-submission.json` | A complete valid response for curl testing |
| `index.html` | Styled portal page with sticky totals footer |
| `server/main.py` | FastAPI server: POST /submit → re-validate + map |

## Running

### 1. Build the TypeScript packages (one-time)

```bash
# From repo root
npm run build
```

### 2. Start the form (browser)

```bash
# From repo root
npm run start:test-server
```

Then open: `http://127.0.0.1:8080/examples/grant-application/index.html`

### 3. Start the API server (separate terminal)

```bash
cd examples/grant-application
pip install -r server/requirements.txt
PYTHONPATH=../../src uvicorn server.main:app --reload --port 8000
```

### 4. Test with curl (no browser needed)

```bash
curl -X POST http://localhost:8000/submit \
  -H "Content-Type: application/json" \
  -d @sample-submission.json | python3 -m json.tool
```

## What this exercises

- **Repeatable groups** (`lineItems`, `subcontractors`) with min/max cardinality
- **Money calculations** — element-wise `moneyAmount($unitCost) * $quantity`, `moneySum()`, `moneyAdd()`
- **Variables** — `@totalDirect`, `@indirectCosts`, `@grandTotal` computed once, used in shapes
- **Conditional relevance** — subcontractors page only when `usesSubcontractors = true`; indirect rate hidden for government orgs
- **Validation shapes** — cross-field budget match, 49% subcontractor cap, $500k warning threshold
- **Mapping DSL** — value maps, expression transforms (money field splitting), conditional rules
- **Server-side re-validation** — Python FEL evaluator re-checks constraints independently of the client

## What this does NOT cover

See `specs/core/spec.llm.md` for: screener routing, modular composition (`$ref`), version migrations,
extension registry, remote data sources (`@instance()`), CSV/XML adapter output.
```

**Step 2: Commit**

```bash
git add examples/grant-application/README.md
git commit -m "feat(example): add grant application README"
```

---

### Task 9: `docs/grant-application-guide.md` + Makefile

**Files:**
- Create: `docs/grant-application-guide.md`
- Modify: `Makefile` (add guide to docs target)

**Context:** This is a narrative walkthrough — an annotated implementation journal, not a reference doc. Write it as if explaining to a skilled developer who has never seen Formspec before. Reference the actual artifact files (e.g. `examples/grant-application/definition.json`) rather than embedding duplicate JSON — point readers to the files with short excerpts. The guide is Pandoc-rendered: use standard Markdown, `#` for H1, `##` for H2, fenced code blocks.

**Step 1: Check the Makefile pattern for adding a new doc target**

The existing pattern:
```makefile
$(DOCS_DIR)/spec.html: $(SPECS_DIR)/core/spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="..." -o $@ $<
```

Add to both the `docs:` target list and as a new rule.

**Step 2: Add the guide to the Makefile**

In `Makefile`, modify the `docs:` target to add `$(DOCS_DIR)/grant-application.html`, then add the rule:

```makefile
$(DOCS_DIR)/grant-application.html: docs/grant-application-guide.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Grant Application — Formspec Walkthrough" -o $@ $<
```

Also add `$(DOCS_DIR)/grant-application.html` to the `clean:` target's `rm -f` list.

**Step 3: Create the guide (docs/grant-application-guide.md)**

Write the full guide covering all 8 sections from the design doc. Key constraints:
- Each section should be 150–300 words max
- Use fenced JSON code blocks for snippets (keep them short — 10–20 lines max, not full files)
- Explain the *why* behind decisions, not just the *what*
- Link/reference actual files where appropriate: `examples/grant-application/definition.json`
- Section 3 (FEL in practice) should show the 4 key expressions with brief explanation of each
- Section 6 (server validation) must explain why client-side validation alone isn't sufficient for submission (trust boundary)
- Section 8 (what's not covered) must list: screener routing, `$ref` composition, version migrations, extension registry, `@instance()` data sources — each with a pointer to where to learn more

**Step 4: Verify the guide renders**

```bash
cd /home/exedev/formspec
make docs
# Expected: docs/grant-application.html generated with no pandoc errors
```

**Step 5: Commit**

```bash
git add docs/grant-application-guide.md Makefile
git commit -m "docs: add grant application narrative guide and Makefile target"
```

---

### Task 10: Final verification

**Step 1: Lint the full example**

```bash
cd /home/exedev/formspec
python3 -m formspec.validator examples/grant-application/definition.json
python3 -m formspec.validator examples/grant-application/component.json
python3 -m formspec.validator examples/grant-application/theme.json
```

Expected: no errors on any of the three documents.

**Step 2: Verify the mapping engine runs against sample submission**

```python
# Run this as a quick smoke test
cd /home/exedev/formspec
python3 -c "
import json, sys
sys.path.insert(0, 'src')
from formspec.mapping.engine import MappingEngine

with open('examples/grant-application/mapping.json') as f:
    mapping = json.load(f)
with open('examples/grant-application/sample-submission.json') as f:
    submission = json.load(f)

engine = MappingEngine(mapping)
result = engine.forward(submission['data'])
print(json.dumps(result, indent=2))
"
```

Expected: JSON output with `organization`, `project`, `budget`, and `subcontractors` keys.

**Step 3: Build packages and verify index.html loads**

```bash
cd /home/exedev/formspec
npm run build 2>&1 | tail -5
# Expected: no TypeScript errors
```

**Step 4: Final commit if anything was adjusted**

```bash
git add -p  # review and stage any final tweaks
git commit -m "fix(example): final verification adjustments" --allow-empty
```
