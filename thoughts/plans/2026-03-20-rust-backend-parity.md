# Rust Backend Parity — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Complete — all 4 waves executed (commits a7a948a, acc896f, 30abe74, b493707). 28 → 4 skips achieved.
**Goal:** Close all 24 actionable gaps between the Rust backend and the Python test suite (28 → 4 skips).

**Architecture:** Four waves of changes across 5 Rust crates. Each wave is independently testable. Wave 1 adds lint flags and quick eval fixes. Wave 2 adds medium eval features (timing, screener, shapes). Wave 3 adds JSON Schema validation. Wave 4 adds wildcard expansion and scoped variables.

**Tech Stack:** Rust (formspec-eval, formspec-lint, fel-core, formspec-core, formspec-py), Python (src/formspec/_rust.py, tests/), PyO3, jsonschema-rs

**Spec:** `thoughts/specs/2026-03-20-rust-backend-parity.md`

**Build/test cycle:** After each task's Rust changes, run `cargo test -p <crate> --no-default-features` to verify Rust tests, then `pip install --no-build-isolation ./crates/formspec-py` to reinstall the Python module, then `python3 -m pytest <test_file> -v` for the specific Python tests.

---

## Wave 1 — Lint Flags + Quick Eval Fixes

### Task 1: Add `schema_only` and `no_fel` lint flags

**Files:**
- Modify: `crates/formspec-lint/src/types.rs` — add fields to `LintOptions`
- Modify: `crates/formspec-lint/src/lib.rs` — honor flags in `lint_with_options()`
- Modify: `crates/formspec-py/src/lib.rs` — add params to `lint_document`
- Modify: `src/formspec/_rust.py` — forward params
- Modify: `tests/unit/test_validator_linter.py` — unskip 2 tests

- [ ] **Step 1: Add fields to LintOptions**

In `crates/formspec-lint/src/types.rs`, add to the `LintOptions` struct (after `definition_document`):

```rust
/// When true, run only document type detection + schema validation, skip semantic passes.
pub schema_only: bool,
/// When true, skip pass 4 (FEL compilation) and pass 5 (dependency analysis).
pub no_fel: bool,
```

- [ ] **Step 2: Honor flags in lint pipeline**

In `crates/formspec-lint/src/lib.rs`, in `lint_with_options()`:

After pass 1 (document type detection), add:
```rust
if options.schema_only {
    sort_diagnostics(&mut diagnostics);
    diagnostics.retain(|d| !d.suppressed_in(options.mode));
    let valid = diagnostics.iter().all(|d| d.severity != LintSeverity::Error);
    return LintResult { document_type: Some(doc_type), diagnostics, valid };
}
```

Gate passes 4 and 5 (inside the `if doc_type == DocumentType::Definition` block) with:
```rust
if !options.no_fel {
    // Pass 4: Expression compilation (E400)
    let compilation = expressions::compile_expressions(doc);
    diagnostics.extend(compilation.diagnostics);

    // Pass 5: Dependency cycle detection (E500)
    diagnostics.extend(dependencies::analyze_dependencies(&compilation.compiled));
}
```

- [ ] **Step 3: Add PyO3 params**

In `crates/formspec-py/src/lib.rs`, update `lint_document` signature to add `schema_only` and `no_fel`:

```rust
#[pyfunction(signature = (document, mode=None, registry_documents=None, definition_document=None, schema_only=None, no_fel=None))]
fn lint_document(
    py: Python,
    document: &Bound<'_, PyAny>,
    mode: Option<&str>,
    registry_documents: Option<&Bound<'_, PyList>>,
    definition_document: Option<&Bound<'_, PyAny>>,
    schema_only: Option<bool>,
    no_fel: Option<bool>,
) -> PyResult<PyObject> {
```

In the `LintOptions` construction, add:
```rust
schema_only: schema_only.unwrap_or(false),
no_fel: no_fel.unwrap_or(false),
```

- [ ] **Step 4: Forward from Python**

In `src/formspec/_rust.py`, update the `lint()` function to forward `schema_only` and `no_fel`:

Replace the `schema_only`/`no_fel` warning block with direct passthrough:
```python
raw = formspec_rust.lint_document(
    document,
    mode=None,
    registry_documents=registry_documents,
    definition_document=component_definition,
    schema_only=schema_only,
    no_fel=no_fel,
)
```

- [ ] **Step 5: Unskip tests and verify**

