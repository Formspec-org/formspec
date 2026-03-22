//! Changelog generation (`wasm_bindgen`).

use formspec_core::changelog;
use formspec_core::{JsonWireStyle, changelog_to_json_value};
use serde_json::Value;
use wasm_bindgen::prelude::*;

/// Diff two Formspec definition versions and produce a structured changelog.
/// Returns JSON with camelCase keys.
#[wasm_bindgen(js_name = "generateChangelog")]
pub fn generate_changelog_wasm(
    old_def_json: &str,
    new_def_json: &str,
    definition_url: &str,
) -> Result<String, JsError> {
    generate_changelog_inner(old_def_json, new_def_json, definition_url)
        .map_err(|e| JsError::new(&e))
}

pub(crate) fn generate_changelog_inner(
    old_def_json: &str,
    new_def_json: &str,
    definition_url: &str,
) -> Result<String, String> {
    let old_def: Value =
        serde_json::from_str(old_def_json).map_err(|e| format!("invalid old definition JSON: {e}"))?;
    let new_def: Value =
        serde_json::from_str(new_def_json).map_err(|e| format!("invalid new definition JSON: {e}"))?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);
    let json = changelog_to_json_value(&result, JsonWireStyle::JsCamel);
    serde_json::to_string(&json).map_err(|e| e.to_string())
}
