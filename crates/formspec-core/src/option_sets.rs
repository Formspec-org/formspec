//! Inline `optionSet` field references from `optionSets` (parity with TS `resolveOptionSetsOnDefinition`).

use serde_json::{Map, Value};

fn options_from_set_entry(entry: &Value) -> Value {
    match entry {
        Value::Array(_) => entry.clone(),
        Value::Object(map) => map
            .get("options")
            .filter(|v| v.is_array())
            .cloned()
            .unwrap_or_else(|| Value::Array(vec![])),
        _ => Value::Array(vec![]),
    }
}

fn visit_items(items: &mut [Value], sets: &Map<String, Value>) {
    for item in items.iter_mut() {
        let Some(obj) = item.as_object_mut() else {
            continue;
        };
        let set_key = obj
            .get("optionSet")
            .or_else(|| obj.get("option_set"))
            .and_then(|v| v.as_str());
        if let Some(name) = set_key {
            if let Some(entry) = sets.get(name) {
                obj.insert("options".to_string(), options_from_set_entry(entry));
            }
        }
        if let Some(Value::Array(children)) = obj.get_mut("children") {
            visit_items(children, sets);
        }
    }
}

/// Walk `definition.items` (recursively) and set `options` from `optionSets` / `option_sets`.
///
/// Matches `resolveOptionSetsOnDefinition` in `packages/formspec-engine/src/engine/definition-setup.ts`.
pub fn resolve_option_sets_on_definition(definition: &mut Value) {
    let sets: Map<String, Value> = {
        let Some(obj) = definition.as_object() else {
            return;
        };
        let Some(Value::Object(m)) = obj.get("optionSets").or_else(|| obj.get("option_sets")) else {
            return;
        };
        m.clone()
    };

    let Some(obj) = definition.as_object_mut() else {
        return;
    };
    let Some(Value::Array(items)) = obj.get_mut("items") else {
        return;
    };
    visit_items(items, &sets);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn inlines_array_option_set() {
        let mut def = json!({
            "items": [
                { "key": "c", "type": "field", "dataType": "choice", "optionSet": "countries" }
            ],
            "optionSets": {
                "countries": [
                    { "value": "us", "label": "US" },
                    { "value": "uk", "label": "UK" }
                ]
            }
        });
        resolve_option_sets_on_definition(&mut def);
        let opts = &def["items"][0]["options"];
        assert_eq!(opts.as_array().unwrap().len(), 2);
        assert_eq!(opts[0]["value"], json!("us"));
    }

    #[test]
    fn inlines_wrapped_options_object() {
        let mut def = json!({
            "items": [{ "key": "x", "optionSet": "s" }],
            "optionSets": {
                "s": { "options": [{ "value": "1", "label": "One" }] }
            }
        });
        resolve_option_sets_on_definition(&mut def);
        assert_eq!(def["items"][0]["options"][0]["label"], json!("One"));
    }

    #[test]
    fn unknown_option_set_leaves_item_unchanged() {
        let mut def = json!({
            "items": [{ "key": "x", "optionSet": "missing" }],
            "optionSets": {}
        });
        resolve_option_sets_on_definition(&mut def);
        assert!(def["items"][0].get("options").is_none());
    }

    #[test]
    fn nested_children_resolved() {
        let mut def = json!({
            "items": [{
                "key": "g",
                "type": "group",
                "children": [
                    { "key": "f", "type": "field", "optionSet": "a" }
                ]
            }],
            "optionSets": { "a": [{ "value": "v", "label": "L" }] }
        });
        resolve_option_sets_on_definition(&mut def);
        assert_eq!(def["items"][0]["children"][0]["options"][0]["value"], json!("v"));
    }

    #[test]
    fn snake_case_keys() {
        let mut def = json!({
            "items": [{ "key": "f", "option_set": "os" }],
            "option_sets": { "os": [{ "value": "x", "label": "X" }] }
        });
        resolve_option_sets_on_definition(&mut def);
        assert_eq!(def["items"][0]["options"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn inlines_preserves_keywords_on_options() {
        let mut def = json!({
            "items": [
                { "key": "c", "type": "field", "dataType": "choice", "optionSet": "states" }
            ],
            "optionSets": {
                "states": [
                    { "value": "ca", "label": "California", "keywords": ["CA", "Calif"] }
                ]
            }
        });
        resolve_option_sets_on_definition(&mut def);
        assert_eq!(
            def["items"][0]["options"][0]["keywords"],
            json!(["CA", "Calif"])
        );
    }
}