In `tests/unit/test_validator_linter.py`, remove `@pytest.mark.skip` from `test_schema_only_skips_semantic_passes` and `test_no_fel_skips_expression_pass`. Run:

```bash
cargo build -p formspec-py --no-default-features 2>&1 | tail -5
pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_validator_linter.py::test_schema_only_skips_semantic_passes tests/unit/test_validator_linter.py::test_no_fel_skips_expression_pass -v
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add crates/formspec-lint/src/types.rs crates/formspec-lint/src/lib.rs crates/formspec-py/src/lib.rs src/formspec/_rust.py tests/unit/test_validator_linter.py
git commit -m "feat(lint): add schema_only and no_fel flags to LintOptions"
```

---

### Task 2: Add `strict` mode escalation

**Files:**
- Modify: `crates/formspec-lint/src/types.rs` — add `LintMode::Strict`
- Modify: `crates/formspec-lint/src/lib.rs` — escalate codes in strict mode
- Modify: `crates/formspec-py/src/lib.rs` — map `"strict"` string
- Modify: `tests/unit/test_validator_linter.py` — unskip 1 test

- [ ] **Step 1: Add Strict variant**

In `crates/formspec-lint/src/types.rs`, add to the `LintMode` enum:

```rust
/// Strict mode — escalates W800/W802/W803/W804 from warning to error. Used for CI.
Strict,
```

Update `suppressed_in` to handle `Strict` (same as `Runtime` — nothing suppressed):
```rust
LintMode::Strict => false,
```

- [ ] **Step 2: Add escalation in lint pipeline**

In `crates/formspec-lint/src/lib.rs`, in `lint_with_options()`, after `sort_diagnostics(&mut diagnostics)` and before `diagnostics.retain(...)`:

```rust
if options.mode == LintMode::Strict {
    for d in &mut diagnostics {
        if matches!(d.code.as_str(), "W800" | "W802" | "W803" | "W804") {
            d.severity = LintSeverity::Error;
        }
    }
}
```

- [ ] **Step 3: Map string in PyO3**

In `crates/formspec-py/src/lib.rs`, in the mode-parsing section of `lint_document`:

```rust
let lint_mode = match mode {
    Some("authoring") => LintMode::Authoring,
    Some("strict") => LintMode::Strict,
    _ => LintMode::Runtime,
};
```

- [ ] **Step 4: Unskip test and verify**

Remove `@pytest.mark.skip` from `test_component_compatibility_warning_escalates_in_strict_mode` in `tests/unit/test_validator_linter.py`. The test will need updating to call `lint(doc, mode="strict")` — check the test body and adapt if needed.

```bash
cargo build -p formspec-py --no-default-features && pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_validator_linter.py::test_component_compatibility_warning_escalates_in_strict_mode -v
```

- [ ] **Step 5: Commit**

```bash
git add crates/formspec-lint/src/types.rs crates/formspec-lint/src/lib.rs crates/formspec-py/src/lib.rs tests/unit/test_validator_linter.py
git commit -m "feat(lint): add LintMode::Strict with W800/W802/W803/W804 escalation"
```

---

### Task 3: E600 no-registry behavior

**Files:**
- Modify: `crates/formspec-lint/src/extensions.rs` — remove early return
- Modify: `tests/unit/test_validator_linter.py` — unskip 2 tests

- [ ] **Step 1: Remove early return when no registries**

In `crates/formspec-lint/src/extensions.rs`, at line 170, the function currently does:
```rust
if registry_documents.is_empty() {
    return vec![];
}
```

Replace with logic that emits E600 for every enabled extension when no registries are loaded:
```rust
if registry_documents.is_empty() {
    // No registries → every enabled extension is unresolvable
    return collect_all_enabled_extensions(document)
        .into_iter()
        .map(|(path, name)| {
            LintDiagnostic::error(
                "E600",
                3,
                &path,
                format!("Extension '{name}' cannot be resolved — no registry documents provided"),
            )
        })
        .collect();
}
```

Add the helper function `collect_all_enabled_extensions` that walks items and collects `(path, extension_name)` for each enabled extension (value is truthy, not `false`).

- [ ] **Step 2: Update Rust tests**

Any existing Rust tests in `extensions.rs` that assert "no registries → no E600" need updating. The test `no_registries_skips_extension_pass` in `crates/formspec-lint/src/lib.rs` (line 454) will now fail — update it to expect E600 diagnostics.

- [ ] **Step 3: Unskip Python tests**

