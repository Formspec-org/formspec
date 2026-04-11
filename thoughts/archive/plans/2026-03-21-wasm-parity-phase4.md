# WASM Parity Phase 4 — Kill the Settle Loop

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 3-pass TS settle loop and all TS-side FEL re-evaluation. After this, `_evaluate()` is: one WASM call, diff, patch signals. No monkey patching.

**Architecture:** The TS settle loop exists because Rust doesn't apply precision rounding or money coercion to calculated values. TS re-evaluates everything to apply coercion, then re-derives MIP states, validations, variables, and shapes to match the coerced values. Fix the 20-line Rust gap → delete ~400 lines of TS.

**Tech Stack:** Rust (`formspec-eval`), TypeScript, `@preact/signals-core`, `wasm-pack`

**Current state:** 622/622 engine tests pass. `index.ts` is 3,632 lines. The `_evaluate()` method calls WASM once, then runs a 3-pass settle loop of `patchDerivedMipSignals` + `patchBindValidationSignals` + `patchVariableSignals` + `patchCalculatedSignals`.

**Target state:** `_evaluate()` is ~15 lines: WASM call → diff → batch signal patch. No `patch*` re-evaluation methods. `index.ts` ≤ 3,200 lines.

---

## Dependency Chain

```
Task A: Precision/money coercion in Rust recalculate
  → Task B: Delete patchCalculatedSignals + patchVariableSignals
    → Task C: Delete patchDerivedMipSignals + patchBindValidationSignals
      → Task D: Delete 3-pass loop + shape supplement
        → Task E: Delete applyRelevanceDefaults (verify redundant)
          → Task F: Add wasmEvaluateScreener
            → Task G: Switch sync assembly to WASM
```

Tasks A→D are the critical path (must be sequential). E, F, G are independent.

---

## Task A: Add precision rounding + money coercion to Rust recalculate

**Files:**
- Modify: `crates/formspec-eval/src/recalculate.rs` (~20 lines added)
- Modify: `crates/formspec-eval/src/types.rs` (add `precision` and `data_type` to `ItemInfo` if not present)
- Modify: `crates/formspec-eval/src/rebuild.rs` (parse `precision` from bind, `dataType` from item)

**Problem:** `evaluate_single_item` at `recalculate.rs:525-534` stores raw FEL output via `fel_to_json()` with no post-processing. The TS `coerceFieldValue` applies:
1. Precision rounding: `Math.round(value * 10^precision) / 10^precision`
2. Money wrapping: if `dataType=money` and value is a number, wrap as `{ amount, currency }`

**Step 1: Write failing Rust tests**

```rust
#[test]
fn calculated_value_applies_precision() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "price", "type": "field", "dataType": "decimal", "label": "P" },
            { "key": "tax", "type": "field", "dataType": "decimal", "label": "Tax" },
        ],
        "binds": [
            { "path": "tax", "calculate": "$price * 0.0725", "precision": 2 }
        ],
    });
    let mut data = HashMap::new();
    data.insert("price".into(), serde_json::json!(99.99));
    let result = evaluate_definition(&def, &data);
    // 99.99 * 0.0725 = 7.249275 → rounded to 7.25
    assert_eq!(result.values.get("tax"), Some(&serde_json::json!(7.25)));
}

#[test]
fn calculated_money_field_wraps_as_money_object() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "qty", "type": "field", "dataType": "integer", "label": "Q" },
            { "key": "rate", "type": "field", "dataType": "decimal", "label": "R" },
            { "key": "total", "type": "field", "dataType": "money", "label": "Total" },
        ],
        "binds": [
            { "path": "total", "calculate": "$qty * $rate" }
        ],
    });
    let mut data = HashMap::new();
    data.insert("qty".into(), serde_json::json!(5));
    data.insert("rate".into(), serde_json::json!(19.99));
    let result = evaluate_definition(&def, &data);
    let total = result.values.get("total").unwrap();
    assert_eq!(total.get("amount"), Some(&serde_json::json!(99.95)));
    assert!(total.get("currency").is_some(), "money field should have currency");
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cargo test -p formspec-eval -- calculated_value_applies_precision calculated_money_field`

