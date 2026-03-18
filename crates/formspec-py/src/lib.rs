//! PyO3 bindings for Formspec — FEL, linting, and definition evaluation to Python.

/// PyO3 bindings for Formspec — exposes FEL evaluation, linting, and evaluation to Python.
///
/// This replaces the pure-Python FEL implementation (src/formspec/fel/)
/// with native Rust performance while maintaining the same API surface.
use pyo3::prelude::*;
use pyo3::types::{PyBool, PyDict, PyList};

use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde_json::Value;
use std::collections::HashMap;

use fel_core::{evaluate, extract_dependencies, parse, FelValue, MapEnvironment};
use formspec_core::{analyze_fel, detect_document_type, get_fel_dependencies};
use formspec_eval::evaluate_definition;
use formspec_lint::lint;

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
fn eval_fel(py: Python, expression: &str, fields: Option<&Bound<'_, PyDict>>) -> PyResult<PyObject> {
    let expr = parse(expression)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let field_map = match fields {
        Some(dict) => pydict_to_field_map(py, dict)?,
        None => HashMap::new(),
    };

    let env = MapEnvironment::with_fields(field_map);
    let result = evaluate(&expr, &env);

    fel_to_python(py, &result.value)
}

/// Parse a FEL expression and return whether it's valid.
#[pyfunction]
fn parse_fel(expression: &str) -> bool {
    parse(expression).is_ok()
}

/// Extract field dependencies from a FEL expression.
///
/// Returns a list of field path strings.
#[pyfunction]
fn get_dependencies(expression: &str) -> Vec<String> {
    get_fel_dependencies(expression).into_iter().collect()
}

/// Extract full dependency info from a FEL expression.
///
/// Returns a dict with: fields, context_refs, instance_refs, mip_deps,
/// has_self_ref, has_wildcard, uses_prev_next.
#[pyfunction]
fn extract_deps(py: Python, expression: &str) -> PyResult<PyObject> {
    let expr = parse(expression)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let deps = extract_dependencies(&expr);

    let dict = PyDict::new(py);
    dict.set_item("fields", deps.fields.iter().collect::<Vec<_>>())?;
    dict.set_item("context_refs", deps.context_refs.iter().collect::<Vec<_>>())?;
    dict.set_item("instance_refs", deps.instance_refs.iter().collect::<Vec<_>>())?;
    dict.set_item("mip_deps", deps.mip_deps.iter().collect::<Vec<_>>())?;
    dict.set_item("has_self_ref", deps.has_self_ref)?;
    dict.set_item("has_wildcard", deps.has_wildcard)?;
    dict.set_item("uses_prev_next", deps.uses_prev_next)?;

    Ok(dict.into())
}

// ── FEL Analysis ────────────────────────────────────────────────

/// Analyze a FEL expression, extracting references, variables, and functions.
///
/// Returns a dict with: valid, errors, references, variables, functions.
#[pyfunction]
fn analyze_expression(py: Python, expression: &str) -> PyResult<PyObject> {
    let result = analyze_fel(expression);

    let dict = PyDict::new(py);
    dict.set_item("valid", result.valid)?;
    dict.set_item("errors", result.errors.iter().map(|e| e.message.clone()).collect::<Vec<_>>())?;
    dict.set_item("references", result.references.into_iter().collect::<Vec<_>>())?;
    dict.set_item("variables", result.variables.into_iter().collect::<Vec<_>>())?;
    dict.set_item("functions", result.functions.into_iter().collect::<Vec<_>>())?;

    Ok(dict.into())
}

// ── Document Type Detection ─────────────────────────────────────

/// Detect the Formspec document type from a JSON string.
///
/// Returns the document type string or None.
#[pyfunction]
fn detect_type(json_str: &str) -> PyResult<Option<String>> {
    let doc: Value = serde_json::from_str(json_str)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;
    Ok(detect_document_type(&doc).map(|dt| dt.schema_key().to_string()))
}

// ── Linting ─────────────────────────────────────────────────────

/// Lint a Formspec document (7-pass static analysis).
///
/// Args:
///     json_str: JSON string of the Formspec document
///
/// Returns:
///     A dict with: document_type, valid, diagnostics (list of dicts)
#[pyfunction]
fn lint_document(py: Python, json_str: &str) -> PyResult<PyObject> {
    let doc: Value = serde_json::from_str(json_str)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;

    let result = lint(&doc);

    let diagnostics = PyList::empty(py);
    for d in &result.diagnostics {
        let diag = PyDict::new(py);
        diag.set_item("code", &d.code)?;
        diag.set_item("pass", d.pass)?;
        diag.set_item("severity", match d.severity {
            formspec_lint::LintSeverity::Error => "error",
            formspec_lint::LintSeverity::Warning => "warning",
            formspec_lint::LintSeverity::Info => "info",
        })?;
        diag.set_item("path", &d.path)?;
        diag.set_item("message", &d.message)?;
        diagnostics.append(diag)?;
    }

    let dict = PyDict::new(py);
    dict.set_item("document_type", result.document_type.map(|dt| dt.schema_key().to_string()))?;
    dict.set_item("valid", result.valid)?;
    dict.set_item("diagnostics", diagnostics)?;

    Ok(dict.into())
}

// ── Evaluation ──────────────────────────────────────────────────