In `tests/unit/test_validator_linter.py`, remove `@pytest.mark.skip` from `test_unresolved_extension_emits_E600` and `test_unresolved_extension_names_extension_in_message`. These tests should pass since they test the no-registry E600 behavior.

```bash
cargo test -p formspec-lint --no-default-features 2>&1 | tail -5
pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_validator_linter.py -k "E600" -v
```

- [ ] **Step 4: Commit**

```bash
git add crates/formspec-lint/src/extensions.rs crates/formspec-lint/src/lib.rs tests/unit/test_validator_linter.py
git commit -m "fix(lint): fire E600 when extensions declared but no registry loaded"
```

---

### Task 4: W705 dotted nested path resolution

**Files:**
- Modify: `crates/formspec-lint/src/pass_theme.rs` — build full dotted paths
- Modify: `tests/unit/test_validator_theme_semantics.py` — unskip 1 test

- [ ] **Step 1: Build full dotted paths in theme linter**

In `crates/formspec-lint/src/pass_theme.rs`, find where item keys are collected for W705 validation. Currently it only collects top-level keys. Add a recursive function that builds full dotted paths:

```rust
fn collect_item_paths(items: &[Value], prefix: &str, paths: &mut HashSet<String>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|k| k.as_str()) {
            let full = if prefix.is_empty() { key.to_string() } else { format!("{prefix}.{key}") };
            paths.insert(full.clone());
            // Also insert bare key for top-level matching
            paths.insert(key.to_string());
            if let Some(children) = item.get("children").and_then(|c| c.as_array()) {
                collect_item_paths(children, &full, paths);
            }
        }
    }
}
```

Use this function where the definition's item keys are collected for W705 checking.

- [ ] **Step 2: Unskip test and verify**

Remove `@pytest.mark.skip` from `test_w705_clean_for_valid_items_key` in `tests/unit/test_validator_theme_semantics.py`.

```bash
cargo build -p formspec-py --no-default-features && pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_validator_theme_semantics.py -v
```

- [ ] **Step 3: Commit**

```bash
git add crates/formspec-lint/src/pass_theme.rs tests/unit/test_validator_theme_semantics.py
git commit -m "fix(lint): W705 resolves dotted nested item paths"
```

---

### Task 5: Non-relevant shape suppression + circular variable detection

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — shape relevance check + circular dep error
- Modify: `tests/unit/test_definition_evaluator.py` — unskip 2 tests

- [ ] **Step 1: Add relevance check in `validate_shape`**

In `crates/formspec-eval/src/lib.rs`, in the `validate_shape` function (~line 723), after resolving the target path, add:

```rust
let target_path = shape.get("target").and_then(|v| v.as_str()).unwrap_or("#");
// §5.6 rule 1: non-relevant targets must not produce ValidationResults
if target_path != "#" {
    if let Some(item) = find_item_by_path(items, target_path) {
        if !item.relevant {
            return;
        }
    }
}
```

Thread `items: &[ItemInfo]` into `validate_shape` from `revalidate`. Update the `validate_shape` signature and all call sites.

- [ ] **Step 2: Surface circular variable dep errors**

In `evaluate_definition` (~line 999), find where `topo_sort_variables` is called. If it returns `Err(msg)`, instead of silently continuing, push a `ValidationResult`:

```rust
match topo_sort_variables(&var_defs) {
    Ok(order) => { /* existing logic */ }
    Err(cycle_msg) => {
        validations.push(ValidationResult {
            path: String::new(),
            severity: "error".to_string(),
            kind: "definition".to_string(),
            message: cycle_msg,
        });
    }
}
```

- [ ] **Step 3: Unskip tests and verify**

In `tests/unit/test_definition_evaluator.py`:
- Remove `@pytest.mark.skip` from `test_shape_target_nonrelevant_field_emits_no_result`
- Remove `@pytest.mark.skip` from `test_circular_dependency_raises`

Check the test bodies — `test_circular_dependency_raises` may need adapting since the Rust evaluator now emits a ValidationResult with `kind: "definition"` instead of raising an exception. Update the assertion accordingly.

```bash
cargo test -p formspec-eval --no-default-features 2>&1 | tail -5
pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_definition_evaluator.py::TestNonRelevantBehavior::test_shape_target_nonrelevant_field_emits_no_result tests/unit/test_definition_evaluator.py::TestEvaluateVariables::test_circular_dependency_raises -v
```

- [ ] **Step 4: Commit**

