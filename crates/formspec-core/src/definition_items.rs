//! Depth-first traversal of definition `items` / `children` JSON arrays.
//!
//! Used by lint passes that need stable `$.items[0].children[1]` paths and dotted bind paths.
//! Skips array elements without a string `key` (and does not recurse into their `children`),
//! matching the lint tree index pass and option-set reference checks.

use serde_json::Value;

/// One definition item with canonical paths for diagnostics and binds.
#[derive(Debug, Clone)]
pub struct DefinitionItemVisitCtx<'a> {
    pub item: &'a Value,
    pub key: &'a str,
    /// Index of this node within its parent's `items` or `children` array.
    pub index: usize,
    /// JSONPath-style location, e.g. `$.items[0]` or `$.items[0].children[1]`.
    pub json_path: String,
    /// Dotted field path (`name`, `address.street`).
    pub dotted_path: String,
    /// Parent dotted path; `None` for top-level items under `document.items`.
    pub parent_dotted: Option<String>,
}

/// Visit every object with a string `key` under `items`, depth-first.
///
/// `json_array_parent` is the path to the **array** (no `[i]` suffix), e.g. `$.items` or
/// `$.items[0].children`.
pub fn visit_definition_items_json(
    items: &[Value],
    json_array_parent: &str,
    parent_dotted: Option<&str>,
    visitor: &mut impl FnMut(&DefinitionItemVisitCtx<'_>),
) {
    for (i, item) in items.iter().enumerate() {
        let Some(key) = item.get("key").and_then(Value::as_str) else {
            continue;
        };
        let json_path = format!("{json_array_parent}[{i}]");
        let dotted_path = match parent_dotted {
            Some(prefix) => format!("{prefix}.{key}"),
            None => key.to_string(),
        };
        let parent_dotted_owned = parent_dotted.map(str::to_string);
        visitor(&DefinitionItemVisitCtx {
            item,
            key,
            index: i,
            json_path,
            dotted_path: dotted_path.clone(),
            parent_dotted: parent_dotted_owned,
        });
        if let Some(children) = item.get("children").and_then(Value::as_array) {
            let child_parent = format!("{json_array_parent}[{i}].children");
            visit_definition_items_json(children, &child_parent, Some(&dotted_path), visitor);
        }
    }
}

/// Walk `document["items"]` when present; no-op if missing or not an array.
pub fn visit_definition_items_from_document(
    document: &Value,
    visitor: &mut impl FnMut(&DefinitionItemVisitCtx<'_>),
) {
    let Some(items) = document.get("items").and_then(Value::as_array) else {
        return;
    };
    visit_definition_items_json(items, "$.items", None, visitor);
}
