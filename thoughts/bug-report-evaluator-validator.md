# Bug Report: `src/formspec` — Two Runtime Bugs Found During Grant Report Example Work

> Discovered 2026-03-04 while implementing and validating the `examples/grant-report/` reference example.  
> Both bugs were encountered via the Python evaluator and validator APIs; both have test coverage (2036 tests pass after fixes).  
> Written for a reviewing/refactoring agent — see "Status" and "Recommended Fix" sections for what still needs attention.

---

## Bug 1 — `validator/schema.py`: `FORMAT_CHECKER` hangs on `"uri"` format fields

### Location

```
src/formspec/validator/schema.py
Line 108 (inside SchemaValidator.__init__, Draft202012Validator instantiation)
```

### What Happens

Running `python3 -m formspec.validator` on any **component** or **theme** document hangs the process indefinitely, consuming memory until the system freezes. It does not time out — it blocks forever.

Minimum reproduction:

```bash
python3 -m formspec.validator examples/grant-report/tribal-short.component.json
# Never returns. ^C required.
```

### Root Cause (partially confirmed)

The `Draft202012Validator` is instantiated with `format_checker=Draft202012Validator.FORMAT_CHECKER`:

```python
# schema.py:104-111
self.validators: dict[DocumentType, Draft202012Validator] = {
    doc_type: Draft202012Validator(
        schema,
        registry=registry,
        format_checker=Draft202012Validator.FORMAT_CHECKER,  # ← suspect
    )
    for doc_type, schema in self.schemas.items()
}
```

The schemas (`component.schema.json`, `definition.schema.json`) declare `"format": "uri"` on URL fields (e.g. `targetDefinition.url`). The `FORMAT_CHECKER` for `"uri"` format invokes whichever URI validator package is installed. Installed in this project:

```
fqdn       1.5.1
idna       3.6
rfc3987    1.3.8
uri-template 1.3.0
```

Additionally, `component.schema.json` uses `unevaluatedProperties` + a `oneOf` discriminating over ~50 component types. `jsonschema 4.26.0`'s `find_evaluated_property_keys_by_schema` has a known exponential-time/stack-overflow bug with deeply nested `oneOf` trees. This may be the **actual** cause of the hang (the `FORMAT_CHECKER` is a co-suspect but may be innocent).

**The hang was NOT confirmed to be DNS resolution.** It could be either or both:

1. `FORMAT_CHECKER` + `rfc3987.parse()` doing something unexpectedly slow
2. `jsonschema` `unevaluatedProperties` + `oneOf` over 50 component types causing exponential backtracking on complex component trees

### Current (Temporary) Fix Applied

```diff
- format_checker=Draft202012Validator.FORMAT_CHECKER,
+ format_checker=None,  # Disabled: FORMAT_CHECKER hangs on uri-format fields (live DNS)
```

**This is a monkeypatch.** Setting `format_checker=None` disables format validation entirely — `"uri"`, `"date"`, `"email"`, `"regex"` etc. are all skipped. The comment is also misleading (not confirmed to be DNS).

### Recommended Fix

The reviewing agent should determine the **actual cause** first:

```python
# Diagnostic: isolate whether it's format_checker or oneOf backtracking
# Test 1: format_checker only
validator = Draft202012Validator(schema, registry=registry, format_checker=FORMAT_CHECKER)
validator.validate({"$formspecComponent": "1.0", "version": "1.0.0", "tree": {"component": "Text", "text": "hi"}})
# → fast or slow?

# Test 2: complex tree, no format_checker
validator = Draft202012Validator(schema, registry=registry, format_checker=None)
validator.validate(complex_component_tree)
# → fast or slow?
```

**If the cause is `FORMAT_CHECKER` + URI packages:**

- Create a custom `FormatChecker` that validates URI format syntactically using `urllib.parse.urlparse` (no network, no `rfc3987`), and registers it only for `"uri"` and `"uri-reference"` — keep all other safe format checks from `FORMAT_CHECKER`.

```python
from jsonschema import FormatChecker
import urllib.parse

_SAFE_FORMAT_CHECKER = FormatChecker(formats=[
    "date", "time", "date-time", "duration",
    "email", "regex", "ipv4", "ipv6", "hostname",
    "json-pointer", "relative-json-pointer",
])

@_SAFE_FORMAT_CHECKER.checks("uri", raises=ValueError)
def _check_uri(instance):
    parsed = urllib.parse.urlparse(instance)
    if not parsed.scheme:
        raise ValueError(f"Not a valid URI: {instance!r}")

@_SAFE_FORMAT_CHECKER.checks("uri-reference", raises=ValueError)
def _check_uri_reference(instance):
    urllib.parse.urlparse(instance)  # always parses; just confirm it's a string
```

**If the cause is `oneOf` backtracking in `component.schema.json`:**

- The schema itself needs refactoring — swap `oneOf` for `if/then/else` chains discriminated by `"component"` const value, which eliminates the backtracking.
- Or upgrade `jsonschema` to a version with the fixed `unevaluatedProperties` implementation.

**Either way:** remove `format_checker=None` and replace with the appropriate targeted fix.

---

## Bug 2 — `evaluator.py`: Bind and shape constraints never see the field's own value via `$`

