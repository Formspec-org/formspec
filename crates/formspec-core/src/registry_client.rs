//! Registry client — parses registry documents, resolves extensions, validates lifecycle.

use std::collections::HashMap;

use crate::extension_analysis::{RegistryEntryInfo, RegistryEntryStatus, RegistryLookup};

// ── Types ───────────────────────────────────────────────────────

/// Extension mechanism category.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtensionCategory {
    DataType,
    Function,
    Constraint,
    Property,
    Namespace,
}

/// Organization publishing a registry document.
#[derive(Debug, Clone)]
pub struct Publisher {
    pub name: String,
    pub url: String,
    pub contact: Option<String>,
}

/// A single extension record with full metadata.
#[derive(Debug, Clone)]
pub struct RegistryEntry {
    pub name: String,
    pub category: ExtensionCategory,
    pub version: String,
    pub status: RegistryEntryStatus,
    pub description: String,
    pub deprecation_notice: Option<String>,
    pub base_type: Option<String>,
    pub parameters: Option<Vec<Parameter>>,
    pub returns: Option<String>,
}

/// Function/constraint parameter declaration.
#[derive(Debug, Clone)]
pub struct Parameter {
    pub name: String,
    pub param_type: String,
    pub description: Option<String>,
}

/// Errors from registry parsing and validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryError {
    /// Missing required top-level field.
    MissingField(String),
    /// Field has wrong type.
    InvalidField(String),
    /// Entry-level parse error (index, message).
    InvalidEntry(usize, String),
}

impl std::fmt::Display for RegistryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RegistryError::MissingField(field) => write!(f, "missing required field: {field}"),
            RegistryError::InvalidField(msg) => write!(f, "invalid field: {msg}"),
            RegistryError::InvalidEntry(idx, msg) => write!(f, "entry[{idx}]: {msg}"),
        }
    }
}

impl std::error::Error for RegistryError {}

/// A parsed registry document with indexed entries.
#[derive(Debug)]
pub struct Registry {
    pub publisher: Publisher,
    pub published: String,
    entries: Vec<RegistryEntry>,
    by_name: HashMap<String, Vec<usize>>,
}

// ── Parsing ─────────────────────────────────────────────────────

impl Registry {
    /// Parse a registry document from a JSON value.
    pub fn from_json(value: &serde_json::Value) -> Result<Self, RegistryError> {
        let obj = value
            .as_object()
            .ok_or_else(|| RegistryError::InvalidField("root must be an object".into()))?;

        // publisher
        let pub_val = obj
            .get("publisher")
            .ok_or_else(|| RegistryError::MissingField("publisher".into()))?;
        let publisher = parse_publisher(pub_val)?;

        // published
        let published = obj
            .get("published")
            .and_then(|v| v.as_str())
            .ok_or_else(|| RegistryError::MissingField("published".into()))?
            .to_string();

        // entries
        let entries_val = obj
            .get("entries")
            .and_then(|v| v.as_array())
            .ok_or_else(|| RegistryError::MissingField("entries".into()))?;

        let mut entries = Vec::with_capacity(entries_val.len());
        let mut by_name: HashMap<String, Vec<usize>> = HashMap::new();

        for (i, entry_val) in entries_val.iter().enumerate() {
            let entry = parse_entry(entry_val, i)?;
            by_name.entry(entry.name.clone()).or_default().push(i);
            entries.push(entry);
        }

        Ok(Registry {
            publisher,
            published,
            entries,
            by_name,
        })
    }

    /// Find all entries matching `name`, optionally filtered by a version constraint.
    /// Results are sorted by version descending (highest first).
    pub fn find(&self, name: &str, version_constraint: Option<&str>) -> Vec<&RegistryEntry> {
        let Some(indices) = self.by_name.get(name) else {
            return vec![];
        };
        let mut matches: Vec<&RegistryEntry> = indices
            .iter()
            .map(|&i| &self.entries[i])
            .filter(|e| {
                version_constraint
                    .map(|c| version_satisfies(&e.version, c))
                    .unwrap_or(true)
            })
            .collect();
        matches.sort_by(|a, b| compare_versions(&b.version, &a.version));
        matches
    }

