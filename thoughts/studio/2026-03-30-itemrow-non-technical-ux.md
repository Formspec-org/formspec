# ItemRow UX: guidance for non-technical authors

**Date:** 2026-03-30  
**Scope:** Formspec Studio definition tree — `ItemRow` and the surfaces it composes (`ItemRowContent`, `ItemRowLowerPanel`, related UI such as `AddBehaviorMenu`, `BindCard`, status pills).  
**Audience:** Form authors, program staff, and others who are not engineers.

---

## Context

### What ItemRow is

`ItemRow` is the compact tree row for each field (and display item) in the definition editor. It orchestrates:

- **Identity and summary:** label, key, type, and a grid of “what’s set” (description, hint, rules, format details).
- **Expanded lower panel:** field configuration, behavior binds (relevance, required, readonly, constraint), calculation / pre-populate, and choice options when relevant.

Most “user-visible” copy and layout for this experience live in **`ItemRowContent`** and **`ItemRowLowerPanel`**, not in `ItemRow.tsx` itself — but product conversations often refer to the whole thing as “the row.”

### Why this matters

Studio exposes **Formspec concepts** (binds, FEL, paths, `calculate` vs `relevant`, etc.). The **spec is precise**; the **UI must translate** that into tasks people recognize (“when does this show?”, “is it mandatory?”) without forcing everyone through developer vocabulary.

### Spec background (behavior combinatorics)

Normatively, **multiple bind facets on one field are allowed and expected** — modeled as one bind with several optional properties. In Phase 2 (Recalculate), all four MIP expressions (`calculate`, `relevant`, `required`, `readonly`) are evaluated in dependency-graph topological order; in Phase 3 (Revalidate), `constraint` expressions are evaluated and required-violation checks run (is the value empty when required is true?) for relevant fields. There is **no** normative “forbidden pair” list such as *required + readonly is invalid*; awkward combinations are **legal** but may confuse authors. (See core spec: processing model, bind semantics, §3.10.1 for real definition errors like Calculate target conflict.)

**Implication for UX:** do not block legal pairs without a spec change; **explain and nudge** when combinations are likely unintended.

---

## Goals

1. **Reduce cognitive load** for first-time and occasional authors.
2. **Align language with tasks**, not implementation terms, while keeping technical names discoverable for support and power users.
3. **Preserve correctness** — the UI should not contradict Formspec; clarifications and warnings are **advisory** unless the spec is tightened.

---

## Recommendations (with reasoning)

### 1. Plain-language layer; spec terms secondary

**Idea:** Prefer headings, buttons, and menu labels that describe **intent**:

| Technical / current | Author-facing framing (examples) |
|---------------------|-----------------------------------|
| Relevant | When does this field show? / Visibility |
| Required | Must the user fill this in? / Mandatory |
| Readonly | Can the user change this value? |
| Constraint (+ constraintMessage) | Custom validation / Error when… |
| Calculate | Computed value / Set from a formula |
| Default (bind) | Value when field reappears / Reset value |
| Pre-populate | Pull value from elsewhere / Link to another source |
| Initial value | Starting value (or formula) |

Additional bind properties exist for advanced use cases and should be surfaced under an “Advanced” or “More settings” area (see recommendation §7) rather than hidden entirely:

| Technical | Author-facing framing (examples) |
|-----------|-----------------------------------|
| Whitespace | Text cleanup (trim, normalize) |
| Non-relevant behavior | What happens to data when hidden (keep / clear / remove) |
| Excluded value | What formulas see when field is hidden (keep value / treat as empty) |
| Disabled display | Show hidden fields as disabled instead of removing them |

**Reasoning:** Non-technical users scan for **outcomes**, not schema keywords. Keeping `relevant`, `calculate`, etc. in tooltips, help links, or an expandable “Technical name” preserves debuggability and doc search without front-loading jargon.

**Where it lands:** `AddBehaviorMenu` labels/descriptions, `BindCard` titles, `ItemRowLowerPanel` section headings, summary row labels (via `item-row-shared` and editor-tree helpers where labels are built).

---

### 2. Unify the mental model: fewer parallel “areas”

**Idea:** Today, **Field details** can show format settings **and** “Add Calculation / Pre-population” **and** a separate **Behavior** section. Authors often experience that as **three unrelated zones** for “how this field works.”

**Direction:** Evolve toward one story — e.g. a single **”Field rules”** or **”Logic & validation”** region with clear subsections, while preserving the core/theme tier boundary:

- Visibility
- Validation (required, custom checks, messages)
- Value (default, calculated, external / pre-populate)
- Data format (currency, precision, prefix/suffix — all core-tier Definition properties)

Note: `prefix`/`suffix` are defined on the core-tier FieldItem in `§4.2.3`, not the Theme. The spec labels them “presentation hint only” (they must not appear in stored data), but structurally they are Definition properties — siblings of `dataType`, `precision`, `currency`. Theme-tier presentation (`PresentationBlock`: widget, widgetConfig, labelPosition, style) is authored separately and does not belong in this region.

**Reasoning:** Task grouping beats package grouping. All properties in this region are authored on the Definition and live in `schemas/definition.schema.json`. Theme overrides (widget hints, label positioning, style) are a separate authoring surface and should not be intermixed here.

**Where it lands:** Mostly `ItemRowLowerPanel` structure and headings; may touch `ItemRow` only if editor mode flags are simplified.

---

### 3. Replace meta, implementation-facing copy

**Idea:** Avoid instructions like “add a setting to open an editor here.” Prefer **task-forward** guidance, e.g. “Use the options below to set formatting, starting values, and rules for this field.”

**Reasoning:** Meta copy assumes familiarity with the **editor chrome**; authors care about **the form**.

