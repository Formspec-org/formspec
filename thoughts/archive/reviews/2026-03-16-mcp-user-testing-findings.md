# MCP Server User Testing: Findings & Remediation Plan

**Date:** 2026-03-16
**Method:** 5 naive AI agents built forms of increasing complexity using only MCP tools, followed by 5 code-scout agents tracing each issue through the stack, followed by independent architectural review.

---

## Testing Summary

| # | Form | Complexity | Fields | Tool Calls | Audit | Real Issues Found |
|---|------|-----------|--------|------------|-------|-------------------|
| 1 | Contact Form | Beginner | 4 | 11 | Clean | 0 |
| 2 | Event RSVP | Easy | 5 | 11 | Clean | 0 |
| 3 | Job Application | Medium | 10 | 20 | Clean | 1 |
| 4 | Freelancer Invoice | Hard | 12 | 29 | Clean | 2 confirmed, 3 unverified |
| 5 | Insurance Claim | Expert | 17 | 28 | Clean | 2 (design gaps) |

All 5 forms audited clean. Every authoring error was recoverable from error messages alone.

---

## Problems, Context, Solutions

### P1: `setValue` crashes on calculated fields

**Problem:** `engine.setValue()` writes to `computed()` Preact signals, which are read-only. Throws `Cannot set property value of [object Object] which has only a getter`. Crashes `validateResponse()` and `previewForm()` when response data includes calculated field values.

**Context:** The spec says (line 364): "A field with a `calculate` Bind is implicitly `readonly`." The engine already has `isWritableSignal()` (line 1573) used in `applyGroupChildrenSnapshot` — but `setValue` doesn't use it. This is the highest-priority fix because it may be masking bugs 2-3 below.

**Where it lives:** Engine (`packages/formspec-engine/src/index.ts`, `setValue` method ~line 1993).

**Solution:** Guard the write. The engine should enforce the spec's "implicitly readonly" contract at the write boundary.

**Reviewer note:** Consider whether `setValue` should return a diagnostic signal rather than silently no-op, to prevent debugging nightmares in stateful systems.

**TDD approach:**
1. **RED:** Write a test that creates a form with a calculated field, calls `setValue` on it, and asserts no crash + value unchanged. Currently crashes.
2. **GREEN:** Add guard using existing `isWritableSignal()` before the signal write.
3. **EXPAND:** Test edge cases — calculated fields in repeat groups, nested calculated fields, setValue on calculated then on non-calculated in same batch.
4. **VERIFY:** Run full engine test suite to confirm zero regressions.

---

### P2: `compileFEL` parentPath computation is broken for indexed paths

**Problem:** `compileFEL` (engine line 1743) splits paths using `split(/[.\[\]]/)`, producing `"line_items.0"` instead of `"line_items[0]"`. This doesn't cause value errors today because the FEL interpreter has its own correct `getParentPath`, but it breaks dependency tracking for reactive signal updates.

**Context:** This is a correctness bug being masked, not a latent cosmetic issue. Computed values downstream of repeat group fields may already be silently wrong in interactive (non-preview) scenarios where a dependency change should trigger recomputation but the wrong path is tracked.

**Where it lives:** Engine (`packages/formspec-engine/src/index.ts`, `compileFEL` ~line 1743).

**Solution:** Fix the path splitting to preserve bracket notation for indexed segments.

**TDD approach:**
1. **RED:** Write a test with a repeat group where changing a field value in row N should trigger recomputation of a calculated field that depends on it. Assert the computed signal updates. Find the case where it doesn't (stale value due to wrong dependency path).
2. **GREEN:** Fix `compileFEL` to produce `"line_items[0]"` not `"line_items.0"`.
3. **EXPAND:** Test nested repeats (`group[0].subgroup[1].field`), dependency tracking across repeat boundaries, signal subscription counts.
4. **VERIFY:** Full engine suite.

---

### P3: `isPathRelevant` is private — preview reports wrong visibility

**Problem:** When a parent group is hidden via `show_when`, its children still appear in `visibleFields` in preview output. The engine has correct parent-chain visibility logic (`isPathRelevant`, line 2055) — spec line 2258 says "Implementations MUST enforce this" — but it's `private`. `previewForm()` in studio-core falls back to reading raw per-field signals that don't carry parent propagation.

**Context:** The engine already does the right thing for validation and response serialization. The gap is a missing public API surface.

**Where it lives:** Engine (access modifier) + studio-core (`evaluation-helpers.ts` lines 124-130).

**Solution:** Expose visibility resolution from the engine. Consider `getResolvedState(path)` returning fully-resolved visibility, required, readonly — a single API that accounts for all inheritance/cascade logic — rather than making individual methods public one at a time. This prevents the pattern from recurring when someone needs resolved readonly accounting for parent groups.

