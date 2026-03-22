//! JSON and FEL conversion helpers shared by wasm_bindgen modules.

use std::collections::HashMap;

use fel_core::{Dependencies, FelValue, FormspecEnvironment, json_to_fel};
use formspec_core::normalize_indexed_path;
use formspec_core::registry_client;
use serde_json::Value;

pub(crate) fn json_item_at_path<'a>(items: &'a [Value], path: &str) -> Option<&'a Value> {
    let normalized = normalize_indexed_path(path);
    let segments: Vec<&str> = normalized
        .split('.')
        .filter(|segment| !segment.is_empty())
        .collect();
    if segments.is_empty() {
        return None;
    }

    let mut current_items = items;
    for (index, segment) in segments.iter().enumerate() {
        let found = current_items
            .iter()
            .find(|item| item.get("key").and_then(Value::as_str) == Some(*segment))?;
        if index == segments.len() - 1 {
            return Some(found);
        }
        current_items = found.get("children").and_then(Value::as_array)?;
    }
    None
}

pub(crate) fn json_item_location_at_path<'a>(
    items: &'a [Value],
    path: &str,
) -> Option<(usize, &'a Value)> {
    let normalized = normalize_indexed_path(path);
    let segments: Vec<&str> = normalized
        .split('.')
        .filter(|segment| !segment.is_empty())
        .collect();
    if segments.is_empty() {
        return None;
    }

    let mut current_items = items;
    for (depth, segment) in segments.iter().enumerate() {
        let index = current_items
            .iter()
            .position(|item| item.get("key").and_then(Value::as_str) == Some(*segment))?;
        let item = &current_items[index];
        if depth == segments.len() - 1 {
            return Some((index, item));
        }
        current_items = item.get("children").and_then(Value::as_array)?;
    }
    None
}

pub(crate) fn json_to_field_map(val: &Value) -> HashMap<String, FelValue> {
    let mut map = HashMap::new();
    if let Some(obj) = val.as_object() {
        for (k, v) in obj {
            map.insert(k.clone(), json_to_fel(v));
        }
    }
    map
}

pub(crate) fn deps_to_json(deps: &Dependencies) -> Value {
    serde_json::json!({
        "fields": deps.fields.iter().collect::<Vec<_>>(),
        "contextRefs": deps.context_refs.iter().collect::<Vec<_>>(),
        "instanceRefs": deps.instance_refs.iter().collect::<Vec<_>>(),
        "mipDeps": deps.mip_deps.iter().collect::<Vec<_>>(),
        "hasSelfRef": deps.has_self_ref,
        "hasWildcard": deps.has_wildcard,
        "usesPrevNext": deps.uses_prev_next,
    })
}

pub(crate) fn lint_result_to_json(result: &formspec_lint::LintResult) -> Value {
    serde_json::json!({
        "documentType": result.document_type.map(|dt| dt.schema_key().to_string()),
        "valid": result.valid,
        "diagnostics": result.diagnostics.iter().map(|d| serde_json::json!({
            "code": d.code,
            "pass": d.pass,
            "severity": match d.severity {
                formspec_lint::LintSeverity::Error => "error",
                formspec_lint::LintSeverity::Warning => "warning",
                formspec_lint::LintSeverity::Info => "info",
            },
            "path": d.path,
            "message": d.message,
        })).collect::<Vec<_>>(),
    })
}

pub(crate) fn push_repeat_context(env: &mut FormspecEnvironment, repeat: &Value, depth: u8) {
    if depth > 32 {
        return;
    }
    let Some(obj) = repeat.as_object() else {
        return;
    };

    if let Some(parent) = obj.get("parent") {
        push_repeat_context(env, parent, depth + 1);
    }

    let current = obj
        .get("current")
        .map(json_to_fel)
        .unwrap_or(FelValue::Null);
    let index = obj.get("index").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
    let count = obj.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let collection = obj
        .get("collection")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(json_to_fel).collect())
        .unwrap_or_default();
    env.push_repeat(current, index, count, collection);
}

pub(crate) fn parse_status_str(s: &str) -> Option<formspec_core::RegistryEntryStatus> {
    match s {
        "draft" => Some(formspec_core::RegistryEntryStatus::Draft),
        "stable" | "active" => Some(formspec_core::RegistryEntryStatus::Active),
        "deprecated" => Some(formspec_core::RegistryEntryStatus::Deprecated),
        "retired" => Some(formspec_core::RegistryEntryStatus::Retired),
        _ => None,
    }
}

pub(crate) fn status_to_str(s: formspec_core::RegistryEntryStatus) -> &'static str {
    match s {
        formspec_core::RegistryEntryStatus::Draft => "draft",
        formspec_core::RegistryEntryStatus::Active => "stable",
        formspec_core::RegistryEntryStatus::Deprecated => "deprecated",
        formspec_core::RegistryEntryStatus::Retired => "retired",
    }
}

pub(crate) fn category_to_str(c: registry_client::ExtensionCategory) -> &'static str {
    match c {
        registry_client::ExtensionCategory::DataType => "dataType",
        registry_client::ExtensionCategory::Function => "function",
        registry_client::ExtensionCategory::Constraint => "constraint",
        registry_client::ExtensionCategory::Property => "property",
        registry_client::ExtensionCategory::Namespace => "namespace",
    }
}
