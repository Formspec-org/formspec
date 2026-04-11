# ADR-0060: FEL `$` in `constraint` vs predicate rebinding

**Status:** Accepted  
**Date:** 2026-04-11  
**Author:** Formspec maintainers  
**Applies to:** Formspec Core FEL, all runtimes (`fel-core`, Python, WASM), authoring docs and WOS examples that use quantifiers inside constraints  

---

## Context

In FEL, the **`$` token** can mean different things depending on where it appears:

1. **Bind `constraint`** — Core defines that inside a `constraint` expression on a field bind, **`$` is the targeted field’s current value** (the “self” value under validation).

2. **Quantifier and `*Where` predicates** — For `every`, `some`, `countWhere`, `sumWhere`, and related builtins, the **second argument is a predicate** evaluated **once per array element**, and **`$` is rebound to that element** for the duration of that evaluation.

Authors and integrators can be unsure what happens when both appear in one expression—for example, a **constraint on a field whose value is an object** that contains an array, and the constraint uses `every` over a projection of that object.

The ambiguity is **not** “should we allow string predicates?” (Core rejects string-embedded FEL there; see §3.5.1). The ambiguity is **which value `$` denotes** when the outer expression is a constraint and the inner subexpression is a predicate.

---

## Decision

**Treat these as nested lexical scopes that stack:**

- The **outer** `constraint` expression is evaluated in the bind’s evaluation context, where **`$` means the field value** (same as today for scalars).

- When the evaluator enters the **second argument** of `every`, `some`, `countWhere`, `sumWhere`, `avgWhere`, `minWhere`, `maxWhere`, or `moneySumWhere`, it **pushes a scope** where **`$` is the current array element**. References like **`$.amount`** apply postfix to **that element** (including when the element is an object), per §3.5.1 and §3.6.

- After the predicate returns for that element, that inner binding is **popped**; the outer **`$` (field value)** is unchanged for the rest of the constraint.

**No second syntax** is introduced: the same `$` token is resolved by **standard scoping rules** (outer self-reference vs inner rebounding), not by overloading with a different sigil.

Normative sources (do not duplicate behavior here):

- §3.2.1 — `$` as the current node’s own value in constraints.  
- Bind row for `constraint` — `$` bound to the targeted node’s value.  
- §3.5.1 — predicate expressions; `$` rebound per element; object elements and `$.field`.  

---

## Consequences

**Positive**

- Object-valued fields can be validated with idioms such as  
  `every($.lineItems[*], $.quantity > 0)`  
  where the first `$.lineItems` is postfix on the **field value** and the predicate’s `$` / `$.quantity` refer to **each line item object**.

- Implementations already following `fel-core`’s let-scope pattern for predicates remain aligned with this ADR.

**Negative / limits**

- Deeply nested quantifiers stack multiple inner `$` bindings; authors must mentally track “which `$`” by scope. Prefer named field paths where readability suffers.

- This ADR does **not** change Core text; it records the **intended reading** of existing normative sections for cross-doc alignment (e.g. WOS examples).

---

## References

- Formspec Core `specs/core/spec.md`: §3.2.1, §3.5.1 (predicate paragraph), `constraint` bind definition, §3.6 postfix access.  
- Phase 11 plan: `thoughts/plans/2026-04-11-phase11-coprocessor-fel.md` (FEL-RECORDS tail).