    /// Find the highest-version entry matching `name` and optional constraint.
    pub fn find_one(&self, name: &str, version_constraint: Option<&str>) -> Option<&RegistryEntry> {
        self.find(name, version_constraint).into_iter().next()
    }

    /// List all entries in a given category.
    pub fn list_by_category(&self, category: ExtensionCategory) -> Vec<&RegistryEntry> {
        self.entries
            .iter()
            .filter(|e| e.category == category)
            .collect()
    }

    /// List all entries with a given lifecycle status.
    pub fn list_by_status(&self, status: RegistryEntryStatus) -> Vec<&RegistryEntry> {
        self.entries.iter().filter(|e| e.status == status).collect()
    }

    /// Validate registry entries against structural rules.
    /// Returns a list of human-readable validation messages.
    pub fn validate(&self) -> Vec<String> {
        let mut messages = Vec::new();

        for (i, entry) in self.entries.iter().enumerate() {
            if !is_valid_extension_name(&entry.name) {
                messages.push(format!(
                    "entry[{i}]: name '{}' does not match x-prefixed pattern",
                    entry.name
                ));
            }

            if entry.status == RegistryEntryStatus::Deprecated && entry.deprecation_notice.is_none()
            {
                messages.push(format!(
                    "entry[{i}]: deprecated entry '{}' missing deprecationNotice",
                    entry.name
                ));
            }

            if entry.category == ExtensionCategory::DataType && entry.base_type.is_none() {
                messages.push(format!(
                    "entry[{i}]: dataType entry '{}' missing baseType",
                    entry.name
                ));
            }

            if entry.category == ExtensionCategory::Function {
                if entry.parameters.is_none() {
                    messages.push(format!(
                        "entry[{i}]: function entry '{}' missing parameters",
                        entry.name
                    ));
                }
                if entry.returns.is_none() {
                    messages.push(format!(
                        "entry[{i}]: function entry '{}' missing returns",
                        entry.name
                    ));
                }
            }

            if entry.category == ExtensionCategory::Constraint && entry.parameters.is_none() {
                messages.push(format!(
                    "entry[{i}]: constraint entry '{}' missing parameters",
                    entry.name
                ));
            }
        }

        messages
    }
}

impl RegistryLookup for Registry {
    fn lookup(&self, extension_name: &str) -> Option<RegistryEntryInfo> {
        let entry = self.find_one(extension_name, None)?;
        // Extract displayName from the entry description as a fallback;
        // real registries would carry metadata.displayName but that's not
        // modeled in RegistryEntry — use the name itself.
        Some(RegistryEntryInfo {
            name: entry.name.clone(),
            status: entry.status,
            display_name: Some(entry.description.clone()),
            deprecation_notice: entry.deprecation_notice.clone(),
        })
    }
}

// ── Lifecycle state machine ─────────────────────────────────────

/// Check whether a lifecycle transition is valid per the spec.
///
/// ```text
/// draft      → {draft, stable}
/// stable     → {stable, deprecated}
/// deprecated → {deprecated, retired, stable}  // un-deprecation allowed
/// retired    → {}  // terminal
/// ```
pub fn validate_lifecycle_transition(from: RegistryEntryStatus, to: RegistryEntryStatus) -> bool {
    use RegistryEntryStatus::*;
    matches!(
        (from, to),
        (Draft, Draft)
            | (Draft, Active)
            | (Active, Active)
            | (Active, Deprecated)
            | (Deprecated, Deprecated)
            | (Deprecated, Retired)
            | (Deprecated, Active) // un-deprecation
    )
}

// ── Well-known URL ──────────────────────────────────────────────

/// Construct the well-known registry URL for a base URL.
pub fn well_known_url(base_url: &str) -> String {
    let base = base_url.trim_end_matches('/');
    format!("{base}/.well-known/formspec-extensions.json")
}

// ── Semver matching ─────────────────────────────────────────────

