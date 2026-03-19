/// Comprehensive tests for the matches() regex engine.
///
/// Addresses audit finding: "matches() regex engine — 120 lines, zero tests"
///
/// The evaluator has a hand-rolled regex matcher (simple_match, match_regex,
/// match_recursive) that implements a subset of regex. These tests exercise it
/// through the public FEL API via the matches() function.
///
/// Known limitation (BUG): escape sequences (\d, \w, \s, etc.) do NOT work
/// with quantifiers (*, +, ?). The match_recursive function checks for
/// quantifiers at pat[pi+1], but when pat[pi] is '\\', the quantifier is
/// at pat[pi+2]. The quantifier check sees the escape letter (e.g., 'd')
/// instead of the quantifier, and falls through to the escape handler
/// which consumes \d but ignores the trailing quantifier.
use fel_core::*;

fn eval(input: &str) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::new();
    evaluate(&expr, &env).value
}

fn matches_true(text: &str, pattern: &str) {
    let expr = format!("matches('{text}', '{pattern}')");
    assert_eq!(
        eval(&expr),
        FelValue::Boolean(true),
        "expected matches('{text}', '{pattern}') = true"
    );
}

fn matches_false(text: &str, pattern: &str) {
    let expr = format!("matches('{text}', '{pattern}')");
    assert_eq!(
        eval(&expr),
        FelValue::Boolean(false),
        "expected matches('{text}', '{pattern}') = false"
    );
}

// ── Literal matching ────────────────────────────────────────────

/// Correctness: plain literal substring match (no regex chars)
#[test]
fn literal_substring_match() {
    matches_true("hello world", "world");
}

/// Correctness: literal match — not found
#[test]
fn literal_substring_no_match() {
    matches_false("hello world", "xyz");
}

/// Correctness: exact string match
#[test]
fn literal_exact_match() {
    matches_true("hello", "hello");
}

// ── Dot (any char) ──────────────────────────────────────────────

/// Spec: core/spec.llm.md L214 — "matches (regex)"
#[test]
fn dot_matches_any_char() {
    matches_true("abc", "a.c");
}

/// Correctness: dot does not match empty
#[test]
fn dot_requires_a_char() {
    matches_false("ac", "^a.c$");
}

// ── Star quantifier ─────────────────────────────────────────────

/// Correctness: .* matches zero or more of anything
#[test]
fn star_zero_or_more() {
    matches_true("abc", "a.*c");
    matches_true("ac", "a.*c"); // zero chars between a and c
}

/// Correctness: character + star
#[test]
fn char_star_repeated() {
    matches_true("aaa", "^a*$");
    matches_true("", "^a*$"); // zero a's
}

// ── Plus quantifier ─────────────────────────────────────────────

/// Correctness: + requires one or more matches
#[test]
fn plus_one_or_more() {
    matches_true("aaa", "^a+$");
    matches_false("", "^a+$"); // zero a's — should not match
}

/// Correctness: .+ matches one or more of anything
#[test]
fn dot_plus() {
    matches_true("abc", "^.+$");
    matches_false("", "^.+$");
}

// ── Question mark quantifier ────────────────────────────────────

/// Correctness: ? matches zero or one
#[test]
fn question_zero_or_one() {
    matches_true("ac", "^ab?c$");
    matches_true("abc", "^ab?c$");
    matches_false("abbc", "^ab?c$"); // two b's — should not match
}

// ── Anchors ─────────────────────────────────────────────────────

/// Correctness: ^ anchors to start
#[test]
fn caret_anchors_start() {
    matches_true("abc", "^abc");
    matches_false("xabc", "^abc");
}

/// Correctness: $ anchors to end
#[test]
fn dollar_anchors_end() {
    matches_true("abc", "abc$");
    matches_false("abcx", "abc$");
}

/// Correctness: both anchors for full match
#[test]
fn both_anchors_full_match() {
    matches_true("abc", "^abc$");
    matches_false("abcd", "^abc$");
    matches_false("xabc", "^abc$");
}

/// Correctness: pattern with only anchors
#[test]
fn empty_pattern_with_anchors() {
    matches_true("", "^$");
    matches_false("a", "^$");
}

// ── Character class escapes (single match, no quantifier) ───────
// Note: escape sequences work for SINGLE matches but NOT with quantifiers.
// See BUG note at top of file.

