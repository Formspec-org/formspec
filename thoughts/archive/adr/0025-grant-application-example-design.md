# Grant Application — Vertical Slice Reference Implementation Design

**Date:** 2026-02-25
**Status:** Approved
**Scope:** Full end-to-end example: form authoring → browser rendering → submission → server validation → mapping output

---

## Goal

Demonstrate the complete Formspec lifecycle in a single runnable example. The intended audience is:

- **Implementation agents** building Formspec integrations who need a concrete model to follow
- **Doc-writing agents** explaining how the pieces fit together
- **Developers** evaluating Formspec who want to run something real, not read abstractions

The form domain is a **government grant application** — chosen because it naturally exercises repeatable groups, money calculations, cross-field validation shapes, conditional sections, and bidirectional data mapping.

---

## File Layout

```
examples/grant-application/
  definition.json              # The form definition (4 pages, ~150 lines)
  component.json               # Wizard-based component/layout tree
  theme.json                   # USWDS-flavored token set
  mapping.json                 # Maps submission → grants-management flat JSON
  sample-submission.json       # Complete valid response for curl/testing
  index.html                   # Static page: renders the form, submits to server
  server/
    main.py                    # FastAPI: POST /submit → validate + map + return
    requirements.txt           # fastapi, uvicorn, jsonschema
  README.md                    # How to run

docs/
  grant-application-guide.md   # Narrative walkthrough source (Pandoc → HTML)
  grant-application.html       # Generated — added to Makefile docs target
```

---

## Form Definition Structure

### Identity

```json
{
  "$formspec": "1.0",
  "url": "https://example.gov/forms/grant-application",
  "version": "1.0.0",
  "status": "active",
  "title": "Federal Grant Application"
}
```

### OptionSets

One named option set referenced across definition and mapping:

- `budgetCategories`: Personnel / Fringe / Travel / Equipment / Supplies / Contractual / Other

### Items — 4 pages (via `presentation.page` hints on groups)

**Page 1 — Applicant Info**
- `orgName` (string, required)
- `ein` (string, required) — constraint: `matches($ein, "^\d{2}-\d{7}$")`
- `orgType` (choice: nonprofit / university / government / forprofit)
- `contactName`, `contactEmail`, `contactPhone` (string)
- Display item: phone format hint, `relevant: "$orgType = 'nonprofit'"`

**Page 2 — Project Narrative**
- `projectTitle` (string, required)
- `abstract` (text)
- `startDate`, `endDate` (date, required)
- `duration` (integer, readonly) — `calculate: "dateDiff($startDate, $endDate, 'months')"`
- `indirectRate` (decimal) — `relevant: "$orgType != 'government'"`
- Constraint on `endDate`: `$endDate > $startDate`

**Page 3 — Budget**
- `usesSubcontractors` (boolean)
- Repeatable group `lineItems` (min: 1, max: 20):
  - `category` (choice, optionSet: budgetCategories)
  - `description` (string)
  - `quantity` (integer)
  - `unitCost` (money)
  - `subtotal` (money, readonly) — `calculate: "money(moneyAmount($unitCost) * $quantity, moneyCurrency($unitCost))"`
- `requestedAmount` (money, required)

**Page 4 — Subcontractors** — entire page `relevant: "$usesSubcontractors"`
- Repeatable group `subcontractors` (min: 1 when relevant, max: 10):
  - `subName` (string)
  - `subOrg` (string)
  - `subAmount` (money)
  - `subScope` (text)

### Binds

```
lineItems[*].subtotal   calculate: money(moneyAmount($unitCost) * $quantity, moneyCurrency($unitCost))
lineItems[*].subtotal   readonly: true
endDate                 constraint: $endDate > $startDate
endDate                 constraintMessage: "End date must be after start date"
ein                     constraint: matches($ein, "^\d{2}-\d{7}$")
ein                     constraintMessage: "EIN must be in format XX-XXXXXXX"
indirectRate            relevant: $orgType != 'government'
subcontractors          relevant: $usesSubcontractors
duration                calculate: dateDiff($startDate, $endDate, 'months')
duration                readonly: true
```

### Variables

```json
"variables": [
  { "name": "totalDirect", "expression": "moneySum($lineItems[*].subtotal)" },
  { "name": "indirectCosts", "expression": "money(moneyAmount(@totalDirect) * ($indirectRate / 100), moneyCurrency(@totalDirect))" },
  { "name": "grandTotal", "expression": "moneyAdd(@totalDirect, @indirectCosts)" }
]
```

Using variables here (rather than repeating expressions inside shapes) keeps the shape constraints readable and avoids computation drift.

### Validation Shapes

```json
"shapes": [
  {
    "id": "budgetMatch",
    "target": "requestedAmount",
    "severity": "error",
    "constraint": "abs(moneyAmount($requestedAmount) - moneyAmount(@grandTotal)) < 1",
    "message": "Requested amount must match the calculated grand total (within $1).",
    "code": "BUDGET_MISMATCH"
  },
  {
    "id": "budgetReasonable",
    "target": "#",
    "severity": "warning",
    "constraint": "moneyAmount(@grandTotal) < 500000",
    "message": "Projects over $500,000 require additional narrative justification.",
    "code": "BUDGET_OVER_THRESHOLD"
  },
  {
    "id": "subcontractorCap",
    "target": "#",
    "severity": "error",
    "activeWhen": "$usesSubcontractors",
    "constraint": "moneyAmount(moneySum($subcontractors[*].subAmount)) <= moneyAmount(@grandTotal) * 0.49",
    "message": "Subcontractor costs may not exceed 49% of total project budget.",
    "code": "SUBCONTRACTOR_CAP_EXCEEDED"
  }
]
```

