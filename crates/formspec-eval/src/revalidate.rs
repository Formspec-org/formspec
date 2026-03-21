//! Phase 3: Revalidate — validate all constraints and shapes.

use fancy_regex::Regex;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use fel_core::{FelValue, FormspecEnvironment, evaluate, json_to_fel, parse};

use crate::convert::resolve_value_by_path;
use crate::rebuild::{
    detect_repeat_count, expand_wildcard_path, instantiate_wildcard_expr, is_repeat_group_array,
    is_wildcard_bind, wildcard_base,
};
use crate::recalculate::eval_bool;
use crate::types::{EvalTrigger, ExtensionConstraint, ItemInfo, ValidationResult, find_item_by_path};

/// Validate all constraints and shapes.
pub fn revalidate(
    items: &[ItemInfo],
    values: &HashMap<String, Value>,
    shapes: Option<&[Value]>,
    trigger: EvalTrigger,
    extension_constraints: &[ExtensionConstraint],
    formspec_version: &str,
) -> Vec<ValidationResult> {
    let mut results = Vec::new();

    if trigger == EvalTrigger::Disabled {
        return results;
    }

    let mut env = build_validation_env(values);

    // 9a: Apply excludedValue — non-relevant fields with excludedValue="null" appear as null in FEL
    apply_excluded_values_to_env(items, &mut env);

    let shapes_by_id: HashMap<String, &Value> = shapes
        .unwrap_or(&[])
        .iter()
        .filter_map(|shape| {
            shape
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| (id.to_string(), shape))
        })
        .collect();

    // Build extension lookup map
    let ext_by_name: HashMap<&str, &ExtensionConstraint> = extension_constraints
        .iter()
        .map(|c| (c.name.as_str(), c))
        .collect();

    // Bind constraints + extension constraints
    validate_items(items, &mut env, values, &ext_by_name, formspec_version, &mut results);

    // Shape rules — filtered by timing
    if let Some(shapes) = shapes {
        for shape in shapes {
            let timing = shape
                .get("timing")
                .and_then(|v| v.as_str())
                .unwrap_or("continuous");
            match trigger {
                EvalTrigger::Disabled => unreachable!(),
                EvalTrigger::Continuous => {
                    if timing != "continuous" {
                        continue;
                    }
                }
                EvalTrigger::Submit => {
                    if timing == "demand" {
                        continue;
                    }
                }
            }
            validate_shape(shape, &shapes_by_id, &mut env, values, items, &mut results);
        }
    }

    results
}

fn validate_items(
    items: &[ItemInfo],
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    results: &mut Vec<ValidationResult>,
) {
    for item in items {
        // Skip non-relevant items (validation suppressed per S5.6)
        if !item.relevant {
            continue;
        }

        // 9d: resolve value by walking nested objects for dotted paths
        let val = resolve_value_by_path(values, &item.path);

        // Required check
        if item.required {
            let is_empty = match &val {
                Value::Null => true,
                Value::String(s) => s.trim().is_empty(),
                Value::Array(arr) => arr.is_empty(),
                _ => false,
            };
            if is_empty {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "required".to_string(),
                    code: "REQUIRED".to_string(),
                    message: "Required field is empty".to_string(),
                    source: "bind".to_string(),
                    shape_id: None,
                });
            }
        }

        // Type mismatch check (only for scalar values, not arrays/objects)
        if !val.is_null()
            && !val.is_array()
            && !val.is_object()
            && let Some(ref dt) = item.data_type
        {
            let mismatch = match dt.as_str() {
                "string" => !val.is_string(),
                "integer" => {
                    !(val.is_i64()
                        || val.is_u64()
                        || val.is_f64() && {
                            let f = val.as_f64().unwrap();
                            f.fract() == 0.0
                        })
                }
                "number" | "decimal" => !val.is_number(),
                "boolean" => !val.is_boolean(),
                _ => false,
            };
            if mismatch {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "type".to_string(),
                    code: "TYPE_MISMATCH".to_string(),
                    message: format!("Invalid {dt}"),
                    source: "bind".to_string(),
                    shape_id: None,
                });
            }
        }

        // Constraint check — set bare $ to current field value (9d: use resolved value)
        if let Some(ref expr) = item.constraint {
            // Temporarily bind bare $ to this field's value
            let prev_dollar = env.data.remove("");
            env.data.insert(String::new(), json_to_fel(&val));

            if let Ok(parsed) = parse(expr) {
                let result = evaluate(&parsed, env);
                if !constraint_passes(&result.value) {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "constraint".to_string(),
                        code: "CONSTRAINT_FAILED".to_string(),
                        message: item
                            .constraint_message
                            .clone()
                            .unwrap_or_else(|| format!("Constraint failed: {expr}")),
                        source: "bind".to_string(),
                        shape_id: None,
                    });
                }
            }

            // Restore previous bare $ binding
            env.data.remove("");
            if let Some(prev) = prev_dollar {
                env.data.insert(String::new(), prev);
            }
        }

        // Extension constraint enforcement
        validate_extension_constraints(item, &val, ext_by_name, formspec_version, results);

        // Cardinality check for repeatable groups
        if item.repeatable {
            let count = detect_repeat_count(&item.path, values);
            if let Some(min) = item.repeat_min
                && (count as u64) < min
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MIN_REPEAT".to_string(),
                    message: format!("Minimum {min} entries required"),
                    source: "bind".to_string(),
                    shape_id: None,
                });
            }
            if let Some(max) = item.repeat_max
                && (count as u64) > max
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MAX_REPEAT".to_string(),
                    message: format!("Maximum {max} entries allowed"),
                    source: "bind".to_string(),
                    shape_id: None,
                });
            }
        }

        validate_items(&item.children, env, values, ext_by_name, formspec_version, results);
    }
}

