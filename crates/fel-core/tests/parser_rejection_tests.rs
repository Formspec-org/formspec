/// Parser rejection tests — verifying invalid inputs are rejected.
///
/// Addresses audit finding: "Zero parser rejection tests"
use fel_core::parse;

/// Assert that parsing the given input produces an error.
fn assert_rejects(input: &str) {
    match parse(input) {
        Err(_) => {} // expected
        Ok(ast) => panic!("expected parse error for {input:?}, got AST: {ast:?}"),
    }
}

// ── Duplicate object keys ───────────────────────────────────────

/// Spec: fel-grammar.md §4.2 L272-273 — "Duplicate keys within a single object
/// literal are a syntax error."
#[test]
fn duplicate_object_keys_rejected() {
    assert_rejects("{a: 1, a: 2}");
}

// ── Pipe operator ───────────────────────────────────────────────

/// Spec: fel-grammar.md §7 L385-386 — "MUST parse the |> (pipe) character
/// sequence as a syntax error in v1.0. This token is reserved for future use."
#[test]
fn pipe_operator_rejected() {
    assert_rejects("1 |> 2");
}

/// Spec: fel-grammar.md §7 L385-386 — pipe at start of expression
#[test]
fn pipe_operator_at_start_rejected() {
    assert_rejects("|> 2");
}

// ── Reserved words as function names ────────────────────────────

/// Spec: fel-grammar.md §3.3 L83-84 — "They MUST NOT be used as function names"
/// Note: `if(...)` is special-cased and IS allowed. Other reserved words are not
/// parsed as function calls because the parser treats them as keywords first.
#[test]
fn reserved_word_true_not_function() {
    // "true()" should fail because `true` is parsed as a boolean literal,
    // then `(` is unexpected trailing input
    assert_rejects("true()");
}

/// Spec: fel-grammar.md §3.3 L83-84 — reserved word as function name
#[test]
fn reserved_word_false_not_function() {
    assert_rejects("false()");
}

/// Spec: fel-grammar.md §3.3 L83-84 — reserved word as function name
#[test]
fn reserved_word_null_not_function() {
    assert_rejects("null()");
}

/// Spec: fel-grammar.md §3.3 L83-84 — reserved word as function name
#[test]
fn reserved_word_and_not_function() {
    assert_rejects("and()");
}

/// Spec: fel-grammar.md §3.3 L83-84 — reserved word as function name
#[test]
fn reserved_word_or_not_function() {
    assert_rejects("or()");
}

/// Spec: fel-grammar.md §3.3 L83-84 — reserved word as function name
#[test]
fn reserved_word_not_as_function() {
    // "not()" — `not` is a unary operator, so "not ( )" will try to parse
    // the inside of the parens as an expression — empty parens should fail
    assert_rejects("not()");
}

/// Spec: fel-grammar.md §4.1 L256-261 — "if is a reserved word... it cannot
/// match the Identifier production... if( is dispatched to FunctionCall"
#[test]
fn if_function_is_allowed() {
    // if(...) is explicitly special-cased
    let result = parse("if(true, 1, 2)");
    assert!(result.is_ok(), "if() function should be allowed");
}

// ── Leading/trailing dot numbers ────────────────────────────────

/// Spec: fel-grammar.md §3.5 L132 — "A leading dot is not permitted: .5 is invalid"
#[test]
fn leading_dot_number_rejected() {
    assert_rejects(".5");
}

/// Spec: fel-grammar.md §3.5 L133 — "A trailing dot is not permitted: 5. is invalid"
#[test]
fn trailing_dot_number_rejected() {
    // "5." should parse as number 5 followed by unexpected dot, or
    // the dot should cause the number to fail.
    // Current behavior: "5" is a number, "." is Dot, then Eof.
    // The parser sees "5" then ".field_name" but "." followed by Eof is an error
    // in the parser because it expects an identifier after Dot in postfix position.
    assert_rejects("5.");
}

// ── Unterminated grouping ───────────────────────────────────────

/// Spec: fel-grammar.md §7 L376-377 — "MUST reject all input strings that do not match"
#[test]
fn unterminated_parenthesis() {
    assert_rejects("(1 + 2");
}

/// Spec: fel-grammar.md §7 L376-377 — unterminated brackets
#[test]
fn unterminated_bracket() {
    assert_rejects("[1, 2");
}

/// Spec: fel-grammar.md §7 L376-377 — unterminated braces
#[test]
fn unterminated_brace() {
    assert_rejects("{a: 1");
}

/// Spec: fel-grammar.md §7 L376-377 — mismatched delimiters
#[test]
fn mismatched_delimiters() {
    assert_rejects("(1 + 2]");
}

// ── Empty expressions ───────────────────────────────────────────

/// Spec: fel-grammar.md §7 L376-377 — empty input is not a valid expression
#[test]
fn empty_expression_rejected() {
    assert_rejects("");
}

/// Correctness: whitespace-only is also invalid
#[test]
fn whitespace_only_rejected() {
    assert_rejects("   ");
}

// ── Trailing tokens ─────────────────────────────────────────────

/// Spec: fel-grammar.md §7 L374-375 — must consume entire input
#[test]
fn trailing_tokens_rejected() {
    assert_rejects("1 2");
}

/// Correctness: extra closing delimiter
#[test]
fn extra_closing_paren_rejected() {
    assert_rejects("(1 + 2))");
}

// ── Invalid syntax patterns ─────────────────────────────────────

/// Correctness: bare operator with no operands
#[test]
fn bare_plus_rejected() {
    assert_rejects("+");
}

/// Correctness: consecutive operators
#[test]
fn consecutive_operators_rejected() {
    assert_rejects("1 + + 2");
}

/// Correctness: missing then in if-then-else
#[test]
fn if_without_then_rejected() {
    assert_rejects("if true else false");
}

/// Correctness: missing else in if-then-else
#[test]
fn if_then_without_else_rejected() {
    assert_rejects("if true then 1");
}

/// Correctness: missing in keyword in let-binding
#[test]
fn let_without_in_rejected() {
    assert_rejects("let x = 5");
}

/// Correctness: object literal missing colon
#[test]
fn object_missing_colon_rejected() {
    assert_rejects("{a 1}");
}

/// Correctness: object literal missing value
#[test]
fn object_missing_value_rejected() {
    assert_rejects("{a:}");
}

/// Correctness: function call missing closing paren
#[test]
fn function_missing_close_paren_rejected() {
    assert_rejects("sum(1, 2");
}

/// Correctness: dangling comma in array
#[test]
fn trailing_comma_in_function_rejected() {
    // Trailing comma in function call is actually fine depending on parser.
    // Let's check: "sum(1,)" — empty arg after comma
    assert_rejects("sum(1,)");
}

/// Correctness: empty array is valid
#[test]
fn empty_array_is_valid() {
    let result = parse("[]");
    assert!(result.is_ok(), "empty array should be valid");
}

/// Correctness: empty object is valid
#[test]
fn empty_object_is_valid() {
    let result = parse("{}");
    assert!(result.is_ok(), "empty object should be valid");
}

/// Correctness: trailing comma in object is valid (per parser implementation)
#[test]
fn trailing_comma_in_object_is_valid() {
    let result = parse("{a: 1, b: 2,}");
    assert!(result.is_ok(), "trailing comma in object should be accepted");
}