---

## Component Document

- **Root**: `Wizard` with 4 `Page` children
- Each page: `Stack` of `Grid` components (2-column for label/input pairs, full-width for text areas)
- Budget page: `DataTable` bound to `lineItems` group; columns are `Select`, `TextInput`, `NumberInput`, `MoneyInput`, readonly `Text` for subtotal
- Page 4 wrapped in `ConditionalGroup` with `when: "$usesSubcontractors"` — single `when` at the container level rather than on each child
- Running totals sidebar: `Card` containing `Text` components bound to `@totalDirect`, `@indirectCosts`, `@grandTotal` — these use `bind` on readonly fields or variable expressions

---

## Theme Document

USWDS-flavored tokens. Enough to demonstrate the cascade without being a full design system:

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "targetDefinition": { "url": "https://example.gov/forms/grant-application" },
  "tokens": {
    "color": {
      "primary": "#005ea2",
      "primaryDark": "#1a4480",
      "success": "#00a91c",
      "warning": "#ffbe2e",
      "error": "#e52207",
      "neutral100": "#f0f0f0",
      "neutral200": "#dfe1e2",
      "text": "#1b1b1b"
    },
    "spacing": { "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "40px" },
    "type": { "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "baseSize": "16px" },
    "radius": { "sm": "4px", "md": "8px" },
    "focusRing": "0 0 0 3px #2491ff"
  },
  "defaults": {
    "widget": { "choice": "radio" }
  }
}
```

---

## `index.html` — Visual Design

The page is styled as a real government grant portal, not a barebones demo. Specific decisions:

- **Two-column shell**: narrow left sidebar (progress nav showing wizard steps with ✓/✗ state), main content area holding `<formspec-render>`
- **Sticky footer bar**: shows `Grand Total` and `Requested Amount` side-by-side, updated reactively via `effect()` on those variable/field signals — user always sees whether they balance; goes red when they diverge
- **Error surfacing**: inline red text beneath each field for field-level errors; a highlighted callout box above the submit button for shape failures (budgetMatch, subcontractorCap)
- **Budget table**: alternating row shading, Add/Delete row buttons, subtotal column right-aligned
- **Narrative fields**: generous `line-height: 1.6`, comfortable padding — these are long-text fields
- **Accessibility**: WCAG AA contrast on all interactive elements, focus rings via the `$token.focusRing` token, `aria-live` region on the running total footer
- **No external font load** — system font stack from theme tokens

---

## Mapping Document

Forward direction: Formspec response `data` → flat grants-management JSON.

Key rules:
- `orgType` → value map: `nonprofit→NPO`, `university→EDU`, `government→GOV`, `forprofit→FP`
- `requestedAmount` (money object) → split: `requested_amount` (string, amount only) + `currency` (string)
- `lineItems[*]` → `budget_lines` array with snake_case keys; `unitCost.amount` extracted, `unitCost.currency` dropped (assumed USD)
- `startDate`/`endDate` → `project_start`/`project_end` (ISO strings, preserved)
- `subcontractors` block: `condition: "present($subcontractors)"` — only included when non-empty
- `indirectRate` → `indirect_rate_pct` coerced to string with `%` suffix

---

## FastAPI Server (`server/main.py`)

~80 lines. Endpoints:

```
POST /submit
  1. Validate response envelope against schemas/response.schema.json
  2. Match definitionUrl → load examples/grant-application/definition.json
  3. Python linter: re-validate definition + FEL expressions
  4. Python FEL evaluator: re-check constraint binds and shapes server-side
  5. MappingEngine.forward(response.data, mapping_doc)
  6. Return { valid, validationResults, mapped, diagnostics }

GET /definition   → serve definition.json (used by index.html fallback)
GET /health       → { "ok": true }
```

CORS open for localhost. `sample-submission.json` allows curl testing without filling the form.

---

## Docs Guide (`docs/grant-application-guide.md`)

Narrative walkthrough structured as an annotated implementation journal. Sections:

1. **The problem** — why three-layer separation matters at this form's complexity
2. **The definition** — page-by-page walkthrough with inline snippets, decision rationale
3. **FEL in practice** — deep dive on the 4-5 non-obvious expressions: EIN regex, element-wise money calculation, `abs()` budget match shape, `moneySum` on subcontractors
4. **The component tree** — Wizard hierarchy, why `ConditionalGroup` at the container level, how the sticky footer reads signals
5. **Theme tokens** — one token cascade end-to-end: `$token.color.primary` → `theme.json` → CSS custom property
6. **Submitting and server validation** — full round-trip with rationale for why server-side re-validation matters
7. **The mapping doc** — 3 representative rules walked through with input→output JSON side-by-side
8. **What's not covered** — screener routing, modular composition, version migrations, extension registry — pointers to next reading

Added to `Makefile` docs target: `pandoc docs/grant-application-guide.md -o docs/grant-application.html`.

---

## What This Does NOT Cover

To keep scope bounded, the following are explicitly out of scope for this example:

- Screener routing (see `specs/core/spec.llm.md` §Screener Routing)
- Modular composition via `$ref` (see assembler API)
- Version migrations
- Extension registry
- Remote data sources / `@instance()` secondary instances
- CSV/XML adapter output (mapping targets JSON only)
