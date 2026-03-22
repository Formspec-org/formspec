//! Runtime mapping rule arrays and mapping documents (`wasm_bindgen`).

use formspec_core::{execute_mapping, execute_mapping_doc, MappingDocument};
use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Parse the `coerce` field from a mapping rule JSON object.
///
/// Accepts two forms per the mapping spec:
/// - String shorthand: `"coerce": "number"` — returns the matching CoerceType
/// - Object form: `"coerce": { "from": "date", "to": "string" }` — returns the `to` type.
///   Note: the `from` field is currently ignored (used for validation, not dispatch).
///
/// Returns `None` for unrecognized type strings or invalid shapes.
pub(crate) fn parse_coerce_type(val: &Value) -> Option<formspec_core::CoerceType> {
    match val {
        Value::String(s) => match s.as_str() {
            "string" => Some(formspec_core::CoerceType::String),
            "number" => Some(formspec_core::CoerceType::Number),
            "integer" => Some(formspec_core::CoerceType::Integer),
            "boolean" => Some(formspec_core::CoerceType::Boolean),
            "date" => Some(formspec_core::CoerceType::Date),
            "datetime" => Some(formspec_core::CoerceType::DateTime),
            _ => None,
        },
        Value::Object(obj) => {
            let to = obj.get("to").and_then(|v| v.as_str())?;
            match to {
                "string" => Some(formspec_core::CoerceType::String),
                "number" => Some(formspec_core::CoerceType::Number),
                "integer" => Some(formspec_core::CoerceType::Integer),
                "boolean" => Some(formspec_core::CoerceType::Boolean),
                "date" => Some(formspec_core::CoerceType::Date),
                "datetime" => Some(formspec_core::CoerceType::DateTime),
                _ => None,
            }
        }
        _ => None,
    }
}

