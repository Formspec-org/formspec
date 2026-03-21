//! Formspec Definition Evaluator — 4-phase batch processor.

pub mod convert;
pub mod nrb;
pub mod rebuild;
pub mod recalculate;
pub mod revalidate;
pub mod screener;
pub mod types;

use serde_json::Value;
use std::collections::HashMap;

// ── Re-exports: public API ──────────────────────────────────────

pub use convert::resolve_value_by_path;
pub use nrb::{apply_nrb, resolve_nrb};
pub use rebuild::{expand_repeat_instances, expand_wildcard_path, rebuild_item_tree};
pub use recalculate::{recalculate, topo_sort_variables};
pub use revalidate::revalidate;
pub use screener::{ScreenerRouteResult, evaluate_screener};
pub use types::{
    EvalTrigger, EvaluationResult, ExtensionConstraint, ItemInfo, NrbMode, ValidationResult,
    VariableDef, WhitespaceMode,
};

// ── Top-level orchestration ─────────────────────────────────────

/// Produce the final evaluation result.
/// Evaluate a definition with the default continuous trigger.
pub fn evaluate_definition(definition: &Value, data: &HashMap<String, Value>) -> EvaluationResult {
    evaluate_definition_with_trigger(definition, data, EvalTrigger::Continuous)
}

/// Evaluate a definition with an explicit trigger mode for shape timing.
pub fn evaluate_definition_with_trigger(
    definition: &Value,
    data: &HashMap<String, Value>,
    trigger: EvalTrigger,
) -> EvaluationResult {
    evaluate_definition_full(definition, data, trigger, &[])
}

/// Evaluate a definition with trigger mode and extension constraints from registries.
pub fn evaluate_definition_full(
    definition: &Value,
    data: &HashMap<String, Value>,
    trigger: EvalTrigger,
    extension_constraints: &[ExtensionConstraint],
) -> EvaluationResult {
    // Phase 0: Flatten nested data into indexed paths.
    // Converts `{"rows": [{"a": 1}]}` → `{"rows[0].a": 1}` so the FEL
    // evaluator can resolve `$rows[0].a` via flat key lookup.
    let flat_data = rebuild::augment_nested_data(data);

    // Phase 1: Rebuild
    let mut items = rebuild_item_tree(definition);

    // Phase 1.5: Seed initial values for missing fields (9e)
    let mut seeded_data = flat_data;
    rebuild::seed_initial_values(&items, &mut seeded_data);

    // Phase 1.6: Expand repeatable groups into concrete indexed instances
    expand_repeat_instances(&mut items, &seeded_data);

    // Phase 1.7: Apply wildcard binds to expanded concrete items
    let binds = definition.get("binds");
    rebuild::apply_wildcard_binds(&mut items, binds, &seeded_data);

    // Phase 2: Recalculate (with variables, whitespace, inheritance, scoped variables)
    let (mut values, var_values, cycle_err) = recalculate(&mut items, &seeded_data, definition);

    // Phase 3: Revalidate
    let shapes = definition.get("shapes").and_then(|v| v.as_array());
    let formspec_version = definition
        .get("$formspec")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0.0");
    let mut validations = revalidate(
        &items,
        &values,
        shapes.map(|v| v.as_slice()),
        trigger,
        extension_constraints,
        formspec_version,
    );

    // Surface circular variable dependency as a validation error
    if let Some(cycle_msg) = cycle_err {
        validations.push(ValidationResult {
            path: String::new(),
            severity: "error".to_string(),
            constraint_kind: "definition".to_string(),
            code: "CIRCULAR_DEPENDENCY".to_string(),
            message: cycle_msg,
            source: "definition".to_string(),
            shape_id: None,
        });
    }

    // Collect non-relevant fields
    let mut non_relevant = Vec::new();
    types::collect_non_relevant(&items, &mut non_relevant);

    // Phase 4: Apply NRB
    let default_nrb = definition
        .get("nonRelevantBehavior")
        .and_then(|v| v.as_str())
        .unwrap_or("remove");
    apply_nrb(&mut values, &items, default_nrb);

    // Convert variable FelValues to JSON for output
    let variables = var_values;

    EvaluationResult {
        values,
        validations,
        non_relevant,
        variables,
    }
}

// Also re-export parse_variables since it was pub
pub use rebuild::parse_variables;

