# Phase 1: Blind User Testing — Compiled Findings

**Date:** 2026-03-17
**Personas:** 5 (1 beginner, 2 intermediate, 1 advanced, 1 expert)

## Summary Table

| Persona | Model | Form Type | Complexity | Fields | Tool Calls | Bugs | UX Issues | Overall |
|---------|-------|-----------|-----------|--------|------------|------|-----------|---------|
| Diane (beginner) | haiku | Volunteer intake | Simple | 11 | ~18 | 0 | 3 | Completed |
| Marcus (intermediate) | sonnet | Event feedback survey | Medium | 19 | ~30 | 2 | 3 | Completed |
| Priya (intermediate) | sonnet | Research consent form | Medium-High | 7 + screener | ~45 | 2 | 5 | Completed |
| Jake (advanced) | sonnet | Expense report | High | 21 + repeating | ~60 | 3 | 5 | Completed |
| Dr. Chen (expert) | opus | Client onboarding wizard | Very High | 33 | ~55 | 5 | 5 | Completed |

All 5 personas completed their forms. Total: ~208 tool calls, 12 bugs, 21 UX issues.

---

## Deduplicated Issue List

### HIGH PRIORITY (3+ personas)

#### BUG-1: Preview scenario doesn't drive show_when/calculate evaluation
- **Category:** BUG
- **Hit by:** Marcus, Jake, Dr. Chen (3/5)
- **Description:** `formspec_preview(scenario={...})` sets `currentValues` but visibility conditions (`show_when`), calculated fields, and `selected()`/`count()` functions don't react to scenario values. Makes preview nearly useless for testing branching logic or calculations.
- **Evidence:**
  - Marcus: *"currentValues.sessions_attended is "" (empty string), not ["keynote"]. All conditional groups remain hidden — the scenario is ignored for visibility calculation."*
  - Jake: *"all calculated display fields (subtotal_display, tax_display, etc.) show null in currentValues"*
  - Dr. Chen: *"the consulting_details and design_details groups remain hidden, and estimated_cost remains 0"*

#### CONFUSION-1: dot-path vs parentPath vs page prop — three ways to place items, conflicting when combined
- **Category:** CONFUSION / BUG
- **Hit by:** Jake, Dr. Chen, (Priya noted page prop requirement) (3/5)
- **Description:** Three mechanisms for nesting items (`path: "parent.child"`, `props.parentPath`, `props.page`), but combining dot-path + parentPath doubles the nesting, creating unreachable items. No error or warning.
- **Evidence:**
  - Dr. Chen: *"Creates a group with key service_details.consulting_details (literal dots in key) nested under service_details, making the full path service_details.service_details.consulting_details... cannot be addressed by any tool"*
  - Jake: *"formspec_content(path='expenses.line_number_heading', props={parentPath: 'expenses'}) — the tool returned it was placed at expenses.expenses.line_number_heading"*
  - Priya: *"I had to specify props.page for every content item. Not obvious."*

### MEDIUM PRIORITY (2 personas)

#### BUG-2: No way to remove individual shape (validation) rules
- **Category:** BUG / GAP
- **Hit by:** Priya, Dr. Chen (2/5)
- **Description:** Shape IDs are visible in validation results but can't be addressed by `formspec_edit(remove)` (PATH_NOT_FOUND). Only recovery is linear undo, which also undoes unrelated work.
- **Evidence:**
  - Priya: *"There's no formspec_edit(action='remove', path='shape_X') capability — shapes are not in the item tree. The only recovery is formspec_undo."*
  - Dr. Chen: *"Once a bad validation rule is added, the only way to remove it is linear undo (which also undoes unrelated work)"*

#### BUG-3: FEL variable references not shown in check/trace output
- **Category:** BUG
- **Hit by:** Jake, Dr. Chen (2/5)
- **Description:** `formspec_fel(check)` and `formspec_trace` don't resolve `@`-prefix variable references. `@grand_total + @timeline_multiplier` returns empty references/dependencies.
- **Evidence:**
  - Jake: *"references array was empty. Expected to see grand_total as a reference."*
  - Dr. Chen: *"trace(expression='@base_cost * @timeline_multiplier') returns empty dependencies"*

#### GAP-1: Changelog not implemented
- **Category:** GAP
- **Hit by:** Jake, Dr. Chen (2/5)
- **Description:** `formspec_trace(mode="changelog")` returns a stub message.

#### BUG-4: describe(target) doesn't show shape rules attached to a field
- **Category:** UX / GAP
- **Hit by:** Priya (screener fields missing), Dr. Chen (shapes missing) (2/5)
- **Description:** Field detail view omits shape rules. Screener fields don't appear in structure stats.

### LOW-MEDIUM PRIORITY (1 persona, significant impact)

#### BUG-5: FEL null comparison semantics cause false-positive validation
- **Category:** BUG
- **Hit by:** Jake (1/5, but universally applicable)
- **Description:** `null > 25` = false, `not(null > 25)` = also false. Null is not treated as "not applicable" in comparisons, causing validation rules to fire on empty fields.
- **Evidence:**
  - Jake: *"null amount triggers receipt_attached validation AND the > $500 warning. FEL null comparison semantics are unexpected — not(null > 25) is false, which makes no logical sense."*

#### BUG-6: Multichoice required validation broken
- **Category:** BUG
- **Hit by:** Marcus (1/5)
- **Description:** `validate` mode reports a non-empty array `["keynote", "workshop_a"]` as failing the `required` constraint on a multichoice field.

#### BUG-7: Screener shape rules bleed into main form validation
- **Category:** BUG
- **Hit by:** Priya (1/5)
- **Description:** `formspec_behavior(add_rule)` accepts screener field paths silently, then shape rules fire during form validation on fields that aren't in the data model.