pub(crate) fn parse_mapping_rules_inner(val: &Value) -> Result<Vec<formspec_core::MappingRule>, String> {
    let arr = val
        .as_array()
        .ok_or_else(|| "rules must be an array".to_string())?;
    let mut rules = Vec::new();
    for rule_val in arr {
        let obj = rule_val
            .as_object()
            .ok_or_else(|| "rule must be an object".to_string())?;
        let transform = match obj
            .get("transform")
            .and_then(|v| v.as_str())
            .unwrap_or("preserve")
        {
            "preserve" => formspec_core::TransformType::Preserve,
            "drop" => formspec_core::TransformType::Drop,
            "constant" => {
                // Constant maps to Expression — the expression field holds a FEL literal
                // (e.g. '"1"' evaluates to string "1", '1.0' evaluates to number 1.0)
                let expr = obj
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "constant transform requires 'expression' field".to_string())?;
                formspec_core::TransformType::Expression(expr.to_string())
            }
            "coerce" => {
                let coerce_val = obj
                    .get("coerce")
                    .cloned()
                    .unwrap_or(Value::String("string".into()));
                let coerce_type = parse_coerce_type(&coerce_val)
                    .ok_or_else(|| format!("unknown coerce type: {coerce_val}"))?;
                formspec_core::TransformType::Coerce(coerce_type)
            }
            "valueMap" => {
                let vm_val = obj.get("valueMap");
                let vm_obj = vm_val.and_then(|v| v.as_object());

                // Detect new shape: { forward, reverse, unmapped, default }
                let is_new_shape = vm_obj.is_some_and(|m| {
                    m.contains_key("forward") || m.contains_key("reverse") || m.contains_key("unmapped")
                });

                if is_new_shape {
                    let inner = vm_obj.unwrap();
                    let forward: Vec<(Value, Value)> = inner
                        .get("forward")
                        .and_then(|v| v.as_object())
                        .map(|m| {
                            m.iter()
                                .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                                .collect()
                        })
                        .unwrap_or_default();
                    let unmapped = match inner.get("unmapped").and_then(|v| v.as_str()) {
                        Some("passthrough") => formspec_core::UnmappedStrategy::PassThrough,
                        Some("drop") => formspec_core::UnmappedStrategy::Drop,
                        Some("default") => formspec_core::UnmappedStrategy::Default,
                        // New-shape default unmapped strategy is "error" per spec
                        _ => formspec_core::UnmappedStrategy::Error,
                    };
                    formspec_core::TransformType::ValueMap { forward, unmapped }
                } else {
                    // Legacy flat map: { key: value, ... } — passthrough by default
                    let forward: Vec<(Value, Value)> = vm_obj
                        .map(|m| {
                            m.iter()
                                .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                                .collect()
                        })
                        .unwrap_or_default();
                    formspec_core::TransformType::ValueMap {
                        forward,
                        unmapped: formspec_core::UnmappedStrategy::PassThrough,
                    }
                }
            }
            "flatten" => formspec_core::TransformType::Flatten {
                separator: obj
                    .get("separator")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            },
            "nest" => formspec_core::TransformType::Nest {
                separator: obj
                    .get("separator")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            },
            "expression" => formspec_core::TransformType::Expression(
                obj.get("expression")
                    .and_then(|v| v.as_str())
                    .unwrap_or("$")
                    .to_string(),
            ),
            "concat" => formspec_core::TransformType::Concat(
                obj.get("expression")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            ),
            "split" => formspec_core::TransformType::Split(
                obj.get("expression")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            ),
            other => return Err(format!("unknown transform type: {other}")),
        };

        // At least one of sourcePath or targetPath MUST be present (mapping.schema.json FieldRule.anyOf)
        let source_path = obj
            .get("sourcePath")
            .and_then(|v| v.as_str())
            .map(String::from);
        let target_path = obj
            .get("targetPath")
            .and_then(|v| v.as_str())
            .map(String::from);
        if source_path.is_none() && target_path.is_none() {
            return Err(format!(
                "rule[{rule_val}]: at least one of 'sourcePath' or 'targetPath' must be present"
            ));
        }

        rules.push(formspec_core::MappingRule {
            source_path,
            target_path: target_path.unwrap_or_default(),
            transform,
            condition: obj
                .get("condition")
                .and_then(|v| v.as_str())
                .map(String::from),
            priority: obj.get("priority").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            reverse_priority: obj
                .get("reversePriority")
                .and_then(|v| v.as_i64())
                .map(|n| n as i32),
            default: obj.get("default").cloned().or_else(|| {
                // For new-shape valueMap, also check valueMap.default
                obj.get("valueMap")
                    .and_then(|v| v.as_object())
                    .and_then(|vm| vm.get("default"))
                    .cloned()
            }),
            bidirectional: obj
                .get("bidirectional")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            array: obj.get("array").and_then(|v| {
                let arr_obj = v.as_object()?;
                let mode = match arr_obj.get("mode")?.as_str()? {
                    "each" => formspec_core::ArrayMode::Each,
                    "whole" => formspec_core::ArrayMode::Whole,
                    "indexed" => formspec_core::ArrayMode::Indexed,
                    _ => return None,
                };
                let inner_rules = arr_obj
                    .get("innerRules")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| {
                        // For indexed mode, inner rules use { index: N, targetPath } instead of
                        // standard rules. Convert index to sourcePath for the Rust engine.
                        let patched: Vec<Value> = arr
                            .iter()
                            .map(|r| {
                                if mode == formspec_core::ArrayMode::Indexed
                                    && let Some(obj) = r.as_object()
                                    && let Some(idx) = obj.get("index").and_then(|v| v.as_u64())
                                {
                                    let mut patched_obj = obj.clone();
                                    patched_obj.insert(
                                        "sourcePath".to_string(),
                                        Value::String(idx.to_string()),
                                    );
                                    return Value::Object(patched_obj);
                                }
                                r.clone()
                            })
                            .collect();
                        parse_mapping_rules_inner(&Value::Array(patched)).ok()
                    })
                    .unwrap_or_default();
                Some(formspec_core::ArrayDescriptor { mode, inner_rules })
            }),
            reverse: obj.get("reverse").and_then(|v| {
                let rev_obj = v.as_object()?;
                // Parse the reverse transform using the same logic as the main transform
                let rev_transform = match rev_obj
                    .get("transform")
                    .and_then(|v| v.as_str())
                    .unwrap_or("preserve")
                {
                    "preserve" => formspec_core::TransformType::Preserve,
                    "drop" => formspec_core::TransformType::Drop,
                    "valueMap" => {
                        let vm_val = rev_obj.get("valueMap");
                        let vm_obj = vm_val.and_then(|v| v.as_object());
                        let forward: Vec<(Value, Value)> = vm_obj
                            .map(|m| {
                                m.iter()
                                    .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                                    .collect()
                            })
                            .unwrap_or_default();
                        formspec_core::TransformType::ValueMap {
                            forward,
                            unmapped: formspec_core::UnmappedStrategy::PassThrough,
                        }
                    }
                    "expression" => formspec_core::TransformType::Expression(
                        rev_obj
                            .get("expression")
                            .and_then(|v| v.as_str())
                            .unwrap_or("$")
                            .to_string(),
                    ),
                    "constant" => formspec_core::TransformType::Expression(
                        rev_obj
                            .get("expression")
                            .and_then(|v| v.as_str())
                            .unwrap_or("null")
                            .to_string(),
                    ),
                    "coerce" => {
                        let coerce_val = rev_obj
                            .get("coerce")
                            .cloned()
                            .unwrap_or(Value::String("string".into()));
                        let coerce_type =
                            parse_coerce_type(&coerce_val).unwrap_or(formspec_core::CoerceType::String);
                        formspec_core::TransformType::Coerce(coerce_type)
                    }
                    _ => return None,
                };
                Some(Box::new(formspec_core::ReverseOverride {
                    transform: rev_transform,
                }))
            }),
        });
    }
    Ok(rules)
}

