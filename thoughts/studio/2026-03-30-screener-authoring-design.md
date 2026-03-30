# Screener Authoring Design

**Date:** 2026-03-30
**Status:** Draft
**Related:** ADR 0055 (Editor workspace consolidation), Core spec SS4.7

## Problem

The screener is a pre-qualification gate that collects a few screening questions and routes respondents to different form destinations. The current ScreenerSection component has an enable/disable toggle, a static field list, a static route list, and bare-bones add buttons. There is no way to:

- Configure screening questions (label, type, options, required)
- Compose route conditions without writing raw FEL
- Verify routing logic before publishing
- Understand what the screener does at a glance

The primary audience is non-technical form managers who think "if the applicant is under 18, send them to the minor's form" — not "add a route with condition `$age < 18` targeting `urn:minors-form`."

## Spec Constraints

From Core spec SS4.7 and `definition.schema.json`:

| Property | Required | Notes |
|----------|----------|-------|
| `items` | Yes | Standard Item schema (field, group, display). Values available to route conditions. |
| `routes` | Yes | `minItems: 1`. Ordered, first-match-wins. |
| `binds` | No | Scoped to screener items only. Supports required, relevant, constraint, calculate. |
| `extensions` | No | `^x-` prefixed properties. |

**No `enabled` property.** `additionalProperties: false`. The screener exists (object present on definition) or doesn't (property absent). The current `setScreener(true)` handler correctly creates `{ items: [], routes: [] }` and `setScreener(false)` deletes the object.

**Screener data is ephemeral.** Items are NOT part of the form's instance data — they exist only for routing. The UI must communicate this.

**Route targets are opaque URIs.** `format: "uri"`, pointing to another FormDefinition. No resolution protocol defined. The web component classifies targets as internal (matches `definition.url`) or external.

**Route `target` not `destination`.** The schema property is `target`. The current ScreenerSection interface uses `destination` — this is a display-side bug.

## Evidence from Examples

Only 2 of 7 examples use screeners. Both are small, focused, and follow consistent patterns.

### Grant Application (`examples/grant-application/definition.json`)
- **3 questions:** applicantType (choice/4 options), isReturning (boolean), requestedAmount (money)
- **2 binds:** both `required: "true"` (applicantType, requestedAmount)
- **4 routes:** for-profit (equality) → renewal-short (AND + `moneyAmount()` function) → renewal (boolean) → catch-all
- Route extensions: `x-route-category: "restricted"` on for-profit route

### Clinical Intake (`examples/clinical-intake/intake.definition.json`)
- **2 questions:** sChiefComplaint (choice/4 options), sPainLevel (integer)
- **2 binds:** required (sChiefComplaint), constraint range check `$ >= 0 and $ <= 10` (sPainLevel)
- **3 routes:** emergency (OR: complaint = emergency OR pain >= 8) → urgent (AND: acute AND pain >= 5) → catch-all
- Naming convention: "s" prefix for screener-scoped fields

### Patterns

These examples are directional, not prescriptive — real screeners will vary.

| Observation | Design implication |
|---|---|
| **2-3 questions** | Screeners tend to be small, but the UI shouldn't limit scale |
| **Types: choice, boolean, integer, money** | Common screening types — offer all standard types equally |
| **Binds: required + constraint** | Required checkbox on question card; constraint via disclosure |
| **Routes: most-specific-first** | Numbered stack with "first match wins" info bar |
| **Conditions: flat AND/OR, equality, comparison** | Condition builder handles the common patterns; Advanced toggle for everything else |
| **Function calls: `moneyAmount()`** | Advanced toggle escape hatch is justified |

## Design

### Location

The screener lives in the **ManageView** of the Editor workspace (per ADR 0055). The Blueprint sidebar shows a read-only summary. Clicking "Screener" in the Blueprint auto-switches to Manage and scrolls to the screener pillar.

### Two Rendering Contexts

**Blueprint sidebar** — read-only summary:
```
Screener                              2   <- route count badge
  Active  |  3 questions, 2 routes        <- summary line
```

No CRUD. Summary only. Clicking navigates to ManageView.

**ManageView pillar** — full authoring surface (below).

### ManageView Structure

```
+================================================================+
|  [amber bar]  Screener & Routing                               |
|               Pre-qualification gate                           |
+----------------------------------------------------------------+
|                                                                |
|  [Active / Not configured]    <- presence toggle               |
|  "Respondents answer these questions before the main form.     |
|   Answers are used for routing only and are not saved."         |
|                                                                |
|  ---- SCREENING QUESTIONS ---------- [+ Add Question] -------- |
|                                                                |
|  (question cards with inline editing)                          |
|                                                                |
|  ---- ROUTING RULES ---------------  [+ Add Rule] ----------- |
|                                                                |
|  (numbered route cards, ordered, drag-sortable)                |
|                                                                |
|  ---- DEFAULT ROUTE ------------------------------------------ |
|                                                                |
|  (fallback card, pinned at bottom, visually distinct)          |
|                                                                |
|  ---- Test Routing (collapsible) ----------------------------- |
|                                                                |
|  (interactive routing verifier)                                |
|                                                                |
+================================================================+
```

