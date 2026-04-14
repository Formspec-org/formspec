//! WASM bindings for changeset dependency analysis.

use formspec_changeset::{RecordedEntry, compute_dependency_groups};
use wasm_bindgen::prelude::*;

/// Compute dependency groups from recorded changeset entries.
///
/// Accepts a JSON array of `RecordedEntry` objects and returns a JSON array
/// of `DependencyGroup` objects.
#[wasm_bindgen(js_name = "computeDependencyGroups")]
pub fn compute_dependency_groups_wasm(entries_json: &str) -> Result<String, JsError> {
    let entries: Vec<RecordedEntry> = serde_json::from_str(entries_json)
        .map_err(|e| JsError::new(&format!("Invalid entries JSON: {e}")))?;
    let groups = compute_dependency_groups(&entries);
    serde_json::to_string(&groups).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}