- [ ] **Step 3: Implement precision rounding**

In `recalculate.rs`, after `evaluate_single_item` computes a calculate value (line ~534), apply precision rounding:

```rust
// After: values.insert(item.path.clone(), json_val.clone());
if let Some(precision) = item.precision {
    if let Some(n) = json_val.as_f64() {
        let factor = 10_f64.powi(precision as i32);
        let rounded = (n * factor).round() / factor;
        let rounded_val = serde_json::json!(rounded);
        values.insert(item.path.clone(), rounded_val.clone());
        item.value = rounded_val;
        env.set_field(&item.path, json_to_fel(&serde_json::json!(rounded)));
    }
}
```

Also apply in `evaluate_calculate_only` and `settle_calculated_values` (the fixpoint loop).

- [ ] **Step 4: Implement money wrapping**

When `item.data_type == "money"` and the calculated result is a number, wrap:

```rust
if item.data_type.as_deref() == Some("money") {
    if let Some(n) = json_val.as_f64() {
        let money_val = serde_json::json!({ "amount": n, "currency": "USD" });
        values.insert(item.path.clone(), money_val.clone());
        item.value = money_val;
    }
}
```

Note: The currency should come from the definition or bind config. Check how the TS engine determines currency. If no currency is specified, use `"USD"` as default or omit currency.

- [ ] **Step 5: Parse precision and dataType in rebuild.rs**

Ensure `ItemInfo` has `precision: Option<u32>` and `data_type: Option<String>`. Parse from bind's `precision` field and item's `dataType` field during `rebuild_item_tree`.

- [ ] **Step 6: Run all Rust tests**

Run: `cargo test -p formspec-eval`

- [ ] **Step 7: Rebuild WASM + verify TS tests still pass**

```bash
npm -w formspec-engine run build:wasm
npm -w formspec-engine run build
npm -w formspec-engine run test:unit
```

- [ ] **Step 8: Commit**

---

## Task B: Delete patchCalculatedSignals + patchVariableSignals

**Files:**
- Modify: `packages/formspec-engine/src/index.ts`

With Rust now producing correctly-coerced calculated values, the TS re-evaluation of calculates and variables is redundant.

- [ ] **Step 1: Delete `patchCalculatedSignals` method** (~19 lines)

Remove the method body. Remove calls to it from the settle loop.

- [ ] **Step 2: Delete `patchVariableSignals` method** (~18 lines)

The WASM result already includes `variables: Record<string, any>`. Trust it. Only patch variable signals from the WASM result, not by re-evaluating.

Modify `patchDeltaSignals` (or create a new `patchVariableSignalsFromResult`) to write WASM variable values to signals directly:

```typescript
// In patchDeltaSignals or similar:
for (const [key, value] of Object.entries(result.variables ?? {})) {
    this.variableSignals[key] ??= signal(undefined);
    this.variableSignals[key].value = value;
}
```

- [ ] **Step 3: Delete supporting infrastructure**

- `_orderedCalculatedPaths` field + `buildOrderedCalculatedPaths` method (~22 lines)
- `_orderedVariableDefs` field + `buildOrderedVariableDefs` method (~22 lines)
- `validateCalculateCycles` method (~18 lines)
- `validateVariableCycles` method (~11 lines)

- [ ] **Step 4: Run tests, fix failures**

Run: `npm -w formspec-engine run build && npm -w formspec-engine run test:unit`

Expect some failures if variable signal keys differ between WASM result format and TS format (e.g., `#:varName` vs `varName`). Fix the key mapping.

- [ ] **Step 5: Commit**

---

## Task C: Delete patchDerivedMipSignals + patchBindValidationSignals

**Files:**
- Modify: `packages/formspec-engine/src/index.ts`

With calculates and variables now trusted from WASM, MIP states and validations from WASM are also authoritative.

