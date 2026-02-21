# Formspec v1.0 — Presentation Layer Proposal

## Approach B: Sidecar Theme Document

**Status:** Draft · **Author:** Design Team · **Date:** 2025

---

## 1. Philosophy

AD-02 says: *separate structure from behavior from presentation.* Approaches that embed rendering hints into the Definition violate this on a spectrum — even "optional" properties create gravity that pulls structure and presentation back together. Approach B enforces the separation physically: presentation lives in a different file, with a different schema, a different version number, and a different lifecycle.

This unlocks capabilities that hint-based approaches cannot match:

- **One Definition, many faces.** A government budget form ships with a multi-step web wizard for the public, a dense single-page layout for internal auditors, a PDF for print, and a high-contrast accessibility-enhanced variant — all without touching the Definition.
- **Division of labor.** Form authors own the Definition. Designers own the Theme. Neither blocks the other. A Theme can be developed, tested, and released independently.
- **Platform parity.** A mobile renderer ignores the web Theme entirely and loads its own. No `x-` prefix clutter accumulates on the Definition over time.
- **Testability.** A Theme document is statically analyzable: does every key it references exist in the target Definition? Does every widget it assigns match the field's `dataType`? These are schema-level checks.

The established pattern already exists: `mapping-spec.md` is a companion document with its own JSON Schema. A Theme is the same idea applied to presentation.

---

## 2. Theme Document Structure

```json
{
  "$schema": "https://formspec.org/schemas/theme/v1.schema.json",
  "url": "https://agency.gov/forms/budget-2025/themes/web-wizard",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://agency.gov/forms/budget-2025",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "platform": "web",
  "tokens": { },
  "defaults": { },
  "selectors": [ ],
  "items": { },
  "pages": [ ]
}
```

| Property | Purpose |
|---|---|
| `url` / `version` | Identity and semver of the Theme itself. |
| `targetDefinition` | Which Definition this Theme is designed for, plus a semver range for compatibility. |
| `platform` | Hint to renderers: `"web"`, `"mobile"`, `"pdf"`, `"kiosk"`, or `null` (universal). |
| `tokens` | Design token definitions (colors, typography, spacing). |
| `defaults` | Baseline presentation applied to every item unless overridden. |
| `selectors` | CSS-like rules that match items by type, dataType, or path pattern. |
| `items` | Keyed overrides for specific items — highest specificity. |
| `pages` | Layout structure: wizard steps, page breaks, grid arrangements. |

---

## 3. Selector / Binding Model

Themes bind presentation to Definition items through four mechanisms, listed in ascending specificity:

| Specificity | Selector | Example | Matches |
|---|---|---|---|
| 0 | `defaults` | *(top-level object)* | Every item |
| 1 | `type` selector | `{"match": {"type": "field"}}` | All fields |
| 2 | `dataType` selector | `{"match": {"dataType": "decimal"}}` | All decimal fields |
| 3 | Path pattern | `{"match": {"path": "expenses.*"}}` | All items under the `expenses` group |
| 4 | `items.{key}` | `"items": {"totalBudget": {…}}` | Exactly one item |

Selectors live in the `selectors` array and are evaluated in order. When multiple selectors match, properties merge with higher-specificity wins — identical to CSS cascading.

```json
"selectors": [
  {
    "match": { "dataType": "money" },
    "apply": {
      "widget": "currency-input",
      "widgetConfig": { "showSymbol": true, "locale": "en-US" }
    }
  },
  {
    "match": { "dataType": "choice", "path": "demographics.*" },
    "apply": {
      "widget": "radio-group",
      "widgetConfig": { "direction": "horizontal" }
    }
  }
]
```

Path patterns use dot-separated segments with `*` (single-level wildcard) and `**` (recursive wildcard). The `match` object fields are ANDed.

---

## 4. Widget Vocabulary

Every item resolves to a `widget` string plus a `widgetConfig` object. The Theme spec defines an enumerated vocabulary with per-widget config schemas:

| Widget | Valid dataTypes | Config properties |
|---|---|---|
| `text-input` | string, uri | `maxVisibleChars`, `inputMode` |
| `text-area` | text | `rows`, `autoResize`, `maxRows` |
| `number-input` | integer, decimal | `showStepper`, `locale` |
| `currency-input` | money | `showSymbol`, `locale` |
| `slider` | integer, decimal | `min`, `max`, `step`, `showTicks`, `showValue` |
| `checkbox` | boolean | `style` (`"toggle"` \| `"checkbox"`) |
| `date-picker` | date, dateTime, time | `format`, `minDate`, `maxDate`, `mode` |
| `dropdown` | choice | `searchable`, `placeholder` |
| `radio-group` | choice | `direction` (`"vertical"` \| `"horizontal"`), `columns` |
| `checkbox-group` | multiChoice | `direction`, `columns`, `maxVisible` |
| `combobox` | choice, multiChoice | `allowCustom`, `debounceMs` |
| `file-upload` | attachment | `accept`, `maxSizeMb`, `preview` |
| `signature-pad` | attachment | `penColor`, `height` |
| `rating` | integer | `max`, `icon` (`"star"` \| `"heart"`) |
| `hidden` | *(any)* | *(none)* |
| `read-only` | *(any)* | `format`, `emptyText` |

Renderers MUST implement `text-input`, `text-area`, `number-input`, `checkbox`, `date-picker`, `dropdown`, `checkbox-group`, and `file-upload` as the base set. All others are progressive — renderers that don't support `slider` fall back to `number-input` using a declared `fallback` chain:

```json
{ "widget": "slider", "widgetConfig": { "min": 0, "max": 100, "step": 5 }, "fallback": "number-input" }
```

---

## 5. Layout System

The Definition's item tree defines **logical order**. The Theme's `pages` array defines **visual order**.

```json
"pages": [
  {
    "id": "step-1",
    "title": "Project Details",
    "layout": "grid",
    "columns": 12,
    "responsive": {
      "sm": { "columns": 1 },
      "md": { "columns": 6 },
      "lg": { "columns": 12 }
    },
    "regions": [
      { "key": "projectName", "span": 8 },
      { "key": "projectCode", "span": 4 },
      { "key": "description", "span": 12 }
    ]
  },
  {
    "id": "step-2",
    "title": "Budget Lines",
    "regions": [
      { "key": "expenses", "span": 12 }
    ]
  }
]
```

Key rules:

- **Every Definition item must appear in exactly one region** (or in an implicit "overflow" page appended at the end). This prevents silent omission.
- **Regions reference items by `key`** — referencing a group key pulls in all its children.
- **The Definition tree is the fallback.** If no `pages` array exists, the renderer walks the item tree top-to-bottom in a single page.
- **Breakpoints** use t-shirt sizes: `xs` (<480px), `sm` (480–767), `md` (768–1023), `lg` (1024–1439), `xl` (≥1440). Columns collapse to stacked at the `sm` threshold by default.
- **PDF layout** uses `pages` with explicit `pageBreakBefore: true` instead of wizard semantics.

---

## 6. Design Tokens