/// Check extension constraints (pattern, maxLength, min/max, status, compatibility) for a field.
fn validate_extension_constraints(
    item: &ItemInfo,
    val: &Value,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    results: &mut Vec<ValidationResult>,
) {
    for ext_name in &item.extensions {
        let Some(constraint) = ext_by_name.get(ext_name.as_str()) else {
            // Extension not found in any loaded registry
            results.push(ValidationResult {
                path: item.path.clone(),
                severity: "warning".to_string(),
                constraint_kind: "extension".to_string(),
                code: "UNRESOLVED_EXTENSION".to_string(),
                message: format!("Extension '{ext_name}' not found in any loaded registry"),
                source: "extension".to_string(),
                shape_id: None,
            });
            continue;
        };

        // Status enforcement (§7.4)
        match constraint.status.as_str() {
            "retired" => {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_RETIRED".to_string(),
                    message: format!("Extension '{ext_name}' is retired"),
                    source: "extension".to_string(),
                    shape_id: None,
                });
            }
            "deprecated" => {
                let notice = constraint
                    .deprecation_notice
                    .as_deref()
                    .unwrap_or("No migration guidance available");
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "info".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_DEPRECATED".to_string(),
                    message: format!("Extension '{ext_name}' is deprecated: {notice}"),
                    source: "extension".to_string(),
                    shape_id: None,
                });
            }
            _ => {} // stable, draft — no status warnings
        }

        // Compatibility check (§7.3)
        if let Some(ref compat_range) = constraint.compatibility_version {
            if !version_satisfies(formspec_version, compat_range) {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_COMPATIBILITY_MISMATCH".to_string(),
                    message: format!(
                        "Extension '{ext_name}' requires formspec version {compat_range}"
                    ),
                    source: "extension".to_string(),
                    shape_id: None,
                });
            }
        }

        // Skip value constraints if the value is null/empty
        if val.is_null() {
            continue;
        }

        let label = constraint
            .display_name
            .as_deref()
            .unwrap_or(ext_name.as_str());

        // Pattern constraint (string values only)
        if let Some(ref pattern) = constraint.pattern {
            if let Some(s) = val.as_str() {
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(s).unwrap_or(false) {
                        results.push(ValidationResult {
                            path: item.path.clone(),
                            severity: "error".to_string(),
                            constraint_kind: "extension".to_string(),
                            code: "PATTERN_MISMATCH".to_string(),
                            message: format!("Must be a valid {label}"),
                            source: "extension".to_string(),
                            shape_id: None,
                        });
                    }
                }
            }
        }

        // MaxLength constraint (string values only)
        if let Some(max_len) = constraint.max_length {
            if let Some(s) = val.as_str() {
                if s.len() as u64 > max_len {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "MAX_LENGTH_EXCEEDED".to_string(),
                        message: format!(
                            "{label} must be at most {max_len} characters"
                        ),
                        source: "extension".to_string(),
                        shape_id: None,
                    });
                }
            }
        }

        // Minimum constraint (numeric values)
        if let Some(min) = constraint.minimum {
            if let Some(n) = val.as_f64() {
                if n < min {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_UNDERFLOW".to_string(),
                        message: format!("{label} must be at least {min}"),
                        source: "extension".to_string(),
                        shape_id: None,
                    });
                }
            }
        }

        // Maximum constraint (numeric values)
        if let Some(max) = constraint.maximum {
            if let Some(n) = val.as_f64() {
                if n > max {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_OVERFLOW".to_string(),
                        message: format!("{label} must be at most {max}"),
                        source: "extension".to_string(),
                        shape_id: None,
                    });
                }
            }
        }
    }
}

