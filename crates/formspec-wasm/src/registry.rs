//! Registry client and extension usage validation (`wasm_bindgen`).

use std::collections::HashMap;

use formspec_core::registry_client::{
    self, Registry, parse_registry_entry_status, registry_entry_to_json_value,
    registry_parse_summary_to_json_value, version_constraint_option,
};
use formspec_core::{
    JsonWireStyle, extension_usage_issues_to_json_value, json_definition_items_tree_from_value,
    map_registry_from_extension_entry_map, validate_extension_usage,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "parseRegistry")]
pub fn parse_registry(registry_json: &str) -> Result<String, JsError> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let registry = Registry::from_json(&val).map_err(|e| JsError::new(&e.to_string()))?;
    let issues = registry.validate();
    let json = registry_parse_summary_to_json_value(&registry, &val, &issues, JsonWireStyle::JsCamel);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = "findRegistryEntry")]
pub fn find_registry_entry(
    registry_json: &str,
    name: &str,
    version_constraint: &str,
) -> Result<String, JsError> {
    find_registry_entry_inner(registry_json, name, version_constraint).map_err(|e| JsError::new(&e))
}

pub(crate) fn find_registry_entry_inner(
    registry_json: &str,
    name: &str,
    version_constraint: &str,
) -> Result<String, String> {
    let val: Value =
        serde_json::from_str(registry_json).map_err(|e| format!("invalid JSON: {e}"))?;
    let registry = Registry::from_json(&val).map_err(|e| e.to_string())?;
    let entry = registry.find_one(name, version_constraint_option(version_constraint));
    match entry {
        Some(e) => {
            let json = registry_entry_to_json_value(e, JsonWireStyle::JsCamel);
            serde_json::to_string(&json).map_err(|e| e.to_string())
        }
        None => Ok("null".to_string()),
    }
}

#[wasm_bindgen(js_name = "validateLifecycleTransition")]
pub fn validate_lifecycle_transition_wasm(from: &str, to: &str) -> bool {
    let from_status = match parse_registry_entry_status(from) {
        Some(s) => s,
        None => return false,
    };
    let to_status = match parse_registry_entry_status(to) {
        Some(s) => s,
        None => return false,
    };
    registry_client::validate_lifecycle_transition(from_status, to_status)
}

#[wasm_bindgen(js_name = "wellKnownRegistryUrl")]
pub fn well_known_registry_url(base_url: &str) -> String {
    registry_client::well_known_url(base_url)
}

#[wasm_bindgen(js_name = "validateExtensionUsage")]
pub fn validate_extension_usage_wasm(
    items_json: &str,
    registry_entries_json: &str,
) -> Result<String, JsError> {
    let item_values: Value = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let items = json_definition_items_tree_from_value(&item_values)
        .map_err(|e| JsError::new(&e))?;
    let registry_entries: HashMap<String, Value> = serde_json::from_str(registry_entries_json)
        .map_err(|e| JsError::new(&format!("invalid registry entries JSON: {e}")))?;
    let registry = map_registry_from_extension_entry_map(&registry_entries);
    let issues = validate_extension_usage(&items, &registry);
    let json = extension_usage_issues_to_json_value(&issues);
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
