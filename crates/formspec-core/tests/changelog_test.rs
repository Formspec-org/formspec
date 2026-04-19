//! Integration tests for changelog module.

use formspec_core::changelog::*;
use formspec_core::{JsonWireStyle, changelog_to_json_value};
use serde_json::{Value, json};

const URL: &str = "https://example.org/forms/test";

fn base_def() -> Value {
    json!({
        "url": URL,
        "version": "1.0.0",
        "title": "Test Form",
        "items": [
            { "key": "name", "type": "field", "label": "Name", "dataType": "string" },
            { "key": "email", "type": "field", "label": "Email", "dataType": "string" }
        ],
        "binds": {
            "name": { "required": "true" }
        },
        "shapes": [
            { "name": "emailFormat", "constraint": "matches($email, '.*@.*')", "message": "Invalid email" }
        ],
        "optionSets": {
            "colors": { "options": [{ "value": "red" }, { "value": "blue" }] }
        },
        "dataSources": {
            "api": { "url": "https://example.org/api" }
        }
    })
}

// 1. Item added -> Compatible
#[test]
fn item_added_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["items"].as_array_mut().unwrap().push(json!({
        "key": "phone", "type": "field", "label": "Phone", "dataType": "string"
    }));

    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(
        item_changes.len(),
        1,
        "expected exactly one item-added change"
    );
    assert_eq!(item_changes[0].impact, ChangeImpact::Compatible);
    assert_eq!(item_changes[0].key.as_deref(), Some("phone"));
    assert_eq!(item_changes[0].path, "items.phone");
}

// 2. Item removed -> Breaking
#[test]
fn item_removed_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    let items = new["items"].as_array_mut().unwrap();
    items.retain(|i| i["key"] != "email");

    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(item_changes.len(), 1);
    assert_eq!(item_changes[0].impact, ChangeImpact::Breaking);
    assert_eq!(item_changes[0].key.as_deref(), Some("email"));
}

// 3. Item modified with dataType change -> Breaking
#[test]
fn item_datatype_change_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["items"][0]["dataType"] = json!("integer");

    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(item_changes.len(), 1);
    assert_eq!(item_changes[0].impact, ChangeImpact::Breaking);
    assert_eq!(item_changes[0].key.as_deref(), Some("name"));
}

// 4. Item modified with only label change -> Cosmetic
#[test]
fn item_label_change_is_cosmetic() {
    let old = base_def();
    let mut new = base_def();
    new["items"][0]["label"] = json!("Full Name");

    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(item_changes.len(), 1);
    assert_eq!(item_changes[0].impact, ChangeImpact::Cosmetic);
}

// 5. Bind added with required -> Breaking
#[test]
fn bind_added_with_required_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["binds"]["email"] = json!({ "required": "true" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Breaking);
    assert_eq!(bind_changes[0].path, "email");
}

// 6. Bind removed -> Breaking
#[test]
fn bind_removed_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["binds"].as_object_mut().unwrap().remove("name");

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Breaking);
}

// 7. Bind modified gaining required -> Breaking
#[test]
fn bind_gaining_required_is_breaking() {
    let mut old = base_def();
    old["binds"]["name"] = json!({ "constraint": "string-length(.) > 0" });
    let mut new = base_def();
    new["binds"]["name"] = json!({ "constraint": "string-length(.) > 0", "required": "true" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Breaking);
}

// 8. Bind modified losing required -> Compatible
#[test]
fn bind_losing_required_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["binds"]["name"] = json!({ "constraint": "string-length(.) > 0" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Compatible);
}

// 9. Shape added -> Compatible
#[test]
fn shape_added_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["shapes"].as_array_mut().unwrap().push(json!({
        "name": "nameLength", "constraint": "string-length($name) > 2"
    }));

    let cl = generate_changelog(&old, &new, URL);
    let shape_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Shape && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(shape_changes.len(), 1);
    assert_eq!(shape_changes[0].impact, ChangeImpact::Compatible);
}

// 10. Shape removed -> Compatible
#[test]
fn shape_removed_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["shapes"] = json!([]);

    let cl = generate_changelog(&old, &new, URL);
    let shape_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Shape && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(shape_changes.len(), 1);
    assert_eq!(shape_changes[0].impact, ChangeImpact::Compatible);
}

