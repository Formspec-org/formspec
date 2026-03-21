//! Pass 6: Theme document semantic checks (W700-W711, E710).
//!
//! Validates token values by naming convention, token reference integrity,
//! cross-artifact consistency (when a definition is provided), and page semantics.

use std::collections::HashSet;

use serde_json::Value;

use crate::types::LintDiagnostic;

const PASS: u8 = 6;

// ── Token classification ────────────────────────────────────────

/// Token category inferred from its dotted name.
#[derive(Debug, PartialEq)]
enum TokenCategory {
    Color,
    Spacing,
    FontWeight,
    LineHeight,
    Other,
}

fn classify_token(name: &str) -> TokenCategory {
    let lower = name.to_ascii_lowercase();
    // Check prefix-based categories first, then substring/suffix.
    if lower.starts_with("color") || lower.contains(".color") {
        return TokenCategory::Color;
    }
    if lower.starts_with("spacing")
        || lower.starts_with("size")
        || lower.starts_with("sizing")
        || lower.contains(".spacing")
        || lower.contains(".size")
        || lower.contains(".sizing")
    {
        return TokenCategory::Spacing;
    }
    if lower.contains("fontweight") || lower.ends_with(".weight") {
        return TokenCategory::FontWeight;
    }
    if lower.contains("lineheight") || lower.ends_with(".line-height") {
        return TokenCategory::LineHeight;
    }
    TokenCategory::Other
}

// ── Value validators ────────────────────────────────────────────

/// Check if a string is a valid CSS color: hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA),
/// rgb(), rgba(), hsl(), hsla(), or CSS named colors.
fn is_css_color(s: &str) -> bool {
    let s = s.trim();
    if let Some(hex) = s.strip_prefix('#') {
        let len = hex.len();
        return (len == 3 || len == 4 || len == 6 || len == 8)
            && hex.chars().all(|c| c.is_ascii_hexdigit());
    }
    // Functional notation: rgb(), rgba(), hsl(), hsla()
    for prefix in &["rgba(", "rgb(", "hsla(", "hsl("] {
        if s.starts_with(prefix) && s.ends_with(')') {
            return true;
        }
    }
    // CSS named colors (Level 4)
    is_css_named_color(s)
}

/// CSS named colors from CSS Color Level 4.
/// Only checks the wrapper format, not exhaustive enumeration — we accept any
/// lowercase-matching name from the CSS specification.
fn is_css_named_color(s: &str) -> bool {
    const NAMED_COLORS: &[&str] = &[
        "aliceblue",
        "antiquewhite",
        "aqua",
        "aquamarine",
        "azure",
        "beige",
        "bisque",
        "black",
        "blanchedalmond",
        "blue",
        "blueviolet",
        "brown",
        "burlywood",
        "cadetblue",
        "chartreuse",
        "chocolate",
        "coral",
        "cornflowerblue",
        "cornsilk",
        "crimson",
        "cyan",
        "darkblue",
        "darkcyan",
        "darkgoldenrod",
        "darkgray",
        "darkgreen",
        "darkgrey",
        "darkkhaki",
        "darkmagenta",
        "darkolivegreen",
        "darkorange",
        "darkorchid",
        "darkred",
        "darksalmon",
        "darkseagreen",
        "darkslateblue",
        "darkslategray",
        "darkslategrey",
        "darkturquoise",
        "darkviolet",
        "deeppink",
        "deepskyblue",
        "dimgray",
        "dimgrey",
        "dodgerblue",
        "firebrick",
        "floralwhite",
        "forestgreen",
        "fuchsia",
        "gainsboro",
        "ghostwhite",
        "gold",
        "goldenrod",
        "gray",
        "green",
        "greenyellow",
        "grey",
        "honeydew",
        "hotpink",
        "indianred",
        "indigo",
        "ivory",
        "khaki",
        "lavender",
        "lavenderblush",
        "lawngreen",
        "lemonchiffon",
        "lightblue",
        "lightcoral",
        "lightcyan",
        "lightgoldenrodyellow",
        "lightgray",
        "lightgreen",
        "lightgrey",
        "lightpink",
        "lightsalmon",
        "lightseagreen",
        "lightskyblue",
        "lightslategray",
        "lightslategrey",
        "lightsteelblue",
        "lightyellow",
        "lime",
        "limegreen",
        "linen",
        "magenta",
        "maroon",
        "mediumaquamarine",
        "mediumblue",
        "mediumorchid",
        "mediumpurple",
        "mediumseagreen",
        "mediumslateblue",
        "mediumspringgreen",
        "mediumturquoise",
        "mediumvioletred",
        "midnightblue",
        "mintcream",
        "mistyrose",
        "moccasin",
        "navajowhite",
        "navy",
        "oldlace",
        "olive",
        "olivedrab",
        "orange",
        "orangered",
        "orchid",
        "palegoldenrod",
        "palegreen",
        "paleturquoise",
        "palevioletred",
        "papayawhip",
        "peachpuff",
        "peru",
        "pink",
        "plum",
        "powderblue",
        "purple",
        "rebeccapurple",
        "red",
        "rosybrown",
        "royalblue",
        "saddlebrown",
        "salmon",
        "sandybrown",
        "seagreen",
        "seashell",
        "sienna",
        "silver",
        "skyblue",
        "slateblue",
        "slategray",
        "slategrey",
        "snow",
        "springgreen",
        "steelblue",
        "tan",
        "teal",
        "thistle",
        "tomato",
        "turquoise",
        "violet",
        "wheat",
        "white",
        "whitesmoke",
        "yellow",
        "yellowgreen",
        "transparent",
    ];
    NAMED_COLORS.contains(&s.to_ascii_lowercase().as_str())
}