- [ ] **Step 1: Delete `patchDerivedMipSignals` method** (~29 lines)

WASM already returns `required`, `readonly`, `nonRelevant`. `patchDeltaSignals` already writes these to signals. The re-derivation is redundant.

- [ ] **Step 2: Delete `patchBindValidationSignals` method** (~37 lines)

WASM already returns all bind validations (REQUIRED, CONSTRAINT_FAILED) in `result.validations`. `patchDeltaSignals` already writes these to validation signals.

**Caveat:** The TS `patchBindValidationSignals` applies `replaceSelfRef` (bare `$` → `$fieldName`) before evaluating constraints. Rust already handles bare `$` in constraints natively (`revalidate.rs:167-197`). Verify Rust handles this correctly by checking the existing constraint tests.

- [ ] **Step 3: Run tests, fix failures**

- [ ] **Step 4: Commit**

---

## Task D: Delete the 3-pass settle loop + simplify shape handling

**Files:**
- Modify: `packages/formspec-engine/src/index.ts`

- [ ] **Step 1: Replace the 3-pass settle loop with direct signal patching**

The current `_evaluate` has:
```typescript
batch(() => {
    this.patchValueSignals(fullResult.values);
    this.patchDeltaSignals(delta);
    for (let pass = 0; pass < 3; pass += 1) {
        this.patchDerivedMipSignals();      // DELETED in Task C
        this.patchBindValidationSignals();  // DELETED in Task C
        this.patchVariableSignals(fullResult);  // DELETED in Task B
        this.patchCalculatedSignals();      // DELETED in Task B
    }
    this.patchDerivedMipSignals();      // DELETED
    this.patchBindValidationSignals();  // DELETED
    this.syncInstanceCalculateSignals();
    this.reevaluateContinuousShapes(fullResult);  // TARGET for deletion
    this.patchErrorSignals();
    this._evaluationVersion.value += 1;
});
```

Replace with:
```typescript
batch(() => {
    this.patchValueSignals(fullResult.values);
    this.patchDeltaSignals(delta);
    this.syncInstanceCalculateSignals();  // keep if instance write-back needed
    this.patchErrorSignals();
    this._evaluationVersion.value += 1;
});
```

- [ ] **Step 2: Delete or simplify `reevaluateContinuousShapes`**

This method exists for shapes with bare variable references that WASM doesn't resolve. After Tasks B-C, WASM's shape results are authoritative for ALL shapes that don't use bare identifiers.

Check: do any test fixtures use bare identifiers in shape constraints (e.g., `budget > grandTotal` instead of `$budget > $grandTotal`)? If yes, keep a minimal fallback. If no, delete entirely.

- [ ] **Step 3: Simplify `withExtraValidations`**

Remove the shape supplement loop. Keep only:
- Cardinality validation (TS owns repeat counts)
- External validation merging

- [ ] **Step 4: Delete dead helper functions**

- `safeEvaluateExpression` (if no longer called from the settle path)
- `buildFlatFieldContext` (if no longer called)
- `shapeUsesInstanceRef`, `shapeUsesQualifiedRefs` (if shape supplement deleted)
- Any other functions only called from deleted code

- [ ] **Step 5: Run tests, fix failures**

- [ ] **Step 6: Commit**

---

## Task E: Verify and delete applyRelevanceDefaults

**Files:**
- Modify: `packages/formspec-engine/src/index.ts`

Phase 0b added expression default support to Rust. The TS engine passes `previousNonRelevant` to WASM. Rust should handle relevance defaults entirely.

- [ ] **Step 1: Delete `applyRelevanceDefaults` and run tests**

Just delete it. If tests pass, it was redundant. If tests fail, analyze which edge case Rust misses.

- [ ] **Step 2: If tests fail, check the edge case**

The likely failure: expression defaults that depend on calculated values. Rust evaluates expression defaults during `evaluate_single_item` (Phase 2), but calculated values from OTHER fields may not be settled yet. The TS version evaluates after the WASM call, when all values are available.