**Where it lands:** `ItemRowLowerPanel` intro paragraphs; similar strings in `ItemRowContent` if any.

---

### 4. Status pills: prioritize words over codes

**Idea:** Current pill abbreviations (`req`, `rel`, `ƒx`, `def`, `pre`, `rule`, `ro`) are dense. Prefer **short full words** or **icon + word**, with abbreviations as `title` tooltips or a compact density mode for power users.

**Reasoning:** Pills are a **scan surface**; cryptic codes optimize for horizontal space at the cost of comprehension.

**Where it lands:** `buildStatusPills` / consumers in `DefinitionTreeEditor` and row footer rendering; pill component props if needed.

---

### 5. Non-blocking hints for confusing but legal combinations

**Idea:** When both **required** and **readonly** (or other “looks contradictory” pairs) are active, show a **short, plain-language note**: e.g. that the field must have a value but the user cannot type it — usually they need a default, calculation, or pre-populate, or to relax one of the rules.

Similarly, **pre-populate + calculate** may deserve a soft hint — not because the spec is ambiguous (pre-populate is one-time creation-time value seeding, optionally paired with a `readonly` bind to lock it, while calculate is reactive and continuous), but because the distinction is **surprising to authors** who may not realize that the first Recalculate phase runs immediately after Response creation, so `calculate` will overwrite the pre-populated value before the author ever sees it. A note like “This field has both a linked starting value and a live formula — the formula runs immediately and will replace the starting value” helps without implying a spec gap.

**Reasoning:** The spec allows many combinations; **trust + explain** beats silent confusion or hard errors without a normative basis.

**Note — Shapes (cross-field validation):** The spec's Validation Shape system (`§5.2`) provides form-level validation rules that target individual fields but are **not** bind-level constraints. If a field fails validation due to a Shape, the author cannot explain it from the field's own binds. `FormHealthPanel` or the lower panel should surface Shape-derived status so authors can discover "this field is part of a form-level rule" without hunting through the Shapes editor.

**Note — Display Items:** Display Items (`§4.2.4`) may only use the `relevant` bind property. `required`, `calculate`, `constraint`, and `readonly` are meaningless for Display Items and MUST be ignored by the processor. The `AddBehaviorMenu` should filter available behaviors by item type — for display items, only "Visibility" should be offered from the bind family.

**Where it lands:** Derived state next to `ItemRow` / lower panel (small `FormHealthPanel`-style callout or inline `role="status"` text); avoid modal interruption for advisory content.

---

### 6. Safer onboarding inside each new rule card

**Idea:** In Studio, new binds are auto-populated with the expression `'true'` (a Studio convention — the spec defines no default; absent bind properties simply do not apply). Pair the control with **one line of context** (“Starts as always on — click to set a real condition”) or **starter patterns** (“Show only if another field…”) where the product can support templates later.

**Reasoning:** Expression editors are the scariest surface for non-programmers; **progressive depth** (simple → advanced) reduces abandonment.

**Where it lands:** `BindCard`, `InlineExpression`, empty states.

---

### 7. Reduce competing “+” actions

**Idea:** A selected row can show **many** dashed add buttons at once. Consider **one primary** “Add a rule” or “Add field setting” entry that opens a **categorized** chooser, with **formatting / advanced** tucked under “More settings” or a secondary row.

**Reasoning:** Hick’s law — too many equal-weight actions **paralyze**; hierarchy signals **recommended paths**.

**Where it lands:** `ItemRowLowerPanel` launcher layout; possibly `AddBehaviorMenu` consolidation.

---

### 8. Lightweight orientation (first expand or persistent help)

**Idea:** A **2–3 bullet** primer when the panel first expands (or a `?` link): description/hint vs rules vs value sources.

**Reasoning:** One-time orientation **frames** the rest of the panel; cheaper than a full tutorial.

**Where it lands:** Lower panel header or `CollapsibleSection` intro; could use `localStorage` for “don’t show again” if desired.

---

### 9. Accessibility as part of author UX

**Idea:** Custom menus, inline editors, and pills need **names, roles, and state** (expanded/collapsed, what was added). Work already started on menu triggers should extend to the whole row surface.

**Reasoning:** Non-technical authors **overlap heavily** with users who rely on keyboards and assistive tech; unclear semantics **hurt everyone**.

**Where it lands:** `AddBehaviorMenu`, summary grid buttons, drag-handle labels, live regions for add/remove if not visually obvious.

---

## Implementation sketch (non-binding)

| Area | Likely touch points |
|------|---------------------|
| Copy / headings | `ItemRowLowerPanel`, `AddBehaviorMenu`, `item-row-shared` |
| Summary labels | Editor tree helpers / `DefinitionTreeEditor` summary building |
| Pills | `buildStatusPills` (`formspec-studio-core`), row footer |
| Hints | New small component or extend `FormHealthPanel`; glue in `ItemRow` or lower panel from `binds` + item |
| IA merge of “details” vs “behavior” | `ItemRowLowerPanel` sections; may need `ItemRow` flags simplified over time |

---

## Out of scope (for this note)

- Changing Formspec normative semantics to forbid combinations (would require spec + conformance work).  
- Full visual redesign — this document is **IA and language** oriented.

---

## References

- Core spec: processing model phases (`§2.4`), bind object (`§4.3`, `§4.3.1`), field items (`§4.2.3`), display items (`§4.2.4`), presentation hints (`§4.2.5.5`), validation shapes (`§5.2`), non-relevant validation suppression (`§5.6`), definition errors (`§3.10.1`).
- Studio code: `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx`, `ItemRowContent.tsx`, `ItemRowLowerPanel.tsx`, `AddBehaviorMenu.tsx`.