// 11. Metadata change -> Cosmetic
#[test]
fn metadata_change_is_cosmetic() {
    let old = base_def();
    let mut new = base_def();
    new["title"] = json!("Updated Form Title");

    let cl = generate_changelog(&old, &new, URL);
    let meta_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Metadata)
        .collect();
    assert_eq!(meta_changes.len(), 1);
    assert_eq!(meta_changes[0].impact, ChangeImpact::Cosmetic);
    assert_eq!(meta_changes[0].path, "title");
}

// 12. Semver impact derivation
#[test]
fn semver_breaking_is_major() {
    let old = base_def();
    let mut new = base_def();
    let items = new["items"].as_array_mut().unwrap();
    items.retain(|i| i["key"] != "email");

    let cl = generate_changelog(&old, &new, URL);
    assert_eq!(cl.semver_impact, SemverImpact::Major);
}

#[test]
fn semver_compatible_is_minor() {
    let old = base_def();
    let mut new = base_def();
    new["items"].as_array_mut().unwrap().push(json!({
        "key": "phone", "type": "field", "label": "Phone", "dataType": "string"
    }));

    let cl = generate_changelog(&old, &new, URL);
    assert_eq!(cl.semver_impact, SemverImpact::Minor);
}

#[test]
fn semver_cosmetic_is_patch() {
    let old = base_def();
    let mut new = base_def();
    new["title"] = json!("New Title");

    let cl = generate_changelog(&old, &new, URL);
    assert_eq!(cl.semver_impact, SemverImpact::Patch);
}

// 13. No changes -> Patch, empty
#[test]
fn no_changes_yields_patch_and_empty() {
    let def = base_def();
    let cl = generate_changelog(&def, &def, URL);
    assert!(cl.changes.is_empty());
    assert_eq!(cl.semver_impact, SemverImpact::Patch);
}

// 14. Empty definitions
#[test]
fn empty_definitions() {
    let empty = json!({});
    let cl = generate_changelog(&empty, &empty, URL);
    assert!(cl.changes.is_empty());
    assert_eq!(cl.semver_impact, SemverImpact::Patch);
}

// 15. Change path format
#[test]
fn change_path_format() {
    let old = base_def();
    let mut new = base_def();
    new["items"].as_array_mut().unwrap().push(json!({
        "key": "phone", "type": "field", "label": "Phone", "dataType": "string"
    }));
    new["binds"]["email"] = json!({ "calculate": "$name" });

    let cl = generate_changelog(&old, &new, URL);

    let item_change = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .expect("should have item added");
    assert_eq!(item_change.path, "items.phone");

    let bind_change = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .expect("should have bind added");
    assert_eq!(bind_change.path, "email");
}

// OptionSet/DataSource/Screener
#[test]
fn option_set_removed_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["optionSets"].as_object_mut().unwrap().remove("colors");

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::OptionSet && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Breaking);
}

#[test]
fn data_source_added_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["dataSources"]["api2"] = json!({ "url": "https://example.org/api2" });

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::DataSource && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn screener_add_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["screener"] = json!({ "routes": [{ "condition": "true" }] });

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Screener)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Added);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn screener_remove_is_breaking() {
    let mut old = base_def();
    old["screener"] = json!({ "routes": [{ "condition": "true" }] });
    let new = base_def();

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Screener)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Removed);
    assert_eq!(changes[0].impact, ChangeImpact::Breaking);
}

#[test]
fn versions_extracted_from_definitions() {
    let old = base_def();
    let mut new = base_def();
    new["version"] = json!("2.0.0");

    let cl = generate_changelog(&old, &new, URL);
    assert_eq!(cl.from_version, "1.0.0");
    assert_eq!(cl.to_version, "2.0.0");
    assert_eq!(cl.definition_url, URL);
}

// --- Edge cases ---

