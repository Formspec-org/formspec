# Implementation Plan: Invoice with Line Items

> [!IMPORTANT]
> This example is the **repeat group + reactive computation** showcase. While the Grant Report has zero repeats, this form is built entirely around them. It exercises the most complex reactive patterns in the engine: element-wise array operations, multi-hop calculate chains, and repeat group lifecycle management.

## Directory Structure

```
examples/invoice/
├── invoice.definition.json            # Definition with line items repeat group
├── invoice.component.json             # Component doc with DataTable for line items
├── invoice.theme.json                 # Clean commercial theme
├── invoice.mapping.json               # Mapping to CSV export (accounting)
└── fixtures/
    ├── invoice-empty.response.json    # No line items yet
    ├── invoice-single.response.json   # One line item
    ├── invoice-multi.response.json    # Multiple line items with totals
    ├── invoice-max.response.json      # At maxRepeat boundary
    └── invoice-null-qty.response.json # Partial entry (null propagation test)
```

---

## Phase 1: Definition (`invoice.definition.json`)

### 1.1 Identity & Metadata

```json
{
  "$formspec": "1.0",
  "url": "https://formspec.org/examples/invoice",
  "version": "1.0.0",
  "status": "active",
  "title": "Invoice",
  "name": "invoice",
  "description": "Line-item invoice with calculated totals, tax, and discount.",
  "extensions": ["x-formspec-common"],
  "formPresentation": {
    "pageMode": "single",
    "labelPosition": "top",
    "density": "comfortable",
    "defaultCurrency": "USD"
  }
}
```

### 1.2 Items (Structure Layer)

#### Invoice Header

```json
{
  "key": "header",
  "type": "group",
  "label": "Invoice Details",
  "children": [
    {
      "key": "invoiceNumber",
      "type": "field",
      "dataType": "string",
      "label": "Invoice Number",
      "hint": "Auto-generated if left blank"
    },
    {
      "key": "invoiceDate",
      "type": "field",
      "dataType": "date",
      "label": "Invoice Date",
      "initialValue": "=today()"
    },
    {
      "key": "dueDate",
      "type": "field",
      "dataType": "date",
      "label": "Due Date",
      "hint": "Payment due by this date"
    },
    {
      "key": "customerName",
      "type": "field",
      "dataType": "string",
      "label": "Customer Name"
    },
    {
      "key": "customerEmail",
      "type": "field",
      "dataType": "string",
      "label": "Customer Email",
      "extensions": { "x-formspec-email": true }
    }
  ]
}
```

#### Line Items — Repeat Group

```json
{
  "key": "lineItems",
  "type": "group",
  "label": "Line Items",
  "repeatable": true,
  "minRepeat": 1,
  "maxRepeat": 50,
  "children": [
    {
      "key": "description",
      "type": "field",
      "dataType": "string",
      "label": "Description"
    },
    {
      "key": "quantity",
      "type": "field",
      "dataType": "integer",
      "label": "Qty",
      "initialValue": 1
    },
    {
      "key": "unitPrice",
      "type": "field",
      "dataType": "money",
      "label": "Unit Price",
      "currency": "USD"
    },
    {
      "key": "lineTotal",
      "type": "field",
      "dataType": "money",
      "label": "Line Total",
      "currency": "USD"
    }
  ]
}
```

> [!NOTE]
> `minRepeat: 1` ensures at least one line item exists at all times. `maxRepeat: 50` provides an upper bound. Exceeding these produces validation errors (`MIN_REPEAT` / `MAX_REPEAT`), but the engine doesn't block add/remove operations.

#### Totals Section

