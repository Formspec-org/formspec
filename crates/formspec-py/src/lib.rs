//! PyO3 bindings for Formspec — FEL, linting, definition evaluation, registry, changelog, and mapping to Python.

/// PyO3 bindings for Formspec — exposes FEL evaluation, linting, evaluation,
/// registry parsing, changelog generation, and mapping execution to Python.
///
/// This replaces the pure-Python FEL implementation (src/formspec/fel/)
/// with native Rust performance while maintaining the same API surface.
use pyo3::prelude::*;
use pyo3::types::{PyBool, PyDict, PyList};

type PyObject = Py<PyAny>;
use pythonize::depythonize;

use rust_decimal::Decimal;
use rust_decimal::prelude::*;
use serde_json::Value;
use std::collections::HashMap;

use fel_core::{
    BuiltinFunctionCatalogEntry, FelValue, FormspecEnvironment, MapEnvironment, MipState, evaluate,
    extract_dependencies, parse,
};
use formspec_core::changelog;
use formspec_core::extension_analysis::RegistryEntryStatus;
use formspec_core::registry_client::{self, Registry};
use formspec_core::runtime_mapping;
use formspec_core::{analyze_fel, detect_document_type, get_fel_dependencies};
use formspec_eval::{
    EvalTrigger, ExtensionConstraint, evaluate_definition_full, evaluate_screener,
};
use formspec_lint::{LintMode, LintOptions, lint_with_options};

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
fn eval_fel(
    py: Python,
    expression: &str,
    fields: Option<&Bound<'_, PyDict>>,
) -> PyResult<PyObject> {
    let expr =
        parse(expression).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

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
fn eval_fel_detailed(
    py: Python,
    expression: &str,
    fields: Option<&Bound<'_, PyDict>>,
    instances: Option<&Bound<'_, PyDict>>,
    mip_states: Option<&Bound<'_, PyDict>>,
    variables: Option<&Bound<'_, PyDict>>,
    now_iso: Option<&str>,
) -> PyResult<PyObject> {
    let expr =
        parse(expression).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let env = build_formspec_env(py, fields, instances, mip_states, variables, now_iso)?;
    let result = evaluate(&expr, &env);

    let diagnostics = PyList::empty(py);
    for diagnostic in &result.diagnostics {
        let entry = PyDict::new(py);
        entry.set_item("message", &diagnostic.message)?;
        entry.set_item("severity", severity_str(diagnostic.severity))?;
        diagnostics.append(entry)?;
    }

    let payload = PyDict::new(py);
    payload.set_item("value", fel_to_python_tagged(py, &result.value)?)?;
    payload.set_item("diagnostics", diagnostics)?;
    Ok(payload.into())
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
    let expr =
        parse(expression).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let deps = extract_dependencies(&expr);

    let dict = PyDict::new(py);
    dict.set_item("fields", deps.fields.iter().collect::<Vec<_>>())?;
    dict.set_item("context_refs", deps.context_refs.iter().collect::<Vec<_>>())?;
    dict.set_item(
        "instance_refs",
        deps.instance_refs.iter().collect::<Vec<_>>(),
    )?;
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
    dict.set_item(
        "errors",
        result
            .errors
            .iter()
            .map(|e| e.message.clone())
            .collect::<Vec<_>>(),
    )?;
    dict.set_item(
        "references",
        result.references.into_iter().collect::<Vec<_>>(),
    )?;
    dict.set_item(
        "variables",
        result.variables.into_iter().collect::<Vec<_>>(),
    )?;
    dict.set_item(
        "functions",
        result.functions.into_iter().collect::<Vec<_>>(),
    )?;

    Ok(dict.into())
}

/// Return builtin FEL function metadata for Python tooling surfaces.
#[pyfunction]
fn list_builtin_functions(py: Python) -> PyResult<PyObject> {
    let entries = PyList::empty(py);
    for entry in fel_core::builtin_function_catalog() {
        entries.append(builtin_function_to_dict(py, entry)?)?;
    }
    Ok(entries.into())
}

// ── Document Type Detection ─────────────────────────────────────

/// Detect the Formspec document type from a JSON string.
///
/// Returns the document type string or None.
#[pyfunction]
fn detect_type(document: &Bound<'_, PyAny>) -> PyResult<Option<String>> {
    let doc: Value = depythonize(document)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
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
fn lint_document(
    py: Python,
    document: &Bound<'_, PyAny>,
    mode: Option<&str>,
    registry_documents: Option<&Bound<'_, PyList>>,
    definition_document: Option<&Bound<'_, PyAny>>,
    schema_only: Option<bool>,
    no_fel: Option<bool>,
) -> PyResult<PyObject> {
    let doc: Value = depythonize(document)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let lint_mode = match mode {
        Some("authoring") => LintMode::Authoring,
        Some("strict") => LintMode::Strict,
        _ => LintMode::Runtime,
    };

    let registry_docs: Vec<Value> = match registry_documents {
        Some(list) => {
            let mut docs = Vec::new();
            for item in list.iter() {
                let val: Value = depythonize(&item)
                    .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
                docs.push(val);
            }
            docs
        }
        None => Vec::new(),
    };

    let def_doc: Option<Value> = match definition_document {
        Some(d) => {
            let val: Value = depythonize(d)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
            Some(val)
        }
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

    let diagnostics = PyList::empty(py);
    for d in &result.diagnostics {
        let diag = PyDict::new(py);
        diag.set_item("code", &d.code)?;
        diag.set_item("pass", d.pass)?;
        diag.set_item(
            "severity",
            match d.severity {
                formspec_lint::LintSeverity::Error => "error",
                formspec_lint::LintSeverity::Warning => "warning",
                formspec_lint::LintSeverity::Info => "info",
            },
        )?;
        diag.set_item("path", &d.path)?;
        diag.set_item("message", &d.message)?;
        diagnostics.append(diag)?;
    }

    let dict = PyDict::new(py);
    dict.set_item(
        "document_type",
        result.document_type.map(|dt| dt.schema_key().to_string()),
    )?;
    dict.set_item("valid", result.valid)?;
    dict.set_item("diagnostics", diagnostics)?;

    Ok(dict.into())
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
///     A dict with: values, validations, non_relevant, variables
#[pyfunction(signature = (definition, data, trigger=None, registry_documents=None))]
fn evaluate_def(
    py: Python,
    definition: &Bound<'_, PyAny>,
    data: &Bound<'_, PyAny>,
    trigger: Option<&str>,
    registry_documents: Option<&Bound<'_, PyList>>,
) -> PyResult<PyObject> {
    let definition: Value = depythonize(definition)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let data_val: Value =
        depythonize(data).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let data: HashMap<String, Value> = data_val
        .as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    let eval_trigger = match trigger {
        Some("submit") => EvalTrigger::Submit,
        Some("disabled") => EvalTrigger::Disabled,
        _ => EvalTrigger::Continuous,
    };

    // Extract extension constraints from registry documents
    let constraints = match registry_documents {
        Some(docs) => extract_extension_constraints(py, docs)?,
        None => Vec::new(),
    };

    let result = evaluate_definition_full(&definition, &data, eval_trigger, &constraints);

    let values = PyDict::new(py);
    for (k, v) in &result.values {
        values.set_item(k, json_to_python(py, v)?)?;
    }

    let validations = PyList::empty(py);
    for v in &result.validations {
        let entry = PyDict::new(py);
        entry.set_item("path", &v.path)?;
        entry.set_item("severity", &v.severity)?;
        entry.set_item("constraintKind", &v.constraint_kind)?;
        entry.set_item("code", &v.code)?;
        entry.set_item("message", &v.message)?;
        entry.set_item("source", &v.source)?;
        if let Some(ref sid) = v.shape_id {
            entry.set_item("shapeId", sid)?;
        }
        validations.append(entry)?;
    }

    let dict = PyDict::new(py);
    dict.set_item("values", values)?;
    dict.set_item("validations", validations)?;
    dict.set_item("non_relevant", &result.non_relevant)?;

    let variables = PyDict::new(py);
    for (k, v) in &result.variables {
        variables.set_item(k, json_to_python(py, v)?)?;
    }
    dict.set_item("variables", variables)?;

    Ok(dict.into())
}

/// Extract ExtensionConstraint structs from raw registry JSON documents.
fn extract_extension_constraints(
    _py: Python,
    docs: &Bound<'_, PyList>,
) -> PyResult<Vec<ExtensionConstraint>> {
    let mut constraints = Vec::new();

    for doc_any in docs.iter() {
        let doc_val: Value = depythonize(&doc_any)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

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

            // Extract constraint parameters
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

    Ok(constraints)
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
fn evaluate_screener_py(
    py: Python,
    definition: &Bound<'_, PyAny>,
    answers: &Bound<'_, PyAny>,
) -> PyResult<PyObject> {
    let def: Value = depythonize(definition)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let ans_val: Value =
        depythonize(answers).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let ans_map: HashMap<String, Value> = ans_val
        .as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    match evaluate_screener(&def, &ans_map) {
        Some(route) => {
            let dict = PyDict::new(py);
            dict.set_item("target", &route.target)?;
            dict.set_item("label", route.label.as_deref())?;
            dict.set_item("message", route.message.as_deref())?;
            Ok(dict.into())
        }
        None => Ok(py.None()),
    }
}

// ── Registry Client ──────────────────────────────────────────────

/// Parse a registry JSON document and return summary info.
///
/// Returns a dict with: publisher (dict), published (str), entry_count (int), validation_issues (list).
#[pyfunction]
fn parse_registry(py: Python, registry: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let val: Value = depythonize(registry)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let registry = Registry::from_json(&val)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let issues = registry.validate();

    let publisher = PyDict::new(py);
    publisher.set_item("name", &registry.publisher.name)?;
    publisher.set_item("url", &registry.publisher.url)?;
    publisher.set_item("contact", registry.publisher.contact.as_deref())?;

    let dict = PyDict::new(py);
    dict.set_item("publisher", publisher)?;
    dict.set_item("published", &registry.published)?;
    dict.set_item("entry_count", registry_entry_count(&val))?;
    dict.set_item("validation_issues", issues)?;

    Ok(dict.into())
}

/// Find a registry entry by name and optional version constraint.
///
/// Returns a Python dict of the entry or None.
#[pyfunction]
fn find_registry_entry(
    py: Python,
    registry: &Bound<'_, PyAny>,
    name: &str,
    version_constraint: &str,
) -> PyResult<PyObject> {
    let val: Value = depythonize(registry)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let registry = Registry::from_json(&val)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let constraint = if version_constraint.is_empty() {
        None
    } else {
        Some(version_constraint)
    };
    let entry = registry.find_one(name, constraint);

    match entry {
        None => Ok(py.None()),
        Some(e) => {
            let dict = PyDict::new(py);
            dict.set_item("name", &e.name)?;
            dict.set_item("category", category_str(e.category))?;
            dict.set_item("version", &e.version)?;
            dict.set_item("status", status_str(e.status))?;
            dict.set_item("description", &e.description)?;
            dict.set_item("deprecation_notice", e.deprecation_notice.as_deref())?;
            dict.set_item("base_type", e.base_type.as_deref())?;
            dict.set_item("returns", e.returns.as_deref())?;

            if let Some(ref params) = e.parameters {
                let param_list = PyList::empty(py);
                for p in params {
                    let pd = PyDict::new(py);
                    pd.set_item("name", &p.name)?;
                    pd.set_item("type", &p.param_type)?;
                    pd.set_item("description", p.description.as_deref())?;
                    param_list.append(pd)?;
                }
                dict.set_item("parameters", param_list)?;
            } else {
                dict.set_item("parameters", py.None())?;
            }

            Ok(dict.into())
        }
    }
}

/// Check whether a lifecycle status transition is valid.
#[pyfunction]
fn validate_lifecycle(from_status: &str, to_status: &str) -> PyResult<bool> {
    let from = parse_status_str(from_status).ok_or_else(|| {
        pyo3::exceptions::PyValueError::new_err(format!("unknown status: {from_status}"))
    })?;
    let to = parse_status_str(to_status).ok_or_else(|| {
        pyo3::exceptions::PyValueError::new_err(format!("unknown status: {to_status}"))
    })?;
    Ok(registry_client::validate_lifecycle_transition(from, to))
}

/// Construct the well-known registry URL for a base URL.
#[pyfunction]
fn well_known_url(base_url: &str) -> PyResult<String> {
    Ok(registry_client::well_known_url(base_url))
}

// ── Changelog ───────────────────────────────────────────────────

/// Diff two definition versions and produce a structured changelog.
///
/// Returns a dict with: definition_url, from_version, to_version, semver_impact, changes (list).
#[pyfunction]
fn generate_changelog(
    py: Python,
    old_def_obj: &Bound<'_, PyAny>,
    new_def_obj: &Bound<'_, PyAny>,
    definition_url: &str,
) -> PyResult<PyObject> {
    let old_def: Value = depythonize(old_def_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let new_def: Value = depythonize(new_def_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);

    let changes = PyList::empty(py);
    for c in &result.changes {
        let entry = PyDict::new(py);
        entry.set_item("change_type", change_type_str(&c.change_type))?;
        entry.set_item("target", change_target_str(&c.target))?;
        entry.set_item("path", &c.path)?;
        entry.set_item("impact", change_impact_str(c.impact))?;
        entry.set_item("key", c.key.as_deref())?;
        entry.set_item("description", c.description.as_deref())?;
        entry.set_item(
            "before",
            c.before
                .as_ref()
                .map(|v| json_to_python(py, v))
                .transpose()?,
        )?;
        entry.set_item(
            "after",
            c.after
                .as_ref()
                .map(|v| json_to_python(py, v))
                .transpose()?,
        )?;
        entry.set_item("migration_hint", c.migration_hint.as_deref())?;
        changes.append(entry)?;
    }

    let dict = PyDict::new(py);
    dict.set_item("definition_url", &result.definition_url)?;
    dict.set_item("from_version", &result.from_version)?;
    dict.set_item("to_version", &result.to_version)?;
    dict.set_item("semver_impact", semver_impact_str(result.semver_impact))?;
    dict.set_item("changes", changes)?;

    Ok(dict.into())
}

// ── Mapping ─────────────────────────────────────────────────────

/// Execute a mapping document against source data.
///
/// Args:
///     doc_json: JSON string of the mapping document (with rules, defaults, autoMap)
///     source_json: JSON string of the source data
///     direction: "forward" or "reverse"
///
/// Returns a dict with: direction, output (dict), rules_applied (int), diagnostics (list).
#[pyfunction]
fn execute_mapping_doc(
    py: Python,
    doc_obj: &Bound<'_, PyAny>,
    source_obj: &Bound<'_, PyAny>,
    direction: &str,
) -> PyResult<PyObject> {
    let doc_val: Value =
        depythonize(doc_obj).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let source: Value = depythonize(source_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let dir = parse_direction(direction)?;

    let mapping_doc = parse_mapping_document(&doc_val)?;
    let result = runtime_mapping::execute_mapping_doc(&mapping_doc, &source, dir);

    let diagnostics = PyList::empty(py);
    for d in &result.diagnostics {
        let diag = PyDict::new(py);
        diag.set_item("rule_index", d.rule_index)?;
        diag.set_item("source_path", d.source_path.as_deref())?;
        diag.set_item("target_path", &d.target_path)?;
        diag.set_item("message", &d.message)?;
        diagnostics.append(diag)?;
    }

    let dict = PyDict::new(py);
    dict.set_item("direction", direction)?;
    dict.set_item("output", json_to_python(py, &result.output)?)?;
    dict.set_item("rules_applied", result.rules_applied)?;
    dict.set_item("diagnostics", diagnostics)?;

    Ok(dict.into())
}

// ── Python module ───────────────────────────────────────────────

/// formspec_rust — Native Rust implementation of Formspec processing.
#[pymodule]
fn formspec_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(eval_fel, m)?)?;
    m.add_function(wrap_pyfunction!(eval_fel_detailed, m)?)?;
    m.add_function(wrap_pyfunction!(parse_fel, m)?)?;
    m.add_function(wrap_pyfunction!(get_dependencies, m)?)?;
    m.add_function(wrap_pyfunction!(extract_deps, m)?)?;
    m.add_function(wrap_pyfunction!(analyze_expression, m)?)?;
    m.add_function(wrap_pyfunction!(list_builtin_functions, m)?)?;
    m.add_function(wrap_pyfunction!(detect_type, m)?)?;
    m.add_function(wrap_pyfunction!(lint_document, m)?)?;
    m.add_function(wrap_pyfunction!(evaluate_def, m)?)?;
    m.add_function(wrap_pyfunction!(evaluate_screener_py, m)?)?;
    // Registry
    m.add_function(wrap_pyfunction!(parse_registry, m)?)?;
    m.add_function(wrap_pyfunction!(find_registry_entry, m)?)?;
    m.add_function(wrap_pyfunction!(validate_lifecycle, m)?)?;
    m.add_function(wrap_pyfunction!(well_known_url, m)?)?;
    // Changelog
    m.add_function(wrap_pyfunction!(generate_changelog, m)?)?;
    // Mapping
    m.add_function(wrap_pyfunction!(execute_mapping_doc, m)?)?;
    Ok(())
}

// ── Type conversion helpers ─────────────────────────────────────

fn pydict_to_field_map(
    py: Python,
    dict: &Bound<'_, PyDict>,
) -> PyResult<HashMap<String, FelValue>> {
    let mut map = HashMap::new();
    for (key, value) in dict.iter() {
        let k: String = key.extract()?;
        let v = python_to_fel(py, &value)?;
        map.insert(k, v);
    }
    Ok(map)
}

fn build_formspec_env(
    py: Python,
    fields: Option<&Bound<'_, PyDict>>,
    instances: Option<&Bound<'_, PyDict>>,
    mip_states: Option<&Bound<'_, PyDict>>,
    variables: Option<&Bound<'_, PyDict>>,
    now_iso: Option<&str>,
) -> PyResult<FormspecEnvironment> {
    let mut env = FormspecEnvironment::new();

    if let Some(dict) = fields {
        for (key, value) in dict.iter() {
            let k: String = key.extract()?;
            env.set_field(&k, python_to_fel(py, &value)?);
        }
    }

    if let Some(dict) = instances {
        for (key, value) in dict.iter() {
            let k: String = key.extract()?;
            env.set_instance(&k, python_to_fel(py, &value)?);
        }
    }

    if let Some(dict) = mip_states {
        for (key, value) in dict.iter() {
            let k: String = key.extract()?;
            env.set_mip(&k, pyany_to_mip_state(&value)?);
        }
    }

    if let Some(dict) = variables {
        for (key, value) in dict.iter() {
            let k: String = key.extract()?;
            env.set_variable(&k, python_to_fel(py, &value)?);
        }
    }

    if let Some(now) = now_iso {
        env.set_now_from_iso(now);
    }

    Ok(env)
}

fn pyany_to_mip_state(obj: &Bound<'_, PyAny>) -> PyResult<MipState> {
    if let Ok(dict) = obj.cast::<PyDict>() {
        return Ok(MipState {
            valid: dict
                .get_item("valid")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(true),
            relevant: dict
                .get_item("relevant")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(true),
            readonly: dict
                .get_item("readonly")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(false),
            required: dict
                .get_item("required")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(false),
        });
    }

    Ok(MipState::default())
}

#[allow(clippy::only_used_in_recursion)]
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
        return Ok(match Decimal::from_f64(f) {
            Some(d) => FelValue::Number(d),
            None => FelValue::Null, // NaN, Infinity → Null, not zero
        });
    }
    if let Ok(s) = obj.extract::<String>() {
        return Ok(FelValue::String(s));
    }
    if let Ok(list) = obj.cast::<PyList>() {
        let mut arr = Vec::new();
        for item in list.iter() {
            arr.push(python_to_fel(py, &item)?);
        }
        return Ok(FelValue::Array(arr));
    }
    if let Ok(dict) = obj.cast::<PyDict>() {
        let tagged_type = dict
            .get_item("__fel_type__")?
            .and_then(|value| value.extract::<String>().ok());
        if let Some(tagged_type) = tagged_type.as_deref() {
            match tagged_type {
                "number" => {
                    if let Some(raw) = dict.get_item("value")?
                        && let Ok(text) = raw.extract::<String>()
                    {
                        return Ok(match Decimal::from_str_exact(&text) {
                            Ok(d) => FelValue::Number(d),
                            Err(_) => FelValue::Null,
                        });
                    }
                }
                "date" | "datetime" => {
                    if let Some(raw) = dict.get_item("value")?
                        && let Ok(text) = raw.extract::<String>()
                    {
                        if let Some(date) = fel_core::parse_datetime_literal(&format!("@{text}")) {
                            return Ok(FelValue::Date(date));
                        }
                        if let Some(date) = fel_core::parse_date_literal(&format!("@{text}")) {
                            return Ok(FelValue::Date(date));
                        }
                    }
                }
                "money" => {
                    let amount_str = dict
                        .get_item("amount")?
                        .and_then(|value| value.extract::<String>().ok())
                        .unwrap_or_else(|| "0".to_string());
                    let currency = dict
                        .get_item("currency")?
                        .and_then(|value| value.extract::<String>().ok())
                        .unwrap_or_default();
                    return Ok(match Decimal::from_str_exact(&amount_str) {
                        Ok(d) => FelValue::Money(fel_core::FelMoney {
                            amount: d,
                            currency,
                        }),
                        Err(_) => FelValue::Null,
                    });
                }
                _ => {}
            }
        }

        let currency = dict
            .get_item("currency")?
            .and_then(|value| value.extract::<String>().ok());
        if let Some(currency) = currency
            && let Some(amount_obj) = dict.get_item("amount")?
        {
            // Try numeric extraction first (int → Decimal, float → Decimal)
            let maybe_decimal = if let Ok(i) = amount_obj.extract::<i64>() {
                Some(Decimal::from(i))
            } else if let Ok(f) = amount_obj.extract::<f64>() {
                Decimal::from_f64(f)
            } else if let Ok(s) = amount_obj.extract::<String>() {
                Decimal::from_str_exact(&s).ok()
            } else {
                None
            };
            if let Some(amount) = maybe_decimal {
                return Ok(FelValue::Money(fel_core::FelMoney { amount, currency }));
            }
        }

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
            if n.fract().is_zero()
                && let Some(i) = n.to_i64()
            {
                return Ok(i.into_pyobject(py)?.into_any().unbind());
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

fn fel_to_python_tagged(py: Python, val: &FelValue) -> PyResult<PyObject> {
    match val {
        FelValue::Null => Ok(py.None()),
        FelValue::Boolean(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        FelValue::Number(n) => {
            let dict = PyDict::new(py);
            dict.set_item("__fel_type__", "number")?;
            dict.set_item("value", n.to_string())?;
            Ok(dict.into())
        }
        FelValue::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        FelValue::Date(d) => {
            let dict = PyDict::new(py);
            dict.set_item(
                "__fel_type__",
                match d {
                    fel_core::FelDate::Date { .. } => "date",
                    fel_core::FelDate::DateTime { .. } => "datetime",
                },
            )?;
            dict.set_item("value", d.format_iso())?;
            Ok(dict.into())
        }
        FelValue::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(fel_to_python_tagged(py, item)?)?;
            }
            Ok(list.into())
        }
        FelValue::Object(entries) => {
            let dict = PyDict::new(py);
            for (k, v) in entries {
                dict.set_item(k, fel_to_python_tagged(py, v)?)?;
            }
            Ok(dict.into())
        }
        FelValue::Money(m) => {
            let dict = PyDict::new(py);
            dict.set_item("__fel_type__", "money")?;
            dict.set_item("amount", m.amount.to_string())?;
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

// ── Registry helpers ────────────────────────────────────────────

fn registry_entry_count(val: &Value) -> usize {
    val.get("entries")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0)
}

fn parse_status_str(s: &str) -> Option<RegistryEntryStatus> {
    match s {
        "draft" => Some(RegistryEntryStatus::Draft),
        "stable" | "active" => Some(RegistryEntryStatus::Active),
        "deprecated" => Some(RegistryEntryStatus::Deprecated),
        "retired" => Some(RegistryEntryStatus::Retired),
        _ => None,
    }
}

fn status_str(s: RegistryEntryStatus) -> &'static str {
    match s {
        RegistryEntryStatus::Draft => "draft",
        RegistryEntryStatus::Active => "stable",
        RegistryEntryStatus::Deprecated => "deprecated",
        RegistryEntryStatus::Retired => "retired",
    }
}

fn category_str(c: registry_client::ExtensionCategory) -> &'static str {
    match c {
        registry_client::ExtensionCategory::DataType => "dataType",
        registry_client::ExtensionCategory::Function => "function",
        registry_client::ExtensionCategory::Constraint => "constraint",
        registry_client::ExtensionCategory::Property => "property",
        registry_client::ExtensionCategory::Namespace => "namespace",
    }
}

fn severity_str(severity: fel_core::Severity) -> &'static str {
    match severity {
        fel_core::Severity::Error => "error",
        fel_core::Severity::Warning => "warning",
        fel_core::Severity::Info => "info",
    }
}

fn builtin_function_to_dict(py: Python, entry: &BuiltinFunctionCatalogEntry) -> PyResult<PyObject> {
    let dict = PyDict::new(py);
    dict.set_item("name", entry.name)?;
    dict.set_item("category", entry.category)?;
    dict.set_item("signature", entry.signature)?;
    dict.set_item("description", entry.description)?;
    Ok(dict.into())
}

// ── Changelog helpers ───────────────────────────────────────────

fn change_type_str(ct: &changelog::ChangeType) -> &'static str {
    match ct {
        changelog::ChangeType::Added => "added",
        changelog::ChangeType::Removed => "removed",
        changelog::ChangeType::Modified => "modified",
    }
}

fn change_target_str(t: &changelog::ChangeTarget) -> &'static str {
    match t {
        changelog::ChangeTarget::Item => "item",
        changelog::ChangeTarget::Bind => "bind",
        changelog::ChangeTarget::Shape => "shape",
        changelog::ChangeTarget::OptionSet => "optionSet",
        changelog::ChangeTarget::DataSource => "dataSource",
        changelog::ChangeTarget::Screener => "screener",
        changelog::ChangeTarget::Migration => "migration",
        changelog::ChangeTarget::Metadata => "metadata",
    }
}

fn change_impact_str(i: changelog::ChangeImpact) -> &'static str {
    match i {
        changelog::ChangeImpact::Cosmetic => "cosmetic",
        changelog::ChangeImpact::Compatible => "compatible",
        changelog::ChangeImpact::Breaking => "breaking",
    }
}

fn semver_impact_str(i: changelog::SemverImpact) -> &'static str {
    match i {
        changelog::SemverImpact::Patch => "patch",
        changelog::SemverImpact::Minor => "minor",
        changelog::SemverImpact::Major => "major",
    }
}

// ── Mapping helpers ─────────────────────────────────────────────

fn parse_direction(s: &str) -> PyResult<runtime_mapping::MappingDirection> {
    match s {
        "forward" => Ok(runtime_mapping::MappingDirection::Forward),
        "reverse" => Ok(runtime_mapping::MappingDirection::Reverse),
        _ => Err(pyo3::exceptions::PyValueError::new_err(format!(
            "invalid direction: {s}, expected 'forward' or 'reverse'"
        ))),
    }
}

fn parse_mapping_document(val: &Value) -> PyResult<runtime_mapping::MappingDocument> {
    parse_mapping_document_inner(val).map_err(pyo3::exceptions::PyValueError::new_err)
}

// ── Testable inner functions (no PyO3 dependency) ───────────────

/// Parse a coerce type from a JSON value.
///
/// Accepts both string shorthand (`"number"`) and object form (`{"from": "string", "to": "number"}`).
/// Returns `None` for unknown type strings, non-string/non-object inputs, or object form missing `"to"`.
///
/// Note: The object form `"from"` field is accepted but ignored — coercion target is all that matters
/// for the runtime. The `from` field is informational for documentation/validation purposes only.
fn parse_coerce_type(val: &Value) -> Option<runtime_mapping::CoerceType> {
    match val {
        Value::String(s) => coerce_type_from_str(s),
        Value::Object(obj) => obj
            .get("to")
            .and_then(|v| v.as_str())
            .and_then(coerce_type_from_str),
        _ => None,
    }
}

/// Map a coerce type name string to the enum variant.
fn coerce_type_from_str(s: &str) -> Option<runtime_mapping::CoerceType> {
    match s {
        "string" => Some(runtime_mapping::CoerceType::String),
        "number" => Some(runtime_mapping::CoerceType::Number),
        "integer" => Some(runtime_mapping::CoerceType::Integer),
        "boolean" => Some(runtime_mapping::CoerceType::Boolean),
        "date" => Some(runtime_mapping::CoerceType::Date),
        "datetime" => Some(runtime_mapping::CoerceType::DateTime),
        "array" => Some(runtime_mapping::CoerceType::Array),
        _ => None,
    }
}

/// Parse a mapping document from a JSON value. Returns `Err(String)` on failure.
fn parse_mapping_document_inner(val: &Value) -> Result<runtime_mapping::MappingDocument, String> {
    let obj = val
        .as_object()
        .ok_or_else(|| "mapping doc must be an object".to_string())?;

    let rules_val = obj
        .get("rules")
        .ok_or_else(|| "mapping doc missing 'rules'".to_string())?;
    let rules = parse_mapping_rules_inner(rules_val)?;

    let defaults = obj.get("defaults").and_then(|v| v.as_object()).cloned();

    let auto_map = obj
        .get("autoMap")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(runtime_mapping::MappingDocument {
        rules,
        defaults,
        auto_map,
    })
}

#[allow(dead_code)]
fn parse_mapping_rules(val: &Value) -> PyResult<Vec<runtime_mapping::MappingRule>> {
    parse_mapping_rules_inner(val).map_err(pyo3::exceptions::PyValueError::new_err)
}

/// Parse an array descriptor from a rule object.
fn parse_array_descriptor(
    obj: &serde_json::Map<String, Value>,
    rule_idx: usize,
) -> Result<Option<runtime_mapping::ArrayDescriptor>, String> {
    let arr_val = match obj.get("array") {
        Some(v) => v,
        None => return Ok(None),
    };
    let arr_obj = arr_val
        .as_object()
        .ok_or_else(|| format!("rule[{rule_idx}]: 'array' must be an object"))?;

    let mode = match arr_obj.get("mode").and_then(|v| v.as_str()) {
        Some("each") => runtime_mapping::ArrayMode::Each,
        Some("indexed") => runtime_mapping::ArrayMode::Indexed,
        Some("whole") | None => runtime_mapping::ArrayMode::Whole,
        Some(other) => {
            return Err(format!(
                "rule[{rule_idx}]: unknown array mode: {other}"
            ))
        }
    };

    let inner_rules = if let Some(inner_val) = arr_obj.get("innerRules") {
        parse_inner_rules(inner_val, rule_idx, mode)?
    } else {
        vec![]
    };

    Ok(Some(runtime_mapping::ArrayDescriptor { mode, inner_rules }))
}

/// Parse innerRules for array descriptors — reuses the main rule parser,
/// then patches indexed-mode rules to use `index` as sourcePath.
fn parse_inner_rules(
    val: &Value,
    _parent_idx: usize,
    mode: runtime_mapping::ArrayMode,
) -> Result<Vec<runtime_mapping::MappingRule>, String> {
    let mut rules = parse_mapping_rules_inner(val)?;
    if mode == runtime_mapping::ArrayMode::Indexed {
        let empty = vec![];
        let arr = val.as_array().unwrap_or(&empty);
        for (i, rule) in rules.iter_mut().enumerate() {
            if let Some(idx) = arr.get(i)
                .and_then(|v| v.as_object())
                .and_then(|obj| obj.get("index"))
                .and_then(|v| v.as_u64())
            {
                // Combine index with existing sourcePath: "0.phaseName"
                rule.source_path = match &rule.source_path {
                    Some(sp) if !sp.is_empty() => Some(format!("{idx}.{sp}")),
                    _ => Some(idx.to_string()),
                };
            }
        }
    }
    Ok(rules)
}

/// Parse a reverse-direction transform override from a rule object.
fn parse_reverse_override(
    obj: &serde_json::Map<String, Value>,
    rule_idx: usize,
) -> Result<Option<Box<runtime_mapping::ReverseOverride>>, String> {
    let rev_val = match obj.get("reverse") {
        Some(v) => v,
        None => return Ok(None),
    };
    let rev_obj = rev_val
        .as_object()
        .ok_or_else(|| format!("rule[{rule_idx}]: 'reverse' must be an object"))?;

    let transform_str = rev_obj
        .get("transform")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("rule[{rule_idx}]: reverse override requires 'transform'"))?;

    let transform = match transform_str {
        "expression" => {
            let expr = rev_obj
                .get("expression")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    format!("rule[{rule_idx}]: reverse 'expression' transform requires 'expression'")
                })?;
            runtime_mapping::TransformType::Expression(expr.to_string())
        }
        "preserve" => runtime_mapping::TransformType::Preserve,
        "constant" => {
            let expr = rev_obj
                .get("expression")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    format!("rule[{rule_idx}]: reverse 'constant' transform requires 'expression'")
                })?;
            runtime_mapping::TransformType::Expression(expr.to_string())
        }
        "valueMap" => {
            let vm = rev_obj.get("valueMap").and_then(|v| v.as_object());
            let (forward, unmapped_strategy) = if let Some(m) = vm {
                if let Some(fwd_val) = m.get("forward") {
                    let fwd: Vec<(Value, Value)> = fwd_val
                        .as_object()
                        .map(|fwd_map| {
                            fwd_map.iter()
                                .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                                .collect()
                        })
                        .unwrap_or_default();
                    let strategy = match m.get("unmapped").and_then(|v| v.as_str()) {
                        Some("error") => runtime_mapping::UnmappedStrategy::Error,
                        Some("drop") => runtime_mapping::UnmappedStrategy::Drop,
                        Some("default") => runtime_mapping::UnmappedStrategy::Default,
                        _ => runtime_mapping::UnmappedStrategy::PassThrough,
                    };
                    (fwd, strategy)
                } else {
                    let fwd: Vec<(Value, Value)> = m.iter()
                        .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                        .collect();
                    (fwd, runtime_mapping::UnmappedStrategy::PassThrough)
                }
            } else {
                (vec![], runtime_mapping::UnmappedStrategy::PassThrough)
            };
            runtime_mapping::TransformType::ValueMap { forward, unmapped: unmapped_strategy }
        }
        "coerce" => {
            let coerce_val = rev_obj.get("coerce").ok_or_else(|| {
                format!("rule[{rule_idx}]: reverse 'coerce' requires 'coerce' property")
            })?;
            let coerce_type = parse_coerce_type(coerce_val)
                .ok_or_else(|| format!("rule[{rule_idx}]: invalid reverse coerce value"))?;
            runtime_mapping::TransformType::Coerce(coerce_type)
        }
        "concat" => {
            let expr = rev_obj
                .get("expression")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("rule[{rule_idx}]: reverse 'concat' requires 'expression'"))?;
            runtime_mapping::TransformType::Concat(expr.to_string())
        }
        "split" => {
            let expr = rev_obj
                .get("expression")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("rule[{rule_idx}]: reverse 'split' requires 'expression'"))?;
            runtime_mapping::TransformType::Split(expr.to_string())
        }
        "flatten" => runtime_mapping::TransformType::Flatten {
            separator: rev_obj
                .get("separator")
                .and_then(|v| v.as_str())
                .unwrap_or(".")
                .to_string(),
        },
        "nest" => runtime_mapping::TransformType::Nest {
            separator: rev_obj
                .get("separator")
                .and_then(|v| v.as_str())
                .unwrap_or(".")
                .to_string(),
        },
        "drop" => runtime_mapping::TransformType::Drop,
        other => {
            return Err(format!(
                "rule[{rule_idx}]: unsupported reverse transform: {other}"
            ))
        }
    };

    Ok(Some(Box::new(runtime_mapping::ReverseOverride { transform })))
}

