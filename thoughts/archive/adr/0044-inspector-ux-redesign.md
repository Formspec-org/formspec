# ADR 0044: Inspector Panel UX Redesign

**Status:** Implemented (Phase 1-5 core; Phase 6 partial)
**Date:** 2026-03-05
**Implemented:** 2026-03-09
**Context:** The inspector panel's information architecture mirrors the spec's data model (items + binds + theme + component) rather than the user's mental model (question + answer type + rules + appearance). This redesign targets non-technical users — people who currently use Google Forms or Notion and want more power without more complexity.

---

## Guiding Principles

1. **Answer-type-first** — "What kind of question is this?" is the primary design decision and should be the loudest control.
2. **Zero jargon** — No user-facing use of "widget", "bind", "FEL", "relevant", "constraint", "presentation", "component node". Use plain language.
3. **Three-tier progressive disclosure** — Simple (Google Forms level), Standard (conditional logic + validation), Advanced (raw expressions, CSS, ARIA, spec-level controls).
4. **Visual feedback loop** — Configuration changes should be visible on the form surface, not just inside the inspector.
5. **Self-explaining UI** — One-line inline hints on any control that isn't immediately obvious.

---

## Phase 1: Field Inspector Restructure

### 1.1 Answer Type Picker at Top

**Current:** Widget selection is a `<select>` labeled "Widget override" inside the collapsed "Appearance" section (4th section down).

**Target:** A prominent visual control at the very top of the inspector, above all sections. Always visible, never collapsible.

- Label it "Answer type" (not "Widget override")
- Show as a segmented control or icon strip for common types: Short text, Long text, Number, Choice, Multi-select, Date, Toggle, File upload
- "More types..." expands the full list (Rating, Slider, Signature, Money, etc.)
- Changing answer type should update the data model (`dataType` + component) in a single action
- Remove the widget dropdown from AppearanceSection (it moves here)

### 1.2 Rename and Restructure "Basics" → "Question"

**Current Basics section contents:**
- Key, Label, Description, Hint, Placeholder, Prefix, Suffix, Option set, Required

**Target "Question" section:**
- **Label** → rename to "Question text"
- **Hint** → rename to "Help text" (this is what the respondent sees)
- **Placeholder** → keep, but only show for text/number answer types
- **Options** → for choice types, inline option editor (currently separate)
- Move everything else out:
  - **Key** → hide in Simple mode (auto-derive from label); show in Advanced mode only
  - **Description** → move to Advanced (this is spec-level metadata, not user-facing)
  - **Prefix / Suffix** → move to Advanced (or into answer-type-specific settings)
  - **Option set dropdown** → keep for choice types, but rename "Use shared option set" (not "Option set (reusable)")
  - **Required** → move to Rules section (see 1.3)

### 1.3 Combine Behavioral Controls into "Rules"

**Current:** Required toggle is in Basics. Show/hide, Required-when, Calculate, Readonly are in Logic. Constraint + message are in Validation. These are three separate sections for "rules about this field."

**Target: Single "Rules" section** with visual sub-groups:

```
▾ RULES
  ☑ Required                              ← simple toggle, promoted

  Show when...                            ← visual builder (simple mode)
  [Field X] [equals] [Value Y]              or FEL editor (advanced mode)
  Otherwise: Hidden

  Validation                              ← visual builder (simple mode)
  Answer must [be at least] [5]              or constraint expression (advanced)
  Error: "Must be at least 5 characters"

  ▸ More rules                            ← collapsed sub-group
    Required when...
    Calculate...
    Readonly when...
```

- In Simple mode: show Required toggle, Show when (visual builder only), Validation (visual builder only)
- In Standard mode: also show Calculate and Required-when
- In Advanced mode: show raw FEL editors alongside visual builders, plus Readonly-when

### 1.4 Merge Appearance + Presentation → "Layout & Style"

**Current:** Two sections that both affect visuals:
- AppearanceSection → writes to `theme.items[key]` (CSS class, label position, style, widget config, a11y, responsive)
- PresentationSection → writes to `item.presentation` (flow, grid, colSpan, styleHints, a11y)