```json
{
  "key": "totals",
  "type": "group",
  "label": "Totals",
  "children": [
    {
      "key": "subtotal",
      "type": "field",
      "dataType": "money",
      "label": "Subtotal",
      "currency": "USD"
    },
    {
      "key": "taxRate",
      "type": "field",
      "dataType": "decimal",
      "label": "Tax Rate",
      "extensions": { "x-formspec-percentage": true },
      "initialValue": 0
    },
    {
      "key": "taxAmount",
      "type": "field",
      "dataType": "money",
      "label": "Tax Amount",
      "currency": "USD"
    },
    {
      "key": "discountPercent",
      "type": "field",
      "dataType": "decimal",
      "label": "Discount",
      "extensions": { "x-formspec-percentage": true },
      "initialValue": 0
    },
    {
      "key": "discountAmount",
      "type": "field",
      "dataType": "money",
      "label": "Discount Amount",
      "currency": "USD"
    },
    {
      "key": "grandTotal",
      "type": "field",
      "dataType": "money",
      "label": "Grand Total",
      "currency": "USD"
    }
  ]
}
```

#### Notes

```json
{
  "key": "notes",
  "type": "field",
  "dataType": "text",
  "label": "Notes",
  "hint": "Payment terms, special instructions, etc.",
  "presentation": { "widgetHint": "textarea" }
}
```

### 1.3 Variables

```json
{
  "variables": [
    {
      "name": "lineCount",
      "expression": "count($lineItems[*].description)",
      "scope": "#"
    }
  ]
}
```

### 1.4 Binds (Behavior Layer)

#### Line Item Calculate — The Key Pattern

```json
{
  "path": "lineItems[*].lineTotal",
  "calculate": "money($quantity * moneyAmount($unitPrice), 'USD')"
}
```

> [!IMPORTANT]
> This is the per-instance calculate bind. Inside a repeat, `$quantity` and `$unitPrice` resolve to the current instance's values (lexical scoping). The bind fires independently for each repeat instance.

#### Subtotal — Element-Wise Array Operation

```json
{
  "path": "totals.subtotal",
  "calculate": "moneySum($lineItems[*].lineTotal)"
}
```

> [!TIP]
> `moneySum($lineItems[*].lineTotal)` is the showcase FEL pattern. `$lineItems[*].lineTotal` produces an array of money values across all repeat instances, and `moneySum()` aggregates them. This is the most powerful reactive pattern in Formspec — the subtotal automatically recomputes whenever any line item's quantity, price, or the number of line items changes.

Alternative without money type (pure element-wise):

```
sum($lineItems[*].quantity * $lineItems[*].unitPrice)
```

This produces element-wise multiplication of two equal-length arrays, then sums the result. Both patterns should be demonstrated.

#### Tax & Discount Chain

```json
[
  {
    "path": "totals.taxAmount",
    "calculate": "money(moneyAmount($totals.subtotal) * $totals.taxRate / 100, 'USD')"
  },
  {
    "path": "totals.discountAmount",
    "calculate": "money(moneyAmount($totals.subtotal) * $totals.discountPercent / 100, 'USD')"
  },
  {
    "path": "totals.grandTotal",
    "calculate": "moneyAdd(moneyAdd($totals.subtotal, $totals.taxAmount), money(-1 * moneyAmount($totals.discountAmount), 'USD'))"
  }
]
```

> [!NOTE]
> This creates a 4-hop dependency chain: `unitPrice/qty → lineTotal → subtotal → taxAmount/discountAmount → grandTotal`. The engine's topological sort ensures correct evaluation order. Changing a single line item's quantity triggers recalculation through the entire chain.

#### Required + Constraint Binds

```json
[
  {
    "path": "lineItems[*].description",
    "required": true
  },
  {
    "path": "lineItems[*].quantity",
    "required": true,
    "constraint": "$ > 0",
    "constraintMessage": "Quantity must be positive"
  },
  {
    "path": "lineItems[*].unitPrice",
    "required": true,
    "constraint": "moneyAmount($) >= 0",
    "constraintMessage": "Unit price cannot be negative"
  },
  {
    "path": "header.customerName",
    "required": true
  },
  {
    "path": "header.dueDate",
    "constraint": "$ >= $header.invoiceDate",
    "constraintMessage": "Due date cannot be before invoice date"
  },
  {
    "path": "totals.taxRate",
    "constraint": "$ >= 0 and $ <= 100",
    "constraintMessage": "Tax rate must be between 0% and 100%"
  },
  {
    "path": "totals.discountPercent",
    "constraint": "$ >= 0 and $ <= 100",
    "constraintMessage": "Discount must be between 0% and 100%"
  }
]
```

