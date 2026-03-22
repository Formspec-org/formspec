//! FEL evaluation, analysis, rewrite helpers, and path utilities (`wasm_bindgen`).

use fel_core::{
    builtin_function_catalog_json_value, dependencies_to_json_value, evaluate, extract_dependencies,
    fel_to_json, field_map_from_json_str, formspec_environment_from_json_map, parse, print_expr,
    reject_undefined_functions, tokenize_to_json_value,
};
use formspec_core::{
    analyze_fel, collect_fel_rewrite_targets, definition_item_location_to_json_value,
    fel_analysis_to_json_value, fel_rewrite_targets_to_json_value, get_fel_dependencies,
    json_definition_item_at_path, normalize_indexed_path, rewrite_fel_source_references,
    rewrite_message_template, rewrite_options_from_camel_case_json, JsonWireStyle,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

fn parse_fel_source(expression: &str) -> Result<fel_core::Expr, String> {
    parse(expression).map_err(|e| e.to_string())
}

// ── FEL Evaluation ──────────────────────────────────────────────

/// Parse and evaluate a FEL expression with optional field values (JSON object).
/// Returns the result as a JSON string.
#[wasm_bindgen(js_name = "evalFEL")]
pub fn eval_fel(expression: &str, fields_json: &str) -> Result<String, JsError> {
    eval_fel_inner(expression, fields_json).map_err(|e| JsError::new(&e))
}

pub(crate) fn eval_fel_inner(expression: &str, fields_json: &str) -> Result<String, String> {
    let expr = parse_fel_source(expression)?;
    let fields = field_map_from_json_str(fields_json)?;
    let env = fel_core::MapEnvironment::with_fields(fields);
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

pub(crate) fn eval_fel_with_context_inner(
    expression: &str,
    context_json: &str,
) -> Result<String, String> {
    let expr = parse_fel_source(expression)?;
    let ctx: Value =
        serde_json::from_str(context_json).map_err(|e| format!("invalid context JSON: {e}"))?;
    let ctx_obj = ctx.as_object().ok_or("context must be a JSON object")?;
    let env = formspec_environment_from_json_map(ctx_obj);
    let result = evaluate(&expr, &env);
    reject_undefined_functions(&result.diagnostics)?;
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
    let json = tokenize_to_json_value(expression)?;
    serde_json::to_string(&json).map_err(|e| e.to_string())
}

/// Print a FEL expression AST back to normalized source string.
#[wasm_bindgen(js_name = "printFEL")]
pub fn print_fel(expression: &str) -> Result<String, JsError> {
    let expr = parse_fel_source(expression).map_err(|e| JsError::new(&e))?;
    Ok(print_expr(&expr))
}

/// Extract field dependencies from a FEL expression.
#[wasm_bindgen(js_name = "getFELDependencies")]
pub fn get_fel_deps(expression: &str) -> Result<String, JsError> {
    let deps = get_fel_dependencies(expression);
    let arr: Vec<&str> = deps.iter().map(|s| s.as_str()).collect();
    serde_json::to_string(&arr).map_err(|e| JsError::new(&e.to_string()))
}

/// Extract full dependency info from a FEL expression.
#[wasm_bindgen(js_name = "extractDependencies")]
pub fn extract_deps(expression: &str) -> Result<String, JsError> {
    let expr = parse_fel_source(expression).map_err(|e| JsError::new(&e))?;
    let deps = extract_dependencies(&expr);
    let json = dependencies_to_json_value(&deps);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── FEL Analysis ────────────────────────────────────────────────

#[wasm_bindgen(js_name = "analyzeFEL")]
pub fn analyze_fel_wasm(expression: &str) -> Result<String, JsError> {
    let result = analyze_fel(expression);
    let json = fel_analysis_to_json_value(&result);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = "collectFELRewriteTargets")]
pub fn collect_fel_rewrite_targets_wasm(expression: &str) -> Result<String, JsError> {
    let targets = collect_fel_rewrite_targets(expression);
    let json = fel_rewrite_targets_to_json_value(&targets);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = "rewriteFELReferences")]
pub fn rewrite_fel_references_wasm(
    expression: &str,
    rewrites_json: &str,
) -> Result<String, JsError> {
    let rewrites: Value = serde_json::from_str(rewrites_json)
        .map_err(|e| JsError::new(&format!("invalid rewrites JSON: {e}")))?;
    let options = rewrite_options_from_camel_case_json(&rewrites);
    Ok(rewrite_fel_source_references(expression, &options))
}

#[wasm_bindgen(js_name = "rewriteMessageTemplate")]
pub fn rewrite_message_template_wasm(
    message: &str,
    rewrites_json: &str,
) -> Result<String, JsError> {
    let rewrites: Value = serde_json::from_str(rewrites_json)
        .map_err(|e| JsError::new(&format!("invalid rewrites JSON: {e}")))?;
    let options = rewrite_options_from_camel_case_json(&rewrites);
    Ok(rewrite_message_template(message, &options))
}

#[wasm_bindgen(js_name = "listBuiltinFunctions")]
pub fn list_builtin_functions() -> Result<String, JsError> {
    let json = builtin_function_catalog_json_value();
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

// ── Path Utils ──────────────────────────────────────────────────

#[wasm_bindgen(js_name = "normalizeIndexedPath")]
pub fn normalize_path(path: &str) -> String {
    normalize_indexed_path(path)
}

#[wasm_bindgen(js_name = "itemAtPath")]
pub fn item_at_path_wasm(items_json: &str, path: &str) -> Result<String, JsError> {
    let items: Vec<Value> = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let json = json_definition_item_at_path(&items, path)
        .cloned()
        .unwrap_or(Value::Null);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = "itemLocationAtPath")]
pub fn item_location_at_path_wasm(items_json: &str, path: &str) -> Result<String, JsError> {
    let items: Vec<Value> = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let json = definition_item_location_to_json_value(&items, path, JsonWireStyle::JsCamel);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
