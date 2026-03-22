//! Changelog generation binding.

use pyo3::prelude::*;

use formspec_core::{JsonWireStyle, changelog, changelog_to_json_value};

use crate::PyObject;
use crate::convert::{depythonize_json, json_to_python};

// ── Changelog ───────────────────────────────────────────────────

/// Diff two definition versions and produce a structured changelog.
///
/// Returns a dict with: definition_url, from_version, to_version, semver_impact, changes (list).
#[pyfunction]
pub fn generate_changelog(
    py: Python,
    old_def_obj: &Bound<'_, PyAny>,
    new_def_obj: &Bound<'_, PyAny>,
    definition_url: &str,
) -> PyResult<PyObject> {
    let old_def = depythonize_json(old_def_obj)?;
    let new_def = depythonize_json(new_def_obj)?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);
    let json = changelog_to_json_value(&result, JsonWireStyle::PythonSnake);
    json_to_python(py, &json)
}
