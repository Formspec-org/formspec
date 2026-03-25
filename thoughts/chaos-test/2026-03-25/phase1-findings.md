# Phase 1: Blind User Testing — Compiled Findings

**Date:** 2026-03-25
**Personas:** 5 | **Total tool calls:** ~218 | **Total runtime:** ~22 min

## Summary Table

| Persona | Form Type | Complexity | Fields | Tool Calls | Bugs | Overall |
|---------|-----------|------------|--------|------------|------|---------|
| Priya Sharma (haiku, beginner) | Grant application | Low | 7 + submit | ~28 | 1 | Completed |
| Marcus Chen (sonnet, intermediate) | Speaker submission | Medium | 10 + conditional + wizard | ~43 | 2 | Completed |
| Delia Okafor (sonnet, intermediate) | Employee intake | High | 21 + conditional wizard | ~67 | 5 | Completed |
| Jake Villanueva (sonnet, expert) | Expense report | High | 17 + repeats + calcs | ~77 | 3 | Partial (subtotals broken) |
| Sasha Petrov (opus, expert) | Screening questionnaire | Very High | 22 + scoring + skip logic | ~73 | 3 | Completed (with workarounds) |

---

## Deduplicated Issue List

### BUG-1: Phone type alias generates invalid FEL regex (HIGH)
**Hit by:** Priya, Delia, Sasha (3/5)
**Category:** BUG
**Description:** Creating a field with `type: "phone"` auto-generates a bind constraint containing `\s` which is not a valid FEL regex escape sequence. Causes `FEL_PARSE_ERROR: unrecognized escape sequence '\s' at position 21`.
**Evidence:**
- Priya: "When I initially created the contactPhone field as type: 'phone', the system auto-generated a validation constraint with an invalid regex escape sequence (\s), causing an FEL parse error."
- Delia: "The auto-generated phone constraint uses \s which is not valid in FEL regex syntax."
- Sasha: "The \s shorthand is common in JavaScript regex but apparently not supported by FEL's matches()."
**Workarounds:** Priya deleted and recreated as string. Delia used `formspec_update` to overwrite constraint. Sasha used `formspec_update` with `constraint: null`.

### BUG-2: `formspec_style` layout action crashes with `path` parameter (HIGH)
**Hit by:** Marcus, Delia (2/5)
**Category:** BUG
**Description:** Calling `formspec_style` with `action: "layout"` and `path: "group_name"` crashes with `Cannot read properties of undefined (reading 'split')`. Using `target` instead of `path` works fine.
**Evidence:**
- Marcus: "The tool schema shows both path and target as valid keys but only target works for layout actions. The error message gives zero hint about this."
- Delia: "Either path should work, or the error should say 'use target not path'."

### BUG-3: Broken FEL expressions silently accepted, validation passes invalid data (HIGH)
**Hit by:** Marcus (1/5, but systemic)
**Category:** BUG
**Description:** Adding a rule with an invalid FEL function (e.g., `len()` instead of `length()`) succeeds without error. At validation time, the broken rule is silently skipped — form reports `valid: true` on data that should fail.
**Evidence:**
- Marcus: "Rules were stored with a broken function name and the validator simply skipped them, reporting valid: true on clearly invalid data. This is a correctness hazard — a form builder thinks they have validation but they don't."

### BUG-4: `remove_rule` doesn't remove bind-level constraints (HIGH)
**Hit by:** Delia, Sasha (2/5)
**Category:** BUG
**Description:** `formspec_behavior(action: "remove_rule")` only removes shape-level validation rules. Bind-level constraints (created by type aliases like `phone`) are not affected. Returns success but constraint persists.
**Evidence:**
- Delia: "Returns success but the bind-level constraint from the phone type is not removed. Only shape-level rules are removed."
- Sasha: "This distinction (bind constraint vs. shape rule) is an implementation detail that leaks through the API. A user just wants to 'remove the validation rule' — they shouldn't need to know which mechanism created it."

### BUG-5: Filtered aggregation functions validate but return null at runtime (HIGH)
**Hit by:** Jake (1/5, but critical for calculated forms)
**Category:** BUG
**Description:** `moneySum(array, predicate)` and `sum(array, predicate)` pass FEL check but always return null at runtime. The FEL checker is a "false positive oracle" for predicate-bearing aggregates.
**Evidence:**
- Jake: "Per-category subtotals — a primary requirement — are completely broken. The FEL checker is a false positive oracle for this class of expression."
**Impact:** Makes any form with filtered calculations (expense reports, scoring, conditional totals) fundamentally broken.

### BUG-6: Preview `response` parameter silently ignored (MEDIUM)
**Hit by:** Jake, Sasha (2/5)
**Category:** BUG
**Description:** `formspec_preview` has both `response` and `scenario` parameters. Only `scenario` actually populates values. `response` is silently ignored — no error, just empty form state.
**Evidence:**
- Jake: "currentValues in the result shows all fields as empty/null."
- Sasha: "Either the response parameter should work with nested objects, or it should be documented that scenario is the correct parameter."