### 1.5 Shapes (Validation Layer)

```json
[
  {
    "id": "discountNotExceedSubtotal",
    "target": "totals.discountAmount",
    "constraint": "moneyAmount($) <= moneyAmount($totals.subtotal)",
    "message": "Discount cannot exceed the subtotal",
    "severity": "error"
  },
  {
    "id": "grandTotalPositive",
    "target": "totals.grandTotal",
    "constraint": "moneyAmount($) >= 0",
    "message": "Grand total cannot be negative after discounts",
    "severity": "warning"
  },
  {
    "id": "dueDateReasonable",
    "target": "header.dueDate",
    "constraint": "dateDiff($, $header.invoiceDate, 'days') <= 365",
    "message": "Due date is more than a year after invoice date",
    "severity": "warning",
    "timing": "submit"
  }
]
```

---

## Phase 2: Component Document (`invoice.component.json`)

### 2.1 Structure

Single-page layout with a DataTable for line items — the key component that renders repeat groups as an interactive table.

```json
{
  "$formspecComponent": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://formspec.org/examples/invoice",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tree": {
    "component": "Stack",
    "children": [
      {
        "component": "Heading",
        "style": { "text": "Invoice", "level": 1 }
      },
      {
        "component": "Grid",
        "style": { "columns": 2 },
        "children": [
          {
            "component": "Card",
            "style": { "title": "Invoice Details" },
            "children": [
              { "component": "TextInput", "bind": "header.invoiceNumber" },
              { "component": "DatePicker", "bind": "header.invoiceDate" },
              { "component": "DatePicker", "bind": "header.dueDate" }
            ]
          },
          {
            "component": "Card",
            "style": { "title": "Customer" },
            "children": [
              { "component": "TextInput", "bind": "header.customerName" },
              { "component": "TextInput", "bind": "header.customerEmail" }
            ]
          }
        ]
      },
      {
        "component": "DataTable",
        "bind": "lineItems",
        "style": {
          "addLabel": "Add Line Item",
          "removeLabel": "Remove",
          "columns": [
            { "bind": "description", "header": "Description", "width": "40%" },
            { "bind": "quantity", "header": "Qty", "width": "10%" },
            { "bind": "unitPrice", "header": "Unit Price", "width": "20%" },
            { "bind": "lineTotal", "header": "Total", "width": "20%" }
          ]
        }
      },
      {
        "component": "Card",
        "style": { "title": "Totals" },
        "children": [
          {
            "component": "Grid",
            "style": { "columns": 2 },
            "children": [
              { "component": "Spacer" },
              {
                "component": "Stack",
                "children": [
                  { "component": "NumberInput", "bind": "totals.subtotal" },
                  {
                    "component": "Grid",
                    "style": { "columns": 2 },
                    "children": [
                      { "component": "NumberInput", "bind": "totals.taxRate" },
                      { "component": "NumberInput", "bind": "totals.taxAmount" }
                    ]
                  },
                  {
                    "component": "Grid",
                    "style": { "columns": 2 },
                    "children": [
                      { "component": "NumberInput", "bind": "totals.discountPercent" },
                      { "component": "NumberInput", "bind": "totals.discountAmount" }
                    ]
                  },
                  { "component": "Divider" },
                  { "component": "NumberInput", "bind": "totals.grandTotal" }
                ]
              }
            ]
          }
        ]
      },
      { "component": "TextInput", "bind": "notes" }
    ]
  }
}
```