/// Simple semver satisfaction check for extension compatibility ranges.
fn version_satisfies(version: &str, constraint: &str) -> bool {
    let v = parse_semver(version);

    for token in constraint.split_whitespace() {
        let (op, ver_str) = if let Some(rest) = token.strip_prefix(">=") {
            (">=", rest)
        } else if let Some(rest) = token.strip_prefix("<=") {
            ("<=", rest)
        } else if let Some(rest) = token.strip_prefix('>') {
            (">", rest)
        } else if let Some(rest) = token.strip_prefix('<') {
            ("<", rest)
        } else {
            ("=", token)
        };

        let c = parse_semver(ver_str);

        let ok = match op {
            ">=" => v >= c,
            "<=" => v <= c,
            ">" => v > c,
            "<" => v < c,
            _ => v == c,
        };
        if !ok {
            return false;
        }
    }
    true
}

/// Parse a version string into a (major, minor, patch) tuple.
fn parse_semver(v: &str) -> (u64, u64, u64) {
    let parts: Vec<u64> = v.split('.').filter_map(|p| p.parse().ok()).collect();
    (
        parts.first().copied().unwrap_or(0),
        parts.get(1).copied().unwrap_or(0),
        parts.get(2).copied().unwrap_or(0),
    )
}

fn validate_shape(
    shape: &Value,
    shapes_by_id: &HashMap<String, &Value>,
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    items: &[ItemInfo],
    results: &mut Vec<ValidationResult>,
) {
    let target = shape.get("target").and_then(|v| v.as_str()).unwrap_or("");

    // Wildcard shape target: expand and evaluate per-instance
    if is_wildcard_bind(target) {
        validate_wildcard_shape(shape, shapes_by_id, env, values, items, results);
        return;
    }

    // §5.6 rule 1: non-relevant targets suppress shape evaluation
    if target != "#"
        && !target.is_empty()
        && let Some(item) = find_item_by_path(items, target)
        && !item.relevant
    {
        return;
    }
    let severity = shape
        .get("severity")
        .and_then(|v| v.as_str())
        .unwrap_or("error");
    let message = shape
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("Shape constraint failed");

    // Check activeWhen
    if let Some(active_when) = shape.get("activeWhen").and_then(|v| v.as_str())
        && !eval_bool(active_when, env, true)
    {
        return;
    }

    // Bind bare $ to target field value for shape constraint evaluation
    let prev_dollar = env.data.remove("");
    if !target.is_empty()
        && let Some(target_val) = values.get(target)
    {
        env.data.insert(String::new(), json_to_fel(target_val));
    }

    let sid = shape.get("id").and_then(|v| v.as_str()).map(str::to_string);
    let scode = shape
        .get("code")
        .and_then(|v| v.as_str())
        .unwrap_or("SHAPE_FAILED");

    let mut visiting = HashSet::new();
    if !shape_passes(shape, shapes_by_id, env, &mut visiting) {
        results.push(ValidationResult {
            path: target.to_string(),
            severity: severity.to_string(),
            constraint_kind: "shape".to_string(),
            code: scode.to_string(),
            message: message.to_string(),
            source: "shape".to_string(),
            shape_id: sid.clone(),
        });
    }

    // Restore previous bare $ binding
    env.data.remove("");
    if let Some(prev) = prev_dollar {
        env.data.insert(String::new(), prev);
    }
}

