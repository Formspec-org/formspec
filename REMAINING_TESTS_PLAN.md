# Remaining Tests Plan — Formspec v1.0 (Final)

## Current State

- **1,009 tests** across 12 files, all passing in ~15s
- **Layer 1** (Schema validation): 4 files, 210 tests
- **Layer 2** (Spec examples): 1 file, 14 parametrized test classes
- **Layer 3** (Property-based): 1 file, 38 Hypothesis-driven tests (schemas only)
- **Layer 4** (Round-trip serialization): **BLOCKED** on Task 9
- **Layer 5** (Cross-spec contracts): 1 file, 135 tests
- **Layer 6** (FEL reference): 4 files, 294 tests — parser (102), evaluator (76), functions (76), API (40)

## Scope

All test work that can be done NOW without Tasks 9, 11, or 12. Focus:
deepening FEL coverage, filling spec-coverage gaps, property-based FEL tests.

---

## Stage 1: FEL Evaluator — Untested Code Paths

### 1A: Repeat Context Tests (NEW: `tests/test_fel_repeat.py`)

Currently: zero evaluator tests for `prev()`, `next()`, `parent()`, `@current`, `@index`, `@count`.

The public `evaluate()` API doesn't expose `repeat_context`, so these tests
will construct `Evaluator` + `Environment` directly via a shared fixture.

1. **`@current.field` resolves to current row field** — RepeatContext with row `{amount: 100}`, eval `@current.amount` → 100
2. **`@index` returns 1-based index** — index=1 → 1, index=3 → 3
3. **`@count` returns total count** — collection of 5 items → 5
4. **`prev()` returns previous row** — at index 2, `prev().amount` → row 1's amount
5. **`prev()` at first row returns null** — index=1, `prev()` → null, `prev().field` → null
6. **`next()` returns next row** — at index 1, `next().amount` → row 2's amount
7. **`next()` at last row returns null** — index=3 of 3, `next()` → null
8. **`parent()` returns parent context** — set `rc.parent` to FelObject, `parent().total` → value
9. **Cumulative sum pattern** — `prev().cumulative + @current.amount` (§3.5.9 canonical example)
10. **Repeat context + let binding** — `let x = @current.amount in x * 2`
11. **`countWhere` inside repeat uses own `$` binding** — countWhere's `$` ≠ repeat `@current`
12. **`@current` outside repeat → null** — no RepeatContext set
13. **`@index` outside repeat → null** — no RepeatContext set
14. **`@count` outside repeat → null** — no RepeatContext set

Estimated: **14 tests**

### 1B: MIP-State Function Tests (NEW: `tests/test_fel_mip.py`)

Currently: zero evaluation tests for `valid()`, `relevant()`, `readonly()`, `required()`.

**Implementation note:** The current `_make_mip_fn` defaults to `FelTrue if attr == 'valid' else FelFalse` for unknown fields. This means `relevant($unknown)` → `false`, contradicting spec §4.3.2 (fields are relevant by default). Tests should be written against spec-correct behavior; if they fail, fix the implementation.

1. **`valid($field)` true when valid** — MipState(valid=True)
2. **`valid($field)` false when invalid** — MipState(valid=False)
3. **`relevant($field)` true when relevant** — MipState(relevant=True)
4. **`relevant($field)` false when not relevant** — MipState(relevant=False)
5. **`readonly($field)` true/false** — both branches
6. **`required($field)` true/false** — both branches
7. **Unknown field defaults (parametrized)** — `@pytest.mark.parametrize("fn,expected", [("valid", True), ("relevant", True), ("readonly", False), ("required", False)])` — **This will expose the `relevant` default bug; fix impl first**
8. **MIP in compound expression** — `if(not(valid($ein)), "Fix EIN", "")` (§3.5.8 example)
9. **MIP with dotted path** — `valid($address.zip)` with mip_states key `"address.zip"`
10. **Multiple MIP checks** — `valid($a) and valid($b)`
11. **Non-FieldRef argument** — `valid(42)` → diagnostic ("requires a field reference argument")

Estimated: **11 tests** (parametrized test 7 counts as 4)