### Presence Toggle

Not "enable/disable" — the screener exists or doesn't. The toggle creates/removes the screener object.

- **Not configured**: shows a dashed empty state with "Set up screening" button
- **Active**: shows the full authoring surface

When removing an active screener, confirm: "This will remove all screening questions and routing rules."

### Screening Questions

Each question is an expand/collapse card following the existing OptionSets/DataSources pattern.

**Adding a question** — `+ Add Question` opens an inline creation form:

```
+------------------------------------------------------------+
|  Question type:  [ Yes/No  v ]                             |
|  Label:          [ Are you 18 or older?         ]          |
|  Key:            screen_are_you_18  (auto-generated)       |
|                                                            |
|                              [Cancel]  [Add]               |
+------------------------------------------------------------+
```

Available types (plain English labels):

| Display | dataType | Notes |
|---------|----------|-------|
| Yes / No | boolean | Eligibility gates |
| Choose One | choice | Categorical routing. Shows inline option editor. |
| Number | integer | Numeric thresholds |
| Dollar Amount | money | Financial thresholds. Enables `moneyAmount()` in conditions. |
| Short Text | string | Free text (zip code, ID) |
| Date | date | Date-based routing |

Key auto-generates from label via `sanitizeIdentifier` with `screen_` prefix.

**Collapsed card:**
```
+------------------------------------------------------------+
|  [bool icon]  Are you 18 or older?               [delete]  |
|  screen_age  |  Yes/No  |  Required                        |
+------------------------------------------------------------+
```

**Expanded card** — inline editing:
```
+------------------------------------------------------------+
|  [bool icon]  Are you 18 or older?               [delete]  |
+------------------------------------------------------------+
|  Label:      [ Are you 18 or older?         ]              |
|  Help text:  [ We need to verify age for... ]              |
|  Required:   [x]                                           |
|  (For choice: inline options table)                        |
+------------------------------------------------------------+
```

The "Required" checkbox dispatches a screener-scoped bind (`definition.setScreenerBind`). Constraint/relevance expressions are available via an "Advanced" disclosure — most screener questions don't need them.

**Reordering**: drag handles on left edge. Questions appear sequentially to the respondent.

### Route Authoring

Routes are presented as an ordered numbered stack. The visual metaphor is a decision list read top to bottom.

**Collapsed route card:**
```
+------------------------------------------------------------+
| 1  IF  Age is at least 18 and Income less than 50k         |
|        -> https://grants.gov/forms/sf-425-short             |
|        "You qualify for the standard grant."       [grab]   |
+------------------------------------------------------------+
| 2  IF  Age is at least 18                                  |
|        -> https://grants.gov/forms/sf-425                   |
|                                                    [grab]   |
+------------------------------------------------------------+
|  ========= FALLBACK (always matches) ==================== |
| *  Everyone else                                           |
|        -> https://grants.gov/forms/ineligible              |
|        "Unfortunately you don't qualify."                  |
+------------------------------------------------------------+
```

- Route numbers in circle badges reinforce order
- "IF" keyword in amber, condition in plain English
- Arrow + target URI on second line
- Optional message in muted italic on third line
- Grab handle for drag reorder (not on fallback)
- Fallback is visually distinct (`bg-amber/5 border-amber/20`), pinned at bottom, cannot be deleted

**Info line above routes:**
```
(i) Routes are checked in order. The first matching rule wins.
```

### Condition Builder

The key UX innovation. Instead of raw FEL, the user builds conditions visually:

```
+------------------------------------------------------------+
|  WHEN  [All v]  of these are true:                         |
|                                                            |
|  [ Are you 18+? v ] [ is Yes       v ] [            ]  [x]|
|  [ Income?      v ] [ is less than v ] [ 50000      ]  [x]|
|                                                            |
|  [+ Add condition]                                         |
|                                                            |
|  FEL: $screen_age = true and $screen_income < 50000       |
|                                               [Advanced]   |
+------------------------------------------------------------+
```

**Each row:** `[ field ] [ operator ] [ value ] [remove]`

**Field dropdown** lists screener items with labels: "Are you 18 or older? (screen_age)"

**Operator dropdown** adapts to field type:

| dataType | Operators |
|----------|-----------|
| choice | equals, does not equal |
| boolean | is Yes, is No |
| integer | equals, is at least, is at most, is greater than, is less than |
| money | amount equals, amount is at least, amount is at most, amount is less than |
| string | equals, does not equal, contains, starts with |
| date | is before, is after, is on or after, is on or before |

Money operators use `moneyAmount()` wrapper in FEL (e.g. "amount is less than 250000" → `moneyAmount($field) < 250000`). This matches the grant-application example pattern.

**Value input** adapts: nothing for boolean (operator is sufficient), text for string/integer, option dropdown for choice, date picker for date.

**Group logic:** "All" (and) vs "Any" (or) toggle at top.

