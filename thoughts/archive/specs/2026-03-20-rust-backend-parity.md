# Rust Backend Parity — Design Spec

> **Goal:** Close all 24 actionable gaps between the Rust backend crates and the Python test suite, reducing skipped tests from 28 to 4 (non-normative spec snippets only).

**Date:** 2026-03-20
**Status:** Implemented — all 18 features built across 4 waves.
**Crates affected:** `formspec-eval`, `formspec-lint`, `formspec-core` (schema infra), `formspec-py`, `fel-core`

---

## Inventory

| # | Feature | Skips | Tier | Crate |
|---|---------|-------|------|-------|
| 1 | `schema_only` lint flag | 1 | Quick | formspec-lint |
| 2 | `no_fel` lint flag | 1 | Quick | formspec-lint |
| 3 | `strict` mode escalation | 1 | Quick | formspec-lint |
| 4 | E600 no-registry behavior | 2 | Quick | formspec-lint |
| 5 | JSON Schema validation in lint | 2 | Medium | formspec-lint + formspec-core |
| 6 | W705 dotted nested path resolution | 1 | Quick | formspec-lint |
| 7 | Shape timing modes | 3 | Medium | formspec-eval + formspec-py |
| 8 | Screener routing | 2 | Medium | formspec-eval + formspec-py |
| 9 | Non-relevant shape suppression | 1 | Quick | formspec-eval |
| 10 | `excludedValue` | 1 | Medium | formspec-eval |
| 11 | Circular variable dep detection | 1 | Quick | formspec-eval |
| 12 | Shape-id composition (`or`/`and`) | 1 | Medium | formspec-eval |
| 13 | Money comparison diagnostic | 1 | Medium | fel-core |
| 14 | Default on relevance transition | 1 | Medium | formspec-eval |
| 15 | Wildcard bind paths + calculate + shapes | 5 | Heavy | formspec-eval |
| 16 | Scoped variables | 3 | Heavy | formspec-eval + fel-core |
| 17 | `initialValue` / `prePopulate` | 2 | Medium | formspec-eval |
| 18 | Nested bare `$` in group binds | 1 | Medium | formspec-eval |
| **Total** | | **30** (some tests cover multiple) | | |

Actual distinct skipped tests: **24** (some features share tests).

---

## Feature Designs

### 1. `schema_only` lint flag

**What:** When `true`, the linter runs only pass 1 (document type detection) + the new JSON Schema validation pass (feature 5), then returns. Skips all semantic passes (2–7).

**Change:** Add `pub schema_only: bool` to `LintOptions` in `formspec-lint/src/types.rs`. In `lint_with_options()`, after the schema validation pass, check `options.schema_only` and return early if set.

**PyO3:** Add `schema_only: Option<bool>` param to `lint_document`. Forward from `_rust.py`.

### 2. `no_fel` lint flag

**What:** When `true`, skip pass 4 (FEL expression compilation) and pass 5 (dependency cycle detection, which depends on pass 4 output).

**Change:** Add `pub no_fel: bool` to `LintOptions`. In `lint_with_options()`, gate passes 4 and 5 on `!options.no_fel`.

**PyO3:** Add `no_fel: Option<bool>` param to `lint_document`. Forward from `_rust.py`.

### 3. `strict` mode escalation

**What:** Per ADR 0001, `strict` mode escalates W800, W802, W803, W804 from warning to error severity. This is distinct from `Authoring` (which suppresses W300/W802) and `Runtime` (which emits everything at natural severity).

**Change:** Add `LintMode::Strict` variant. In a post-processing step after `sort_diagnostics`, iterate diagnostics and escalate matching codes:

```rust
if options.mode == LintMode::Strict {
    for d in &mut diagnostics {
        if matches!(d.code.as_str(), "W800" | "W802" | "W803" | "W804") {
            d.severity = LintSeverity::Error;
        }
    }
}
```

**PyO3:** The existing `mode` string param already accepts arbitrary values. Map `"strict"` → `LintMode::Strict`.

### 4. E600 no-registry behavior

**What:** When a definition field declares extensions but no registry documents are provided to the linter, fire E600 for each unresolvable extension. The current Rust behavior silently skips extension checking when no registries are loaded — this is incorrect per the user's decision.