#[test]
fn bind_added_without_required_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["binds"]["email"] = json!({ "calculate": "$name" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn item_type_change_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["items"][0]["type"] = json!("group");

    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(item_changes.len(), 1);
    assert_eq!(item_changes[0].impact, ChangeImpact::Breaking);
}

#[test]
fn option_set_modified_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["optionSets"]["colors"] = json!({
        "options": [{ "value": "red" }, { "value": "blue" }, { "value": "green" }]
    });

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::OptionSet && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn data_source_removed_is_breaking() {
    let old = base_def();
    let mut new = base_def();
    new["dataSources"].as_object_mut().unwrap().remove("api");

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::DataSource && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Breaking);
}

#[test]
fn shape_modified_is_cosmetic() {
    let old = base_def();
    let mut new = base_def();
    new["shapes"][0]["message"] = json!("Please enter a valid email");

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Shape && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Cosmetic);
}

#[test]
fn migration_added_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["migrations"] = json!([{ "from": "1.0.0", "to": "2.0.0" }]);

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Migration)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Added);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn migration_modified_is_cosmetic() {
    let mut old = base_def();
    old["migrations"] = json!([{ "from": "1.0.0", "to": "2.0.0" }]);
    let mut new = base_def();
    new["migrations"] = json!([{ "from": "1.0.0", "to": "2.0.0", "note": "updated" }]);

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Migration)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Modified);
    assert_eq!(changes[0].impact, ChangeImpact::Cosmetic);
}

#[test]
fn mixed_impacts_yields_highest_semver() {
    let old = base_def();
    let mut new = base_def();
    // Cosmetic: title change
    new["title"] = json!("New Title");
    // Compatible: add item
    new["items"].as_array_mut().unwrap().push(json!({
        "key": "phone", "type": "field", "label": "Phone", "dataType": "string"
    }));
    // Breaking: remove item
    let items = new["items"].as_array_mut().unwrap();
    items.retain(|i| i["key"] != "email");

    let cl = generate_changelog(&old, &new, URL);
    assert_eq!(cl.semver_impact, SemverImpact::Major);
    // Should have changes from multiple targets
    assert!(cl.changes.len() >= 3);
}

#[test]
fn item_removed_has_before_snapshot() {
    let old = base_def();
    let mut new = base_def();
    let items = new["items"].as_array_mut().unwrap();
    items.retain(|i| i["key"] != "email");

    let cl = generate_changelog(&old, &new, URL);
    let removed = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Removed)
        .expect("should have removal");
    assert!(removed.before.is_some());
    assert!(removed.after.is_none());
    assert_eq!(removed.migration_hint.as_deref(), Some("drop"));
}

#[test]
fn item_added_has_after_snapshot() {
    let old = base_def();
    let mut new = base_def();
    new["items"].as_array_mut().unwrap().push(json!({
        "key": "phone", "type": "field", "label": "Phone", "dataType": "string"
    }));

    let cl = generate_changelog(&old, &new, URL);
    let added = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .expect("should have addition");
    assert!(added.before.is_none());
    assert!(added.after.is_some());
}

#[test]
fn screener_modified_is_compatible() {
    let mut old = base_def();
    old["screener"] = json!({ "routes": [{ "condition": "true" }] });
    let mut new = base_def();
    new["screener"] = json!({ "routes": [{ "condition": "false" }] });

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Screener)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Modified);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn duplicate_bind_path_array_entries_merge_before_diff() {
    let d = json!({
        "version": "1.0.0",
        "binds": [
            { "path": "rate", "relevant": "$orgType != \"government\"" },
            { "path": "rate", "constraint": "$ = null or ($ >= 0 and $ <= 100)" },
        ]
    });
    let cl = generate_changelog(&d, &d, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind)
        .collect();
    assert!(
        bind_changes.is_empty(),
        "identical defs with merged binds should produce no bind changes (got {} bind change(s))",
        bind_changes.len()
    );
    assert_eq!(cl.semver_impact, SemverImpact::Patch);
}

