//! `serde_json::Value` projection for lint results (WASM / Python FFI).

use serde_json::{json, Map, Value};

use formspec_core::JsonWireStyle;

use crate::{LintResult, LintSeverity};

/// Serialize a [`LintResult`] for host bindings.
pub fn lint_result_to_json_value(result: &LintResult, style: JsonWireStyle) -> Value {
    let doc_type_key = match style {
        JsonWireStyle::JsCamel => "documentType",
        JsonWireStyle::PythonSnake => "document_type",
    };
    let diagnostics: Vec<Value> = result
        .diagnostics
        .iter()
        .map(|d| {
            json!({
                "code": d.code,
                "pass": d.pass,
                "severity": match d.severity {
                    LintSeverity::Error => "error",
                    LintSeverity::Warning => "warning",
                    LintSeverity::Info => "info",
                },
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