**Change:** In `formspec-lint/src/extensions.rs`, the `check_extensions` function currently returns early when `registry_documents.is_empty()`. Remove that early return. When registries are empty, every extension on every field should emit E600 ("Extension '{name}' cannot be resolved — no registry documents provided").

### 5. JSON Schema validation in lint pipeline

**What:** Add actual JSON Schema validation as a new pass 0 (before document type detection). This catches structural violations like invalid enum values (`dataType: "blob"`), unknown properties (`bogusProperty`), and missing required fields.

**Approach:** Embed the Formspec JSON Schema files in the Rust binary using `include_str!` and validate using the `jsonschema` crate (`jsonschema-rs`). This keeps the lint crate self-contained.

**Schema selection:** After document type detection (pass 1), select the appropriate schema:
- `definition` → `schemas/definition.schema.json`
- `theme` → `schemas/theme.schema.json`
- `component` → `schemas/component.schema.json`
- `response` → `schemas/response.schema.json`
- `mapping` → `schemas/mapping.schema.json`
- `changelog` → `schemas/changelog.schema.json`
- `registry` → `schemas/registry.schema.json`
- `validationReport` → `schemas/validationReport.schema.json`

**Pass ordering:** Reorder so pass 1 stays as document type detection, and schema validation runs as pass 1b (after type detection, before tree indexing). Schema errors become `E101` diagnostics with the JSON path from the schema validator.

**Dependency:** Add `jsonschema = "0.28"` (or latest) to `formspec-lint/Cargo.toml`. Embed schemas as `const` strings.

**Schema file embedding:** Use `include_str!` for all schema files:
```rust
const DEFINITION_SCHEMA: &str = include_str!("../../../schemas/definition.schema.json");
const COMPONENT_SCHEMA: &str = include_str!("../../../schemas/component.schema.json");
// ... etc for all 8 schemas
```

**Cross-file `$ref` resolution (CRITICAL):** Several schemas use cross-file `$ref` URIs:
- `response.schema.json` → refs `validationResult.schema.json` via `$id` URI
- `validationReport.schema.json` → refs `validationResult.schema.json` via `$id` URI
- `theme.schema.json` → refs `component.schema.json` defs (Tokens, Breakpoints, etc.)

Naive single-schema compilation will break for these. Must register ALL embedded schemas into a shared resolver before compiling any individual schema. Use `jsonschema`'s `Draft202012Validator::options().with_resource(uri, schema)` API to build a resolver that maps each schema's `$id` URI to its embedded string content. Compile all schemas once via `OnceLock` and reuse across lint calls.

### 6. W705 dotted nested path resolution

**What:** The Rust linter's W705 check (theme selector references unresolved item key) doesn't resolve dotted nested paths like `address.street`. It only matches top-level keys.

**Change:** In `formspec-lint/src/pass_theme.rs`, the item key lookup needs to walk the item tree recursively and build full dotted paths (e.g., `address.street`, `address.city`) in addition to top-level keys. Compare selector `match` values against this full path set.

### 7. Shape timing modes

**What:** Shapes have an optional `timing` property: `"continuous"` (default), `"submit"`, `"demand"`. The evaluator must filter shapes based on a `mode` parameter.

**Spec rules:**
- Mode `Continuous` → only evaluate shapes with `timing == "continuous"` (default)
- Mode `Submit` → evaluate `"continuous"` AND `"submit"` shapes
- Mode `Disabled` → evaluate no shapes
- `"demand"` shapes are never evaluated in batch — only via explicit per-shape calls

**Naming note:** The spec defines two distinct concepts: per-shape `timing` (definition-time: continuous/submit/demand) and global validation mode (runtime: continuous/deferred/disabled). The evaluator parameter represents the *evaluation trigger context* — "what shapes should fire right now?" — not the global validation mode. We call it `EvalTrigger` to avoid conflation.

**Change in formspec-eval:**

Add an `EvalTrigger` enum:
```rust
/// The evaluation trigger context — determines which shapes fire.
/// Not the same as the spec's global validation mode (§5.5).
pub enum EvalTrigger { Continuous, Submit, Disabled }
```

Add `trigger: EvalTrigger` parameter to `evaluate_definition` (or create `evaluate_definition_with_trigger` to avoid breaking the existing signature, with the original delegating to it with `Continuous`).