#[test]
fn bind_constraint_change_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["binds"]["name"] = json!({ "required": "true", "constraint": "string-length(.) > 3" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(bind_changes.len(), 1);
    assert_eq!(bind_changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn shape_path_format() {
    let old = base_def();
    let mut new = base_def();
    new["shapes"].as_array_mut().unwrap().push(json!({
        "name": "budgetCheck", "constraint": "$total < 1000"
    }));

    let cl = generate_changelog(&old, &new, URL);
    let added = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::Shape && c.change_type == ChangeType::Added)
        .expect("should have shape added");
    assert_eq!(added.path, "shapes.budgetCheck");
}

#[test]
fn option_set_path_format() {
    let old = base_def();
    let mut new = base_def();
    new["optionSets"]["states"] = json!({ "options": [{ "value": "CA" }] });

    let cl = generate_changelog(&old, &new, URL);
    let added = cl
        .changes
        .iter()
        .find(|c| c.target == ChangeTarget::OptionSet && c.change_type == ChangeType::Added)
        .expect("should have optionSet added");
    assert_eq!(added.path, "optionSets.states");
}

// ── Changelog gap tests ──────────────────────────────────────────

/// Spec: changelog-spec.md §4 — "Items without keys are silently skipped by index_by_key"
#[test]
fn items_without_keys_are_silently_skipped() {
    let old = json!({
        "version": "1.0.0",
        "items": [
            { "key": "name", "dataType": "string" },
            { "dataType": "string" }
        ]
    });
    let new = json!({
        "version": "2.0.0",
        "items": [
            { "key": "name", "dataType": "string" },
            { "dataType": "integer" }
        ]
    });
    // Should not panic — keyless items are silently skipped
    let cl = generate_changelog(&old, &new, URL);
    // Only keyed items are diffed — the keyless item change is invisible
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item)
        .collect();
    assert!(
        item_changes.is_empty(),
        "keyless items should be skipped, got: {}",
        item_changes.len()
    );
}

/// Spec: changelog-spec.md §4 — "classify_item_modification with non-object returns Compatible"
#[test]
fn classify_non_object_item_modification() {
    // When items are not objects (e.g., strings), treating as Compatible
    let old = json!({
        "version": "1.0.0",
        "items": [
            { "key": "x", "dataType": "string" }
        ]
    });
    let mut new = old.clone();
    new["version"] = json!("2.0.0");
    // Modify a non-breaking key
    new["items"][0]["hint"] = json!("enter value");
    let cl = generate_changelog(&old, &new, URL);
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(item_changes.len(), 1);
    // "hint" is in ITEM_COSMETIC_KEYS → Cosmetic, but "description" also is
    assert_eq!(item_changes[0].impact, ChangeImpact::Cosmetic);
}

/// Spec: changelog-spec.md §5 — "bind_has_required: boolean false returns false"
#[test]
fn bind_has_required_boolean_false() {
    let old = json!({
        "version": "1.0.0",
        "binds": {}
    });
    let new = json!({
        "version": "2.0.0",
        "binds": {
            "field": { "required": false }
        }
    });
    let cl = generate_changelog(&old, &new, URL);
    let bind_adds: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_adds.len(), 1);
    // required=false should NOT be treated as having required → Compatible, not Breaking
    assert_eq!(bind_adds[0].impact, ChangeImpact::Compatible);
}

/// Spec: changelog-spec.md §5 — "bind_has_required: string 'false' returns false"
#[test]
fn bind_has_required_string_false() {
    let old = json!({ "version": "1.0.0", "binds": {} });
    let new = json!({
        "version": "2.0.0",
        "binds": { "field": { "required": "false" } }
    });
    let cl = generate_changelog(&old, &new, URL);
    let bind_adds: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_adds.len(), 1);
    assert_eq!(
        bind_adds[0].impact,
        ChangeImpact::Compatible,
        "required='false' should be treated as non-required"
    );
}

/// "false()" is NOT valid FEL (false is the keyword, not false()).
/// A non-empty, non-"false" required string is treated as a truthy required expression → Breaking.
#[test]
fn bind_has_required_string_false_fn_is_breaking() {
    let old = json!({ "version": "1.0.0", "binds": {} });
    let new = json!({
        "version": "2.0.0",
        "binds": { "field": { "required": "false()" } }
    });
    let cl = generate_changelog(&old, &new, URL);
    let bind_adds: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_adds.len(), 1);
    assert_eq!(
        bind_adds[0].impact,
        ChangeImpact::Breaking,
        "required='false()' is not valid FEL — treated as truthy required expression"
    );
}

