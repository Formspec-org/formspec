//! Pass 3: Reference validation — checks bind paths and shape targets resolve against the item tree.
//!
//! Uses [`ItemTreeIndex`] from pass 2 for path resolution. Emits:
//! - **E300**: Bind path references an unknown item
//! - **E301**: Shape target references an unknown item
//! - **E302**: Item's `optionSet` references an undefined option set
//! - **W300**: Item's `dataType` is incompatible with `optionSet`

use std::collections::HashSet;

use serde_json::Value;

use crate::tree::ItemTreeIndex;
use crate::types::LintDiagnostic;

/// Data types compatible with optionSets.
const OPTION_SET_COMPATIBLE_TYPES: &[&str] = &[
    "string", "integer", "decimal", "choice", "multiChoice",
];

/// Run pass 3 reference checks against an already-built item tree index.
pub fn check_references(document: &Value, index: &ItemTreeIndex) -> Vec<LintDiagnostic> {
    let mut diagnostics = Vec::new();

    check_bind_paths(document, index, &mut diagnostics);
    check_shape_targets(document, index, &mut diagnostics);
    check_option_sets(document, index, &mut diagnostics);

    diagnostics
}

// ── Bind paths (E300) ──────────────────────────────────────────

fn check_bind_paths(
    document: &Value,
    index: &ItemTreeIndex,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let binds = match document.get("binds").and_then(|v| v.as_object()) {
        Some(b) => b,
        None => return,
    };

    for bind_key in binds.keys() {
        let json_path = format!("$.binds.{bind_key}");
        if let Some(diag) = validate_path(bind_key, &json_path, "Bind", "E300", index) {
            diagnostics.push(diag);
        }
    }
}

// ── Shape targets (E301) ──────────────────────────────────────

fn check_shape_targets(
    document: &Value,
    index: &ItemTreeIndex,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let shapes = match document.get("shapes").and_then(|v| v.as_array()) {
        Some(s) => s,
        None => return,
    };

    for (i, shape) in shapes.iter().enumerate() {
        let target = match shape.get("target").and_then(|v| v.as_str()) {
            Some(t) => t,
            None => continue,
        };

        // "#" is the form root — always valid
        if target == "#" {
            continue;
        }

        let json_path = format!("$.shapes[{i}].target");
        if let Some(diag) = validate_path(target, &json_path, "Shape target", "E301", index) {
            diagnostics.push(diag);
        }
    }
}

// ── OptionSet references (E302 / W300) ────────────────────────

fn check_option_sets(
    document: &Value,
    _index: &ItemTreeIndex,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let defined_sets = collect_defined_option_sets(document);

    // Walk raw items to read optionSet — the index stores dataType but not optionSet.
    let items = match document.get("items").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return,
    };

    walk_items_for_option_sets(items, &defined_sets, "$", diagnostics);
}

fn walk_items_for_option_sets(
    items: &[Value],
    defined_sets: &HashSet<String>,
    json_prefix: &str,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for (i, item) in items.iter().enumerate() {
        if item.get("key").and_then(|v| v.as_str()).is_none() {
            continue;
        }

        let json_path = format!("{json_prefix}[{i}]");

        if let Some(option_set_ref) = item.get("optionSet").and_then(|v| v.as_str()) {
            // E302: optionSet not found
            if !defined_sets.contains(option_set_ref) {
                diagnostics.push(LintDiagnostic::error(
                    "E302",
                    3,
                    format!("{json_path}.optionSet"),
                    format!("optionSet references undefined set: {option_set_ref}"),
                ));
            }

            // W300: incompatible dataType
            if let Some(data_type) = item.get("dataType").and_then(|v| v.as_str()) {
                if !OPTION_SET_COMPATIBLE_TYPES.contains(&data_type) {
                    diagnostics.push(LintDiagnostic::warning(
                        "W300",
                        3,
                        format!("{json_path}.dataType"),
                        format!(
                            "dataType '{data_type}' is not compatible with optionSet \
                             (expected one of: {})",
                            OPTION_SET_COMPATIBLE_TYPES.join(", ")
                        ),
                    ));
                }
            }
        }

        if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
            walk_items_for_option_sets(children, defined_sets, &format!("{json_path}.children"), diagnostics);
        }
    }
}

fn collect_defined_option_sets(document: &Value) -> HashSet<String> {
    let mut names = HashSet::new();
    if let Some(obj) = document.get("optionSets").and_then(|v| v.as_object()) {
        for key in obj.keys() {
            names.insert(key.clone());
        }
    }
    names
}

