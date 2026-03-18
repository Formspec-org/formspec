//! Dotted path normalization and tree item navigation by path.

/// Dotted path normalization and tree navigation utilities.
///
/// Paths use dot notation: `group.field`, `parent.child.leaf`.
/// Indices `[N]` and wildcards `[*]` are stripped during normalization.

/// Strip repeat indices from a single path segment: `lineItems[0]` → `lineItems`.
pub fn normalize_path_segment(segment: &str) -> &str {
    match segment.find('[') {
        Some(idx) => &segment[..idx],
        None => segment,
    }
}

/// Strip all repeat indices from a dotted path.
/// `group[0].items[1].field` → `group.items.field`
pub fn normalize_indexed_path(path: &str) -> String {
    path.split('.')
        .map(normalize_path_segment)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(".")
}

/// Split a normalized dotted path into segments, filtering empties.
pub fn split_normalized_path(path: &str) -> Vec<&str> {
    let normalized = path;
    normalized
        .split('.')
        .map(normalize_path_segment)
        .filter(|s| !s.is_empty())
        .collect()
}

/// A generic tree node shape for path traversal.
pub trait TreeItem {
    fn key(&self) -> &str;
    fn children(&self) -> &[Self] where Self: Sized;
}

/// A resolved position in a tree: the parent slice, index within it, and the item itself.
#[derive(Debug)]
pub struct ItemLocation<'a, T> {
    pub parent: &'a [T],
    pub index: usize,
    pub item: &'a T,
}

/// Find an item by normalized dotted path, walking children at each segment.
pub fn item_at_path<'a, T: TreeItem>(items: &'a [T], path: &str) -> Option<&'a T> {
    let segments = split_normalized_path(path);
    if segments.is_empty() {
        return None;
    }

    let mut current_items = items;
    for (i, &seg) in segments.iter().enumerate() {
        let found = current_items.iter().find(|item| item.key() == seg)?;
        if i == segments.len() - 1 {
            return Some(found);
        }
        current_items = found.children();
    }
    None
}

/// Resolve the location triple (parent, index, item) for a dotted path.
pub fn item_location_at_path<'a, T: TreeItem>(items: &'a [T], path: &str) -> Option<ItemLocation<'a, T>> {
    let segments = split_normalized_path(path);
    if segments.is_empty() {
        return None;
    }

    let mut current_items = items;
    for (i, &seg) in segments.iter().enumerate() {
        let idx = current_items.iter().position(|item| item.key() == seg)?;
        let item = &current_items[idx];
        if i == segments.len() - 1 {
            return Some(ItemLocation {
                parent: current_items,
                index: idx,
                item,
            });
        }
        current_items = item.children();
    }
    None
}

/// Extract the parent path from a dotted path.
/// `group.child.field` → `group.child`
/// `field` → `""`
pub fn parent_path(path: &str) -> &str {
    match path.rfind('.') {
        Some(idx) => &path[..idx],
        None => "",
    }
}

/// Extract the last segment from a dotted path.
/// `group.child.field` → `field`
/// `field` → `field`
pub fn leaf_key(path: &str) -> &str {
    match path.rfind('.') {
        Some(idx) => &path[idx + 1..],
        None => path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Simple test tree node
    struct TestItem {
        key: String,
        kids: Vec<TestItem>,
    }

    impl TreeItem for TestItem {
        fn key(&self) -> &str {
            &self.key
        }
        fn children(&self) -> &[TestItem] {
            &self.kids
        }
    }

    fn item(key: &str, children: Vec<TestItem>) -> TestItem {
        TestItem { key: key.to_string(), kids: children }
    }

    fn leaf(key: &str) -> TestItem {
        TestItem { key: key.to_string(), kids: vec![] }
    }

    #[test]
    fn test_normalize_segment() {
        assert_eq!(normalize_path_segment("items[0]"), "items");
        assert_eq!(normalize_path_segment("items[*]"), "items");
        assert_eq!(normalize_path_segment("field"), "field");
    }

    #[test]
    fn test_normalize_indexed_path() {
        assert_eq!(normalize_indexed_path("group[0].items[1].field"), "group.items.field");
        assert_eq!(normalize_indexed_path("simple"), "simple");
        assert_eq!(normalize_indexed_path("a[0].b[*].c"), "a.b.c");
    }

    #[test]
    fn test_split_normalized_path() {
        assert_eq!(split_normalized_path("a.b.c"), vec!["a", "b", "c"]);
        assert_eq!(split_normalized_path("a[0].b"), vec!["a", "b"]);
        assert_eq!(split_normalized_path("single"), vec!["single"]);
    }

    #[test]
    fn test_item_at_path() {
        let tree = vec![
            item("personal", vec![
                leaf("name"),
                leaf("email"),
            ]),
            item("address", vec![
                leaf("city"),
                leaf("zip"),
            ]),
        ];

        assert_eq!(item_at_path(&tree, "personal.name").unwrap().key(), "name");
        assert_eq!(item_at_path(&tree, "address.city").unwrap().key(), "city");
        assert!(item_at_path(&tree, "personal.phone").is_none());
        assert!(item_at_path(&tree, "missing").is_none());
    }

    #[test]
    fn test_item_location_at_path() {
        let tree = vec![
            item("group", vec![
                leaf("field1"),
                leaf("field2"),
            ]),
        ];

        let loc = item_location_at_path(&tree, "group.field2").unwrap();
        assert_eq!(loc.item.key(), "field2");
        assert_eq!(loc.index, 1);
        assert_eq!(loc.parent.len(), 2); // parent has 2 children
    }

    #[test]
    fn test_parent_path() {
        assert_eq!(parent_path("group.child.field"), "group.child");
        assert_eq!(parent_path("group.field"), "group");
        assert_eq!(parent_path("field"), "");
    }

    #[test]
    fn test_leaf_key() {
        assert_eq!(leaf_key("group.child.field"), "field");
        assert_eq!(leaf_key("field"), "field");
    }
}
