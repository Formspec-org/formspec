//! Key extraction from recorded changeset entries.
//!
//! Each entry may *create* keys (e.g. `definition.addItem`) and *reference*
//! keys (e.g. `definition.addBind`, FEL `$field` refs). These relationships
//! drive the dependency graph in [`crate::graph`].

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

/// Keys that an entry creates and references.
#[derive(Debug, Clone, Default)]
pub struct EntryKeys {
    /// Keys this entry creates (e.g. new item keys).
    pub creates: Vec<String>,
    /// Keys this entry references (paths, field refs from FEL, etc.).
    pub references: Vec<String>,
}

// ── FEL $-reference regex ────────────────────────────────────────────

/// Matches `$identifier` in FEL expressions. Captures the identifier name.
static FEL_REF_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\$([a-zA-Z_][a-zA-Z0-9_]*)").unwrap());

/// Extract `$field` references from a string that may contain FEL expressions.
fn extract_fel_refs(s: &str) -> Vec<String> {
    FEL_REF_RE
        .captures_iter(s)
        .map(|c| c[1].to_string())
        .collect()
}

/// Recursively scan a JSON value for strings and extract FEL `$field` references.
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

/// Build a full path from an optional `parentPath` and a `key`.
fn full_path(parent_path: Option<&str>, key: &str) -> String {
    match parent_path {
        Some(p) if !p.is_empty() => format!("{p}.{key}"),
        _ => key.to_string(),
    }
}

/// Extract the path leaf segment (last dot-separated component, without indices).
fn path_leaf(path: &str) -> &str {
    let last_segment = path.rsplit('.').next().unwrap_or(path);
    // Strip any trailing bracket notation (e.g. "field[0]" → "field")
    last_segment.split('[').next().unwrap_or(last_segment)
}

/// Extract created and referenced keys from a single entry.
pub fn extract_keys(entry: &RecordedEntry) -> EntryKeys {
    let mut keys = EntryKeys::default();

    for phase in &entry.commands {
        for cmd in phase {
            extract_command_keys(cmd, &mut keys);
        }
    }

    // Deduplicate
    keys.creates.sort();
    keys.creates.dedup();
    keys.references.sort();
    keys.references.dedup();

    keys
}

/// Process a single command for key extraction.
fn extract_command_keys(cmd: &RecordedCommand, keys: &mut EntryKeys) {
    let payload = &cmd.payload;

    match cmd.cmd_type.as_str() {
        // ── Creates ──────────────────────────────────────────────
        "definition.addItem" => {
            if let Some(key) = payload.get("key").and_then(Value::as_str) {
                let parent = payload.get("parentPath").and_then(Value::as_str);
                keys.creates.push(full_path(parent, key));
            }
        }

        // ── References (path-based) ─────────────────────────────
        "definition.addBind" | "definition.addShape" | "definition.setBind"
        | "definition.setItemProperty" => {
            if let Some(path) = payload.get("path").and_then(Value::as_str) {
                keys.references.push(path_leaf(path).to_string());
            }
            // Scan bind properties / value for FEL $-refs
            if let Some(props) = payload.get("properties") {
                scan_value_for_fel_refs(props, &mut keys.references);
            }
            if let Some(value) = payload.get("value") {
                scan_value_for_fel_refs(value, &mut keys.references);
            }
        }

        // ── References (fieldKey-based) ─────────────────────────
        "component.setFieldWidget" => {
            if let Some(fk) = payload.get("fieldKey").and_then(Value::as_str) {
                keys.references.push(path_leaf(fk).to_string());
            }
        }

        // ── References (node bind) ──────────────────────────────
        "component.addNode" => {
            if let Some(bind) = payload
                .get("node")
                .and_then(|n| n.get("bind"))
                .and_then(Value::as_str)
            {
                keys.references.push(path_leaf(bind).to_string());
            }
        }

        // All other commands — scan entire payload for FEL $-refs
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
        RecordedEntry {
            commands,
            tool_name: None,
        }
    }

    fn cmd(cmd_type: &str, payload: Value) -> RecordedCommand {
        RecordedCommand {
            cmd_type: cmd_type.to_string(),
            payload,
        }
    }

    #[test]
    fn add_item_creates_key() {
        let e = entry(vec![vec![cmd(
            "definition.addItem",
            json!({"key": "email", "type": "text"}),
        )]]);
        let keys = extract_keys(&e);
        assert_eq!(keys.creates, vec!["email"]);
        assert!(keys.references.is_empty());
    }

    #[test]
    fn add_item_with_parent_path() {
        let e = entry(vec![vec![cmd(
            "definition.addItem",
            json!({"key": "street", "parentPath": "address", "type": "text"}),
        )]]);
        let keys = extract_keys(&e);
        assert_eq!(keys.creates, vec!["address.street"]);
    }

    #[test]
    fn add_bind_references_path() {
        let e = entry(vec![vec![cmd(
            "definition.addBind",
            json!({"path": "email", "properties": {"required": true}}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.creates.is_empty());
        assert!(keys.references.contains(&"email".to_string()));
    }

    #[test]
    fn set_bind_with_fel_refs() {
        let e = entry(vec![vec![cmd(
            "definition.setBind",
            json!({"path": "total", "properties": {"calculate": "$price * $quantity"}}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"total".to_string()));
        assert!(keys.references.contains(&"price".to_string()));
        assert!(keys.references.contains(&"quantity".to_string()));
    }

    #[test]
    fn component_set_field_widget_references_key() {
        let e = entry(vec![vec![cmd(
            "component.setFieldWidget",
            json!({"fieldKey": "email", "widget": "email-input"}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"email".to_string()));
    }

    #[test]
    fn component_add_node_with_bind() {
        let e = entry(vec![vec![cmd(
            "component.addNode",
            json!({"pageIndex": 0, "node": {"bind": "email", "type": "input"}}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"email".to_string()));
    }

    #[test]
    fn deduplicates_references() {
        let e = entry(vec![vec![
            cmd(
                "definition.setBind",
                json!({"path": "total", "properties": {"calculate": "$price + $price"}}),
            ),
        ]]);
        let keys = extract_keys(&e);
        // "price" should appear once even though it's referenced twice
        assert_eq!(
            keys.references.iter().filter(|r| r.as_str() == "price").count(),
            1
        );
    }

    #[test]
    fn multiple_phases() {
        let e = entry(vec![
            vec![cmd(
                "definition.addItem",
                json!({"key": "name", "type": "text"}),
            )],
            vec![cmd(
                "definition.addBind",
                json!({"path": "name", "properties": {"required": true}}),
            )],
        ]);
        let keys = extract_keys(&e);
        assert_eq!(keys.creates, vec!["name"]);
        assert!(keys.references.contains(&"name".to_string()));
    }

    #[test]
    fn add_shape_references_path() {
        let e = entry(vec![vec![cmd(
            "definition.addShape",
            json!({"path": "items[*].price", "rule": {"min": 0}}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"price".to_string()));
    }

    #[test]
    fn set_item_property_references_path() {
        let e = entry(vec![vec![cmd(
            "definition.setItemProperty",
            json!({"path": "email", "property": "label", "value": "Email Address"}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"email".to_string()));
    }

    #[test]
    fn unknown_command_scans_for_fel_refs() {
        let e = entry(vec![vec![cmd(
            "definition.setRouteProperty",
            json!({"index": 0, "property": "condition", "value": "$age >= 18"}),
        )]]);
        let keys = extract_keys(&e);
        assert!(keys.references.contains(&"age".to_string()));
    }
}