If this is the case, the fix is in Rust: move expression default evaluation to AFTER the fixpoint settle (after `settle_calculated_values`).

- [ ] **Step 3: Commit**

---

## Task F: Add wasmEvaluateScreener

**Files:**
- Modify: `crates/formspec-wasm/src/lib.rs` (~30 lines)
- Modify: `packages/formspec-engine/src/wasm-bridge.ts` (~15 lines)
- Modify: `packages/formspec-engine/src/index.ts` (replace ~30 lines with ~5)

- [ ] **Step 1: Add WASM binding for screener**

In `crates/formspec-wasm/src/lib.rs`:
```rust
#[wasm_bindgen(js_name = "evaluateScreener")]
pub fn evaluate_screener_wasm(
    definition_json: &str,
    answers_json: &str,
) -> Result<String, JsError> {
    let definition: Value = serde_json::from_str(definition_json)?;
    let answers: HashMap<String, Value> = serde_json::from_str(answers_json)?;
    let result = evaluate_screener(&definition, &answers);
    match result {
        Some(route) => Ok(serde_json::to_string(&serde_json::json!({
            "target": route.target,
            "label": route.label,
            "message": route.message,
        }))?),
        None => Ok("null".to_string()),
    }
}
```

- [ ] **Step 2: Add TS bridge function**

In `wasm-bridge.ts`:
```typescript
export function wasmEvaluateScreener(
    definition: unknown,
    answers: Record<string, unknown>,
): { target: string; label?: string; message?: string } | null {
    const result = wasm().evaluateScreener(JSON.stringify(definition), JSON.stringify(answers));
    return JSON.parse(result);
}
```

- [ ] **Step 3: Replace TS evaluateScreener with WASM call**

```typescript
public evaluateScreener(answers: Record<string, any>): { target: string; label?: string } | null {
    return wasmEvaluateScreener(this.definition, answers);
}
```

- [ ] **Step 4: Rebuild WASM, build TS, run tests**

- [ ] **Step 5: Commit**

---

## Task G: Switch sync assembly to WASM assembler

**Files:**
- Modify: `crates/formspec-core/src/assembler.rs` (handle array-format binds)
- Modify: `crates/formspec-wasm/src/lib.rs` (if needed)
- Modify: `packages/formspec-engine/src/index.ts` (replace ~350 lines with ~30)

**Blocker:** The Rust assembler at `assembler.rs:248` uses `.as_object()` for binds — it only handles object-format. The Formspec schema uses array-format (`[{ path: "...", ... }]`).

- [ ] **Step 1: Fix Rust assembler to handle array-format binds**

In `crates/formspec-core/src/assembler.rs`, replace the bind import section:

```rust
// Handle both array-format and object-format binds
if let Some(binds) = fragment.get("binds") {
    match binds {
        Value::Array(arr) => {
            // Array format: [{ "path": "...", "calculate": "..." }]
            for bind in arr {
                if let Some(path) = bind.get("path").and_then(|v| v.as_str()) {
                    let prefixed_path = apply_key_prefix(path, key_prefix);
                    let rewritten = rewrite_fel_in_bind(bind, key_prefix);
                    // Add to output binds array
                }
            }
        },
        Value::Object(obj) => {
            // Object format: { "path": { "calculate": "..." } }
            // existing code
        },
        _ => {}
    }
}
```

Also ensure the OUTPUT is array-format (matching the schema).

- [ ] **Step 2: Write failing Rust tests for array-format binds**

- [ ] **Step 3: Implement and verify**

- [ ] **Step 4: Replace TS sync assembly with WASM call**

```typescript
export function assembleDefinitionSync(
    definition: FormDefinition,
    resolver: Record<string, unknown> | ((url: string, version?: string) => unknown),
): AssemblyResult {
    // Pre-resolve all $refs into a fragments map
    const fragments = collectAndResolveFragments(definition, resolver);
    const result = wasmAssembleDefinition(definition, fragments);
    if (result.errors?.length > 0) {
        throw new Error(result.errors.join('\n'));
    }
    return { definition: result.definition, assembledFrom: result.assembledFrom ?? [] };
}
```