/// Core mapping-rule parser returning `Result<_, String>` for testability without FFI.
fn parse_mapping_rules_inner(val: &Value) -> Result<Vec<runtime_mapping::MappingRule>, String> {
    let arr = val
        .as_array()
        .ok_or_else(|| "rules must be an array".to_string())?;

    let mut rules = Vec::new();
    for (i, rule_val) in arr.iter().enumerate() {
        let obj = rule_val
            .as_object()
            .ok_or_else(|| format!("rule[{i}]: must be an object"))?;

        // transform is REQUIRED (mapping.schema.json FieldRule.required)
        let transform_str = obj
            .get("transform")
            .and_then(|v| v.as_str())
            .ok_or_else(|| format!("rule[{i}]: missing required field 'transform'"))?;

        // Extra default from full-form valueMap (populated in the valueMap arm)
        let mut vm_default: Option<Value> = None;

        let transform = match transform_str {
            "preserve" => runtime_mapping::TransformType::Preserve,
            "drop" => runtime_mapping::TransformType::Drop,
            "constant" => {
                let expr = obj
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        format!("rule[{i}]: transform 'constant' requires 'expression'")
                    })?;
                // Evaluate the expression at runtime via Expression transform,
                // since Constant(Value) returns the value literally.
                runtime_mapping::TransformType::Expression(expr.to_string())
            }
            "coerce" => {
                let coerce_val = obj.get("coerce").ok_or_else(|| {
                    format!("rule[{i}]: transform 'coerce' requires 'coerce' property")
                })?;
                let coerce_type = parse_coerce_type(coerce_val)
                    .ok_or_else(|| format!("rule[{i}]: invalid coerce value"))?;
                runtime_mapping::TransformType::Coerce(coerce_type)
            }
            "expression" => {
                let expr = obj
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        format!("rule[{i}]: transform 'expression' requires 'expression'")
                    })?;
                runtime_mapping::TransformType::Expression(expr.to_string())
            }
            "valueMap" => {
                let vm = obj.get("valueMap").and_then(|v| v.as_object());
                // Detect full-form valueMap (has a "forward" key) vs shorthand (flat map)
                let (forward, unmapped_strategy) = if let Some(m) = vm {
                    if let Some(fwd_val) = m.get("forward") {
                        // Full-form: { "forward": {...}, "unmapped": "...", "default": "..." }
                        let fwd: Vec<(Value, Value)> = fwd_val
                            .as_object()
                            .map(|fwd_map| {
                                fwd_map
                                    .iter()
                                    .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                                    .collect()
                            })
                            .unwrap_or_default();
                        let strategy = match m.get("unmapped").and_then(|v| v.as_str()) {
                            Some("error") => runtime_mapping::UnmappedStrategy::Error,
                            Some("drop") => runtime_mapping::UnmappedStrategy::Drop,
                            Some("default") => runtime_mapping::UnmappedStrategy::Default,
                            Some("passthrough") => runtime_mapping::UnmappedStrategy::PassThrough,
                            _ => runtime_mapping::UnmappedStrategy::PassThrough,
                        };
                        (fwd, strategy)
                    } else {
                        // Shorthand: flat key-value map
                        let fwd: Vec<(Value, Value)> = m
                            .iter()
                            .map(|(k, v)| (Value::String(k.clone()), v.clone()))
                            .collect();
                        (fwd, runtime_mapping::UnmappedStrategy::PassThrough)
                    }
                } else {
                    (vec![], runtime_mapping::UnmappedStrategy::PassThrough)
                };
                // Full-form may have a default value for unmapped strategy
                vm_default = vm
                    .and_then(|m| m.get("default"))
                    .cloned();
                runtime_mapping::TransformType::ValueMap {
                    forward,
                    unmapped: unmapped_strategy,
                }
            }
            "flatten" => runtime_mapping::TransformType::Flatten {
                separator: obj
                    .get("separator")
                    .and_then(|v| v.as_str())
                    .unwrap_or(".")
                    .to_string(),
            },
            "nest" => runtime_mapping::TransformType::Nest {
                separator: obj
                    .get("separator")
                    .and_then(|v| v.as_str())
                    .unwrap_or(".")
                    .to_string(),
            },
            "concat" => {
                let expr = obj
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        format!("rule[{i}]: transform 'concat' requires 'expression'")
                    })?;
                runtime_mapping::TransformType::Concat(expr.to_string())
            }
            "split" => {
                let expr = obj
                    .get("expression")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| format!("rule[{i}]: transform 'split' requires 'expression'"))?;
                runtime_mapping::TransformType::Split(expr.to_string())
            }
            other => return Err(format!("rule[{i}]: unknown transform type: {other}")),
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
                "rule[{i}]: at least one of 'sourcePath' or 'targetPath' must be present"
            ));
        }

        rules.push(runtime_mapping::MappingRule {
            source_path,
            target_path: target_path.unwrap_or_default(),
            transform,
            condition: obj
                .get("condition")
                .and_then(|v| v.as_str())
                .map(String::from),
            priority: obj
                .get("priority")
                .and_then(|v| v.as_i64())
                .and_then(|n| i32::try_from(n).ok())
                .unwrap_or(0),
            reverse_priority: obj
                .get("reversePriority")
                .and_then(|v| v.as_i64())
                .map(|n| n as i32),
            default: obj.get("default").cloned().or(vm_default),
            bidirectional: obj
                .get("bidirectional")
                .and_then(|v| v.as_bool())
                .unwrap_or(true),
            array: parse_array_descriptor(obj, i)?,
            reverse: parse_reverse_override(obj, i)?,
        });
    }
    Ok(rules)
}

