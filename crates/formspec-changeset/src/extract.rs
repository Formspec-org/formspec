//! Key extraction from recorded changeset entries.
//!
//! Each entry may *create* keys (e.g. `definition.addItem`), *reference*
//! keys (e.g. `definition.addBind`, FEL `$field` refs), and *target*
//! keys (mutate an existing field). These relationships drive the
//! dependency graph in [`crate::graph`].

use regex::Regex;
use serde::Deserialize;
use serde_json::Value;
use std::sync::LazyLock;

// ── Input types ──────────────────────────────────────────────────────

/// A single command recorded by the changeset middleware.
#[derive(Debug, Clone, Deserialize)]
pub struct RecordedCommand {
    /// The command type string (e.g. `"definition.addItem"`).
    #[serde(rename = "type")]
    pub cmd_type: String,
    /// The command payload (structure varies per command type).
    #[serde(default)]
    pub payload: Value,
}

/// A recorded changeset entry (one MCP tool invocation).
#[derive(Debug, Clone, Deserialize)]
pub struct RecordedEntry {
    /// Pipeline command phases captured by the middleware.
    pub commands: Vec<Vec<RecordedCommand>>,
    /// Which MCP tool triggered this entry.
    #[serde(rename = "toolName")]
    pub tool_name: Option<String>,
}

// ── Output ───────────────────────────────────────────────────────────

/// Keys that an entry creates, references, and targets.
#[derive(Debug, Clone, Default)]
pub struct EntryKeys {
    /// Keys this entry creates (e.g. new item keys).
    pub creates: Vec<String>,
    /// Keys this entry references (paths, field refs from FEL, etc.).
    pub references: Vec<String>,
    /// Keys this entry mutates (targets). Two entries targeting the same key
    /// must be in the same dependency group even if neither creates the key.
    pub targets: Vec<String>,
}

// ── FEL reference regex ──────────────────────────────────────────────

static FEL_REF_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\$([a-zA-Z_][a-zA-Z0-9_]*)").unwrap());

fn extract_fel_refs(s: &str) -> Vec<String> {
    FEL_REF_RE
        .captures_iter(s)
        .map(|c| c[1].to_string())
        .collect()
}

fn scan_value_for_fel_refs(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::String(s) => out.extend(extract_fel_refs(s)),
        Value::Array(arr) => {
            for v in arr {
                scan_value_for_fel_refs(v, out);
            }
        }
        Value::Object(map) => {
            for v in map.values() {
                scan_value_for_fel_refs(v, out);
            }
        }
        _ => {}
    }
}

// ── Key extraction ───────────────────────────────────────────────────

fn full_path(parent_path: Option<&str>, key: &str) -> String {
    match parent_path {
        Some(p) if !p.is_empty() => format!("{p}.{key}"),
        _ => key.to_string(),
    }
}

fn path_leaf(path: &str) -> &str {
    let last_segment = path.rsplit('.').next().unwrap_or(path);
    last_segment.split('[').next().unwrap_or(last_segment)
}

/// Extract created, referenced, and targeted keys from a single entry.
pub fn extract_keys(entry: &RecordedEntry) -> EntryKeys {
    let mut keys = EntryKeys::default();

    for phase in &entry.commands {
        for cmd in phase {
            extract_command_keys(cmd, &mut keys);
        }
    }

    keys.creates.sort();
    keys.creates.dedup();
    keys.references.sort();
    keys.references.dedup();
    keys.targets.sort();
    keys.targets.dedup();

    keys
}