Keep the async variant as a pre-fetch wrapper:
```typescript
export async function assembleDefinition(
    definition: FormDefinition,
    resolver: DefinitionResolver,
): Promise<AssemblyResult> {
    const fragments = await collectAndResolveFragmentsAsync(definition, resolver);
    const result = wasmAssembleDefinition(definition, fragments);
    if (result.errors?.length > 0) {
        throw new Error(result.errors.join('\n'));
    }
    return { definition: result.definition, assembledFrom: result.assembledFrom ?? [] };
}
```

- [ ] **Step 5: Delete all TS assembly helpers** (~350 lines)

Delete: `performAssembly`, `prefixItems`, `collectAllKeys`, `collectKeyPaths`, `prefixPath`, `prefixBindPaths`, `prefixShapeTargets`, `filterBindsForFragment`, `filterShapesForFragment`, `rewriteBindFEL`, `rewriteAssemblyMessageTemplate`, `rewriteCompositionEntry`, `rewriteShapeFEL`, `importVariables`, `resolveItemsSync`, `resolveItemsAsync`, `assembleDefinitionSyncInternal`, `assembleDefinitionAsyncInternal`.

Keep: `rewriteFEL` (used by downstream packages for non-assembly FEL rewriting), `parseRef`, `collectRefs`.

- [ ] **Step 6: Run all tests (engine + assembler tests)**

- [ ] **Step 7: Commit**

---

## Verification Checklist

- [ ] `cargo test -p formspec-eval` — all pass
- [ ] `cargo test -p formspec-wasm` — all pass
- [ ] `npm -w formspec-engine run test:unit` — 622+ pass
- [ ] `npm -w formspec-core run build`
- [ ] `npm -w formspec-webcomponent run build`
- [ ] `npm -w formspec-studio-core run build`
- [ ] `npm -w formspec-mcp run build`
- [ ] No `patchDerivedMipSignals` in codebase
- [ ] No `patchBindValidationSignals` in codebase
- [ ] No `patchCalculatedSignals` in codebase
- [ ] No `patchVariableSignals` re-evaluation (only signal patching from WASM result)
- [ ] No 3-pass settle loop in `_evaluate`
- [ ] `index.ts` ≤ 3,200 lines (target: ~2,800 after assembly migration)
- [ ] `wc -l packages/formspec-engine/src/*.ts` — total ≤ 4,000

---

## Expected Line Count After Each Task

| Task | Lines Deleted | index.ts After |
|------|--------------|----------------|
| A (Rust precision) | 0 TS | 3,632 |
| B (delete calc+var) | ~96 | ~3,536 |
| C (delete MIP+validation) | ~66 | ~3,470 |
| D (delete loop+shapes) | ~70 | ~3,400 |
| E (delete relevance defaults) | ~26 | ~3,374 |
| F (WASM screener) | ~25 | ~3,349 |
| G (WASM assembly) | ~350 | **~2,999** |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Precision rounding differs between Rust `f64::round` and JS `Math.round` | Both use IEEE 754 round-half-to-even. Test with known edge cases (0.5, 1.5, 2.5). |
| Money currency unknown in Rust | Check TS `coerceFieldValue` for currency source. If from definition `currency` field, parse it in rebuild.rs. If hardcoded "USD", use same default. |
| Variable signal keys differ (WASM `varName` vs TS `#:varName`) | Map WASM keys to TS format in `patchDeltaSignals`. |
| Bare-identifier shapes stop working after shape supplement deletion | Check test fixtures. If bare identifiers exist, keep minimal fallback or fix Rust FEL to resolve variables as bare refs. |
| Assembly FEL rewriting differs between Rust and TS | Run all 56 assembler tests. If any fail, the Rust assembler's FEL rewriting is incomplete. |
