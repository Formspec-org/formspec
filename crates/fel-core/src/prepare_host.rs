//! FEL source normalization before host evaluation (parity with TS `normalizeExpressionForWasmEvaluation`).
//!
//! Rewrites bare `$`, qualified repeat group refs (`$group.field`), and repeat row aliases into wildcard paths.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

static RE_TRAILING_INDEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\d+\]$").expect("valid regex"));
static RE_PATH_SEGMENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([^\[.\]]+\[\d+\]|[^\[.\]]+)").expect("valid regex"));
static RE_REPEAT_SEG: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(.+)\[(\d+)\]$").expect("valid regex"));
static RE_INDEX_BRACKET: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[(\d+)\]").expect("valid regex"));
static RE_REPEAT_ALIAS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(.*)\[(\d+)\]\.([^\[.\]]+)$").expect("valid regex"));

/// Inputs for [`prepare_fel_expression_for_host`], mirroring the engine WASM prepass.
#[derive(Debug, Clone)]
pub struct PrepareFelHostInput<'a> {
    /// Raw FEL expression.
    pub expression: &'a str,
    /// Dotted path of the item being evaluated (may include `[n]` indices).
    pub current_item_path: &'a str,
    /// When true, bare `$` (not `$identifier`) becomes `$` + current field leaf name.
    pub replace_self_ref: bool,
    /// Repeat row counts keyed by group base path (e.g. `line_items` → 2).
    pub repeat_counts: &'a HashMap<String, u32>,
    /// Keys from the flat field snapshot (e.g. `rows[0].score`) used to infer repeat aliases.
    pub field_paths: &'a [String],
}

/// One enclosing repeat instance along `current_item_path`.
#[derive(Debug, Clone)]
struct RepeatAncestor {
    group_path: String,
    index: usize,
}

fn is_ident_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// Strips trailing `[n]` from the last path segment (TS `splitIndexedPath` last + replace).
fn current_field_leaf(item_path: &str) -> String {
    let segments = path_segments(item_path);
    let Some(last) = segments.last().map(String::as_str) else {
        return String::new();
    };
    RE_TRAILING_INDEX.replace(last, "").to_string()
}

fn path_segments(path: &str) -> Vec<String> {
    // Same tokenization as TS `/[^.[\]]+\[\d+\]|[^.[\]]+/g` — `]` must not appear bare in a Rust char class.
    RE_PATH_SEGMENT
        .find_iter(path)
        .map(|m| m.as_str().to_string())
        .collect()
}

fn get_repeat_ancestors(path: &str, repeats: &HashMap<String, u32>) -> Vec<RepeatAncestor> {
    let mut ancestors = Vec::new();
    let mut current = String::new();

    for segment in path_segments(path) {
        if let Some(caps) = RE_REPEAT_SEG.captures(&segment) {
            let g1 = caps.get(1).expect("group 1").as_str();
            let idx: usize = caps
                .get(2)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            let new_base = if current.is_empty() {
                g1.to_string()
            } else {
                format!("{current}.{g1}")
            };
            if repeats.contains_key(&new_base) {
                ancestors.push(RepeatAncestor {
                    group_path: new_base.clone(),
                    index: idx,
                });
            }
            current = format!("{new_base}[{idx}]");
        } else {
            current = if current.is_empty() {
                segment.clone()
            } else {
                format!("{current}.{segment}")
            };
        }
    }
    ancestors
}

/// FEL uses 1-based repeat indices in paths; flat data uses 0-based.
fn to_fel_indexed_path(path: &str) -> String {
    RE_INDEX_BRACKET
        .replace_all(path, |caps: &regex::Captures| {
            let n: i64 = caps
                .get(1)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0);
            format!("[{}]", n + 1)
        })
        .to_string()
}

fn to_repeat_wildcard_path(alias: &str) -> String {
    match alias.rfind('.') {
        Some(i) => format!("{}[*].{}", &alias[..i], &alias[i + 1..]),
        None => format!("{alias}[*]"),
    }
}

fn build_repeat_aliases_sorted(paths: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut aliases = Vec::new();
    for p in paths {
        if let Some(caps) = RE_REPEAT_ALIAS.captures(p) {
            let base = caps.get(1).expect("base").as_str();
            let field = caps.get(3).expect("field").as_str();
            let alias = format!("{base}.{field}");
            if seen.insert(alias.clone()) {
                aliases.push(alias);
            }
        }
    }
    aliases.sort_by(|a, b| b.len().cmp(&a.len()));
    aliases
}

