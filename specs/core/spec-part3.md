# Formspec Specification — Part 3

## Sections 7–9

**Status:** Draft Specification  
**Version:** 0.1.0  

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 7. Concrete Examples

This section provides normative examples demonstrating how Formspec
Definitions, Instances, Responses, and ValidationReports interoperate in
realistic scenarios. Each example is a complete or near-complete JSON
fragment. Processors conforming to this specification MUST be able to
consume and correctly evaluate all examples in this section.

---

### 7.1 Budget Line Items with Calculated Totals

This example demonstrates a repeatable "line items" group where each row
contains a category, description, and dollar amount. A calculated grand
total sums all line-item amounts. An external data source pre-populates
the authorized award amount. A cross-field validation constraint ensures
the calculated total equals the award amount exactly.

**Demonstrated features:**

- Repeatable group with child fields
- Calculated field aggregating across repeat instances (`sum()`)
- Pre-populated field from a secondary instance
- Cross-field validation (sum MUST equal award)
- Definition fragment, Instance data, and Response data

#### 7.1.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/budget-detail",
  "version": "2025-06-01",
  "status": "active",
  "title": "Budget Detail — Line Items",

  "instances": {
    "main": {
      "description": "Primary form data"
    },
    "award": {
      "description": "Pre-populated award data from grants management system",
      "source": "https://api.grants.example.gov/awards/{awardId}",
      "schema": {
        "type": "object",
        "properties": {
          "award_amount": { "type": "decimal" },
          "award_number": { "type": "string" },
          "period_start": { "type": "date" },
          "period_end":   { "type": "date" }
        }
      },
      "data": {
        "award_amount": 250000.00,
        "award_number": "GR-2025-04817",
        "period_start": "2025-01-01",
        "period_end":   "2025-12-31"
      }
    }
  },

  "items": [
    {
      "key": "award_amount",
      "type": "field",
      "dataType": "decimal",
      "label": "Authorized Award Amount",
      "hint": "This value is pre-populated from the grants management system and cannot be edited."
    },
    {
      "key": "line_items",
      "type": "group",
      "repeatable": true,
      "label": "Budget Line Items",
      "minRepeat": 1,
      "maxRepeat": 50,
      "children": [
        {
          "key": "category",
          "type": "field",
          "dataType": "string",
          "label": "Budget Category",
          "choices": [
            { "value": "personnel",    "label": "Personnel" },
            { "value": "fringe",       "label": "Fringe Benefits" },
            { "value": "travel",       "label": "Travel" },
            { "value": "equipment",    "label": "Equipment" },
            { "value": "supplies",     "label": "Supplies" },
            { "value": "contractual",  "label": "Contractual" },
            { "value": "other",        "label": "Other" },
            { "value": "indirect",     "label": "Indirect Costs" }
          ]
        },
        {
          "key": "description",
          "type": "field",
          "dataType": "string",
          "label": "Description"
        },
        {
          "key": "amount",
          "type": "field",
          "dataType": "decimal",
          "label": "Amount ($)"
        }
      ]
    },
    {
      "key": "total_budget",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Budget",
      "hint": "Auto-calculated. Must equal the authorized award amount."
    }
  ],

  "binds": [
    {
      "path": "award_amount",
      "initialValue": "@instance('award').award_amount",
      "readonly": true
    },
    {
      "path": "line_items[*].category",
      "required": true
    },
    {
      "path": "line_items[*].description",
      "required": true
    },
    {
      "path": "line_items[*].amount",
      "required": true,
      "constraint": "$ > 0",
      "constraintMessage": "Amount must be greater than zero."
    },
    {
      "path": "total_budget",
      "calculate": "sum(line_items[*].amount)",
      "readonly": true
    }
  ],

  "shapes": [
    {
      "id": "budget-balances",
      "severity": "error",
      "targets": ["total_budget"],
      "constraint": "$total_budget = $award_amount",
      "message": "Total budget (${$total_budget}) must equal the authorized award amount (${$award_amount})."
    }
  ]
}
```

#### 7.1.2 Instance Data (In Progress)

The following Instance represents a partially completed form with three
line items:

```json
{
  "definition": "https://grants.example.gov/forms/budget-detail|2025-06-01",
  "status": "in-progress",
  "data": {
    "award_amount": 250000.00,
    "line_items": [
      {
        "category": "personnel",
        "description": "Senior researcher — 0.5 FTE",
        "amount": 95000.00
      },
      {
        "category": "fringe",
        "description": "Benefits at 32% of personnel",
        "amount": 30400.00
      },
      {
        "category": "travel",
        "description": "Conference attendance — 2 domestic trips",
        "amount": 4600.00
      }
    ],
    "total_budget": 130000.00
  }
}
```

Note: `total_budget` is 130,000.00 (the calculated sum) while
`award_amount` is 250,000.00. The `budget-balances` shape will produce
an error-severity result because the two values are not equal. The user
must add additional line items totaling $120,000.00 to reach balance.

#### 7.1.3 Response Data (Final Submission)

```json
{
  "definition": "https://grants.example.gov/forms/budget-detail|2025-06-01",
  "status": "complete",
  "data": {
    "award_amount": 250000.00,
    "line_items": [
      { "category": "personnel",   "description": "Senior researcher — 0.5 FTE",          "amount": 95000.00 },
      { "category": "fringe",      "description": "Benefits at 32% of personnel",          "amount": 30400.00 },
      { "category": "travel",      "description": "Conference attendance — 2 domestic trips","amount": 4600.00 },
      { "category": "equipment",   "description": "Lab workstation and peripherals",       "amount": 12000.00 },
      { "category": "supplies",    "description": "Reagents and consumables",               "amount": 28000.00 },
      { "category": "contractual", "description": "Statistical analysis subcontract",       "amount": 45000.00 },
      { "category": "indirect",    "description": "F&A at 52% of MTDC",                    "amount": 35000.00 }
    ],
    "total_budget": 250000.00
  }
}
```

The `total_budget` now equals `award_amount`. The `budget-balances`
shape produces no results, and the Response is valid.

---
### 7.2 Conditional Section with Dependent Validation

This example demonstrates a conditional "subcontracting" section that
appears only when the user indicates subcontracting occurred. When the
section is not relevant, its fields are excluded from the Response and
their validation constraints are suspended.

**Demonstrated features:**

- Boolean field controlling group visibility
- `relevant` bind on a group
- `required` binds that apply only when the parent group is relevant
- Non-relevant exclusion from Response data

#### 7.2.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Annual Progress Report — Subcontracting Section",

  "items": [
    {
      "key": "has_subcontracts",
      "type": "field",
      "dataType": "boolean",
      "label": "Did you subcontract any work during this reporting period?"
    },
    {
      "key": "subcontracting",
      "type": "group",
      "label": "Subcontracting Details",
      "repeatable": true,
      "minRepeat": 1,
      "maxRepeat": 20,
      "children": [
        {
          "key": "subcontractor_name",
          "type": "field",
          "dataType": "string",
          "label": "Subcontractor Name"
        },
        {
          "key": "subcontractor_ein",
          "type": "field",
          "dataType": "string",
          "label": "Subcontractor EIN"
        },
        {
          "key": "subcontract_amount",
          "type": "field",
          "dataType": "decimal",
          "label": "Subcontract Amount ($)"
        },
        {
          "key": "work_description",
          "type": "field",
          "dataType": "string",
          "label": "Description of Subcontracted Work"
        }
      ]
    },
    {
      "key": "subcontract_total",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Subcontracted Amount"
    }
  ],

  "binds": [
    {
      "path": "has_subcontracts",
      "required": true
    },
    {
      "path": "subcontracting",
      "relevant": "$has_subcontracts = true"
    },
    {
      "path": "subcontracting[*].subcontractor_name",
      "required": true
    },
    {
      "path": "subcontracting[*].subcontractor_ein",
      "required": true,
      "constraint": "matches($, '^[0-9]{2}-[0-9]{7}$')",
      "constraintMessage": "EIN must be in XX-XXXXXXX format."
    },
    {
      "path": "subcontracting[*].subcontract_amount",
      "required": true,
      "constraint": "$ > 0",
      "constraintMessage": "Amount must be greater than zero."
    },
    {
      "path": "subcontracting[*].work_description",
      "required": true
    },
    {
      "path": "subcontract_total",
      "relevant": "$has_subcontracts = true",
      "calculate": "sum(subcontracting[*].subcontract_amount)",
      "readonly": true
    }
  ]
}
```

