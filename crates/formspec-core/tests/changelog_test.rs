//! Integration tests for changelog module.

use formspec_core::changelog::*;
use serde_json::{json, Value};

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
    let item_changes: Vec<_> = cl.changes.iter()
        .filter(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .collect();
    assert_eq!(item_changes.len(), 1, "expected exactly one item-added change");
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
    let item_changes: Vec<_> = cl.changes.iter()
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
    let item_changes: Vec<_> = cl.changes.iter()
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
    let item_changes: Vec<_> = cl.changes.iter()
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
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let shape_changes: Vec<_> = cl.changes.iter()
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
    let shape_changes: Vec<_> = cl.changes.iter()
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
    let meta_changes: Vec<_> = cl.changes.iter()
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

    let item_change = cl.changes.iter()
        .find(|c| c.target == ChangeTarget::Item && c.change_type == ChangeType::Added)
        .expect("should have item added");
    assert_eq!(item_change.path, "items.phone");

    let bind_change = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let item_changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
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
    let removed = cl.changes.iter()
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
    let added = cl.changes.iter()
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
    let changes: Vec<_> = cl.changes.iter()
        .filter(|c| c.target == ChangeTarget::Screener)
        .collect();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].change_type, ChangeType::Modified);
    assert_eq!(changes[0].impact, ChangeImpact::Compatible);
}

#[test]
fn bind_constraint_change_is_compatible() {
    let old = base_def();
    let mut new = base_def();
    new["binds"]["name"] = json!({ "required": "true", "constraint": "string-length(.) > 3" });

    let cl = generate_changelog(&old, &new, URL);
    let bind_changes: Vec<_> = cl.changes.iter()
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
    let added = cl.changes.iter()
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
    let added = cl.changes.iter()
        .find(|c| c.target == ChangeTarget::OptionSet && c.change_type == ChangeType::Added)
        .expect("should have optionSet added");
    assert_eq!(added.path, "optionSets.states");
}