```bash
git add crates/formspec-eval/src/lib.rs tests/unit/test_definition_evaluator.py
git commit -m "fix(eval): suppress shapes for non-relevant targets, surface circular dep errors"
```

---

### Task 6: Wave 1 verification

- [ ] **Step 1: Run full suite**

```bash
python3 -m pytest tests/ --ignore=tests/e2e/playwright --ignore=tests/e2e/api -q 2>&1 | tail -5
```

Expected: ~7 fewer skips than baseline (28 → ~21).

- [ ] **Step 2: Commit any fixups**

---

## Wave 2 — Medium Eval Features

### Task 7: Shape timing modes (`EvalTrigger`)

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — add `EvalTrigger` enum, timing filter
- Modify: `crates/formspec-py/src/lib.rs` — add `mode` param to `evaluate_def`
- Modify: `src/formspec/_rust.py` — forward `mode`
- Modify: `tests/unit/test_definition_evaluator.py` — unskip 3 tests, write test bodies

- [ ] **Step 1: Add `EvalTrigger` enum and update `evaluate_definition`**

In `crates/formspec-eval/src/lib.rs`, add before `evaluate_definition`:

```rust
/// Evaluation trigger context — determines which shapes fire.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvalTrigger {
    /// Fire only continuous-timing shapes (default).
    Continuous,
    /// Fire continuous + submit-timing shapes.
    Submit,
    /// Fire no shapes.
    Disabled,
}
```

Add `pub fn evaluate_definition_with_trigger(definition: &Value, data: &HashMap<String, Value>, trigger: EvalTrigger) -> EvaluationResult` that contains the current `evaluate_definition` body. Change the existing `evaluate_definition` to delegate with `EvalTrigger::Continuous`.

Pass `trigger` into `revalidate`.

- [ ] **Step 2: Filter shapes by timing in `revalidate`**

In `revalidate`, before calling `validate_shape` for each shape, add:

```rust
let timing = shape.get("timing").and_then(|v| v.as_str()).unwrap_or("continuous");
match trigger {
    EvalTrigger::Disabled => continue,
    EvalTrigger::Continuous => if timing != "continuous" { continue; },
    EvalTrigger::Submit => if timing == "demand" { continue; },
}
```

- [ ] **Step 3: Add PyO3 `mode` param**

In `crates/formspec-py/src/lib.rs`, add `mode: Option<&str>` to `evaluate_def`. Map:
- `"submit"` → `EvalTrigger::Submit`
- `"disabled"` → `EvalTrigger::Disabled`
- `_` → `EvalTrigger::Continuous`

Call `evaluate_definition_with_trigger` instead of `evaluate_definition`.

- [ ] **Step 4: Forward from Python**

In `src/formspec/_rust.py`, add `mode: str = "continuous"` param to `evaluate_definition`. Pass to `formspec_rust.evaluate_def(definition, data, mode)`.

- [ ] **Step 5: Unskip and write tests**

In `tests/unit/test_definition_evaluator.py`, remove `@pytest.mark.skip` from the 3 `TestShapeTiming` tests. Write test bodies:

```python
def test_submit_shape_skipped_in_continuous(self):
    defn = {
        "$formspec": "1.0", "url": "test://timing", "version": "1.0.0",
        "items": [{"key": "x", "type": "field", "dataType": "string"}],
        "shapes": [{"id": "s1", "target": "x", "timing": "submit",
                     "constraint": "false", "message": "fail"}],
    }
    result = evaluate_definition(defn, {"x": "val"})  # default = continuous
    assert not any(r.get("kind") == "shape" for r in result.results)

def test_submit_shape_included_in_submit(self):
    # same defn
    result = evaluate_definition(defn, {"x": "val"}, mode="submit")
    assert any(r.get("kind") == "shape" for r in result.results)

def test_continuous_shape_always_included(self):
    defn = {... "shapes": [{"id": "s1", "target": "x", "timing": "continuous",
                             "constraint": "false", "message": "fail"}]}
    for mode in ("continuous", "submit"):
        result = evaluate_definition(defn, {"x": "val"}, mode=mode)
        assert any(r.get("kind") == "shape" for r in result.results)
```

- [ ] **Step 6: Build, install, test**

```bash
cargo build -p formspec-py --no-default-features && pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_definition_evaluator.py::TestShapeTiming -v
```

- [ ] **Step 7: Commit**