/// Valid CSS length units.
const CSS_LENGTH_UNITS: &[&str] = &[
    "px", "rem", "em", "vw", "vh", "%", "ch", "ex", "cm", "mm", "in", "pt", "pc",
];

/// Check if a string is a valid CSS length (e.g., "8px", "1rem", "50%", "0").
fn is_css_length(s: &str) -> bool {
    let s = s.trim();
    if s == "0" {
        return true;
    }
    for unit in CSS_LENGTH_UNITS {
        if let Some(num_part) = s.strip_suffix(unit) {
            return !num_part.is_empty() && num_part.parse::<f64>().is_ok();
        }
    }
    false
}

/// Check if a string is a valid font weight (100-900 in steps of 100, or "normal"/"bold").
fn is_font_weight(s: &str) -> bool {
    let s = s.trim();
    if s == "normal" || s == "bold" {
        return true;
    }
    if let Ok(n) = s.parse::<u32>() {
        return (100..=900).contains(&n) && n % 100 == 0;
    }
    false
}

/// Check if a string is a valid line height (unitless positive number).
fn is_line_height(s: &str) -> bool {
    let s = s.trim();
    match s.parse::<f64>() {
        Ok(n) => n > 0.0,
        Err(_) => false,
    }
}

// ── Token reference extraction ──────────────────────────────────

/// Extract all `$token.X` references from a string.
/// Returns the token name part (after `$token.`).
fn extract_token_refs(text: &str) -> Vec<&str> {
    let mut refs = Vec::new();
    let mut search_from = 0;
    while let Some(pos) = text[search_from..].find("$token.") {
        let abs_pos = search_from + pos;
        let name_start = abs_pos + 7; // len("$token.")
        if name_start >= text.len() {
            break;
        }
        // Token name: everything up to whitespace, comma, semicolon, quote, or end
        let name_end = text[name_start..]
            .find(|c: char| {
                c.is_whitespace()
                    || c == ','
                    || c == ';'
                    || c == '\''
                    || c == '"'
                    || c == ')'
                    || c == '}'
            })
            .map_or(text.len(), |e| name_start + e);
        if name_end > name_start {
            refs.push(&text[name_start..name_end]);
        }
        search_from = name_end;
    }
    refs
}

// ── Definition item path collection ─────────────────────────────

/// Collect all item keys and dotted paths from a definition's item tree.
/// Both bare keys (e.g., "amount") and full dotted paths (e.g., "lines.amount")
/// are included so that theme overrides can reference items either way.
fn collect_definition_item_keys(definition: &Value) -> HashSet<String> {
    let mut keys = HashSet::new();
    if let Some(items) = definition.get("items").and_then(|v| v.as_array()) {
        collect_item_paths(items, "", &mut keys);
    }
    keys
}

fn collect_item_paths(items: &[Value], prefix: &str, paths: &mut HashSet<String>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            let full = if prefix.is_empty() {
                key.to_string()
            } else {
                format!("{prefix}.{key}")
            };
            paths.insert(full.clone());
            paths.insert(key.to_string()); // bare key for top-level matching
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                collect_item_paths(children, &full, paths);
            }
        }
    }
}

// ── Token reference walking ─────────────────────────────────────

/// Walk a JSON value recursively, collecting token references from all string values.
/// Calls `visitor(path, token_name)` for each `$token.X` found.
fn walk_token_refs(
    value: &Value,
    path: &str,
    token_names: &HashSet<String>,
    diags: &mut Vec<LintDiagnostic>,
) {
    match value {
        Value::String(s) => {
            for token_name in extract_token_refs(s) {
                if !token_names.contains(token_name) {
                    diags.push(LintDiagnostic::warning(
                        "W704",
                        PASS,
                        path,
                        format!(
                            "Token reference '$token.{token_name}' not found in declared tokens"
                        ),
                    ));
                }
            }
        }
        Value::Object(map) => {
            for (k, v) in map {
                walk_token_refs(v, &format!("{path}.{k}"), token_names, diags);
            }
        }
        Value::Array(arr) => {
            for (i, v) in arr.iter().enumerate() {
                walk_token_refs(v, &format!("{path}[{i}]"), token_names, diags);
            }
        }
        _ => {}
    }
}

// ── Main entry point ────────────────────────────────────────────