// ── Tests ───────────────────────────────────────────────────────
//
// NOTE: PyO3 #[pyfunction] wrappers and type conversion helpers
// require a live Python interpreter. Test via Python-side integration tests.
// Run with: cargo test -p formspec-py --no-default-features

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── parse_status_str ────────────────────────────────────────

    /// Spec: extension-registry.llm.md line 25 — lifecycle states: draft, stable, deprecated, retired
    /// "draft" maps to Draft variant.
    #[test]
    fn parse_status_str_draft() {
        assert_eq!(parse_status_str("draft"), Some(RegistryEntryStatus::Draft));
    }

    /// Spec: extension-registry.llm.md line 25 — "stable" is the canonical wire name for Active
    #[test]
    fn parse_status_str_stable() {
        assert_eq!(
            parse_status_str("stable"),
            Some(RegistryEntryStatus::Active)
        );
    }

    /// Spec: "active" is accepted as an alias for the Active/stable status.
    /// This is a binding-layer convenience — the spec uses "stable" but
    /// internal Rust enums use Active. Both wire names must resolve.
    #[test]
    fn parse_status_str_active_alias() {
        assert_eq!(
            parse_status_str("active"),
            Some(RegistryEntryStatus::Active)
        );
    }

    /// Spec: extension-registry.llm.md line 25 — "deprecated" maps to Deprecated
    #[test]
    fn parse_status_str_deprecated() {
        assert_eq!(
            parse_status_str("deprecated"),
            Some(RegistryEntryStatus::Deprecated)
        );
    }

    /// Spec: extension-registry.llm.md line 25 — "retired" maps to Retired
    #[test]
    fn parse_status_str_retired() {
        assert_eq!(
            parse_status_str("retired"),
            Some(RegistryEntryStatus::Retired)
        );
    }

    /// Boundary: unknown status strings must return None (not panic).
    #[test]
    fn parse_status_str_unknown_returns_none() {
        assert_eq!(parse_status_str("experimental"), None);
        assert_eq!(parse_status_str(""), None);
        assert_eq!(parse_status_str("Draft"), None); // case-sensitive
        assert_eq!(parse_status_str("STABLE"), None);
    }

    // ── status_str (reverse of parse_status_str) ────────────────

    /// Spec: extension-registry.llm.md line 25 — Draft emits "draft"
    #[test]
    fn status_str_draft() {
        assert_eq!(status_str(RegistryEntryStatus::Draft), "draft");
    }

    /// Spec: Active emits "stable" (NOT "active") — this is the canonical wire name.
    /// Asymmetry: parse_status_str("active") → Active, but status_str(Active) → "stable".
    #[test]
    fn status_str_active_emits_stable() {
        assert_eq!(status_str(RegistryEntryStatus::Active), "stable");
    }

    /// Spec: Deprecated emits "deprecated"
    #[test]
    fn status_str_deprecated() {
        assert_eq!(status_str(RegistryEntryStatus::Deprecated), "deprecated");
    }

    /// Spec: Retired emits "retired"
    #[test]
    fn status_str_retired() {
        assert_eq!(status_str(RegistryEntryStatus::Retired), "retired");
    }

    /// Correctness: round-trip parse→emit for all canonical wire names.
    /// Documents the "active"→"stable" asymmetry: parse("active") → Active → "stable".
    #[test]
    fn status_roundtrip_canonical_names() {
        for name in &["draft", "stable", "deprecated", "retired"] {
            let parsed = parse_status_str(name).expect(name);
            assert_eq!(status_str(parsed), *name, "round-trip failed for {name}");
        }
    }

    /// Correctness: the "active" alias does NOT round-trip — it normalizes to "stable".
    #[test]
    fn status_active_alias_normalizes_to_stable() {
        let parsed = parse_status_str("active").unwrap();
        assert_eq!(status_str(parsed), "stable");
    }

    // ── category_str ────────────────────────────────────────────

    /// Spec: extension-registry.llm.md — registry entry categories
    #[test]
    fn category_str_all_variants() {
        assert_eq!(
            category_str(registry_client::ExtensionCategory::DataType),
            "dataType"
        );
        assert_eq!(
            category_str(registry_client::ExtensionCategory::Function),
            "function"
        );
        assert_eq!(
            category_str(registry_client::ExtensionCategory::Constraint),
            "constraint"
        );
        assert_eq!(
            category_str(registry_client::ExtensionCategory::Property),
            "property"
        );
        assert_eq!(
            category_str(registry_client::ExtensionCategory::Namespace),
            "namespace"
        );
    }

    // ── change_type_str ─────────────────────────────────────────

    /// Spec: changelog-spec — change types: added, removed, modified
    #[test]
    fn change_type_str_all_variants() {
        assert_eq!(change_type_str(&changelog::ChangeType::Added), "added");
        assert_eq!(change_type_str(&changelog::ChangeType::Removed), "removed");
        assert_eq!(
            change_type_str(&changelog::ChangeType::Modified),
            "modified"
        );
    }

    // ── change_target_str ───────────────────────────────────────

    /// Spec: changelog-spec — change targets cover all definition subsystems
    #[test]
    fn change_target_str_all_variants() {
        assert_eq!(change_target_str(&changelog::ChangeTarget::Item), "item");
        assert_eq!(change_target_str(&changelog::ChangeTarget::Bind), "bind");
        assert_eq!(change_target_str(&changelog::ChangeTarget::Shape), "shape");
        assert_eq!(
            change_target_str(&changelog::ChangeTarget::OptionSet),
            "optionSet"
        );
        assert_eq!(
            change_target_str(&changelog::ChangeTarget::DataSource),
            "dataSource"
        );
        assert_eq!(
            change_target_str(&changelog::ChangeTarget::Screener),
            "screener"
        );
        assert_eq!(
            change_target_str(&changelog::ChangeTarget::Migration),
            "migration"
        );
        assert_eq!(
            change_target_str(&changelog::ChangeTarget::Metadata),
            "metadata"
        );
    }

    // ── change_impact_str ───────────────────────────────────────

    /// Spec: changelog-spec — impact levels for semver classification
    #[test]
    fn change_impact_str_all_variants() {
        assert_eq!(
            change_impact_str(changelog::ChangeImpact::Cosmetic),
            "cosmetic"
        );
        assert_eq!(
            change_impact_str(changelog::ChangeImpact::Compatible),
            "compatible"
        );
        assert_eq!(
            change_impact_str(changelog::ChangeImpact::Breaking),
            "breaking"
        );
    }

    // ── semver_impact_str ───────────────────────────────────────

    /// Spec: changelog-spec — semver bump classification
    #[test]
    fn semver_impact_str_all_variants() {
        assert_eq!(semver_impact_str(changelog::SemverImpact::Patch), "patch");
        assert_eq!(semver_impact_str(changelog::SemverImpact::Minor), "minor");
        assert_eq!(semver_impact_str(changelog::SemverImpact::Major), "major");
    }

    // ── parse_direction ─────────────────────────────────────────

    /// Spec: mapping-spec.md §2 — forward mapping: Response → External
    #[test]
    fn parse_direction_forward() {
        let dir = parse_direction("forward").unwrap();
        assert!(matches!(dir, runtime_mapping::MappingDirection::Forward));
    }

    /// Spec: mapping-spec.md §2 — reverse mapping: External → Response
    #[test]
    fn parse_direction_reverse() {
        let dir = parse_direction("reverse").unwrap();
        assert!(matches!(dir, runtime_mapping::MappingDirection::Reverse));
    }

    /// Boundary: invalid direction strings must produce PyValueError
    #[test]
    fn parse_direction_invalid_returns_err() {
        assert!(parse_direction("").is_err());
        assert!(parse_direction("both").is_err());
        assert!(parse_direction("Forward").is_err()); // case-sensitive
    }

    /// Correctness: invalid direction returns Err (message inspection requires Python GIL)
    #[test]
    fn parse_direction_error_for_invalid_input() {
        // NOTE: Cannot inspect PyErr message without a live Python interpreter.
        // The error message formatting is tested via Python-side integration tests.
        assert!(parse_direction("sideways").is_err());
        assert!(parse_direction("backwards").is_err());
    }

    // ── registry_entry_count ────────────────────────────────────

    /// Correctness: counts entries array length from a registry JSON value
    #[test]
    fn registry_entry_count_with_entries() {
        let val = json!({
            "entries": [
                {"name": "x-ext-a"},
                {"name": "x-ext-b"},
                {"name": "x-ext-c"}
            ]
        });
        assert_eq!(registry_entry_count(&val), 3);
    }

    /// Boundary: missing "entries" key returns 0
    #[test]
    fn registry_entry_count_missing_key() {
        let val = json!({"publisher": {}});
        assert_eq!(registry_entry_count(&val), 0);
    }

    /// Boundary: "entries" is not an array returns 0
    #[test]
    fn registry_entry_count_not_array() {
        let val = json!({"entries": "not an array"});
        assert_eq!(registry_entry_count(&val), 0);
    }

    /// Boundary: empty entries array returns 0
    #[test]
    fn registry_entry_count_empty_array() {
        let val = json!({"entries": []});
        assert_eq!(registry_entry_count(&val), 0);
    }

    // ── parse_mapping_rules ─────────────────────────────────────

    /// Spec: mapping-spec.md §3.3 — minimal preserve rule with defaults
    #[test]
    fn parse_mapping_rules_minimal_preserve() {
        let rules_json = json!([{
            "sourcePath": "name",
            "targetPath": "full_name",
            "transform": "preserve"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].source_path.as_deref(), Some("name"));
        assert_eq!(rules[0].target_path, "full_name");
        assert!(matches!(
            rules[0].transform,
            runtime_mapping::TransformType::Preserve
        ));
        // Defaults
        assert_eq!(rules[0].priority, 0);
        assert!(rules[0].reverse_priority.is_none());
        assert!(rules[0].default.is_none());
        assert!(rules[0].condition.is_none());
        assert!(rules[0].bidirectional); // default true per spec
    }

    /// Spec: mapping-spec.md — transform "drop" explicitly excludes a field
    #[test]
    fn parse_mapping_rules_drop_transform() {
        let rules_json = json!([{
            "sourcePath": "internal_id",
            "targetPath": "id",
            "transform": "drop"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        assert!(matches!(
            rules[0].transform,
            runtime_mapping::TransformType::Drop
        ));
    }

    /// Spec: mapping-spec.md — transform "constant" injects a literal value
    #[test]
    fn parse_mapping_rules_constant_transform() {
        let rules_json = json!([{
            "targetPath": "version",
            "transform": "constant",
            "expression": "1.0"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        // Constant transform maps to Expression to evaluate FEL at runtime
        match &rules[0].transform {
            runtime_mapping::TransformType::Expression(expr) => {
                assert_eq!(expr, "1.0");
            }
            other => panic!("expected Expression (from constant), got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — constant with no "value" key defaults to null
    /// Spec: mapping.schema.json — constant transform requires 'expression'
    #[test]
    fn parse_mapping_rules_constant_missing_expression_errors() {
        let rules_json = json!([{
            "targetPath": "cleared",
            "transform": "constant"
        }]);
        assert!(parse_mapping_rules_inner(&rules_json).is_err());
    }

    /// Spec: mapping-spec.md — coerce transform with each target type
    #[test]
    fn parse_mapping_rules_coerce_all_types() {
        let types_and_expected = [
            ("string", runtime_mapping::CoerceType::String),
            ("number", runtime_mapping::CoerceType::Number),
            ("integer", runtime_mapping::CoerceType::Integer),
            ("boolean", runtime_mapping::CoerceType::Boolean),
            ("date", runtime_mapping::CoerceType::Date),
            ("datetime", runtime_mapping::CoerceType::DateTime),
        ];
        for (coerce_str, expected) in &types_and_expected {
            let rules_json = json!([{
                "sourcePath": "val",
                "targetPath": "out",
                "transform": "coerce",
                "coerce": coerce_str
            }]);
            let rules = parse_mapping_rules_inner(&rules_json).unwrap();
            match &rules[0].transform {
                runtime_mapping::TransformType::Coerce(ct) => {
                    assert_eq!(ct, expected, "coerce type mismatch for '{coerce_str}'");
                }
                other => panic!("expected Coerce for '{coerce_str}', got {:?}", other),
            }
        }
    }

    /// Boundary: coerce with unknown type falls back to String
    /// Spec: mapping.schema.json — unknown coerce type is an error
    #[test]
    fn parse_mapping_rules_coerce_unknown_type_errors() {
        let rules_json = json!([{
            "sourcePath": "val",
            "targetPath": "out",
            "transform": "coerce",
            "coerce": "timestamp"
        }]);
        assert!(parse_mapping_rules_inner(&rules_json).is_err());
    }

    /// Spec: mapping-spec.md — expression transform with FEL expression
    #[test]
    fn parse_mapping_rules_expression_transform() {
        let rules_json = json!([{
            "sourcePath": "first",
            "targetPath": "greeting",
            "transform": "expression",
            "expression": "concat('Hello, ', $)"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Expression(expr) => {
                assert_eq!(expr, "concat('Hello, ', $)");
            }
            other => panic!("expected Expression, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — valueMap transform with lookup table
    #[test]
    fn parse_mapping_rules_value_map_transform() {
        let rules_json = json!([{
            "sourcePath": "status",
            "targetPath": "code",
            "transform": "valueMap",
            "valueMap": {
                "active": "A",
                "inactive": "I"
            }
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::ValueMap { forward, unmapped } => {
                assert_eq!(forward.len(), 2);
                assert!(matches!(
                    unmapped,
                    runtime_mapping::UnmappedStrategy::PassThrough
                ));
            }
            other => panic!("expected ValueMap, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — valueMap with unmapped: "error"
    #[test]
    fn parse_mapping_rules_value_map_unmapped_error() {
        let rules_json = json!([{
            "sourcePath": "status",
            "targetPath": "code",
            "transform": "valueMap",
            "valueMap": {"forward": {"yes": "Y"}, "unmapped": "error"}
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::ValueMap { unmapped, .. } => {
                assert!(matches!(unmapped, runtime_mapping::UnmappedStrategy::Error));
            }
            other => panic!("expected ValueMap with Error strategy, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — flatten transform with separator
    #[test]
    fn parse_mapping_rules_flatten_transform() {
        let rules_json = json!([{
            "sourcePath": "address",
            "targetPath": "address_flat",
            "transform": "flatten",
            "separator": "_"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Flatten { separator } => {
                assert_eq!(separator, "_");
            }
            other => panic!("expected Flatten, got {:?}", other),
        }
    }

    /// Boundary: flatten with no separator defaults to "."
    #[test]
    fn parse_mapping_rules_flatten_default_separator() {
        let rules_json = json!([{
            "sourcePath": "address",
            "targetPath": "address_flat",
            "transform": "flatten"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Flatten { separator } => {
                assert_eq!(separator, ".");
            }
            other => panic!("expected Flatten with default separator, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — nest transform (inverse of flatten)
    #[test]
    fn parse_mapping_rules_nest_transform() {
        let rules_json = json!([{
            "sourcePath": "address_flat",
            "targetPath": "address",
            "transform": "nest",
            "separator": "_"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Nest { separator } => {
                assert_eq!(separator, "_");
            }
            other => panic!("expected Nest, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — concat transform with FEL expression
    #[test]
    fn parse_mapping_rules_concat_transform() {
        let rules_json = json!([{
            "sourcePath": "parts",
            "targetPath": "full",
            "transform": "concat",
            "expression": "join($, ' ')"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Concat(expr) => {
                assert_eq!(expr, "join($, ' ')");
            }
            other => panic!("expected Concat, got {:?}", other),
        }
    }

    /// Spec: mapping-spec.md — split transform with FEL expression
    #[test]
    fn parse_mapping_rules_split_transform() {
        let rules_json = json!([{
            "sourcePath": "full",
            "targetPath": "parts",
            "transform": "split",
            "expression": "split($, ' ')"
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        match &rules[0].transform {
            runtime_mapping::TransformType::Split(expr) => {
                assert_eq!(expr, "split($, ' ')");
            }
            other => panic!("expected Split, got {:?}", other),
        }
    }

    /// Boundary: unknown transform type produces error
    #[test]
    fn parse_mapping_rules_unknown_transform_errors() {
        let rules_json = json!([{
            "sourcePath": "a",
            "targetPath": "b",
            "transform": "magic"
        }]);
        // NOTE: Cannot inspect PyErr message without a live Python interpreter.
        // The error content is tested via Python-side integration tests.
        assert!(parse_mapping_rules_inner(&rules_json).is_err());
    }

    /// Boundary: rules must be an array
    #[test]
    fn parse_mapping_rules_not_array_errors() {
        let rules_json = json!({"not": "array"});
        assert!(parse_mapping_rules_inner(&rules_json).is_err());
    }

    /// Boundary: each rule must be an object
    #[test]
    fn parse_mapping_rules_rule_not_object_errors() {
        let rules_json = json!(["not an object"]);
        assert!(parse_mapping_rules_inner(&rules_json).is_err());
    }

    /// Correctness: all optional fields parsed when present
    #[test]
    fn parse_mapping_rules_full_rule_with_all_fields() {
        let rules_json = json!([{
            "sourcePath": "income",
            "targetPath": "annual_income",
            "transform": "preserve",
            "condition": "$income > 0",
            "priority": 10,
            "reversePriority": 5,
            "default": 0,
            "bidirectional": false
        }]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        let r = &rules[0];
        assert_eq!(r.source_path.as_deref(), Some("income"));
        assert_eq!(r.target_path, "annual_income");
        assert!(matches!(
            r.transform,
            runtime_mapping::TransformType::Preserve
        ));
        assert_eq!(r.condition.as_deref(), Some("$income > 0"));
        assert_eq!(r.priority, 10);
        assert_eq!(r.reverse_priority, Some(5));
        assert_eq!(r.default, Some(json!(0)));
        assert!(!r.bidirectional);
    }

    /// Correctness: multiple rules parsed in order
    #[test]
    fn parse_mapping_rules_multiple_rules_preserved_order() {
        let rules_json = json!([
            {"sourcePath": "a", "targetPath": "x", "transform": "preserve"},
            {"sourcePath": "b", "targetPath": "y", "transform": "preserve"},
            {"sourcePath": "c", "targetPath": "z", "transform": "preserve"}
        ]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        assert_eq!(rules.len(), 3);
        assert_eq!(rules[0].source_path.as_deref(), Some("a"));
        assert_eq!(rules[1].source_path.as_deref(), Some("b"));
        assert_eq!(rules[2].source_path.as_deref(), Some("c"));
    }

    /// Boundary: empty rules array is valid
    #[test]
    fn parse_mapping_rules_empty_array() {
        let rules_json = json!([]);
        let rules = parse_mapping_rules_inner(&rules_json).unwrap();
        assert!(rules.is_empty());
    }

    // NOTE: parse_mapping_document tests require PyO3 (uses PyResult/PyValueError).
    // These must be tested via Python-side integration tests.
    // TODO: Extract parse_mapping_document_inner for native testability.
    // Untestable functions — require Python interpreter
    // ────────────────────────────────────────────────────────────
    //
    // The following functions use PyO3 types (Python<'_>, PyObject, Bound<'_, PyDict>)
    // and cannot be tested without a live Python interpreter:
    //
    // python_to_fel(py, obj) → FelValue
    //   TODO: Test that bool is extracted BEFORE int (Python bool subclasses int).
    //         Test None → Null, int → Number(Decimal), float → Number(Decimal),
    //         str → String, list → Array, dict → Object, unknown → Null.
    //         Write as: `python3 -m pytest tests/unit/test_rust_bindings.py`
    //
    // fel_to_python(py, val) → PyObject
    //   TODO: Test Number with zero fract → int, non-zero fract → float,
    //         Date → ISO string, Money → dict with amount + currency,
    //         Array → list, Object → dict, Null → None.
    //
    // json_to_python(py, val) → PyObject
    //   TODO: Test all JSON types map correctly. Number edge cases:
    //         i64-representable → int, f64-representable → float, neither → None.
    //
    // pydict_to_field_map(py, dict) → HashMap<String, FelValue>
    //   TODO: Test mixed-type dict, empty dict, nested structures.
    //
    // All #[pyfunction]s (eval_fel, parse_fel, get_dependencies, extract_deps,
    // analyze_expression, detect_type, lint_document, evaluate_def,
    // parse_registry, find_registry_entry, validate_lifecycle, well_known_url,
    // generate_changelog, execute_mapping_doc):
    //   These are thin wrappers that delegate to sibling crates.
    //   The underlying logic is tested in those crates.
    //   Python-side tests should verify the binding boundary:
    //   correct argument passing, error propagation, and return type mapping.

    // ── Validation: required fields (spec: mapping.schema.json) ──
    // Tests call parse_mapping_rules_inner directly (returns Result<_, String>)
    // to avoid FFI (PyO3) dependencies in native test builds.

    fn expect_err(rules: Value, substring: &str) {
        let err = parse_mapping_rules_inner(&rules).unwrap_err();
        assert!(
            err.contains(substring),
            "expected error containing {substring:?}, got: {err}"
        );
    }

    // ── Required field: transform ────────────────────────────────

    #[test]
    fn rejects_rule_missing_transform() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b"}]),
            "missing required field 'transform'",
        );
    }

    #[test]
    fn accepts_valid_preserve_rule() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b", "transform": "preserve"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    // ── Required field: expression (for expression/constant/concat/split) ──

    #[test]
    fn rejects_expression_transform_missing_expression() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b", "transform": "expression"}]),
            "requires 'expression'",
        );
    }

    #[test]
    fn rejects_constant_transform_missing_expression() {
        expect_err(
            json!([{"targetPath": "b", "transform": "constant"}]),
            "requires 'expression'",
        );
    }

    #[test]
    fn rejects_concat_transform_missing_expression() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b", "transform": "concat"}]),
            "requires 'expression'",
        );
    }

    #[test]
    fn rejects_split_transform_missing_expression() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b", "transform": "split"}]),
            "requires 'expression'",
        );
    }

    #[test]
    fn accepts_expression_transform_with_expression() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b", "transform": "expression", "expression": "$ + 1"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    #[test]
    fn accepts_constant_transform_with_expression() {
        let rules = json!([{"targetPath": "b", "transform": "constant", "expression": "'hello'"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    // ── Required field: coerce (for coerce transform) ────────────

    #[test]
    fn rejects_coerce_transform_missing_coerce() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b", "transform": "coerce"}]),
            "requires 'coerce'",
        );
    }

    #[test]
    fn accepts_coerce_transform_with_string_shorthand() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b", "transform": "coerce", "coerce": "number"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    #[test]
    fn accepts_coerce_transform_with_object_form() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b", "transform": "coerce", "coerce": {"from": "date", "to": "string"}}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    // ── Required: at least one of sourcePath/targetPath ──────────

    #[test]
    fn rejects_rule_missing_both_paths() {
        expect_err(
            json!([{"transform": "preserve"}]),
            "at least one of 'sourcePath' or 'targetPath'",
        );
    }

    #[test]
    fn accepts_rule_with_only_source_path() {
        let rules = json!([{"sourcePath": "a", "transform": "drop"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    #[test]
    fn accepts_rule_with_only_target_path() {
        let rules = json!([{"targetPath": "b", "transform": "constant", "expression": "'v1'"}]);
        assert_eq!(parse_mapping_rules_inner(&rules).unwrap().len(), 1);
    }

    // ── Error messages include rule index ────────────────────────

    #[test]
    fn error_message_includes_rule_index() {
        let rules = json!([
            {"sourcePath": "a", "targetPath": "b", "transform": "preserve"},
            {"sourcePath": "c"}
        ]);
        let err = parse_mapping_rules_inner(&rules).unwrap_err();
        assert!(err.contains("rule[1]"));
    }

    // ── Unknown transform type ───────────────────────────────────

    #[test]
    fn rejects_unknown_transform_type() {
        expect_err(
            json!([{"sourcePath": "a", "targetPath": "b", "transform": "magic"}]),
            "unknown transform type: magic",
        );
    }

    // ── Finding 78: parse_coerce_type ───────────────────────────

    /// Spec: mapping/mapping-spec.md §3.3.2 — String shorthand for known coerce types.
    #[test]
    fn parse_coerce_type_string_shorthand_known() {
        assert_eq!(
            parse_coerce_type(&json!("string")),
            Some(runtime_mapping::CoerceType::String)
        );
        assert_eq!(
            parse_coerce_type(&json!("number")),
            Some(runtime_mapping::CoerceType::Number)
        );
        assert_eq!(
            parse_coerce_type(&json!("integer")),
            Some(runtime_mapping::CoerceType::Integer)
        );
        assert_eq!(
            parse_coerce_type(&json!("boolean")),
            Some(runtime_mapping::CoerceType::Boolean)
        );
        assert_eq!(
            parse_coerce_type(&json!("date")),
            Some(runtime_mapping::CoerceType::Date)
        );
        assert_eq!(
            parse_coerce_type(&json!("datetime")),
            Some(runtime_mapping::CoerceType::DateTime)
        );
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Unknown string shorthand returns None.
    #[test]
    fn parse_coerce_type_unknown_string_returns_none() {
        assert_eq!(parse_coerce_type(&json!("uuid")), None);
        assert_eq!(parse_coerce_type(&json!("money")), None);
        assert_eq!(parse_coerce_type(&json!("")), None);
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Object form with valid "to" key.
    #[test]
    fn parse_coerce_type_object_form_with_to() {
        assert_eq!(
            parse_coerce_type(&json!({"from": "date", "to": "string", "format": "MM/DD/YYYY"})),
            Some(runtime_mapping::CoerceType::String)
        );
        assert_eq!(
            parse_coerce_type(&json!({"from": "string", "to": "number"})),
            Some(runtime_mapping::CoerceType::Number)
        );
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Object form missing "to" key returns None.
    #[test]
    fn parse_coerce_type_object_missing_to_returns_none() {
        assert_eq!(parse_coerce_type(&json!({"from": "string"})), None);
        assert_eq!(parse_coerce_type(&json!({})), None);
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Object form with unknown "to" value returns None.
    #[test]
    fn parse_coerce_type_object_unknown_to_returns_none() {
        assert_eq!(
            parse_coerce_type(&json!({"from": "string", "to": "uuid"})),
            None
        );
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Non-string, non-object input returns None.
    #[test]
    fn parse_coerce_type_non_string_non_object_returns_none() {
        assert_eq!(parse_coerce_type(&json!(42)), None);
        assert_eq!(parse_coerce_type(&json!(null)), None);
        assert_eq!(parse_coerce_type(&json!([])), None);
        assert_eq!(parse_coerce_type(&json!(true)), None);
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Object form "from" field is ignored.
    /// The "from" field is accepted but has no effect on the returned CoerceType.
    #[test]
    fn parse_coerce_type_object_from_field_ignored() {
        // Same "to" regardless of "from" value
        let with_from = parse_coerce_type(&json!({"from": "date", "to": "string"}));
        let without_from = parse_coerce_type(&json!({"to": "string"}));
        assert_eq!(with_from, without_from);
        assert_eq!(with_from, Some(runtime_mapping::CoerceType::String));
    }

    // ── Finding 79: parse_mapping_document_inner ────────────────

    /// Spec: mapping/mapping-spec.md §3.1 — Valid mapping document with autoMap and rules.
    #[test]
    fn parse_mapping_document_inner_valid_with_automap_and_rules() {
        let doc = json!({
            "rules": [
                {"sourcePath": "name", "targetPath": "fullName", "transform": "preserve"}
            ],
            "autoMap": true
        });
        let result = parse_mapping_document_inner(&doc).unwrap();
        assert_eq!(result.rules.len(), 1);
        assert!(result.auto_map);
        assert!(result.defaults.is_none());
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Minimal document with empty rules.
    #[test]
    fn parse_mapping_document_inner_minimal_empty_rules() {
        let doc = json!({"rules": []});
        let result = parse_mapping_document_inner(&doc).unwrap();
        assert_eq!(result.rules.len(), 0);
        assert!(!result.auto_map);
        assert!(result.defaults.is_none());
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Non-object input returns error.
    #[test]
    fn parse_mapping_document_inner_non_object_rejected() {
        assert!(parse_mapping_document_inner(&json!("string")).is_err());
        assert!(parse_mapping_document_inner(&json!(42)).is_err());
        assert!(parse_mapping_document_inner(&json!(null)).is_err());
        assert!(parse_mapping_document_inner(&json!([])).is_err());
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Document with defaults.
    #[test]
    fn parse_mapping_document_inner_with_defaults() {
        let doc = json!({
            "rules": [],
            "defaults": {"separator": ".", "unmapped": "error"}
        });
        let result = parse_mapping_document_inner(&doc).unwrap();
        let defaults = result.defaults.unwrap();
        assert_eq!(defaults.get("separator").unwrap(), ".");
        assert_eq!(defaults.get("unmapped").unwrap(), "error");
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Missing "rules" key returns error.
    #[test]
    fn parse_mapping_document_inner_missing_rules_rejected() {
        let doc = json!({"autoMap": true});
        assert!(parse_mapping_document_inner(&doc).is_err());
    }

    // ── Finding 79: parse_mapping_rules_inner ───────────────────

    /// Spec: mapping/mapping-spec.md §3.1 — Rules array parse with multiple transforms.
    #[test]
    fn parse_mapping_rules_inner_multiple_transforms() {
        let rules = json!([
            {"sourcePath": "a", "targetPath": "b", "transform": "preserve"},
            {"targetPath": "c", "transform": "drop"},
            {"sourcePath": "d", "targetPath": "e", "transform": "coerce", "coerce": "number"}
        ]);
        let result = parse_mapping_rules_inner(&rules).unwrap();
        assert_eq!(result.len(), 3);
        assert!(matches!(
            result[0].transform,
            runtime_mapping::TransformType::Preserve
        ));
        assert!(matches!(
            result[1].transform,
            runtime_mapping::TransformType::Drop
        ));
        assert!(matches!(
            result[2].transform,
            runtime_mapping::TransformType::Coerce(runtime_mapping::CoerceType::Number)
        ));
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Non-array input returns error.
    #[test]
    fn parse_mapping_rules_inner_non_array_rejected() {
        assert!(parse_mapping_rules_inner(&json!({})).is_err());
        assert!(parse_mapping_rules_inner(&json!("rules")).is_err());
        assert!(parse_mapping_rules_inner(&json!(null)).is_err());
    }

    /// Spec: mapping/mapping-spec.md §3.1 — Rule with unknown transform returns error.
    #[test]
    fn parse_mapping_rules_inner_unknown_transform_rejected() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b", "transform": "magical"}]);
        assert!(parse_mapping_rules_inner(&rules).is_err());
    }

    /// Spec: mapping.schema.json §3.3 — Transform is required on every rule.
    #[test]
    fn parse_mapping_rules_inner_missing_transform_rejected() {
        let rules = json!([{"sourcePath": "a", "targetPath": "b"}]);
        assert!(parse_mapping_rules_inner(&rules).is_err());
    }

    // ── Finding 80: UnmappedStrategy parsing ────────────────────

    /// Spec: mapping/mapping-spec.md §4.6 — All four unmapped strategies parse correctly.
    #[test]
    fn parse_mapping_rules_inner_all_unmapped_strategies() {
        for (strategy_str, expected) in [
            ("error", runtime_mapping::UnmappedStrategy::Error),
            ("drop", runtime_mapping::UnmappedStrategy::Drop),
            ("default", runtime_mapping::UnmappedStrategy::Default),
            (
                "passthrough",
                runtime_mapping::UnmappedStrategy::PassThrough,
            ),
        ] {
            let rules = json!([{
                "sourcePath": "a",
                "targetPath": "b",
                "transform": "valueMap",
                "valueMap": {"forward": {"x": 1}, "unmapped": strategy_str}
            }]);
            let result = parse_mapping_rules_inner(&rules).unwrap();
            if let runtime_mapping::TransformType::ValueMap { unmapped, .. } = &result[0].transform
            {
                assert_eq!(
                    *unmapped, expected,
                    "strategy '{strategy_str}' did not match"
                );
            } else {
                panic!("expected ValueMap transform");
            }
        }
    }

    /// Spec: mapping/mapping-spec.md §4.6 — Unknown unmapped strategy defaults to passthrough.
    #[test]
    fn parse_mapping_rules_inner_unknown_unmapped_defaults_to_passthrough() {
        let rules = json!([{
            "sourcePath": "a",
            "targetPath": "b",
            "transform": "valueMap",
            "valueMap": {"forward": {"x": 1}, "unmapped": "nonexistent"}
        }]);
        let result = parse_mapping_rules_inner(&rules).unwrap();
        if let runtime_mapping::TransformType::ValueMap { unmapped, .. } = &result[0].transform {
            assert_eq!(*unmapped, runtime_mapping::UnmappedStrategy::PassThrough);
        } else {
            panic!("expected ValueMap transform");
        }
    }

    /// Spec: mapping/mapping-spec.md §3.3.2 — Coerce with object form parsed through rules.
    #[test]
    fn parse_mapping_rules_inner_coerce_object_form() {
        let rules = json!([{
            "sourcePath": "dob",
            "targetPath": "dob_str",
            "transform": "coerce",
            "coerce": {"from": "date", "to": "string", "format": "MM/DD/YYYY"}
        }]);
        let result = parse_mapping_rules_inner(&rules).unwrap();
        assert!(matches!(
            result[0].transform,
            runtime_mapping::TransformType::Coerce(runtime_mapping::CoerceType::String)
        ));
    }
}
