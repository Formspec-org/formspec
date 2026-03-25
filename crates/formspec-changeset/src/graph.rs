//! Dependency graph construction and connected-component grouping.
//!
//! Given a set of [`RecordedEntry`] values, builds a graph where edges
//! represent "entry B references a key that entry A created". Connected
//! components become [`DependencyGroup`]s that must be accepted or
//! rejected together.

use serde::Serialize;

use crate::extract::{RecordedEntry, extract_keys};

/// A dependency group — entries within a group are coupled and must be
/// accepted or rejected as a unit.
#[derive(Debug, Clone, Serialize)]
pub struct DependencyGroup {
    /// Indices into the original entries array.
    pub entries: Vec<usize>,
    /// Human-readable explanation of why these entries are grouped.
    pub reason: String,
}

/// Compute dependency groups from a set of recorded changeset entries.
///
/// Algorithm:
/// 1. Extract created/referenced keys for each entry.
/// 2. Build a `key -> creator entry index` map.
/// 3. For each reference in entry B, if the key was created by entry A,
///    union A and B.
/// 4. Collect connected components via union-find.
/// 5. Each component becomes a `DependencyGroup`.
pub fn compute_dependency_groups(entries: &[RecordedEntry]) -> Vec<DependencyGroup> {
    let n = entries.len();
    if n == 0 {
        return Vec::new();
    }
    if n == 1 {
        return vec![DependencyGroup {
            entries: vec![0],
            reason: "single entry".to_string(),
        }];
    }

    // Step 1: extract keys per entry
    let entry_keys: Vec<_> = entries.iter().map(|e| extract_keys(e)).collect();

    // Step 2: build key -> creator index map
    let mut key_to_creator: std::collections::HashMap<&str, usize> =
        std::collections::HashMap::new();
    for (i, ek) in entry_keys.iter().enumerate() {
        for key in &ek.creates {
            key_to_creator.insert(key.as_str(), i);
        }
    }

    // Step 3: union-find
    let mut parent: Vec<usize> = (0..n).collect();
    let mut rank: Vec<usize> = vec![0; n];

    fn find(parent: &mut [usize], x: usize) -> usize {
        let mut root = x;
        while parent[root] != root {
            root = parent[root];
        }
        // Path compression
        let mut current = x;
        while parent[current] != root {
            let next = parent[current];
            parent[current] = root;
            current = next;
        }
        root
    }

    fn union(parent: &mut [usize], rank: &mut [usize], a: usize, b: usize) {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra == rb {
            return;
        }
        if rank[ra] < rank[rb] {
            parent[ra] = rb;
        } else if rank[ra] > rank[rb] {
            parent[rb] = ra;
        } else {
            parent[rb] = ra;
            rank[ra] += 1;
        }
    }

    // Track which shared keys caused grouping (for the reason string)
    let mut shared_keys: std::collections::HashMap<usize, std::collections::BTreeSet<String>> =
        std::collections::HashMap::new();

    for (b, ek) in entry_keys.iter().enumerate() {
        for ref_key in &ek.references {
            if let Some(&a) = key_to_creator.get(ref_key.as_str()) {
                if a != b {
                    let root_before_a = find(&mut parent, a);
                    let root_before_b = find(&mut parent, b);
                    union(&mut parent, &mut rank, a, b);
                    let new_root = find(&mut parent, a);

                    // Merge shared-key sets into the new root
                    let mut merged: std::collections::BTreeSet<String> =
                        std::collections::BTreeSet::new();
                    if let Some(existing) = shared_keys.remove(&root_before_a) {
                        merged.extend(existing);
                    }
                    if let Some(existing) = shared_keys.remove(&root_before_b) {
                        merged.extend(existing);
                    }
                    merged.insert(ref_key.clone());
                    shared_keys.insert(new_root, merged);
                }
            }
        }
    }

    // Step 4: collect connected components
    let mut components: std::collections::HashMap<usize, Vec<usize>> =
        std::collections::HashMap::new();
    for i in 0..n {
        let root = find(&mut parent, i);
        components.entry(root).or_default().push(i);
    }

    // Step 5: build DependencyGroup per component
    let mut groups: Vec<DependencyGroup> = components
        .into_iter()
        .map(|(root, mut entries)| {
            entries.sort();
            let reason = if entries.len() == 1 {
                "independent entry".to_string()
            } else if let Some(keys) = shared_keys.get(&root) {
                let key_list: Vec<&str> = keys.iter().map(String::as_str).collect();
                format!("shared dependencies on: {}", key_list.join(", "))
            } else {
                "connected entries".to_string()
            };
            DependencyGroup { entries, reason }
        })
        .collect();

    // Sort groups by first entry index for deterministic output
    groups.sort_by_key(|g| g.entries[0]);
    groups
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::{RecordedCommand, RecordedEntry};
    use serde_json::json;

    fn entry(commands: Vec<Vec<RecordedCommand>>) -> RecordedEntry {
        RecordedEntry {
            commands,
            tool_name: None,
        }
    }

    fn cmd(cmd_type: &str, payload: serde_json::Value) -> RecordedCommand {
        RecordedCommand {
            cmd_type: cmd_type.to_string(),
            payload,
        }
    }

    #[test]
    fn empty_entries() {
        let groups = compute_dependency_groups(&[]);
        assert!(groups.is_empty());
    }

    #[test]
    fn single_entry_single_group() {
        let entries = vec![entry(vec![vec![cmd(
            "definition.addItem",
            json!({"key": "name", "type": "text"}),
        )]])];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0]);
        assert_eq!(groups[0].reason, "single entry");
    }

    #[test]
    fn two_independent_entries_two_groups() {
        let entries = vec![
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "name", "type": "text"}),
            )]]),
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "email", "type": "text"}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].entries, vec![0]);
        assert_eq!(groups[1].entries, vec![1]);
        assert_eq!(groups[0].reason, "independent entry");
        assert_eq!(groups[1].reason, "independent entry");
    }

    #[test]
    fn two_entries_b_references_a_one_group() {
        let entries = vec![
            // Entry A: creates "email"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "email", "type": "text"}),
            )]]),
            // Entry B: references "email" via setBind
            entry(vec![vec![cmd(
                "definition.setBind",
                json!({"path": "email", "properties": {"required": true}}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0, 1]);
        assert!(groups[0].reason.contains("email"));
    }

    #[test]
    fn three_entries_ab_dependent_c_independent_two_groups() {
        let entries = vec![
            // Entry A: creates "name"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "name", "type": "text"}),
            )]]),
            // Entry B: references "name"
            entry(vec![vec![cmd(
                "definition.addBind",
                json!({"path": "name", "properties": {"required": true}}),
            )]]),
            // Entry C: creates "age" (independent)
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "age", "type": "number"}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 2);
        // Group 1: entries 0 and 1 (connected via "name")
        assert_eq!(groups[0].entries, vec![0, 1]);
        // Group 2: entry 2 (independent)
        assert_eq!(groups[1].entries, vec![2]);
    }

    #[test]
    fn chain_a_creates_x_b_refs_x_creates_y_c_refs_y_one_group() {
        let entries = vec![
            // Entry A: creates "price"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "price", "type": "number"}),
            )]]),
            // Entry B: creates "quantity" and references "price" via FEL
            entry(vec![
                vec![cmd(
                    "definition.addItem",
                    json!({"key": "quantity", "type": "number"}),
                )],
                vec![cmd(
                    "definition.setBind",
                    json!({"path": "quantity", "properties": {"constraint": "$price > 0"}}),
                )],
            ]),
            // Entry C: references "quantity" via FEL
            entry(vec![vec![cmd(
                "definition.setBind",
                json!({"path": "total", "properties": {"calculate": "$quantity * 2"}}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0, 1, 2]);
    }

    #[test]
    fn component_references_create_dependency() {
        let entries = vec![
            // Entry A: creates "email"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "email", "type": "text"}),
            )]]),
            // Entry B: component.setFieldWidget references "email"
            entry(vec![vec![cmd(
                "component.setFieldWidget",
                json!({"fieldKey": "email", "widget": "email-input"}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0, 1]);
    }

    #[test]
    fn component_add_node_bind_creates_dependency() {
        let entries = vec![
            // Entry A: creates "phone"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "phone", "type": "text"}),
            )]]),
            // Entry B: component.addNode with bind = "phone"
            entry(vec![vec![cmd(
                "component.addNode",
                json!({"pageIndex": 0, "node": {"bind": "phone", "type": "input"}}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0, 1]);
    }

    #[test]
    fn fel_expression_creates_dependency() {
        let entries = vec![
            // Entry A: creates "subtotal"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "subtotal", "type": "number"}),
            )]]),
            // Entry B: creates "total" with FEL ref to $subtotal
            entry(vec![
                vec![cmd(
                    "definition.addItem",
                    json!({"key": "total", "type": "number"}),
                )],
                vec![cmd(
                    "definition.setBind",
                    json!({"path": "total", "properties": {"calculate": "$subtotal * 1.1"}}),
                )],
            ]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].entries, vec![0, 1]);
    }

    #[test]
    fn four_entries_two_independent_pairs() {
        let entries = vec![
            // Pair 1: A creates "name", B refs "name"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "name", "type": "text"}),
            )]]),
            entry(vec![vec![cmd(
                "definition.setBind",
                json!({"path": "name", "properties": {"required": true}}),
            )]]),
            // Pair 2: C creates "age", D refs "age"
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "age", "type": "number"}),
            )]]),
            entry(vec![vec![cmd(
                "definition.setBind",
                json!({"path": "age", "properties": {"constraint": "$age >= 0"}}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].entries, vec![0, 1]);
        assert_eq!(groups[1].entries, vec![2, 3]);
    }

    #[test]
    fn reason_includes_shared_keys() {
        let entries = vec![
            entry(vec![vec![cmd(
                "definition.addItem",
                json!({"key": "email", "type": "text"}),
            )]]),
            entry(vec![vec![cmd(
                "definition.addBind",
                json!({"path": "email", "properties": {"required": true}}),
            )]]),
        ];
        let groups = compute_dependency_groups(&entries);
        assert_eq!(groups.len(), 1);
        assert!(
            groups[0].reason.contains("email"),
            "reason should mention the shared key: {}",
            groups[0].reason
        );
    }
}