In `revalidate`, read each shape's `timing` field (default `"continuous"`) and skip if it doesn't match the mode:
```rust
let timing = shape.get("timing").and_then(|v| v.as_str()).unwrap_or("continuous");
match mode {
    EvalTrigger::Disabled => continue,
    EvalTrigger::Continuous => if timing != "continuous" { continue; },
    EvalTrigger::Submit => if timing == "demand" { continue; },
}
```

**PyO3:** Add `mode: Option<&str>` to `evaluate_def`. Forward from `_rust.py`.

### 8. Screener routing

**What:** New `evaluate_screener(definition, answers)` function. Evaluates screener route conditions in declaration order against an isolated FEL context built from the answers. Returns the first matching route or None.

**Spec rules:**
- Screener answers are NOT written into main form data (pure function)
- Route conditions are FEL expressions evaluated against answers as field values
- First truthy match wins; `"condition": "true"` is a valid fallback
- If parse/eval fails for a condition, skip that route
- Return `{ target, label?, message?, extensions? }` or None

**Change in formspec-eval:**

```rust
pub struct ScreenerRouteResult {
    pub target: String,
    pub label: Option<String>,
    pub message: Option<String>,
    pub extensions: Option<Value>,
}

pub fn evaluate_screener(
    definition: &Value,
    answers: &HashMap<String, Value>,
) -> Option<ScreenerRouteResult> {
    let routes = definition.get("screener")?.get("routes")?.as_array()?;
    let env = MapEnvironment::with_fields(/* convert answers to FelValue map */);
    for route in routes {
        let condition = route.get("condition")?.as_str()?;
        let expr = match parse(condition) { Ok(e) => e, Err(_) => continue };
        let result = evaluate(&expr, &env);
        if result.value.is_truthy() {
            return Some(ScreenerRouteResult { ... });
        }
    }
    None
}
```

**PyO3:** Add `evaluate_screener` function. Forward from `_rust.py`.

**Note:** This design does NOT evaluate screener binds (calculate, relevant, constraint on screener items). The TS engine also skips screener binds during route evaluation — binds are a rendering/UI concern, not a routing concern. If a future test requires bind evaluation during screener routing, add it then.

### 9. Non-relevant shape suppression

**What:** Shapes targeting non-relevant fields must not fire (spec §5.6 rule 1, conformance requirement §2.5.2).

**Change:** In `validate_shape()`, after resolving the target path, look up the target in the items list. If the item is non-relevant, skip the shape entirely. The `revalidate` function already receives `items: &[ItemInfo]`. Thread items into `validate_shape` and add the check:

```rust
if let Some(item) = find_item_by_path(items, target_path) {
    if !item.relevant {
        continue; // spec §5.6 rule 1
    }
}
// Special case: target "#" (root) is always relevant
```

### 10. `excludedValue`

**What:** Bind property controlling what FEL expressions see when a field is non-relevant. `"preserve"` (default) → expressions see last value. `"null"` → expressions see `null`.

**Change:**
1. Add `excluded_value: Option<String>` to `ItemInfo`, populated from the bind.
2. In `build_validation_env()` (or wherever the FEL environment is constructed for recalculation), when resolving a field reference: if the field is non-relevant AND its `excluded_value == Some("null")`, return `FelValue::Null` instead of the stored value.

### 11. Circular variable dependency detection

**What:** The `topo_sort_variables` function already exists and detects cycles. But `evaluate_definition` currently catches the error and silently returns None for cyclic variables. Per spec §4.5.2, the evaluator MUST signal a definition error.

**Change:** In `evaluate_definition`, when `topo_sort_variables` returns `Err(cycle_msg)`, add a `ValidationResult` with `severity: "error"`, `kind: "definition"`, `message: cycle_msg` to the output. Do NOT silently swallow the error.

### 12. Shape-id composition (`or`/`and`)

**What:** Shape `or`/`and`/`not`/`xone` arrays can contain either inline FEL expressions or shape ID references. Shape IDs are resolved by looking up the `id` in the definition's `shapes` array.

**Spec:** Each element is first looked up as a shape ID. If found, that shape is evaluated and its pass/fail result used. If not found, the element is treated as an inline FEL expression.