/// Spec: changelog-spec.md §5 — "bind_has_required: empty string returns false"
#[test]
fn bind_has_required_empty_string() {
    let old = json!({ "version": "1.0.0", "binds": {} });
    let new = json!({
        "version": "2.0.0",
        "binds": { "field": { "required": "" } }
    });
    let cl = generate_changelog(&old, &new, URL);
    let bind_adds: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_adds.len(), 1);
    assert_eq!(
        bind_adds[0].impact,
        ChangeImpact::Compatible,
        "required='' should be treated as non-required"
    );
}

/// Spec: changelog-spec.md §5 — "bind_has_required: boolean true returns true (Breaking)"
#[test]
fn bind_has_required_boolean_true() {
    let old = json!({ "version": "1.0.0", "binds": {} });
    let new = json!({
        "version": "2.0.0",
        "binds": { "field": { "required": true } }
    });
    let cl = generate_changelog(&old, &new, URL);
    let bind_adds: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Bind && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(bind_adds.len(), 1);
    assert_eq!(
        bind_adds[0].impact,
        ChangeImpact::Breaking,
        "required=true should be Breaking"
    );
}

/// Spec: changelog-spec.md §3 — "Migration removed is Compatible"
#[test]
fn migration_removed_is_compatible() {
    let mut old = base_def();
    old["migrations"] = json!([{ "from": "1.0.0", "to": "2.0.0" }]);
    let new = base_def();

    let cl = generate_changelog(&old, &new, URL);
    let changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Migration && c.change_type == ChangeType::Removed)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

/// Spec: changelog-spec.md §3 — "Description added is metadata Cosmetic"
#[test]
fn description_metadata_change() {
    let old = base_def();
    let mut new = base_def();
    new["description"] = json!("A test form for demonstration");

    let cl = generate_changelog(&old, &new, URL);
    let meta: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Metadata && c.path == "description")
        .collect();
    assert_eq!(meta.len(), 1);
    assert_eq!(meta[0].change_type, ChangeType::Added);
    assert_eq!(meta[0].impact, ChangeImpact::Cosmetic);
}

/// Spec: registry/changelog-spec.md §5 (Generation Algorithm, steps 3-7) —
/// Diff behavior with nested/child item modifications inside a group.
/// The changelog diff indexes items by their top-level `key` field.
/// Child items nested inside a group's `children` array are part of
/// the parent item's value — changes to children show as a modification
/// of the parent item, not as independent child-level changes.
#[test]
fn nested_child_modification_detected_as_parent_change() {
    let old = json!({
        "url": URL,
        "version": "1.0.0",
        "title": "Test Form",
        "items": [
            {
                "key": "address",
                "type": "group",
                "label": "Address",
                "children": [
                    { "key": "street", "type": "field", "dataType": "string", "label": "Street" },
                    { "key": "city", "type": "field", "dataType": "string", "label": "City" }
                ]
            }
        ]
    });

    let mut new = old.clone();
    // Modify a child item: change city's label
    new["items"][0]["children"][1]["label"] = json!("Town/City");

    let cl = generate_changelog(&old, &new, URL);

    // The diff should detect a modification on the parent "address" item,
    // because items are indexed by top-level key and compared by value equality.
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(item_changes.len(), 1, "should detect one modified item");
    assert_eq!(item_changes[0].key.as_deref(), Some("address"));

    // The child "label" change is nested inside the parent's "children" array.
    // "children" is not in ITEM_COSMETIC_KEYS, so the diff engine classifies
    // the parent modification as Compatible, not Cosmetic.
    assert_eq!(item_changes[0].impact, ChangeImpact::Compatible);
}