> [!NOTE]
> The **DataTable** component is the key progressive component for repeat groups. It binds to a repeatable group and renders each instance as a row, with add/remove buttons. Child `bind` values resolve within the repeat instance context. This exercises repeat-bound component semantics from the Component Spec §4.

---

## Phase 3: Theme Document (`invoice.theme.json`)

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://formspec.org/examples/invoice",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tokens": {
    "color.primary": "#2563EB",
    "color.primaryLight": "#DBEAFE",
    "color.error": "#DC2626",
    "color.warning": "#D97706",
    "color.success": "#059669",
    "color.background": "#FFFFFF",
    "color.surface": "#F9FAFB",
    "color.border": "#E5E7EB",
    "spacing.sm": 8,
    "spacing.md": 16,
    "spacing.lg": 24,
    "spacing.xl": 32,
    "typography.fontFamily": "'Inter', -apple-system, sans-serif",
    "typography.monoFamily": "'JetBrains Mono', monospace",
    "border.radius": 8
  },
  "defaults": {
    "labelPosition": "top",
    "style": {
      "fontFamily": "$token.typography.fontFamily",
      "borderRadius": "$token.border.radius"
    }
  },
  "selectors": [
    {
      "match": { "dataType": "money" },
      "apply": {
        "style": {
          "textAlign": "right",
          "fontFamily": "$token.typography.monoFamily"
        }
      }
    },
    {
      "match": { "dataType": "integer" },
      "apply": {
        "style": { "textAlign": "right" }
      }
    },
    {
      "match": { "dataType": "decimal" },
      "apply": {
        "style": { "textAlign": "right" }
      }
    }
  ],
  "items": {
    "totals.grandTotal": {
      "style": {
        "fontWeight": "bold",
        "fontSize": "1.25em"
      }
    },
    "totals.subtotal": {
      "widget": "none"
    }
  }
}
```

---

## Phase 4: Mapping Document (`invoice.mapping.json`)

CSV export for accounting software import.

```json
{
  "$formspecMapping": "1.0",
  "version": "1.0.0",
  "definitionRef": "https://formspec.org/examples/invoice",
  "definitionVersion": ">=1.0.0 <2.0.0",
  "direction": "both",
  "targetSchema": {
    "format": "csv",
    "config": {
      "delimiter": ",",
      "header": true,
      "encoding": "utf-8"
    }
  },
  "rules": [
    {
      "sourcePath": "header.invoiceNumber",
      "targetPath": "InvoiceNo",
      "transform": "preserve",
      "priority": 10
    },
    {
      "sourcePath": "header.invoiceDate",
      "targetPath": "Date",
      "transform": "coerce",
      "coerce": "string",
      "priority": 10
    },
    {
      "sourcePath": "header.customerName",
      "targetPath": "Customer",
      "transform": "preserve",
      "priority": 10
    },
    {
      "sourcePath": "lineItems[*].description",
      "targetPath": "ItemDescription",
      "transform": "preserve",
      "priority": 5
    },
    {
      "sourcePath": "lineItems[*].quantity",
      "targetPath": "Qty",
      "transform": "coerce",
      "coerce": "string",
      "priority": 5
    },
    {
      "sourcePath": "lineItems[*].unitPrice",
      "targetPath": "UnitPrice",
      "transform": "expression",
      "expression": "moneyAmount(@source)",
      "priority": 5
    },
    {
      "sourcePath": "lineItems[*].lineTotal",
      "targetPath": "LineTotal",
      "transform": "expression",
      "expression": "moneyAmount(@source)",
      "priority": 5
    }
  ]
}
```

> [!NOTE]
> CSV adapter with repeat groups: each line item produces one row, with header-level fields (InvoiceNo, Date, Customer) duplicated across rows. This exercises the CSV adapter's flat-path constraint and repeat expansion behavior.

---

## Phase 5: Test Fixtures

### 5.1 Multi-item invoice (happy path)

```json
{
  "definitionUrl": "https://formspec.org/examples/invoice",
  "definitionVersion": "1.0.0",
  "status": "completed",
  "authored": "2026-03-04T12:00:00Z",
  "data": {
    "header": {
      "invoiceNumber": "INV-2026-001",
      "invoiceDate": "2026-03-04",
      "dueDate": "2026-04-03",
      "customerName": "Acme Corp",
      "customerEmail": "billing@acme.com"
    },
    "lineItems": [
      { "description": "Widget A", "quantity": 10, "unitPrice": { "amount": "25.00", "currency": "USD" }, "lineTotal": { "amount": "250.00", "currency": "USD" } },
      { "description": "Widget B", "quantity": 5, "unitPrice": { "amount": "49.99", "currency": "USD" }, "lineTotal": { "amount": "249.95", "currency": "USD" } },
      { "description": "Shipping", "quantity": 1, "unitPrice": { "amount": "15.00", "currency": "USD" }, "lineTotal": { "amount": "15.00", "currency": "USD" } }
    ],
    "totals": {
      "subtotal": { "amount": "514.95", "currency": "USD" },
      "taxRate": 8.25,
      "taxAmount": { "amount": "42.48", "currency": "USD" },
      "discountPercent": 5,
      "discountAmount": { "amount": "25.75", "currency": "USD" },
      "grandTotal": { "amount": "531.68", "currency": "USD" }
    },
    "notes": "Net 30. Please reference invoice number on payment."
  }
}
```

### 5.2 Null propagation test

Line item with `quantity: null` (user cleared the field):

```json
{
  "lineItems": [
    { "description": "Consulting", "quantity": null, "unitPrice": { "amount": "150.00", "currency": "USD" }, "lineTotal": null }
  ]
}
```

Expected: `lineTotal` is `null` (null propagation through `$quantity * moneyAmount($unitPrice)`), subtotal should handle null via `moneySum()` which skips nulls.

### 5.3 Boundary: maxRepeat

50 line items (at `maxRepeat`). Adding a 51st should succeed (engine doesn't block), but produce a `MAX_REPEAT` validation error.

---

## Key Patterns to Validate

| Pattern | What to test |
|---|---|
| `addRepeatInstance("lineItems")` | Returns new index, initializes child signals |
| `removeRepeatInstance("lineItems", 1)` | Middle removal shifts indices, updates `$lineItems[*]` arrays |
| `$lineItems[*].quantity` | Returns array of all quantities across instances |
| `$lineItems[*].qty * $lineItems[*].unitPrice` | Element-wise multiplication |
| `moneySum($lineItems[*].lineTotal)` | Aggregate over money array |
| `structureVersion` signal | Increments on every add/remove |
| Dependency rebuild (Phase 1) | Triggered when line items added/removed |
| 4-hop calculate chain | `unitPrice → lineTotal → subtotal → tax → grandTotal` |

---

## Implementation Checklist

- [ ] Create `invoice.definition.json` with header, line items, totals
- [ ] Implement all calculate binds with money functions
- [ ] Implement all constraint binds (positive qty, valid dates)
- [ ] Implement shapes (discount ≤ subtotal, reasonable due date)
- [ ] Create `invoice.component.json` with Grid + DataTable + Card layout
- [ ] Create `invoice.theme.json` with commercial styling
- [ ] Create `invoice.mapping.json` for CSV export
- [ ] Create all test fixtures (empty, single, multi, max, null)
- [ ] Validate all JSON against schemas
- [ ] Run Python linter on definition
- [ ] Load in `<formspec-render>` and verify DataTable rendering
- [ ] Test add/remove line item lifecycle
- [ ] Test element-wise array operations across instances
- [ ] Test null propagation through calculate chain
- [ ] Test maxRepeat boundary (51st item → validation error)
- [ ] Test CSV mapping export with multiple line items
- [ ] Verify `structureVersion` increments on add/remove
- [ ] Test date constraint (dueDate ≥ invoiceDate)