/// Validate a theme document and return all diagnostics.
/// When `definition` is provided, cross-artifact checks (W705-W707) are enabled.
pub fn lint_theme(theme: &Value, definition: Option<&Value>) -> Vec<LintDiagnostic> {
    let mut diags = Vec::new();

    // Collect declared token names
    let token_names: HashSet<String> = theme
        .get("tokens")
        .and_then(|v| v.as_object())
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();

    // ── W700-W703: Token value validation ───────────────────────
    if let Some(tokens) = theme.get("tokens").and_then(|v| v.as_object()) {
        for (name, value) in tokens {
            let path = format!("$.tokens.{name}");
            let category = classify_token(name);
            let value_str = match value {
                Value::String(s) => Some(s.as_str()),
                Value::Number(n) => {
                    // Numbers are valid for line-height and font-weight; skip string checks for others.
                    match category {
                        TokenCategory::FontWeight => {
                            let repr = n.to_string();
                            if !is_font_weight(&repr) {
                                diags.push(LintDiagnostic::warning(
                                    "W702",
                                    PASS,
                                    &path,
                                    format!("Font weight token '{name}' has invalid value: {repr} (expected 100-900 in steps of 100, or 'normal'/'bold')"),
                                ));
                            }
                            None
                        }
                        TokenCategory::LineHeight => {
                            if let Some(f) = n.as_f64()
                                && f <= 0.0
                            {
                                diags.push(LintDiagnostic::warning(
                                        "W703",
                                        PASS,
                                        &path,
                                        format!("Line height token '{name}' must be a positive number, got: {f}"),
                                    ));
                            }
                            None
                        }
                        _ => None,
                    }
                }
                _ => None,
            };

            if let Some(s) = value_str {
                match category {
                    TokenCategory::Color => {
                        if !is_css_color(s) {
                            diags.push(LintDiagnostic::warning(
                                "W700",
                                PASS,
                                &path,
                                format!("Color token '{name}' has invalid CSS color value: '{s}'"),
                            ));
                        }
                    }
                    TokenCategory::Spacing => {
                        if !is_css_length(s) {
                            diags.push(LintDiagnostic::warning(
                                "W701",
                                PASS,
                                &path,
                                format!("Spacing/size token '{name}' has invalid CSS length value: '{s}'"),
                            ));
                        }
                    }
                    TokenCategory::FontWeight => {
                        if !is_font_weight(s) {
                            diags.push(LintDiagnostic::warning(
                                "W702",
                                PASS,
                                &path,
                                format!("Font weight token '{name}' has invalid value: '{s}' (expected 100-900 in steps of 100, or 'normal'/'bold')"),
                            ));
                        }
                    }
                    TokenCategory::LineHeight => {
                        if !is_line_height(s) {
                            diags.push(LintDiagnostic::warning(
                                "W703",
                                PASS,
                                &path,
                                format!("Line height token '{name}' must be a unitless positive number, got: '{s}'"),
                            ));
                        }
                    }
                    TokenCategory::Other => {}
                }
            }
        }
    }

    // ── W704: Token reference integrity ─────────────────────────
    // Walk defaults, selectors[].apply, selectors[].properties, items
    if let Some(defaults) = theme.get("defaults") {
        walk_token_refs(defaults, "$.defaults", &token_names, &mut diags);
    }
    if let Some(selectors) = theme.get("selectors").and_then(|v| v.as_array()) {
        for (i, selector) in selectors.iter().enumerate() {
            if let Some(apply) = selector.get("apply") {
                walk_token_refs(
                    apply,
                    &format!("$.selectors[{i}].apply"),
                    &token_names,
                    &mut diags,
                );
            }
            // Also check "properties" (used on main branch)
            if let Some(props) = selector.get("properties") {
                walk_token_refs(
                    props,
                    &format!("$.selectors[{i}].properties"),
                    &token_names,
                    &mut diags,
                );
            }
        }
    }
    if let Some(items) = theme.get("items").and_then(|v| v.as_object()) {
        for (key, block) in items {
            walk_token_refs(block, &format!("$.items.{key}"), &token_names, &mut diags);
        }
    }

    // ── E710: Duplicate page IDs ────────────────────────────────
    if let Some(pages) = theme.get("pages").and_then(|v| v.as_array()) {
        let mut seen_ids = HashSet::new();
        for (i, page) in pages.iter().enumerate() {
            if let Some(id) = page.get("id").and_then(|v| v.as_str())
                && !seen_ids.insert(id.to_string())
            {
                diags.push(LintDiagnostic::error(
                    "E710",
                    PASS,
                    format!("$.pages[{i}].id"),
                    format!("Duplicate page ID: '{id}'"),
                ));
            }
        }

        // ── W711: Responsive breakpoint key not declared ────────
        let breakpoint_names: HashSet<String> = theme
            .get("breakpoints")
            .and_then(|v| v.as_object())
            .map(|obj| obj.keys().cloned().collect())
            .unwrap_or_default();

        for (i, page) in pages.iter().enumerate() {
            if let Some(regions) = page.get("regions").and_then(|v| v.as_array()) {
                for (j, region) in regions.iter().enumerate() {
                    if let Some(responsive) = region.get("responsive").and_then(|v| v.as_object()) {
                        for bp_key in responsive.keys() {
                            if !breakpoint_names.contains(bp_key) {
                                diags.push(LintDiagnostic::warning(
                                    "W711",
                                    PASS,
                                    format!("$.pages[{i}].regions[{j}].responsive.{bp_key}"),
                                    format!("Responsive breakpoint '{bp_key}' not declared in theme breakpoints"),
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Cross-artifact checks (require definition) ──────────────
    if let Some(def) = definition {
        let item_keys = collect_definition_item_keys(def);

        // W705: theme items key doesn't match any definition item
        if let Some(items) = theme.get("items").and_then(|v| v.as_object()) {
            for key in items.keys() {
                if !item_keys.contains(key.as_str()) {
                    diags.push(LintDiagnostic::warning(
                        "W705",
                        PASS,
                        format!("$.items.{key}"),
                        format!(
                            "Theme item override '{key}' does not match any definition item path"
                        ),
                    ));
                }
            }
        }

        // W706: page region key doesn't match any definition item
        if let Some(pages) = theme.get("pages").and_then(|v| v.as_array()) {
            for (i, page) in pages.iter().enumerate() {
                if let Some(regions) = page.get("regions").and_then(|v| v.as_array()) {
                    for (j, region) in regions.iter().enumerate() {
                        if let Some(key) = region.get("key").and_then(|v| v.as_str())
                            && !item_keys.contains(key)
                        {
                            diags.push(LintDiagnostic::warning(
                                    "W706",
                                    PASS,
                                    format!("$.pages[{i}].regions[{j}].key"),
                                    format!("Page region key '{key}' does not match any definition item path"),
                                ));
                        }
                    }
                }
            }
        }

        // W707: targetDefinition.url doesn't match definition's url
        if let Some(target_url) = theme
            .get("targetDefinition")
            .and_then(|v| v.get("url"))
            .and_then(|v| v.as_str())
            && let Some(def_url) = def.get("url").and_then(|v| v.as_str())
            && target_url != def_url
        {
            diags.push(LintDiagnostic::warning(
                        "W707",
                        PASS,
                        "$.targetDefinition.url",
                        format!(
                            "Theme targets definition URL '{target_url}' but provided definition has URL '{def_url}'"
                        ),
                    ));
        }
    }

    diags
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper: find diagnostics with a specific code
    fn with_code<'a>(diags: &'a [LintDiagnostic], code: &str) -> Vec<&'a LintDiagnostic> {
        diags.iter().filter(|d| d.code == code).collect()
    }

    // ── 1. Empty theme — no diagnostics ─────────────────────────

    #[test]
    fn empty_theme_produces_no_diagnostics() {
        let theme = json!({});
        let diags = lint_theme(&theme, None);
        assert!(diags.is_empty());
    }

    #[test]
    fn minimal_theme_with_empty_tokens_produces_no_diagnostics() {
        let theme = json!({ "tokens": {} });
        let diags = lint_theme(&theme, None);
        assert!(diags.is_empty());
    }

    // ── 2. Valid hex color — no W700 ────────────────────────────

    #[test]
    fn valid_hex_color_no_w700() {
        let theme = json!({
            "tokens": {
                "color.primary": "#0057B7",
                "color.error": "#D32F2F",
                "color.transparent": "#00000000"
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W700").is_empty());
    }

    #[test]
    fn valid_short_hex_color_no_w700() {
        let theme = json!({ "tokens": { "color.bg": "#FFF" } });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W700").is_empty());
    }

    #[test]
    fn valid_functional_colors_no_w700() {
        let theme = json!({
            "tokens": {
                "color.a": "rgb(255, 0, 0)",
                "color.b": "rgba(0, 0, 0, 0.5)",
                "color.c": "hsl(120, 50%, 50%)",
                "color.d": "hsla(240, 100%, 50%, 0.7)"
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W700").is_empty());
    }

    // ── 3. Invalid color token value — W700 ─────────────────────

    #[test]
    fn invalid_color_emits_w700() {
        let theme = json!({
            "tokens": {
                "color.primary": "not-a-color"
            }
        });
        let diags = lint_theme(&theme, None);
        let w700 = with_code(&diags, "W700");
        assert_eq!(w700.len(), 1);
        assert!(w700[0].path.contains("color.primary"));
        assert!(w700[0].message.contains("not-a-color"));
    }

    #[test]
    fn invalid_hex_too_long_emits_w700() {
        let theme = json!({ "tokens": { "color.x": "#1234567890" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W700").len(), 1);
    }

    #[test]
    fn invalid_hex_bad_chars_emits_w700() {
        let theme = json!({ "tokens": { "color.x": "#GGHHII" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W700").len(), 1);
    }

    // ── 4. CSS length validation ────────────────────────────────

    #[test]
    fn valid_css_lengths_no_w701() {
        let theme = json!({
            "tokens": {
                "spacing.sm": "8px",
                "spacing.md": "1rem",
                "spacing.lg": "50%",
                "spacing.zero": "0",
                "size.icon": "24px",
                "sizing.header": "3em"
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W701").is_empty());
    }

    #[test]
    fn invalid_css_length_emits_w701() {
        let theme = json!({
            "tokens": {
                "spacing.bad": "not-a-length"
            }
        });
        let diags = lint_theme(&theme, None);
        let w701 = with_code(&diags, "W701");
        assert_eq!(w701.len(), 1);
        assert!(w701[0].message.contains("not-a-length"));
    }

    #[test]
    fn bare_number_string_invalid_length_emits_w701() {
        // "8" without a unit is not valid CSS length (only "0" is special)
        let theme = json!({ "tokens": { "spacing.x": "8" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W701").len(), 1);
    }

    // ── 5. Font weight validation ───────────────────────────────

    #[test]
    fn valid_font_weights_no_w702() {
        let theme = json!({
            "tokens": {
                "typography.fontweight.body": "400",
                "typography.fontweight.heading": "bold",
                "typography.fontweight.light": "normal"
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W702").is_empty());
    }

    #[test]
    fn valid_font_weight_numeric_range() {
        for w in (100..=900).step_by(100) {
            let theme = json!({ "tokens": { "typography.fontweight.x": w.to_string() } });
            let diags = lint_theme(&theme, None);
            assert!(
                with_code(&diags, "W702").is_empty(),
                "Weight {w} should be valid"
            );
        }
    }

    #[test]
    fn invalid_font_weight_350_emits_w702() {
        let theme = json!({
            "tokens": { "typography.fontweight.x": "350" }
        });
        let diags = lint_theme(&theme, None);
        let w702 = with_code(&diags, "W702");
        assert_eq!(w702.len(), 1);
        assert!(w702[0].message.contains("350"));
    }

    #[test]
    fn font_weight_zero_invalid() {
        let theme = json!({ "tokens": { "typography.fontweight.x": "0" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W702").len(), 1);
    }

    #[test]
    fn font_weight_1000_invalid() {
        let theme = json!({ "tokens": { "typography.fontweight.x": "1000" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W702").len(), 1);
    }

    // ── 6. Line height validation ───────────────────────────────

    #[test]
    fn valid_line_height_no_w703() {
        let theme = json!({
            "tokens": { "typography.lineheight.body": "1.5" }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W703").is_empty());
    }

    #[test]
    fn line_height_with_unit_invalid() {
        let theme = json!({
            "tokens": { "typography.lineheight.x": "1.5px" }
        });
        let diags = lint_theme(&theme, None);
        let w703 = with_code(&diags, "W703");
        assert_eq!(w703.len(), 1);
        assert!(w703[0].message.contains("1.5px"));
    }

    #[test]
    fn line_height_zero_invalid() {
        let theme = json!({ "tokens": { "typography.lineheight.x": "0" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W703").len(), 1);
    }

    #[test]
    fn line_height_negative_invalid() {
        let theme = json!({ "tokens": { "typography.lineheight.x": "-1.2" } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W703").len(), 1);
    }

    #[test]
    fn line_height_number_value_valid() {
        let theme = json!({ "tokens": { "typography.lineheight.x": 1.5 } });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W703").is_empty());
    }

    #[test]
    fn line_height_number_value_zero_invalid() {
        let theme = json!({ "tokens": { "typography.lineheight.x": 0 } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W703").len(), 1);
    }

    // ── 7. Token reference missing — W704 ───────────────────────

    #[test]
    fn missing_token_ref_emits_w704() {
        let theme = json!({
            "tokens": { "color.primary": "#000" },
            "defaults": {
                "style": { "color": "$token.missing" }
            }
        });
        let diags = lint_theme(&theme, None);
        let w704 = with_code(&diags, "W704");
        assert_eq!(w704.len(), 1);
        assert!(w704[0].message.contains("$token.missing"));
    }

    #[test]
    fn missing_token_ref_in_selector_apply() {
        let theme = json!({
            "tokens": {},
            "selectors": [{
                "match": "*",
                "apply": { "style": { "bg": "$token.nope" } }
            }]
        });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W704").len(), 1);
    }

    #[test]
    fn missing_token_ref_in_selector_properties() {
        let theme = json!({
            "tokens": {},
            "selectors": [{
                "match": "*",
                "properties": { "bg": "$token.nope" }
            }]
        });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W704").len(), 1);
    }

    #[test]
    fn missing_token_ref_in_items_override() {
        let theme = json!({
            "tokens": { "color.primary": "#000" },
            "items": {
                "field1": { "style": { "color": "$token.nonexistent" } }
            }
        });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W704").len(), 1);
    }

    // ── 8. Token reference — no W704 for existing ───────────────

    #[test]
    fn existing_token_ref_no_w704() {
        let theme = json!({
            "tokens": {
                "color.primary": "#0057B7",
                "spacing.md": "16px"
            },
            "defaults": {
                "style": {
                    "color": "$token.color.primary",
                    "padding": "$token.spacing.md"
                }
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W704").is_empty());
    }

    #[test]
    fn non_token_dollar_ref_ignored() {
        let theme = json!({
            "tokens": {},
            "defaults": { "style": { "content": "$fieldName" } }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W704").is_empty());
    }

    // ── 9. Duplicate page IDs — E710 ────────────────────────────

    #[test]
    fn duplicate_page_ids_emit_e710() {
        let theme = json!({
            "pages": [
                { "id": "info", "title": "Info" },
                { "id": "review", "title": "Review" },
                { "id": "info", "title": "Info Again" }
            ]
        });
        let diags = lint_theme(&theme, None);
        let e710 = with_code(&diags, "E710");
        assert_eq!(e710.len(), 1);
        assert!(e710[0].message.contains("info"));
        assert!(e710[0].path.contains("pages[2]"));
    }

    #[test]
    fn unique_page_ids_no_e710() {
        let theme = json!({
            "pages": [
                { "id": "page1", "title": "Page 1" },
                { "id": "page2", "title": "Page 2" }
            ]
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "E710").is_empty());
    }

    // ── 10. Token name classification ───────────────────────────

    #[test]
    fn classify_color_tokens() {
        assert_eq!(classify_token("color.primary"), TokenCategory::Color);
        assert_eq!(classify_token("Color.error"), TokenCategory::Color);
        assert_eq!(classify_token("brand.color.accent"), TokenCategory::Color);
        assert_eq!(classify_token("colorText"), TokenCategory::Color);
    }

    #[test]
    fn classify_spacing_tokens() {
        assert_eq!(classify_token("spacing.sm"), TokenCategory::Spacing);
        assert_eq!(classify_token("size.icon"), TokenCategory::Spacing);
        assert_eq!(classify_token("sizing.header"), TokenCategory::Spacing);
        assert_eq!(classify_token("layout.spacing.gap"), TokenCategory::Spacing);
        assert_eq!(classify_token("component.size.lg"), TokenCategory::Spacing);
    }

    #[test]
    fn classify_font_weight_tokens() {
        assert_eq!(
            classify_token("typography.fontweight.body"),
            TokenCategory::FontWeight
        );
        assert_eq!(classify_token("fontWeight"), TokenCategory::FontWeight);
        assert_eq!(classify_token("heading.weight"), TokenCategory::FontWeight);
    }

    #[test]
    fn classify_line_height_tokens() {
        assert_eq!(
            classify_token("typography.lineheight.body"),
            TokenCategory::LineHeight
        );
        assert_eq!(
            classify_token("body.line-height"),
            TokenCategory::LineHeight
        );
    }

    #[test]
    fn classify_other_tokens() {
        assert_eq!(classify_token("border.radius"), TokenCategory::Other);
        assert_eq!(classify_token("elevation.low"), TokenCategory::Other);
        assert_eq!(
            classify_token("typography.body.family"),
            TokenCategory::Other
        );
    }

    // ── 11. $token.X extraction ─────────────────────────────────

    #[test]
    fn extract_single_ref() {
        let refs = extract_token_refs("$token.color.primary");
        assert_eq!(refs, vec!["color.primary"]);
    }

    #[test]
    fn extract_multiple_refs() {
        let refs =
            extract_token_refs("border: 1px solid $token.color.border, bg: $token.color.surface");
        assert_eq!(refs, vec!["color.border", "color.surface"]);
    }

    #[test]
    fn extract_no_refs() {
        let refs = extract_token_refs("no tokens here $field.name");
        assert!(refs.is_empty());
    }

    #[test]
    fn extract_ref_at_end_of_string() {
        let refs = extract_token_refs("color: $token.x");
        assert_eq!(refs, vec!["x"]);
    }

    #[test]
    fn extract_ref_followed_by_delimiter() {
        let refs = extract_token_refs("'$token.abc'");
        assert_eq!(refs, vec!["abc"]);
    }

    // ── W711: Responsive breakpoint not declared ────────────────

    #[test]
    fn undeclared_breakpoint_emits_w711() {
        let theme = json!({
            "breakpoints": { "sm": 576, "md": 768 },
            "pages": [{
                "id": "p1",
                "regions": [{
                    "key": "field1",
                    "responsive": {
                        "sm": { "span": 12 },
                        "xl": { "span": 6 }
                    }
                }]
            }]
        });
        let diags = lint_theme(&theme, None);
        let w711 = with_code(&diags, "W711");
        assert_eq!(w711.len(), 1);
        assert!(w711[0].message.contains("xl"));
    }

    #[test]
    fn declared_breakpoint_no_w711() {
        let theme = json!({
            "breakpoints": { "sm": 576, "md": 768 },
            "pages": [{
                "id": "p1",
                "regions": [{
                    "key": "f",
                    "responsive": { "sm": { "span": 12 }, "md": { "span": 6 } }
                }]
            }]
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W711").is_empty());
    }

    #[test]
    fn no_breakpoints_declared_all_responsive_keys_warn() {
        let theme = json!({
            "pages": [{
                "id": "p1",
                "regions": [{
                    "key": "f",
                    "responsive": { "sm": { "span": 12 } }
                }]
            }]
        });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W711").len(), 1);
    }

    // ── Cross-artifact: W705-W707 ───────────────────────────────

    #[test]
    fn w705_theme_item_key_not_in_definition() {
        let theme = json!({
            "items": {
                "name": { "widget": "textInput" },
                "ghost": { "widget": "textarea" }
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint_theme(&theme, Some(&def));
        let w705 = with_code(&diags, "W705");
        assert_eq!(w705.len(), 1);
        assert!(w705[0].message.contains("ghost"));
    }

    #[test]
    fn w705_all_keys_match_no_warning() {
        let theme = json!({
            "items": { "name": { "widget": "textInput" } }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name", "dataType": "string" }]
        });
        let diags = lint_theme(&theme, Some(&def));
        assert!(with_code(&diags, "W705").is_empty());
    }

    #[test]
    fn w705_skipped_without_definition() {
        let theme = json!({
            "items": { "ghost": { "widget": "textInput" } }
        });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W705").is_empty());
    }

    #[test]
    fn w706_region_key_not_in_definition() {
        let theme = json!({
            "pages": [{
                "id": "p1",
                "regions": [
                    { "key": "name", "span": 12 },
                    { "key": "phantom", "span": 6 }
                ]
            }]
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }]
        });
        let diags = lint_theme(&theme, Some(&def));
        let w706 = with_code(&diags, "W706");
        assert_eq!(w706.len(), 1);
        assert!(w706[0].message.contains("phantom"));
    }

    #[test]
    fn w707_target_url_mismatch() {
        let theme = json!({
            "targetDefinition": {
                "url": "https://example.com/forms/other"
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/budget"
        });
        let diags = lint_theme(&theme, Some(&def));
        let w707 = with_code(&diags, "W707");
        assert_eq!(w707.len(), 1);
        assert!(w707[0].message.contains("other"));
        assert!(w707[0].message.contains("budget"));
    }

    #[test]
    fn w707_matching_url_no_warning() {
        let theme = json!({
            "targetDefinition": {
                "url": "https://example.com/forms/budget"
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "url": "https://example.com/forms/budget"
        });
        let diags = lint_theme(&theme, Some(&def));
        assert!(with_code(&diags, "W707").is_empty());
    }

    #[test]
    fn w707_skipped_when_definition_has_no_url() {
        let theme = json!({
            "targetDefinition": { "url": "https://example.com/forms/x" }
        });
        let def = json!({ "$formspec": "1.0", "items": [] });
        let diags = lint_theme(&theme, Some(&def));
        assert!(with_code(&diags, "W707").is_empty());
    }

    // ── All diagnostics use pass 6 ──────────────────────────────

    #[test]
    fn all_diagnostics_are_pass_6() {
        let theme = json!({
            "tokens": { "color.bad": "nope", "spacing.bad": "nah" },
            "defaults": { "style": { "x": "$token.ghost" } },
            "pages": [
                { "id": "dup" },
                { "id": "dup" }
            ]
        });
        let diags = lint_theme(&theme, None);
        assert!(!diags.is_empty());
        for d in &diags {
            assert_eq!(d.pass, 6, "Diagnostic {} should be pass 6", d.code);
        }
    }

    // ── Nested children found by cross-artifact checks ──────────

    #[test]
    fn w705_finds_nested_child_keys() {
        let theme = json!({
            "items": {
                "amount": { "widget": "numberInput" }
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{
                "key": "lines",
                "children": [{ "key": "amount", "dataType": "decimal" }]
            }]
        });
        let diags = lint_theme(&theme, Some(&def));
        assert!(
            with_code(&diags, "W705").is_empty(),
            "amount is a nested child, should match"
        );
    }

    /// Dotted nested path (e.g., "lines.amount") should match a nested child.
    #[test]
    fn w705_dotted_nested_path_matches() {
        let theme = json!({
            "items": {
                "lines.amount": { "widget": "numberInput" }
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{
                "key": "lines",
                "children": [{ "key": "amount", "dataType": "decimal" }]
            }]
        });
        let diags = lint_theme(&theme, Some(&def));
        assert!(
            with_code(&diags, "W705").is_empty(),
            "lines.amount is a valid dotted path, should not warn"
        );
    }

    /// Dotted path that doesn't correspond to the actual nesting should warn.
    #[test]
    fn w705_invalid_dotted_path_warns() {
        let theme = json!({
            "items": {
                "lines.ghost": { "widget": "numberInput" }
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{
                "key": "lines",
                "children": [{ "key": "amount", "dataType": "decimal" }]
            }]
        });
        let diags = lint_theme(&theme, Some(&def));
        assert_eq!(
            with_code(&diags, "W705").len(),
            1,
            "lines.ghost is not a valid path"
        );
    }

    /// Deeply nested dotted path (3 levels) should match.
    #[test]
    fn w705_deep_dotted_path_matches() {
        let theme = json!({
            "items": {
                "section.group.field": { "widget": "textInput" }
            }
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{
                "key": "section",
                "children": [{
                    "key": "group",
                    "children": [{ "key": "field", "dataType": "string" }]
                }]
            }]
        });
        let diags = lint_theme(&theme, Some(&def));
        assert!(
            with_code(&diags, "W705").is_empty(),
            "section.group.field is a valid dotted path"
        );
    }

    // ── Finding 56: rgb() content not validated ────────────────

    /// Spec: theme-spec.md §3.2 (line 251) — is_css_color intentionally only
    /// checks the wrapper format (rgb(...), hsl(...), etc), not the validity
    /// of the content inside the parentheses.
    #[test]
    fn functional_color_content_not_validated() {
        assert!(
            is_css_color("rgb(not, valid, at all)"),
            "is_css_color only checks the wrapper, not content validity"
        );
    }

    // ── Finding 57: Named CSS colors ─────────────────────────────

    /// Spec: theme-spec.md §3.2 (line 251) — "Colors (hex, rgb, hsl, named)".
    /// Named colors like "red", "navy", "transparent" must be accepted.
    #[test]
    fn named_css_colors_accepted() {
        for name in &[
            "red",
            "blue",
            "green",
            "navy",
            "transparent",
            "rebeccapurple",
            "coral",
        ] {
            assert!(
                is_css_color(name),
                "Named color '{name}' should be accepted"
            );
        }
    }

    /// Spec: theme-spec.md §3.2 — named colors are case-insensitive.
    #[test]
    fn named_css_colors_case_insensitive() {
        assert!(is_css_color("Red"));
        assert!(is_css_color("BLUE"));
        assert!(is_css_color("Navy"));
    }

    /// Spec: theme-spec.md §3.2 — named color tokens should not emit W700.
    #[test]
    fn named_color_token_no_w700() {
        let theme = json!({
            "tokens": {
                "color.primary": "red",
                "color.secondary": "navy",
                "color.bg": "transparent"
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(
            with_code(&diags, "W700").is_empty(),
            "Named colors should not emit W700"
        );
    }

    // ── Finding 58: 4-char hex (#RGBA) ───────────────────────────

    /// Spec: theme-spec.md §3.2 — "hex" includes CSS Color Level 4's #RGBA format.
    #[test]
    fn four_char_hex_rgba_accepted() {
        assert!(is_css_color("#F00A"), "#RGBA (4-char hex) should be valid");
        assert!(is_css_color("#abcd"), "lowercase #RGBA should be valid");
    }

    /// Spec: theme-spec.md §3.2 — #RGBA token should not emit W700.
    #[test]
    fn four_char_hex_token_no_w700() {
        let theme = json!({
            "tokens": { "color.overlay": "#0008" }
        });
        let diags = lint_theme(&theme, None);
        assert!(
            with_code(&diags, "W700").is_empty(),
            "#RGBA hex should not emit W700"
        );
    }

    // ── Finding 59: Negative CSS lengths ─────────────────────────

    /// Spec: theme-spec.md §3.2 — CSS allows negative lengths (e.g. margins).
    #[test]
    fn negative_css_length_accepted() {
        assert!(is_css_length("-8px"), "Negative px length should be valid");
        assert!(
            is_css_length("-1.5rem"),
            "Negative rem length should be valid"
        );
        assert!(is_css_length("-50%"), "Negative percentage should be valid");
    }

    // ── Finding 60: Whitespace between number and unit ───────────

    /// Spec: theme-spec.md §3.2 — CSS forbids whitespace between the number and unit.
    #[test]
    fn whitespace_between_number_and_unit_rejected() {
        assert!(
            !is_css_length("8 px"),
            "Whitespace before unit should be rejected"
        );
        assert!(
            !is_css_length("1 rem"),
            "Whitespace before rem should be rejected"
        );
    }

    // ── Finding 61: Region without key in W706 check ─────────────

    /// Spec: theme-spec.md §6.2, schemas/theme.schema.json — a region without
    /// a `key` field is skipped in the W706 check (no panic, no diagnostic).
    #[test]
    fn region_without_key_skipped_in_w706() {
        let theme = json!({
            "pages": [{
                "id": "p1",
                "regions": [
                    { "span": 12 },
                    { "key": "missing_field", "span": 6 }
                ]
            }]
        });
        let def = json!({
            "$formspec": "1.0",
            "items": [{ "key": "name" }]
        });
        let diags = lint_theme(&theme, Some(&def));
        // Only the region WITH a key should be checked — "missing_field" not in definition → W706
        let w706 = with_code(&diags, "W706");
        assert_eq!(
            w706.len(),
            1,
            "Only the region with key should produce W706"
        );
        assert!(w706[0].message.contains("missing_field"));
    }

    // ── Number-typed token values ───────────────────────────────

    #[test]
    fn font_weight_number_value_valid() {
        let theme = json!({ "tokens": { "typography.fontweight.x": 400 } });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "W702").is_empty());
    }

    #[test]
    fn font_weight_number_value_invalid() {
        let theme = json!({ "tokens": { "typography.fontweight.x": 350 } });
        let diags = lint_theme(&theme, None);
        assert_eq!(with_code(&diags, "W702").len(), 1);
    }

    // ── Empty pages array ────────────────────────────────────────

    /// Spec: theme-spec.md §5 — empty pages array is valid (no pages defined)
    #[test]
    fn empty_pages_array_no_diagnostics() {
        let theme = json!({ "pages": [] });
        let diags = lint_theme(&theme, None);
        assert!(with_code(&diags, "E710").is_empty());
        assert!(with_code(&diags, "W711").is_empty());
    }

    // ── Pages without id fields ─────────────────────────────────

    /// Spec: theme-spec.md §5 — pages without an id field do not trigger E710
    /// (they simply don't participate in duplicate checking)
    #[test]
    fn pages_without_id_skip_duplicate_check() {
        let theme = json!({
            "pages": [
                { "title": "Step 1" },
                { "title": "Step 2" },
                { "id": "review", "title": "Review" }
            ]
        });
        let diags = lint_theme(&theme, None);
        assert!(
            with_code(&diags, "E710").is_empty(),
            "Pages without id should be silently skipped"
        );
    }

    // ── $token. in non-string contexts ──────────────────────────

    /// Spec: theme-spec.md §3 — $token. references are only extracted from string values;
    /// numeric or boolean values do not trigger token reference checks.
    #[test]
    fn token_ref_in_numeric_value_not_checked() {
        let theme = json!({
            "tokens": {},
            "defaults": {
                "columns": 3,
                "visible": true
            }
        });
        let diags = lint_theme(&theme, None);
        assert!(
            with_code(&diags, "W704").is_empty(),
            "Non-string values should not be checked for token refs"
        );
    }
}