fn replace_bare_current_field_refs(expr: &str, current_field: &str) -> String {
    if current_field.is_empty() || !expr.contains('$') {
        return expr.to_string();
    }
    let chars: Vec<char> = expr.chars().collect();
    let mut out = String::with_capacity(expr.len() + current_field.len());
    let mut i = 0;
    let mut quote: Option<char> = None;

    while i < chars.len() {
        let c = chars[i];
        if let Some(q) = quote {
            out.push(c);
            if c == '\\' && i + 1 < chars.len() {
                out.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == q {
                quote = None;
            }
            i += 1;
            continue;
        }
        if c == '"' || c == '\'' {
            quote = Some(c);
            out.push(c);
            i += 1;
            continue;
        }
        if c == '$' {
            let prev_ok = i == 0 || !is_ident_char(chars[i - 1]);
            let next_ok = i + 1 >= chars.len() || !is_ident_char(chars[i + 1]);
            if prev_ok && next_ok {
                out.push('$');
                out.push_str(current_field);
                i += 1;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

fn resolve_qualified_group_refs(expression: &str, repeat_ancestors: &[RepeatAncestor]) -> String {
    if repeat_ancestors.is_empty() {
        return expression.to_string();
    }

    let mut replacements: Vec<(String, String, bool)> = Vec::new();
    for (idx, anc) in repeat_ancestors.iter().enumerate() {
        let group_name = anc
            .group_path
            .rsplit('.')
            .next()
            .unwrap_or(anc.group_path.as_str())
            .to_string();
        let concrete_prefix = format!("{}[{}]", anc.group_path, anc.index);
        let is_innermost = idx == repeat_ancestors.len() - 1;
        replacements.push((group_name, concrete_prefix, is_innermost));
    }
    replacements.sort_by(|a, b| b.0.len().cmp(&a.0.len()));

    let mut result = expression.to_string();
    for (group_name, concrete_prefix, is_innermost) in replacements {
        let escaped = regex::escape(&group_name);
        let pattern = Regex::new(&format!(r"\${}\.([A-Za-z_][A-Za-z0-9_]*)", escaped))
            .expect("valid group pattern");
        result = pattern
            .replace_all(&result, |caps: &regex::Captures| {
                let field = caps.get(1).expect("field").as_str();
                if is_innermost {
                    field.to_string()
                } else {
                    format!("{}.{field}", to_fel_indexed_path(&concrete_prefix))
                }
            })
            .to_string();
    }
    result
}

fn is_blocked_implicit_prefix(c: char) -> bool {
    // Treat `.` as blocked so `rows.score` inside `x.rows.score` is not rewritten to
    // `x.$rows[*].score` (invalid FEL: `.` must be followed by an identifier, not `$`).
    is_ident_char(c) || matches!(c, '$' | '@' | '.')
}

fn suffix_continues_alias(c: Option<char>) -> bool {
    c.is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '[')
}

fn slice_eq_chars(chars: &[char], start: usize, needle: &[char]) -> bool {
    start + needle.len() <= chars.len() && chars[start..start + needle.len()] == needle[..]
}

/// Implicit `alias` → `wildcard`: prefix must be start or not `$@.` / identifier char; suffix must not continue an identifier.
fn replace_implicit_repeat_alias(expr: &str, alias: &str, wildcard: &str) -> String {
    if alias.is_empty() {
        return expr.to_string();
    }
    let chars: Vec<char> = expr.chars().collect();
    let needle: Vec<char> = alias.chars().collect();
    let mut out = String::with_capacity(expr.len());
    let mut i = 0;
    while i < chars.len() {
        if slice_eq_chars(&chars, i, &needle)
            && (i == 0 || !is_blocked_implicit_prefix(chars[i - 1]))
            && !suffix_continues_alias(chars.get(i + needle.len()).copied())
        {
            out.push_str(wildcard);
            i += needle.len();
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// Second pass: `$alias` → `wildcard` (look-ahead not available in the `regex` crate).
fn replace_explicit_dollar_repeat_alias(expr: &str, alias: &str, wildcard: &str) -> String {
    if alias.is_empty() {
        return expr.to_string();
    }
    let chars: Vec<char> = expr.chars().collect();
    let needle: Vec<char> = alias.chars().collect();
    let mut out = String::with_capacity(expr.len());
    let mut i = 0;
    while i < chars.len() {
        if chars.get(i) == Some(&'$')
            && slice_eq_chars(&chars, i + 1, &needle)
            && !suffix_continues_alias(chars.get(i + 1 + needle.len()).copied())
        {
            out.push_str(wildcard);
            i += 1 + needle.len();
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

fn apply_repeat_alias_pass(expr: &str, alias: &str, wildcard_with_dollar: &str) -> String {
    let after_implicit = replace_implicit_repeat_alias(expr, alias, wildcard_with_dollar);
    replace_explicit_dollar_repeat_alias(&after_implicit, alias, wildcard_with_dollar)
}

/// Owned inputs for [`prepare_fel_expression_owned`] after JSON / host parsing.
#[derive(Debug, Clone)]
pub struct PrepareFelHostOptionsOwned {
    /// Raw FEL expression.
    pub expression: String,
    /// Item path for repeat / self-ref normalization.
    pub current_item_path: String,
    /// When true, bare `$` becomes `$` + current field leaf name.
    pub replace_self_ref: bool,
    /// Repeat row counts by group base path.
    pub repeat_counts: HashMap<String, u32>,
    /// Flat field paths for repeat alias inference.
    pub field_paths: Vec<String>,
}

/// Parses prepare-FEL options from a JSON object (WASM / Python hosts).
pub fn prepare_fel_host_options_from_json_map(
    obj: &Map<String, Value>,
) -> Result<PrepareFelHostOptionsOwned, String> {
    let expression = obj
        .get("expression")
        .and_then(|x| x.as_str())
        .ok_or("expression (string) is required")?
        .to_string();
    let current_item_path = obj
        .get("currentItemPath")
        .or_else(|| obj.get("current_item_path"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let replace_self_ref = obj
        .get("replaceSelfRef")
        .or_else(|| obj.get("replace_self_ref"))
        .and_then(|x| x.as_bool())
        .unwrap_or(false);

    let mut repeat_counts: HashMap<String, u32> = HashMap::new();
    if let Some(rc) = obj
        .get("repeatCounts")
        .or_else(|| obj.get("repeat_counts"))
        .and_then(|x| x.as_object())
    {
        for (k, val) in rc.iter() {
            if let Some(n) = val
                .as_u64()
                .or_else(|| val.as_i64().filter(|&i| i >= 0).map(|i| i as u64))
            {
                if n <= u32::MAX as u64 {
                    repeat_counts.insert(k.clone(), n as u32);
                }
            }
        }
    }

    let mut field_paths: Vec<String> = Vec::new();
    if let Some(arr) = obj
        .get("fieldPaths")
        .or_else(|| obj.get("field_paths"))
        .and_then(|x| x.as_array())
    {
        for p in arr {
            if let Some(s) = p.as_str() {
                field_paths.push(s.to_string());
            }
        }
    } else if let Some(vmap) = obj
        .get("valuesByPath")
        .or_else(|| obj.get("values_by_path"))
        .and_then(|x| x.as_object())
    {
        field_paths.extend(vmap.keys().cloned());
    }

    Ok(PrepareFelHostOptionsOwned {
        expression,
        current_item_path,
        replace_self_ref,
        repeat_counts,
        field_paths,
    })
}

/// Normalizes using owned options (convenience after [`prepare_fel_host_options_from_json_map`]).
pub fn prepare_fel_expression_owned(opts: &PrepareFelHostOptionsOwned) -> String {
    prepare_fel_expression_for_host(PrepareFelHostInput {
        expression: &opts.expression,
        current_item_path: &opts.current_item_path,
        replace_self_ref: opts.replace_self_ref,
        repeat_counts: &opts.repeat_counts,
        field_paths: &opts.field_paths,
    })
}

/// Applies the same normalization pass the TypeScript engine runs before WASM FEL evaluation.
pub fn prepare_fel_expression_for_host(input: PrepareFelHostInput<'_>) -> String {
    let leaf = current_field_leaf(input.current_item_path);
    let mut normalized = input.expression.to_string();
    if input.replace_self_ref && !leaf.is_empty() {
        normalized = replace_bare_current_field_refs(&normalized, &leaf);
    }
    let ancestors = get_repeat_ancestors(input.current_item_path, input.repeat_counts);
    normalized = resolve_qualified_group_refs(&normalized, &ancestors);
    let aliases = build_repeat_aliases_sorted(input.field_paths);
    for alias in aliases {
        let wildcard = format!("${}", to_repeat_wildcard_path(&alias));
        normalized = apply_repeat_alias_pass(&normalized, &alias, &wildcard);
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prep(
        expr: &str,
        path: &str,
        replace: bool,
        repeats: &[(&str, u32)],
        paths: &[&str],
    ) -> String {
        let rc: HashMap<String, u32> = repeats.iter().map(|(k, v)| (k.to_string(), *v)).collect();
        let fp: Vec<String> = paths.iter().map(|s| (*s).to_string()).collect();
        prepare_fel_expression_for_host(PrepareFelHostInput {
            expression: expr,
            current_item_path: path,
            replace_self_ref: replace,
            repeat_counts: &rc,
            field_paths: &fp,
        })
    }

    #[test]
    fn bare_dollar_replaces_with_current_field_leaf() {
        assert_eq!(prep("$ * 2", "items[0].qty", true, &[], &[]), "$qty * 2");
    }

    #[test]
    fn qualified_innermost_repeat_becomes_sibling_field() {
        let out = prep(
            "$line_items.qty * $line_items.price",
            "line_items[0].total",
            false,
            &[("line_items", 2)],
            &[],
        );
        assert_eq!(out, "qty * price");
    }

    #[test]
    fn qualified_outer_repeat_uses_fel_one_based_indices() {
        let out = prep(
            "$orders.discount + $items.qty",
            "orders[0].items[1].line_total",
            false,
            &[("orders", 1), ("orders[0].items", 3)],
            &[],
        );
        assert_eq!(out, "orders[1].discount + qty");
    }

    #[test]
    fn repeat_alias_implicit_and_explicit() {
        let out = prep(
            "rows.score + $rows.score + x.rows.score",
            "",
            false,
            &[],
            &["rows[0].score", "rows[1].score"],
        );
        assert_eq!(out, "$rows[*].score + $rows[*].score + x.rows.score");
    }
}