/// Evaluate a Formspec definition against provided data.
///
/// Args:
///     definition_json: JSON string of the definition
///     data_json: JSON string of the data (field values)
///
/// Returns:
///     A dict with: values, validations, non_relevant
#[pyfunction]
fn evaluate_def(py: Python, definition_json: &str, data_json: &str) -> PyResult<PyObject> {
    let definition: Value = serde_json::from_str(definition_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid definition JSON: {e}")))?;
    let data_val: Value = serde_json::from_str(data_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid data JSON: {e}")))?;

    let data: HashMap<String, Value> = data_val.as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    let result = evaluate_definition(&definition, &data);

    let values = PyDict::new(py);
    for (k, v) in &result.values {
        values.set_item(k, json_to_python(py, v)?)?;
    }

    let validations = PyList::empty(py);
    for v in &result.validations {
        let entry = PyDict::new(py);
        entry.set_item("path", &v.path)?;
        entry.set_item("severity", &v.severity)?;
        entry.set_item("kind", &v.kind)?;
        entry.set_item("message", &v.message)?;
        validations.append(entry)?;
    }

    let dict = PyDict::new(py);
    dict.set_item("values", values)?;
    dict.set_item("validations", validations)?;
    dict.set_item("non_relevant", &result.non_relevant)?;

    Ok(dict.into())
}

// ── Python module ───────────────────────────────────────────────

/// formspec_rust — Native Rust implementation of Formspec processing.
#[pymodule]
fn formspec_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(eval_fel, m)?)?;
    m.add_function(wrap_pyfunction!(parse_fel, m)?)?;
    m.add_function(wrap_pyfunction!(get_dependencies, m)?)?;
    m.add_function(wrap_pyfunction!(extract_deps, m)?)?;
    m.add_function(wrap_pyfunction!(analyze_expression, m)?)?;
    m.add_function(wrap_pyfunction!(detect_type, m)?)?;
    m.add_function(wrap_pyfunction!(lint_document, m)?)?;
    m.add_function(wrap_pyfunction!(evaluate_def, m)?)?;
    Ok(())
}

// ── Type conversion helpers ─────────────────────────────────────

fn pydict_to_field_map(py: Python, dict: &Bound<'_, PyDict>) -> PyResult<HashMap<String, FelValue>> {
    let mut map = HashMap::new();
    for (key, value) in dict.iter() {
        let k: String = key.extract()?;
        let v = python_to_fel(py, &value)?;
        map.insert(k, v);
    }
    Ok(map)
}

fn python_to_fel(py: Python, obj: &Bound<'_, PyAny>) -> PyResult<FelValue> {
    if obj.is_none() {
        return Ok(FelValue::Null);
    }
    if let Ok(b) = obj.extract::<bool>() {
        return Ok(FelValue::Boolean(b));
    }
    if let Ok(i) = obj.extract::<i64>() {
        return Ok(FelValue::Number(Decimal::from(i)));
    }
    if let Ok(f) = obj.extract::<f64>() {
        return Ok(FelValue::Number(
            Decimal::from_f64(f).unwrap_or(Decimal::ZERO),
        ));
    }
    if let Ok(s) = obj.extract::<String>() {
        return Ok(FelValue::String(s));
    }
    if let Ok(list) = obj.downcast::<PyList>() {
        let mut arr = Vec::new();
        for item in list.iter() {
            arr.push(python_to_fel(py, &item)?);
        }
        return Ok(FelValue::Array(arr));
    }
    if let Ok(dict) = obj.downcast::<PyDict>() {
        let mut entries = Vec::new();
        for (k, v) in dict.iter() {
            let key: String = k.extract()?;
            let val = python_to_fel(py, &v)?;
            entries.push((key, val));
        }
        return Ok(FelValue::Object(entries));
    }
    Ok(FelValue::Null)
}

fn fel_to_python(py: Python, val: &FelValue) -> PyResult<PyObject> {
    match val {
        FelValue::Null => Ok(py.None()),
        FelValue::Boolean(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        FelValue::Number(n) => {
            if n.fract().is_zero() {
                if let Some(i) = n.to_i64() {
                    return Ok(i.into_pyobject(py)?.into_any().unbind());
                }
            }
            if let Some(f) = n.to_f64() {
                Ok(f.into_pyobject(py)?.into_any().unbind())
            } else {
                Ok(py.None())
            }
        }
        FelValue::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        FelValue::Date(d) => Ok(d.format_iso().into_pyobject(py)?.into_any().unbind()),
        FelValue::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(fel_to_python(py, item)?)?;
            }
            Ok(list.into())
        }
        FelValue::Object(entries) => {
            let dict = PyDict::new(py);
            for (k, v) in entries {
                dict.set_item(k, fel_to_python(py, v)?)?;
            }
            Ok(dict.into())
        }
        FelValue::Money(m) => {
            let dict = PyDict::new(py);
            dict.set_item("amount", fel_to_python(py, &FelValue::Number(m.amount))?)?;
            dict.set_item("currency", &m.currency)?;
            Ok(dict.into())
        }
    }
}

fn json_to_python(py: Python, val: &Value) -> PyResult<PyObject> {
    match val {
        Value::Null => Ok(py.None()),
        Value::Bool(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(i.into_pyobject(py)?.into_any().unbind())
            } else if let Some(f) = n.as_f64() {
                Ok(f.into_pyobject(py)?.into_any().unbind())
            } else {
                Ok(py.None())
            }
        }
        Value::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        Value::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(json_to_python(py, item)?)?;
            }
            Ok(list.into())
        }
        Value::Object(map) => {
            let dict = PyDict::new(py);
            for (k, v) in map {
                dict.set_item(k, json_to_python(py, v)?)?;
            }
            Ok(dict.into())
        }
    }
}
