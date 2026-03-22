//! Document type detection, linting, definition evaluation, and screener bindings.

use std::collections::HashMap;

use pyo3::prelude::*;
use pyo3::types::PyList;
use serde_json::Value;

use formspec_core::{JsonWireStyle, detect_document_type};
use formspec_eval::{
    evaluate_definition_full_with_instances, evaluate_screener, evaluation_result_to_json_value_styled,
    extension_constraints_from_registry_documents, screener_route_to_json_value,
};
use formspec_lint::{LintMode, LintOptions, lint_result_to_json_value, lint_with_options};

use crate::PyObject;
use crate::convert::{depythonize_json, json_object_to_string_map, json_to_python};

// ── Document Type Detection ─────────────────────────────────────

/// Detect the Formspec document type from a JSON string.
///
/// Returns the document type string or None.
#[pyfunction]
pub fn detect_type(document: &Bound<'_, PyAny>) -> PyResult<Option<String>> {
    let doc: Value = depythonize_json(document)?;
    Ok(detect_document_type(&doc).map(|dt| dt.schema_key().to_string()))
}

// ── Linting ─────────────────────────────────────────────────────

/// Lint a Formspec document (7-pass static analysis).
///
/// Args:
///     document: Python dict of the Formspec document
///     mode: Optional lint mode — "authoring", "strict", or "runtime" (default)
///     registry_documents: Optional list of registry document dicts for extension resolution
///     definition_document: Optional definition document dict for cross-artifact validation
///     schema_only: When true, run only schema-level validation (skip semantic passes)
///     no_fel: When true, skip FEL expression passes
///
/// Returns:
///     A dict with: document_type, valid, diagnostics (list of dicts)
#[pyfunction(signature = (document, mode=None, registry_documents=None, definition_document=None, schema_only=None, no_fel=None))]
pub fn lint_document(
    py: Python,
    document: &Bound<'_, PyAny>,
    mode: Option<&str>,
    registry_documents: Option<&Bound<'_, PyList>>,
    definition_document: Option<&Bound<'_, PyAny>>,
    schema_only: Option<bool>,
    no_fel: Option<bool>,
) -> PyResult<PyObject> {
    let doc: Value = depythonize_json(document)?;

    let lint_mode = LintMode::from_host_option_str(mode);

    let registry_docs: Vec<Value> = match registry_documents {
        Some(list) => {
            let mut docs = Vec::new();
            for item in list.iter() {
                docs.push(depythonize_json(&item)?);
            }
            docs
        }
        None => Vec::new(),
    };

    let def_doc: Option<Value> = match definition_document {
        Some(d) => Some(depythonize_json(d)?),
        None => None,
    };

    let options = LintOptions {
        mode: lint_mode,
        registry_documents: registry_docs,
        definition_document: def_doc,
        schema_only: schema_only.unwrap_or(false),
        no_fel: no_fel.unwrap_or(false),
    };

    let result = lint_with_options(&doc, &options);
    let json = lint_result_to_json_value(&result, JsonWireStyle::PythonSnake);
    json_to_python(py, &json)
}

// ── Evaluation ──────────────────────────────────────────────────

/// Evaluate a Formspec definition against provided data.
///
/// Args:
///     definition: Python dict of the definition
///     data: Python dict of field values
///     trigger: Optional shape timing mode ("continuous", "submit", "disabled")
///     registry_documents: Optional list of registry document dicts
///
/// Returns:
///     A dict with: values, validations, non_relevant, variables, required, readonly
#[pyfunction(signature = (definition, data, trigger=None, registry_documents=None, instances=None))]
pub fn evaluate_def(
    py: Python,
    definition: &Bound<'_, PyAny>,
    data: &Bound<'_, PyAny>,
    trigger: Option<&str>,
    registry_documents: Option<&Bound<'_, PyList>>,
    instances: Option<&Bound<'_, PyAny>>,
) -> PyResult<PyObject> {
    let definition: Value = depythonize_json(definition)?;
    let data_val: Value = depythonize_json(data)?;

    let data = json_object_to_string_map(&data_val);

    let eval_trigger =
        formspec_eval::EvalTrigger::from_python_eval_def_option(trigger);

    let constraints = match registry_documents {
        Some(docs) => {
            let mut raw = Vec::new();
            for item in docs.iter() {
                raw.push(depythonize_json(&item)?);
            }
            extension_constraints_from_registry_documents(&raw)
        }
        None => Vec::new(),
    };

    let instances_map: HashMap<String, Value> = match instances {
        Some(inst) => json_object_to_string_map(&depythonize_json(inst)?),
        None => HashMap::new(),
    };

    let result = evaluate_definition_full_with_instances(
        &definition,
        &data,
        eval_trigger,
        &constraints,
        &instances_map,
    );

    let json = evaluation_result_to_json_value_styled(&result, JsonWireStyle::PythonSnake);
    json_to_python(py, &json)
}

// ── Screener Evaluation ─────────────────────────────────────────

/// Evaluate screener routes and return the first matching route.
///
/// Args:
///     definition: Python dict of the definition (must contain a "screener" key)
///     answers: Python dict of screener answers
///
/// Returns:
///     A dict with: target, label, message — or None if no route matches.
#[pyfunction]
pub fn evaluate_screener_py(
    py: Python,
    definition: &Bound<'_, PyAny>,
    answers: &Bound<'_, PyAny>,
) -> PyResult<PyObject> {
    let def: Value = depythonize_json(definition)?;
    let ans_map = json_object_to_string_map(&depythonize_json(answers)?);

    let route = evaluate_screener(&def, &ans_map);
    let json = screener_route_to_json_value(route.as_ref());
    json_to_python(py, &json)
}