**TDD approach:**
1. **RED:** Write a test in studio-core: create a form with parent group hidden, child field inside it. Call `previewForm()`. Assert child is in `hiddenFields`, not `visibleFields`. Currently fails.
2. **GREEN:** Make `isPathRelevant` public (or add `getResolvedState`). Update `previewForm` to use it instead of raw signals.
3. **EXPAND:** Test deeply nested groups (grandparent hidden), mixed visibility (parent hidden, child has its own show_when that would be true), repeat groups with hidden parents.
4. **VERIFY:** Full engine + studio-core suites.

---

### P4: Preview path format mismatch (0-based vs 1-based)

**Problem:** In `previewForm()` output, `visibleFields` and `currentValues` use 0-based internal paths (`line_items[0].hours`) while `validationState` uses 1-based external paths (`line_items[1].hours`). Users see validation errors for `line_items[1]` but only instance `[0]` in visible fields — looks like a phantom second instance.

**Context:** This was originally reported as "phantom repeat instance" — a scary-sounding bug that's actually a display formatting inconsistency in studio-core's evaluation helpers. The engine's `toExternalPath` is applied inconsistently.

**Where it lives:** Studio-core (`evaluation-helpers.ts`, `previewForm` method).

**Solution:** Normalize ALL paths in the preview response to external (1-based) format. The MCP response should use the spec's 1-based format throughout.

**TDD approach:**
1. **RED:** Write a test: create a form with a repeat group (min: 1). Call `previewForm()`. Assert that ALL path references in the response use the same format (all 1-based or all 0-based). Currently fails — mixed.
2. **GREEN:** Apply `toExternalPath` to all path outputs in `previewForm`.
3. **EXPAND:** Test with multiple repeat instances, nested repeats, paths in `hiddenFields`, `requiredFields`, `validationState`, and `currentValues`.
4. **VERIFY:** Studio-core test suite + re-test the 3 "not reproducible" invoice bugs.

---

### P5: Unverified invoice bugs — re-test after P1+P4

**Problem:** Three bugs from invoice testing were marked "not reproducible": array-broadcast on calculated values, inflated `sum()` aggregation, and shape rules not firing on repeat fields. The scout tested independently and got correct results, but the original tester hit these issues.

**Context:** The independent reviewer flagged this: "Likely secondary effects" is a hypothesis, not confirmation. The setter crash (P1) may have corrupted output that was then misread. Or these may be independent bugs triggered by specific data/timing conditions the scout didn't reproduce.

**Where it lives:** Unknown until verified.

**Solution:** This is NOT a fix item — it's a verification gate. After P1 (setter crash) and P4 (path format) are fixed, re-run the exact invoice scenario from tester #4 end-to-end. If the bugs reappear, open new investigations. If they don't, close them as confirmed secondary effects.

**TDD approach:**
1. After P1 and P4 are merged, write an integration test that builds the exact invoice form: 3 line items with hours/rate/line_total, subtotal via `sum()`, tax rate, grand total.
2. Assert: each row's `line_total` is a scalar (not array), `subtotal` equals sum of individual totals (not N×N), shape rule `hours > 0` fires on negative input.
3. If any assertion fails, it's a new bug to investigate at the engine level.

---

### P6: Widget alias table misaligned with spec vocabulary

**Problem:** `dropdown` is the spec-normative Tier 1 widgetHint for choice fields (spec section 4.2.5.1). It's MISSING from studio-core's `WIDGET_ALIAS_MAP` in `field-type-aliases.ts`. Meanwhile `select` (which is NOT a spec widgetHint) IS present. The error message for invalid widgets leaks PascalCase Tier 3 component names (`Select`, `RadioGroup`) alongside lowercase aliases — two vocabularies mixed in one error.

**Context:** The `formspec-layout` package already has the correct mapping. Studio-core is the outlier. Additionally, `type: "text"` defaults to single-line TextInput instead of textarea — the spec says `text` dataType's default widgetHint is `textarea`, not `textInput`.

**Where it lives:** Studio-core (`field-type-aliases.ts`) + tree reconciler for the text→textarea default.

**Solution:**
1. Align `WIDGET_ALIAS_MAP` with the full spec Tier 1 vocabulary (including `dropdown`, `autocomplete`, `segmented`, `likert`, etc.).
2. Error messages should show ONLY the authoring alias vocabulary, not internal PascalCase component names.
3. Fix `text` dataType default: set widgetHint `textarea` when dataType is `text` and no explicit widget override is provided.

**TDD approach:**
1. **RED:** Write tests: `resolveWidget('dropdown')` should return `'Select'` (currently throws). `resolveWidget('invalid')` error message should not contain PascalCase names (currently does). Creating a field with `type: 'text'` should produce a textarea-like component (currently single-line).
2. **GREEN:** Add `dropdown` (and other spec widgetHints) to the alias map. Filter error message to alias keys only. Add `text` → `textarea` default in addField or tree reconciler.
3. **EXPAND:** Test every spec widgetHint resolves. Test that PascalCase raw names still work (for power users). Test `text` vs `string` default widget distinction.
4. **VERIFY:** Studio-core test suite.