pub(crate) fn parse_mapping_document_inner(val: &Value) -> Result<MappingDocument, String> {
    let obj = val
        .as_object()
        .ok_or_else(|| "mapping document must be an object".to_string())?;
    let rules_val = obj.get("rules").cloned().unwrap_or(Value::Array(vec![]));
    let rules = parse_mapping_rules_inner(&rules_val)?;
    let defaults = obj.get("defaults").and_then(|v| v.as_object()).cloned();
    let auto_map = obj
        .get("autoMap")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    Ok(MappingDocument {
        rules,
        defaults,
        auto_map,
    })
}

/// Parse the document-level `direction` field (if present).
/// Returns None for bidirectional, Some(Forward) or Some(Reverse) for restricted docs.
pub(crate) fn parse_mapping_direction(val: &Value) -> Option<formspec_core::MappingDirection> {
    val.as_object()
        .and_then(|obj| obj.get("direction"))
        .and_then(|v| v.as_str())
        .and_then(|s| match s {
            "forward" => Some(formspec_core::MappingDirection::Forward),
            "reverse" => Some(formspec_core::MappingDirection::Reverse),
            _ => None,
        })
}
// ── Runtime Mapping ─────────────────────────────────────────────

/// Execute a mapping transform (forward or reverse).
/// Returns JSON: { direction, output, rulesApplied, diagnostics }
#[wasm_bindgen(js_name = "executeMapping")]
pub fn execute_mapping_wasm(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, JsError> {
    execute_mapping_inner(rules_json, source_json, direction).map_err(|e| JsError::new(&e))
}

pub(crate) fn execute_mapping_inner(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, String> {
    let rules_val: Value =
        serde_json::from_str(rules_json).map_err(|e| format!("invalid rules JSON: {e}"))?;
    let source: Value =
        serde_json::from_str(source_json).map_err(|e| format!("invalid source JSON: {e}"))?;
    let dir = match direction {
        "forward" => formspec_core::MappingDirection::Forward,
        "reverse" => formspec_core::MappingDirection::Reverse,
        _ => return Err(format!("invalid direction: {direction}")),
    };

    let rules = parse_mapping_rules_inner(&rules_val)?;
    let result = execute_mapping(&rules, &source, dir);

    let json = serde_json::json!({
        "direction": direction,
        "output": result.output,
        "rulesApplied": result.rules_applied,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "ruleIndex": d.rule_index,
            "sourcePath": d.source_path,
            "targetPath": d.target_path,
            "errorCode": d.error_code.as_str(),
            "message": d.message,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}
// ── Mapping Document ────────────────────────────────────────────

/// Execute a full mapping document (rules + defaults + autoMap).
/// Returns JSON: { direction, output, rulesApplied, diagnostics }
#[wasm_bindgen(js_name = "executeMappingDoc")]
pub fn execute_mapping_doc_wasm(
    doc_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, JsError> {
    let doc_val: Value = serde_json::from_str(doc_json)
        .map_err(|e| JsError::new(&format!("invalid mapping document JSON: {e}")))?;
    let source: Value = serde_json::from_str(source_json)
        .map_err(|e| JsError::new(&format!("invalid source JSON: {e}")))?;
    let dir = match direction {
        "forward" => formspec_core::MappingDirection::Forward,
        "reverse" => formspec_core::MappingDirection::Reverse,
        _ => return Err(JsError::new(&format!("invalid direction: {direction}"))),
    };

    // Enforce document-level direction restriction
    let doc_direction = parse_mapping_direction(&doc_val);
    if let Some(allowed) = doc_direction
        && allowed != dir
    {
        let msg = if allowed == formspec_core::MappingDirection::Forward {
            "This mapping document is forward-only; reverse execution is not permitted"
        } else {
            "This mapping document is reverse-only; forward execution is not permitted"
        };
        let json = serde_json::json!({
            "direction": direction,
            "output": {},
            "rulesApplied": 0,
            "diagnostics": [{
                "ruleIndex": -1,
                "errorCode": "INVALID_DOCUMENT",
                "message": msg,
            }],
        });
        return serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()));
    }

    let doc = parse_mapping_document_inner(&doc_val).map_err(|e| JsError::new(&e))?;
    let result = execute_mapping_doc(&doc, &source, dir);

    let json = serde_json::json!({
        "direction": direction,
        "output": result.output,
        "rulesApplied": result.rules_applied,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "ruleIndex": d.rule_index,
            "sourcePath": d.source_path,
            "targetPath": d.target_path,
            "errorCode": d.error_code.as_str(),
            "message": d.message,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