/// Validate a shape with a wildcard target, evaluating per concrete instance.
fn validate_wildcard_shape(
    shape: &Value,
    _shapes_by_id: &HashMap<String, &Value>,
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    items: &[ItemInfo],
    results: &mut Vec<ValidationResult>,
) {
    let target = shape.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let severity = shape
        .get("severity")
        .and_then(|v| v.as_str())
        .unwrap_or("error");
    let message = shape
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("Shape constraint failed");

    // Check activeWhen before expanding
    if let Some(active_when) = shape.get("activeWhen").and_then(|v| v.as_str())
        && !eval_bool(active_when, env, true)
    {
        return;
    }

    let base = match wildcard_base(target) {
        Some(b) => b.to_string(),
        None => return,
    };

    let concrete_paths = expand_wildcard_path(target, values);

    for concrete_path in &concrete_paths {
        // §5.6 rule 1: skip non-relevant targets
        if let Some(item) = find_item_by_path(items, concrete_path)
            && !item.relevant
        {
            continue;
        }

        // Extract the index from the concrete path to instantiate the constraint
        let index = match concrete_path.find('[') {
            Some(pos) => {
                let rest = &concrete_path[pos + 1..];
                rest.split(']')
                    .next()
                    .and_then(|s| s.parse::<usize>().ok())
                    .unwrap_or(0)
            }
            None => continue,
        };

        // Build a row-scoped environment: instantiate [*] references in the constraint
        let prev_dollar = env.data.remove("");
        if let Some(val) = values.get(concrete_path.as_str()) {
            env.data.insert(String::new(), json_to_fel(val));
        }

        // Create an instantiated shape for this row
        let constraint_expr = shape
            .get("constraint")
            .and_then(|v| v.as_str())
            .map(|expr| instantiate_wildcard_expr(expr, &base, index));

        let passes = if let Some(ref expr) = constraint_expr {
            constraint_passes(&evaluate_shape_expression(expr, env))
        } else {
            true
        };

        let sid = shape.get("id").and_then(|v| v.as_str()).map(str::to_string);
        let scode = shape
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("SHAPE_FAILED");

        if !passes {
            results.push(ValidationResult {
                path: concrete_path.clone(),
                severity: severity.to_string(),
                constraint_kind: "shape".to_string(),
                code: scode.to_string(),
                message: message.to_string(),
                source: "shape".to_string(),
                shape_id: sid.clone(),
            });
        }

        // Restore bare $
        env.data.remove("");
        if let Some(prev) = prev_dollar {
            env.data.insert(String::new(), prev);
        }
    }
}

fn constraint_passes(value: &FelValue) -> bool {
    value.is_null() || value.is_truthy()
}

fn evaluate_shape_expression(expr: &str, env: &FormspecEnvironment) -> FelValue {
    match parse(expr) {
        Ok(parsed) => evaluate(&parsed, env).value,
        Err(_) => FelValue::Null,
    }
}

fn evaluate_composition_element(
    expr: &str,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    visiting: &mut HashSet<String>,
) -> FelValue {
    if let Some(shape) = shapes_by_id.get(expr) {
        return FelValue::Boolean(shape_passes(shape, shapes_by_id, env, visiting));
    }
    evaluate_shape_expression(expr, env)
}

fn shape_passes(
    shape: &Value,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    visiting: &mut HashSet<String>,
) -> bool {
    let shape_id = shape.get("id").and_then(|v| v.as_str()).map(str::to_string);

    if let Some(ref id) = shape_id
        && !visiting.insert(id.clone())
    {
        return true;
    }

    // activeWhen follows the existing batch evaluator contract: null defaults to active.
    if let Some(active_when) = shape.get("activeWhen").and_then(|v| v.as_str())
        && !eval_bool(active_when, env, true)
    {
        if let Some(id) = shape_id {
            visiting.remove(&id);
        }
        return true;
    }

    let passes = if let Some(expr) = shape.get("constraint").and_then(|v| v.as_str()) {
        constraint_passes(&evaluate_shape_expression(expr, env))
    } else {
        true
    } && shape
        .get("and")
        .and_then(|v| v.as_array())
        .map(|clauses| {
            clauses.iter().all(|clause| {
                clause
                    .as_str()
                    .map(|expr| {
                        constraint_passes(&evaluate_composition_element(
                            expr,
                            shapes_by_id,
                            env,
                            visiting,
                        ))
                    })
                    .unwrap_or(true)
            })
        })
        .unwrap_or(true)
        && shape
            .get("or")
            .and_then(|v| v.as_array())
            .map(|clauses| {
                clauses.iter().any(|clause| {
                    clause
                        .as_str()
                        .map(|expr| {
                            constraint_passes(&evaluate_composition_element(
                                expr,
                                shapes_by_id,
                                env,
                                visiting,
                            ))
                        })
                        .unwrap_or(false)
                })
            })
            .unwrap_or(true)
        && shape
            .get("not")
            .and_then(|v| v.as_str())
            .map(|expr| {
                let value = evaluate_composition_element(expr, shapes_by_id, env, visiting);
                value.is_null() || !value.is_truthy()
            })
            .unwrap_or(true)
        && shape
            .get("xone")
            .and_then(|v| v.as_array())
            .map(|clauses| {
                clauses
                    .iter()
                    .filter(|clause| {
                        clause
                            .as_str()
                            .map(|expr| {
                                let value =
                                    evaluate_composition_element(expr, shapes_by_id, env, visiting);
                                !value.is_null() && value.is_truthy()
                            })
                            .unwrap_or(false)
                    })
                    .count()
                    == 1
            })
            .unwrap_or(true);

    if let Some(id) = shape_id {
        visiting.remove(&id);
    }

    passes
}