---

### P7: Screener-to-form data boundary

**Problem:** The screener asks a question (e.g., "what type of insurance?") whose answer is needed inside the form for branching — but screener data is explicitly isolated from form data. Users must create a duplicate field, meaning respondents answer the same question twice.

**Context:** The spec (line 2464) says "Screener items are NOT part of the form's instance data." This is intentional for the original use case: federal grants routing users to entirely different form URIs. But users are also using screeners for single-definition gating, where the answer needs to flow into the form.

**Where it lives:** Spec + Schema. This is a design decision, not a bug.

**Independent reviewer pushback:** "Is this the right abstraction, or are users telling you the screener is being misused? The form already has conditional visibility/branching. Why are users reaching for the screener instead?" The reviewer suggests that improving discoverability of in-form branching (`show_when`, `formspec_flow branch`) may be the better answer. Adding `seedFields` creates a state synchronization problem between two intentionally separated domains — what happens on screener re-evaluation? Are seeded values reactive or snapshot?

**Solution:** Requires ADR 0045. The ADR must genuinely consider THREE alternatives:

1. **Do nothing + improve discoverability.** If users need the data inside the form, those questions should BE inside the form (page 1 with branching). Improve MCP tool descriptions and guide to steer users toward `formspec_flow branch` instead of screener for intra-form gating.

2. **Add `seedFields` map on Screener.** A declarative bridge that maps screener item keys to form field keys. The engine's `evaluateScreener` returns seed values alongside the route target. The host application (or studio-core helper) calls `setValue` with those values. Seed values are snapshot-at-entry, not reactive.

3. **Add `message` on Route (regardless of which option above).** When `target` is a rejection sentinel, `message` contains the rejection text. Also define `"proceed"` and `"reject"` as sentinel target values distinct from URI targets.

**No TDD until ADR is decided** — this is a spec-level design decision.

---

### P8: MCP tool description clarity

**Problem:** Two vocabulary confusions traceable to MCP tool descriptions:
1. Users don't know that `props.required` on `formspec_field` is syntactic sugar for `formspec_behavior(require, condition='true')`. They use both, wondering if both are needed.
2. `type: "number"` is accepted but silently becomes `decimal`. The MCP description lists both without clarifying the alias relationship.

**Context:** The underlying machinery is correct — `props.required` and `behavior(require)` converge on the same bind entry, and `number`→`decimal` is a valid alias. The confusion is purely in the API surface documentation.

**Where it lives:** MCP (`packages/formspec-mcp/src/` — tool schemas and descriptions).

**Solution:** Update tool descriptions:
- `formspec_field` `props.required` description: "Shorthand for unconditional required. For conditional required (e.g., only required when another field has a certain value), use formspec_behavior with action='require' and a condition instead."
- `formspec_field` type description: clarify `"number"` is an alias for `"decimal"`.
- `formspec_behavior` `require` description: "Sets field as required. Equivalent to props.required on formspec_field for the unconditional case, but also supports a FEL condition expression."

**TDD approach:** Not applicable — documentation-only change. Verify by re-running tester #1 and #3 scenarios and confirming no confusion in their output.

---

## Fix Order

The independent reviewer correctly identified that fix order matters due to masking effects:

```
P1 (setValue crash)          ← highest priority, may unmask P5
    ↓
P2 (parentPath splitting)   ← correctness bug being masked
    ↓
P4 (path format mismatch)   ← display bug, enables P5 verification
    ↓
P5 (re-verify invoice bugs) ← GATE: re-test, then close or escalate
    ↓
P3 (isPathRelevant public)  ← engine API gap, enables correct preview
    ↓
P6 (widget alias table)     ← studio-core conformance
    ↓
P8 (MCP descriptions)       ← documentation, no code risk
    ↓
P7 (screener ADR)           ← design decision, independent timeline
```

P1→P2 are engine correctness fixes. P4→P5 are verification-dependent. P3→P6→P8 are independent improvements. P7 is a spec-level decision on its own timeline.

---

## What Worked Well (preserve these)

- **Batch `items[]` on field/behavior** — universally praised by all 5 testers
- **`create` → `load` → author flow** — self-guiding via tool response messages
- **Preview with scenario injection** — immediate confidence without deployment
- **Actionable error messages** — every authoring error was self-recoverable
- **Audit as confidence gate** — all 5 forms passed, testers found this reassuring
- **FEL tooling (`context`, `functions`, `check`)** — expression discovery and pre-validation
- **`formspec_flow branch`** — one-call conditional group setup, called "elegant"