### 1C: Evaluator Edge Cases (ADDITIONS to `tests/test_fel_evaluator.py`)

1. **Scalar broadcast right (§3.9 rule 3)** — `[1, 2, 3] * 10` → `[10, 20, 30]`
2. **Scalar broadcast left** — `10 * [1, 2, 3]` → `[10, 20, 30]`
3. **Array null elements in element-wise** — `[1, null, 3] + [4, 5, 6]` → `[5, null, 9]`
4. **Element-wise comparison** — `[1, 2, 3] > [0, 2, 4]` → `[true, false, false]`
5. **Element-wise string concat** — `["a", "b"] & ["x", "y"]` → `["ax", "by"]`
6. **Empty array element-wise** — `[] + []` → `[]`
7. **Ternary: untaken branch not evaluated** — `true ? 1 : (1/0)` → 1, no diagnostic
8. **Deeply nested field refs** — `$a.b.c.d.e` with 5 levels of nesting
9. **Multiple null coalesce chain** — `$a ?? $b ?? $c ?? 0` with a/b/c all null → 0
10. **Date comparison** — `@2024-01-15 > @2024-01-01` → true
11. **Boolean equality** — `true = true` → true, `true = false` → false
12. **Membership null propagation** — `"x" in null` → null
13. **Unary minus on null** — `-null` → null
14. **String membership in array** — `"b" in ["a", "b", "c"]` → true
15. **ObjectLiteral evaluation + field access** — `{a: 1, b: 2}.a` → 1
16. **ObjectLiteral nested** — `{x: {y: 3}}.x.y` → 3
17. **PostfixAccess with wildcard** — parse + eval `([{a:1},{a:2}])[*].a` (exercises `_eval_postfix` wildcard branch)
18. **Comment in evaluated expression** — `1 + /* add */ 2` → 3
19. **Line comment in expression** — `1 + 2 // trailing` → 3

Estimated: **19 tests**

---

## Stage 2: FEL Functions — Coverage Gaps

### 2A: Missing Function Tests (ADDITIONS to `tests/test_fel_functions.py`)

**Note:** FEL date literals use `@YYYY-MM-DD` syntax (no `d`, no quotes).

1. **`selected` found** — `selected(["a", "b"], "b")` → true
2. **`selected` not found** — `selected(["a", "b"], "c")` → false
3. **`selected` with numbers** — `selected([1, 2, 3], 2)` → true
4. **`selected` with null array** — `selected(null, "a")` → null (type-guard return, not propagation)
5. **`selected` with null element** — `selected(["a", null, "b"], "a")` → true
6. **`now()` returns FelDate** — non-deterministic, check isinstance only
7. **`isDate` positive** — `isDate(@2024-01-01)` → true
8. **`isDate` negative** — `isDate(42)` → false
9. **`moneySum` basic** — `moneySum([money(10, "USD"), money(20, "USD")])` → money(30, "USD")
10. **`moneySum` empty** — `moneySum([])` → null
11. **`moneySum` currency mismatch** — returns null silently (no diagnostic — verified)
12. **`format` multiple args** — `format("{0} of {1}", 3, 10)` → "3 of 10"
13. **`format` no placeholders** — `format("hello")` → "hello"
14. **`dateDiff` months** — `dateDiff(@2024-03-15, @2024-01-15, "months")` → 2
15. **`dateDiff` negative** — earlier date1 → negative number
16. **`dateAdd` years** — `dateAdd(@2024-01-15, 1, "years")` → `@2025-01-15`
17. **`dateAdd` leap year overflow** — `dateAdd(@2024-02-29, 1, "years")` → `@2025-02-28`
18. **`matches` with anchors** — `matches("abc123", "^[a-z]+\\d+$")` → true
19. **`substring` start beyond length** — `substring("abc", 10)` → `""`
20. **`substring` length 0** — `substring("abc", 1, 0)` → `""`
21. **`replace` no match** — `replace("hello", "xyz", "abc")` → `"hello"`
22. **`trim` tabs/newlines** — `trim("\t hello \n")` → `"hello"`
23. **`power` zero exponent** — `power(5, 0)` → 1
24. **`power` negative exponent** — `power(2, -1)` → 0.5
25. **`floor` negative** — `floor(-1.5)` → -2
26. **`ceil` negative** — `ceil(-1.5)` → -1
27. **Cast `number` invalid string** — `number("abc")` → null
28. **Cast `date` invalid string** — `date("not-a-date")` → null
29. **Cast `boolean` from strings** — `boolean("true")` → true, `boolean("false")` → false, `boolean("")` → false
30. **`string` of 0.001** — regression guard for `_number_to_str` Decimal formatting
31. **`string` of 10000000** — regression guard, no scientific notation

