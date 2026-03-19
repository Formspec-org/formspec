//! PyO3 bindings for Formspec — FEL, linting, definition evaluation, registry, changelog, and mapping to Python.

/// PyO3 bindings for Formspec — exposes FEL evaluation, linting, evaluation,
/// registry parsing, changelog generation, and mapping execution to Python.
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
use formspec_core::registry_client::{self, Registry};
use formspec_core::changelog;
use formspec_core::runtime_mapping;
use formspec_core::extension_analysis::RegistryEntryStatus;
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

    let variables = PyDict::new(py);
    for (k, v) in &result.variables {
        variables.set_item(k, json_to_python(py, v)?)?;
    }
    dict.set_item("variables", variables)?;

    Ok(dict.into())
}

// ── Registry Client ──────────────────────────────────────────────

/// Parse a registry JSON document and return summary info.
///
/// Returns a dict with: publisher (dict), published (str), entry_count (int), validation_issues (list).
#[pyfunction]
fn parse_registry(py: Python, registry_json: &str) -> PyResult<PyObject> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;

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
fn find_registry_entry(py: Python, registry_json: &str, name: &str, version_constraint: &str) -> PyResult<PyObject> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;

    let registry = Registry::from_json(&val)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let constraint = if version_constraint.is_empty() { None } else { Some(version_constraint) };
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
    let from = parse_status_str(from_status)
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err(format!("unknown status: {from_status}")))?;
    let to = parse_status_str(to_status)
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err(format!("unknown status: {to_status}")))?;
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
fn generate_changelog(py: Python, old_def_json: &str, new_def_json: &str, definition_url: &str) -> PyResult<PyObject> {
    let old_def: Value = serde_json::from_str(old_def_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid old definition JSON: {e}")))?;
    let new_def: Value = serde_json::from_str(new_def_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid new definition JSON: {e}")))?;

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
        entry.set_item("before", c.before.as_ref().map(|v| json_to_python(py, v)).transpose()?)?;
        entry.set_item("after", c.after.as_ref().map(|v| json_to_python(py, v)).transpose()?)?;
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
fn execute_mapping_doc(py: Python, doc_json: &str, source_json: &str, direction: &str) -> PyResult<PyObject> {
    let doc_val: Value = serde_json::from_str(doc_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid mapping doc JSON: {e}")))?;
    let source: Value = serde_json::from_str(source_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid source JSON: {e}")))?;
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
    m.add_function(wrap_pyfunction!(parse_fel, m)?)?;
    m.add_function(wrap_pyfunction!(get_dependencies, m)?)?;
    m.add_function(wrap_pyfunction!(extract_deps, m)?)?;
    m.add_function(wrap_pyfunction!(analyze_expression, m)?)?;
    m.add_function(wrap_pyfunction!(detect_type, m)?)?;
    m.add_function(wrap_pyfunction!(lint_document, m)?)?;
    m.add_function(wrap_pyfunction!(evaluate_def, m)?)?;
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
        _ => Err(pyo3::exceptions::PyValueError::new_err(format!("invalid direction: {s}, expected 'forward' or 'reverse'"))),
    }
}

fn parse_mapping_document(val: &Value) -> PyResult<runtime_mapping::MappingDocument> {
    let obj = val.as_object()
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err("mapping doc must be an object"))?;

    let rules_val = obj.get("rules")
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err("mapping doc missing 'rules'"))?;
    let rules = parse_mapping_rules(rules_val)?;

    let defaults = obj.get("defaults")
        .and_then(|v| v.as_object())
        .cloned();

    let auto_map = obj.get("autoMap")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(runtime_mapping::MappingDocument {
        rules,
        defaults,
        auto_map,
    })
}

fn parse_mapping_rules(val: &Value) -> PyResult<Vec<runtime_mapping::MappingRule>> {
    let arr = val.as_array()
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err("rules must be an array"))?;

    let mut rules = Vec::new();
    for rule_val in arr {
        let obj = rule_val.as_object()
            .ok_or_else(|| pyo3::exceptions::PyValueError::new_err("rule must be an object"))?;

        let transform = match obj.get("transform").and_then(|v| v.as_str()).unwrap_or("preserve") {
            "preserve" => runtime_mapping::TransformType::Preserve,
            "drop" => runtime_mapping::TransformType::Drop,
            "constant" => runtime_mapping::TransformType::Constant(
                obj.get("value").cloned().unwrap_or(Value::Null),
            ),
            "coerce" => {
                let target = obj.get("coerce").and_then(|v| v.as_str()).unwrap_or("string");
                runtime_mapping::TransformType::Coerce(match target {
                    "number" => runtime_mapping::CoerceType::Number,
                    "integer" => runtime_mapping::CoerceType::Integer,
                    "boolean" => runtime_mapping::CoerceType::Boolean,
                    "date" => runtime_mapping::CoerceType::Date,
                    "datetime" => runtime_mapping::CoerceType::DateTime,
                    _ => runtime_mapping::CoerceType::String,
                })
            }
            "expression" => runtime_mapping::TransformType::Expression(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            "valueMap" => {
                let entries = obj.get("valueMap").and_then(|v| v.as_object());
                let forward: Vec<(Value, Value)> = entries
                    .map(|m| m.iter().map(|(k, v)| (Value::String(k.clone()), v.clone())).collect())
                    .unwrap_or_default();
                runtime_mapping::TransformType::ValueMap {
                    forward,
                    unmapped: match obj.get("unmapped").and_then(|v| v.as_str()) {
                        Some("error") => runtime_mapping::UnmappedStrategy::Error,
                        _ => runtime_mapping::UnmappedStrategy::PassThrough,
                    },
                }
            }
            "flatten" => runtime_mapping::TransformType::Flatten {
                separator: obj.get("separator").and_then(|v| v.as_str()).unwrap_or(".").to_string(),
            },
            "nest" => runtime_mapping::TransformType::Nest {
                separator: obj.get("separator").and_then(|v| v.as_str()).unwrap_or(".").to_string(),
            },
            "concat" => runtime_mapping::TransformType::Concat(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            "split" => runtime_mapping::TransformType::Split(
                obj.get("expression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            ),
            other => return Err(pyo3::exceptions::PyValueError::new_err(format!("unknown transform type: {other}"))),
        };

        rules.push(runtime_mapping::MappingRule {
            source_path: obj.get("sourcePath").and_then(|v| v.as_str()).map(String::from),
            target_path: obj.get("targetPath").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            transform,
            condition: obj.get("condition").and_then(|v| v.as_str()).map(String::from),
            priority: obj.get("priority").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            reverse_priority: obj.get("reversePriority").and_then(|v| v.as_i64()).map(|n| n as i32),
            default: obj.get("default").cloned(),
            bidirectional: obj.get("bidirectional").and_then(|v| v.as_bool()).unwrap_or(true),
        });
    }
    Ok(rules)
}
