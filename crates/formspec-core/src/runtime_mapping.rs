//! Bidirectional mapping engine for transforming data between formats.

/// Bidirectional data-transform engine for Formspec mapping documents.
///
/// Executes mapping rules to transform data between Formspec response format
/// and external formats (forward: Formspec → external, reverse: external → Formspec).
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde_json::Value;

use fel_core::{parse, evaluate, MapEnvironment, FelValue};

// ── Types ───────────────────────────────────────────────────────

/// Transform direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MappingDirection {
    Forward,
    Reverse,
}

/// A mapping rule — one transform in the pipeline.
#[derive(Debug, Clone)]
pub struct MappingRule {
    /// Source path (dot notation).
    pub source_path: Option<String>,
    /// Target path (dot notation).
    pub target_path: String,
    /// Transform type.
    pub transform: TransformType,
    /// Optional FEL condition guard.
    pub condition: Option<String>,
    /// Priority (higher = earlier in forward).
    pub priority: i32,
    /// Reverse priority (if different from forward).
    pub reverse_priority: Option<i32>,
}

/// Supported transform types.
#[derive(Debug, Clone)]
pub enum TransformType {
    /// Copy value as-is.
    Preserve,
    /// Drop the value (skip this rule).
    Drop,
    /// Inject a constant value (no source path required).
    Constant(Value),
    /// Map values through a lookup table.
    ValueMap {
        forward: Vec<(Value, Value)>,
        unmapped: UnmappedStrategy,
    },
    /// Coerce to a target type.
    Coerce(CoerceType),
    /// Evaluate a FEL expression.
    Expression(String),
}

/// Strategy for values not found in a value map.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnmappedStrategy {
    /// Pass through unchanged.
    PassThrough,
    /// Return null.
    Null,
    /// Return an error.
    Error,
}

/// Target types for coercion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoerceType {
    String,
    Number,
    Integer,
    Boolean,
    Date,
    DateTime,
}

/// A diagnostic from mapping execution.
#[derive(Debug, Clone)]
pub struct MappingDiagnostic {
    pub rule_index: usize,
    pub source_path: Option<String>,
    pub target_path: String,
    pub message: String,
}

/// Result of a mapping execution.
#[derive(Debug, Clone)]
pub struct MappingResult {
    pub direction: MappingDirection,
    pub output: Value,
    pub rules_applied: usize,
    pub diagnostics: Vec<MappingDiagnostic>,
}

// ── Path utilities ──────────────────────────────────────────────

/// Split a dotted/bracketed path into segments.
fn split_path(path: &str) -> Vec<String> {
    let mut segments = Vec::new();
    let mut current = String::new();

    for c in path.chars() {
        match c {
            '.' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            '[' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            ']' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(c),
        }
    }
    if !current.is_empty() {
        segments.push(current);
    }
    segments
}

/// Get a value at a path in a JSON object.
fn get_by_path<'a>(obj: &'a Value, path: &str) -> &'a Value {
    let segments = split_path(path);
    let mut current = obj;
    for seg in &segments {
        match current {
            Value::Object(map) => {
                current = map.get(seg.as_str()).unwrap_or(&Value::Null);
            }
            Value::Array(arr) => {
                if let Ok(idx) = seg.parse::<usize>() {
                    current = arr.get(idx).unwrap_or(&Value::Null);
                } else {
                    return &Value::Null;
                }
            }
            _ => return &Value::Null,
        }
    }
    current
}