```bash
git add crates/formspec-eval/src/lib.rs crates/formspec-py/src/lib.rs src/formspec/_rust.py tests/unit/test_definition_evaluator.py
git commit -m "feat(eval): add EvalTrigger for shape timing modes (continuous/submit/disabled)"
```

---

### Task 8: Screener routing

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — add `ScreenerRouteResult` + `evaluate_screener`
- Modify: `crates/formspec-py/src/lib.rs` — add PyO3 binding
- Modify: `src/formspec/_rust.py` — add wrapper
- Modify: `tests/unit/test_screener_routing.py` — unskip 2 tests, write bodies

- [ ] **Step 1: Add `evaluate_screener` to formspec-eval**

In `crates/formspec-eval/src/lib.rs`, add:

```rust
pub struct ScreenerRouteResult {
    pub target: String,
    pub label: Option<String>,
    pub message: Option<String>,
}

pub fn evaluate_screener(
    definition: &Value,
    answers: &HashMap<String, Value>,
) -> Option<ScreenerRouteResult> {
    let routes = definition.get("screener")?.get("routes")?.as_array()?;
    let field_map: HashMap<String, FelValue> = answers.iter()
        .map(|(k, v)| (k.clone(), json_value_to_fel(v)))
        .collect();
    let env = MapEnvironment::with_fields(field_map);

    for route in routes {
        let condition = route.get("condition").and_then(|v| v.as_str())?;
        let expr = match parse(condition) { Ok(e) => e, Err(_) => continue };
        let result = evaluate(&expr, &env);
        if matches!(result.value, FelValue::Boolean(true)) || matches!(result.value, FelValue::Number(n) if !n.is_zero()) || matches!(result.value, FelValue::String(ref s) if !s.is_empty()) {
            return Some(ScreenerRouteResult {
                target: route.get("target").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                label: route.get("label").and_then(|v| v.as_str()).map(|s| s.to_string()),
                message: route.get("message").and_then(|v| v.as_str()).map(|s| s.to_string()),
            });
        }
    }
    None
}
```

You'll need a `json_value_to_fel` helper (may already exist, check) that converts `serde_json::Value` to `FelValue`.

- [ ] **Step 2: Add PyO3 binding**

In `crates/formspec-py/src/lib.rs`, add a `evaluate_screener` pyfunction that calls the Rust function and returns a Python dict or None.

Register in the module: `m.add_function(wrap_pyfunction!(evaluate_screener_py, m)?)?;`

- [ ] **Step 3: Add Python wrapper**

In `src/formspec/_rust.py`, add:

```python
def evaluate_screener(definition: dict, answers: dict) -> dict | None:
    """Evaluate screener routes and return first matching route."""
    return formspec_rust.evaluate_screener(definition, answers)
```

- [ ] **Step 4: Unskip and write tests**

In `tests/unit/test_screener_routing.py`, remove `@pytest.mark.skip` from both tests. Write test bodies that verify: (1) first matching route wins, (2) screener answers don't appear in main data.

- [ ] **Step 5: Build, install, test**

```bash
cargo build -p formspec-py --no-default-features && pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_screener_routing.py -v
```

- [ ] **Step 6: Commit**

```bash
git add crates/formspec-eval/src/lib.rs crates/formspec-py/src/lib.rs src/formspec/_rust.py tests/unit/test_screener_routing.py
git commit -m "feat(eval): add evaluate_screener for screener routing"
```

---

### Task 9: `excludedValue` + shape-id composition + money diagnostic + default on relevance + nested bare `$` + `initialValue`/`prePopulate`

This task bundles the remaining medium features. Each is a small, focused change.

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — multiple eval features
- Modify: `crates/fel-core/src/evaluator.rs` — money comparison diagnostic
- Modify: `tests/unit/test_definition_evaluator.py` — unskip ~8 tests

- [ ] **Step 1: Add `excluded_value` to ItemInfo**

In `crates/formspec-eval/src/lib.rs`, add `pub excluded_value: Option<String>` to `ItemInfo`. Populate from the bind's `excludedValue` property in `build_item_info` / `resolve_bind`. In the FEL environment construction (`build_validation_env`), when a field is non-relevant and has `excluded_value == Some("null")`, set its value to `FelValue::Null`.

Unskip `test_excluded_value_null_hides_hidden_value_from_shapes_while_keep_preserves_output`.

- [ ] **Step 2: Add shape-id composition resolution**

In `validate_shape`, when processing `or`/`and`/`not`/`xone` arrays, resolve each element as either a shape ID (lookup in `shapes_by_id`) or inline FEL. Add cycle detection using a `HashSet<String>` of visited shape IDs.