/// Correctness: \\d matches a single digit
#[test]
fn backslash_d_matches_single_digit() {
    // In FEL strings, \\ becomes \, so the pattern is \d
    let result = eval(r#"matches('a1b', '\\d')"#);
    assert_eq!(result, FelValue::Boolean(true));
}

/// Correctness: \\d does not match non-digit (without quantifier)
#[test]
fn backslash_d_rejects_non_digit_single() {
    // "^\\d$" — single digit anchored — no quantifier, works fine
    let result = eval(r#"matches('a', '^\\d$')"#);
    assert_eq!(result, FelValue::Boolean(false));

    let result = eval(r#"matches('5', '^\\d$')"#);
    assert_eq!(result, FelValue::Boolean(true));
}

/// Correctness: \\s matches single whitespace
#[test]
fn backslash_s_matches_single_whitespace() {
    let result = eval(r#"matches(' ', '^\\s$')"#);
    assert_eq!(result, FelValue::Boolean(true));
}

// ── Escape sequences WITH quantifiers — known BUG ───────────────
// BUG: escape sequences (\d, \w, \s) followed by quantifiers (*, +, ?)
// Escape sequences with quantifiers — fixed by replacing hand-rolled engine with regex crate.

/// \\d+ matches one or more digits
#[test]
fn backslash_d_plus() {
    assert_eq!(eval(r#"matches('abc123', '\\d+')"#), FelValue::Boolean(true));
}

/// \\w+ matches one or more word characters
#[test]
fn backslash_w_plus() {
    assert_eq!(eval(r#"matches('hello_123', '^\\w+$')"#), FelValue::Boolean(true));
}

/// \\D+ matches non-digits
#[test]
fn backslash_upper_d_plus() {
    assert_eq!(eval(r#"matches('abc', '^\\D+$')"#), FelValue::Boolean(true));
}

/// \\W+ matches non-word chars
#[test]
fn backslash_upper_w_plus() {
    assert_eq!(eval(r#"matches('!@#', '^\\W+$')"#), FelValue::Boolean(true));
}

/// \\S+ matches non-whitespace
#[test]
fn backslash_upper_s_plus() {
    assert_eq!(eval(r#"matches('abc', '^\\S+$')"#), FelValue::Boolean(true));
}

/// \\d* matches zero or more digits
#[test]
fn backslash_d_star() {
    assert_eq!(eval(r#"matches('', '^\\d*$')"#), FelValue::Boolean(true));
}

/// Email-like pattern with \\w+
#[test]
fn email_like_pattern() {
    assert_eq!(eval(r#"matches('user@example.com', '\\w+@\\w+')"#), FelValue::Boolean(true));
}

/// Anchored \\d+ pattern
#[test]
fn anchored_digit_pattern() {
    assert_eq!(eval(r#"matches('12345', '^\\d+$')"#), FelValue::Boolean(true));
}

// ── Escape sequences in patterns (literal escapes, no quantifier) ──

/// Correctness: literal dot via escape
#[test]
fn escaped_dot_matches_literal_dot() {
    let result = eval(r#"matches('a.b', 'a\\.b')"#);
    assert_eq!(result, FelValue::Boolean(true));
}

/// Correctness: escaped dot should not match arbitrary char
#[test]
fn escaped_dot_rejects_non_dot() {
    let result = eval(r#"matches('axb', '^a\\.b$')"#);
    assert_eq!(result, FelValue::Boolean(false));
}

// ── Edge cases ──────────────────────────────────────────────────

/// Correctness: empty pattern matches anything (contains empty string)
#[test]
fn empty_pattern_matches_anything() {
    matches_true("hello", "");
    matches_true("", "");
}

/// Correctness: empty text with non-empty pattern
#[test]
fn empty_text_non_empty_pattern() {
    matches_false("", "abc");
}

/// Correctness: pattern with only star
#[test]
fn dot_star_matches_anything() {
    matches_true("anything", ".*");
    matches_true("", "^.*$");
}

// ── Null propagation ────────────────────────────────────────────

/// Spec: core/spec.llm.md L250 — "Evaluation errors... produce null + diagnostic"
#[test]
fn matches_null_text_returns_null() {
    assert_eq!(eval("matches(null, 'abc')"), FelValue::Null);
}

/// Correctness: null pattern returns null
#[test]
fn matches_null_pattern_returns_null() {
    assert_eq!(eval("matches('abc', null)"), FelValue::Null);
}

// ── Combined patterns (no escape quantifiers) ───────────────────

/// Correctness: greedy matching with backtracking
#[test]
fn greedy_backtracking() {
    // ".*b" on "abab" — greedy .* should consume as much as possible then backtrack
    matches_true("abab", ".*b");
}

/// Correctness: multiple quantifiers in sequence
#[test]
fn multiple_quantifiers() {
    matches_true("aaabbb", "^a+b+$");
    matches_false("aaa", "^a+b+$");
}

/// Correctness: question mark in complex pattern
#[test]
fn question_mark_in_pattern() {
    matches_true("color", "^colou?r$");
    matches_true("colour", "^colou?r$");
}

/// Correctness: dot with quantifiers
#[test]
fn dot_with_various_quantifiers() {
    matches_true("a", "^.?$");   // zero or one char
    matches_true("", "^.?$");    // zero chars
    matches_false("ab", "^.?$"); // two chars — doesn't match .?
}