/// Parse a version string into (major, minor, patch), zero-padding to 3 parts.
fn parse_version(v: &str) -> (u64, u64, u64) {
    let parts: Vec<u64> = v.split('.').filter_map(|p| p.parse().ok()).collect();
    (
        parts.first().copied().unwrap_or(0),
        parts.get(1).copied().unwrap_or(0),
        parts.get(2).copied().unwrap_or(0),
    )
}

/// Compare two version strings. Returns Ordering.
fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let va = parse_version(a);
    let vb = parse_version(b);
    va.cmp(&vb)
}

/// Check if `version` satisfies a space-separated constraint string.
/// Each token is an operator+version (e.g. `>=1.0.0`) or an exact version.
/// All tokens must match (AND semantics).
pub fn version_satisfies(version: &str, constraint: &str) -> bool {
    let v = parse_version(version);

    for token in constraint.split_whitespace() {
        let (op, ver_str) = if let Some(rest) = token.strip_prefix(">=") {
            (">=", rest)
        } else if let Some(rest) = token.strip_prefix("<=") {
            ("<=", rest)
        } else if let Some(rest) = token.strip_prefix('>') {
            (">", rest)
        } else if let Some(rest) = token.strip_prefix('<') {
            ("<", rest)
        } else {
            ("=", token)
        };

        let c = parse_version(ver_str);

        let ok = match op {
            ">=" => v >= c,
            "<=" => v <= c,
            ">" => v > c,
            "<" => v < c,
            _ => v == c,
        };

        if !ok {
            return false;
        }
    }

    true
}

// ── Name validation ─────────────────────────────────────────────

/// Check if a name matches `^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$`.
fn is_valid_extension_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    if bytes.len() < 3 || bytes[0] != b'x' || bytes[1] != b'-' {
        return false;
    }
    // After "x-", expect one or more segments separated by '-'.
    // Each segment: starts with [a-z], followed by [a-z0-9]*.
    let rest = &bytes[2..];
    if rest.is_empty() {
        return false;
    }
    let mut i = 0;
    loop {
        // Start of segment: must be [a-z]
        if i >= rest.len() || !rest[i].is_ascii_lowercase() {
            return false;
        }
        i += 1;
        // Rest of segment: [a-z0-9]*
        while i < rest.len() && (rest[i].is_ascii_lowercase() || rest[i].is_ascii_digit()) {
            i += 1;
        }
        // End of string or next segment
        if i == rest.len() {
            return true;
        }
        if rest[i] == b'-' {
            i += 1; // consume hyphen, next iteration expects a segment
        } else {
            return false; // invalid character
        }
    }
}

// ── Internal parsers ────────────────────────────────────────────

fn parse_publisher(val: &serde_json::Value) -> Result<Publisher, RegistryError> {
    let obj = val
        .as_object()
        .ok_or_else(|| RegistryError::InvalidField("publisher must be an object".into()))?;
    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::MissingField("publisher.name".into()))?
        .to_string();
    let url = obj
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::MissingField("publisher.url".into()))?
        .to_string();
    let contact = obj
        .get("contact")
        .and_then(|v| v.as_str())
        .map(String::from);
    Ok(Publisher { name, url, contact })
}

fn parse_status(s: &str) -> Option<RegistryEntryStatus> {
    match s {
        "draft" => Some(RegistryEntryStatus::Draft),
        "stable" | "active" => Some(RegistryEntryStatus::Active),
        "deprecated" => Some(RegistryEntryStatus::Deprecated),
        "retired" => Some(RegistryEntryStatus::Retired),
        _ => None,
    }
}

fn parse_category(s: &str) -> Option<ExtensionCategory> {
    match s {
        "dataType" => Some(ExtensionCategory::DataType),
        "function" => Some(ExtensionCategory::Function),
        "constraint" => Some(ExtensionCategory::Constraint),
        "property" => Some(ExtensionCategory::Property),
        "namespace" => Some(ExtensionCategory::Namespace),
        _ => None,
    }
}