Tokens are semantic names resolved to concrete values. They follow the [Design Tokens Community Group](https://design-tokens.github.io/community-group/) format:

```json
"tokens": {
  "color": {
    "surface": "#FFFFFF",
    "on-surface": "#1A1A1A",
    "primary": "#0057B7",
    "on-primary": "#FFFFFF",
    "error": "#D32F2F",
    "border": "#C4C4C4",
    "disabled": "#9E9E9E"
  },
  "typography": {
    "heading": { "family": "Inter", "weight": 600, "size": "1.25rem" },
    "body": { "family": "Inter", "weight": 400, "size": "1rem" },
    "label": { "family": "Inter", "weight": 500, "size": "0.875rem" },
    "hint": { "family": "Inter", "weight": 400, "size": "0.8125rem" }
  },
  "spacing": {
    "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "40px"
  },
  "border": {
    "radius": "6px",
    "width": "1px"
  },
  "elevation": {
    "none": "none",
    "low": "0 1px 3px rgba(0,0,0,0.12)",
    "medium": "0 4px 12px rgba(0,0,0,0.15)"
  }
}
```

Widget configs and layout properties can reference tokens via `{token.path}` syntax: `"color": "{color.primary}"`. Renderers resolve tokens before applying styles.

---

## 7. Theme Inheritance

Themes can extend a base:

```json
{
  "$schema": "https://formspec.org/schemas/theme/v1.schema.json",
  "url": "https://agency.gov/forms/budget-2025/themes/web-a11y",
  "version": "1.0.0",
  "extends": "https://agency.gov/forms/budget-2025/themes/web-wizard@1.0.0",
  "targetDefinition": {
    "url": "https://agency.gov/forms/budget-2025",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tokens": {
    "color": {
      "primary": "#000000",
      "on-primary": "#FFFF00"
    },
    "typography": {
      "body": { "size": "1.25rem" }
    }
  },
  "selectors": [
    {
      "match": { "type": "field" },
      "apply": { "widgetConfig": { "showLabel": true, "labelPosition": "above" } }
    }
  ]
}
```

Merge rules: `tokens` deep-merge (leaf wins). `items` merge per-key (child wins per-property). `selectors` from child append after parent's (higher priority due to later position). `pages` from child **replace** parent's entirely — layout is non-mergeable.

Platform variants are separate documents (web Theme, mobile Theme, PDF Theme) rather than conditional blocks inside one document. This keeps each Theme simple and independently validatable.

---

## 8. Lifecycle

**Versioning.** Themes use semver independently from the Definition. A Theme declares `targetDefinition.compatibleVersions` as a semver range.

**Compatibility contract:**
- Definition adds a new item → Theme is still valid (new item renders with `defaults`). Non-breaking.
- Definition removes an item → Theme has a dangling key reference. Renderers SHOULD warn, MUST NOT crash. Minor breakage.
- Definition changes a field's `dataType` → Theme's widget may become invalid (slider on a boolean). Renderers validate widget/dataType compatibility and fall back. Major breakage.

**Tooling hooks:**
- `formspec theme validate --theme web.theme.json --definition budget.json` checks all key references resolve, all widget/dataType pairs are legal, and the semver range is satisfied.
- CI pipelines run this on every Definition change to detect Theme breakage.

---

## 9. Limitations

**Honest costs:**

| Concern | Reality |
|---|---|
| **More files to manage** | Every Definition now needs at least one Theme for non-trivial rendering. Minimal forms carry overhead. |
| **Key synchronization** | Adding a field to the Definition means updating every Theme's `pages` layout (or accepting overflow placement). Tooling mitigates but doesn't eliminate this. |
| **No inline preview** | Reading a Definition alone tells you nothing about how it looks. You need both files open. |
| **Widget/dataType coupling** | The widget vocabulary implicitly depends on Layer 1 dataTypes. Changing a dataType can silently invalidate a Theme. |
| **Cascade complexity** | Four specificity levels plus inheritance means debugging "why does this field look like that" requires tracing through defaults → type selectors → dataType selectors → path selectors → key overrides → parent theme. |
| **Adoption friction** | Form authors who just want a hint on one field must create an entire sidecar document. The spec should ship sensible renderer defaults so that the zero-Theme experience is acceptable. |

Mitigation: the spec mandates that renderers MUST produce reasonable output from a Definition alone (using dataType-to-default-widget mapping). Themes are an enhancement, never a requirement.

---

## 10. Full JSON Example

A Theme for a budget form: web wizard with three steps, plus PDF annotation.

```json
{
  "$schema": "https://formspec.org/schemas/theme/v1.schema.json",
  "url": "https://agency.gov/forms/budget-2025/themes/web-wizard",
  "version": "1.2.0",
  "targetDefinition": {
    "url": "https://agency.gov/forms/budget-2025",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "platform": "web",
  "tokens": {
    "color": {
      "surface": "#FFFFFF",
      "on-surface": "#1C1C1C",
      "primary": "#0057B7",
      "on-primary": "#FFFFFF",
      "error": "#C62828",
      "border": "#BDBDBD",
      "disabled": "#9E9E9E"
    },
    "typography": {
      "heading": { "family": "Inter", "weight": 600, "size": "1.5rem" },
      "body": { "family": "Inter", "weight": 400, "size": "1rem" },
      "label": { "family": "Inter", "weight": 500, "size": "0.875rem" }
    },
    "spacing": {
      "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "40px"
    },
    "border": { "radius": "8px", "width": "1px" },
    "elevation": { "card": "0 2px 8px rgba(0,0,0,0.1)" }
  },
  "defaults": {
    "labelPosition": "above",
    "showHint": true,
    "showDescription": false,
    "errorDisplay": "inline"
  },
  "selectors": [
    {
      "match": { "dataType": "money" },
      "apply": {
        "widget": "currency-input",
        "widgetConfig": { "showSymbol": true, "locale": "en-US" }
      }
    },
    {
      "match": { "dataType": "choice" },
      "apply": { "widget": "dropdown", "widgetConfig": { "searchable": false } }
    },
    {
      "match": { "dataType": "boolean" },
      "apply": { "widget": "checkbox", "widgetConfig": { "style": "toggle" } }
    },
    {
      "match": { "dataType": "date" },
      "apply": { "widget": "date-picker", "widgetConfig": { "format": "MM/DD/YYYY" } }
    },
    {
      "match": { "type": "display" },
      "apply": { "widget": "read-only", "widgetConfig": { "format": "markdown" } }
    },
    {
      "match": { "path": "expenses.*" },
      "apply": { "widgetConfig": { "compact": true } }
    }
  ],
  "items": {
    "totalBudget": {
      "widget": "currency-input",
      "widgetConfig": {
        "showSymbol": true,
        "locale": "en-US",
        "highlight": true
      },
      "style": {
        "typography": "{typography.heading}",
        "background": "#F0F6FF",
        "border": { "color": "{color.primary}", "width": "2px" },
        "elevation": "{elevation.card}"
      }
    },
    "approverSignature": {
      "widget": "signature-pad",
      "widgetConfig": { "penColor": "#000", "height": 150 },
      "fallback": "file-upload"
    },
    "priorityLevel": {
      "widget": "slider",
      "widgetConfig": { "min": 1, "max": 5, "step": 1, "showTicks": true, "showValue": true },
      "fallback": "dropdown"
    },
    "department": {
      "widget": "combobox",
      "widgetConfig": { "allowCustom": false, "debounceMs": 200, "searchable": true },
      "fallback": "dropdown"
    }
  },
  "pages": [
    {
      "id": "step-1",
      "title": "Project Information",
      "description": "Tell us about the project requesting funds.",
      "layout": "grid",
      "columns": 12,
      "responsive": {
        "sm": { "columns": 1 },
        "md": { "columns": 6 },
        "lg": { "columns": 12 }
      },
      "regions": [
        { "key": "projectName", "span": 8 },
        { "key": "projectCode", "span": 4 },
        { "key": "department", "span": 6 },
        { "key": "fiscalYear", "span": 6 },
        { "key": "description", "span": 12 },
        { "key": "priorityLevel", "span": 12 }
      ]
    },
    {
      "id": "step-2",
      "title": "Budget Details",
      "description": "Enter line items and the total.",
      "layout": "grid",
      "columns": 12,
      "regions": [
        { "key": "expenses", "span": 12 },
        { "key": "totalBudget", "span": 6 },
        { "key": "contingency", "span": 6 }
      ]
    },
    {
      "id": "step-3",
      "title": "Review & Submit",
      "description": "Review your submission and sign.",
      "layout": "grid",
      "columns": 12,
      "regions": [
        { "key": "summaryNote", "span": 12 },
        { "key": "certify", "span": 12 },
        { "key": "approverSignature", "span": 12 },
        { "key": "submissionDate", "span": 6 }
      ]
    }
  ]
}
```

A companion PDF Theme for the same Definition would be a separate document with `"platform": "pdf"`, no wizard pages, `pageBreakBefore` hints, and print-appropriate tokens (no elevation, serif fonts, higher-contrast borders). Both reference the same `targetDefinition.url` — the renderer picks the right one.

---

*End of proposal.*