// ── Path resolution ───────────────────────────────────────────

/// Validate a single path (bind key or shape target) against the item tree index.
/// Returns `Some(diagnostic)` if the path is invalid, `None` if it resolves.
fn validate_path(
    path: &str,
    json_path: &str,
    label: &str,
    error_code: &str,
    index: &ItemTreeIndex,
) -> Option<LintDiagnostic> {
    if path.contains("[*]") {
        validate_wildcard_path(path, json_path, label, error_code, index)
    } else if path.contains('.') {
        validate_dotted_path(path, json_path, label, error_code, index)
    } else {
        validate_simple_key(path, json_path, label, error_code, index)
    }
}

/// Simple key: look up in `by_key` (unless ambiguous) or `by_full_path`.
fn validate_simple_key(
    key: &str,
    json_path: &str,
    label: &str,
    error_code: &str,
    index: &ItemTreeIndex,
) -> Option<LintDiagnostic> {
    if index.by_full_path.contains_key(key) {
        return None;
    }
    if !index.ambiguous_keys.contains(key) && index.by_key.contains_key(key) {
        return None;
    }
    Some(LintDiagnostic::error(
        error_code,
        3,
        json_path,
        format!("{label} references unknown item: {key}"),
    ))
}

/// Dotted path (e.g., `address.street`): try full_path first, then check base key exists.
fn validate_dotted_path(
    path: &str,
    json_path: &str,
    label: &str,
    error_code: &str,
    index: &ItemTreeIndex,
) -> Option<LintDiagnostic> {
    // Exact match on full dotted path
    if index.by_full_path.contains_key(path) {
        return None;
    }

    // Fallback: check that the base key (first segment) exists
    let base_key = path.split('.').next().unwrap_or(path);
    if index.by_key.contains_key(base_key) || index.by_full_path.contains_key(base_key) {
        return None;
    }

    Some(LintDiagnostic::error(
        error_code,
        3,
        json_path,
        format!("{label} references unknown item: {path}"),
    ))
}

