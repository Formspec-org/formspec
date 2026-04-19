//! Changelog generation binding.

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

use formspec_core::{JsonWireStyle, changelog, changelog_to_json_value};

use crate::PyObject;
use crate::convert::{depythonize_json, json_to_python};

// ── Changelog ───────────────────────────────────────────────────

/// Diff two definition versions and produce a structured changelog.
///
/// `wire_style` controls key casing:
///   - `"snake"` (default) — snake_case keys for Python ergonomics.
///   - `"camel"` — camelCase keys matching `changelog.schema.json` wire
///     format. Use this when the output will be passed to `lint()` or
///     serialized as JSON for cross-runtime consumers.
#[pyfunction]
#[pyo3(signature = (old_def_obj, new_def_obj, definition_url, wire_style=None))]
pub fn generate_changelog(
    py: Python,
    old_def_obj: &Bound<'_, PyAny>,
    new_def_obj: &Bound<'_, PyAny>,
    definition_url: &str,
    wire_style: Option<&str>,
) -> PyResult<PyObject> {
    let style = parse_wire_style(wire_style)?;
    let old_def = depythonize_json(old_def_obj)?;
    let new_def = depythonize_json(new_def_obj)?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);
    let json = changelog_to_json_value(&result, style);
    json_to_python(py, &json)
}

fn parse_wire_style(s: Option<&str>) -> PyResult<JsonWireStyle> {
    match s.unwrap_or("snake") {
        "snake" => Ok(JsonWireStyle::PythonSnake),
        "camel" => Ok(JsonWireStyle::JsCamel),
        other => Err(PyValueError::new_err(format!(
            "unknown wire_style {:?}; expected 'snake' or 'camel'",
            other
        ))),
    }
}
