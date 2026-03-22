//! Registry document parsing and entry lookup bindings.

use pyo3::prelude::*;

use formspec_core::registry_client::{
    Registry, registry_entry_to_json_value, registry_parse_summary_to_json_value,
    version_constraint_option,
};

use crate::PyObject;
use crate::convert::{depythonize_json, json_to_python, parse_status_str};

#[pyfunction]
pub fn parse_registry(py: Python, registry: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let val = depythonize_json(registry)?;
    let reg = Registry::from_json(&val)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let issues = reg.validate();
    let json = registry_parse_summary_to_json_value(&reg, &val, &issues, formspec_core::JsonWireStyle::PythonSnake);
    json_to_python(py, &json)
}

#[pyfunction]
pub fn find_registry_entry(
    py: Python,
    registry: &Bound<'_, PyAny>,
    name: &str,
    version_constraint: &str,
) -> PyResult<PyObject> {
    let val = depythonize_json(registry)?;
    let reg = Registry::from_json(&val)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let entry = reg.find_one(name, version_constraint_option(version_constraint));
    match entry {
        None => Ok(py.None()),
        Some(e) => {
            let json = registry_entry_to_json_value(e, formspec_core::JsonWireStyle::PythonSnake);
            json_to_python(py, &json)
        }
    }
}

#[pyfunction]
pub fn validate_lifecycle(from_status: &str, to_status: &str) -> PyResult<bool> {
    use formspec_core::registry_client;
    let from = parse_status_str(from_status).ok_or_else(|| {
        pyo3::exceptions::PyValueError::new_err(format!("unknown status: {from_status}"))
    })?;
    let to = parse_status_str(to_status).ok_or_else(|| {
        pyo3::exceptions::PyValueError::new_err(format!("unknown status: {to_status}"))
    })?;
    Ok(registry_client::validate_lifecycle_transition(from, to))
}

#[pyfunction]
pub fn well_known_url(base_url: &str) -> PyResult<String> {
    Ok(formspec_core::registry_client::well_known_url(base_url))
}