// ── Integration tests ───────────────────────────────────────────
// Tests that exercise the full pipeline (calling evaluate_definition end-to-end)
// stay here in lib.rs.

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_evaluate_calculate() {
        let def = json!({
            "items": [
                { "key": "a", "dataType": "integer" },
                { "key": "b", "dataType": "integer" },
                { "key": "total", "dataType": "integer" }
            ],
            "binds": {
                "total": { "calculate": "$a + $b" }
            }
        });

        let mut data = HashMap::new();
        data.insert("a".to_string(), json!(10));
        data.insert("b".to_string(), json!(20));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.values.get("total"), Some(&json!(30)));
    }

    #[test]
    fn test_required_validation() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert!(!result.validations.is_empty());
        assert_eq!(result.validations[0].constraint_kind, "required");
        assert_eq!(result.validations[0].code, "REQUIRED");
        assert!(result.validations[0].message.contains("Required"));
    }

    #[test]
    fn test_relevance_suppresses_validation() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true", "relevant": "false" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert!(result.validations.is_empty());
        assert!(result.non_relevant.contains(&"name".to_string()));
    }

    #[test]
    fn test_constraint_validation() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(15));

        let result = evaluate_definition(&def, &data);
        assert!(!result.validations.is_empty());
        assert!(result.validations[0].message.contains("Constraint failed"));
    }

    #[test]
    fn test_relevance_and_inheritance() {
        let def = json!({
            "items": [
                {
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "parent": { "relevant": "false" },
                "parent.child": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        assert!(
            result.non_relevant.contains(&"parent".to_string()),
            "parent should be non-relevant"
        );
        assert!(
            result.non_relevant.contains(&"parent.child".to_string()),
            "child should be non-relevant due to parent"
        );
        assert!(
            result.validations.is_empty(),
            "no validations when parent is non-relevant"
        );
    }

    // ── NRB modes ────────────────────────────────────────────────

    #[test]
    fn test_nrb_remove_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false" }
            },
            "nonRelevantBehavior": "remove"
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        assert!(
            !result.values.contains_key("hidden"),
            "non-relevant field should be removed in 'remove' mode"
        );
    }

    #[test]
    fn test_nrb_empty_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "nonRelevantBehavior": "empty" }
            }
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("hidden"),
            Some(&Value::Null),
            "non-relevant field should be null in 'empty' mode"
        );
    }

    #[test]
    fn test_nrb_keep_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "nonRelevantBehavior": "keep" }
            }
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("hidden"),
            Some(&json!("secret")),
            "non-relevant field should keep value in 'keep' mode"
        );
    }

    // ── Variable evaluation ──────────────────────────────────────

    #[test]
    fn test_variable_evaluation_order() {
        let def = json!({
            "items": [
                { "key": "result", "dataType": "integer" }
            ],
            "binds": {
                "result": { "calculate": "@total" }
            },
            "variables": [
                { "name": "base", "expression": "10" },
                { "name": "total", "expression": "@base * 2" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("result"),
            Some(&json!(20)),
            "variable chain should evaluate correctly"
        );
    }

    // ── Whitespace normalization ─────────────────────────────────

    #[test]
    fn test_whitespace_trim() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "whitespace": "trim" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("  hello world  "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("name"),
            Some(&json!("hello world")),
            "trim should remove leading/trailing whitespace"
        );
    }

    #[test]
    fn test_whitespace_normalize() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "whitespace": "normalize" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("  hello   world  "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("name"),
            Some(&json!("hello world")),
            "normalize should collapse whitespace runs to single space"
        );
    }

    #[test]
    fn test_whitespace_remove() {
        let def = json!({
            "items": [
                { "key": "code", "dataType": "string" }
            ],
            "binds": {
                "code": { "whitespace": "remove" }
            }
        });

        let mut data = HashMap::new();
        data.insert("code".to_string(), json!("AB CD EF"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("code"),
            Some(&json!("ABCDEF")),
            "remove should strip all whitespace"
        );
    }

    // ── Full processing model integration ────────────────────────

    #[test]
    fn test_full_processing_model_integration() {
        let def = json!({
            "items": [
                { "key": "showDetails", "dataType": "boolean" },
                {
                    "key": "details",
                    "children": [
                        { "key": "firstName", "dataType": "string" },
                        { "key": "lastName", "dataType": "string" },
                        { "key": "fullName", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "details": { "relevant": "$showDetails" },
                "details.firstName": { "required": "true" },
                "details.lastName": { "required": "true" },
                "details.fullName": { "calculate": "$details.firstName & \" \" & $details.lastName" }
            }
        });

        let mut data = HashMap::new();
        data.insert("showDetails".to_string(), json!(false));

        let result = evaluate_definition(&def, &data);
        assert!(result.non_relevant.contains(&"details".to_string()));
        assert!(
            result
                .non_relevant
                .contains(&"details.firstName".to_string())
        );
        assert!(
            result
                .non_relevant
                .contains(&"details.lastName".to_string())
        );
        assert!(result.validations.is_empty());

        let mut data2 = HashMap::new();
        data2.insert("showDetails".to_string(), json!(true));
        data2.insert("details.firstName".to_string(), json!("John"));
        data2.insert("details.lastName".to_string(), json!("Doe"));

        let result2 = evaluate_definition(&def, &data2);
        assert!(result2.non_relevant.is_empty());
        assert!(result2.validations.is_empty());
        assert_eq!(
            result2.values.get("details.fullName"),
            Some(&json!("John Doe"))
        );
    }

    // ── Shape validation ─────────────────────────────────────────

    #[test]
    fn shape_failing_constraint_produces_validation_result() {
        let def = json!({
            "items": [
                { "key": "a", "dataType": "integer" },
                { "key": "b", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "b",
                "constraint": "$a > $b",
                "severity": "error",
                "message": "a must exceed b"
            }]
        });

        let mut data = HashMap::new();
        data.insert("a".to_string(), json!(1));
        data.insert("b".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1, "one shape violation expected");
        assert_eq!(result.validations[0].constraint_kind, "shape");
        assert_eq!(result.validations[0].path, "b");
        assert_eq!(result.validations[0].message, "a must exceed b");
        assert_eq!(result.validations[0].severity, "error");
    }

    #[test]
    fn shape_severity_warning_is_propagated() {
        let def = json!({
            "items": [
                { "key": "score", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "score",
                "constraint": "$score > 50",
                "severity": "warning",
                "message": "Score is low"
            }]
        });

        let mut data = HashMap::new();
        data.insert("score".to_string(), json!(30));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].severity, "warning",
            "shape severity must be 'warning' when declared as such"
        );
    }

    #[test]
    fn shape_active_when_false_suppresses_validation() {
        let def = json!({
            "items": [
                { "key": "mode", "dataType": "string" },
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "value",
                "constraint": "$value > 0",
                "activeWhen": "$mode = 'strict'",
                "severity": "error",
                "message": "Value must be positive in strict mode"
            }]
        });

        let mut data = HashMap::new();
        data.insert("mode".to_string(), json!("relaxed"));
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "shape must not fire when activeWhen evaluates to false"
        );
    }

    #[test]
    fn shape_active_when_true_allows_validation() {
        let def = json!({
            "items": [
                { "key": "mode", "dataType": "string" },
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "value",
                "constraint": "$value > 0",
                "activeWhen": "$mode = 'strict'",
                "severity": "error",
                "message": "Value must be positive"
            }]
        });

        let mut data = HashMap::new();
        data.insert("mode".to_string(), json!("strict"));
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(result.validations[0].message, "Value must be positive");
    }

    #[test]
    fn shape_passing_constraint_produces_no_result() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "x",
                "constraint": "$x > 0",
                "severity": "error",
                "message": "Must be positive"
            }]
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(42));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "passing shape constraint must not produce a validation result"
        );
    }

    #[test]
    fn shape_composition_operators_follow_ts_null_semantics() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" },
                { "key": "contactEmail", "dataType": "string" },
                { "key": "contactPhone", "dataType": "string" },
                { "key": "amount", "dataType": "integer" },
                { "key": "optA", "dataType": "boolean" },
                { "key": "optB", "dataType": "boolean" }
            ],
            "shapes": [
                {
                    "id": "adultCheck",
                    "target": "#",
                    "message": "Must be adult",
                    "constraint": "$age >= 18"
                },
                {
                    "id": "contactCheck",
                    "target": "#",
                    "message": "Need contact info",
                    "or": ["present($contactEmail)", "present($contactPhone)"]
                },
                {
                    "id": "composedEligibility",
                    "target": "#",
                    "message": "Composite failed",
                    "and": ["adultCheck", "contactCheck"]
                },
                {
                    "id": "datesDiffer",
                    "target": "#",
                    "message": "Dates must differ",
                    "not": "$amount > 0"
                },
                {
                    "id": "exactlyOne",
                    "target": "#",
                    "message": "Select exactly one",
                    "xone": ["$optA = true", "$optB = true", "$age > 99"]
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("contactEmail".to_string(), json!("person@example.org"));
        data.insert("optA".to_string(), json!(true));

        let result = evaluate_definition(&def, &data);

        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Composite failed"),
            "null adultCheck should pass inside and-composition when contactCheck passes"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Need contact info"),
            "or-composition should pass when one branch passes"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Dates must differ"),
            "not-composition should pass when the inner comparison is null"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Select exactly one"),
            "xone should count one true branch and ignore null branches"
        );
    }

    // ── Constraint edge cases ────────────────────────────────────

    #[test]
    fn constraint_returning_true_passes() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(21));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "constraint returning true must produce no validation error"
        );
    }

    #[test]
    fn constraint_returning_null_passes() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let data = HashMap::new();

        let result = evaluate_definition(&def, &data);
        let constraint_violations: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Constraint"))
            .collect();
        assert!(
            constraint_violations.is_empty(),
            "constraint returning null must pass (spec S3.8 L1575)"
        );
    }

    #[test]
    fn bind_constraint_uses_constraint_message_when_present() {
        let def = json!({
            "items": [
                { "key": "amount", "dataType": "integer" }
            ],
            "binds": {
                "amount": {
                    "constraint": "$amount > 0",
                    "constraintMessage": "Must be positive"
                }
            }
        });

        let mut data = HashMap::new();
        data.insert("amount".to_string(), json!(0));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(result.validations[0].message, "Must be positive");
    }

    #[test]
    fn required_with_empty_string_fails() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!(""));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "empty string must fail required check"
        );
        assert_eq!(result.validations[0].constraint_kind, "required");
        assert!(result.validations[0].message.contains("Required"));
    }

    #[test]
    fn required_with_whitespace_only_string_fails() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("   "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "whitespace-only string must fail required check (trim then empty)"
        );
    }

    // ── Calculate continues when non-relevant ────────────────────

    #[test]
    fn calculate_continues_when_non_relevant() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "integer" },
                { "key": "visible", "dataType": "integer" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "calculate": "1 + 1", "nonRelevantBehavior": "keep" },
                "visible": { "calculate": "$hidden * 10" }
            }
        });

        let data = HashMap::new();

        let result = evaluate_definition(&def, &data);

        assert!(result.non_relevant.contains(&"hidden".to_string()));
        assert_eq!(
            result.values.get("visible"),
            Some(&json!(20)),
            "non-relevant field's calculated value must be available to downstream expressions"
        );
        assert_eq!(
            result.values.get("hidden"),
            Some(&json!(2)),
            "non-relevant field with NRB=keep should retain its calculated value"
        );
    }

    #[test]
    fn non_relevant_field_suppresses_validation_even_with_calculate() {
        let def = json!({
            "items": [
                { "key": "field", "dataType": "integer" }
            ],
            "binds": {
                "field": {
                    "relevant": "false",
                    "calculate": "0 - 5",
                    "constraint": "$field > 0",
                    "nonRelevantBehavior": "keep"
                }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        assert!(
            result.validations.is_empty(),
            "validation must be suppressed for non-relevant fields even when calculate runs"
        );
    }

    // ── Array-style binds ────────────────────────────────────────

    #[test]
    fn array_style_binds_are_resolved() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" },
                { "key": "greeting", "dataType": "string" }
            ],
            "binds": [
                { "path": "name", "required": "true" },
                { "path": "greeting", "calculate": "'Hello ' & $name" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("Alice"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("greeting"),
            Some(&json!("Hello Alice")),
            "array-style binds should be resolved and calculate should work"
        );
    }

    #[test]
    fn array_style_binds_required_validation() {
        let def = json!({
            "items": [
                { "key": "email", "dataType": "string" }
            ],
            "binds": [
                { "path": "email", "required": "true" }
            ]
        });

        let data = HashMap::new();

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "required validation must work with array-style binds"
        );
        assert!(result.validations[0].message.contains("Required"));
    }

    // ── json_to_fel / fel_to_json round-trip ─────────────────────

    #[test]
    fn round_trip_null() {
        let json_val = json!(null);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    #[test]
    fn round_trip_boolean_true() {
        let json_val = json!(true);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    #[test]
    fn round_trip_boolean_false() {
        let json_val = json!(false);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    #[test]
    fn round_trip_string() {
        let json_val = json!("hello world");
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    #[test]
    fn round_trip_number_integer() {
        let json_val = json!(42);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    #[test]
    fn round_trip_number_decimal() {
        let json_val = json!(3.14);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        let back_f = back.as_f64().expect("should be a number");
        assert!(
            (back_f - 3.14).abs() < 0.001,
            "decimal round-trip: got {back_f}"
        );
    }

    #[test]
    fn round_trip_array() {
        let json_val = json!([1, "two", true, null]);
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back.as_array().unwrap().len(), 4);
        assert_eq!(back[0], json!(1));
        assert_eq!(back[1], json!("two"));
        assert_eq!(back[2], json!(true));
        assert_eq!(back[3], json!(null));
    }

    #[test]
    fn round_trip_object() {
        let json_val = json!({"name": "Alice", "age": 30});
        let fel_val = fel_core::json_to_fel(&json_val);
        let back = fel_core::fel_to_json(&fel_val);
        assert_eq!(back.get("name"), Some(&json!("Alice")));
        assert_eq!(back.get("age"), Some(&json!(30)));
    }

    #[test]
    fn round_trip_money() {
        use rust_decimal::prelude::FromPrimitive;
        let money = fel_core::FelValue::Money(fel_core::FelMoney {
            amount: rust_decimal::Decimal::from_f64(99.99).unwrap(),
            currency: "USD".to_string(),
        });
        let json_val = fel_core::fel_to_json(&money);
        assert_eq!(json_val.get("currency"), Some(&json!("USD")));
        let amount = json_val.get("amount").and_then(|v| v.as_f64()).unwrap();
        assert!((amount - 99.99).abs() < 0.01, "money amount round-trip");
    }

    #[test]
    fn round_trip_date() {
        let date = fel_core::FelValue::Date(fel_core::FelDate::Date {
            year: 2025,
            month: 6,
            day: 15,
        });
        let json_val = fel_core::fel_to_json(&date);
        assert_eq!(json_val, json!("2025-06-15"));
    }

    // ── Repeatable groups / indexed paths ────────────────────────

    #[test]
    fn repeatable_group_with_indexed_binds() {
        let def = json!({
            "items": [
                {
                    "key": "items",
                    "children": [
                        { "key": "qty", "dataType": "integer" },
                        { "key": "price", "dataType": "decimal" },
                        { "key": "total", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "items.total": { "calculate": "$items.qty * $items.price" }
            }
        });

        let mut data = HashMap::new();
        data.insert("items.qty".to_string(), json!(3));
        data.insert("items.price".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("items.total"),
            Some(&json!(30)),
            "repeatable group child calculate should evaluate"
        );
    }

    // ── Error resilience ─────────────────────────────────────────

    #[test]
    fn malformed_fel_in_calculate_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "binds": {
                "x": { "calculate": "!!! invalid ((( syntax" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert!(
            result.values.get("x").is_none() || result.values.get("x") == Some(&Value::Null),
            "malformed calculate should degrade gracefully"
        );
    }

    #[test]
    fn malformed_fel_in_constraint_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "binds": {
                "x": { "constraint": "((( broken >>>" }
            }
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        let constraint_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Constraint"))
            .collect();
        assert!(
            constraint_errors.is_empty(),
            "malformed constraint expression should not produce a validation error"
        );
    }

    #[test]
    fn malformed_fel_in_relevance_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "string" }
            ],
            "binds": {
                "x": { "relevant": "<<< garbage >>>" }
            }
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!("hello"));

        let result = evaluate_definition(&def, &data);
        assert!(
            !result.non_relevant.contains(&"x".to_string()),
            "malformed relevance should default to true (field stays relevant)"
        );
    }

    // ── ValidationResult field specifics ─────────────────────────

    #[test]
    fn validation_result_required_kind_is_bind() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].constraint_kind, "required",
            "required violations should have constraint_kind='required'"
        );
        assert_eq!(result.validations[0].code, "REQUIRED");
        assert_eq!(result.validations[0].severity, "error");
    }

    #[test]
    fn validation_result_constraint_kind_is_bind() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 0" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(-1));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].constraint_kind, "constraint",
            "constraint violations should have constraint_kind='constraint'"
        );
        assert_eq!(result.validations[0].code, "CONSTRAINT_FAILED");
    }

    #[test]
    fn validation_result_shape_kind_is_shape() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "x",
                "constraint": "$x > 100",
                "severity": "error",
                "message": "x too small"
            }]
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].constraint_kind, "shape",
            "shape violations should have constraint_kind='shape'"
        );
    }

    // ── Variable scope ───────────────────────────────────────────

    #[test]
    fn variable_scoped_to_non_ancestor_is_invisible() {
        let def = json!({
            "items": [
                { "key": "result", "dataType": "integer" }
            ],
            "binds": {
                "result": { "calculate": "@scoped_var" }
            },
            "variables": [
                { "name": "scoped_var", "expression": "42", "scope": "local" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        let val = result.values.get("result");
        assert!(
            val.is_none() || val == Some(&Value::Null),
            "scoped variable at non-ancestor 'local' should not be visible to 'result'"
        );
        assert_eq!(result.variables.get("scoped_var"), Some(&json!(42)));
    }

    // ── Required edge cases ──────────────────────────────────────

    #[test]
    fn required_with_zero_passes() {
        let def = json!({
            "items": [{ "key": "count", "dataType": "integer" }],
            "binds": { "count": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("count".to_string(), json!(0));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "0 is not empty — required should pass"
        );
    }

    #[test]
    fn required_with_false_passes() {
        let def = json!({
            "items": [{ "key": "flag", "dataType": "boolean" }],
            "binds": { "flag": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("flag".to_string(), json!(false));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "false is not empty — required should pass"
        );
    }

    #[test]
    fn required_with_empty_array_fails() {
        let def = json!({
            "items": [{ "key": "tags", "dataType": "string" }],
            "binds": { "tags": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("tags".to_string(), json!([]));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "empty array is empty — required should fail"
        );
        assert_eq!(result.validations[0].constraint_kind, "required");
    }

    #[test]
    fn required_with_empty_object_passes() {
        let def = json!({
            "items": [{ "key": "meta", "dataType": "string" }],
            "binds": { "meta": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("meta".to_string(), json!({}));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "empty object is not in the spec's 'empty' list — required should pass"
        );
    }

    #[test]
    fn required_with_non_empty_array_passes() {
        let def = json!({
            "items": [{ "key": "tags", "dataType": "string" }],
            "binds": { "tags": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("tags".to_string(), json!(["a"]));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "non-empty array passes required"
        );
    }

    // ── Multiple shapes same path ────────────────────────────────

    #[test]
    fn multiple_shapes_same_path_accumulate() {
        let def = json!({
            "items": [
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "value",
                    "constraint": "$value > 0",
                    "severity": "error",
                    "message": "Must be positive"
                },
                {
                    "target": "value",
                    "constraint": "$value < 100",
                    "severity": "warning",
                    "message": "Should be under 100"
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert_eq!(shape_results.len(), 1, "only the > 0 shape should fail");
        assert_eq!(shape_results[0].message, "Must be positive");
        assert_eq!(shape_results[0].severity, "error");
    }

    #[test]
    fn multiple_shapes_both_fail() {
        let def = json!({
            "items": [
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "value",
                    "constraint": "$value > 10",
                    "severity": "error",
                    "message": "Must be greater than 10"
                },
                {
                    "target": "value",
                    "constraint": "$value < 0",
                    "severity": "warning",
                    "message": "Must be negative"
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("value".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert_eq!(
            shape_results.len(),
            2,
            "both shapes should fire independently"
        );

        let messages: Vec<&str> = shape_results.iter().map(|r| r.message.as_str()).collect();
        assert!(messages.contains(&"Must be greater than 10"));
        assert!(messages.contains(&"Must be negative"));
    }

    #[test]
    fn multiple_shapes_preserve_severities() {
        let def = json!({
            "items": [
                { "key": "score", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "score",
                    "constraint": "$score >= 0",
                    "severity": "error",
                    "message": "Score must not be negative"
                },
                {
                    "target": "score",
                    "constraint": "$score <= 100",
                    "severity": "info",
                    "message": "Score should be at most 100"
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("score".to_string(), json!(150));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert_eq!(shape_results.len(), 1);
        assert_eq!(shape_results[0].severity, "info");
        assert_eq!(shape_results[0].message, "Score should be at most 100");
    }

    #[test]
    fn shape_suppressed_when_target_non_relevant() {
        let def = json!({
            "items": [
                { "key": "hidden_field", "dataType": "string" }
            ],
            "binds": {
                "hidden_field": { "relevant": "false" }
            },
            "shapes": [
                {
                    "target": "hidden_field",
                    "constraint": "false",
                    "severity": "error",
                    "message": "Should never appear"
                }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert!(
            shape_results.is_empty(),
            "shape targeting non-relevant field must be suppressed"
        );
    }

    #[test]
    fn shape_root_target_always_evaluated() {
        let def = json!({
            "items": [
                { "key": "a", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "#",
                    "constraint": "false",
                    "severity": "error",
                    "message": "Root shape fires"
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("a".to_string(), json!(1));
        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert_eq!(shape_results.len(), 1, "root shapes must always fire");
    }

    #[test]
    fn circular_variable_deps_produce_validation_error() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "variables": [
                { "name": "a", "expression": "@b + 1" },
                { "name": "b", "expression": "@a + 1" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        let cycle_errors: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "definition" && v.message.contains("ircular"))
            .collect();
        assert!(
            !cycle_errors.is_empty(),
            "circular variable deps must produce a validation error"
        );
        assert_eq!(cycle_errors[0].severity, "error");
    }

    // ── Shape timing (EvalTrigger) ──────────────────────────────

    fn shape_timing_def() -> Value {
        json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "id": "s1",
                    "target": "#",
                    "timing": "continuous",
                    "constraint": "false",
                    "severity": "error",
                    "message": "Continuous shape"
                },
                {
                    "id": "s2",
                    "target": "#",
                    "timing": "submit",
                    "constraint": "false",
                    "severity": "error",
                    "message": "Submit shape"
                },
                {
                    "id": "s3",
                    "target": "#",
                    "timing": "demand",
                    "constraint": "false",
                    "severity": "error",
                    "message": "Demand shape"
                }
            ]
        })
    }

    #[test]
    fn trigger_continuous_skips_submit_and_demand_shapes() {
        let def = shape_timing_def();
        let data = HashMap::new();
        let result = evaluate_definition_with_trigger(&def, &data, EvalTrigger::Continuous);
        let msgs: Vec<&str> = result
            .validations
            .iter()
            .map(|v| v.message.as_str())
            .collect();
        assert!(msgs.contains(&"Continuous shape"));
        assert!(!msgs.contains(&"Submit shape"));
        assert!(!msgs.contains(&"Demand shape"));
    }

    #[test]
    fn trigger_submit_includes_continuous_and_submit_but_not_demand() {
        let def = shape_timing_def();
        let data = HashMap::new();
        let result = evaluate_definition_with_trigger(&def, &data, EvalTrigger::Submit);
        let msgs: Vec<&str> = result
            .validations
            .iter()
            .map(|v| v.message.as_str())
            .collect();
        assert!(msgs.contains(&"Continuous shape"));
        assert!(msgs.contains(&"Submit shape"));
        assert!(!msgs.contains(&"Demand shape"));
    }

    #[test]
    fn trigger_disabled_skips_all_validation() {
        let def = shape_timing_def();
        let data = HashMap::new();
        let result = evaluate_definition_with_trigger(&def, &data, EvalTrigger::Disabled);
        assert!(
            result.validations.is_empty(),
            "disabled trigger should skip all validation"
        );
    }

    // ── Screener ─────────────────────────────────────────────────

    #[test]
    fn screener_answers_do_not_pollute_main_evaluation() {
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.org/screener",
            "version": "1.0.0",
            "status": "active",
            "title": "Test",
            "items": [
                { "type": "field", "key": "name", "dataType": "string" }
            ],
            "screener": {
                "items": [
                    { "type": "field", "key": "orgType", "dataType": "choice" }
                ],
                "routes": [
                    {
                        "condition": "$orgType = 'nonprofit'",
                        "target": "https://example.org/forms/new|1.0.0",
                        "label": "New"
                    },
                    {
                        "condition": "true",
                        "target": "https://example.org/forms/general|1.0.0",
                        "label": "General"
                    }
                ]
            }
        });
        let mut answers = HashMap::new();
        answers.insert("orgType".to_string(), json!("nonprofit"));

        let _route = evaluate_screener(&def, &answers);

        let main_result = evaluate_definition(&def, &HashMap::new());
        assert!(!main_result.values.contains_key("orgType"));
    }

    // ── 9a: excludedValue ────────────────────────────────────────

    #[test]
    fn excluded_value_null_hides_from_shapes() {
        let def = json!({
            "items": [
                { "key": "show", "dataType": "boolean" },
                { "key": "extra", "dataType": "integer" }
            ],
            "binds": [
                { "path": "extra", "relevant": "$show", "excludedValue": "null", "nonRelevantBehavior": "keep" }
            ],
            "shapes": [{
                "id": "s1", "target": "#", "severity": "error",
                "message": "Extra must be positive",
                "constraint": "$extra == null or $extra > 0"
            }]
        });
        let mut data = HashMap::new();
        data.insert("show".to_string(), json!(false));
        data.insert("extra".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        let shape_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert!(
            shape_errors.is_empty(),
            "shape should pass because excluded extra is null in FEL"
        );
        assert_eq!(result.values.get("extra"), Some(&json!(-5)));
    }

    // ── 9b: Shape-id composition ─────────────────────────────────

    #[test]
    fn or_composition_with_shape_id_reference() {
        let def = json!({
            "items": [
                { "key": "email", "dataType": "string" },
                { "key": "phone", "dataType": "string" }
            ],
            "shapes": [
                {
                    "id": "hasEmail", "target": "#", "severity": "error",
                    "message": "Email required", "constraint": "present($email)"
                },
                {
                    "id": "hasPhone", "target": "#", "severity": "error",
                    "message": "Phone required", "constraint": "present($phone)"
                },
                {
                    "id": "contactable", "target": "#", "severity": "error",
                    "message": "Need email or phone",
                    "or": ["hasEmail", "hasPhone"]
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("email".to_string(), json!(null));
        data.insert("phone".to_string(), json!(null));
        let result = evaluate_definition(&def, &data);
        let contactable_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message == "Need email or phone")
            .collect();
        assert_eq!(
            contactable_errors.len(),
            1,
            "should fail when neither present"
        );

        let mut data2 = HashMap::new();
        data2.insert("email".to_string(), json!("a@b.com"));
        data2.insert("phone".to_string(), json!(null));
        let result2 = evaluate_definition(&def, &data2);
        let contactable_ok: Vec<_> = result2
            .validations
            .iter()
            .filter(|v| v.message == "Need email or phone")
            .collect();
        assert!(contactable_ok.is_empty(), "should pass when email present");
    }

    // ── 9c: Default on relevance transition ──────────────────────

    #[test]
    fn default_applies_on_relevance_transition() {
        let def = json!({
            "items": [
                { "key": "show", "dataType": "boolean" },
                { "key": "amount", "dataType": "decimal" }
            ],
            "binds": [
                { "path": "amount", "relevant": "$show", "default": 0 }
            ]
        });

        let mut data = HashMap::new();
        data.insert("show".to_string(), json!(false));
        let result1 = evaluate_definition(&def, &data);
        assert!(!result1.values.contains_key("amount"));
    }

    // ── 9d: Nested bare $ in group bind paths ────────────────────

    #[test]
    fn bare_dollar_resolves_nested_group_path() {
        let def = json!({
            "items": [
                {
                    "type": "group", "key": "expenditures",
                    "children": [
                        { "type": "field", "key": "employment", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": [
                { "path": "expenditures.employment", "constraint": "$ >= 0", "constraintMessage": "Cannot be negative" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("expenditures".to_string(), json!({"employment": 45000}));
        let result = evaluate_definition(&def, &data);
        let errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.source == "bind" && v.message.contains("negative"))
            .collect();
        assert!(errors.is_empty(), "positive value should pass constraint");

        let mut data2 = HashMap::new();
        data2.insert("expenditures".to_string(), json!({"employment": -100}));
        let result2 = evaluate_definition(&def, &data2);
        let errors2: Vec<_> = result2
            .validations
            .iter()
            .filter(|v| v.source == "bind" && v.message.contains("negative"))
            .collect();
        assert_eq!(errors2.len(), 1, "negative value should fail constraint");
    }

    // ── 9e: initialValue ─────────────────────────────────────────

    #[test]
    fn initial_value_literal_seeds_missing_field() {
        let def = json!({
            "items": [
                { "key": "status", "dataType": "string", "initialValue": "draft" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(result.values.get("status"), Some(&json!("draft")));
    }

    #[test]
    fn initial_value_not_applied_when_field_present() {
        let def = json!({
            "items": [
                { "key": "status", "dataType": "string", "initialValue": "draft" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("status".to_string(), json!("final"));
        let result = evaluate_definition(&def, &data);
        assert_eq!(result.values.get("status"), Some(&json!("final")));
    }

    #[test]
    fn initial_value_fel_expression() {
        let def = json!({
            "items": [
                { "key": "base", "dataType": "integer" },
                { "key": "doubled", "dataType": "integer", "initialValue": "=$base * 2" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("base".to_string(), json!(10));
        let result = evaluate_definition(&def, &data);
        assert_eq!(result.values.get("doubled"), Some(&json!(20)));
    }

    // ── Wildcard bind paths + per-instance eval ──────────────────

    #[test]
    fn wildcard_bind_per_instance_calculate() {
        let def = json!({
            "items": [
                {
                    "key": "items",
                    "repeatable": true,
                    "children": [
                        { "key": "qty", "dataType": "integer" },
                        { "key": "price", "dataType": "decimal" },
                        { "key": "total", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "items[*].total": { "calculate": "$items[*].qty * $items[*].price" }
            }
        });

        let mut data = HashMap::new();
        data.insert("items[0].qty".to_string(), json!(2));
        data.insert("items[0].price".to_string(), json!(10));
        data.insert("items[1].qty".to_string(), json!(5));
        data.insert("items[1].price".to_string(), json!(3));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("items[0].total"),
            Some(&json!(20)),
            "instance 0: 2 * 10 = 20"
        );
        assert_eq!(
            result.values.get("items[1].total"),
            Some(&json!(15)),
            "instance 1: 5 * 3 = 15"
        );
    }

    #[test]
    fn wildcard_bind_per_instance_constraint() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "amount", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "rows[*].amount": {
                    "constraint": "$ >= 0",
                    "constraintMessage": "Amount must be non-negative"
                }
            }
        });

        let mut data = HashMap::new();
        data.insert("rows[0].amount".to_string(), json!(100));
        data.insert("rows[1].amount".to_string(), json!(-5));
        data.insert("rows[2].amount".to_string(), json!(50));

        let result = evaluate_definition(&def, &data);
        let errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.source == "bind" && v.message.contains("non-negative"))
            .collect();
        assert_eq!(errors.len(), 1, "only instance 1 should fail");
        assert_eq!(errors[0].path, "rows[1].amount");
    }

    #[test]
    fn wildcard_shape_target_expands_to_concrete_paths() {
        let def = json!({
            "items": [
                {
                    "key": "entries",
                    "repeatable": true,
                    "children": [
                        { "key": "value", "dataType": "integer" }
                    ]
                }
            ],
            "shapes": [{
                "id": "s1",
                "target": "entries[*].value",
                "constraint": "$ > 0",
                "severity": "error",
                "message": "Must be positive"
            }]
        });

        let mut data = HashMap::new();
        data.insert("entries[0].value".to_string(), json!(10));
        data.insert("entries[1].value".to_string(), json!(-3));
        data.insert("entries[2].value".to_string(), json!(7));

        let result = evaluate_definition(&def, &data);
        let shape_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape")
            .collect();
        assert_eq!(shape_errors.len(), 1, "only instance 1 should fail");
        assert_eq!(
            shape_errors[0].path, "entries[1].value",
            "path should be concrete 0-based"
        );
    }

    #[test]
    fn wildcard_shape_row_scoped_sibling_references() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "start", "dataType": "integer" },
                        { "key": "end", "dataType": "integer" }
                    ]
                }
            ],
            "shapes": [{
                "id": "s1",
                "target": "rows[*].end",
                "constraint": "$rows[*].end > $rows[*].start",
                "severity": "error",
                "message": "End must exceed start"
            }]
        });

        let mut data = HashMap::new();
        data.insert("rows[0].start".to_string(), json!(1));
        data.insert("rows[0].end".to_string(), json!(10));
        data.insert("rows[1].start".to_string(), json!(20));
        data.insert("rows[1].end".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        let shape_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.constraint_kind == "shape" && v.message == "End must exceed start")
            .collect();
        assert_eq!(shape_errors.len(), 1, "only row 1 should fail");
        assert_eq!(shape_errors[0].path, "rows[1].end");
    }

    // ── Scoped variables ─────────────────────────────────────────

    #[test]
    fn scoped_variable_visible_within_group() {
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        { "key": "field", "dataType": "integer" }
                    ]
                }
            ],
            "binds": {
                "section.field": { "calculate": "@rate * 2" }
            },
            "variables": [
                { "name": "rate", "expression": "10", "scope": "section" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("section.field"),
            Some(&json!(20)),
            "scoped variable @rate should be visible to section.field"
        );
    }

    #[test]
    fn scoped_variable_invisible_outside_group() {
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        { "key": "inner", "dataType": "integer" }
                    ]
                },
                { "key": "outer", "dataType": "integer" }
            ],
            "binds": {
                "section.inner": { "calculate": "@rate * 2" },
                "outer": { "calculate": "@rate * 3" }
            },
            "variables": [
                { "name": "rate", "expression": "10", "scope": "section" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("section.inner"),
            Some(&json!(20)),
            "inner field within scope should see @rate"
        );
        let outer_val = result.values.get("outer");
        assert!(
            outer_val.is_none() || outer_val == Some(&Value::Null),
            "outer field outside scope should not see @rate (got {:?})",
            outer_val
        );
    }

    #[test]
    fn global_scope_variable_visible_everywhere() {
        let def = json!({
            "items": [
                {
                    "key": "group",
                    "children": [
                        { "key": "nested", "dataType": "integer" }
                    ]
                },
                { "key": "top", "dataType": "integer" }
            ],
            "binds": {
                "group.nested": { "calculate": "@globalRate * 2" },
                "top": { "calculate": "@globalRate * 3" }
            },
            "variables": [
                { "name": "globalRate", "expression": "5", "scope": "#" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("group.nested"),
            Some(&json!(10)),
            "nested field should see global variable"
        );
        assert_eq!(
            result.values.get("top"),
            Some(&json!(15)),
            "top-level field should see global variable"
        );
    }

    #[test]
    fn scoped_variable_nearest_scope_wins() {
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        { "key": "field", "dataType": "integer" }
                    ]
                },
                { "key": "top", "dataType": "integer" }
            ],
            "binds": {
                "section.field": { "calculate": "@rate" },
                "top": { "calculate": "@rate" }
            },
            "variables": [
                { "name": "rate", "expression": "100", "scope": "#" },
                { "name": "rate", "expression": "999", "scope": "section" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("section.field"),
            Some(&json!(999)),
            "nearest scope (section) should win for section.field"
        );
        assert_eq!(
            result.values.get("top"),
            Some(&json!(100)),
            "global scope should apply for top-level field"
        );
    }

    // ── Edge cases: wildcard binds ───────────────────────────────

    #[test]
    fn wildcard_bind_array_style() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "x", "dataType": "integer" },
                        { "key": "doubled", "dataType": "integer" }
                    ]
                }
            ],
            "binds": [
                { "path": "rows[*].doubled", "calculate": "$rows[*].x * 2" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("rows[0].x".to_string(), json!(5));
        data.insert("rows[1].x".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("rows[0].doubled"),
            Some(&json!(10)),
            "array-style wildcard bind: 5 * 2 = 10"
        );
        assert_eq!(
            result.values.get("rows[1].doubled"),
            Some(&json!(20)),
            "array-style wildcard bind: 10 * 2 = 20"
        );
    }

    #[test]
    fn wildcard_bind_zero_instances() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "val", "dataType": "integer" }
                    ]
                }
            ],
            "binds": {
                "rows[*].val": { "constraint": "$ > 0", "constraintMessage": "fail" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "zero instances should produce no validation errors"
        );
    }

    #[test]
    fn wildcard_bind_required_per_instance() {
        let def = json!({
            "items": [
                {
                    "key": "items",
                    "repeatable": true,
                    "children": [
                        { "key": "name", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "items[*].name": { "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("items[0].name".to_string(), json!("Alice"));
        data.insert("items[1].name".to_string(), json!(""));

        let result = evaluate_definition(&def, &data);
        let req_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Required"))
            .collect();
        assert_eq!(req_errors.len(), 1, "only instance 1 should fail required");
        assert_eq!(req_errors[0].path, "items[1].name");
    }

    #[test]
    fn wildcard_bind_bare_sibling_relevance_suppresses_required() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "enabled", "dataType": "boolean" },
                        { "key": "note", "dataType": "string" }
                    ]
                }
            ],
            "binds": [
                { "path": "rows[*].note", "relevant": "$enabled" },
                { "path": "rows[*].note", "required": "true" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("rows[0].enabled".to_string(), json!(false));
        data.insert("rows[0].note".to_string(), json!(""));

        let result = evaluate_definition(&def, &data);
        let req_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Required"))
            .collect();
        assert!(
            req_errors.is_empty(),
            "non-relevant field should suppress required: {:?}",
            req_errors
        );
    }

    #[test]
    fn wildcard_bind_bare_sibling_nested_data() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "enabled", "dataType": "boolean" },
                        { "key": "note", "dataType": "string" }
                    ]
                }
            ],
            "binds": [
                { "path": "rows[*].note", "relevant": "$enabled" },
                { "path": "rows[*].note", "required": "true" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("rows".to_string(), json!([{"enabled": false, "note": ""}]));

        let result = evaluate_definition_with_trigger(&def, &data, EvalTrigger::Continuous);
        let req_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Required"))
            .collect();
        assert!(
            req_errors.is_empty(),
            "nested data: non-relevant field should suppress required: {:?}",
            req_errors
        );
    }

    // ── Edge cases: scoped variables ─────────────────────────────

    #[test]
    fn variable_default_scope_is_global() {
        let def = json!({
            "items": [
                {
                    "key": "group",
                    "children": [
                        { "key": "field", "dataType": "integer" }
                    ]
                }
            ],
            "binds": {
                "group.field": { "calculate": "@v" }
            },
            "variables": [
                { "name": "v", "expression": "77" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("group.field"),
            Some(&json!(77)),
            "variable with no scope should default to global (#)"
        );
    }

    // ── Bug regression tests ─────────────────────────────────────

    #[test]
    fn scoped_variable_visible_inside_repeatable_group() {
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        {
                            "key": "rows",
                            "repeatable": true,
                            "children": [
                                { "key": "amount", "dataType": "integer" },
                                { "key": "adjusted", "dataType": "integer" }
                            ]
                        }
                    ]
                }
            ],
            "binds": {
                "section.rows[*].adjusted": { "calculate": "$amount * @rate" }
            },
            "variables": [
                { "name": "rate", "expression": "2", "scope": "section" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("section.rows[0].amount".to_string(), json!(100));
        data.insert("section.rows[1].amount".to_string(), json!(200));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("section.rows[0].adjusted"),
            Some(&json!(200)),
            "scoped @rate should be visible inside repeatable group children"
        );
        assert_eq!(
            result.values.get("section.rows[1].adjusted"),
            Some(&json!(400)),
            "scoped @rate should be visible inside second repeat instance"
        );
    }

    #[test]
    fn bare_name_alias_does_not_shadow_top_level_field() {
        let def = json!({
            "items": [
                {
                    "key": "rows",
                    "repeatable": true,
                    "children": [
                        { "key": "amount", "dataType": "decimal" }
                    ]
                },
                { "key": "amount", "dataType": "decimal" },
                { "key": "result", "dataType": "decimal" }
            ],
            "binds": {
                "result": { "calculate": "$amount" }
            }
        });

        let mut data = HashMap::new();
        data.insert("amount".to_string(), json!(999));
        data.insert("rows[0].amount".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("amount"),
            Some(&json!(999)),
            "top-level field 'amount' must survive bare-name alias cleanup"
        );
        assert_eq!(
            result.values.get("result"),
            Some(&json!(999)),
            "calculate referencing $amount should use top-level value, not null from alias cleanup"
        );
    }
}
