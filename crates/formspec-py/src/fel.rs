//! FEL evaluation, parse, and dependency PyO3 bindings.

use std::collections::HashMap;

use pyo3::prelude::*;
use pyo3::types::PyDict;

use fel_core::{
    JsonWireStyle, MapEnvironment, builtin_function_catalog_json_value,
    dependencies_to_json_value_styled, evaluate, extract_dependencies,
    fel_diagnostics_to_json_value, parse, prepare_fel_expression_owned,
    prepare_fel_host_options_from_json_map,
};
use formspec_core::{
    analyze_fel, assembly_fel_rewrite_map_from_value, fel_analysis_to_json_value,
    get_fel_dependencies, rewrite_fel_for_assembly as rewrite_fel_for_assembly_core,
};
use serde_json::Value;

use crate::PyObject;
use crate::convert::{
    build_formspec_env, depythonize_json, fel_to_python, fel_to_python_tagged, json_to_python,
    parse_fel_expr, pydict_to_field_map,
};

// ── FEL Evaluation ──────────────────────────────────────────────

/// Parse and evaluate a FEL expression with optional field values.
///
/// Args:
///     expression: FEL expression string
///     fields: Optional dict of field name → value
///
/// Returns:
///     The evaluated result as a Python value (None, bool, int, float, str, list, dict)
#[pyfunction]
pub fn eval_fel(
    py: Python,
    expression: &str,
    fields: Option<&Bound<'_, PyDict>>,
) -> PyResult<PyObject> {
    let expr = parse_fel_expr(expression)?;

    let field_map = match fields {
        Some(dict) => pydict_to_field_map(py, dict)?,
        None => HashMap::new(),
    };

    let env = MapEnvironment::with_fields(field_map);
    let result = evaluate(&expr, &env);

    fel_to_python(py, &result.value)
}

/// Parse and evaluate a FEL expression with full Formspec context.
///
/// Args:
///     expression: FEL expression string
///     fields: Optional dict of field name → value
///     instances: Optional dict of instance name → value
///     mip_states: Optional dict of field path → {valid, relevant, readonly, required}
///     variables: Optional dict of variable name → value
///
/// Returns:
///     A dict with: value, diagnostics
#[pyfunction(signature = (expression, fields=None, instances=None, mip_states=None, variables=None, now_iso=None))]
pub fn eval_fel_detailed(
    py: Python,
    expression: &str,
    fields: Option<&Bound<'_, PyDict>>,
    instances: Option<&Bound<'_, PyDict>>,
    mip_states: Option<&Bound<'_, PyDict>>,
    variables: Option<&Bound<'_, PyDict>>,
    now_iso: Option<&str>,
) -> PyResult<PyObject> {
    let expr = parse_fel_expr(expression)?;
    let env = build_formspec_env(py, fields, instances, mip_states, variables, now_iso)?;
    let result = evaluate(&expr, &env);

    let diagnostics = json_to_python(py, &fel_diagnostics_to_json_value(&result.diagnostics))?;

    let payload = PyDict::new(py);
    payload.set_item("value", fel_to_python_tagged(py, &result.value)?)?;
    payload.set_item("diagnostics", diagnostics)?;
    Ok(payload.into())
}

/// Parse a FEL expression and return whether it's valid.
#[pyfunction]
pub fn parse_fel(expression: &str) -> bool {
    parse(expression).is_ok()
}

/// Extract field dependencies from a FEL expression.
///
/// Returns a list of field path strings.
#[pyfunction]
pub fn get_dependencies(expression: &str) -> Vec<String> {
    get_fel_dependencies(expression).into_iter().collect()
}

/// Extract full dependency info from a FEL expression.
///
/// Returns a dict with: fields, context_refs, instance_refs, mip_deps,
/// has_self_ref, has_wildcard, uses_prev_next.
#[pyfunction]
pub fn extract_deps(py: Python, expression: &str) -> PyResult<PyObject> {
    let expr = parse_fel_expr(expression)?;
    let deps = extract_dependencies(&expr);
    let json = dependencies_to_json_value_styled(&deps, JsonWireStyle::PythonSnake);
    json_to_python(py, &json)
}

// ── FEL Analysis ────────────────────────────────────────────────

/// Analyze a FEL expression, extracting references, variables, and functions.
///
/// Returns a dict with: valid, errors, references, variables, functions.
#[pyfunction]
pub fn analyze_expression(py: Python, expression: &str) -> PyResult<PyObject> {
    let result = analyze_fel(expression);
    let json = fel_analysis_to_json_value(&result);
    json_to_python(py, &json)
}

/// Return builtin FEL function metadata for Python tooling surfaces.
#[pyfunction]
pub fn list_builtin_functions(py: Python) -> PyResult<PyObject> {
    let json = builtin_function_catalog_json_value();
    json_to_python(py, &json)
}

/// Normalize FEL source for evaluation (same rules as the TS engine / `prepareFelExpression` WASM).
///
/// Args:
///     options: dict with `expression` (required), optional `current_item_path` / `currentItemPath`,
///         `replace_self_ref` / `replaceSelfRef`, `repeat_counts` / `repeatCounts`,
///         and `values_by_path` / `valuesByPath` or `field_paths` / `fieldPaths`.
#[pyfunction]
pub fn prepare_fel_expression(options: &Bound<'_, PyAny>) -> PyResult<String> {
    let v: Value = depythonize_json(options)?;
    let m = v.as_object().ok_or_else(|| {
        pyo3::exceptions::PyTypeError::new_err("prepare_fel_expression options must be a dict")
    })?;
    let owned = prepare_fel_host_options_from_json_map(m)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
    Ok(prepare_fel_expression_owned(&owned))
}

/// Rewrite FEL using definition-assembly RewriteMap (fragment + host keys, same as TS `rewriteFEL`).
#[pyfunction]
#[pyo3(name = "rewrite_fel_for_assembly")]
pub fn rewrite_fel_for_assembly_py(expression: &str, map: &Bound<'_, PyAny>) -> PyResult<String> {
    let v: Value = depythonize_json(map)?;
    let m = assembly_fel_rewrite_map_from_value(&v)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e))?;
    Ok(rewrite_fel_for_assembly_core(expression, &m))
}