**FEL preview:** generated expression shown in `code` styling below the builder. Teaches FEL through exposure.

**Advanced toggle:** swaps builder for raw FEL editor (`InlineExpression`). Switching back attempts to parse FEL into builder rows; if it can't (nested logic, function calls), stays in advanced mode with a note.

**Operator-to-FEL mapping:**

| Display | FEL | Example from examples |
|---------|-----|----------------------|
| equals | `$field = value` | `$applicantType = 'forprofit'` |
| does not equal | `$field != value` | — |
| is Yes | `$field = true` | `$isReturning = true` |
| is No | `$field = false` | — |
| is at least | `$field >= value` | `$sPainLevel >= 8` |
| is at most | `$field <= value` | — |
| is greater than | `$field > value` | — |
| is less than | `$field < value` | `$sPainLevel < 5` (implied) |
| amount is less than | `moneyAmount($field) < value` | `moneyAmount($requestedAmount) < 250000` |
| amount is at least | `moneyAmount($field) >= value` | — |
| contains | `contains($field, 'v')` | — |
| starts with | `starts-with($field, 'v')` | — |

### Default Fallback Route

- Always last, `condition: "true"`
- Visual label: "Everyone else" (not "true")
- Cannot be deleted or reordered
- Warm background (`bg-amber/5`) distinguishes it
- User can edit target and message only
- Auto-created when adding the first route (alongside the conditional route)

### Adding a Route

`+ Add Rule` inserts a new route above the fallback, expanded for immediate editing. If no routes exist, creates both a conditional route AND a fallback.

Cannot delete the last route (schema `minItems: 1`). The "delete" button is hidden or disabled on the last remaining route.

### Route Target Input

Free-text URI field with:
- Autocomplete from other route targets in this screener
- "Routes to this form" shortcut (auto-fills `definition.url`)
- `label` field prominently displayed — form managers name routes, the URI is secondary

### Test Routing Panel

A `CollapsibleSection` at the bottom. Interactive routing verifier.

```
+------------------------------------------------------------+
|  [v] Test Routing                                          |
+------------------------------------------------------------+
|                                                            |
|  Answer the screening questions to see which route         |
|  would match:                                              |
|                                                            |
|  Are you 18 or older?       [Yes] [No]                     |
|  Annual household income?   [ 45000        ]               |
|                                                            |
|  ---- Result ----                                          |
|                                                            |
|  Route 1 matched: "Standard Grant Applicants"              |
|  -> https://grants.gov/forms/sf-425-short                  |
|  "You qualify for the standard grant."                     |
|                                                            |
+------------------------------------------------------------+
```

Renders a minimal input per screener field (matching its type). On each value change, evaluates route conditions in order using `engine.evaluateScreener()` and highlights the matched route. If no match (no fallback), shows a warning.

## Component Hierarchy

```
ScreenerAuthoring (ManageView full surface)
  ScreenerToggle (create/remove screener)
  ScreenerQuestions
    EmptyState
    AddQuestionForm (inline)
    QuestionCard[] (expand/collapse, drag-sortable)
      QuestionEditor (label, help, required, options)
  ScreenerRoutes
    RouteInfoBar (first-match-wins help tip)
    RouteCard[] (expand/collapse, drag-sortable)
      RouteHeader (number, condition preview, target, message)
      RouteEditor
        ConditionBuilder
          GroupLogicToggle (all/any)
          ConditionRow[] (field, operator, value)
          FELPreview
          AdvancedToggle -> InlineExpression
        TargetInput
        LabelInput
        MessageInput
    FallbackRoute (pinned, distinct)
  RoutingTestPanel (CollapsibleSection)

ScreenerBlueprintSummary (sidebar read-only)
```

## Implementation Priority

1. **ScreenerQuestions + QuestionCard + AddQuestionForm** — question CRUD, follows existing card patterns
2. **ScreenerRoutes + RouteCard** with raw FEL input (InlineExpression) — route CRUD, ordering, fallback pinning
3. **ConditionBuilder + ConditionRow + operator mapping** — visual builder layered on raw FEL foundation
4. **RoutingTestPanel** — interactive verifier
5. **ScreenerBlueprintSummary** — read-only extraction

Steps 1-2 give a fully functional screener authoring experience (with raw FEL). Step 3 makes it accessible to non-technical users. Steps 4-5 are polish.

## Spec Compliance Fixes Required

Before implementing the new design:

1. Remove `enabled` from ScreenerSection interface (not in schema)
2. Fix Route interface: `destination` -> `target`
3. The `isEnabled` check should be `Boolean(definition.screener)` only
4. Add ephemeral data notice to the UI

## Accessibility

- Route list: `role="list"` with `aria-label="Routing rules, evaluated in order"`
- Condition builder rows: `role="group"` with `aria-label="Condition 1"`
- Drag reorder: `aria-roledescription="sortable"`, live region announcements on position change
- Test result: `aria-live="polite"` on result region
- Focus management: new card creation focuses first input; deletion focuses previous card