### BUG-7: Group creation returns error but actually succeeds (MEDIUM)
**Hit by:** Sasha (1/5)
**Category:** BUG
**Description:** `formspec_group` with `parentPath` returns `PATH_NOT_FOUND` error but the group IS created. Retrying gives `DUPLICATE_KEY`.
**Evidence:**
- Sasha: "Returning an error while creating the resource is the worst outcome — the caller retries and gets DUPLICATE_KEY confusion."

### BUG-8: Phone validation double-registered in binds AND shapes (LOW)
**Hit by:** Delia (1/5)
**Category:** BUG
**Description:** After overwriting a phone type's bind constraint via `update` AND having previously called `add_rule`, the same field has validation in both `binds` (constraint) and `shapes` (rule). Causes duplicate validation at runtime.
**Evidence:**
- Delia: "The phone validation appears in both binds (as a constraint) and shapes (as a shape rule). This causes duplicate validation at runtime."

---

### UX-1: Field paths silently scoped by page group — no feedback on actual path (HIGH)
**Hit by:** Marcus, Delia, Sasha (3/5)
**Category:** UX
**Description:** Creating a field with `path: "age"` and `props.page: "demographics"` creates it at `demographics.age`, but the response only says "Added field 'age' to 'demographics'" — never shows the full path needed for subsequent tool calls.
**Evidence:**
- Marcus: "The success message should return the actual canonical path that was created (e.g., 'createdPath': 'speaker_info.speaker_bio')."
- Delia: "Three failed attempts before I figured out it needed parentPath: 'personal_info.emergency_contact'."
- Sasha: "This is discoverable only by searching afterwards."

### UX-2: `formspec_save` fails with no actionable path for in-memory projects (MEDIUM)
**Hit by:** Delia, Jake (2/5)
**Category:** UX
**Description:** `formspec_create` creates an in-memory project. `formspec_save` fails with "No save path specified and project has no source path." Neither tool accepts a save path parameter.
**Evidence:**
- Delia: "save with no path returns 'No save path specified' — but there's no documentation on what path format is acceptable."
- Jake: "formspec_create should either accept a path parameter or formspec_save should accept a path parameter."

### UX-3: `formspec_edit` move semantics — nests inside target instead of placing after (MEDIUM)
**Hit by:** Marcus, Sasha (2/5)
**Category:** UX
**Description:** `edit(action: "move", target_path: "field_x")` nests the item inside field_x rather than placing it after. No `after` or `before` positioning semantics. Moving within same parent requires explicit `target_path` even for index reorder.
**Evidence:**
- Marcus: "Instead of 'insert after session_type,' it interpreted it as 'nest inside session_type.'"
- Sasha: "move-to-index-0 within current parent should be the default when no target is specified."

### UX-4: `formspec_describe` doesn't show repeat config or display item paths (MEDIUM)
**Hit by:** Marcus, Jake, Sasha (3/5)
**Category:** UX
**Description:** `describe` for a group doesn't show repeat settings. `fieldPaths` omits display content items (banners, headings). Group creation success messages don't confirm repeat configuration.
**Evidence:**
- Marcus: "fieldPaths array omits display content items."
- Jake: "The response says 'Added group' with no mention of the repeat settings."
- Sasha: "describe(target: 'medications') returns item/bind with no indication of repeat settings."

### UX-5: Shape validation not enforced in preview mode (MEDIUM)
**Hit by:** Priya (1/5, but affects trust)
**Category:** UX
**Description:** Shape rules (form-level cross-field validation) are not evaluated during preview. Budget cap rule was added successfully but preview showed no validation errors when exceeded.
**Evidence:**
- Priya: "I added a rule to prevent budgets over $5,000. The rule was accepted without error, but when I tested in preview mode with a $6,000 value, the validation error did NOT appear."

### UX-6: `formspec_fel` context action doesn't scope to repeat rows (LOW)
**Hit by:** Jake (1/5)
**Category:** UX
**Description:** `formspec_fel(action: "context", context_path: "line_items")` returns global field list, not row-scoped references.
**Evidence:**
- Jake: "Expected row-scoped context including $ (current element) and sibling fields without prefix."

---

### CONFUSION-1: `formspec_behavior` vs `formspec_flow` for conditional visibility (MEDIUM)
**Hit by:** Delia (1/5, but conceptually important)
**Category:** CONFUSION
**Description:** Both tools control conditional visibility — `behavior` at field level, `flow` at page level. They write overlapping `relevant` expressions with no warning. No guidance on when to use which.
**Evidence:**
- Delia: "Both can make things show/hide conditionally... These overlap, interact, and can produce redundant/conflicting relevant expressions."

### CONFUSION-2: Money field response format unclear (MEDIUM)
**Hit by:** Priya, Jake (2/5)
**Category:** CONFUSION
**Description:** Money fields store as `{"amount": N, "currency": ""}` internally, but the tool description says nothing about this format. Plain numbers work for `scenario`, structured objects break things silently.
**Evidence:**
- Priya: "budgetAmount value is returned as {'amount':6000,'currency':''} rather than just 6000."
- Jake: "Structured objects break everything silently (amounts become null, conditional logic breaks)."