/// Set a value at a path in a JSON object, creating intermediate objects as needed.
fn set_by_path(obj: &mut Value, path: &str, value: Value) {
    let segments = split_path(path);
    if segments.is_empty() {
        return;
    }

    let mut current = obj;
    for (i, seg) in segments.iter().enumerate() {
        if i == segments.len() - 1 {
            // Last segment — set the value
            match current {
                Value::Object(map) => {
                    map.insert(seg.clone(), value);
                    return;
                }
                Value::Array(arr) => {
                    if let Ok(idx) = seg.parse::<usize>() {
                        while arr.len() <= idx {
                            arr.push(Value::Null);
                        }
                        arr[idx] = value;
                        return;
                    }
                }
                _ => return,
            }
        } else {
            // Intermediate segment — ensure container exists
            let next_is_index = segments.get(i + 1).map_or(false, |s| s.parse::<usize>().is_ok());
            match current {
                Value::Object(map) => {
                    if !map.contains_key(seg.as_str()) {
                        if next_is_index {
                            map.insert(seg.clone(), Value::Array(vec![]));
                        } else {
                            map.insert(seg.clone(), Value::Object(serde_json::Map::new()));
                        }
                    }
                    current = map.get_mut(seg.as_str()).unwrap();
                }
                Value::Array(arr) => {
                    if let Ok(idx) = seg.parse::<usize>() {
                        while arr.len() <= idx {
                            arr.push(Value::Null);
                        }
                        if arr[idx].is_null() {
                            if next_is_index {
                                arr[idx] = Value::Array(vec![]);
                            } else {
                                arr[idx] = Value::Object(serde_json::Map::new());
                            }
                        }
                        current = &mut arr[idx];
                    } else {
                        return;
                    }
                }
                _ => return,
            }
        }
    }
}

// ── FEL ↔ JSON conversion ──────────────────────────────────────

fn json_to_fel(val: &Value) -> FelValue {
    match val {
        Value::Null => FelValue::Null,
        Value::Bool(b) => FelValue::Boolean(*b),
        Value::Number(n) => {
            if let Some(d) = Decimal::from_f64(n.as_f64().unwrap_or(0.0)) {
                FelValue::Number(d)
            } else {
                FelValue::Null
            }
        }
        Value::String(s) => FelValue::String(s.clone()),
        Value::Array(arr) => FelValue::Array(arr.iter().map(json_to_fel).collect()),
        Value::Object(map) => FelValue::Object(
            map.iter().map(|(k, v)| (k.clone(), json_to_fel(v))).collect(),
        ),
    }
}

