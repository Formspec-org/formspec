//! Registry client and extension usage validation (`wasm_bindgen`).

use std::collections::HashMap;

use formspec_core::registry_client::{self, Registry};
use formspec_core::{
    ExtensionErrorCode, ExtensionItem, ExtensionSeverity, MapRegistry, RegistryEntryInfo,
    RegistryEntryStatus, validate_extension_usage,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

use crate::convert::{category_to_str, parse_status_str, status_to_str};

// ── Registry Client ─────────────────────────────────────────────

/// Parse a registry JSON document, validate it, return summary JSON.
/// Returns: { publisher, published, entryCount, validationIssues }
#[wasm_bindgen(js_name = "parseRegistry")]
pub fn parse_registry(registry_json: &str) -> Result<String, JsError> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| JsError::new(&format!("invalid JSON: {e}")))?;
    let registry = Registry::from_json(&val).map_err(|e| JsError::new(&e.to_string()))?;
    let issues = registry.validate();
    let entry_count = val
        .get("entries")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    let json = serde_json::json!({
        "publisher": {
            "name": registry.publisher.name,
            "url": registry.publisher.url,
            "contact": registry.publisher.contact,
        },
        "published": registry.published,
        "entryCount": entry_count,
        "validationIssues": issues,
    });
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}

/// Find the highest-version registry entry matching name + version constraint.
/// Returns entry JSON or "null" if not found.
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

    let constraint = if version_constraint.is_empty() {
        None
    } else {
        Some(version_constraint)
    };
    let entry = registry.find_one(name, constraint);

    match entry {
        Some(e) => {
            let json = serde_json::json!({
                "name": e.name,
                "category": category_to_str(e.category),
                "version": e.version,
                "status": status_to_str(e.status),
                "description": e.description,
                "deprecationNotice": e.deprecation_notice,
                "baseType": e.base_type,
                "parameters": e.parameters.as_ref().map(|params| {
                    params.iter().map(|p| serde_json::json!({
                        "name": p.name,
                        "type": p.param_type,
                        "description": p.description,
                    })).collect::<Vec<_>>()
                }),
                "returns": e.returns,
            });
            serde_json::to_string(&json).map_err(|e| e.to_string())
        }
        None => Ok("null".to_string()),
    }
}

/// Check whether a lifecycle transition is valid per the registry spec.
#[wasm_bindgen(js_name = "validateLifecycleTransition")]
pub fn validate_lifecycle_transition_wasm(from: &str, to: &str) -> bool {
    let from_status = match parse_status_str(from) {
        Some(s) => s,
        None => return false,
    };
    let to_status = match parse_status_str(to) {
        Some(s) => s,
        None => return false,
    };
    registry_client::validate_lifecycle_transition(from_status, to_status)
}

/// Construct the well-known registry URL for a base URL.
#[wasm_bindgen(js_name = "wellKnownRegistryUrl")]
pub fn well_known_registry_url(base_url: &str) -> String {
    registry_client::well_known_url(base_url)
}

#[derive(Debug)]
struct WasmExtensionItem {
    key: String,
    children: Vec<WasmExtensionItem>,
    extensions: Option<HashMap<String, Value>>,
    extra: HashMap<String, Value>,
}

impl WasmExtensionItem {
    fn from_json(value: &Value) -> Option<Self> {
        let obj = value.as_object()?;
        let key = obj.get("key")?.as_str()?.to_string();
        let children = obj
            .get("children")
            .and_then(|child| child.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(WasmExtensionItem::from_json)
                    .collect()
            })
            .unwrap_or_default();
        let extensions = obj
            .get("extensions")
            .and_then(|extensions| extensions.as_object())
            .map(|map| map.iter().map(|(k, v)| (k.clone(), v.clone())).collect());
        let extra = obj
            .iter()
            .filter(|(name, _)| *name != "key" && *name != "children" && *name != "extensions")
            .map(|(name, value)| (name.clone(), value.clone()))
            .collect();
        Some(Self {
            key,
            children,
            extensions,
            extra,
        })
    }
}

impl ExtensionItem for WasmExtensionItem {
    fn key(&self) -> &str {
        &self.key
    }

    fn declared_extensions(&self) -> Vec<String> {
        let mut found = Vec::new();
        for (name, value) in &self.extra {
            if !name.starts_with("x-") {
                continue;
            }
            if value.is_null() || value == &Value::Bool(false) {
                continue;
            }
            found.push(name.clone());
        }
        if let Some(extensions) = &self.extensions {
            for (name, enabled) in extensions {
                if !name.starts_with("x-") {
                    continue;
                }
                if enabled.is_null() || enabled == &Value::Bool(false) {
                    continue;
                }
                found.push(name.clone());
            }
        }
        found.sort();
        found.dedup();
        found
    }

    fn children(&self) -> &[Self] {
        &self.children
    }
}

fn parse_registry_status(status: &str) -> RegistryEntryStatus {
    match status {
        "retired" => RegistryEntryStatus::Retired,
        "deprecated" => RegistryEntryStatus::Deprecated,
        "draft" => RegistryEntryStatus::Draft,
        _ => RegistryEntryStatus::Active,
    }
}

/// Validate enabled x-extension usage in an item tree against a registry entry lookup map.
#[wasm_bindgen(js_name = "validateExtensionUsage")]
pub fn validate_extension_usage_wasm(
    items_json: &str,
    registry_entries_json: &str,
) -> Result<String, JsError> {
    let item_values: Value = serde_json::from_str(items_json)
        .map_err(|e| JsError::new(&format!("invalid items JSON: {e}")))?;
    let items = item_values
        .as_array()
        .ok_or_else(|| JsError::new("items JSON must be an array"))?
        .iter()
        .filter_map(WasmExtensionItem::from_json)
        .collect::<Vec<_>>();
    let registry_entries: HashMap<String, Value> = serde_json::from_str(registry_entries_json)
        .map_err(|e| JsError::new(&format!("invalid registry entries JSON: {e}")))?;

    let mut registry = MapRegistry::new();
    for (name, entry) in registry_entries {
        let status = entry
            .get("status")
            .and_then(|value| value.as_str())
            .map(parse_registry_status)
            .unwrap_or(RegistryEntryStatus::Active);
        registry.add(RegistryEntryInfo {
            name: name.clone(),
            status,
            display_name: entry
                .get("displayName")
                .and_then(|value| value.as_str())
                .map(String::from),
            deprecation_notice: entry
                .get("deprecationNotice")
                .and_then(|value| value.as_str())
                .map(String::from),
        });
    }

    let issues = validate_extension_usage(&items, &registry);
    let json = serde_json::json!(
        issues
            .iter()
            .map(|issue| serde_json::json!({
                "path": issue.path,
                "extension": issue.extension,
                "severity": match issue.severity {
                    ExtensionSeverity::Error => "error",
                    ExtensionSeverity::Warning => "warning",
                    ExtensionSeverity::Info => "info",
                },
                "code": match issue.code {
                    ExtensionErrorCode::UnresolvedExtension => "UNRESOLVED_EXTENSION",
                    ExtensionErrorCode::ExtensionRetired => "EXTENSION_RETIRED",
                    ExtensionErrorCode::ExtensionDeprecated => "EXTENSION_DEPRECATED",
                },
                "message": issue.message,
            }))
            .collect::<Vec<_>>()
    );
    serde_json::to_string(&json).map_err(|e| JsError::new(&e.to_string()))
}