Estimated: **31 tests** (test 29 = 3 sub-assertions in one test)

---

## Stage 3: FEL Property-Based Tests (NEW: `tests/test_fel_property_based.py`)

Hypothesis-driven tests for FEL invariants. Use `@settings(max_examples=50)` for expensive tests to keep total runtime under control.

**Strategies:** Generate `FelNumber` (Decimal, range ±10^6), `FelString` (ASCII printable, max 20 chars — ASCII-only avoids Unicode casing length changes), `FelBoolean`, `FelNull`, `FelArray` of numbers.

1. **Parser crash fuzzing** — Generate random token sequences from a grammar, parse, verify no unhandled exception (may raise FelSyntaxError — that's fine)
2. **Null propagation invariant** — For arithmetic ops (+, -, *, /), if either operand is null, result is null
3. **Commutativity of equality** — `(a = b)` ↔ `(b = a)` for same-type values
4. **Double negation** — `not(not(x))` = `x` for all boolean x
5. **Null coalesce identity** — `x ?? x` = `x` for all non-null x
6. **`sum` of single-element array** — `sum([x])` = `x` for number x
7. **`empty` / `present` duality** — `empty(x)` = `not(present(x))` for all x (including FelObject, FelMoney)
8. **Round-trip number cast** — `number(string(x))` = `x` for integers in range ±10^6
9. **`abs` non-negative** — `abs(x) >= 0` for all numbers x
10. **Aggregate identity: `count([x])` = 1** — for any non-null x
11. **`min`/`max` of single-element** — `min([x])` = `max([x])` = `x`
12. **`from_python` / `to_python` round-trip** — for int, float, str, bool, None, list, dict

**Removed from draft:** `count(arr) = countWhere(arr, true)` — false for arrays with nulls (count skips nulls, countWhere counts all). `length(upper(s))` — false for ß→SS and other Unicode expansions. `length(arr1 + arr2)` — `length()` is string-only, doesn't work on arrays.

Estimated: **12 Hypothesis tests**

---

## Stage 4: Spec-Example Exhaustiveness

### 4A: FEL Spec Examples (ADDITIONS to `tests/test_fel_api.py`)

Audit every example in §3 and test each. Skip duplicates of existing tests.

1. **§3.2.2 wildcard extraction** — `$lineItems[*].amount` → FelArray of amounts (already partially tested; add explicit data-driven version)
2. **§3.2.3 cross-instance** — `@instance('orgProfile').ein` with instances dict → string value
3. **§3.3 precedence: mul-before-add evaluated** — `2 + 3 * 4` → 14 (existing parser test; add evaluator version)
4. **§3.5.1 line-item total** — `sum($lineItems[*].quantity * $lineItems[*].unitPrice)` with 3-row data → 62.50 (**already tested in test_line_item_sum; skip — use a differently-shaped dataset instead**)
5. **§3.5.5 selected example** — `selected($colors, "red")` with data
6. **§3.5.8 MIP example** — covered by Stage 1B.8
7. **§3.5.9 cumulative total** — covered by Stage 1A.9
8. **§3.8.1 null propagation examples** — `null + 5` → null, `'hello' & null` → null, `null < 5` → null (partially tested; ensure all 3 exact spec examples are present)
9. **§3.8.3 missing field → null** — `$nonexistent` → null
10. **§3.9 broadcast example** — `$lineItems[*].amount * $taxRate` with scalar → element-wise result
11. **§3.10.2 eval errors** — division by zero, type mismatch (partially tested; verify diagnostic messages)
12. **§3.12 extension function** — `x:customFunc(1)` registered and called (partially tested in test_extension_function_called)

Estimated: **10 tests** (after dedup)

---

## Stage 5: Cross-Spec Contracts

### 5A: FEL ↔ Spec Contracts (ADDITIONS to `tests/test_cross_spec_contracts.py`)

1. **All FEL expressions in §7 examples parse** — extract `calculate`, `constraint`, `relevant`, `required`, `readonly` from all §7 definition JSON blocks, parse each
2. **All shape `expression` values in §7 parse** — extract from shape objects
3. **§7.3 dependency graph is acyclic** — extract deps from all expressions, build graph, verify DAG
4. **Reserved words match parser** — extract §3.11 list from spec.md, compare to `parser.RESERVED_WORDS`
5. **Built-in functions match spec** — extract function names from §3.5 tables, compare to `build_default_registry()` keys (use robust regex: `\| \`(\w+)\``)
6. **Type names from `typeOf` match §3.4** — evaluate `typeOf` for each FEL type, verify output ∈ {"string", "number", "boolean", "date", "null", "array", "money", "object"}

Estimated: **6 tests**

---

## Stage 6: Error Paths and Diagnostics

### 6A: Parser Error Tests (ADDITIONS to `tests/test_fel_parser.py`)

1. **Unmatched parenthesis** — `(1 + 2` → FelSyntaxError
2. **Unmatched bracket** — `[1, 2` → FelSyntaxError
3. **Trailing garbage** — `1 + 2 xyz` → FelSyntaxError
4. **Empty function args with comma** — `foo(,)` → FelSyntaxError
5. **Object literal missing colon** — `{a 1}` → FelSyntaxError
6. **Object literal missing value** — `{a:}` → FelSyntaxError
7. **Unterminated block comment** — `1 + /* oops` → FelSyntaxError (already have parser test; verify message)

Estimated: **7 tests**

### 6B: Evaluator Error Tests (ADDITIONS to `tests/test_fel_evaluator.py`)

1. **Unknown function** — `nonexistent(1)` → null + diagnostic
2. **Wrong arity** — `length("a", "b")` → error
3. **countWhere non-array** — `countWhere(42, $ > 0)` → null + diagnostic
4. **countWhere non-boolean predicate** — `countWhere([1,2], $ + 1)` → 0 (silently skips non-boolean; **not** a type error)
5. **Division by zero diagnostic content** — verify "division by zero" in message
6. **`avg([])` diagnostic content** — verify message
7. **`moneyAdd` mismatch returns null silently** — no diagnostic (verified; test documents this)
8. **`moneySum` mismatch returns null silently** — no diagnostic (verified; test documents this)

Estimated: **8 tests**

---

## Stage 7: Integration / End-to-End Smoke Tests (NEW: `tests/test_fel_integration.py`)

Full pipeline tests simulating realistic form-evaluation scenarios.

**Note:** FEL evaluator has no built-in dependency pipeline. These tests call `evaluate()` multiple times in explicit dependency order, which is the intended use pattern.

1. **Tax form calculation** — 5 fields (wages, interest, total_income=wages+interest, deduction, taxable=total-deduction), evaluate in order, verify final
2. **Conditional visibility** — `relevant` expression: `$type = "business"`, eval with type="business" → true, type="personal" → false
3. **Required validation** — `$amount > 10000` → field required
4. **Repeated section totals** — 3 line items, per-row `quantity * unitPrice`, `sum` over all → grand total
5. **Cross-instance lookup** — main form + orgProfile instance, `@instance('orgProfile').ein`
6. **Validation constraint** — `$endDate > $startDate`, eval with both valid and invalid data
7. **Multi-step dependency chain** — A=10, B=A*2, C=B+5, D=C/3, evaluate in order, verify D
8. **Year-over-year comparison** — `abs($currentYear - $priorYear) / $priorYear > 0.25` → warning
9. **Money workflow** — invoice: line items → moneySum subtotal → calculate tax → moneyAdd total
10. **Nested conditional** — `if(empty($ein), "Required", if(not(matches($ein, "^\\d{2}-\\d{7}$")), "Invalid", ""))`
11. **Diagnostic isolation** — evaluate 3 expressions; middle one has type error; verify first and third return correct values, middle returns null+diagnostic, diagnostics don't leak between calls
12. **`@source`/`@target` context resolution** — mapping DSL refs: `@source.name`, `@target.field` with appropriate data

Estimated: **12 tests**

---

## Stage 8: Dependency Extraction Edge Cases (ADDITIONS to `tests/test_fel_api.py`)

The `dependencies.py` module (114 lines) has logic worth targeted testing.

1. **Bare `$` excluded from fields** — `$ > 10` → no field deps, `$` in wildcards or special
2. **countWhere predicate: `$` excluded, other fields included** — `countWhere($items[*].x, $ > $threshold)` → fields={"items", "threshold"}, `$` not in fields
3. **PostfixAccess deps** — `prev().cumulative` → deps include prev_next flag, no field deps
4. **Let binding name excluded** — `let x = $a in x + $b` → fields={"a", "b"}, not "x"
5. **ObjectLiteral deps** — `{a: $x, b: $y}.a` → fields={"x", "y"}

Estimated: **5 tests**

---

## Summary

| Stage | File(s) | New Tests | Focus |
|-------|---------|-----------|-------|
| 1A | test_fel_repeat.py (new) | 14 | Repeat context evaluation |
| 1B | test_fel_mip.py (new) | 11 | MIP-state functions |
| 1C | test_fel_evaluator.py | 19 | Evaluator edge cases (incl. object literal, wildcard postfix, comments) |
| 2A | test_fel_functions.py | 31 | Function coverage gaps |
| 3A | test_fel_property_based.py (new) | 12 | FEL Hypothesis tests |
| 4A | test_fel_api.py | 10 | Spec example exhaustiveness |
| 5A | test_cross_spec_contracts.py | 6 | FEL ↔ spec contracts |
| 6A | test_fel_parser.py | 7 | Parser error paths |
| 6B | test_fel_evaluator.py | 8 | Evaluator error paths |
| 7 | test_fel_integration.py (new) | 12 | End-to-end smoke tests |
| 8 | test_fel_api.py | 5 | Dependency extraction edges |
| **Total** | | **135** | |

**Expected final count:** 1,009 + 135 = **~1,144 tests**

### Implementation Order

1. **Fix `relevant()` default bug** — change `_make_mip_fn` default from `FelTrue if attr == 'valid' else FelFalse` to spec-correct defaults: `valid`→true, `relevant`→true, `readonly`→false, `required`→false
2. **Stage 1A + 1B** (new files) — repeat + MIP tests
3. **Stage 1C + 2A** (additions to existing files) — evaluator + function gaps
4. **Stage 3A** (new file) — property-based FEL tests
5. **Stage 4A + 5A + 8** (spec coverage) — examples + contracts + deps
6. **Stage 6A + 6B** (error paths) — hardening
7. **Stage 7** (new file) — integration tests

### Key Decisions from Review

1. **Date literal syntax:** `@YYYY-MM-DD` (no `d`, no quotes) — verified against parser
2. **`relevant()` unknown field:** Spec says default true; impl returns false → **bug to fix before tests**
3. **`moneyAdd`/`moneySum` mismatch:** Returns null silently (no diagnostic) — tests document this as-is
4. **`countWhere` non-boolean predicate:** Silently skips (returns 0) — not a type error
5. **`length()` is string-only:** No array-length function; use `count()` for arrays
6. **Unicode casing length changes:** Property tests use ASCII-only strategies to avoid `ß→SS` etc.
7. **Repeat context setup:** Tests use internal `Evaluator` + `Environment` directly (public API doesn't expose `repeat_context`)
8. **Hypothesis settings:** `max_examples=50` for parser fuzzing; 100 for algebraic invariants

### Non-Goals

- **Layer 4 round-trip tests:** Blocked on Task 9.
- **Performance benchmarks:** Not appropriate for spec reference implementation.
- **Tasks 11/12 tests:** Planned when those specs are written.
- **Mutation testing:** Valuable but out of scope.
- **Nested repeat stacking:** Implementation has single `repeat_context` field, not a stack. Testing `parent()` uses the `parent` field on `RepeatContext`, which is sufficient for now.