fn fel_to_json(val: &FelValue) -> Value {
    match val {
        FelValue::Null => Value::Null,
        FelValue::Boolean(b) => Value::Bool(*b),
        FelValue::Number(n) => {
            if n.fract().is_zero() {
                if let Some(i) = n.to_i64() {
                    return Value::Number(serde_json::Number::from(i));
                }
            }
            if let Some(f) = n.to_f64() {
                serde_json::Number::from_f64(f)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else {
                Value::Null
            }
        }
        FelValue::String(s) => Value::String(s.clone()),
        FelValue::Date(d) => Value::String(d.format_iso()),
        FelValue::Array(arr) => Value::Array(arr.iter().map(fel_to_json).collect()),
        FelValue::Object(entries) => {
            let map: serde_json::Map<String, Value> = entries.iter()
                .map(|(k, v)| (k.clone(), fel_to_json(v)))
                .collect();
            Value::Object(map)
        }
        FelValue::Money(m) => {
            let mut map = serde_json::Map::new();
            map.insert("amount".to_string(), fel_to_json(&FelValue::Number(m.amount)));
            map.insert("currency".to_string(), Value::String(m.currency.clone()));
            Value::Object(map)
        }
    }
}

// ── Mapping engine ──────────────────────────────────────────────

/// Execute a set of mapping rules in a given direction.
pub fn execute_mapping(
    rules: &[MappingRule],
    source: &Value,
    direction: MappingDirection,
) -> MappingResult {
    let mut output = Value::Object(serde_json::Map::new());
    let mut diagnostics = Vec::new();
    let mut rules_applied = 0;

    // Sort rules by priority (descending for forward, ascending for reverse)
    let mut sorted_indices: Vec<usize> = (0..rules.len()).collect();
    sorted_indices.sort_by_key(|&i| {
        let r = &rules[i];
        match direction {
            MappingDirection::Forward => std::cmp::Reverse(r.priority),
            MappingDirection::Reverse => std::cmp::Reverse(r.reverse_priority.unwrap_or(r.priority)),
        }
    });

    for &rule_idx in &sorted_indices {
        let rule = &rules[rule_idx];

        // Check condition
        if let Some(ref cond) = rule.condition {
            if let Ok(expr) = parse(cond) {
                let mut fields = std::collections::HashMap::new();
                // Make source document available as @source
                fields.insert("__source__".to_string(), json_to_fel(source));
                let env = MapEnvironment::with_fields(fields);
                let result = evaluate(&expr, &env);
                if !result.value.is_truthy() {
                    continue; // condition false — skip rule
                }
            }
        }

        // Direction-aware path resolution
        let (src_path, tgt_path) = match direction {
            MappingDirection::Forward => (rule.source_path.as_deref(), rule.target_path.as_str()),
            MappingDirection::Reverse => (Some(rule.target_path.as_str()), rule.source_path.as_deref().unwrap_or("")),
        };

        // Get source value
        let source_value = match src_path {
            Some(p) if !p.is_empty() => get_by_path(source, p).clone(),
            _ => Value::Null,
        };

        // Apply transform
        let transformed = match &rule.transform {
            TransformType::Drop => continue,
            TransformType::Preserve => source_value,
            TransformType::Constant(val) => val.clone(),
            TransformType::ValueMap { forward, unmapped } => {
                match direction {
                    MappingDirection::Forward => {
                        apply_value_map(&source_value, forward, *unmapped, rule_idx, tgt_path, &mut diagnostics)
                    }
                    MappingDirection::Reverse => {
                        // Auto-invert the map
                        let reversed: Vec<(Value, Value)> = forward.iter()
                            .map(|(k, v)| (v.clone(), k.clone()))
                            .collect();
                        apply_value_map(&source_value, &reversed, *unmapped, rule_idx, tgt_path, &mut diagnostics)
                    }
                }
            }
            TransformType::Coerce(target_type) => {
                apply_coerce(&source_value, *target_type, rule_idx, tgt_path, &mut diagnostics)
            }
            TransformType::Expression(fel_expr) => {
                match parse(fel_expr) {
                    Ok(expr) => {
                        // Build environment: source value fields are available directly,
                        // and the full source document fields are also available.
                        let mut fields = std::collections::HashMap::new();
                        // Make source document fields available as $fieldName
                        if let Some(obj) = source.as_object() {
                            for (k, v) in obj {
                                fields.insert(k.clone(), json_to_fel(v));
                            }
                        }
                        let env = MapEnvironment::with_fields(fields);
                        let result = evaluate(&expr, &env);
                        fel_to_json(&result.value)
                    }
                    Err(e) => {
                        diagnostics.push(MappingDiagnostic {
                            rule_index: rule_idx,
                            source_path: src_path.map(String::from),
                            target_path: tgt_path.to_string(),
                            message: format!("FEL parse error: {e}"),
                        });
                        Value::Null
                    }
                }
            }
        };

        // Set output
        if !tgt_path.is_empty() {
            set_by_path(&mut output, tgt_path, transformed);
            rules_applied += 1;
        }
    }

    MappingResult {
        direction,
        output,
        rules_applied,
        diagnostics,
    }
}

fn apply_value_map(
    value: &Value,
    map: &[(Value, Value)],
    unmapped: UnmappedStrategy,
    rule_idx: usize,
    target_path: &str,
    diagnostics: &mut Vec<MappingDiagnostic>,
) -> Value {
    for (from, to) in map {
        if value == from {
            return to.clone();
        }
    }
    match unmapped {
        UnmappedStrategy::PassThrough => value.clone(),
        UnmappedStrategy::Null => Value::Null,
        UnmappedStrategy::Error => {
            diagnostics.push(MappingDiagnostic {
                rule_index: rule_idx,
                source_path: None,
                target_path: target_path.to_string(),
                message: format!("No value map entry for: {value}"),
            });
            Value::Null
        }
    }
}

fn apply_coerce(
    value: &Value,
    target_type: CoerceType,
    _rule_idx: usize,
    _target_path: &str,
    _diagnostics: &mut Vec<MappingDiagnostic>,
) -> Value {
    match target_type {
        CoerceType::String => match value {
            Value::String(_) => value.clone(),
            Value::Number(n) => Value::String(n.to_string()),
            Value::Bool(b) => Value::String(b.to_string()),
            Value::Null => Value::Null,
            _ => Value::String(value.to_string()),
        },
        CoerceType::Number => match value {
            Value::Number(_) => value.clone(),
            Value::String(s) => {
                if let Ok(n) = s.parse::<f64>() {
                    serde_json::Number::from_f64(n)
                        .map(Value::Number)
                        .unwrap_or(Value::Null)
                } else {
                    Value::Null
                }
            }
            Value::Bool(b) => Value::Number(serde_json::Number::from(if *b { 1 } else { 0 })),
            _ => Value::Null,
        },
        CoerceType::Integer => match value {
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    Value::Number(serde_json::Number::from(i))
                } else if let Some(f) = n.as_f64() {
                    Value::Number(serde_json::Number::from(f as i64))
                } else {
                    Value::Null
                }
            }
            Value::String(s) => {
                if let Ok(i) = s.parse::<i64>() {
                    Value::Number(serde_json::Number::from(i))
                } else {
                    Value::Null
                }
            }
            _ => Value::Null,
        },
        CoerceType::Boolean => match value {
            Value::Bool(_) => value.clone(),
            Value::Number(n) => Value::Bool(n.as_f64().unwrap_or(0.0) != 0.0),
            Value::String(s) => match s.as_str() {
                "true" | "1" | "yes" => Value::Bool(true),
                "false" | "0" | "no" => Value::Bool(false),
                _ => Value::Null,
            },
            _ => Value::Null,
        },
        CoerceType::Date | CoerceType::DateTime => {
            // Dates pass through as strings
            match value {
                Value::String(_) => value.clone(),
                _ => Value::Null,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_preserve_transform() {
        let rules = vec![MappingRule {
            source_path: Some("name".to_string()),
            target_path: "fullName".to_string(),
            transform: TransformType::Preserve,
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "name": "Alice" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["fullName"], "Alice");
        assert_eq!(result.rules_applied, 1);
    }

    #[test]
    fn test_constant_transform() {
        let rules = vec![MappingRule {
            source_path: None,
            target_path: "version".to_string(),
            transform: TransformType::Constant(json!("1.0")),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({});
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["version"], "1.0");
    }

    #[test]
    fn test_drop_transform() {
        let rules = vec![MappingRule {
            source_path: Some("secret".to_string()),
            target_path: "secret".to_string(),
            transform: TransformType::Drop,
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "secret": "hidden" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.rules_applied, 0);
        assert!(result.output.get("secret").is_none());
    }

    #[test]
    fn test_value_map_forward() {
        let rules = vec![MappingRule {
            source_path: Some("status".to_string()),
            target_path: "statusCode".to_string(),
            transform: TransformType::ValueMap {
                forward: vec![
                    (json!("active"), json!(1)),
                    (json!("inactive"), json!(0)),
                ],
                unmapped: UnmappedStrategy::Null,
            },
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "status": "active" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["statusCode"], 1);
    }

    #[test]
    fn test_value_map_reverse() {
        let rules = vec![MappingRule {
            source_path: Some("status".to_string()),
            target_path: "statusCode".to_string(),
            transform: TransformType::ValueMap {
                forward: vec![
                    (json!("active"), json!(1)),
                    (json!("inactive"), json!(0)),
                ],
                unmapped: UnmappedStrategy::Null,
            },
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "statusCode": 1 });
        let result = execute_mapping(&rules, &source, MappingDirection::Reverse);
        assert_eq!(result.output["status"], "active");
    }

    #[test]
    fn test_coerce_to_string() {
        let rules = vec![MappingRule {
            source_path: Some("count".to_string()),
            target_path: "countStr".to_string(),
            transform: TransformType::Coerce(CoerceType::String),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "count": 42 });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["countStr"], "42");
    }

    #[test]
    fn test_coerce_to_number() {
        let rules = vec![MappingRule {
            source_path: Some("amount".to_string()),
            target_path: "total".to_string(),
            transform: TransformType::Coerce(CoerceType::Number),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "amount": "99.5" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["total"], 99.5);
    }

    #[test]
    fn test_nested_path_output() {
        let rules = vec![MappingRule {
            source_path: Some("name".to_string()),
            target_path: "person.fullName".to_string(),
            transform: TransformType::Preserve,
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "name": "Bob" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["person"]["fullName"], "Bob");
    }

    #[test]
    fn test_multiple_rules() {
        let rules = vec![
            MappingRule {
                source_path: Some("first".to_string()),
                target_path: "firstName".to_string(),
                transform: TransformType::Preserve,
                condition: None,
                priority: 1,
                reverse_priority: None,
            },
            MappingRule {
                source_path: Some("last".to_string()),
                target_path: "lastName".to_string(),
                transform: TransformType::Preserve,
                condition: None,
                priority: 0,
                reverse_priority: None,
            },
        ];
        let source = json!({ "first": "Alice", "last": "Smith" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["firstName"], "Alice");
        assert_eq!(result.output["lastName"], "Smith");
        assert_eq!(result.rules_applied, 2);
    }

    #[test]
    fn test_unmapped_pass_through() {
        let rules = vec![MappingRule {
            source_path: Some("val".to_string()),
            target_path: "out".to_string(),
            transform: TransformType::ValueMap {
                forward: vec![(json!("a"), json!(1))],
                unmapped: UnmappedStrategy::PassThrough,
            },
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "val": "unknown" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["out"], "unknown");
    }

    #[test]
    fn test_expression_transform() {
        let rules = vec![MappingRule {
            source_path: None,
            target_path: "fullName".to_string(),
            transform: TransformType::Expression("$first & ' ' & $last".to_string()),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "first": "Alice", "last": "Smith" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["fullName"], "Alice Smith");
    }

    #[test]
    fn test_expression_with_calculation() {
        let rules = vec![MappingRule {
            source_path: None,
            target_path: "total".to_string(),
            transform: TransformType::Expression("$qty * $price".to_string()),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "qty": 5, "price": 10 });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["total"], 50);
    }

    #[test]
    fn test_coerce_boolean() {
        let rules = vec![MappingRule {
            source_path: Some("active".to_string()),
            target_path: "isActive".to_string(),
            transform: TransformType::Coerce(CoerceType::Boolean),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "active": "true" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["isActive"], true);
    }

    #[test]
    fn test_coerce_integer() {
        let rules = vec![MappingRule {
            source_path: Some("amount".to_string()),
            target_path: "count".to_string(),
            transform: TransformType::Coerce(CoerceType::Integer),
            condition: None,
            priority: 0,
            reverse_priority: None,
        }];
        let source = json!({ "amount": 3.7 });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["count"], 3);
    }

    #[test]
    fn test_split_path() {
        assert_eq!(split_path("a.b.c"), vec!["a", "b", "c"]);
        assert_eq!(split_path("a[0].b"), vec!["a", "0", "b"]);
        assert_eq!(split_path("items[0].children[1].key"), vec!["items", "0", "children", "1", "key"]);
    }
}