#### BUG-8: show_when accepts nonexistent target paths without error
- **Category:** BUG
- **Hit by:** Dr. Chen (1/5)
- **Description:** `formspec_behavior(show_when, target="nonexistent.field")` succeeds silently, creating a bind on a phantom path.

#### BUG-9: Circular variable reference accepted without error
- **Category:** BUG
- **Hit by:** Jake (1/5)
- **Description:** `formspec_data(variable, add, name="x", expression="@x + 1")` accepted without error. Audit also clean.

#### BUG-10: Copy item ignores target_path parameter
- **Category:** BUG
- **Hit by:** Dr. Chen (1/5)
- **Description:** `formspec_edit(action="copy", path="individual.phone", target_path="business")` creates copy as sibling, not in target group.

#### BUG-11: dateDiff argument order counterintuitive
- **Category:** BUG / UX
- **Hit by:** Dr. Chen (1/5)
- **Description:** `dateDiff($dob, today(), 'years')` returns negative for past dates. Must use `dateDiff(today(), $dob, 'years')`. Opposite of standard `diff(start, end)` convention.

#### BUG-12: Duplicate validation messages from email/phone type aliases
- **Category:** BUG
- **Hit by:** Priya (1/5)
- **Description:** Type aliases auto-generate bind constraints with generic "Invalid" message. Adding a custom shape rule creates duplicate error messages. No way to override the auto-generated message.

#### UX-1: contains() vs selected() confusion for multichoice
- **Category:** UX
- **Hit by:** Marcus (1/5)
- **Description:** `contains()` is a string function but reads like set membership. No warning when used on multichoice fields. `selected()` is the correct function but not discoverable from field type.
- **Evidence:**
  - Marcus: *"contains($sessions_attended, 'keynote') — the tool accepted it without error. The audit returned zero issues. The FEL check said it was valid."*

#### UX-2: Group creation requires 2 steps vs field creation 1 step
- **Category:** UX
- **Hit by:** Jake (1/5)
- **Description:** `formspec_field` accepts `props.page` for one-step placement. `formspec_group` does not — must create then use `formspec_place` separately. Inconsistent.

#### UX-3: sumWhere not in FEL function catalog
- **Category:** UX
- **Hit by:** Jake (1/5)
- **Description:** `formspec_fel(functions)` doesn't list `sumWhere`, but it works when used. Undiscoverable function.

#### UX-4: props.required conflicts silently with conditional require
- **Category:** UX
- **Hit by:** Marcus (1/5)
- **Description:** Setting `props.required: true` (unconditional) then adding `formspec_behavior(require, condition=...)` — no warning about the conflict.

#### UX-5: Component tree null in published bundle
- **Category:** BUG / GAP
- **Hit by:** Dr. Chen (1/5)
- **Description:** `publish` output shows `"tree": null` despite having 41 component nodes.

#### GAP-2: No page-level validation for wizard flows
- **Category:** GAP
- **Hit by:** Dr. Chen (1/5)

#### GAP-3: No disqualified/ineligible message customization
- **Category:** GAP
- **Hit by:** Priya (1/5)

#### GAP-4: Conditional required not automatic on hidden group children
- **Category:** GAP
- **Hit by:** Marcus (1/5)
- **Description:** Fields inside a conditionally-hidden group still require manual conditional `require` setup. Expected: hidden group children automatically not-required.

#### GAP-5: No computed display text / text interpolation in content
- **Category:** GAP
- **Hit by:** Jake (1/5)

#### GAP-6: No today() / auto-populate date
- **Category:** GAP
- **Hit by:** Priya (1/5)

---

## Praise (cross-persona)

| Feature | Praised By | Quote |
|---------|-----------|-------|
| Batch operations | Diane, Marcus, Jake, Dr. Chen (4/5) | Jake: *"Creating 5 header fields in a single call... dramatically faster"* |
| `formspec_fel(check)` | Marcus, Priya, Jake, Dr. Chen (4/5) | Jake: *"a power-user delight... the feedback loop is tight"* |
| `formspec_describe(audit)` | Diane, Marcus, Priya, Jake (4/5) | Priya: *"zero false positives... gave real confidence"* |
| Type aliases (email, phone, etc.) | Diane, Marcus (2/5) | Marcus: *"all just worked without needing to know the underlying schema types"* |
| Error messages | Diane, Dr. Chen (2/5) | Dr. Chen: *"Invalid widget names list all valid options. FEL parse errors include offset and character."* |
| Instant project creation | Marcus, Dr. Chen (2/5) | Marcus: *"formspec_create returned a project ID in one call... the right starting experience"* |
| Screener model | Priya, Dr. Chen (2/5) | Priya: *"well-designed... clean and expressive"* |
| FEL language expressiveness | Jake, Dr. Chen (2/5) | Dr. Chen: *"covers real-world form logic needs"* |
| Cross-group reactivity | Jake (1/5) | *"worked on the first try without any special syntax"* |
| Full lifecycle (create→publish→save→reopen) | Dr. Chen (1/5) | *"the complete authoring workflow is functional"* |

---

## Priority Summary

| Priority | Count | Key Issues |
|----------|-------|------------|
| HIGH (3+ personas) | 2 | Preview scenario broken; dot-path/parentPath confusion |
| MEDIUM (2 personas) | 4 | Shape removal missing; variable refs in check/trace; changelog stub; describe gaps |
| LOW-MEDIUM (1 persona, significant) | 16 | Null semantics, multichoice required, screener bleed, phantom paths, circular vars, copy target, dateDiff, duplicates, contains/selected, group placement, sumWhere catalog, required conflict, component tree null, page validation, disqualified msg, auto-date |