fn extract_command_keys(cmd: &RecordedCommand, keys: &mut EntryKeys) {
    let payload = &cmd.payload;

    match cmd.cmd_type.as_str() {
        "definition.addItem" => {
            if let Some(key) = payload.get("key").and_then(Value::as_str) {
                let parent = payload.get("parentPath").and_then(Value::as_str);
                keys.creates.push(full_path(parent, key));
            }
        }

        "definition.addBind" | "definition.addShape" | "definition.setBind"
        | "definition.setItemProperty" | "definition.setFieldOptions"
        | "definition.setFieldDataType" => {
            if let Some(path) = payload.get("path").and_then(Value::as_str) {
                let leaf = path_leaf(path).to_string();
                keys.references.push(leaf.clone());
                keys.targets.push(leaf);
            }
            if let Some(props) = payload.get("properties") {
                scan_value_for_fel_refs(props, &mut keys.references);
            }
            if let Some(value) = payload.get("value") {
                scan_value_for_fel_refs(value, &mut keys.references);
            }
        }

        "definition.addVariable" => {
            if let Some(scope) = payload.get("scope").and_then(Value::as_str) {
                keys.references.push(scope.to_string());
            }
            if let Some(expr) = payload.get("expression") {
                scan_value_for_fel_refs(expr, &mut keys.references);
            }
        }

        "definition.setVariable" => {
            let prop = payload.get("property").and_then(Value::as_str);
            if prop == Some("scope") {
                if let Some(scope_key) = payload.get("value").and_then(Value::as_str) {
                    keys.references.push(scope_key.to_string());
                }
            }
            if prop == Some("expression") {
                if let Some(value) = payload.get("value") {
                    scan_value_for_fel_refs(value, &mut keys.references);
                }
            }
        }

        "component.setFieldWidget" => {
            if let Some(fk) = payload.get("fieldKey").and_then(Value::as_str) {
                keys.references.push(path_leaf(fk).to_string());
            }
        }

        "component.addNode" => {
            if let Some(bind) = payload
                .get("node")
                .and_then(|n| n.get("bind"))
                .and_then(Value::as_str)
            {
                keys.references.push(path_leaf(bind).to_string());
            }
        }

        "theme.setItemOverride" | "theme.deleteItemOverride" | "theme.setItemWidgetConfig"
        | "theme.setItemAccessibility" | "theme.setItemStyle" => {
            if let Some(ik) = payload.get("itemKey").and_then(Value::as_str) {
                keys.references.push(ik.to_string());
            }
        }

        _ => {
            scan_value_for_fel_refs(payload, &mut keys.references);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry(commands: Vec<Vec<RecordedCommand>>) -> RecordedEntry {
        RecordedEntry { commands, tool_name: None }
    }

    fn cmd(cmd_type: &str, payload: Value) -> RecordedCommand {
        RecordedCommand { cmd_type: cmd_type.to_string(), payload }
    }

    #[test] fn add_item_creates_key() {
        let e = entry(vec![vec![cmd("definition.addItem", json!({"key": "email", "type": "text"}))]]);
        let k = extract_keys(&e);
        assert_eq!(k.creates, vec!["email"]);
        assert!(k.references.is_empty());
    }

    #[test] fn add_item_with_parent_path() {
        let e = entry(vec![vec![cmd("definition.addItem", json!({"key": "street", "parentPath": "address", "type": "text"}))]]);
        assert_eq!(extract_keys(&e).creates, vec!["address.street"]);
    }

    #[test] fn add_bind_references_path() {
        let e = entry(vec![vec![cmd("definition.addBind", json!({"path": "email", "properties": {"required": true}}))]]);
        let k = extract_keys(&e);
        assert!(k.creates.is_empty());
        assert!(k.references.contains(&"email".to_string()));
    }

    #[test] fn set_bind_with_fel_refs() {
        let e = entry(vec![vec![cmd("definition.setBind", json!({"path": "total", "properties": {"calculate": "$price * $quantity"}}))]]);
        let k = extract_keys(&e);
        assert!(k.references.contains(&"total".to_string()));
        assert!(k.references.contains(&"price".to_string()));
        assert!(k.references.contains(&"quantity".to_string()));
    }

    #[test] fn component_set_field_widget_references_key() {
        let e = entry(vec![vec![cmd("component.setFieldWidget", json!({"fieldKey": "email", "widget": "email-input"}))]]);
        assert!(extract_keys(&e).references.contains(&"email".to_string()));
    }

    #[test] fn component_add_node_with_bind() {
        let e = entry(vec![vec![cmd("component.addNode", json!({"pageIndex": 0, "node": {"bind": "email", "type": "input"}}))]]);
        assert!(extract_keys(&e).references.contains(&"email".to_string()));
    }

    #[test] fn deduplicates_references() {
        let e = entry(vec![vec![cmd("definition.setBind", json!({"path": "total", "properties": {"calculate": "$price + $price"}}))]]);
        assert_eq!(extract_keys(&e).references.iter().filter(|r| r.as_str() == "price").count(), 1);
    }

    #[test] fn multiple_phases() {
        let e = entry(vec![
            vec![cmd("definition.addItem", json!({"key": "name", "type": "text"}))],
            vec![cmd("definition.addBind", json!({"path": "name", "properties": {"required": true}}))],
        ]);
        let k = extract_keys(&e);
        assert_eq!(k.creates, vec!["name"]);
        assert!(k.references.contains(&"name".to_string()));
    }

    #[test] fn add_shape_references_path() {
        let e = entry(vec![vec![cmd("definition.addShape", json!({"path": "items[*].price", "rule": {"min": 0}}))]]);
        assert!(extract_keys(&e).references.contains(&"price".to_string()));
    }

    #[test] fn set_item_property_references_path() {
        let e = entry(vec![vec![cmd("definition.setItemProperty", json!({"path": "email", "property": "label", "value": "Email Address"}))]]);
        assert!(extract_keys(&e).references.contains(&"email".to_string()));
    }

    #[test] fn unknown_command_scans_for_fel_refs() {
        let e = entry(vec![vec![cmd("definition.setRouteProperty", json!({"index": 0, "property": "condition", "value": "$age >= 18"}))]]);
        assert!(extract_keys(&e).references.contains(&"age".to_string()));
    }

    // Edge #1: Variable scope
    #[test] fn add_variable_with_scope_references_key() {
        let e = entry(vec![vec![cmd("definition.addVariable", json!({"name": "s", "expression": "42", "scope": "address"}))]]);
        assert!(extract_keys(&e).references.contains(&"address".to_string()));
    }

    #[test] fn add_variable_with_fel_expression() {
        let e = entry(vec![vec![cmd("definition.addVariable", json!({"name": "t", "expression": "$price * $qty"}))]]);
        let k = extract_keys(&e);
        assert!(k.references.contains(&"price".to_string()));
        assert!(k.references.contains(&"qty".to_string()));
    }

    #[test] fn set_variable_scope_references_key() {
        let e = entry(vec![vec![cmd("definition.setVariable", json!({"name": "v1", "property": "scope", "value": "demographics"}))]]);
        assert!(extract_keys(&e).references.contains(&"demographics".to_string()));
    }

    #[test] fn set_variable_expression_references_fel() {
        let e = entry(vec![vec![cmd("definition.setVariable", json!({"name": "v1", "property": "expression", "value": "$a + $b"}))]]);
        let k = extract_keys(&e);
        assert!(k.references.contains(&"a".to_string()));
        assert!(k.references.contains(&"b".to_string()));
    }

    // Edges #2/#3/#4: Same-target
    #[test] fn set_item_property_records_target() {
        let e = entry(vec![vec![cmd("definition.setItemProperty", json!({"path": "color", "property": "optionSet", "value": "colors"}))]]);
        assert!(extract_keys(&e).targets.contains(&"color".to_string()));
    }

    #[test] fn set_field_options_records_target() {
        let e = entry(vec![vec![cmd("definition.setFieldOptions", json!({"path": "color", "options": [{"value": "red", "label": "Red"}]}))]]);
        assert!(extract_keys(&e).targets.contains(&"color".to_string()));
    }

    #[test] fn set_bind_records_target() {
        let e = entry(vec![vec![cmd("definition.setBind", json!({"path": "total", "properties": {"calculate": "$a + $b"}}))]]);
        assert!(extract_keys(&e).targets.contains(&"total".to_string()));
    }

    #[test] fn add_bind_records_target() {
        let e = entry(vec![vec![cmd("definition.addBind", json!({"path": "age", "properties": {"relevant": "$show_age"}}))]]);
        assert!(extract_keys(&e).targets.contains(&"age".to_string()));
    }

    // Edge #6: Theme item overrides
    #[test] fn theme_set_item_override_references_key() {
        let e = entry(vec![vec![cmd("theme.setItemOverride", json!({"itemKey": "email", "property": "widget", "value": "email-input"}))]]);
        assert!(extract_keys(&e).references.contains(&"email".to_string()));
    }

    #[test] fn theme_delete_item_override_references_key() {
        let e = entry(vec![vec![cmd("theme.deleteItemOverride", json!({"itemKey": "phone"}))]]);
        assert!(extract_keys(&e).references.contains(&"phone".to_string()));
    }
}