Unskip `test_or_composition_with_shape_id_reference`.

- [ ] **Step 3: Add money comparison diagnostic in fel-core**

In `crates/fel-core/src/evaluator.rs`, in the comparison operator evaluation, when one operand is `FelValue::Money` and the other is `FelValue::Number`, return `FelValue::Null` and push a diagnostic.

Unskip `test_shape_variable_mismatch_emits_result` — this test likely needs adapting since the shape should PASS (null → true in constraint context) and the diagnostic is author-facing, not a ValidationResult.

- [ ] **Step 4: Add default on relevance transition**

Add `default_value: Option<Value>` to `ItemInfo`, populated from the bind's `default` property. In the recalculate phase, after evaluating relevance, check: if the field was previously non-relevant, is now relevant, and the current value is empty (null/empty string), apply the literal default value.

Unskip `test_default_applies_only_on_nonrelevant_to_relevant_transition_when_empty`.

- [ ] **Step 5: Fix nested bare `$` in group bind paths**

In the bare `$` injection code (added in a prior commit), ensure it looks up `values.get(&item.path)` using the full dotted path, not just the last segment.

Unskip `test_default_bind_relevance_with_numeric_constraint` (the nested bare `$` test).

- [ ] **Step 6: Add `initialValue` and `prePopulate`**

Add `initial_value: Option<Value>` to `ItemInfo`, populated from the item's `initialValue` property. In `evaluate_definition`, before the recalculate phase, seed missing field values:
- If `initialValue` starts with `=`, strip the prefix and evaluate as FEL
- Otherwise use as literal
- `prePopulate` support: add `pre_populate_instance: Option<String>` and `pre_populate_path: Option<String>` to `ItemInfo`. The evaluator would need an `instances` parameter — for now, skip if no instances are provided.

Unskip `test_initial_value_literal_applied_when_field_missing` and `test_prepopulate_reads_from_instance_when_field_missing`.

- [ ] **Step 7: Build, install, test**

```bash
cargo test -p formspec-eval --no-default-features 2>&1 | tail -5
cargo test -p fel-core --no-default-features 2>&1 | tail -5
pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_definition_evaluator.py -v 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add crates/formspec-eval/src/lib.rs crates/fel-core/src/evaluator.rs tests/unit/test_definition_evaluator.py
git commit -m "feat(eval): excludedValue, shape composition, money diagnostic, default/relevance, initialValue"
```

---

### Task 10: Wave 2 verification

- [ ] **Step 1: Run full suite**

```bash
python3 -m pytest tests/ --ignore=tests/e2e/playwright --ignore=tests/e2e/api -q 2>&1 | tail -5
```

