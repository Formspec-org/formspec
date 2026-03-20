//! Validates extension usage in item trees against a registry catalog.

/// Validates x-extension usage in definition item trees against a registry catalog.
///
/// Checks for unresolved, retired, and deprecated extensions.
use std::collections::HashMap;

// ── Types ───────────────────────────────────────────────────────

/// Severity levels for extension validation issues.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtensionSeverity {
    Error,
    Warning,
    Info,
}

/// Error codes for extension validation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtensionErrorCode {
    UnresolvedExtension,
    ExtensionRetired,
    ExtensionDeprecated,
}

/// A single extension usage validation issue.
#[derive(Debug, Clone)]
pub struct ExtensionUsageIssue {
    /// Dotted path to the item declaring the extension.
    pub path: String,
    /// The extension name (e.g., "x-formspec-url").
    pub extension: String,
    /// Severity level.
    pub severity: ExtensionSeverity,
    /// Error code for programmatic handling.
    pub code: ExtensionErrorCode,
    /// Human-readable message.
    pub message: String,
}

/// Lifecycle status of a registry entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistryEntryStatus {
    Draft,
    Active,
    Deprecated,
    Retired,
}

/// Minimal registry entry info needed for extension validation.
#[derive(Debug, Clone)]
pub struct RegistryEntryInfo {
    pub name: String,
    pub status: RegistryEntryStatus,
    pub display_name: Option<String>,
    pub deprecation_notice: Option<String>,
}

/// Callback trait for looking up registry entries.
pub trait RegistryLookup {
    fn lookup(&self, extension_name: &str) -> Option<RegistryEntryInfo>;
}

/// Simple HashMap-based registry for testing.
pub struct MapRegistry {
    entries: HashMap<String, RegistryEntryInfo>,
}

impl MapRegistry {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
        }
    }

    pub fn add(&mut self, entry: RegistryEntryInfo) {
        self.entries.insert(entry.name.clone(), entry);
    }
}

impl Default for MapRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl RegistryLookup for MapRegistry {
    fn lookup(&self, extension_name: &str) -> Option<RegistryEntryInfo> {
        self.entries.get(extension_name).cloned()
    }
}

// ── Item abstraction ────────────────────────────────────────────

/// Minimal item interface for extension validation.
pub trait ExtensionItem {
    /// The item's key.
    fn key(&self) -> &str;
    /// Extensions declared on this item (extension name → enabled).
    fn declared_extensions(&self) -> Vec<String>;
    /// Child items.
    fn children(&self) -> &[Self]
    where
        Self: Sized;
}

// ── Validation ──────────────────────────────────────────────────

/// Validate extension usage in an item tree against a registry.
pub fn validate_extension_usage<I: ExtensionItem>(
    items: &[I],
    registry: &dyn RegistryLookup,
) -> Vec<ExtensionUsageIssue> {
    let mut issues = Vec::new();
    walk_items(items, "", registry, &mut issues);
    issues
}