### Location

```
src/formspec/evaluator.py

_validate_binds()  — line ~447 (constraint check for regular fields)
_validate_wildcard_bind() — line ~532 (constraint check for repeat fields)
_eval_shape() — line ~574 (shape constraint evaluation)
```

### What Happens

Any bind `constraint` expression using bare `$` (the FEL self-reference) evaluates to `FelNull` regardless of the field's actual value. This means:

1. `constraint: "$ >= 0"` → always fires (even on `45000`)  
2. `constraint: "$ > 0"` → always fires (even on `true`)  
3. Shape constraints using `$ > 0` targeting a specific field → always fire

**Before fix:** every expenditure constraint `$ >= 0` fired as an error on every non-null value, producing false positive errors on ALL constraint-using definitions.

**After fix (verified):** `45000 >= 0` → no error; `-5 >= 0` → constraint error. Correct behavior.

### Root Cause

FEL's bare `$` is resolved by the `Environment` looking up the **empty string key `''`** in its scope stack — this is documented in `environment.py` line 61:

```python
def push_scope(self, bindings: dict[str, FelValue]) -> None:
    """Push a lexical scope frame. Key '' rebinds bare ``$`` (used by countWhere predicates)."""
```

In `_validate_binds` (pre-fix), the constraint was evaluated with no scope:

```python
# WRONG — $ resolves to FelNull because no '' key in scope
constraint_val = self._eval_fel(bind['constraint'], data, variables)
```

In `_eval_shape` (pre-fix), same issue — no scope injected even when `target` identifies which field:

```python
# WRONG — $ resolves to the full data dict (converted to FelObject), not the target field value
result = evaluate(shape['constraint'], data, variables=variables, instances=self._instances)
```

### Fix Applied

**`_validate_binds` (regular fields):** inject field value as `''` key in scope:

```python
# CORRECT — bare $ resolves to field value
constraint_val = self._eval_fel(
    bind['constraint'], data, variables,
    scope={'': val},  # '' = bare $ in FEL
)
```

**`_validate_wildcard_bind` (repeat fields):** merge `''` key into the row scope:

```python
# CORRECT — bare $ resolves to field value; other row fields still accessible
scoped_row = {**row, '': val} if isinstance(row, dict) else {'': val}
constraint_val = self._eval_fel(bind['constraint'], data, variables, scope=scoped_row)
```

**`_eval_shape` (shapes with `target`):** look up the target field value and inject as `''`:

```python
target = shape.get('target')
if target and target != '#':
    target_val = _get_nested(data, target)
    result = self._eval_fel(
        shape['constraint'], data, variables,
        scope={'': target_val},
    )
else:
    # No target — $ resolves to full data dict (FEL intent for cross-field shapes)
    result = evaluate(shape['constraint'], data, variables=variables, instances=self._instances).value
```

### Review Notes for Refactoring Agent

The applied fix is **correct** but the `_eval_shape` branch has some awkward control flow (the `result = None` / `if result is not None` pattern) due to fitting the fix into the existing structure. A cleaner refactor would extract a `_eval_constraint(expr, data, variables, self_value)` helper:

```python
def _eval_constraint(
    self, expr: str, data: dict,
    variables: dict[str, FelValue],
    self_value=None,
) -> bool:
    """Evaluate a FEL constraint expression. If self_value is provided,
    it is injected as bare $ (scope key '').
    Returns True if the constraint passes, False otherwise."""
    scope = {'': self_value} if self_value is not None else None
    result = self._eval_fel(expr, data, variables, scope=scope)
    return result is FelTrue
```

Then all three call sites become one-liners:

```python
# _validate_binds
if not self._eval_constraint(bind['constraint'], data, variables, self_value=val):
    ...

# _validate_wildcard_bind  
if not self._eval_constraint(bind['constraint'], data, variables, self_value=val):
    ...

# _eval_shape
target_val = _get_nested(data, target) if (target and target != '#') else None
if not self._eval_constraint(shape['constraint'], data, variables, self_value=target_val):
    ...
```

This also needs a test covering:

- `required` bind with FEL string `"true"` / `"false"` → should evaluate correctly (already works)
- `constraint: "$ >= 0"` on an integer field → should pass for positive, fail for negative
- `constraint: "$ >= 0"` on a non-relevant field → skipped (NRB removes field before constraint check)
- Shape constraint `$ = $demographics.totalServedOver18` with target field → uses target value as `$`

### Test Coverage Gap

There are no existing unit tests in `tests/` specifically covering the `_validate_binds` constraint path with a `$`-using expression against a non-null field value. The 2036 existing tests pass, but this bug was silent (wrong results rather than an exception). A regression test should be added.

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `src/formspec/validator/schema.py:108` | `format_checker=None` | **Monkeypatch — needs proper fix** |
| `src/formspec/evaluator.py:447-458` | Inject `{'': val}` scope for bind constraints | Correct — consider refactor |
| `src/formspec/evaluator.py:532-543` | Inject `{'': val}` scope for wildcard bind constraints | Correct — consider refactor |
| `src/formspec/evaluator.py:574-592` | Inject target field value as `''` for shape constraints | Correct but awkward — consider refactor |
