//! FEL evaluation, analysis, rewrite helpers, and path utilities (`wasm_bindgen`).

use std::collections::HashMap;

use fel_core::{
    builtin_function_catalog, evaluate, extract_dependencies, fel_to_json, json_to_fel, parse,
    print_expr, tokenize, FelValue, FormspecEnvironment, MapEnvironment, MipState,
};
use formspec_core::{
    analyze_fel, collect_fel_rewrite_targets, get_fel_dependencies, normalize_indexed_path,
    parent_path, rewrite_fel_source_references, rewrite_message_template, RewriteOptions,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

use crate::convert::{
    deps_to_json, json_item_at_path, json_item_location_at_path, json_to_field_map,
    push_repeat_context,
};

// ── FEL Evaluation ──────────────────────────────────────────────

/// Parse and evaluate a FEL expression with optional field values (JSON object).
/// Returns the result as a JSON string.
#[wasm_bindgen(js_name = "evalFEL")]
pub fn eval_fel(expression: &str, fields_json: &str) -> Result<String, JsError> {
    eval_fel_inner(expression, fields_json).map_err(|e| JsError::new(&e))
}

pub(crate) fn eval_fel_inner(expression: &str, fields_json: &str) -> Result<String, String> {
    let expr = parse(expression).map_err(|e| e.to_string())?;

    let fields: HashMap<String, FelValue> = if fields_json.is_empty() || fields_json == "{}" {
        HashMap::new()
    } else {
        let json_val: Value =
            serde_json::from_str(fields_json).map_err(|e| format!("invalid fields JSON: {e}"))?;
        json_to_field_map(&json_val)
    };

    let env = MapEnvironment::with_fields(fields);
    let result = evaluate(&expr, &env);

    let json = fel_to_json(&result.value);
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Evaluate a FEL expression with full FormspecEnvironment context.
/// `context_json` is a JSON object: { fields, variables?, mipStates?, repeatContext? }
#[wasm_bindgen(js_name = "evalFELWithContext")]
pub fn eval_fel_with_context(expression: &str, context_json: &str) -> Result<String, JsError> {
    eval_fel_with_context_inner(expression, context_json).map_err(|e| JsError::new(&e))
}

pub(crate) fn eval_fel_with_context_inner(expression: &str, context_json: &str) -> Result<String, String> {
    let expr = parse(expression).map_err(|e| e.to_string())?;

    let ctx: Value =
        serde_json::from_str(context_json).map_err(|e| format!("invalid context JSON: {e}"))?;
    let ctx_obj = ctx.as_object().ok_or("context must be a JSON object")?;

    let mut env = FormspecEnvironment::new();

    if let Some(now_iso) = ctx_obj.get("nowIso").and_then(|v| v.as_str()) {
        env.set_now_from_iso(now_iso);
    }

    // Fields: { path: value }
    if let Some(fields) = ctx_obj.get("fields")
        && let Some(obj) = fields.as_object()
    {
        for (k, v) in obj {
            env.set_field(k, json_to_fel(v));
        }
    }

    // Variables: { name: value }
    if let Some(vars) = ctx_obj.get("variables")
        && let Some(obj) = vars.as_object()
    {
        for (k, v) in obj {
            env.set_variable(k, json_to_fel(v));
        }
    }

    // MIP states: { path: { valid, relevant, readonly, required } }
    if let Some(mips) = ctx_obj.get("mipStates")
        && let Some(obj) = mips.as_object()
    {
        for (k, v) in obj {
            if let Some(mip_obj) = v.as_object() {
                env.set_mip(
                    k,
                    MipState {
                        valid: mip_obj
                            .get("valid")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(true),
                        relevant: mip_obj
                            .get("relevant")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(true),
                        readonly: mip_obj
                            .get("readonly")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                        required: mip_obj
                            .get("required")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                    },
                );
            }
        }
    }

    // Repeat context: { current, index, count, collection?, parent? }
    if let Some(repeat) = ctx_obj.get("repeatContext") {
        push_repeat_context(&mut env, repeat, 0);
    }

    // Instances: { name: value }
    if let Some(instances) = ctx_obj.get("instances")
        && let Some(obj) = instances.as_object()
    {
        for (k, v) in obj {
            env.set_instance(k, json_to_fel(v));
        }
    }

    let result = evaluate(&expr, &env);
    let undef_fns: Vec<&str> = result
        .diagnostics
        .iter()
        .filter(|diag| diag.message.starts_with("undefined function: "))
        .map(|diag| {
            diag.message
                .trim_start_matches("undefined function: ")
                .trim()
        })
        .collect();
    if !undef_fns.is_empty() {
        let names = undef_fns.join(", ");
        return Err(format!("Unsupported FEL function: {names}"));
    }
    let json = fel_to_json(&result.value);
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Parse a FEL expression and return whether it's valid.
#[wasm_bindgen(js_name = "parseFEL")]
pub fn parse_fel(expression: &str) -> bool {
    parse(expression).is_ok()
}

#[wasm_bindgen(js_name = "tokenizeFEL")]
pub fn tokenize_fel(expression: &str) -> Result<String, JsError> {
    tokenize_fel_inner(expression).map_err(|e| JsError::new(&e))
}

pub(crate) fn tokenize_fel_inner(expression: &str) -> Result<String, String> {
    let tokens = tokenize(expression)?;
    let json = tokens
        .into_iter()
        .map(|token| {
            serde_json::json!({
                "tokenType": token.token_type,
                "text": token.text,
                "start": token.start,
                "end": token.end,
            })
        })
        .collect::<Vec<_>>();
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Print a FEL expression AST back to normalized source string.
/// Useful for round-tripping after AST transformations.
#[wasm_bindgen(js_name = "printFEL")]
pub fn print_fel(expression: &str) -> Result<String, JsError> {
    let expr = parse(expression).map_err(|e| JsError::new(&e.to_string()))?;
    Ok(print_expr(&expr))
}

/// Extract field dependencies from a FEL expression.
/// Returns a JSON array of field path strings.
#[wasm_bindgen(js_name = "getFELDependencies")]
pub fn get_fel_deps(expression: &str) -> Result<String, JsError> {
    let deps = get_fel_dependencies(expression);
    let arr: Vec<&str> = deps.iter().map(|s| s.as_str()).collect();
    serde_json::to_string(&arr).map_err(|e| JsError::new(&e.to_string()))
}

/// Extract full dependency info from a FEL expression.
/// Returns a JSON object with dependency details.
#[wasm_bindgen(js_name = "extractDependencies")]
pub fn extract_deps(expression: &str) -> Result<String, JsError> {
    let expr = parse(expression).map_err(|e| JsError::new(&e.to_string()))?;
    let deps = extract_dependencies(&expr);
    let json = deps_to_json(&deps);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── FEL Analysis ────────────────────────────────────────────────

/// Analyze a FEL expression and return structural info.
/// Returns JSON: { valid, errors, references, variables, functions }
#[wasm_bindgen(js_name = "analyzeFEL")]
pub fn analyze_fel_wasm(expression: &str) -> Result<String, JsError> {
    let result = analyze_fel(expression);
    let json = serde_json::json!({
        "valid": result.valid,
        "errors": result.errors.iter().map(|e| &e.message).collect::<Vec<_>>(),
        "references": result.references.iter().collect::<Vec<_>>(),
        "variables": result.variables.iter().collect::<Vec<_>>(),
        "functions": result.functions.iter().collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Collect rewriteable targets from a FEL expression.
#[wasm_bindgen(js_name = "collectFELRewriteTargets")]
pub fn collect_fel_rewrite_targets_wasm(expression: &str) -> Result<String, JsError> {
    let targets = collect_fel_rewrite_targets(expression);
    let mut field_paths: Vec<_> = targets.field_paths.into_iter().collect();
    field_paths.sort();
    let mut current_paths: Vec<_> = targets.current_paths.into_iter().collect();
    current_paths.sort();
    let mut variables: Vec<_> = targets.variables.into_iter().collect();
    variables.sort();
    let mut instance_names: Vec<_> = targets.instance_names.into_iter().collect();
    instance_names.sort();
    let navigation_targets = targets
        .navigation_targets
        .into_iter()
        .map(|entry| {
            serde_json::json!({
                "functionName": entry.function_name,
                "name": entry.name,
            })
        })
        .collect::<Vec<_>>();
    let json = serde_json::json!({
        "fieldPaths": field_paths,
        "currentPaths": current_paths,
        "variables": variables,
        "instanceNames": instance_names,
        "navigationTargets": navigation_targets,
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Rewrite a FEL expression using explicit rewrite maps.
#[wasm_bindgen(js_name = "rewriteFELReferences")]
pub fn rewrite_fel_references_wasm(
    expression: &str,
    rewrites_json: &str,
) -> Result<String, JsError> {
    let rewrites: Value = serde_json::from_str(rewrites_json)
        .map_err(|e| JsError::new(&format!("invalid rewrites JSON: {e}")))?;

    let empty = serde_json::Map::new();
    let rewrites_obj = rewrites.as_object().unwrap_or(&empty);
    let field_paths = rewrites_obj.get("fieldPaths").and_then(Value::as_object);
    let current_paths = rewrites_obj.get("currentPaths").and_then(Value::as_object);
    let variables = rewrites_obj.get("variables").and_then(Value::as_object);
    let instance_names = rewrites_obj.get("instanceNames").and_then(Value::as_object);
    let navigation_targets = rewrites_obj
        .get("navigationTargets")
        .and_then(Value::as_object);

    let options = RewriteOptions {
        rewrite_field_path: field_paths.map(|entries| {
            let map = entries.clone();
            Box::new(move |path: &str| {
                map.get(path)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as Box<dyn Fn(&str) -> Option<String>>
        }),
        rewrite_current_path: current_paths.map(|entries| {
            let map = entries.clone();
            Box::new(move |path: &str| {
                map.get(path)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as Box<dyn Fn(&str) -> Option<String>>
        }),
        rewrite_variable: variables.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str| {
                map.get(name)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as Box<dyn Fn(&str) -> Option<String>>
        }),
        rewrite_instance_name: instance_names.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str| {
                map.get(name)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as Box<dyn Fn(&str) -> Option<String>>
        }),
        rewrite_navigation_target: navigation_targets.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str, fn_name: &str| {
                let key = format!("{fn_name}:{name}");
                map.get(&key)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as Box<dyn Fn(&str, &str) -> Option<String>>
        }),
    };

    Ok(rewrite_fel_source_references(expression, &options))
}

/// Rewrite FEL expressions embedded in {{...}} interpolation segments.
#[wasm_bindgen(js_name = "rewriteMessageTemplate")]
pub fn rewrite_message_template_wasm(
    message: &str,
    rewrites_json: &str,
) -> Result<String, JsError> {
    let rewrites: Value = serde_json::from_str(rewrites_json)
        .map_err(|e| JsError::new(&format!("invalid rewrites JSON: {e}")))?;

    let empty = serde_json::Map::new();
    let rewrites_obj = rewrites.as_object().unwrap_or(&empty);
    let field_paths = rewrites_obj.get("fieldPaths").and_then(Value::as_object);
    let current_paths = rewrites_obj.get("currentPaths").and_then(Value::as_object);
    let variables = rewrites_obj.get("variables").and_then(Value::as_object);
    let instance_names = rewrites_obj.get("instanceNames").and_then(Value::as_object);
    let navigation_targets = rewrites_obj
        .get("navigationTargets")
        .and_then(Value::as_object);

    Ok(rewrite_message_template(
        message,
        &RewriteOptions {
            rewrite_field_path: field_paths.map(|entries| {
                let map = entries.clone();
                Box::new(move |path: &str| {
                    map.get(path)
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                }) as Box<dyn Fn(&str) -> Option<String>>
            }),
            rewrite_current_path: current_paths.map(|entries| {
                let map = entries.clone();
                Box::new(move |path: &str| {
                    map.get(path)
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                }) as Box<dyn Fn(&str) -> Option<String>>
            }),
            rewrite_variable: variables.map(|entries| {
                let map = entries.clone();
                Box::new(move |name: &str| {
                    map.get(name)
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                }) as Box<dyn Fn(&str) -> Option<String>>
            }),
            rewrite_instance_name: instance_names.map(|entries| {
                let map = entries.clone();
                Box::new(move |name: &str| {
                    map.get(name)
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                }) as Box<dyn Fn(&str) -> Option<String>>
            }),
            rewrite_navigation_target: navigation_targets.map(|entries| {
                let map = entries.clone();
                Box::new(move |name: &str, fn_name: &str| {
                    let key = format!("{fn_name}:{name}");
                    map.get(&key)
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                }) as Box<dyn Fn(&str, &str) -> Option<String>>
            }),
        },
    ))
}

/// Return builtin FEL function metadata for tooling/autocomplete surfaces.
#[wasm_bindgen(js_name = "listBuiltinFunctions")]
pub fn list_builtin_functions() -> Result<String, JsError> {
    let json = serde_json::json!(
        builtin_function_catalog()
            .iter()
            .map(|entry| serde_json::json!({
                "name": entry.name,
                "category": entry.category,
                "signature": entry.signature,
                "description": entry.description,
            }))
            .collect::<Vec<_>>()
    );
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Path Utils ──────────────────────────────────────────────────

/// Normalize a dotted path by stripping repeat indices.
#[wasm_bindgen(js_name = "normalizeIndexedPath")]
pub fn normalize_path(path: &str) -> String {
    normalize_indexed_path(path)
}

/// Find an item in a JSON item tree by dotted path.
#[wasm_bindgen(js_name = "itemAtPath")]
pub fn item_at_path_wasm(items_json: &str, path: &str) -> Result<String, JsError> {
    let items: Vec<Value> = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let json = json_item_at_path(&items, path)
        .cloned()
        .unwrap_or(Value::Null);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Resolve the index, item, and parent path for a dotted item-tree path.
#[wasm_bindgen(js_name = "itemLocationAtPath")]
pub fn item_location_at_path_wasm(items_json: &str, path: &str) -> Result<String, JsError> {
    let items: Vec<Value> = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let json = match json_item_location_at_path(&items, path) {
        Some((index, item)) => serde_json::json!({
            "parentPath": parent_path(path),
            "index": index,
            "item": item.clone(),
        }),
        None => Value::Null,
    };
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