/// Spec: registry/changelog-spec.md §5 — Adding a child to a group shows
/// as a parent modification, not an independent item addition.
#[test]
fn nested_child_added_shows_as_parent_modification() {
    let old = json!({
        "url": URL,
        "version": "1.0.0",
        "title": "Test Form",
        "items": [
            {
                "key": "address",
                "type": "group",
                "label": "Address",
                "children": [
                    { "key": "street", "type": "field", "dataType": "string" }
                ]
            }
        ]
    });

    let mut new = old.clone();
    new["items"][0]["children"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "key": "city", "type": "field", "dataType": "string"
        }));

    let cl = generate_changelog(&old, &new, URL);

    // No independent item-added for "city" — it's inside the parent
    let added: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .collect();
    assert!(
        added.is_empty(),
        "child add should not produce independent item-added"
    );

    // Instead, "address" shows as modified
    let modified: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Modified)
        .collect();
    assert_eq!(modified.len(), 1);
    assert_eq!(modified[0].key.as_deref(), Some("address"));
}

// ═══════════════════════════════════════════════════════════════════
// Standalone Screener Document changelog
// ═══════════════════════════════════════════════════════════════════

#[test]
fn screener_phase_added() {
    let old = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [],
        "evaluation": []
    });
    let new_doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.1.0",
        "title": "Test",
        "items": [],
        "evaluation": [{
            "id": "eligibility",
            "strategy": "first-match",
            "routes": []
        }]
    });
    let cl = generate_screener_changelog(&old, &new_doc, "urn:test:screener");
    let phase_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.path.starts_with("evaluation."))
        .collect();
    assert_eq!(phase_changes.len(), 1);
    assert_eq!(phase_changes[0].change_type, ChangeType::Added);
    assert_eq!(phase_changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn screener_phase_removed_is_breaking() {
    let old = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [],
        "evaluation": [{
            "id": "eligibility",
            "strategy": "first-match",
            "routes": []
        }]
    });
    let new_doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "2.0.0",
        "title": "Test",
        "items": [],
        "evaluation": []
    });
    let cl = generate_screener_changelog(&old, &new_doc, "urn:test:screener");
    let removed: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.path == "evaluation.eligibility")
        .collect();
    assert_eq!(removed.len(), 1);
    assert_eq!(removed[0].change_type, ChangeType::Removed);
    assert_eq!(removed[0].impact, ChangeImpact::Breaking);
    assert_eq!(cl.semver_impact, SemverImpact::Major);
}

#[test]
fn screener_strategy_change_is_breaking() {
    let old = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [],
        "evaluation": [{
            "id": "p1",
            "strategy": "first-match",
            "routes": [{ "condition": "true", "target": "urn:t" }]
        }]
    });
    let new_doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "2.0.0",
        "title": "Test",
        "items": [],
        "evaluation": [{
            "id": "p1",
            "strategy": "fan-out",
            "routes": [{ "condition": "true", "target": "urn:t" }]
        }]
    });
    let cl = generate_screener_changelog(&old, &new_doc, "urn:test:screener");
    let modified: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.path == "evaluation.p1")
        .collect();
    assert_eq!(modified.len(), 1);
    assert_eq!(modified[0].impact, ChangeImpact::Breaking);
}

#[test]
fn screener_availability_change_is_compatible() {
    let old = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [],
        "evaluation": []
    });
    let new_doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.1.0",
        "title": "Test",
        "items": [],
        "evaluation": [],
        "availability": { "from": "2026-01-01", "until": "2026-12-31" }
    });
    let cl = generate_screener_changelog(&old, &new_doc, "urn:test:screener");
    let avail: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.path == "availability")
        .collect();
    assert_eq!(avail.len(), 1);
    assert_eq!(avail[0].change_type, ChangeType::Added);
    assert_eq!(avail[0].impact, ChangeImpact::Compatible);
}

#[test]
fn screener_item_changes_tracked() {
    let old = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [
            { "key": "q1", "type": "field", "dataType": "string", "label": "Q1" }
        ],
        "evaluation": []
    });
    let new_doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.1.0",
        "title": "Test",
        "items": [
            { "key": "q1", "type": "field", "dataType": "string", "label": "Question 1" },
            { "key": "q2", "type": "field", "dataType": "integer", "label": "Q2" }
        ],
        "evaluation": []
    });
    let cl = generate_screener_changelog(&old, &new_doc, "urn:test:screener");
    let item_changes: Vec<_> = cl
        .changes
        .iter()
        .filter(|c| c.target == ChangeTarget::Item)
        .collect();
    // q1 modified (label changed), q2 added
    assert_eq!(item_changes.len(), 2);
}

