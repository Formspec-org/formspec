//! `serde_json::Value` projection for lint results (WASM / Python FFI).

use serde_json::{Map, Value, json};

use formspec_core::JsonWireStyle;
use formspec_core::wire_keys::lint_document_type_key;

use crate::LintResult;

/// Serialize a [`LintResult`] for host bindings.
pub fn lint_result_to_json_value(result: &LintResult, style: JsonWireStyle) -> Value {
    let doc_type_key = lint_document_type_key(style);
    let diagnostics: Vec<Value> = result
        .diagnostics
        .iter()
        .map(|d| {
            json!({
                "code": d.code,
                "pass": d.pass,
                "severity": d.severity.as_wire_str(),
                "path": d.path,
                "message": d.message,
            })
        })
        .collect();

    let mut m = Map::new();
    m.insert(
        doc_type_key.to_string(),
        json!(result.document_type.map(|dt| dt.schema_key().to_string())),
    );
    m.insert("valid".to_string(), json!(result.valid));
    m.insert("diagnostics".to_string(), Value::Array(diagnostics));
    Value::Object(m)
}