**Change:** In `validate_shape`, when processing composition operators, add a resolution step:

```rust
fn resolve_shape_element(
    element: &str,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    items: &[ItemInfo],
    values: &HashMap<String, Value>,
) -> bool {
    if let Some(referenced_shape) = shapes_by_id.get(element) {
        // Evaluate the referenced shape and return its pass/fail
        shape_passes(referenced_shape, shapes_by_id, env, items, values)
    } else {
        // Treat as inline FEL expression
        eval_bool_expr(element, env)
    }
}
```

Must detect circular shape references (A references B which references A) and report a definition error.

### 13. Money comparison diagnostic

**What:** When a FEL comparison operator (`<`, `>`, `<=`, `>=`) receives a money value compared to a number, this is a type error per spec §3.3. The expression should evaluate to `null` and record a diagnostic.

**Change in fel-core:** In the comparison operator evaluation (`evaluate_binary` or equivalent), when operands are of incompatible types (especially `Money` vs `Number`), return `FelValue::Null` and push a diagnostic with message like `"Type error: cannot compare money with number — use moneyAmount() to extract the numeric value"`.

The diagnostic is author-facing (severity: warning), not a ValidationResult. The shape constraint that triggered it will see `null`, which in a constraint context means "passes" (null propagation rule: `constraint` null → `true`).

### 14. Default on relevance transition

**What:** When a field transitions from non-relevant to relevant and has a bind `default` value, apply the default if the field's current value is empty.

**Change:**
1. Add `default_value: Option<Value>` to `ItemInfo`, populated from the bind's `default` property.
2. Add `prev_relevant: bool` to `ItemInfo` (or track previous relevance in a separate structure).
3. In the recalculate phase, after evaluating `relevant`: if `!prev_relevant && now_relevant && field_is_empty`, apply the default value as a literal.

**Important:** The bind `default` property is always a **literal value**, NOT a FEL expression. Only `initialValue` (an Item property) supports the `=expression` prefix syntax. Do NOT add FEL evaluation to `default`.

**Spec divergence (intentional):** The spec (§5.6 rule 5) says `default` MUST be applied unconditionally on every non-relevant-to-relevant transition. The TS engine only applies when the field is empty (null/empty string). We follow the TS engine behavior — applying unconditionally would wipe user input after a hide/show cycle, which is hostile UX. This is a known spec divergence; the spec may need an errata.

### 15. Wildcard bind paths + calculate + shapes (5 tests)

This is the largest feature. The root domino is that the item tree must represent concrete repeat instances.

**Phase A: Repeat instance expansion in item tree**

After `rebuild_item_tree()`, add a new step `expand_repeat_instances()` that:
1. Walks the item tree looking for repeatable groups
2. For each repeatable group, checks the data for concrete instances (e.g., `data["items"]` is an array of length 3)
3. Expands the template children into N concrete instance subtrees with indexed paths: `items[0].name`, `items[1].name`, etc.
4. The template group item remains but gets N concrete child trees

**Phase B: Wildcard bind matching**

In `resolve_bind()`, normalize wildcard bind paths by stripping `[*]`:
```rust
fn normalize_bind_path(path: &str) -> String {
    path.replace("[*]", "")
}
```

When matching a bind to items, a bind with path `items[*].amount` matches any item with path matching `items.amount` (after normalization). The bind is then applied to ALL matching concrete instances.

**Caveat:** This `replace("[*]", "")` approach is simplistic. For doubly-nested repeats like `a[*].b[*].c`, stripping all `[*]` produces `a.b.c` which could produce false matches. For the current test suite (single-level repeats only), this is sufficient. Nested repeat wildcard matching can be refined later if needed.

**Phase C: Per-instance calculate evaluation**

When a wildcard bind has a `calculate` expression, evaluate it once per concrete instance. For `items[*].total` with `calculate: "$qty * $price"`:
- For instance 0: set FEL context so `$qty` → `items[0].qty`, `$price` → `items[0].price`
- For instance 1: set FEL context so `$qty` → `items[1].qty`, `$price` → `items[1].price`
- etc.

This is the "row-scoped evaluation context" from spec §7.3.

**Phase D: Wildcard shape target expansion**