/// Wildcard path (e.g., `lines[*].amount`):
/// 1. Group before `[*]` must exist and be in `repeatable_groups`
/// 2. Remainder after `[*].` must resolve as a child of that group
fn validate_wildcard_path(
    path: &str,
    json_path: &str,
    label: &str,
    error_code: &str,
    index: &ItemTreeIndex,
) -> Option<LintDiagnostic> {
    let parts: Vec<&str> = path.splitn(2, "[*]").collect();
    if parts.len() != 2 {
        return None;
    }

    let group_path = parts[0];
    let remainder = parts[1].trim_start_matches('.');

    // Resolve the group: try full_path first, then by_key
    let group_ref = index
        .by_full_path
        .get(group_path)
        .or_else(|| index.by_key.get(group_path));

    let group_ref = match group_ref {
        Some(r) => r,
        None => {
            return Some(LintDiagnostic::error(
                error_code,
                3,
                json_path,
                format!("{label} references unknown group: {group_path}"),
            ));
        }
    };

    // The group must be repeatable
    if !index.repeatable_groups.contains(&group_ref.full_path) {
        return Some(LintDiagnostic::error(
            error_code,
            3,
            json_path,
            format!("{label} uses wildcard on non-repeatable group: {group_path}"),
        ));
    }

    // If there's a remainder, check it resolves as a child of the group
    if !remainder.is_empty() {
        let child_full_path = format!("{}.{remainder}", group_ref.full_path);
        // Try exact full path match for the child
        if index.by_full_path.contains_key(&child_full_path) {
            return None;
        }

        // Fallback: check the first segment of the remainder exists as a key
        // and is a child of this group (its parent_full_path matches the group)
        let remainder_base = remainder.split('.').next().unwrap_or(remainder);
        let is_child = index.by_key.get(remainder_base).is_some_and(|item_ref| {
            item_ref
                .parent_full_path
                .as_deref()
                == Some(&group_ref.full_path)
        });

        if !is_child {
            return Some(LintDiagnostic::error(
                error_code,
                3,
                json_path,
                format!(
                    "{label} wildcard remainder '{remainder}' not found in group '{group_path}'"
                ),
            ));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tree::build_item_index;
    use serde_json::json;

    // Helper: build index + run check_references
    fn lint(doc: &Value) -> Vec<LintDiagnostic> {
        let index = build_item_index(doc);
        check_references(doc, &index)
    }

    fn codes(diags: &[LintDiagnostic]) -> Vec<&str> {
        diags.iter().map(|d| d.code.as_str()).collect()
    }

    // ── 1. Valid simple bind path — no E300 ───────────────────

    #[test]
    fn valid_simple_bind_path_no_e300() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }],
            "binds": { "name": { "required": "true" } }
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E300"),
            "Valid bind path should not emit E300"
        );
    }

    // ── 2. Unresolved bind path — E300 ────────────────────────

    #[test]
    fn unresolved_bind_path_emits_e300() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }],
            "binds": { "nonexistent": { "required": "true" } }
        });
        let diags = lint(&doc);
        let e300: Vec<_> = diags.iter().filter(|d| d.code == "E300").collect();
        assert_eq!(e300.len(), 1);
        assert!(e300[0].message.contains("nonexistent"));
        assert_eq!(e300[0].path, "$.binds.nonexistent");
    }

    // ── 3. Valid dotted path — no E300 ────────────────────────

    #[test]
    fn valid_dotted_bind_path_no_e300() {
        let doc = json!({
            "items": [{
                "key": "address",
                "children": [{ "key": "street", "dataType": "string" }]
            }],
            "binds": { "address.street": { "required": "true" } }
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E300"),
            "Valid dotted path should not emit E300"
        );
    }

    // ── 4. Valid wildcard path on repeatable group — no E300 ──

    #[test]
    fn valid_wildcard_on_repeatable_group_no_e300() {
        let doc = json!({
            "items": [{
                "key": "lines",
                "repeat": { "min": 1, "max": 10 },
                "children": [{ "key": "amount", "dataType": "decimal" }]
            }],
            "binds": { "lines[*].amount": { "required": "true" } }
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E300"),
            "Wildcard on repeatable group with valid child should not emit E300"
        );
    }

    // ── 5. Wildcard on non-repeatable group — E300 ────────────

    #[test]
    fn wildcard_on_non_repeatable_group_emits_e300() {
        let doc = json!({
            "items": [{
                "key": "personal",
                "children": [{ "key": "name", "dataType": "string" }]
            }],
            "binds": { "personal[*].name": { "required": "true" } }
        });
        let diags = lint(&doc);
        let e300: Vec<_> = diags.iter().filter(|d| d.code == "E300").collect();
        assert_eq!(e300.len(), 1);
        assert!(e300[0].message.contains("non-repeatable"));
    }

    // ── 6. Wildcard with unknown child — E300 ─────────────────

    #[test]
    fn wildcard_with_unknown_child_emits_e300() {
        let doc = json!({
            "items": [{
                "key": "lines",
                "repeat": { "min": 1 },
                "children": [{ "key": "amount", "dataType": "decimal" }]
            }],
            "binds": { "lines[*].nonexistent": { "required": "true" } }
        });
        let diags = lint(&doc);
        let e300: Vec<_> = diags.iter().filter(|d| d.code == "E300").collect();
        assert_eq!(e300.len(), 1);
        assert!(e300[0].message.contains("nonexistent"));
    }

    // ── 7. Valid shape target — no E301 ───────────────────────

    #[test]
    fn valid_shape_target_no_e301() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }],
            "shapes": [{ "target": "name", "constraint": "$name != ''" }]
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E301"),
            "Valid shape target should not emit E301"
        );
    }

    // ── 8. Unresolved shape target — E301 ─────────────────────

    #[test]
    fn unresolved_shape_target_emits_e301() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }],
            "shapes": [{ "target": "missing_field", "constraint": "$name != ''" }]
        });
        let diags = lint(&doc);
        let e301: Vec<_> = diags.iter().filter(|d| d.code == "E301").collect();
        assert_eq!(e301.len(), 1);
        assert!(e301[0].message.contains("missing_field"));
        assert_eq!(e301[0].path, "$.shapes[0].target");
    }

    // ── 9. Shape target "#" (form root) — no E301 ────────────

    #[test]
    fn shape_target_form_root_no_e301() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }],
            "shapes": [{ "target": "#", "constraint": "$name != ''" }]
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E301"),
            "Form root '#' should always be valid"
        );
    }

    // ── 10. E302 optionSet not found ──────────────────────────

    #[test]
    fn e302_option_set_not_found() {
        let doc = json!({
            "items": [{ "key": "color", "dataType": "choice", "optionSet": "colors" }],
            "optionSets": {
                "sizes": { "options": [{ "value": "S" }] }
            }
        });
        let diags = lint(&doc);
        let e302: Vec<_> = diags.iter().filter(|d| d.code == "E302").collect();
        assert_eq!(e302.len(), 1);
        assert!(e302[0].message.contains("colors"));
    }

    #[test]
    fn e302_option_set_found_passes() {
        let doc = json!({
            "items": [{ "key": "color", "dataType": "choice", "optionSet": "colors" }],
            "optionSets": {
                "colors": { "options": [{ "value": "red" }] }
            }
        });
        let diags = lint(&doc);
        assert!(
            !codes(&diags).contains(&"E302"),
            "Existing optionSet should not emit E302"
        );
    }

    // ── 11. W300 incompatible dataType for optionSet ──────────

    #[test]
    fn w300_incompatible_data_type() {
        let doc = json!({
            "items": [{ "key": "f", "dataType": "boolean", "optionSet": "opts" }],
            "optionSets": { "opts": { "options": [{ "value": "x" }] } }
        });
        let diags = lint(&doc);
        let w300: Vec<_> = diags.iter().filter(|d| d.code == "W300").collect();
        assert_eq!(w300.len(), 1);
        assert!(w300[0].message.contains("boolean"));
    }

    #[test]
    fn w300_compatible_types_no_warning() {
        for dt in OPTION_SET_COMPATIBLE_TYPES {
            let doc = json!({
                "items": [{ "key": "f", "dataType": dt, "optionSet": "opts" }],
                "optionSets": { "opts": { "options": [{ "value": "x" }] } }
            });
            let diags = lint(&doc);
            let w300_count = diags.iter().filter(|d| d.code == "W300").count();
            assert_eq!(
                w300_count, 0,
                "dataType '{dt}' should not trigger W300"
            );
        }
    }

    // ── Edge cases ────────────────────────────────────────────

    #[test]
    fn no_binds_or_shapes_produces_no_diagnostics() {
        let doc = json!({
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint(&doc);
        assert!(diags.is_empty());
    }

    #[test]
    fn empty_binds_produces_no_diagnostics() {
        let doc = json!({
            "items": [{ "key": "name" }],
            "binds": {}
        });
        let diags = lint(&doc);
        assert!(diags.is_empty());
    }

    #[test]
    fn wildcard_group_only_no_remainder_resolves() {
        let doc = json!({
            "items": [{
                "key": "lines",
                "repeat": { "min": 1 },
                "children": [{ "key": "amount" }]
            }],
            "binds": { "lines[*]": { "relevant": "true" } }
        });
        let diags = lint(&doc);
        // A bare wildcard with no remainder is valid if the group is repeatable
        assert!(
            !codes(&diags).contains(&"E300"),
            "Bare wildcard on repeatable group should resolve"
        );
    }

    #[test]
    fn multiple_errors_across_binds_and_shapes() {
        let doc = json!({
            "items": [{ "key": "name" }],
            "binds": { "ghost": { "required": "true" } },
            "shapes": [{ "target": "phantom", "constraint": "true" }]
        });
        let diags = lint(&doc);
        assert!(codes(&diags).contains(&"E300"));
        assert!(codes(&diags).contains(&"E301"));
    }

    #[test]
    fn nested_option_set_check() {
        let doc = json!({
            "items": [{
                "key": "group",
                "children": [{
                    "key": "nested_choice",
                    "dataType": "choice",
                    "optionSet": "missing"
                }]
            }]
        });
        let diags = lint(&doc);
        let e302: Vec<_> = diags.iter().filter(|d| d.code == "E302").collect();
        assert_eq!(e302.len(), 1, "Should find E302 in nested items");
        assert!(e302[0].message.contains("missing"));
    }

    #[test]
    fn all_diagnostics_are_pass_3() {
        let doc = json!({
            "items": [{ "key": "f", "dataType": "boolean", "optionSet": "missing" }],
            "binds": { "ghost": { "required": "true" } },
            "shapes": [{ "target": "phantom", "constraint": "true" }]
        });
        let diags = lint(&doc);
        assert!(!diags.is_empty());
        for d in &diags {
            assert_eq!(d.pass, 3, "All reference diagnostics should be pass 3, got pass {} for {}", d.pass, d.code);
        }
    }
}