#### 7.2.2 Response — No Subcontracting

When the user selects "No", the `subcontracting` group and
`subcontract_total` field are non-relevant. Conforming processors MUST
exclude non-relevant fields from the Response `data` object:

```json
{
  "definition": "https://grants.example.gov/forms/progress-report|2025-06-01",
  "status": "complete",
  "data": {
    "has_subcontracts": false
  }
}
```

Note the absence of `subcontracting` and `subcontract_total`. These
fields are not set to `null` or empty — they are omitted entirely.
Validation constraints on `subcontractor_name`, `subcontractor_ein`,
and `subcontract_amount` (all marked `required`) are NOT evaluated
because their nearest relevant ancestor (`subcontracting`) is
non-relevant.

#### 7.2.3 Response — With Subcontracting

```json
{
  "definition": "https://grants.example.gov/forms/progress-report|2025-06-01",
  "status": "complete",
  "data": {
    "has_subcontracts": true,
    "subcontracting": [
      {
        "subcontractor_name": "Acme Analytics, LLC",
        "subcontractor_ein": "84-1234567",
        "subcontract_amount": 45000.00,
        "work_description": "Statistical modeling and data analysis for Phase II trials."
      },
      {
        "subcontractor_name": "BioSample Services, Inc.",
        "subcontractor_ein": "91-7654321",
        "subcontract_amount": 18500.00,
        "work_description": "Sample preparation and cold-chain logistics."
      }
    ],
    "subcontract_total": 63500.00
  }
}
```

All `required` constraints on the child fields are now active and
evaluated. The `subcontract_total` is calculated as the sum of all
`subcontract_amount` values.

---

### 7.3 Repeatable Rows with Per-Row Calculations and Cross-Row Total

This example demonstrates an "expenditure categories" repeatable where
each row contains three cost fields and a per-row calculated total. A
grand total aggregates all row totals. A percentage-based validation
raises a warning if any single cost category exceeds 50% of its row
total.

**Demonstrated features:**

- Per-row calculated field within a repeatable group
- Cross-row aggregate calculation
- Per-row percentage-based validation (warning severity)
- Bind paths using `[*]` notation for repeat context

