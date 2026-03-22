//! Definition batch evaluation and screener (`wasm_bindgen`).

use std::collections::HashMap;

use formspec_eval::{
    evaluate_definition_full_with_instances_and_context, evaluate_screener, EvalContext,
    EvalTrigger, ExtensionConstraint, ValidationResult,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

// ── Definition Evaluation ───────────────────────────────────────

/// Evaluate a Formspec definition against provided data (4-phase batch processor).
/// Returns JSON: { values, validations, nonRelevant, variables, required, readonly }
#[wasm_bindgen(js_name = "evaluateDefinition")]
pub fn evaluate_definition_wasm(
    definition_json: &str,
    data_json: &str,
    context_json: Option<String>,
) -> Result<String, JsError> {
    evaluate_definition_inner(definition_json, data_json, context_json).map_err(|e| JsError::new(&e))
}

pub(crate) fn evaluate_definition_inner(
    definition_json: &str,
    data_json: &str,
    context_json: Option<String>,
) -> Result<String, String> {
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| format!("invalid definition JSON: {e}"))?;
    let data_val: Value =
        serde_json::from_str(data_json).map_err(|e| format!("invalid data JSON: {e}"))?;

    let data: HashMap<String, Value> = data_val
        .as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    let (context, trigger, instances, constraints) = match context_json {
        Some(context_json) => {
            let ctx: Value = serde_json::from_str(&context_json)
                .map_err(|e| format!("invalid context JSON: {e}"))?;
            let ctx_obj = ctx.as_object().ok_or("context must be a JSON object")?;
            let eval_ctx = parse_eval_context(ctx_obj)?;
            let eval_trigger = parse_eval_trigger(ctx_obj)?;
            let inst = parse_instances(ctx_obj);
            let ext = parse_registry_documents(ctx_obj);
            (eval_ctx, eval_trigger, inst, ext)
        }
        None => (
            EvalContext::default(),
            EvalTrigger::Continuous,
            HashMap::new(),
            Vec::new(),
        ),
    };

    let result = evaluate_definition_full_with_instances_and_context(
        &definition,
        &data,
        trigger,
        &constraints,
        &instances,
        &context,
    );

    let json = serde_json::json!({
        "values": result.values,
        "validations": result.validations.iter().map(|v| {
            let mut entry = serde_json::json!({
                "path": v.path,
                "severity": v.severity,
                "constraintKind": v.constraint_kind,
                "code": v.code,
                "message": v.message,
                "source": v.source,
            });
            if let Some(ref constraint) = v.constraint {
                entry["constraint"] = serde_json::json!(constraint);
            }
            if let Some(ref sid) = v.shape_id {
                entry["shapeId"] = serde_json::json!(sid);
            }
            if let Some(ref context) = v.context {
                entry["context"] = serde_json::json!(context);
            }
            entry
        }).collect::<Vec<_>>(),
        "nonRelevant": result.non_relevant,
        "variables": result.variables,
        "required": result.required,
        "readonly": result.readonly,
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Evaluate screener routes for an isolated answer payload.
#[wasm_bindgen(js_name = "evaluateScreener")]
pub fn evaluate_screener_wasm(
    definition_json: &str,
    answers_json: &str,
) -> Result<String, JsError> {
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| JsError::new(&format!("invalid definition JSON: {e}")))?;
    let answers_val: Value = serde_json::from_str(answers_json)
        .map_err(|e| JsError::new(&format!("invalid answers JSON: {e}")))?;

    let answers: HashMap<String, Value> = answers_val
        .as_object()
        .map(|obj| obj.iter().map(|(key, value)| (key.clone(), value.clone())).collect())
        .unwrap_or_default();

    let route = evaluate_screener(&definition, &answers).map(|route| {
        let mut output = serde_json::json!({
            "target": route.target,
        });
        if let Some(label) = route.label {
            output["label"] = serde_json::json!(label);
        }
        if let Some(message) = route.message {
            output["message"] = serde_json::json!(message);
        }
        if let Some(extensions) = route.extensions {
            output["extensions"] = extensions;
        }
        output
    });

    serde_json::to_string(&route).map_err(|e| JsError::new(&e.to_string()))
}

fn parse_eval_context(ctx_obj: &serde_json::Map<String, Value>) -> Result<EvalContext, String> {
    let previous_validations = ctx_obj
        .get("previousValidations")
        .or_else(|| ctx_obj.get("previous_validations"))
        .map(parse_validation_results)
        .transpose()?;

    let previous_non_relevant = ctx_obj
        .get("previousNonRelevant")
        .or_else(|| ctx_obj.get("previous_non_relevant"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        });

    Ok(EvalContext {
        now_iso: ctx_obj
            .get("nowIso")
            .or_else(|| ctx_obj.get("now_iso"))
            .and_then(|v| v.as_str())
            .map(str::to_string),
        previous_validations,
        previous_non_relevant,
    })
}

fn parse_eval_trigger(ctx_obj: &serde_json::Map<String, Value>) -> Result<EvalTrigger, String> {
    let trigger = ctx_obj
        .get("trigger")
        .or_else(|| ctx_obj.get("evalTrigger"))
        .or_else(|| ctx_obj.get("eval_trigger"))
        .and_then(|value| value.as_str())
        .unwrap_or("continuous");

    match trigger {
        "continuous" => Ok(EvalTrigger::Continuous),
        "submit" => Ok(EvalTrigger::Submit),
        "demand" => Ok(EvalTrigger::Demand),
        "disabled" => Ok(EvalTrigger::Disabled),
        _ => Err(format!("invalid eval trigger: {trigger}")),
    }
}

fn parse_instances(ctx_obj: &serde_json::Map<String, Value>) -> HashMap<String, Value> {
    ctx_obj
        .get("instances")
        .and_then(|v| v.as_object())
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

/// Extract ExtensionConstraint structs from raw registry JSON documents in context.
/// Mirrors the PyO3 `extract_extension_constraints` function.
fn parse_registry_documents(ctx_obj: &serde_json::Map<String, Value>) -> Vec<ExtensionConstraint> {
    let docs = match ctx_obj
        .get("registryDocuments")
        .or_else(|| ctx_obj.get("registry_documents"))
        .and_then(|v| v.as_array())
    {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    let mut constraints = Vec::new();
    for doc_val in docs {
        let entries = match doc_val.get("entries").and_then(|v| v.as_array()) {
            Some(arr) => arr,
            None => continue,
        };

        for entry in entries {
            let name = match entry.get("name").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            let status = entry
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("stable")
                .to_string();

            let display_name = entry
                .get("metadata")
                .and_then(|m| m.get("displayName"))
                .and_then(|v| v.as_str())
                .map(String::from);

            let base_type = entry
                .get("baseType")
                .and_then(|v| v.as_str())
                .map(String::from);

            let deprecation_notice = entry
                .get("deprecationNotice")
                .and_then(|v| v.as_str())
                .map(String::from);

            let compatibility_version = entry
                .get("compatibility")
                .and_then(|c| c.get("formspecVersion"))
                .and_then(|v| v.as_str())
                .map(String::from);

            let constraint_obj = entry.get("constraints");

            let pattern = constraint_obj
                .and_then(|c| c.get("pattern"))
                .and_then(|v| v.as_str())
                .map(String::from);

            let max_length = constraint_obj
                .and_then(|c| c.get("maxLength"))
                .and_then(|v| v.as_u64());

            let minimum = constraint_obj
                .and_then(|c| c.get("minimum"))
                .and_then(|v| v.as_f64());

            let maximum = constraint_obj
                .and_then(|c| c.get("maximum"))
                .and_then(|v| v.as_f64());

            constraints.push(ExtensionConstraint {
                name,
                display_name,
                pattern,
                max_length,
                minimum,
                maximum,
                base_type,
                status,
                deprecation_notice,
                compatibility_version,
            });
        }
    }
    constraints
}

fn parse_validation_results(value: &Value) -> Result<Vec<ValidationResult>, String> {
    let validations = value
        .as_array()
        .ok_or("previousValidations must be an array")?;

    validations
        .iter()
        .map(parse_validation_result)
        .collect::<Result<Vec<_>, _>>()
}

fn parse_validation_result(value: &Value) -> Result<ValidationResult, String> {
    let obj = value
        .as_object()
        .ok_or("validation result must be an object")?;

    Ok(ValidationResult {
        path: required_string_field(obj, "path")?,
        severity: required_string_field(obj, "severity")?,
        constraint_kind: required_string_field_either(obj, "constraintKind", "constraint_kind")?,
        code: required_string_field(obj, "code")?,
        message: required_string_field(obj, "message")?,
        constraint: optional_string_field_either(obj, "constraint", "constraint"),
        source: required_string_field(obj, "source")?,
        shape_id: optional_string_field_either(obj, "shapeId", "shape_id"),
        context: match obj.get("context") {
            Some(ctx) => {
                let ctx_obj = ctx
                    .as_object()
                    .ok_or("validation context must be an object")?;
                Some(
                    ctx_obj
                        .iter()
                        .map(|(key, value)| (key.clone(), value.clone()))
                        .collect::<HashMap<_, _>>(),
                )
            }
            None => None,
        },
    })
}

fn required_string_field(
    obj: &serde_json::Map<String, Value>,
    key: &str,
) -> Result<String, String> {
    obj.get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("validation result missing string field '{key}'"))
}

fn required_string_field_either(
    obj: &serde_json::Map<String, Value>,
    primary: &str,
    secondary: &str,
) -> Result<String, String> {
    obj.get(primary)
        .or_else(|| obj.get(secondary))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| {
            format!(
                "validation result missing string field '{primary}' or '{secondary}'"
            )
        })
}

fn optional_string_field_either(
    obj: &serde_json::Map<String, Value>,
    primary: &str,
    secondary: &str,
) -> Option<String> {
    obj.get(primary)
        .or_else(|| obj.get(secondary))
        .and_then(Value::as_str)
        .map(str::to_string)
}
