//! Runtime seeding: prePopulate instances and previous non-relevant state.
#![allow(clippy::missing_docs_in_private_items)]

use crate::types::ItemInfo;
use serde_json::Value;
use std::collections::HashMap;

/// Mark items as previously non-relevant for transition detection.
pub(crate) fn apply_previous_non_relevant(items: &mut [ItemInfo], non_relevant_paths: &[String]) {
    for item in items.iter_mut() {
        if non_relevant_paths.contains(&item.path) {
            item.prev_relevant = false;
        }
        apply_previous_non_relevant(&mut item.children, non_relevant_paths);
    }
}

/// Walk the item tree and seed missing/null field values from named instances.
pub(crate) fn seed_prepopulate_tree(
    items: &[ItemInfo],
    values: &mut HashMap<String, Value>,
    instances: &HashMap<String, Value>,
) {
    for item in items {
        seed_prepopulate(item, values, instances);
    }
}

fn seed_prepopulate(
    item: &ItemInfo,
    values: &mut HashMap<String, Value>,
    instances: &HashMap<String, Value>,
) {
    if let Some(existing) = values.get(&item.path) {
        if !existing.is_null() {
            for child in &item.children {
                seed_prepopulate(child, values, instances);
            }
            return;
        }
    }

    if let (Some(inst_name), Some(inst_path)) =
        (&item.pre_populate_instance, &item.pre_populate_path)
    {
        if let Some(instance_data) = instances.get(inst_name) {
            let val = get_by_dotted_path(instance_data, inst_path);
            if !val.is_null() {
                values.insert(item.path.clone(), val);
            }
        }
    }

    for child in &item.children {
        seed_prepopulate(child, values, instances);
    }
}

fn get_by_dotted_path(val: &Value, path: &str) -> Value {
    let mut current = val;
    for seg in path.split('.') {
        match current.get(seg) {
            Some(v) => current = v,
            None => return Value::Null,
        }
    }
    current.clone()
}

/// Walk the item tree and populate `option_values` from named instances for items with `choicesFrom`.
///
/// If the referenced instance is missing or the data at the path is not an array,
/// `option_values` remains empty (graceful degradation — no validation against options).
pub(crate) fn resolve_choices_from_instances(
    items: &mut [ItemInfo],
    instances: &HashMap<String, Value>,
) {
    for item in items.iter_mut() {
        if let Some(ref inst_name) = item.choices_from_instance {
            if let Some(instance_data) = instances.get(inst_name) {
                // Navigate to the sub-path if specified, otherwise use the root
                let target = match &item.choices_from_path {
                    Some(path) => get_by_dotted_path(instance_data, path),
                    None => instance_data.clone(),
                };

                let value_field = item
                    .choices_from_value_field
                    .as_deref()
                    .unwrap_or("value");

                if let Some(arr) = target.as_array() {
                    item.option_values = arr
                        .iter()
                        .filter_map(|entry| {
                            entry
                                .get(value_field)
                                .and_then(Value::as_str)
                                .map(String::from)
                        })
                        .collect();
                }
            }
            // If instance not found or data not an array, option_values stays empty
            // → validation accepts any string value (graceful degradation)
        }
        resolve_choices_from_instances(&mut item.children, instances);
    }
}
