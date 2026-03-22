//! Path normalization, tree lookup, and qualified repeat reference helpers.

use super::item_tree::ItemInfo;
use std::collections::HashMap;

pub(crate) fn find_item_by_path<'a>(items: &'a [ItemInfo], path: &str) -> Option<&'a ItemInfo> {
    for item in items {
        if item.path == path {
            return Some(item);
        }
        if let Some(found) = find_item_by_path(&item.children, path) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn find_item_by_path_mut<'a>(
    items: &'a mut [ItemInfo],
    path: &str,
) -> Option<&'a mut ItemInfo> {
    for item in items.iter_mut() {
        if item.path == path {
            return Some(item);
        }
        if let Some(found) = find_item_by_path_mut(&mut item.children, path) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn strip_indices(path: &str) -> String {
    let mut result = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '[' {
            for inner in chars.by_ref() {
                if inner == ']' {
                    break;
                }
            }
        } else {
            result.push(ch);
        }
    }

    result
}

pub(crate) fn to_wildcard_path(path: &str) -> String {
    let mut result = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '[' {
            let mut segment = String::new();
            let mut closed = false;

            for inner in chars.by_ref() {
                if inner == ']' {
                    closed = true;
                    break;
                }
                segment.push(inner);
            }

            result.push('[');
            if closed && !segment.is_empty() && segment.chars().all(|inner| inner.is_ascii_digit())
            {
                result.push('*');
            } else {
                result.push_str(&segment);
            }
            if closed {
                result.push(']');
            }
        } else {
            result.push(ch);
        }
    }

    result
}

pub(crate) fn parent_path(path: &str) -> Option<String> {
    path.rfind('.').map(|pos| path[..pos].to_string())
}

fn repeat_ancestors(path: &str) -> Vec<(String, String)> {
    let mut ancestors = Vec::new();
    let mut prefix = Vec::new();

    for segment in path.split('.') {
        prefix.push(segment.to_string());
        if let Some(bracket_pos) = segment.find('[')
            && segment.ends_with(']')
            && segment[bracket_pos + 1..segment.len() - 1]
                .chars()
                .all(|ch| ch.is_ascii_digit())
        {
            ancestors.push((segment[..bracket_pos].to_string(), prefix.join(".")));
        }
    }

    ancestors
}

fn is_ident_start(ch: char) -> bool {
    ch == '_' || ch.is_ascii_alphabetic()
}

fn is_ident_continue(ch: char) -> bool {
    ch == '_' || ch.is_ascii_alphanumeric()
}

fn replace_qualified_group_ref(
    expression: &str,
    group_name: &str,
    concrete_prefix: &str,
) -> String {
    let needle = format!("${group_name}.");
    let mut result = String::new();
    let mut search_from = 0usize;

    while let Some(found) = expression[search_from..].find(&needle) {
        let start = search_from + found;
        let field_start = start + needle.len();
        let Some(first_char) = expression[field_start..].chars().next() else {
            break;
        };
        if !is_ident_start(first_char) {
            result.push_str(&expression[search_from..field_start]);
            search_from = field_start;
            continue;
        }

        let mut field_end = field_start + first_char.len_utf8();
        for ch in expression[field_end..].chars() {
            if !is_ident_continue(ch) {
                break;
            }
            field_end += ch.len_utf8();
        }

        result.push_str(&expression[search_from..start]);
        result.push('$');
        result.push_str(concrete_prefix);
        result.push('.');
        result.push_str(&expression[field_start..field_end]);
        search_from = field_end;
    }

    result.push_str(&expression[search_from..]);
    result
}

pub(crate) fn internal_path_to_fel_path(path: &str) -> String {
    let mut result = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '[' {
            result.push(ch);
            continue;
        }

        let mut index = String::new();
        let mut closed = false;
        while let Some(inner) = chars.peek().copied() {
            chars.next();
            if inner == ']' {
                closed = true;
                break;
            }
            index.push(inner);
        }

        if closed
            && !index.is_empty()
            && index.chars().all(|digit| digit.is_ascii_digit())
            && let Ok(parsed) = index.parse::<usize>()
        {
            result.push('[');
            result.push_str(&(parsed + 1).to_string());
            result.push(']');
        } else {
            result.push('[');
            result.push_str(&index);
            if closed {
                result.push(']');
            }
        }
    }

    result
}

pub(crate) fn resolve_qualified_repeat_refs(expression: &str, current_item_path: &str) -> String {
    let mut normalized = expression.to_string();

    for (group_name, concrete_prefix) in repeat_ancestors(current_item_path).into_iter().rev() {
        let fel_prefix = internal_path_to_fel_path(&concrete_prefix);
        normalized = replace_qualified_group_ref(&normalized, &group_name, &fel_prefix);
    }

    normalized
}

pub(crate) fn collect_non_relevant(items: &[ItemInfo], out: &mut Vec<String>) {
    for item in items {
        if !item.relevant {
            out.push(item.path.clone());
        }
        collect_non_relevant(&item.children, out);
    }
}

pub(crate) fn collect_mip_state(
    items: &[ItemInfo],
    required: &mut HashMap<String, bool>,
    readonly: &mut HashMap<String, bool>,
) {
    for item in items {
        required.insert(item.path.clone(), item.required);
        readonly.insert(item.path.clone(), item.readonly);
        collect_mip_state(&item.children, required, readonly);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_indices() {
        assert_eq!(strip_indices("items[0].total"), "items.total");
        assert_eq!(strip_indices("a[1].b[2].c"), "a.b.c");
        assert_eq!(strip_indices("simple"), "simple");
        assert_eq!(strip_indices("naïve[0].café"), "naïve.café");
    }

    #[test]
    fn test_to_wildcard_path() {
        assert_eq!(to_wildcard_path("items[0].total"), "items[*].total");
        assert_eq!(to_wildcard_path("a[1].b[2].c"), "a[*].b[*].c");
        assert_eq!(to_wildcard_path("items[*].total"), "items[*].total");
        assert_eq!(to_wildcard_path("naïve[12].café"), "naïve[*].café");
    }

    #[test]
    fn qualified_repeat_refs_resolve_to_concrete_instance_paths() {
        assert_eq!(
            resolve_qualified_repeat_refs(
                "$line_items.qty * $line_items.price",
                "line_items[0].total",
            ),
            "$line_items[1].qty * $line_items[1].price",
        );
        assert_eq!(
            resolve_qualified_repeat_refs(
                "$qty * $unit_price * (1 - $orders.discount_pct / 100)",
                "orders[1].items[0].discounted_total",
            ),
            "$qty * $unit_price * (1 - $orders[2].discount_pct / 100)",
        );
    }
}