**Problem:** "Appearance" and "Presentation" are near-synonyms. Both set accessibility. Users don't know or care about the spec-tier distinction.

**Target: Single "Layout & Style" section** with sub-headings:

```
▾ LAYOUT & STYLE
  Label position: [Above ▾]

  ▸ Sizing (responsive)                  ← collapsed
    Breakpoint: [Desktop ▾]
    Column span: [6]
    ...

  ▸ Custom styling                        ← collapsed, advanced only
    CSS class: [___]
    Style overrides: [key-value editor]

  ▸ Accessibility                         ← collapsed, advanced only
    ARIA role, description, live region
```

- Internally, still write to the correct backing store (theme vs definition) based on which property is being set
- Remove "Widget config" and "Fallback widgets" from simple mode
- Remove "Display when (visual only)" — merge its UX into the Rules section with a clear note: "This only hides the visual — the field still collects data"

### 1.5 Answer-Type-Specific Settings (replaces WidgetPropsSection)

**Current:** WidgetPropsSection is an Advanced-mode-only section that shows widget-specific controls (e.g., DatePicker format, Slider min/max, Rating icon).

**Target:** These settings should appear contextually based on the answer type selected in 1.1, not in a separate section.

- When the user picks "Rating" as answer type, show max stars, icon, allow half — inline below the answer type picker or in a dedicated "Rating settings" sub-group
- When the user picks "Slider", show min, max, step, show value — same pattern
- Label these with the answer type name: "Rating options", "Slider options", "Date options"
- In Simple mode, show only the most common settings per type
- In Advanced mode, show all settings

### 1.6 Rethink AdvancedSection

**Current:** A catch-all with 15+ unrelated controls: default value, initial value, whitespace handling, excluded value, non-relevant behavior, disabled display, precision, remote options, semantic type, currency, 4 label variants, pre-populate.

**Target:** Break into meaningful sub-groups within the Advanced tier:

- **Default value** → move to the Question section (it's conceptually "what's pre-filled")
- **Initial value** → keep in Advanced
- **Data handling** (whitespace, excluded value, precision, non-relevant behavior) → group under "Data handling" in Advanced
- **Remote options** → group with Option set in the Question section
- **Alternative labels** (short, PDF, CSV, accessibility) → group under "Export labels" in Advanced
- **Pre-populate from instance** → group under "Data sources" in Advanced
- **Currency, semantic type** → fold into answer-type-specific settings (Money answer type shows currency; semantic type auto-derives from answer type)
- **Disabled display** → move to Layout & Style

### 1.7 Sub-Questions Section

**Current:** Always shown at the bottom. Good concept, reasonable placement.

**Target:** Keep as-is but rename to "Follow-up questions" for non-technical users. Add inline hint: "Add questions that appear nested under this one."

---

## Phase 2: Form Inspector Restructure

### 2.1 Prominent Form Identity

**Current:** FormInspector starts with a "Metadata" collapsible containing 10 inputs (title, name, description, URL, version, date, status, version algorithm, when-hidden default, derived from).

**Target:** The form title should be large and prominent at the top — like Notion's page title. Not inside a collapsible.

```
[Form Title — large, editable, prominent]
[Description — subtle textarea below]
Status: [Draft ▾]

▸ Form Settings
▸ Choices & Data
▸ Look & Feel
▸ Import / Export
▸ Developer Tools
```

Only Title, Description, and Status are always visible. Everything else is in grouped collapsibles.

### 2.2 Group the 12 Sections into 4-5 Categories

**Current:** 12 flat, ungrouped sections.

**Target grouping:**

| Category | Contains | Target Users |
|---|---|---|
| **Form Settings** | Name, URL, Version, Date, Version algorithm, When-hidden default, Derived from | Standard/Advanced |
| **Choices & Data** | Option Sets, Variables, Secondary Data Sources | Standard |
| **Rules** | Form Rules (shapes) | Standard |
| **Look & Feel** | Brand/Theme panel | Standard |
| **Developer Tools** | Component Document, Extensions, Mapping, Sub-forms, Versioning, Import/Export | Advanced |

In Simple mode, only "Look & Feel" and "Choices & Data" (renamed to "Answer choices") are visible. Everything else is hidden or collapsed under "More settings..."

---

## Phase 3: Three-Tier Mode System

### 3.1 Replace Simple/Advanced Toggle with Three Tiers

**Current:** Binary Simple/Advanced toggle. Advanced shows 3 extra sections. Simple mode still exposes developer concepts (Key, CSS class, FEL editors, ARIA, etc.).

**Target:** Three tiers, selectable from a dropdown or segmented control:

| Tier | Label | What's Visible | Target User |
|---|---|---|---|
| 1 | **Simple** | Question text, Help text, Answer type, Required, Options, Show when (visual), Validation (visual) | Google Forms user |
| 2 | **Standard** | Everything in Simple + Calculate, Required-when, Default value, Label position, Responsive sizing, Option sets, Variables, Form rules | Power user / Notion user |
| 3 | **Advanced** | Everything + Key, Description, Raw FEL, CSS class, Style overrides, ARIA, Widget config, Fallback, Component doc, Extensions, Mapping, all AdvancedSection fields | Developer |

The tier is a global setting (not per-field). Persist in localStorage.

### 3.2 Tier-Aware Section Rendering

Each section and control gets a `tier` annotation:

```
tier 1: label, helpText, placeholder, answerType, required, options,
        showWhen (visual only), validation (visual only)
tier 2: calculate, requiredWhen, defaultValue, labelPosition,
        responsiveSizing, readonlyWhen
tier 3: key, description, prefix, suffix, cssClass, style, ariaRole,
        widgetConfig, fallback, whitespace, excludedValue,
        nonRelevantBehavior, disabledDisplay, precision, remoteOptions,
        semanticType, currency, altLabels, prePopulate, componentWhen
```

Sections only render controls at or below the active tier. Empty sections are hidden entirely.

---

## Phase 4: Visual Feedback on Form Surface

### 4.1 Field State Indicators

**Current:** No visual indication on the form surface when a field has logic, validation, or conditional visibility.

**Target:** Small, non-intrusive indicator icons on field blocks:

- ⚡ or similar — has logic (show when, calculate, required when, readonly when)
- ✱ — required
- ✓ — has validation rules
- 👁 with slash — conditionally visible (has "show when" condition)

These appear as a small icon row in the corner of each field block. Clicking an indicator opens the relevant section in the inspector.

### 4.2 Section Summary Badges Enhancement

**Current:** Summary badges like "? Show when · = Calculate" appear when sections are collapsed.

**Target:** Keep these but make them more descriptive in Simple/Standard mode:
- Instead of "? Show when" → "Shows when Country = US"
- Instead of "= Calculate" → "Calculates: sum of items"
- Instead of "Configured" → specific count or preview: "3 rules", "Required + 1 condition"

---

## Phase 5: Contextual Help System

### 5.1 Inline Hints

Add one-line descriptions to sections and complex controls. These should be:
- Visible by default on first use, dismissable after
- Always visible in Simple mode
- Collapsible/hidden in Advanced mode (experienced users don't need them)

Examples:

| Control | Hint |
|---|---|
| Show when | "Only display this question when a condition is met" |
| Required when | "Make this required based on another answer" |
| Calculate | "Auto-fill this answer with a formula" |
| Validation | "Set rules the answer must follow" |
| Readonly when | "Lock this field based on a condition" |
| Default value | "Pre-fill this field when the form loads" |
| Label position | "Where the question label appears relative to the input" |
| Options (choice) | "The choices the respondent can pick from" |
| Help text | "Shown below the question to guide the respondent" |

### 5.2 Empty State Guidance

When a section has no configuration, show a brief prompt instead of empty space:

- Rules section (empty): "No rules yet. Add a condition or validation rule."
- Follow-up questions (empty): "No follow-ups. Use these for dependent questions that appear below this one."
- Layout & Style (empty): "Using default layout. Customize sizing, positioning, or styling."

---

## Phase 6: Vocabulary Rename Map

Global find-and-replace across all user-facing strings:

| Spec Term | User-Facing Term |
|---|---|
| Widget / Widget override | Answer type |
| Key | Field ID (Advanced only) |
| Hint | Help text |
| Description (on items) | Internal notes (Advanced only) |
| Relevant / Show when | Show this question when |
| Constraint | Validation rule |
| constraintMessage | Error message |
| Calculate | Auto-calculate |
| Readonly when | Lock when |
| Bind | *(never exposed)* |
| FEL expression | Formula |
| Presentation | Layout |
| Component when (visual only) | *(merge into Show when with data-behavior note)* |
| Option set (reusable) | Shared answer choices |
| Non-relevant behavior | When hidden, answer is... |
| Excluded value | Treat as empty when... |
| Whitespace | Text trimming |
| Fallback widgets | Fallback answer types |
| Widget config | Answer type settings |
| Style overrides | Custom CSS |
| Secondary data sources | Lookup data |
| Form rules (shapes) | Form-wide rules |

---

## Implementation Order

| Step | Phase | Effort | Impact |
|---|---|---|---|
| 1 | 1.1 — Answer type picker at top | Medium | Highest — fixes the #1 workflow issue |
| 2 | 6 — Vocabulary renames | Low | High — immediate usability improvement |
| 3 | 1.2 — Restructure Basics → Question | Medium | High — simplifies the most-used section |
| 4 | 1.3 — Merge Logic + Validation → Rules | Medium | High — matches user mental model |
| 5 | 3.1 — Three-tier mode system | Medium | High — makes Simple mode actually simple |
| 6 | 1.4 — Merge Appearance + Presentation | Medium | Medium — eliminates a confusing split |
| 7 | 5.1 — Inline hints | Low | Medium — self-explaining UI |
| 8 | 2.1-2.2 — Form inspector restructure | Medium | Medium — fixes the control-room problem |
| 9 | 4.1 — Surface indicators | Medium | Medium — visual feedback loop |
| 10 | 1.5 — Answer-type-specific settings | Medium | Medium — contextual widget config |
| 11 | 1.6 — AdvancedSection breakup | Low | Low — mostly organizational |
| 12 | 4.2 — Better summary badges | Low | Low — polish |
| 13 | 5.2 — Empty state guidance | Low | Low — polish |
| 14 | 1.7 — Rename sub-questions | Low | Low — polish |

---

## Non-Goals

- **Removing spec power** — All Formspec capabilities remain accessible in Advanced mode. Nothing is deleted, only reorganized.
- **Changing the data model** — The backing stores (definition items, binds, theme, component document) remain unchanged. This is purely a UI restructure.
- **Mobile responsiveness of the builder itself** — The form builder is a desktop tool. Responsive design applies to the *forms it produces*, not the builder UI.

---

## Success Criteria

A marketing coordinator with no development experience should be able to:

1. Create a form with 5 fields (text, email, choice, date, toggle) in under 2 minutes
2. Make a field conditionally visible without ever seeing a code editor
3. Add a validation rule ("email must contain @") without writing an expression
4. Understand what every visible control does without external documentation
5. Never encounter the word "widget", "bind", "FEL", or "presentation"

---

## Implementation Notes

### What was implemented

| Step | Status | Notes |
|---|---|---|
| 1.1 — Answer type picker | **Done** | `AnswerTypePicker.tsx` — 18 types, primary strip + "More types..." expansion. `setFieldAnswerType` mutation updates `dataType` + `component` atomically. |
| 1.2 — Basics → Question | **Done** | `QuestionSection.tsx` — Key/Description/Prefix/Suffix hidden below Advanced tier. Default value at Standard+. "Question text", "Help text", "Shared answer choices" labels. |
| 1.3 — Logic + Validation → Rules | **Done** | `RulesSection.tsx` — Required toggle + Show when + Validation always visible. Calculate/Required-when at Standard+. Lock when at Advanced. Uses ExpressionToggle for all. |
| 1.4 — Appearance + Presentation → Layout & Style | **Done** | `LayoutStyleSection.tsx` — Label position + responsive at Standard+. CSS/a11y/widget-config/fallback at Advanced. Writes to correct backing store. |
| 1.5 — Answer-type-specific settings | **Partial** | WidgetPropsSection still shown as a separate collapsible (now visible for any field with widget props, not just Advanced). Not yet inlined below the picker. |
| 1.6 — AdvancedSection breakup | **Done** | `DataHandlingSection.tsx` — Advanced-only section with initial value, text trimming, empty value handling, when-hidden behavior, precision, remote options, semantic type, currency, export labels, pre-populate. |
| 1.7 — Sub-questions rename | **Done** | Renamed to "Follow-up questions" in FieldInspector. |
| 2.1 — Prominent form identity | **Done** | Large title input + description textarea + status dropdown at top of FormInspector, not in a collapsible. |
| 2.2 — Group form sections | **Done** | Sections grouped into Form Settings (Standard+), Answer Choices (always), Variables/Lookup/Rules (Standard+), Brand (always), Import/Export (always), Developer Tools (Advanced). |
| 3.1 — Three-tier mode | **Done** | `InspectorTier` type, `tierLevel()`, `meetsMinTier()` utilities. Segmented control in Inspector header. `inspectorMode` cycles simple→standard→advanced. |
| 3.2 — Tier-aware rendering | **Done** | All new sections use `meetsMinTier()` to gate controls. Empty sections hidden via tier checks. |
| 4.1 — Surface indicators | **Done** | Updated LogicBadges icons: ✱ (required), 👁 (relevant), ⚡ (calculate), ✓ (constraint), 🔒 (readonly). Click opens `field:rules` section. |
| 4.2 — Better summary badges | **Not started** | Collapsible summary badges still use generic tokens. |
| 5.1 — Inline hints | **Done** | `InlineHint.tsx` — visible in Simple/Standard, hidden in Advanced. Added to RulesSection, QuestionSection, LayoutStyleSection. |
| 5.2 — Empty state guidance | **Partial** | LayoutStyleSection has "Customize sizing, positioning, or styling" hint. Other sections not yet done. |
| 6 — Vocabulary renames | **Partial** | Done in new sections (Question text, Help text, Validation rule, Auto-calculate, Lock when, Shared answer choices, etc.). Not yet swept across GroupInspector, DisplayInspector, or other remaining UI surfaces. |

### Files added

- `src/components/inspector/AnswerTypePicker.tsx`
- `src/components/inspector/InlineHint.tsx`
- `src/components/inspector/sections/QuestionSection.tsx`
- `src/components/inspector/sections/RulesSection.tsx`
- `src/components/inspector/sections/LayoutStyleSection.tsx`
- `src/components/inspector/sections/DataHandlingSection.tsx`

### Files significantly modified

- `src/components/inspector/Inspector.tsx` — three-tier system, segmented control, tier utilities
- `src/components/inspector/FieldInspector.tsx` — full rewrite using new sections
- `src/components/inspector/FormInspector.tsx` — full rewrite with form identity + grouped sections
- `src/state/project.ts` — `inspectorMode` type widened to three tiers
- `src/state/mutations.ts` — `setInspectorMode`, `setFieldAnswerType` added

### Remaining work

- **1.5** — Inline answer-type-specific settings below the picker (currently separate WidgetPropsSection)
- **4.2** — Descriptive summary badges ("Shows when Country = US" instead of "Conditional")
- **5.2** — Empty state guidance for Rules and Follow-up sections
- **6 (full sweep)** — Vocabulary renames in GroupInspector, DisplayInspector, and other surfaces
- **GroupInspector/DisplayInspector** — Still use old BasicsSection, LogicSection, AppearanceSection; not yet migrated to new section components
- **Old section cleanup** — ValidationSection.tsx and AdvancedSection.tsx are no longer used by FieldInspector and can be removed once GroupInspector/DisplayInspector are migrated
