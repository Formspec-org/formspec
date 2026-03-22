//! FEL environment construction for validation: fields, variables, instances, repeat arrays, row aliases.

use std::collections::HashMap;

use fel_core::{FelValue, FormspecEnvironment, json_to_fel};
use serde_json::Value;

use crate::fel_json::json_to_runtime_fel;
use crate::rebuild::is_repeat_group_array;
use crate::recalculate::repeats::build_repeat_group_array;
use crate::types::ItemInfo;

/// Apply excludedValue="null" to the FEL environment for non-relevant items (9a).
pub(super) fn apply_excluded_values_to_env(items: &[ItemInfo], env: &mut FormspecEnvironment) {
    for item in items {
        if !item.relevant
            && let Some(ref ev) = item.excluded_value
            && ev == "null"
        {
            env.set_field(&item.path, FelValue::Null);
        }
        apply_excluded_values_to_env(&item.children, env);
    }
}

pub(crate) fn build_validation_env(
    values: &HashMap<String, Value>,
    variables: &HashMap<String, Value>,
    now_iso: Option<&str>,
    instances: &HashMap<String, Value>,
) -> FormspecEnvironment {
    let mut env = FormspecEnvironment::new();
    if let Some(now_iso) = now_iso {
        env.set_now_from_iso(now_iso);
    }
    for (k, v) in values {
        // Skip repeat group arrays — flat indexed keys exist and FEL should
        // use those instead (array path resolution uses 1-based indexing).
        if !is_repeat_group_array(v) {
            env.set_field(k, json_to_runtime_fel(v));
        }
    }
    for (name, value) in variables {
        env.set_variable(name, json_to_runtime_fel(value));
    }
    for (name, value) in instances {
        env.set_instance(name, json_to_fel(value));
    }
    env
}

pub(super) fn bind_repeat_group_arrays(
    env: &mut FormspecEnvironment,
    items: &[ItemInfo],
    values: &HashMap<String, Value>,
) -> HashMap<String, Option<FelValue>> {
    let mut saved = HashMap::new();
    for item in items {
        if item.repeatable
            && let Some(array) = build_repeat_group_array(&item.path, values)
        {
            saved.insert(item.path.clone(), env.data.get(&item.path).cloned());
            env.set_field(&item.path, json_to_runtime_fel(&array));
        }
        saved.extend(bind_repeat_group_arrays(env, &item.children, values));
    }
    saved
}

pub(super) fn restore_repeat_group_arrays(
    env: &mut FormspecEnvironment,
    saved_arrays: HashMap<String, Option<FelValue>>,
) {
    for (path, previous) in saved_arrays {
        match previous {
            Some(value) => env.set_field(&path, value),
            None => {
                env.data.remove(&path);
            }
        }
    }
}

pub(super) fn bind_sibling_aliases(
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    concrete_path: &str,
) -> HashMap<String, Option<FelValue>> {
    let Some((row_prefix, _)) = concrete_path.rsplit_once('.') else {
        return HashMap::new();
    };

    let mut saved = HashMap::new();
    let prefix = format!("{row_prefix}.");
    for (path, value) in values {
        if let Some(alias) = path.strip_prefix(&prefix)
            && !alias.contains('.')
        {
            saved.insert(alias.to_string(), env.data.get(alias).cloned());
            env.set_field(alias, json_to_runtime_fel(value));
        }
    }
    saved
}

pub(super) fn restore_sibling_aliases(
    env: &mut FormspecEnvironment,
    saved_aliases: HashMap<String, Option<FelValue>>,
) {
    for (alias, previous) in saved_aliases {
        match previous {
            Some(value) => env.set_field(&alias, value),
            None => {
                env.data.remove(&alias);
            }
        }
    }
}