fn walk_items<I: ExtensionItem>(
    items: &[I],
    prefix: &str,
    registry: &dyn RegistryLookup,
    issues: &mut Vec<ExtensionUsageIssue>,
) {
    for item in items {
        let path = if prefix.is_empty() {
            item.key().to_string()
        } else {
            format!("{}.{}", prefix, item.key())
        };

        for ext_name in item.declared_extensions() {
            match registry.lookup(&ext_name) {
                None => {
                    issues.push(ExtensionUsageIssue {
                        path: path.clone(),
                        extension: ext_name.clone(),
                        severity: ExtensionSeverity::Error,
                        code: ExtensionErrorCode::UnresolvedExtension,
                        message: format!("Unresolved extension: {ext_name}"),
                    });
                }
                Some(entry) => {
                    match entry.status {
                        RegistryEntryStatus::Retired => {
                            issues.push(ExtensionUsageIssue {
                                path: path.clone(),
                                extension: ext_name.clone(),
                                severity: ExtensionSeverity::Warning,
                                code: ExtensionErrorCode::ExtensionRetired,
                                message: format!(
                                    "Extension retired: {}",
                                    entry.display_name.as_deref().unwrap_or(&ext_name)
                                ),
                            });
                        }
                        RegistryEntryStatus::Deprecated => {
                            let notice =
                                entry.deprecation_notice.as_deref().unwrap_or("deprecated");
                            issues.push(ExtensionUsageIssue {
                                path: path.clone(),
                                extension: ext_name.clone(),
                                severity: ExtensionSeverity::Info,
                                code: ExtensionErrorCode::ExtensionDeprecated,
                                message: format!(
                                    "Extension deprecated: {} — {notice}",
                                    entry.display_name.as_deref().unwrap_or(&ext_name)
                                ),
                            });
                        }
                        RegistryEntryStatus::Active | RegistryEntryStatus::Draft => {
                            // OK — no issue
                        }
                    }
                }
            }
        }

        walk_items(item.children(), &path, registry, issues);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestItem {
        key: String,
        extensions: Vec<String>,
        kids: Vec<TestItem>,
    }

    impl ExtensionItem for TestItem {
        fn key(&self) -> &str {
            &self.key
        }
        fn declared_extensions(&self) -> Vec<String> {
            self.extensions.clone()
        }
        fn children(&self) -> &[TestItem] {
            &self.kids
        }
    }

    fn make_registry() -> MapRegistry {
        let mut reg = MapRegistry::new();
        reg.add(RegistryEntryInfo {
            name: "x-formspec-url".to_string(),
            status: RegistryEntryStatus::Active,
            display_name: Some("URL Validation".to_string()),
            deprecation_notice: None,
        });
        reg.add(RegistryEntryInfo {
            name: "x-formspec-old".to_string(),
            status: RegistryEntryStatus::Deprecated,
            display_name: Some("Old Extension".to_string()),
            deprecation_notice: Some("Use x-formspec-new instead".to_string()),
        });
        reg.add(RegistryEntryInfo {
            name: "x-formspec-retired".to_string(),
            status: RegistryEntryStatus::Retired,
            display_name: Some("Retired Ext".to_string()),
            deprecation_notice: None,
        });
        reg
    }

    #[test]
    fn test_active_extension_passes() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "email".to_string(),
            extensions: vec!["x-formspec-url".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_unresolved_extension() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-unknown".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, ExtensionErrorCode::UnresolvedExtension);
        assert_eq!(issues[0].severity, ExtensionSeverity::Error);
    }

    #[test]
    fn test_deprecated_extension() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-old".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, ExtensionErrorCode::ExtensionDeprecated);
        assert_eq!(issues[0].severity, ExtensionSeverity::Info);
        assert!(issues[0].message.contains("Use x-formspec-new instead"));
    }

    #[test]
    fn test_retired_extension() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-retired".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, ExtensionErrorCode::ExtensionRetired);
        assert_eq!(issues[0].severity, ExtensionSeverity::Warning);
    }

    #[test]
    fn test_nested_items() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "group".to_string(),
            extensions: vec![],
            kids: vec![TestItem {
                key: "child".to_string(),
                extensions: vec!["x-missing".to_string()],
                kids: vec![],
            }],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].path, "group.child");
    }

    #[test]
    fn test_multiple_issues() {
        let registry = make_registry();
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-unknown".to_string(), "x-formspec-old".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 2);
    }

    // ── Draft status passes clean — extension-registry.md §3.1 ──

    /// Spec: extension-registry.md §3.1 — "Draft status passes clean (no issue emitted)"
    #[test]
    fn draft_extension_passes_clean() {
        let mut registry = MapRegistry::new();
        registry.add(RegistryEntryInfo {
            name: "x-formspec-draft".to_string(),
            status: RegistryEntryStatus::Draft,
            display_name: Some("Draft Extension".to_string()),
            deprecation_notice: None,
        });
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-draft".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert!(
            issues.is_empty(),
            "Draft extension should not produce issues"
        );
    }

    // ── Empty item tree — extension-registry.md §4 ──────────────

    /// Spec: extension-registry.md §4 — "Empty item tree produces no issues"
    #[test]
    fn empty_item_tree() {
        let registry = make_registry();
        let items: Vec<TestItem> = vec![];
        let issues = validate_extension_usage(&items, &registry);
        assert!(issues.is_empty());
    }

    // ── display_name being None in messages — extension-registry.md §3.2 ─

    /// Spec: extension-registry.md §3.2 — "Retired extension with None display_name uses extension name"
    #[test]
    fn retired_extension_none_display_name_uses_ext_name() {
        let mut registry = MapRegistry::new();
        registry.add(RegistryEntryInfo {
            name: "x-formspec-gone".to_string(),
            status: RegistryEntryStatus::Retired,
            display_name: None,
            deprecation_notice: None,
        });
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-gone".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, ExtensionErrorCode::ExtensionRetired);
        // When display_name is None, the message should use the extension name
        assert!(
            issues[0].message.contains("x-formspec-gone"),
            "msg: {}",
            issues[0].message
        );
    }

    /// Spec: extension-registry.md §3.2 — "Deprecated extension with None display_name uses extension name"
    #[test]
    fn deprecated_extension_none_display_name_uses_ext_name() {
        let mut registry = MapRegistry::new();
        registry.add(RegistryEntryInfo {
            name: "x-formspec-legacy".to_string(),
            status: RegistryEntryStatus::Deprecated,
            display_name: None,
            deprecation_notice: Some("Use x-formspec-new".to_string()),
        });
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-legacy".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, ExtensionErrorCode::ExtensionDeprecated);
        assert!(
            issues[0].message.contains("x-formspec-legacy"),
            "msg: {}",
            issues[0].message
        );
    }

    /// Spec: extension-registry.md §3.2 — "Deprecated without notice uses 'deprecated' fallback"
    #[test]
    fn deprecated_extension_no_notice_uses_fallback() {
        let mut registry = MapRegistry::new();
        registry.add(RegistryEntryInfo {
            name: "x-formspec-old2".to_string(),
            status: RegistryEntryStatus::Deprecated,
            display_name: Some("Old Extension 2".to_string()),
            deprecation_notice: None,
        });
        let items = vec![TestItem {
            key: "field".to_string(),
            extensions: vec!["x-formspec-old2".to_string()],
            kids: vec![],
        }];
        let issues = validate_extension_usage(&items, &registry);
        assert_eq!(issues.len(), 1);
        assert!(
            issues[0].message.contains("deprecated"),
            "msg: {}",
            issues[0].message
        );
    }
}