Expected: ~12 fewer skips from Wave 2 (down to ~9 from Wave 1's ~21).

---

## Wave 3 — JSON Schema Validation

### Task 11: Embed schemas and add validation pass

**Files:**
- Create: `crates/formspec-lint/src/schema_validation.rs` — new module
- Modify: `crates/formspec-lint/src/lib.rs` — wire in pass 1b
- Modify: `crates/formspec-lint/Cargo.toml` — add `jsonschema` dep
- Modify: `tests/unit/test_validator_schema.py` — unskip 2 tests

- [ ] **Step 1: Add jsonschema dependency**

In `crates/formspec-lint/Cargo.toml`:
```toml
jsonschema = "0.28"
```

- [ ] **Step 2: Create schema_validation module**

Create `crates/formspec-lint/src/schema_validation.rs`:

```rust
//! Pass 1b: JSON Schema validation against embedded Formspec schemas.

use std::sync::OnceLock;
use jsonschema::{Draft, JSONSchema};
use serde_json::Value;
use formspec_core::DocumentType;
use crate::types::LintDiagnostic;

// Embed all schemas
const DEFINITION_SCHEMA: &str = include_str!("../../../schemas/definition.schema.json");
const COMPONENT_SCHEMA: &str = include_str!("../../../schemas/component.schema.json");
const THEME_SCHEMA: &str = include_str!("../../../schemas/theme.schema.json");
const RESPONSE_SCHEMA: &str = include_str!("../../../schemas/response.schema.json");
const MAPPING_SCHEMA: &str = include_str!("../../../schemas/mapping.schema.json");
const CHANGELOG_SCHEMA: &str = include_str!("../../../schemas/changelog.schema.json");
const REGISTRY_SCHEMA: &str = include_str!("../../../schemas/registry.schema.json");
const VALIDATION_REPORT_SCHEMA: &str = include_str!("../../../schemas/validationReport.schema.json");
const VALIDATION_RESULT_SCHEMA: &str = include_str!("../../../schemas/validationResult.schema.json");

/// Validate a document against its schema, returning E101 diagnostics.
pub fn validate_schema(doc: &Value, doc_type: DocumentType) -> Vec<LintDiagnostic> {
    let schema_str = match doc_type {
        DocumentType::Definition => DEFINITION_SCHEMA,
        DocumentType::Component => COMPONENT_SCHEMA,
        DocumentType::Theme => THEME_SCHEMA,
        DocumentType::Response => RESPONSE_SCHEMA,
        DocumentType::Mapping => MAPPING_SCHEMA,
        DocumentType::Changelog => CHANGELOG_SCHEMA,
        DocumentType::Registry => REGISTRY_SCHEMA,
        DocumentType::ValidationReport => VALIDATION_REPORT_SCHEMA,
    };

    let schema: Value = match serde_json::from_str(schema_str) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    // Build validator with cross-schema references
    let compiled = match JSONSchema::options()
        .with_draft(Draft::Draft202012)
        // Register all schemas by $id for cross-file $ref resolution
        .with_resource("https://formspec.org/schemas/validationResult/1.0",
            serde_json::from_str(VALIDATION_RESULT_SCHEMA).unwrap())
        .with_resource("https://formspec.org/schemas/component/1.0",
            serde_json::from_str(COMPONENT_SCHEMA).unwrap())
        // Add other $id URIs as needed from each schema's $id field
        .compile(&schema)
    {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    compiled.validate(doc)
        .err()
        .map(|errors| {
            errors.map(|e| {
                LintDiagnostic::error(
                    "E101",
                    1,
                    &e.instance_path.to_string(),
                    e.to_string(),
                )
            }).collect()
        })
        .unwrap_or_default()
}
```

Note: The exact `jsonschema` API may differ from the pseudocode above — check the crate docs for the actual `with_resource` / `compile` API. The key principle: register all schemas by their `$id` URI before compiling any individual schema.

- [ ] **Step 3: Wire into lint pipeline**

In `crates/formspec-lint/src/lib.rs`, add `mod schema_validation;` and after pass 1 (document type detection), before the `schema_only` early return:

```rust
// Pass 1b: Schema validation (E101)
diagnostics.extend(schema_validation::validate_schema(doc, doc_type));
```

- [ ] **Step 4: Unskip tests and verify**

In `tests/unit/test_validator_schema.py`, remove `@pytest.mark.skip` from `test_schema_error_maps_to_diagnostic_path` and `test_component_validation_detects_errors`. Adapt assertions to check for E101 diagnostics.

```bash
cargo build -p formspec-py --no-default-features && pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_validator_schema.py -v
```

- [ ] **Step 5: Commit**

```bash
git add crates/formspec-lint/src/schema_validation.rs crates/formspec-lint/src/lib.rs crates/formspec-lint/Cargo.toml tests/unit/test_validator_schema.py
git commit -m "feat(lint): add JSON Schema validation pass (E101) with embedded schemas"
```

---

## Wave 4 — Heavy Architecture

### Task 12: Wildcard bind paths + calculate + shapes

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — repeat expansion, wildcard matching, per-instance eval
- Modify: `tests/unit/test_definition_evaluator.py` — unskip 5 tests

This is the largest task. Break it into phases:

- [ ] **Step 1: Add repeat instance expansion to item tree**

After `rebuild_item_tree()` in `evaluate_definition`, add `expand_repeat_instances(&mut items, data)` that:
1. Walks items looking for `item.repeatable == true`
2. For each repeatable group, counts instances in data (e.g., `data["items"]` is an array → N instances)
3. Clones the group's template children N times with indexed paths: `group[0].child`, `group[1].child`, etc.
4. Each concrete child gets added to the group's children list

- [ ] **Step 2: Wildcard bind matching**

In `resolve_bind` (or wherever binds are matched to items), normalize `[*]` in bind paths:
```rust
let bind_path_norm = bind_path.replace("[*]", "");
```
Match against items whose path (with indices stripped) matches the normalized bind path.

- [ ] **Step 3: Per-instance calculate/constraint evaluation**

When a wildcard bind has `calculate` or `constraint`, evaluate per concrete instance. Build a row-scoped FEL environment for each instance where `$sibling` resolves to the same-row field.

- [ ] **Step 4: Wildcard shape target expansion**

In `validate_shape`, when the target contains `[*]`, call `expand_wildcard_path(target, values)` to get concrete paths. Evaluate the shape constraint per concrete path with row-scoped context. Each ValidationResult gets the concrete 0-based path.

- [ ] **Step 5: Wildcard bare `$` combination**

Wildcard bind constraints with bare `$` — the bare `$` resolves to the concrete instance's field value. This should work naturally if per-instance evaluation is set up correctly.

- [ ] **Step 6: Unskip and test**

Unskip all 5 wildcard tests in `tests/unit/test_definition_evaluator.py`:
- `test_wildcard_bind_path`
- `test_repeat_scoped_calculate`
- `test_wildcard_target_shape_emits_concrete_repeat_path`
- `test_wildcard_target_shape_uses_row_scope_for_sibling_references`
- `test_wildcard_bind_constraints` (the `[*]` + bare `$` test)

Write test bodies if they're stubs. Run and iterate.

```bash
cargo test -p formspec-eval --no-default-features 2>&1 | tail -10
pip install --no-build-isolation ./crates/formspec-py
python3 -m pytest tests/unit/test_definition_evaluator.py -k "wildcard or repeat_scoped" -v
```

- [ ] **Step 7: Commit**

```bash
git add crates/formspec-eval/src/lib.rs tests/unit/test_definition_evaluator.py
git commit -m "feat(eval): wildcard bind paths, per-instance calculate/constraint, wildcard shape targets"
```

---

### Task 13: Scoped variables

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs` — scope-keyed variable storage, pre-filtered lookup
- Modify: `tests/unit/test_definition_evaluator.py` — unskip 3 tests

- [ ] **Step 1: Key variables by scope**

In `parse_variables`, read the `scope` field (default `"#"`). Store variables internally as `"scope:name"` keys:

```rust
let scope = var.get("scope").and_then(|v| v.as_str()).unwrap_or("#");
let key = format!("{scope}:{name}");
```

- [ ] **Step 2: Pre-filter visible variables per bind**

Before evaluating each bind expression, compute visible variables for the bind's item path. Walk from the item's path up through ancestors to `"#"`, collecting variables at each scope:

```rust
fn visible_variables(
    all_vars: &HashMap<String, Value>,
    item_path: &str,
    items: &[ItemInfo],
) -> HashMap<String, Value> {
    let mut visible = HashMap::new();
    // Global scope
    for (key, val) in all_vars {
        if key.starts_with("#:") {
            visible.insert(key[2..].to_string(), val.clone());
        }
    }
    // Walk ancestors from most-general to most-specific (so nearest wins)
    let parts: Vec<&str> = item_path.split('.').collect();
    for i in 1..=parts.len() {
        let ancestor = parts[..i].join(".");
        let prefix = format!("{ancestor}:");
        for (key, val) in all_vars {
            if let Some(name) = key.strip_prefix(&prefix) {
                visible.insert(name.to_string(), val.clone());
            }
        }
    }
    visible
}
```

- [ ] **Step 3: Unskip and test**

Unskip the 3 scoped variable tests:
- `test_scoped_variable_resolves_from_nearest_group_scope`
- `test_scoped_variable_is_not_visible_outside_its_scope`
- `test_scoped_variable_resolves_for_repeat_descendants`

Write test bodies and run.

- [ ] **Step 4: Commit**

```bash
git add crates/formspec-eval/src/lib.rs tests/unit/test_definition_evaluator.py
git commit -m "feat(eval): scoped variables with scope-keyed storage and per-bind pre-filtering"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full Python suite**

```bash
python3 -m pytest tests/ --ignore=tests/e2e/playwright --ignore=tests/e2e/api -q 2>&1 | tail -5
```

Expected: 4 skips remaining (non-normative spec snippets only).

- [ ] **Step 2: Run all Rust tests**

```bash
cargo test --no-default-features 2>&1 | grep "test result"
```

Expected: all pass.

- [ ] **Step 3: Run validate CLI**

```bash
python3 -m formspec.validate examples/grant-report/ --registry registries/formspec-common.registry.json 2>&1 | tail -5
```

Expected: runs without import errors.

- [ ] **Step 4: Commit any remaining fixups**

```bash
git add -A && git commit -m "test(python): verify full suite after Rust backend parity — 4 skips remaining"
```