In `validate_shape`, when the target contains `[*]`:
1. Call `expand_wildcard_path(target, data)` to get concrete paths
2. For each concrete path, evaluate the shape constraint with row-scoped context
3. Each failure gets a ValidationResult with the concrete 0-based path

**Phase E: Wildcard bind constraints and bare `$`**

When a wildcard bind has a `constraint` expression, evaluate per-instance (same as calculate). Bare `$` resolves to the concrete field's value (combine with existing bare `$` support).

### 16. Scoped variables (3 tests)

**What:** Variables have a `scope` property (default `"#"` = global). A variable scoped to item key `K` is visible to expressions on `K` and all descendants. Not visible to ancestors or siblings.

**Change in formspec-eval:**
1. Key variables as `"scope:name"` in the variable map (e.g., `"budget_section:subtotal"`, `"#:totalGrant"`)
2. Read `scope` from each variable definition (default `"#"`)
3. Before evaluating each bind expression, compute the visible variable set by walking from the bind's item path up through ancestors to `"#"`, collecting variables at each scope level
4. Nearest scope wins for name collisions

**Change in fel-core:**
Two options (per scout analysis):
- **Option A (simpler):** Pre-filter visible variables per bind path, populate flat map. No trait change needed.
- **Option B (cleaner):** Add evaluation path to `FormspecEnvironment`, walk scopes in `resolve_context`.

**Recommendation:** Option A for now — simpler, less invasive, sufficient for the 3 tests.

### 17. `initialValue` / `prePopulate` (2 tests)

**What:** Field-level Item properties applied at creation time.

**`initialValue`:** Literal value or `=expression` applied when field is missing from data.
**`prePopulate`:** Object with `{ instance, path, editable }` — reads from instances map, overrides initialValue. When `editable: false`, field becomes readonly.

**Change:**
1. Add `initial_value: Option<Value>` and `pre_populate: Option<PrePopulateConfig>` to `ItemInfo`
2. In `evaluate_definition`, before the recalculate phase, seed missing field values:
   - Check `prePopulate` first (higher precedence)
   - Then check `initialValue`
   - If value starts with `=`, evaluate as FEL
   - Otherwise use as literal

### 18. Nested bare `$` in group bind paths

**What:** Bare `$` doesn't resolve correctly when the bind path is a dotted group path like `expenditures.employment`. The current implementation sets `env.data[""]` but doesn't account for the evaluation being scoped to a nested context.

**Change:** When injecting bare `$` into the environment, use the concrete field value at the full bind path, not just the last segment. The existing bare `$` implementation needs to look up `values.get(&item.path)` where `item.path` is the full dotted path.

---

## Implementation Order

The features have dependencies. Recommended execution order:

**Wave 1 — Lint flags + quick eval fixes (features 1–4, 6, 9, 11)**
- Independent, no cross-feature dependencies
- Estimated: 7 skips resolved

**Wave 2 — Medium eval features (features 7, 8, 10, 12–14, 17–18)**
- Shape timing needs `mode` param (feature 7)
- Screener is standalone (feature 8)
- `excludedValue` + non-relevant shapes depend on feature 9 being done first
- Shape composition depends on existing shape infra
- Estimated: 12 skips resolved

**Wave 3 — JSON Schema validation (feature 5)**
- Adds `jsonschema` dependency to formspec-lint
- Embeds schema files
- Estimated: 2 skips resolved

**Wave 4 — Heavy architecture (features 15–16)**
- Wildcard expansion is the root domino (feature 15)
- Scoped variables are independent of wildcards (feature 16)
- These two can be parallel
- Estimated: 8 skips resolved

**Total: 24 actionable skips → 0** (4 non-normative spec snippets remain)

---

## Rollback Policy

Per the original Rust rewrite plan: if Rust gaps are discovered, **patch the Rust crate first**. Do not resurrect deleted Python files or add Python fallbacks.

## Testing Strategy

Each feature follows red-green-refactor:
1. Unskip the relevant Python test(s)
2. Run to confirm failure (RED)
3. Implement the Rust change
4. Rebuild + reinstall PyO3 module
5. Run to confirm pass (GREEN)
6. Run full suite to confirm no regressions

For features that need new Rust-level tests (JSON Schema, wildcard expansion), add them in the crate's `tests/` directory alongside the Python-level unskips.