### CONFUSION-3: Bind constraints vs shape rules — two validation systems (MEDIUM)
**Hit by:** Delia, Sasha (2/5)
**Category:** CONFUSION
**Description:** Two validation mechanisms (bind constraints from type aliases vs shape rules from `add_rule`) behave differently, are managed by different tools, and appear in different places in output.
**Evidence:**
- Sasha: "This distinction is an implementation detail that leaks through the API."

---

### GAP-1: No working filtered aggregation (sumWhere / filterWhere) (HIGH)
**Hit by:** Jake (1/5, critical for calculated forms)
**Category:** GAP
**Description:** `countWhere` exists but `sumWhere`, `filterWhere`, `mapWhere` do not. Combined with BUG-5 (predicate aggregates return null), any form needing conditional sums is blocked.
**Evidence:**
- Jake: "The count category having countWhere but sum not having sumWhere is a jarring inconsistency."

### GAP-2: Branch only supports equality, not numeric ranges or FEL expressions (MEDIUM)
**Hit by:** Sasha (1/5, but blocks common patterns)
**Category:** GAP
**Description:** `formspec_flow` branch only supports `mode: "equals"` or `"contains"`. No range comparisons, no arbitrary FEL conditions. Forces creating intermediary calculated fields for score-based routing.
**Evidence:**
- Sasha: "For a scoring-based skip logic, I had to create a calculated intermediary field. This is a common pattern in clinical screening forms and should be easier."

### GAP-3: Cannot branch on variables, only fields (MEDIUM)
**Hit by:** Sasha (1/5)
**Category:** GAP
**Description:** `flow.branch(on: "variable_name")` gives PATH_NOT_FOUND. Variables can't drive page routing — only fields.
**Evidence:**
- Sasha: "Variables are first-class FEL citizens but not first-class flow citizens."

### GAP-4: No hidden calculated field type (LOW)
**Hit by:** Sasha (1/5)
**Category:** GAP
**Description:** No `type: "calculate"` that computes a value without rendering. Calculated intermediaries always show as visible fields.
**Evidence:**
- Sasha: "In ODK/XForms, type: calculate creates a field that computes a value but is never shown. The closest here is string + readonly + calculate, but it still renders."

### GAP-5: No "Other (please specify)" pattern (LOW)
**Hit by:** Marcus (1/5)
**Category:** GAP
**Description:** No built-in way to add a free-text "Other" option to a choice/multichoice field.
**Evidence:**
- Marcus: "No built-in 'Other/specify' widget."

### GAP-6: No custom error messages for required fields (LOW)
**Hit by:** Priya, Marcus (2/5)
**Category:** GAP
**Description:** Required fields show generic "Required" message. No way to customize per-field (e.g., "Please tell us about your mission").
**Evidence:**
- Priya: "All required fields show the generic message 'Required'. I can't customize these."
- Marcus: "I can't customize the error message... Google Forms shows 'That doesn't look like a valid email address.'"

---

### PRAISE-1: Batch field creation (5/5 personas)
All five personas praised the `items[]` array on `formspec_field` for creating multiple fields in one call.

### PRAISE-2: FEL expression checking — `fel(action: "check")` (4/5)
Marcus, Jake, Sasha, Delia praised the ability to validate expressions before committing.

### PRAISE-3: Preview with scenarios (4/5)
Marcus, Delia, Jake, Sasha praised `formspec_preview` with `scenario` for testing conditional logic without a browser.

### PRAISE-4: Audit tool — `describe(mode: "audit")` (4/5)
Marcus, Delia, Jake, Sasha praised the clean-bill-of-health audit check.

### PRAISE-5: Conditional logic (show_when + require) (3/5)
Marcus, Jake, Sasha praised the FEL-based conditional system as powerful and intuitive.

### PRAISE-6: Publish bundle (3/5)
Marcus, Delia, Sasha praised the comprehensive publish output with definition + component + theme.

### PRAISE-7: Dependency tracing — `formspec_trace` (1/5)
Sasha specifically praised this as "something I've never seen in any form builder."

---

## Priority Summary

| Priority | Issues |
|----------|--------|
| HIGH (3+ personas or critical) | BUG-1 (phone regex, 3/5), BUG-2 (style path crash, 2/5), BUG-3 (silent invalid FEL, systemic), BUG-4 (remove_rule bind leak, 2/5), BUG-5 (filtered agg null, critical), UX-1 (path feedback, 3/5), GAP-1 (no sumWhere) |
| MEDIUM | BUG-6 (preview response ignored, 2/5), BUG-7 (group error-but-succeeds), UX-2 (save path), UX-3 (move semantics), UX-4 (describe gaps, 3/5), UX-5 (shape rules in preview), CONFUSION-1/2/3, GAP-2/3/6 |
| LOW | BUG-8 (double validation), UX-6 (FEL context scope), GAP-4/5 |
