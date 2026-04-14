//! Runtime mapping rule arrays and mapping documents (`wasm_bindgen`).

use formspec_core::{
    JsonWireStyle, execute_mapping, execute_mapping_doc, mapping_result_to_json_value,
    parse_mapping_direction_wire, parse_mapping_document_from_value,
    parse_mapping_rules_from_value,
};
use serde_json::Value;
use wasm_bindgen::prelude::*;

use crate::json_host::{parse_value_str, to_json_string};

#[wasm_bindgen(js_name = "executeMapping")]
pub fn execute_mapping_wasm(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, JsError> {
    execute_mapping_inner(rules_json, source_json, direction).map_err(|e| JsError::new(&e))
}

pub(crate) fn execute_mapping_inner(
    rules_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, String> {
    let rules_val: Value = parse_value_str(rules_json, "rules JSON")?;
    let source: Value = parse_value_str(source_json, "source JSON")?;
    let dir = parse_mapping_direction_wire(direction)?;
    let rules = parse_mapping_rules_from_value(&rules_val)?;
    let result = execute_mapping(&rules, &source, dir);
    let json = mapping_result_to_json_value(&result, JsonWireStyle::JsCamel);
    to_json_string(&json)
}

pub(crate) fn execute_mapping_doc_inner(
    doc_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, String> {
    let doc_val: Value = parse_value_str(doc_json, "mapping document JSON")?;
    let source: Value = parse_value_str(source_json, "source JSON")?;
    let dir = parse_mapping_direction_wire(direction)?;
    let doc = parse_mapping_document_from_value(&doc_val)?;
    let result = execute_mapping_doc(&doc, &source, dir);
    let json = mapping_result_to_json_value(&result, JsonWireStyle::JsCamel);
    to_json_string(&json)
}

#[wasm_bindgen(js_name = "executeMappingDoc")]
pub fn execute_mapping_doc_wasm(
    doc_json: &str,
    source_json: &str,
    direction: &str,
) -> Result<String, JsError> {
    execute_mapping_doc_inner(doc_json, source_json, direction).map_err(|e| JsError::new(&e))
}