#### 7.3.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/expenditure-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Quarterly Expenditure Report — By Category",

  "items": [
    {
      "key": "categories",
      "type": "group",
      "repeatable": true,
      "label": "Expenditure Categories",
      "minRepeat": 1,
      "maxRepeat": 25,
      "children": [
        {
          "key": "category_name",
          "type": "field",
          "dataType": "string",
          "label": "Category Name"
        },
        {
          "key": "personnel_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Personnel Costs ($)"
        },
        {
          "key": "travel_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Travel Costs ($)"
        },
        {
          "key": "supply_costs",
          "type": "field",
          "dataType": "decimal",
          "label": "Supply Costs ($)"
        },
        {
          "key": "row_total",
          "type": "field",
          "dataType": "decimal",
          "label": "Row Total ($)"
        }
      ]
    },
    {
      "key": "grand_total",
      "type": "field",
      "dataType": "decimal",
      "label": "Grand Total ($)"
    }
  ],

  "binds": [
    {
      "path": "categories[*].category_name",
      "required": true
    },
    {
      "path": "categories[*].personnel_costs",
      "required": true,
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].travel_costs",
      "required": true,
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].supply_costs",
      "required": true,
      "constraint": "$ >= 0",
      "constraintMessage": "Costs must not be negative."
    },
    {
      "path": "categories[*].row_total",
      "calculate": "$personnel_costs + $travel_costs + $supply_costs",
      "readonly": true
    },
    {
      "path": "grand_total",
      "calculate": "sum(categories[*].row_total)",
      "readonly": true
    }
  ],

  "shapes": [
    {
      "id": "personnel-concentration-warning",
      "severity": "warning",
      "targets": ["categories[*].personnel_costs"],
      "constraint": "$row_total = 0 or ($personnel_costs div $row_total) <= 0.50",
      "message": "Personnel costs (${$personnel_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    },
    {
      "id": "travel-concentration-warning",
      "severity": "warning",
      "targets": ["categories[*].travel_costs"],
      "constraint": "$row_total = 0 or ($travel_costs div $row_total) <= 0.50",
      "message": "Travel costs (${$travel_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    },
    {
      "id": "supply-concentration-warning",
      "severity": "warning",
      "targets": ["categories[*].supply_costs"],
      "constraint": "$row_total = 0 or ($supply_costs div $row_total) <= 0.50",
      "message": "Supply costs (${$supply_costs}) exceed 50% of the row total (${$row_total}). Verify this allocation is correct."
    }
  ]
}
```

**Commentary on per-row expression context:** The `calculate` expression
on `categories[*].row_total` uses unqualified field references
(`$personnel_costs`, `$travel_costs`, `$supply_costs`). Within a bind
that targets `categories[*]`, unqualified references resolve against the
current repeat instance. A processor MUST evaluate this expression once
per repeat instance, scoped to that instance's data. The expression
`$personnel_costs` within the third repeat instance refers to
`categories[2].personnel_costs`, not to a global field.

The `grand_total` bind uses `sum(categories[*].row_total)`, which
aggregates across ALL repeat instances. The `[*]` within a `sum()`,
`count()`, or other aggregate function denotes collection-level
aggregation. Processors MUST distinguish between:

- **Per-instance context:** `categories[*].row_total` as a bind path —
  the expression evaluates once per row.
- **Aggregate context:** `sum(categories[*].row_total)` as an expression —
  the function receives all values and returns a single scalar.

#### 7.3.2 Instance Data with Warning

```json
{
  "definition": "https://grants.example.gov/forms/expenditure-report|2025-06-01",
  "status": "in-progress",
  "data": {
    "categories": [
      {
        "category_name": "Core Research",
        "personnel_costs": 80000.00,
        "travel_costs": 5000.00,
        "supply_costs": 15000.00,
        "row_total": 100000.00
      },
      {
        "category_name": "Outreach",
        "personnel_costs": 3000.00,
        "travel_costs": 22000.00,
        "supply_costs": 5000.00,
        "row_total": 30000.00
      }
    ],
    "grand_total": 130000.00
  }
}
```

#### 7.3.3 ValidationReport

The first row has `personnel_costs` at 80% of `row_total` (80,000 /
100,000). The second row has `travel_costs` at 73% of `row_total`
(22,000 / 30,000). Both exceed the 50% threshold:

```json
{
  "definition": "https://grants.example.gov/forms/expenditure-report|2025-06-01",
  "valid": true,
  "results": [
    {
      "path": "categories[0].personnel_costs",
      "severity": "warning",
      "shapeId": "personnel-concentration-warning",
      "message": "Personnel costs ($80,000.00) exceed 50% of the row total ($100,000.00). Verify this allocation is correct.",
      "value": 80000.00,
      "context": {
        "row_total": 100000.00,
        "percentage": 0.80
      }
    },
    {
      "path": "categories[1].travel_costs",
      "severity": "warning",
      "shapeId": "travel-concentration-warning",
      "message": "Travel costs ($22,000.00) exceed 50% of the row total ($30,000.00). Verify this allocation is correct.",
      "value": 22000.00,
      "context": {
        "row_total": 30000.00,
        "percentage": 0.73
      }
    }
  ]
}
```

`valid` is `true` because both results have warning severity. Only
error-severity results cause `valid` to be `false`. Advisory warnings
SHOULD be presented to the user but MUST NOT block submission.

---

### 7.4 Year-over-Year Comparison Warning

This example demonstrates a field whose current-year value is compared
against a prior-year value loaded from a secondary instance. If the
change exceeds 25% in either direction, a warning is raised with
interpolated values in the message.

**Demonstrated features:**

- Secondary instance declaration with external source
- Cross-instance FEL expression
- Warning-severity shape
- Message interpolation with computed values

#### 7.4.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/annual-budget",
  "version": "2025-06-01",
  "status": "active",
  "title": "Annual Budget — Year-over-Year Review",

  "instances": {
    "main": {
      "description": "Current-year budget submission"
    },
    "prior_year": {
      "description": "Prior-year actuals from financial system",
      "source": "https://api.grants.example.gov/actuals/{awardId}/2024",
      "schema": {
        "type": "object",
        "properties": {
          "total_expenditure":  { "type": "decimal" },
          "personnel_total":    { "type": "decimal" },
          "travel_total":       { "type": "decimal" },
          "equipment_total":    { "type": "decimal" },
          "reporting_year":     { "type": "integer" }
        }
      },
      "data": {
        "total_expenditure": 200000.00,
        "personnel_total":   120000.00,
        "travel_total":       15000.00,
        "equipment_total":    25000.00,
        "reporting_year":     2024
      }
    }
  },

  "variables": [
    {
      "name": "prior_total",
      "expression": "@instance('prior_year').total_expenditure",
      "scope": "global"
    },
    {
      "name": "yoy_change_pct",
      "expression": "if($prior_total != 0, abs($total_expenditure - $prior_total) div $prior_total, 0)",
      "scope": "global"
    }
  ],

  "items": [
    {
      "key": "total_expenditure",
      "type": "field",
      "dataType": "decimal",
      "label": "Total Proposed Expenditure for Current Year ($)"
    },
    {
      "key": "budget_justification",
      "type": "field",
      "dataType": "string",
      "label": "Budget Justification Narrative"
    }
  ],

  "binds": [
    {
      "path": "total_expenditure",
      "required": true,
      "constraint": "$ > 0",
      "constraintMessage": "Total expenditure must be greater than zero."
    },
    {
      "path": "budget_justification",
      "required": true
    }
  ],

  "shapes": [
    {
      "id": "yoy-variance-warning",
      "severity": "warning",
      "targets": ["total_expenditure"],
      "constraint": "$yoy_change_pct <= 0.25",
      "message": "The proposed expenditure (${$total_expenditure}) differs from the prior year actual (${$prior_total}) by ${round($yoy_change_pct * 100)}%. Changes exceeding 25% require additional justification in the narrative."
    }
  ]
}
```

#### 7.4.2 Instance Data Triggering the Warning

```json
{
  "definition": "https://grants.example.gov/forms/annual-budget|2025-06-01",
  "status": "in-progress",
  "data": {
    "total_expenditure": 280000.00,
    "budget_justification": ""
  }
}
```

The prior-year total is $200,000.00. The proposed amount is $280,000.00.
The year-over-year change is 40%, exceeding the 25% threshold.

#### 7.4.3 ValidationReport

```json
{
  "definition": "https://grants.example.gov/forms/annual-budget|2025-06-01",
  "valid": false,
  "results": [
    {
      "path": "total_expenditure",
      "severity": "warning",
      "shapeId": "yoy-variance-warning",
      "message": "The proposed expenditure ($280,000.00) differs from the prior year actual ($200,000.00) by 40%. Changes exceeding 25% require additional justification in the narrative.",
      "value": 280000.00,
      "context": {
        "prior_year_value": 200000.00,
        "change_percentage": 40
      }
    },
    {
      "path": "budget_justification",
      "severity": "error",
      "code": "required",
      "message": "This field is required.",
      "value": ""
    }
  ]
}
```

`valid` is `false` because of the error-severity result on
`budget_justification` (empty string fails `required`). The warning on
`total_expenditure` does not by itself cause invalidity. Once the user
provides a justification narrative, `valid` will become `true` even
though the year-over-year warning persists.

---

### 7.5 Screener Routing to Form Variants

This example demonstrates a short screener form that asks classification
questions and routes the user to one of two form variants based on the
answers. The routing decision is expressed as a calculated field whose
value is a definition URL.

**Demonstrated features:**

- Choice fields driving routing logic
- A calculated routing field producing a definition URL
- `derivedFrom` relationships between screener and variant forms
- Dynamic form selection based on user input

#### 7.5.1 Screener Definition

```json
{
  "url": "https://grants.example.gov/forms/progress-screener",
  "version": "2025-06-01",
  "status": "active",
  "title": "Progress Report — Screener",

  "items": [
    {
      "key": "award_type",
      "type": "field",
      "dataType": "string",
      "label": "What type of award is this?",
      "choices": [
        { "value": "grant",             "label": "Grant" },
        { "value": "cooperative_agreement", "label": "Cooperative Agreement" },
        { "value": "contract",          "label": "Contract" }
      ]
    },
    {
      "key": "reporting_period_type",
      "type": "field",
      "dataType": "string",
      "label": "Is this an interim or final report?",
      "choices": [
        { "value": "interim", "label": "Interim (Quarterly / Semi-annual)" },
        { "value": "final",   "label": "Final" }
      ]
    },
    {
      "key": "total_award_value",
      "type": "field",
      "dataType": "decimal",
      "label": "Total award value ($)"
    },
    {
      "key": "has_subawards",
      "type": "field",
      "dataType": "boolean",
      "label": "Does this award include any subawards?"
    },
    {
      "key": "routed_form",
      "type": "field",
      "dataType": "string",
      "label": "Assigned Report Form",
      "hint": "Determined automatically based on your answers above."
    }
  ],

  "binds": [
    { "path": "award_type",            "required": true },
    { "path": "reporting_period_type",  "required": true },
    { "path": "total_award_value",      "required": true, "constraint": "$ > 0" },
    { "path": "has_subawards",          "required": true },
    {
      "path": "routed_form",
      "readonly": true,
      "calculate": "if($reporting_period_type = 'final' or $total_award_value >= 500000 or $has_subawards = true, 'https://grants.example.gov/forms/full-progress-report|2025-06-01', 'https://grants.example.gov/forms/abbreviated-progress-report|2025-06-01')"
    }
  ]
}
```

**Routing logic:** The user is routed to the **full report** if ANY of
the following are true:

1. The reporting period is "final".
2. The total award value is $500,000 or more.
3. The award includes subawards.

Otherwise, the user is routed to the **abbreviated report**.

#### 7.5.2 Variant Definitions (Headers Only)

The full and abbreviated reports declare their lineage via `derivedFrom`:

```json
{
  "url": "https://grants.example.gov/forms/full-progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Full Progress Report",
  "derivedFrom": [
    "https://grants.example.gov/forms/progress-screener|2025-06-01"
  ]
}
```

```json
{
  "url": "https://grants.example.gov/forms/abbreviated-progress-report",
  "version": "2025-06-01",
  "status": "active",
  "title": "Abbreviated Progress Report",
  "derivedFrom": [
    "https://grants.example.gov/forms/progress-screener|2025-06-01"
  ]
}
```

The `derivedFrom` property is informational. Processors SHOULD use it to
assist in traceability and auditing. Processors MUST NOT require
`derivedFrom` to be resolvable at runtime.

#### 7.5.3 Screener Response and Routing Result

```json
{
  "definition": "https://grants.example.gov/forms/progress-screener|2025-06-01",
  "status": "complete",
  "data": {
    "award_type": "grant",
    "reporting_period_type": "interim",
    "total_award_value": 175000.00,
    "has_subawards": false,
    "routed_form": "https://grants.example.gov/forms/abbreviated-progress-report|2025-06-01"
  }
}
```

The consuming application reads `routed_form` and navigates the user to
the abbreviated report definition. The screener Response SHOULD be
retained for audit purposes.

---

### 7.6 External Validation Failure

This example demonstrates a field that passes local (client-side)
validation but fails external (server-side) validation. The field is an
Employer Identification Number (EIN) that conforms to the required
format pattern but references a non-existent entity in an external
database.

**Demonstrated features:**

- Field with pattern constraint (local format validation)
- External validation result injected with `source: "external"`
- Both local and external results in the same ValidationReport
- Report is invalid due to external error

#### 7.6.1 Definition Fragment

```json
{
  "url": "https://grants.example.gov/forms/entity-registration",
  "version": "2025-06-01",
  "status": "active",
  "title": "Entity Registration — Identification",

  "items": [
    {
      "key": "organization_name",
      "type": "field",
      "dataType": "string",
      "label": "Organization Legal Name"
    },
    {
      "key": "ein",
      "type": "field",
      "dataType": "string",
      "label": "Employer Identification Number (EIN)",
      "hint": "Nine-digit number assigned by the IRS, in XX-XXXXXXX format."
    },
    {
      "key": "duns_number",
      "type": "field",
      "dataType": "string",
      "label": "UEI / DUNS Number"
    }
  ],

  "binds": [
    {
      "path": "organization_name",
      "required": true
    },
    {
      "path": "ein",
      "required": true,
      "constraint": "matches($, '^[0-9]{2}-[0-9]{7}$')",
      "constraintMessage": "EIN must be in XX-XXXXXXX format (e.g., 12-3456789)."
    },
    {
      "path": "duns_number",
      "required": true,
      "constraint": "matches($, '^[A-Z0-9]{12}$')",
      "constraintMessage": "UEI must be exactly 12 alphanumeric characters."
    }
  ],

  "extensions": {
    "x-irs-validation": {
      "fields": ["ein"],
      "endpoint": "https://api.irs.gov/validate-ein",
      "timeout": 5000,
      "description": "Validates EIN existence against IRS database. Invoked server-side after local validation passes."
    }
  }
}
```

#### 7.6.2 Instance Data

```json
{
  "definition": "https://grants.example.gov/forms/entity-registration|2025-06-01",
  "status": "in-progress",
  "data": {
    "organization_name": "Northwind Research Foundation",
    "ein": "99-0000001",
    "duns_number": "N8K4Q2R7J1M3"
  }
}
```

The EIN `99-0000001` matches the pattern `^[0-9]{2}-[0-9]{7}$`, so
local validation passes. However, the IRS database lookup determines
that this EIN does not correspond to any registered entity.

#### 7.6.3 ValidationReport — Combined Local and External Results

A processor that performs both local and external validation MUST
produce a single ValidationReport containing results from both sources:

```json
{
  "definition": "https://grants.example.gov/forms/entity-registration|2025-06-01",
  "valid": false,
  "results": [
    {
      "path": "ein",
      "severity": "error",
      "code": "external-validation-failed",
      "message": "EIN 99-0000001 was not found in the IRS database. Verify the number and try again.",
      "value": "99-0000001",
      "source": "external",
      "sourceId": "x-irs-validation",
      "context": {
        "endpoint": "https://api.irs.gov/validate-ein",
        "response_code": 404,
        "checked_at": "2025-06-15T14:32:07Z"
      }
    }
  ]
}
```

**Key observations:**

1. **Local validation passed:** There is no result for the `constraint`
   bind on `ein` because the pattern check succeeded. Absence of a
   result for a constraint means the constraint is satisfied.

2. **External validation failed:** The result has `source: "external"`
   and `sourceId: "x-irs-validation"`, identifying it as originating
   from an external system rather than from bind or shape evaluation.

3. **Report is invalid:** `valid` is `false` because the external
   result has error severity. External results participate in the
   conformance determination identically to local results: error
   severity → invalid; warning or info severity → does not affect
   validity.

4. **Context metadata:** The `context` object carries diagnostic
   information from the external system. Processors SHOULD include
   sufficient context for debugging but MUST NOT include sensitive
   credentials or internal system details.

Processors MUST support external validation results being injected into
a ValidationReport after initial local validation. The combined report
MUST re-evaluate the `valid` flag considering all results regardless of
source.

---

## 8. Extension Points

Formspec is designed to be extended without modifying the core
specification. This section defines the normative requirements for
extension mechanisms. Implementors MAY use these mechanisms to support
domain-specific functionality while preserving interoperability with
conforming processors.

All extension identifiers (type names, function names, property keys,
constraint names, namespace keys) MUST be prefixed with `x-` to
guarantee no collision with identifiers introduced in future versions of
this specification. A processor encountering a non-prefixed identifier
it does not recognize MUST treat it as a specification error.

---

### 8.1 Custom Data Types

Implementors MAY register custom data types beyond the core set defined
in this specification. Custom data types extend the type system for
domain-specific value semantics.

```json
{
  "extensions": {
    "dataTypes": {
      "x-currency-usd": {
        "baseType": "decimal",
        "precision": 2,
        "constraints": {
          "minimum": 0
        },
        "metadata": {
          "prefix": "$",
          "thousandsSeparator": true
        }
      },
      "x-federal-fiscal-year": {
        "baseType": "integer",
        "constraints": {
          "minimum": 1900,
          "maximum": 2100
        },
        "metadata": {
          "display": "FY ${value}"
        }
      }
    }
  }
}
```

The following requirements apply to custom data types:

1. Custom type names MUST be prefixed with `x-`.

2. Custom types MUST declare a `baseType` from the core type set
   (`string`, `integer`, `decimal`, `boolean`, `date`, `dateTime`,
   `time`, `uri`). The `baseType` serves as a fallback: processors
   that do not understand the custom type MUST treat the field as
   having the `baseType` and SHOULD log an informational notice.

3. Custom types MAY declare `constraints` that further restrict the
   base type's value space. These constraints MUST be expressible in
   terms of the base type's comparison operators.

4. Custom types MAY declare `metadata` for presentation-layer
   consumption. Processors MUST ignore `metadata` properties they do
   not understand. Metadata MUST NOT alter validation semantics.

5. A Definition that references a custom data type MUST declare that
   type in its `extensions.dataTypes` object. Processors encountering
   a reference to an undeclared custom type MUST raise a specification
   error.

---

### 8.2 Custom Functions

Implementors MAY register custom functions for use in FEL expressions.
Custom functions extend the expression language for domain-specific
computations.

```json
{
  "extensions": {
    "functions": {
      "x-fiscal-quarter": {
        "description": "Returns the federal fiscal quarter (1–4) for a given date. The federal fiscal year begins October 1.",
        "parameters": [
          { "name": "date", "type": "date" }
        ],
        "returns": "integer",
        "implementation": "external"
      },
      "x-cfda-lookup": {
        "description": "Returns the program title for a CFDA number from the SAM.gov catalog.",
        "parameters": [
          { "name": "cfda_number", "type": "string" }
        ],
        "returns": "string",
        "implementation": "external"
      }
    }
  }
}
```

The following requirements apply to custom functions:

1. Custom function names MUST be prefixed with `x-`.

2. A Definition using custom functions in any FEL expression MUST
   declare those functions in its `extensions.functions` object.

3. Each function declaration MUST include `parameters` (an array of
   `{name, type}` objects) and `returns` (a core data type name).

4. The `implementation` property MUST be one of:
   - `"external"` — the processor delegates to an external service or
     host-language callback. The mechanism for registration is outside
     the scope of this specification.
   - `"expression"` — the function body is a FEL expression provided
     in a `body` property. Parameters are available as `$name`
     references within the body.

5. Processors that encounter a call to a custom function they do not
   support MUST raise a clear, actionable error identifying the
   function name and the Definition that references it. Processors
   MUST NOT silently skip the function call or substitute a default
   value.

6. Custom functions MUST be pure (side-effect-free) with respect to
   Instance data. A custom function MUST NOT modify any field value
   as a side effect of evaluation.

---

### 8.3 Custom Validation Constraint Components

Borrowing from SHACL's constraint component architecture, implementors
MAY define reusable constraint patterns that can be applied across
multiple shapes.

```json
{
  "extensions": {
    "constraints": {
      "x-unique-within": {
        "description": "Value must be unique within the specified collection path. No two items in the collection may have the same value for the targeted field.",
        "parameters": [
          { "name": "collection", "type": "string", "description": "Path to the repeatable group" }
        ],
        "implementation": "external"
      },
      "x-sum-not-exceeds": {
        "description": "The sum of the specified fields must not exceed a given maximum.",
        "parameters": [
          { "name": "fields", "type": "array",   "description": "Array of field paths to sum" },
          { "name": "max",    "type": "decimal", "description": "Maximum allowed sum" }
        ],
        "implementation": "external"
      }
    }
  }
}
```

Usage within a shape:

```json
{
  "id": "unique-category-names",
  "severity": "error",
  "targets": ["categories[*].category_name"],
  "x-unique-within": {
    "collection": "categories"
  },
  "message": "Category name must be unique. '${$}' is used more than once."
}
```

The following requirements apply to custom constraint components:

1. Custom constraint names MUST be prefixed with `x-`.

2. A Definition using custom constraints MUST declare them in
   `extensions.constraints`.

3. When a custom constraint appears as a property on a shape object,
   the property name MUST match the declared constraint name, and its
   value MUST be an object whose keys correspond to the declared
   parameters.

4. Processors that do not support a custom constraint MUST raise an
   error. Processors MUST NOT silently ignore an unsupported
   constraint, as doing so would produce a false-positive validation
   report.

---

### 8.4 Extension Properties

Any object in a Formspec Definition, Instance, Response, or
ValidationReport MAY carry an `extensions` property containing
implementor-specific data.

```json
{
  "key": "ein",
  "type": "field",
  "dataType": "string",
  "label": "Employer Identification Number",
  "extensions": {
    "x-irs-validation": {
      "endpoint": "https://api.irs.gov/validate-ein",
      "timeout": 5000,
      "retryPolicy": {
        "maxAttempts": 3,
        "backoffMs": 1000
      }
    },
    "x-analytics": {
      "trackFocus": true,
      "trackDuration": true
    }
  }
}
```

The following requirements apply to extension properties:

1. All keys within an `extensions` object MUST be prefixed with `x-`.

2. Processors MUST ignore extension properties they do not understand.
   Unrecognized extension properties MUST NOT cause a processing
   error, warning, or behavioral change.

3. Extension properties MUST NOT alter the core semantics defined by
   this specification. Specifically:
   - An extension property MUST NOT change whether a field is
     required, relevant, readonly, or calculated.
   - An extension property MUST NOT modify the evaluation of FEL
     expressions.
   - An extension property MUST NOT affect the `valid` flag of a
     ValidationReport through core validation logic. (An extension
     MAY contribute external validation results per §7.6, but these
     are external results, not core-semantic alterations.)

4. Extension properties SHOULD be self-documenting. Each top-level
   extension key SHOULD correspond to a published extension
   specification or at minimum include a `description` property.

5. When serializing a Formspec document, processors MUST preserve
   extension properties they do not understand. A round-trip through
   a conforming processor MUST NOT strip unrecognized extensions.

---

### 8.5 Extension Namespaces

Organizations publishing multiple related extensions SHOULD use a
namespace convention to group them under a single `x-{namespace}` key.

```json
{
  "extensions": {
    "x-gov-grants": {
      "version": "2.0",
      "cfda-number": true,
      "sam-registration-required": true,
      "single-audit-threshold": 750000
    },
    "x-org-branding": {
      "version": "1.3",
      "theme": "agency-dark",
      "logoUrl": "https://example.gov/assets/logo.svg"
    }
  }
}
```

The following requirements apply to extension namespaces:

1. A namespace key MUST follow the pattern `x-{organization}-{domain}`
   or `x-{domain}` where `{organization}` and `{domain}` consist of
   lowercase ASCII letters and hyphens only.

2. Namespace objects SHOULD include a `version` property to support
   evolution of the extension independently of the Formspec
   specification version.

3. Organizations SHOULD publish a machine-readable schema for their
   extension namespace to enable validation by processors that
   support the extension.

4. Processors MUST treat the entire namespace object as opaque if
   they do not support the namespace. The requirements of §8.4
   (ignore, preserve, do not alter core semantics) apply to namespace
   objects in their entirety.

---

## 9. Lineage — What Was Borrowed and Why

Formspec is not designed in a vacuum. This section documents the
standards, specifications, and systems from which Formspec draws its
concepts, and explains the adaptations made for the JSON-native,
form-validation context. This section is informative, not normative.

Transparency of lineage serves three purposes:

1. **Intellectual honesty.** Credit where credit is due.
2. **Onboarding.** Implementors familiar with the source standards can
   map their existing knowledge to Formspec concepts.
3. **Design rationale.** Where Formspec diverges from a source, the
   reason is documented to prevent future re-litigation.

---

### 9.1 From W3C XForms (2003)

XForms is the most significant ancestor of Formspec. The core
architectural decisions — separation of model from view, reactive
dependency graphs, non-relevant pruning, and the four-phase processing
cycle — all originate in XForms.

| Concept | XForms Origin | Formspec Adaptation |
|---------|--------------|---------------------|
| Model Item Properties | `<bind>` elements with `calculate`, `constraint`, `relevant`, `required`, `readonly` attributes | Bind objects with identical property names; FEL expressions replace XPath |
| Reactive dependency graph | Topological sort of XPath dependencies with pertinent subgraph recalculation | Identical algorithm, applied to FEL field references parsed from `$fieldKey` tokens |
| Non-relevant exclusion | `relevant="false()"` causes node to be pruned from submission XML | Same semantics: non-relevant = hidden from user + excluded from Response + validation suspended |
| Repeat | `<repeat nodeset="...">` with dynamic per-item evaluation context | Repeatable groups with `[*]` path notation; `@index` and `@count` built-in accessors |
| Multiple instances | `instance('id')` function to reference secondary data sources | Named instances with `@instance('id')` in FEL; declared with schema and optional inline data |
| MVC separation | Model / View / Controller as independent architectural layers | Structure layer / Behavior layer / Presentation layer (presentation explicitly out of scope) |
| Four-phase processing cycle | Rebuild → Recalculate → Revalidate → Refresh | Rebuild → Recalculate → Revalidate → Notify (Refresh renamed; UI update is implementation-specific) |
| Submission pipeline | Select relevant nodes → prune non-relevant → validate → serialize to XML | Same pipeline; serialization target is JSON, not XML |
| Expression context scoping | Nearest ancestor binding element narrows the XPath evaluation context | Lexical scoping through item hierarchy; `$` as self-reference within constraints |

**What was NOT borrowed from XForms:**

- **XML Events.** XForms uses XML Events (DOM Level 2 Events with XML
  syntax) for action dispatching. Formspec has no event system; state
  transitions are implicit in the reactive dependency graph.
- **XPath dependency on XML namespaces and node types.** FEL operates
  on JSON values, which have no namespace axis, attribute axis, or
  mixed content.
- **The action system.** XForms defines `setvalue`, `insert`, `delete`,
  `send`, `toggle`, `setfocus`, and others. Formspec treats all
  mutations as data changes that trigger the processing cycle, not as
  imperative actions.
- **The UI control vocabulary.** XForms defines `<input>`, `<select>`,
  `<select1>`, `<trigger>`, `<output>`, etc. Formspec delegates all
  UI concerns to the presentation layer.
- **Synchronous/asynchronous submission modes.** Formspec Responses are
  data documents; transport is outside the specification's scope.

---

### 9.2 From W3C SHACL (2017)

SHACL (Shapes Constraint Language) provides the architectural model for
Formspec's validation system. The concept of "shapes" as named,
composable validation rule sets applied to a data graph is directly
borrowed.

| Concept | SHACL Origin | Formspec Adaptation |
|---------|-------------|---------------------|
| Three severity levels | `sh:Violation`, `sh:Warning`, `sh:Info` | `error`, `warning`, `info` — with a different conformance rule (see below) |
| Structured ValidationResult | `focusNode`, `resultPath`, `value`, `message`, `sourceShape`, `sourceConstraintComponent` | `path`, `severity`, `message`, `code`, `shapeId`, `value`, `context` |
| Constraint composition | `sh:and`, `sh:or`, `sh:not`, `sh:xone` | `and`, `or`, `not`, `xone` logical combinators on validation shapes |
| Shapes/data separation | Shapes graph + data graph as independent inputs | Definitions + Instances as independent documents |
| Custom constraint components | `sh:ConstraintComponent` with parameters + validators | Extension constraints with parameters + external implementation (§8.3) |
| Severity as metadata | Declared per-shape, not per-individual-constraint | Same: `severity` is a shape-level property; all results from a shape inherit its severity |

**Key divergence from SHACL:**

In SHACL, `sh:conforms` is `false` if ANY validation result exists,
regardless of severity. A shapes graph that produces only `sh:Info`
results is non-conforming. This design makes warnings and informational
messages operationally useless in systems where advisory messages are
expected — which includes virtually all form-based data collection
systems.

Formspec deliberately breaks from SHACL on this point:

> **Formspec conformance rule:** `valid` is `false` if and only if at
> least one result with `severity: "error"` exists. Results with
> `severity: "warning"` or `severity: "info"` do not affect the `valid`
> flag.

This decision was motivated by real-world requirements in grants
management, healthcare reporting, and financial compliance, where forms
routinely produce advisory warnings ("this value is unusually high") and
informational notes ("this field was auto-calculated") that must not
block submission.

---

### 9.3 From HL7 FHIR R5 / SDC (2023)

FHIR's Questionnaire and Structured Data Capture (SDC) implementation
guide represent the most mature modern form standard in production use.
Formspec borrows heavily from FHIR's identity model, response
architecture, and expression extensions.

| Concept | FHIR Origin | Formspec Adaptation |
|---------|------------|---------------------|
| Canonical URL + version + status | `Questionnaire.url`, `.version`, `.status` lifecycle model | Identical: `url` + `version` + `status` with same semantics |
| Response pinning | `QuestionnaireResponse.questionnaire` references a specific Questionnaire version | `Response.definition` uses `url\|version` format for unambiguous binding |
| `derivedFrom` | `Questionnaire.derivedFrom` for lineage tracking between form versions | Same property name and semantics |
| `linkId` | Stable item identifier bridging Questionnaire ↔ QuestionnaireResponse | `key` property on items; serves identical bridging function |
| Item taxonomy | `group` / `display` / `question` item types | `group` / `display` / `field` (renamed from `question` for clarity and generality) |
| Two-tier conditionals | `enableWhen` (simple comparison) + `enableWhenExpression` (FHIRPath) | Single tier using FEL; simple cases are just simple expressions, eliminating the need for a separate simple syntax |
| `disabledDisplay` | `hidden` / `protected` display modes for disabled items | Same property on binds; same behavioral semantics |
| Variable scoping | SDC `variable` extension with `name` + `expression` + ancestor→descendant visibility | `variables` array with `name` + `expression` + explicit `scope` property |
| `initialExpression` vs `calculatedExpression` | Once-evaluated vs continuously-evaluated expressions | `initialValue` (evaluated once at instantiation) vs `calculate` bind (continuously reactive) |
| Modular composition | `subQuestionnaire` + `$assemble` operation + `keyPrefix` | `$ref` + `keyPrefix` + assembly at publish time |
| `assembledFrom` | Metadata listing source Questionnaires after `$assemble` | Same metadata property populated after assembly |
| `versionAlgorithm` | Explicit declaration of version comparison semantics (`semver`, `integer`, `date`, etc.) | Same property with same purpose |

**What was NOT borrowed from FHIR:**

- **FHIR resource model.** Formspec documents are plain JSON, not FHIR
  resources. They do not require a FHIR server, FHIR identifier
  system, or FHIR-specific serialization.
- **FHIRPath as the expression language.** FHIRPath is tightly coupled
  to FHIR's type system and resource navigation model. FEL is designed
  for flat and nested JSON field references without FHIR dependencies.
- **`enableWhen` simple operator syntax.** FHIR provides both
  `enableWhen` (a simple `{question, operator, answer}` tuple) and
  `enableWhenExpression` (a FHIRPath string). Formspec uses only FEL
  expressions, accepting the slight verbosity increase for simple
  cases in exchange for a single, consistent conditional mechanism.
- **Answer value sets via FHIR terminology services.** Formspec's
  `choices` are inline JSON arrays. Integration with external
  terminology services is an extension concern, not a core feature.
- **The three population mechanisms.** FHIR SDC defines
  `$populate` (observation-based), `$populatehtml` (narrative-based),
  and `$populatelink` (link-based). Formspec uses secondary instances
  and `initialValue` expressions, which are more general.

---

### 9.4 From Secondary Sources

| Concept | Source | Formspec Adaptation |
|---------|--------|---------------------|
| `${field}` reference syntax | ODK XLSForm | `$fieldKey` reference syntax — `$` prefix instead of `${}` wrapper for cleaner nesting in complex expressions |
| `.` self-reference in constraints | ODK XLSForm | `$` as self-reference within constraint expressions, unifying the reference syntax |
| PEG-parseable expression grammar | SurveyJS | FEL is designed to be parseable by a PEG (Parsing Expression Grammar) parser, ensuring unambiguous parsing without separate lexer/parser stages |
| Rich built-in operators | SurveyJS (`empty`, `contains`, `notempty`) | Built-in FEL functions: `empty()`, `contains()`, `present()`, `length()`, with a defined type signature for each |
| Expression validation API | SurveyJS (client-side expression testing) | Recommended implementation feature: processors SHOULD expose an API for validating FEL expressions at design time, prior to form deployment |
| Data/UI schema separation | JSON Forms (JSON Schema for data, UI Schema for layout) | Structure layer / Presentation layer separation; presentation explicitly out of scope to avoid under-specifying a complex domain |
| Validation modes | JSON Forms (`validateMode: "onBlur"`, `"onChange"`, etc.) | `continuous` / `deferred` / `disabled` validation modes; the mapping to UI events is an implementation concern |
| External error injection | JSON Forms / React JSON Schema Form (RJSF) `additionalErrors` | External validation results with `source` and `sourceId` properties, merged into a single ValidationReport |
| Mapping DSL for data transformation | CommonGrants (proposed) | Not included in core specification. Data mapping and transformation between Formspec Responses and backend schemas is identified as a candidate for a future companion specification. |

---

### 9.5 What Is Original to Formspec

While Formspec is deliberately derivative — preferring proven concepts
over novel invention — several design elements are original
combinations or new constructs not found in the source standards.

1. **Unified expression language (FEL).** Formspec introduces a
   purpose-built expression language that is neither XPath (XForms),
   FHIRPath (FHIR), JavaScript (most web form libraries), nor a
   proprietary grammar. FEL is designed for exactly one domain — form
   logic — with an explicit type system, JSON-native value semantics,
   no host-language dependency, and guaranteed PEG-parseability. The
   language is intentionally small: it supports field references,
   arithmetic, comparison, logical operators, string functions, and
   aggregate functions. It deliberately excludes variable assignment,
   loops, closures, and side effects.

2. **Validation Shapes as first-class composable objects.** Neither
   XForms nor FHIR R5 have named, composable, reusable validation rule
   sets. XForms has per-node `constraint` attributes; FHIR has simple
   `invariant` elements. Formspec borrows SHACL's shape architecture
   — named shapes with targets, severity, and structured results —
   and applies it to form validation. This combination (SHACL shapes +
   form data model) is novel.

3. **Modified SHACL conformance semantics.** The decision that only
   error-severity results (not warnings or info) affect the `valid`
   flag is an original divergence from SHACL, motivated by operational
   requirements in real-world form systems where advisory messages are
   the norm, not the exception.

4. **Bind paths with repeat notation.** The `group[*].field` path
   syntax for binding within repeatable contexts is a JSON-native
   alternative to XPath node-set expressions. It is designed for the
   hierarchical JSON data model and provides clear semantics for
   per-instance vs. aggregate expression evaluation without requiring
   a full path language.

5. **The three-layer separation applied to JSON forms.** While XForms
   pioneered MVC separation for forms-over-XML, Formspec is the first
   specification to apply this architecture as
   Structure / Behavior / Presentation with JSON as the native data
   format and an explicitly out-of-scope presentation layer. The
   deliberate exclusion of presentation concerns is itself a design
   decision: by refusing to under-specify UI, Formspec avoids the
   trap of mandating a lowest-common-denominator widget set.

6. **Cross-instance expressions with named instances.** While XForms
   has multiple instances accessed via `instance('id')`, Formspec's
   `@instance('id')` syntax within FEL is original, as is the
   declaration model for secondary data sources that combines a
   schema definition, a source URL for runtime resolution, and inline
   fallback data for offline or testing scenarios — all in a single
   declaration.

7. **Extension namespace convention with fallback guarantees.** The
   `x-` prefix convention for custom types, functions, constraints,
   and properties, combined with the requirement that custom types
   declare a `baseType` fallback and that processors preserve
   unrecognized extensions on round-trip, provides a forward-
   compatibility contract not found in the source standards. This
   enables domain-specific extension (federal grants, clinical trials,
   financial reporting) without fragmenting the core specification.

---

*End of Part 3 — Sections 7–9.*