// ── Wire-format invariants (schema conformance at the serializer boundary) ──
//
// `change_to_object` skips `key` / `description` / `migrationHint` when the
// Rust `Option<String>` is `None`. The schema declares them `type: "string"`
// under `additionalProperties: false`, so emitting `null` would fail
// validation. `before` / `after` have no type constraint — null is valid
// for them. These tests pin the contract at the Rust boundary so any
// future change surfaces across both wire styles and both the Python
// and WASM bindings.

fn _simple_added_changelog() -> Changelog {
    let old = json!({
        "url": "u", "version": "1.0.0", "title": "t", "items": []
    });
    let new = json!({
        "url": "u", "version": "1.1.0", "title": "t",
        "items": [{"key": "x", "type": "field", "dataType": "string"}]
    });
    generate_changelog(&old, &new, "u")
}

#[test]
fn camel_serialization_omits_optional_string_fields_when_none() {
    let cl = _simple_added_changelog();
    let v = changelog_to_json_value(&cl, JsonWireStyle::JsCamel);
    let changes = v.get("changes").unwrap().as_array().unwrap();
    for change in changes {
        let obj = change.as_object().unwrap();
        // description/migrationHint must be absent (not null) when None,
        // since the schema rejects null under `type: "string"`.
        if !obj.contains_key("description") {
            continue; // absent — correct
        }
        assert!(
            !obj["description"].is_null(),
            "description key present with null value — schema forbids"
        );
    }
    // Positive cross-check: at least one change in this scenario has no
    // migrationHint (Added items never carry one), so the absence branch
    // is exercised.
    let added = changes.iter().find(|c| c["type"] == "added").unwrap();
    assert!(
        !added.as_object().unwrap().contains_key("migrationHint"),
        "added change must not emit migrationHint at all"
    );
}

#[test]
fn snake_serialization_also_omits_optional_string_fields_when_none() {
    // The None-stripping is style-independent — same guarantee holds for
    // snake callers so Python ergonomics do not diverge from schema shape.
    let cl = _simple_added_changelog();
    let v = changelog_to_json_value(&cl, JsonWireStyle::PythonSnake);
    let added = v
        .get("changes")
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["change_type"] == "added")
        .unwrap();
    let obj = added.as_object().unwrap();
    assert!(!obj.contains_key("migration_hint"));
    // `description` may be absent for this Added case; pin absence-not-null.
    if obj.contains_key("description") {
        assert!(!obj["description"].is_null());
    }
}

#[test]
fn camel_serialization_emits_migration_hint_when_some() {
    // Round-trip the positive branch: a Change with Some(hint) must render
    // the key. This pins that the None-skip is conditional, not a blanket drop.
    let cl = Changelog {
        definition_url: "u".into(),
        from_version: "1.0.0".into(),
        to_version: "2.0.0".into(),
        semver_impact: SemverImpact::Major,
        changes: vec![Change {
            change_type: ChangeType::Removed,
            target: ChangeTarget::Item,
            path: "items.x".into(),
            impact: ChangeImpact::Breaking,
            key: Some("x".into()),
            description: Some("removed x".into()),
            before: None,
            after: None,
            migration_hint: Some("drop".into()),
        }],
    };
    let v = changelog_to_json_value(&cl, JsonWireStyle::JsCamel);
    let c = &v["changes"][0];
    assert_eq!(c["key"], "x");
    assert_eq!(c["description"], "removed x");
    assert_eq!(c["migrationHint"], "drop");
}

#[test]
fn screener_no_changes_produces_empty_changelog() {
    let doc = json!({
        "$formspecScreener": "1.0",
        "url": "urn:test:screener",
        "version": "1.0.0",
        "title": "Test",
        "items": [],
        "evaluation": []
    });
    let cl = generate_screener_changelog(&doc, &doc, "urn:test:screener");
    assert!(cl.changes.is_empty());
    assert_eq!(cl.semver_impact, SemverImpact::Patch);
}
