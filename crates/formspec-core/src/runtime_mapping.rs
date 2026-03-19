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
    /// Fallback value when source resolves to null/absent.
    pub default: Option<Value>,
    /// Whether this rule participates in reverse execution (default true).
    pub bidirectional: bool,
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
    /// Flatten nested/array structure to a scalar string using separator.
    Flatten { separator: String },
    /// Expand flat string into nested object by splitting on separator.
    Nest { separator: String },
    /// FEL expression that must evaluate to a string ($ = source value, full doc in scope).
    Concat(String),
    /// FEL expression that must return array or object ($ = source value, full doc in scope).
    Split(String),
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

/// A complete mapping document with rules, defaults, and autoMap.
#[derive(Debug, Clone)]
pub struct MappingDocument {
    pub rules: Vec<MappingRule>,
    /// Key-value defaults pre-populated into the output before rules execute (forward only).
    pub defaults: Option<serde_json::Map<String, Value>>,
    /// When true, generate synthetic preserve rules for unmapped top-level source keys.
    pub auto_map: bool,
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

        // Skip non-bidirectional rules during reverse execution
        if direction == MappingDirection::Reverse && !rule.bidirectional {
            continue;
        }

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

        // Get source value, falling back to per-rule default if null/absent
        let source_value = match src_path {
            Some(p) if !p.is_empty() => {
                let v = get_by_path(source, p).clone();
                if v.is_null() {
                    rule.default.clone().unwrap_or(v)
                } else {
                    v
                }
            }
            _ => rule.default.clone().unwrap_or(Value::Null),
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
            TransformType::Flatten { separator } => {
                apply_flatten(&source_value, separator)
            }
            TransformType::Nest { separator } => {
                apply_nest(&source_value, separator)
            }
            TransformType::Concat(fel_expr) => {
                eval_fel_with_dollar(fel_expr, &source_value, source, rule_idx, src_path, tgt_path, &mut diagnostics)
            }
            TransformType::Split(fel_expr) => {
                let result = eval_fel_with_dollar(fel_expr, &source_value, source, rule_idx, src_path, tgt_path, &mut diagnostics);
                // Split writes multiple target paths if result is array or object
                match &result {
                    Value::Array(arr) => {
                        for (i, elem) in arr.iter().enumerate() {
                            let indexed_path = format!("{tgt_path}.{i}");
                            set_by_path(&mut output, &indexed_path, elem.clone());
                        }
                        rules_applied += 1;
                        continue;
                    }
                    Value::Object(map) => {
                        for (k, v) in map {
                            let keyed_path = format!("{tgt_path}.{k}");
                            set_by_path(&mut output, &keyed_path, v.clone());
                        }
                        rules_applied += 1;
                        continue;
                    }
                    _ => result,
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

fn apply_flatten(value: &Value, separator: &str) -> Value {
    match value {
        Value::Object(map) => {
            let parts: Vec<String> = map.iter()
                .map(|(k, v)| format!("{k}={}", value_to_flat_string(v)))
                .collect();
            Value::String(parts.join(separator))
        }
        Value::Array(arr) => {
            let parts: Vec<String> = arr.iter().map(value_to_flat_string).collect();
            Value::String(parts.join(separator))
        }
        Value::Null => Value::Null,
        _ => Value::String(value_to_flat_string(value)),
    }
}

fn value_to_flat_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".to_string(),
        other => other.to_string(),
    }
}

fn apply_nest(value: &Value, separator: &str) -> Value {
    match value {
        Value::String(s) => {
            let parts: Vec<&str> = s.split(separator).collect();
            // Build nested object from parts: "a.b.c" → {"a":{"b":{"c":true}}}
            let mut result = Value::Bool(true);
            for part in parts.into_iter().rev() {
                let mut map = serde_json::Map::new();
                map.insert(part.to_string(), result);
                result = Value::Object(map);
            }
            result
        }
        _ => Value::Null,
    }
}

/// Evaluate a FEL expression with `$` bound to the source value and source document fields in scope.
fn eval_fel_with_dollar(
    fel_expr: &str,
    source_value: &Value,
    source_doc: &Value,
    rule_idx: usize,
    src_path: Option<&str>,
    tgt_path: &str,
    diagnostics: &mut Vec<MappingDiagnostic>,
) -> Value {
    match parse(fel_expr) {
        Ok(expr) => {
            let mut fields = std::collections::HashMap::new();
            // $ binds to the resolved source value
            fields.insert("$".to_string(), json_to_fel(source_value));
            // Full source document fields also available as $fieldName
            if let Some(obj) = source_doc.as_object() {
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

/// Execute a full mapping document (rules + defaults + autoMap).
pub fn execute_mapping_doc(
    doc: &MappingDocument,
    source: &Value,
    direction: MappingDirection,
) -> MappingResult {
    // Build the effective rule set
    let mut rules = doc.rules.clone();

    // autoMap: generate synthetic preserve rules for unmapped top-level source keys (forward only)
    if doc.auto_map && direction == MappingDirection::Forward {
        if let Some(obj) = source.as_object() {
            let covered: std::collections::HashSet<&str> = doc.rules.iter()
                .filter_map(|r| r.source_path.as_deref())
                .collect();
            for key in obj.keys() {
                if !covered.contains(key.as_str()) {
                    rules.push(MappingRule {
                        source_path: Some(key.clone()),
                        target_path: key.clone(),
                        transform: TransformType::Preserve,
                        condition: None,
                        priority: -1,
                        reverse_priority: None,
                        default: None,
                        bidirectional: true,
                    });
                }
            }
        }
    }

    // Execute rules
    let mut result = execute_mapping(&rules, source, direction);

    // Apply defaults before rules (but since rules already ran via last-write-wins,
    // we insert defaults only where no rule wrote a value). Forward only.
    if direction == MappingDirection::Forward {
        if let Some(ref defaults) = doc.defaults {
            if let Value::Object(ref mut out_map) = result.output {
                for (k, v) in defaults {
                    // Only set default if no rule wrote to this key
                    if !out_map.contains_key(k) {
                        out_map.insert(k.clone(), v.clone());
                    }
                }
            }
        }
    }

    result
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
            default: None,
            bidirectional: true,
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
            default: None,
            bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
            default: None,
            bidirectional: true,
            },
            MappingRule {
                source_path: Some("last".to_string()),
                target_path: "lastName".to_string(),
                transform: TransformType::Preserve,
                condition: None,
                priority: 0,
                reverse_priority: None,
            default: None,
            bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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
        default: None,
        bidirectional: true,
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

    // ── New transform tests ─────────────────────────────────────

    fn rule(source: Option<&str>, target: &str, transform: TransformType) -> MappingRule {
        MappingRule {
            source_path: source.map(String::from),
            target_path: target.to_string(),
            transform,
            condition: None,
            priority: 0,
            reverse_priority: None,
            default: None,
            bidirectional: true,
        }
    }

    #[test]
    fn test_flatten_object() {
        let rules = vec![rule(Some("addr"), "flat", TransformType::Flatten { separator: ".".to_string() })];
        let source = json!({ "addr": { "city": "NYC", "zip": "10001" } });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        let flat = result.output["flat"].as_str().unwrap();
        assert!(flat.contains("city=NYC"));
        assert!(flat.contains("zip=10001"));
        assert!(flat.contains("."));
    }

    #[test]
    fn test_flatten_array() {
        let rules = vec![rule(Some("tags"), "flat", TransformType::Flatten { separator: ", ".to_string() })];
        let source = json!({ "tags": ["a", "b", "c"] });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["flat"], "a, b, c");
    }

    #[test]
    fn test_flatten_null_uses_rule_default() {
        let mut r = rule(Some("missing"), "out", TransformType::Flatten { separator: ".".to_string() });
        r.default = Some(json!("fallback"));
        let rules = vec![r];
        let source = json!({});
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        // Default value "fallback" is a scalar — flatten of scalar = its string form
        assert_eq!(result.output["out"], "fallback");
    }

    #[test]
    fn test_nest_string() {
        let rules = vec![rule(Some("path"), "nested", TransformType::Nest { separator: ".".to_string() })];
        let source = json!({ "path": "a.b.c" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["nested"]["a"]["b"]["c"], true);
    }

    #[test]
    fn test_nest_non_string_uses_rule_default() {
        let mut r = rule(Some("num"), "out", TransformType::Nest { separator: ".".to_string() });
        r.default = Some(json!("x.y"));
        let rules = vec![r];
        // source has a number — nest expects a string, so it returns Null.
        // But default was already applied at source-resolution time (before transform),
        // so the source_value will be "x.y" only if "num" is null/absent.
        // Here "num" is present and a number, so default doesn't apply.
        let source = json!({ "num": 42 });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["out"], Value::Null);
    }

    #[test]
    fn test_concat_fel_expression() {
        let rules = vec![rule(None, "full", TransformType::Concat("$first & ' ' & $last".to_string()))];
        let source = json!({ "first": "Alice", "last": "Smith" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["full"], "Alice Smith");
    }

    #[test]
    fn test_split_fel_into_object() {
        // FEL expression that builds an object from source fields
        let rules = vec![rule(None, "parts", TransformType::Split("{first: $first, last: $last}".to_string()))];
        let source = json!({ "first": "Alice", "last": "Smith" });
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["parts"]["first"], "Alice");
        assert_eq!(result.output["parts"]["last"], "Smith");
    }

    #[test]
    fn test_per_rule_default_when_source_null() {
        let mut r = rule(Some("missing"), "out", TransformType::Preserve);
        r.default = Some(json!("fallback"));
        let rules = vec![r];
        let source = json!({});
        let result = execute_mapping(&rules, &source, MappingDirection::Forward);
        assert_eq!(result.output["out"], "fallback");
    }

    #[test]
    fn test_bidirectional_false_skipped_in_reverse() {
        let mut r = rule(Some("src"), "tgt", TransformType::Preserve);
        r.bidirectional = false;
        let rules = vec![r];
        let source = json!({ "tgt": "value" });
        let result = execute_mapping(&rules, &source, MappingDirection::Reverse);
        assert_eq!(result.rules_applied, 0);
        assert!(result.output.get("src").is_none());
    }

    #[test]
    fn test_mapping_doc_defaults_prepopulate() {
        let mut defaults = serde_json::Map::new();
        defaults.insert("version".to_string(), json!("1.0"));
        defaults.insert("type".to_string(), json!("form"));
        let doc = MappingDocument {
            rules: vec![rule(Some("name"), "name", TransformType::Preserve)],
            defaults: Some(defaults),
            auto_map: false,
        };
        let source = json!({ "name": "Alice" });
        let result = execute_mapping_doc(&doc, &source, MappingDirection::Forward);
        assert_eq!(result.output["name"], "Alice");
        assert_eq!(result.output["version"], "1.0");
        assert_eq!(result.output["type"], "form");
    }

    #[test]
    fn test_mapping_doc_automap_copies_unmapped() {
        let doc = MappingDocument {
            rules: vec![rule(Some("name"), "fullName", TransformType::Preserve)],
            defaults: None,
            auto_map: true,
        };
        let source = json!({ "name": "Alice", "age": 30, "email": "a@b.com" });
        let result = execute_mapping_doc(&doc, &source, MappingDirection::Forward);
        assert_eq!(result.output["fullName"], "Alice");
        assert_eq!(result.output["age"], 30);
        assert_eq!(result.output["email"], "a@b.com");
    }

    #[test]
    fn test_automap_does_not_duplicate_explicit() {
        let doc = MappingDocument {
            rules: vec![rule(Some("name"), "fullName", TransformType::Preserve)],
            defaults: None,
            auto_map: true,
        };
        let source = json!({ "name": "Alice" });
        let result = execute_mapping_doc(&doc, &source, MappingDirection::Forward);
        // "name" is covered by explicit rule (source_path = "name"), so no autoMap for it
        assert_eq!(result.output["fullName"], "Alice");
        // "name" should NOT appear as a separate key from autoMap
        assert!(result.output.get("name").is_none());
    }
}