/// Apply excludedValue="null" to the FEL environment for non-relevant items (9a).
fn apply_excluded_values_to_env(items: &[ItemInfo], env: &mut FormspecEnvironment) {
    for item in items {
        if !item.relevant
            && let Some(ref ev) = item.excluded_value
            && ev == "null"
        {
            env.set_field(&item.path, FelValue::Null);
        }
        apply_excluded_values_to_env(&item.children, env);
    }
}

pub(crate) fn build_validation_env(values: &HashMap<String, Value>) -> FormspecEnvironment {
    let mut env = FormspecEnvironment::new();
    for (k, v) in values {
        // Skip repeat group arrays — flat indexed keys exist and FEL should
        // use those instead (array path resolution uses 1-based indexing).
        if !is_repeat_group_array(v) {
            env.set_field(k, json_to_fel(v));
        }
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ItemInfo;
    use serde_json::json;

    #[test]
    fn revalidate_with_hand_built_items() {
        let items = vec![ItemInfo {
            key: "email".to_string(),
            path: "email".to_string(),
            data_type: Some("string".to_string()),
            value: Value::Null,
            relevant: true,
            required: true,
            readonly: false,
            calculate: None,
            constraint: Some("contains($email, \"@\")".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            excluded_value: None,
            default_value: None,
            initial_value: None,
            prev_relevant: true,
            parent_path: None,
            repeatable: false,
            repeat_min: None,
            repeat_max: None,
            extensions: vec![],
            pre_populate_instance: None,
            pre_populate_path: None,
            children: vec![],
        }];

        let values: HashMap<String, Value> = HashMap::new();
        let results = revalidate(&items, &values, None, EvalTrigger::Continuous, &[], "1.0.0");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "email");
        assert_eq!(results[0].constraint_kind, "required");
        assert!(results[0].message.contains("Required"));
    }

    #[test]
    fn revalidate_skips_non_relevant() {
        let items = vec![ItemInfo {
            key: "hidden".to_string(),
            path: "hidden".to_string(),
            data_type: Some("string".to_string()),
            value: Value::Null,
            relevant: false,
            required: true,
            readonly: false,
            calculate: None,
            constraint: Some("false".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            excluded_value: None,
            default_value: None,
            initial_value: None,
            prev_relevant: true,
            parent_path: None,
            repeatable: false,
            repeat_min: None,
            repeat_max: None,
            extensions: vec![],
            pre_populate_instance: None,
            pre_populate_path: None,
            children: vec![],
        }];

        let values: HashMap<String, Value> = HashMap::new();
        let results = revalidate(&items, &values, None, EvalTrigger::Continuous, &[], "1.0.0");
        assert!(
            results.is_empty(),
            "non-relevant items should be skipped entirely"
        );
    }

    #[test]
    fn revalidate_constraint_passes() {
        let items = vec![ItemInfo {
            key: "age".to_string(),
            path: "age".to_string(),
            data_type: Some("integer".to_string()),
            value: json!(25),
            relevant: true,
            required: false,
            readonly: false,
            calculate: None,
            constraint: Some("$age >= 18".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            excluded_value: None,
            default_value: None,
            initial_value: None,
            prev_relevant: true,
            parent_path: None,
            repeatable: false,
            repeat_min: None,
            repeat_max: None,
            extensions: vec![],
            pre_populate_instance: None,
            pre_populate_path: None,
            children: vec![],
        }];

        let mut values = HashMap::new();
        values.insert("age".to_string(), json!(25));

        let results = revalidate(&items, &values, None, EvalTrigger::Continuous, &[], "1.0.0");
        assert!(
            results.is_empty(),
            "constraint $age >= 18 should pass for 25"
        );
    }

    #[test]
    fn build_validation_env_skips_repeat_group_arrays() {
        let mut data = HashMap::new();
        data.insert("rows".to_string(), json!([{"a": 1}]));
        data.insert("rows[0].a".to_string(), json!(1));

        let env = build_validation_env(&data);
        assert!(
            !env.data.contains_key("rows"),
            "build_validation_env should skip repeat group arrays entirely"
        );
    }
}