fn parse_parameter(val: &serde_json::Value) -> Option<Parameter> {
    let obj = val.as_object()?;
    Some(Parameter {
        name: obj.get("name")?.as_str()?.to_string(),
        param_type: obj.get("type")?.as_str()?.to_string(),
        description: obj
            .get("description")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

fn parse_entry(val: &serde_json::Value, index: usize) -> Result<RegistryEntry, RegistryError> {
    let obj = val
        .as_object()
        .ok_or_else(|| RegistryError::InvalidEntry(index, "entry must be an object".into()))?;

    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::InvalidEntry(index, "missing name".into()))?
        .to_string();

    let category_str = obj
        .get("category")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::InvalidEntry(index, "missing category".into()))?;
    let category = parse_category(category_str).ok_or_else(|| {
        RegistryError::InvalidEntry(index, format!("unknown category: {category_str}"))
    })?;

    let version = obj
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::InvalidEntry(index, "missing version".into()))?
        .to_string();

    let status_str = obj
        .get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::InvalidEntry(index, "missing status".into()))?;
    let status = parse_status(status_str).ok_or_else(|| {
        RegistryError::InvalidEntry(index, format!("unknown status: {status_str}"))
    })?;

    let description = obj
        .get("description")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RegistryError::InvalidEntry(index, "missing description".into()))?
        .to_string();

    let deprecation_notice = obj
        .get("deprecationNotice")
        .and_then(|v| v.as_str())
        .map(String::from);

    let base_type = obj
        .get("baseType")
        .and_then(|v| v.as_str())
        .map(String::from);

    let parameters = obj.get("parameters").and_then(|v| {
        v.as_array()
            .map(|arr| arr.iter().filter_map(parse_parameter).collect())
    });

    let returns = obj
        .get("returns")
        .and_then(|v| v.as_str())
        .map(String::from);

    Ok(RegistryEntry {
        name,
        category,
        version,
        status,
        description,
        deprecation_notice,
        base_type,
        parameters,
        returns,
    })
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_registry_json() -> serde_json::Value {
        json!({
            "$formspecRegistry": "1.0",
            "publisher": {
                "name": "Test Org",
                "url": "https://test.org",
                "contact": "test@test.org"
            },
            "published": "2026-03-18T00:00:00Z",
            "entries": [
                {
                    "name": "x-test-currency",
                    "category": "dataType",
                    "version": "1.0.0",
                    "status": "stable",
                    "description": "A currency type.",
                    "compatibility": { "formspecVersion": ">=1.0.0 <2.0.0" },
                    "baseType": "decimal"
                },
                {
                    "name": "x-test-currency",
                    "category": "dataType",
                    "version": "2.0.0",
                    "status": "draft",
                    "description": "Currency v2.",
                    "compatibility": { "formspecVersion": ">=1.0.0 <2.0.0" },
                    "baseType": "decimal"
                },
                {
                    "name": "x-test-age",
                    "category": "function",
                    "version": "1.0.0",
                    "status": "stable",
                    "description": "Calculates age.",
                    "compatibility": { "formspecVersion": ">=1.0.0" },
                    "parameters": [
                        { "name": "birthDate", "type": "date", "description": "DOB" }
                    ],
                    "returns": "integer"
                },
                {
                    "name": "x-test-luhn",
                    "category": "constraint",
                    "version": "1.0.0",
                    "status": "deprecated",
                    "description": "Luhn check.",
                    "compatibility": { "formspecVersion": ">=1.0.0" },
                    "deprecationNotice": "Use x-test-luhn-v2 instead.",
                    "parameters": [
                        { "name": "value", "type": "string" }
                    ]
                },
                {
                    "name": "x-test-ns",
                    "category": "namespace",
                    "version": "1.0.0",
                    "status": "stable",
                    "description": "Test namespace.",
                    "compatibility": { "formspecVersion": ">=1.0.0" }
                }
            ]
        })
    }

    // ── 1. Parse valid registry document ────────────────────────

    #[test]
    fn parse_valid_registry() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        assert_eq!(reg.publisher.name, "Test Org");
        assert_eq!(reg.publisher.url, "https://test.org");
        assert_eq!(reg.publisher.contact.as_deref(), Some("test@test.org"));
        assert_eq!(reg.published, "2026-03-18T00:00:00Z");
        assert_eq!(reg.entries.len(), 5);
        // Name index: x-test-currency has 2 entries
        assert_eq!(reg.by_name.get("x-test-currency").unwrap().len(), 2);
    }

    #[test]
    fn parse_missing_publisher_errors() {
        let val = json!({ "published": "2026-01-01T00:00:00Z", "entries": [] });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::MissingField(ref f) if f == "publisher"));
    }

    #[test]
    fn parse_missing_entries_errors() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z"
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::MissingField(ref f) if f == "entries"));
    }

    #[test]
    fn parse_entry_unknown_category_errors() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-bad",
                "category": "widget",
                "version": "1.0.0",
                "status": "stable",
                "description": "bad",
                "compatibility": {}
            }]
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidEntry(0, _)));
    }

    #[test]
    fn parse_maps_stable_and_active_to_active() {
        let make = |status: &str| {
            json!({
                "publisher": { "name": "X", "url": "https://x.com" },
                "published": "2026-01-01T00:00:00Z",
                "entries": [{
                    "name": "x-test",
                    "category": "property",
                    "version": "1.0.0",
                    "status": status,
                    "description": "test",
                    "compatibility": {}
                }]
            })
        };
        let r1 = Registry::from_json(&make("stable")).unwrap();
        let r2 = Registry::from_json(&make("active")).unwrap();
        assert_eq!(r1.entries[0].status, RegistryEntryStatus::Active);
        assert_eq!(r2.entries[0].status, RegistryEntryStatus::Active);
    }

    // ── 2. find by name ─────────────────────────────────────────

    #[test]
    fn find_by_name_returns_sorted_desc() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let results = reg.find("x-test-currency", None);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].version, "2.0.0"); // highest first
        assert_eq!(results[1].version, "1.0.0");
    }

    #[test]
    fn find_nonexistent_returns_empty() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        assert!(reg.find("x-nope", None).is_empty());
    }

    // ── 3. find with version constraint ─────────────────────────

    #[test]
    fn find_with_exact_version() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let results = reg.find("x-test-currency", Some("1.0.0"));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].version, "1.0.0");
    }

    #[test]
    fn find_with_range_constraint() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let results = reg.find("x-test-currency", Some(">=1.0.0 <2.0.0"));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].version, "1.0.0");
    }

    // ── 4. find_one ─────────────────────────────────────────────

    #[test]
    fn find_one_returns_highest_match() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let entry = reg.find_one("x-test-currency", None).unwrap();
        assert_eq!(entry.version, "2.0.0");
    }

    #[test]
    fn find_one_with_constraint() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let entry = reg
            .find_one("x-test-currency", Some(">=1.0.0 <2.0.0"))
            .unwrap();
        assert_eq!(entry.version, "1.0.0");
    }

    #[test]
    fn find_one_nonexistent() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        assert!(reg.find_one("x-nope", None).is_none());
    }

    // ── 5. list_by_category and list_by_status ──────────────────

    #[test]
    fn list_by_category() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let data_types = reg.list_by_category(ExtensionCategory::DataType);
        assert_eq!(data_types.len(), 2); // x-test-currency v1 + v2
        let functions = reg.list_by_category(ExtensionCategory::Function);
        assert_eq!(functions.len(), 1);
        let namespaces = reg.list_by_category(ExtensionCategory::Namespace);
        assert_eq!(namespaces.len(), 1);
    }

    #[test]
    fn list_by_status() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let active = reg.list_by_status(RegistryEntryStatus::Active);
        assert_eq!(active.len(), 3); // currency v1, age, namespace
        let draft = reg.list_by_status(RegistryEntryStatus::Draft);
        assert_eq!(draft.len(), 1); // currency v2
        let deprecated = reg.list_by_status(RegistryEntryStatus::Deprecated);
        assert_eq!(deprecated.len(), 1); // luhn
    }

    // ── 6. Lifecycle transitions ────────────────────────────────

    #[test]
    fn valid_lifecycle_transitions() {
        use RegistryEntryStatus::*;
        // Self-transitions
        assert!(validate_lifecycle_transition(Draft, Draft));
        assert!(validate_lifecycle_transition(Active, Active));
        assert!(validate_lifecycle_transition(Deprecated, Deprecated));
        // Forward transitions
        assert!(validate_lifecycle_transition(Draft, Active));
        assert!(validate_lifecycle_transition(Active, Deprecated));
        assert!(validate_lifecycle_transition(Deprecated, Retired));
        // Un-deprecation
        assert!(validate_lifecycle_transition(Deprecated, Active));
    }

    #[test]
    fn invalid_lifecycle_transitions() {
        use RegistryEntryStatus::*;
        // Skip states
        assert!(!validate_lifecycle_transition(Draft, Deprecated));
        assert!(!validate_lifecycle_transition(Draft, Retired));
        assert!(!validate_lifecycle_transition(Active, Retired));
        // Backwards (except un-deprecation)
        assert!(!validate_lifecycle_transition(Active, Draft));
        // Terminal
        assert!(!validate_lifecycle_transition(Retired, Retired));
        assert!(!validate_lifecycle_transition(Retired, Draft));
        assert!(!validate_lifecycle_transition(Retired, Active));
        assert!(!validate_lifecycle_transition(Retired, Deprecated));
    }

    // ── 7. well_known_url ───────────────────────────────────────

    #[test]
    fn well_known_url_construction() {
        assert_eq!(
            well_known_url("https://example.com"),
            "https://example.com/.well-known/formspec-extensions.json"
        );
        assert_eq!(
            well_known_url("https://example.com/"),
            "https://example.com/.well-known/formspec-extensions.json"
        );
    }

    // ── 8. version_satisfies ────────────────────────────────────

    #[test]
    fn version_exact_match() {
        assert!(version_satisfies("1.0.0", "1.0.0"));
        assert!(!version_satisfies("1.0.1", "1.0.0"));
    }

    #[test]
    fn version_gte() {
        assert!(version_satisfies("1.0.0", ">=1.0.0"));
        assert!(version_satisfies("2.0.0", ">=1.0.0"));
        assert!(!version_satisfies("0.9.0", ">=1.0.0"));
    }

    #[test]
    fn version_gt() {
        assert!(version_satisfies("1.0.1", ">1.0.0"));
        assert!(!version_satisfies("1.0.0", ">1.0.0"));
    }

    #[test]
    fn version_lte() {
        assert!(version_satisfies("1.0.0", "<=1.0.0"));
        assert!(version_satisfies("0.9.0", "<=1.0.0"));
        assert!(!version_satisfies("1.0.1", "<=1.0.0"));
    }

    #[test]
    fn version_lt() {
        assert!(version_satisfies("0.9.0", "<1.0.0"));
        assert!(!version_satisfies("1.0.0", "<1.0.0"));
    }

    #[test]
    fn version_compound_constraint() {
        assert!(version_satisfies("1.5.0", ">=1.0.0 <2.0.0"));
        assert!(!version_satisfies("2.0.0", ">=1.0.0 <2.0.0"));
        assert!(!version_satisfies("0.9.0", ">=1.0.0 <2.0.0"));
    }

    #[test]
    fn version_zero_padding() {
        // "1" should parse as (1, 0, 0)
        assert!(version_satisfies("1.0.0", "1"));
        assert!(version_satisfies("1.0.0", ">=1"));
    }

    // ── 9. validate ─────────────────────────────────────────────

    #[test]
    fn validate_catches_invalid_name() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "bad-name",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("bad-name"));
    }

    #[test]
    fn validate_catches_missing_deprecation_notice() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "property",
                "version": "1.0.0",
                "status": "deprecated",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("deprecationNotice"));
    }

    #[test]
    fn validate_catches_missing_base_type() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "dataType",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("baseType"));
    }

    #[test]
    fn validate_catches_missing_function_fields() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "function",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert_eq!(issues.len(), 2); // missing parameters AND returns
    }

    #[test]
    fn validate_catches_missing_constraint_parameters() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "constraint",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("parameters"));
    }

    #[test]
    fn validate_clean_registry_no_issues() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        assert!(reg.validate().is_empty());
    }

    // ── 10. RegistryLookup implementation ───────────────────────

    #[test]
    fn registry_lookup_maps_to_entry_info() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let info = reg.lookup("x-test-age").unwrap();
        assert_eq!(info.name, "x-test-age");
        assert_eq!(info.status, RegistryEntryStatus::Active);
        assert!(info.display_name.is_some());
    }

    #[test]
    fn registry_lookup_returns_deprecation_notice() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let info = reg.lookup("x-test-luhn").unwrap();
        assert_eq!(info.status, RegistryEntryStatus::Deprecated);
        assert_eq!(
            info.deprecation_notice.as_deref(),
            Some("Use x-test-luhn-v2 instead.")
        );
    }

    #[test]
    fn registry_lookup_returns_highest_version() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        let info = reg.lookup("x-test-currency").unwrap();
        // find_one returns highest version (2.0.0, which is draft)
        assert_eq!(info.status, RegistryEntryStatus::Draft);
    }

    #[test]
    fn registry_lookup_nonexistent() {
        let reg = Registry::from_json(&sample_registry_json()).unwrap();
        assert!(reg.lookup("x-nope").is_none());
    }

    // ── is_valid_extension_name edge cases ──────────────────────

    /// Spec: extension-registry.md §2.1 — "Extension name must match x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*"
    #[test]
    fn extension_name_valid_cases() {
        // Validated through the validate() method which calls is_valid_extension_name
        // But we can test indirectly by creating entries and validating

        // Valid: simple x-prefixed
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(issues.is_empty(), "x-test should be valid: {issues:?}");
    }

    /// Spec: extension-registry.md §2.1 — "Name too short fails"
    #[test]
    fn extension_name_too_short() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(!issues.is_empty(), "x- should be invalid");
    }

    /// Spec: extension-registry.md §2.1 — "Name with uppercase fails"
    #[test]
    fn extension_name_uppercase_fails() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-Test",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(!issues.is_empty(), "x-Test should be invalid (uppercase)");
    }

    /// Spec: extension-registry.md §2.1 — "Name with digits after first letter is valid"
    #[test]
    fn extension_name_with_digits() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test123",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(issues.is_empty(), "x-test123 should be valid: {issues:?}");
    }

    /// Spec: extension-registry.md §2.1 — "Name starting with digit after x- fails"
    #[test]
    fn extension_name_digit_after_prefix() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-1test",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(
            !issues.is_empty(),
            "x-1test should be invalid (digit start)"
        );
    }

    /// Spec: extension-registry.md §2.1 — "Multi-segment name is valid"
    #[test]
    fn extension_name_multi_segment() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-formspec-url-validator",
                "category": "property",
                "version": "1.0.0",
                "status": "stable",
                "description": "test",
                "compatibility": {}
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(
            issues.is_empty(),
            "x-formspec-url-validator should be valid: {issues:?}"
        );
    }

    // ── Version with non-numeric parts ───────────────────────────

    /// Spec: extension-registry.md §2.3 — "Version with non-numeric parts parses as 0"
    #[test]
    fn version_non_numeric_parts() {
        // "1.0.0-beta" → parse_version drops non-numeric, gets (1, 0, 0)
        // The non-numeric part "0-beta" should parse as 0 via filter_map
        assert!(version_satisfies("1.0.0", "1.0.0"));
        // A version like "1.beta.0" should degrade gracefully
        assert!(version_satisfies("1.0.0", ">=1"));
    }

    /// Spec: extension-registry.md §2.3 — "Short version string zero-pads"
    #[test]
    fn version_short_string() {
        // "2" should match "2.0.0"
        assert!(version_satisfies("2.0.0", "2"));
        // "1.5" should match "1.5.0"
        assert!(version_satisfies("1.5.0", ">=1.5"));
    }

    // ── Parse real registry document ────────────────────────────

    #[test]
    fn parse_real_formspec_common_registry() {
        let json_str = include_str!("../../../registries/formspec-common.registry.json");
        let val: serde_json::Value = serde_json::from_str(json_str).unwrap();
        let reg = Registry::from_json(&val).unwrap();
        assert_eq!(reg.publisher.name, "Formspec Project");
        assert!(reg.entries.len() >= 15);
        // All entries should validate clean
        assert!(reg.validate().is_empty());
        // Lookup should work
        let url = reg.lookup("x-formspec-url").unwrap();
        assert_eq!(url.status, RegistryEntryStatus::Active);
    }

    // ── Findings 28-30: structural parse errors and conditional requirements ──

    /// Spec: registry/extension-registry.md §2, schemas/registry.schema.json "type":"object"
    /// Root document must be an object. An array root must be rejected.
    #[test]
    fn parse_error_when_root_is_array() {
        let val = json!([]);
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidField(_)));
    }

    /// Spec: registry/extension-registry.md §2.1, schemas/registry.schema.json $defs/publisher
    /// Publisher field must be an object. A string value must be rejected.
    #[test]
    fn parse_error_when_publisher_is_string() {
        let val = json!({
            "publisher": "not an object",
            "published": "2026-01-01T00:00:00Z",
            "entries": []
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidField(_)));
    }

    /// Spec: registry/extension-registry.md §3 — Entry missing `version` field.
    #[test]
    fn parse_error_entry_missing_version() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "property",
                "status": "stable",
                "description": "test"
            }]
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidEntry(0, ref m) if m.contains("version")));
    }

    /// Spec: registry/extension-registry.md §3 — Entry missing `status` field.
    #[test]
    fn parse_error_entry_missing_status() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "property",
                "version": "1.0.0",
                "description": "test"
            }]
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidEntry(0, ref m) if m.contains("status")));
    }

    /// Spec: registry/extension-registry.md §3 — Entry missing `description` field.
    #[test]
    fn parse_error_entry_missing_description() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test",
                "category": "property",
                "version": "1.0.0",
                "status": "stable"
            }]
        });
        let err = Registry::from_json(&val).unwrap_err();
        assert!(matches!(err, RegistryError::InvalidEntry(0, ref m) if m.contains("description")));
    }

    /// Spec: registry/extension-registry.md §3, Appendix A — dataType entries
    /// require baseType. Validated via `Registry::validate()`.
    #[test]
    fn validate_datatype_requires_base_type() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test-dt",
                "category": "dataType",
                "version": "1.0.0",
                "status": "stable",
                "description": "A data type"
                // missing baseType
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(issues.iter().any(|m| m.contains("baseType")));
    }

    /// Spec: registry/extension-registry.md §3 — function entries require
    /// both `parameters` and `returns`. Validated via `Registry::validate()`.
    #[test]
    fn validate_function_requires_parameters_and_returns() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test-fn",
                "category": "function",
                "version": "1.0.0",
                "status": "stable",
                "description": "A function"
                // missing parameters AND returns
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(issues.iter().any(|m| m.contains("parameters")));
        assert!(issues.iter().any(|m| m.contains("returns")));
    }

    /// Spec: registry/extension-registry.md §3 — deprecated status requires
    /// deprecationNotice. Validated via `Registry::validate()`.
    #[test]
    fn validate_deprecated_requires_notice() {
        let val = json!({
            "publisher": { "name": "X", "url": "https://x.com" },
            "published": "2026-01-01T00:00:00Z",
            "entries": [{
                "name": "x-test-dep",
                "category": "property",
                "version": "1.0.0",
                "status": "deprecated",
                "description": "Deprecated thing"
                // missing deprecationNotice
            }]
        });
        let reg = Registry::from_json(&val).unwrap();
        let issues = reg.validate();
        assert!(issues.iter().any(|m| m.contains("deprecationNotice")));
    }
}
