//! Changelog generation (`wasm_bindgen`).

use formspec_core::changelog;
use serde_json::Value;
use wasm_bindgen::prelude::*;

// ── Changelog ───────────────────────────────────────────────────

/// Diff two Formspec definition versions and produce a structured changelog.
/// Returns JSON with camelCase keys.
#[wasm_bindgen(js_name = "generateChangelog")]
pub fn generate_changelog_wasm(
    old_def_json: &str,
    new_def_json: &str,
    definition_url: &str,
) -> Result<String, JsError> {
    generate_changelog_inner(old_def_json, new_def_json, definition_url)
        .map_err(|e| JsError::new(&e))
}

pub(crate) fn generate_changelog_inner(
    old_def_json: &str,
    new_def_json: &str,
    definition_url: &str,
) -> Result<String, String> {
    let old_def: Value = serde_json::from_str(old_def_json)
        .map_err(|e| format!("invalid old definition JSON: {e}"))?;
    let new_def: Value = serde_json::from_str(new_def_json)
        .map_err(|e| format!("invalid new definition JSON: {e}"))?;

    let result = changelog::generate_changelog(&old_def, &new_def, definition_url);

    let json = serde_json::json!({
        "definitionUrl": result.definition_url,
        "fromVersion": result.from_version,
        "toVersion": result.to_version,
        "semverImpact": match result.semver_impact {
            changelog::SemverImpact::Patch => "patch",
            changelog::SemverImpact::Minor => "minor",
            changelog::SemverImpact::Major => "major",
        },
        "changes": result.changes.iter().map(|c| serde_json::json!({
            "type": match c.change_type {
                changelog::ChangeType::Added => "added",
                changelog::ChangeType::Removed => "removed",
                changelog::ChangeType::Modified => "modified",
            },
            "target": match c.target {
                changelog::ChangeTarget::Item => "item",
                changelog::ChangeTarget::Bind => "bind",
                changelog::ChangeTarget::Shape => "shape",
                changelog::ChangeTarget::OptionSet => "optionSet",
                changelog::ChangeTarget::DataSource => "dataSource",
                changelog::ChangeTarget::Screener => "screener",
                changelog::ChangeTarget::Migration => "migration",
                changelog::ChangeTarget::Metadata => "metadata",
            },
            "path": c.path,
            "impact": match c.impact {
                changelog::ChangeImpact::Cosmetic => "cosmetic",
                changelog::ChangeImpact::Compatible => "compatible",
                changelog::ChangeImpact::Breaking => "breaking",
            },
            "key": c.key,
            "description": c.description,
            "before": c.before,
            "after": c.after,
            "migrationHint": c.migration_hint,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string(&json).map_err(|e| e.to_string())
}
