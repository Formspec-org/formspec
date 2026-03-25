# Phase 3: Independent Sanity Check

**Date:** 2026-03-25
**Reviewer:** Opus agent (no codebase access)

---

## Systemic Finding: Silent Failure Architecture

8 of 22 issues share one root cause: **the system silently swallows bad input and proceeds.** This is not 8 bugs — it's the absence of a "fail loudly on bad input" convention. Every layer independently chose "return something and keep going" over "tell the caller something is wrong."

**Recommendation:** Before fixing individually, establish a project-wide convention: every function that receives external input must either succeed meaningfully or return/throw a structured error. Null/undefined/empty is never a valid "I failed" signal.

---

## Per-Fix Pushback

### Agreed With
- **BUG-1** (phone regex): Ship immediately. Regression test more valuable than the fix itself.
- **BUG-3 creation-time**: Ship it. Name the concept ("semantic pre-validation") for future migration.
- **BUG-8**: Ship if convenient, low priority.
- **UX-1**: Cheapest fix, most impactful for LLM usability. Ship immediately.
- **GAP-2 + GAP-3**: Low risk, real capability gaps. Ship both.
- **BUG-2 + BUG-6 + BUG-7**: Same pattern. Do a full MCP param audit sweep.
- **CONFUSION-1, CONFUSION-3**: Legitimate docs fixes.
- **UX-4a/c**: Ship.
- **UX-4b**: Ship.
- **GAP-6**: Agree with deferral.

### Disagreed / Adjusted

| Fix | Pushback | Recommendation |
|-----|----------|---------------|
| **BUG-3 runtime** | Don't add diagnostics checks at 3 call sites. Fix `constraint_passes` signature to take `EvalResult` (value + diagnostics), not just the value. One change, one function. | Fix `constraint_passes`, not the callers |
| **BUG-5** | Analysis-time only for now. Runtime arity enforcement could break existing deployed forms. Halves scope, eliminates migration risk. | Ship analysis-time only. Defer runtime. |
| **GAP-1** | Investigate whether `filter` is the better primitive (one general function) rather than 5 specific `*Where` variants. | Deprioritize, investigate `filter` first |
| **BUG-4** | The "try both" pattern at MCP layer is a smell — makes MCP aware of bind/shape duality. Fix in studio-core with a unified `removeValidation(target)` that handles both internally. | Fix in studio-core only, don't leak duality to MCP |
| **CONFUSION-2** | NOT a documentation fix. `loadDataIntoEngine` incorrectly flattens money objects — that's a code bug. Fix the flattening AND the docs. | Code fix + docs, not docs alone |
| **UX-3** | `position: 'inside' | 'after' | 'before'` needs more design work. Edge cases undefined. | Send back to design |
| **UX-6** | Under-specified. What does "local" mean for nested repeats? Cross-group references? | Send back to design |

---

## Conflict Detection

1. **BUG-3 runtime + creation-time**: Ship creation-time first. Runtime still needed for pre-existing forms.
2. **BUG-4 + BUG-8**: Test the full lifecycle — add shape, get warning, remove bind constraint, warning should clear.
3. **BUG-5 + GAP-1**: Register new function signatures in catalog BEFORE arity checker runs.

---

## Reviewer's Priority Ranking

### This Week (Top 3)
1. **BUG-1** — One-line fix + regression test. 30 min, permanent value.
2. **BUG-2 + BUG-6 + BUG-7 + full MCP param audit** — Same class, fix together. Half day.
3. **BUG-3 creation-time + UX-1** — Studio-core string/validation changes. Half day.

### Next Week
4. BUG-3 runtime (fix `constraint_passes` signature)
5. BUG-4 (unified `removeValidation`)
6. GAP-2 + GAP-3 (branch improvements)

### Defer
- BUG-5 (analysis-time only, needs migration planning)
- GAP-1 (investigate `filter` first)
- UX-3 (needs design)
- UX-6 (needs design)
- GAP-6 (feature, not bug)

---

## Highest Leverage Actions (Not In The Fix List)

1. **Establish "fail loudly" convention** — project-wide rule: accept & succeed, or reject with structured error. Never silently proceed.
2. **Full MCP param audit** — three bugs with same pattern means more exist. Proactive sweep cheaper than user testing.
