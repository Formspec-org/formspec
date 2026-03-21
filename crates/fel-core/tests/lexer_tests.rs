/// Comprehensive lexer tests for FEL tokenization.
///
/// Addresses audit finding: "Lexer has almost no tests (7 tests, all string escapes)"
use fel_core::lexer::{Lexer, Token};
use fel_core::tokenize;
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

// ── Helper ──────────────────────────────────────────────────────

fn lex(input: &str) -> Result<Vec<Token>, String> {
    let mut lexer = Lexer::new(input);
    lexer
        .tokenize()
        .map(|tokens| tokens.into_iter().map(|st| st.token).collect())
}

fn lex_ok(input: &str) -> Vec<Token> {
    lex(input).unwrap_or_else(|e| panic!("lex error on {input:?}: {e}"))
}

/// Strip the trailing Eof for easier assertions.
fn tokens(input: &str) -> Vec<Token> {
    let mut toks = lex_ok(input);
    assert_eq!(toks.last(), Some(&Token::Eof), "expected trailing Eof");
    toks.pop();
    toks
}

// ── Number tokenization ─────────────────────────────────────────

/// Spec: fel-grammar.md §3.5 L127 — "NumberLiteral ← '-'? IntegerPart ('.' [0-9]+)? Exponent?"
#[test]
fn integer_zero() {
    assert_eq!(tokens("0"), vec![Token::Number(Decimal::ZERO)]);
}

/// Spec: fel-grammar.md §3.5 L128 — "IntegerPart ← '0' / [1-9] [0-9]*"
#[test]
fn integer_simple() {
    assert_eq!(tokens("42"), vec![Token::Number(Decimal::from(42))]);
}

/// Spec: fel-grammar.md §3.5 L128 — "IntegerPart ← '0' / [1-9] [0-9]*"
#[test]
fn integer_large() {
    assert_eq!(
        tokens("9999999"),
        vec![Token::Number(Decimal::from(9999999))]
    );
}

/// Spec: fel-grammar.md §3.5 L127 — fractional part "('.' [0-9]+)?"
#[test]
fn decimal_number() {
    assert_eq!(
        tokens("3.14"),
        vec![Token::Number(Decimal::from_str("3.14").unwrap())]
    );
}

/// Spec: fel-grammar.md §3.5 L129 — "Exponent ← ('e' / 'E') ('+' / '-')? [0-9]+"
#[test]
fn scientific_notation_lowercase_e() {
    assert_eq!(tokens("1e3"), vec![Token::Number(Decimal::from(1000))]);
}

/// Spec: fel-grammar.md §3.5 L129 — "Exponent ← ('e' / 'E') ('+' / '-')? [0-9]+"
#[test]
fn scientific_notation_uppercase_e() {
    assert_eq!(tokens("2E4"), vec![Token::Number(Decimal::from(20000))]);
}

/// Spec: fel-grammar.md §3.5 L129 — negative exponent
#[test]
fn scientific_notation_negative_exponent() {
    // 1E-5 = 0.00001
    let toks = tokens("1E-5");
    match &toks[0] {
        Token::Number(n) => {
            let expected = Decimal::from_str("0.00001").unwrap();
            // Allow small rounding from f64 fallback path
            assert!(
                (*n - expected).abs() < Decimal::from_str("0.0000001").unwrap(),
                "expected ~0.00001, got {n}"
            );
        }
        other => panic!("expected Number, got {other:?}"),
    }
}

/// Spec: fel-grammar.md §3.5 L129 — positive exponent sign
#[test]
fn scientific_notation_positive_sign() {
    assert_eq!(tokens("5e+2"), vec![Token::Number(Decimal::from(500))]);
}

/// Spec: fel-grammar.md §3.5 L127 — decimal with exponent
#[test]
fn decimal_with_exponent() {
    // 1.5e2 = 150
    assert_eq!(tokens("1.5e2"), vec![Token::Number(Decimal::from(150))]);
}

/// Spec: fel-grammar.md §3.5 L128 — leading zeros: "IntegerPart ← '0' / [1-9] [0-9]*"
/// Note: the lexer currently accepts leading zeros (e.g. "007") — this does not
/// match the grammar strictly but is a pragmatic choice. Documenting current behavior.
#[test]
fn leading_zeros_accepted_by_lexer() {
    // The spec grammar says IntegerPart = '0' | [1-9][0-9]*
    // but the lexer accepts "007" as 7 — documenting current behavior
    let toks = tokens("007");
    assert_eq!(toks, vec![Token::Number(Decimal::from(7))]);
}

// ── Date/DateTime literal tokenization ──────────────────────────

/// Spec: fel-grammar.md §3.6 L144 — "DateLiteral ← '@' Digit{4} '-' Digit{2} '-' Digit{2}"
#[test]
fn date_literal() {
    assert_eq!(
        tokens("@2024-01-15"),
        vec![Token::DateLiteral("@2024-01-15".into())]
    );
}

/// Spec: fel-grammar.md §3.6 L141-142 — DateTimeLiteral with Z timezone
#[test]
fn datetime_literal_utc() {
    assert_eq!(
        tokens("@2024-01-15T10:30:00Z"),
        vec![Token::DateTimeLiteral("@2024-01-15T10:30:00Z".into())]
    );
}

/// Spec: fel-grammar.md §3.6 L141-142 — DateTimeLiteral without timezone
#[test]
fn datetime_literal_no_timezone() {
    assert_eq!(
        tokens("@2024-01-15T10:30:00"),
        vec![Token::DateTimeLiteral("@2024-01-15T10:30:00".into())]
    );
}

/// Spec: fel-grammar.md §3.6 L146 — "TimeZone ← 'Z' / [+-] Digit{2} ':' Digit{2}"
#[test]
fn datetime_literal_positive_offset() {
    assert_eq!(
        tokens("@2024-01-15T10:30:00+05:30"),
        vec![Token::DateTimeLiteral("@2024-01-15T10:30:00+05:30".into())]
    );
}

/// Spec: fel-grammar.md §3.6 L146 — negative timezone offset
#[test]
fn datetime_literal_negative_offset() {
    assert_eq!(
        tokens("@2024-01-15T10:30:00-05:00"),
        vec![Token::DateTimeLiteral("@2024-01-15T10:30:00-05:00".into())]
    );
}

/// Spec: fel-grammar.md §3.6 L150-151 — "DateTimeLiteral MUST be tried before DateLiteral"
#[test]
fn date_literal_followed_by_operator() {
    // Ensure @2024-01-15 + 1 doesn't eat the +1 as part of the date
    let toks = tokens("@2024-01-15 + 1");
    assert_eq!(toks[0], Token::DateLiteral("@2024-01-15".into()));
    assert_eq!(toks[1], Token::Plus);
    assert_eq!(toks[2], Token::Number(Decimal::from(1)));
}

// ── Comment handling ────────────────────────────────────────────

/// Spec: fel-grammar.md §3.1 L61 — "LineComment ← '//' (!LineTerminator .)* LineTerminator?"
#[test]
fn line_comment_skipped() {
    assert_eq!(
        tokens("42 // this is a comment\n+ 1"),
        vec![
            Token::Number(Decimal::from(42)),
            Token::Plus,
            Token::Number(Decimal::from(1)),
        ]
    );
}

/// Spec: fel-grammar.md §3.1 L62 — "BlockComment ← '/*' (!'*/' .)* '*/'"
#[test]
fn block_comment_skipped() {
    assert_eq!(
        tokens("42 /* block comment */ + 1"),
        vec![
            Token::Number(Decimal::from(42)),
            Token::Plus,
            Token::Number(Decimal::from(1)),
        ]
    );
}

/// Spec: fel-grammar.md §3.1 L61 — line comment at end of input (no newline)
#[test]
fn line_comment_at_eof() {
    assert_eq!(
        tokens("42 // trailing comment"),
        vec![Token::Number(Decimal::from(42))]
    );
}

/// Spec: fel-grammar.md §3.1 L66-67 — "Block comments do not nest"
#[test]
fn block_comments_do_not_nest() {
    // /* a /* b */ c */ — the first */ ends the comment, "c" and "*/" remain
    // This should lex "c" as an identifier and then error on "*" and "/"
    // or produce tokens. Let's see current behavior.
    let toks = tokens("/* a /* b */ c");
    // After the block comment ends at first */, we get identifier "c"
    assert_eq!(toks, vec![Token::Identifier("c".into())]);
}

/// Spec: fel-grammar.md §3.1 L62 — unterminated block comment MUST be a syntax error
#[test]
fn unterminated_block_comment_is_error() {
    let result = Lexer::new("42 /* unterminated").tokenize();
    assert!(
        result.is_err(),
        "unterminated block comment should produce an error"
    );
}

// ── Operator tokenization ───────────────────────────────────────

/// Spec: fel-grammar.md §5 (operator table) — equality operators
#[test]
fn single_equals_is_eq() {
    let toks = tokens("=");
    assert_eq!(toks, vec![Token::Eq]);
}

/// Spec: fel-grammar.md §5 — double equals also Eq
#[test]
fn double_equals_is_eq() {
    let toks = tokens("==");
    assert_eq!(toks, vec![Token::Eq]);
}

/// Spec: fel-grammar.md §5 — not-equal
#[test]
fn not_equal_operator() {
    let toks = tokens("!=");
    assert_eq!(toks, vec![Token::NotEq]);
}

/// Spec: fel-grammar.md §5 — comparison operators
#[test]
fn comparison_operators() {
    assert_eq!(tokens("<"), vec![Token::Lt]);
    assert_eq!(tokens(">"), vec![Token::Gt]);
    assert_eq!(tokens("<="), vec![Token::LtEq]);
    assert_eq!(tokens(">="), vec![Token::GtEq]);
}

/// Spec: fel-grammar.md §5 — null coalesce "??"
#[test]
fn null_coalesce_operator() {
    assert_eq!(tokens("??"), vec![Token::DoubleQuestion]);
}

/// Spec: fel-grammar.md §5 — single question mark for ternary
#[test]
fn question_mark_operator() {
    assert_eq!(tokens("?"), vec![Token::Question]);
}

/// Correctness: all single-char operators
#[test]
fn all_single_char_operators() {
    assert_eq!(tokens("+"), vec![Token::Plus]);
    assert_eq!(tokens("-"), vec![Token::Minus]);
    assert_eq!(tokens("*"), vec![Token::Star]);
    assert_eq!(tokens("/"), vec![Token::Slash]);
    assert_eq!(tokens("%"), vec![Token::Percent]);
    assert_eq!(tokens("&"), vec![Token::Ampersand]);
}

/// Correctness: all punctuation tokens
#[test]
fn all_punctuation_tokens() {
    assert_eq!(tokens("("), vec![Token::LParen]);
    assert_eq!(tokens(")"), vec![Token::RParen]);
    assert_eq!(tokens("["), vec![Token::LBracket]);
    assert_eq!(tokens("]"), vec![Token::RBracket]);
    assert_eq!(tokens("{"), vec![Token::LBrace]);
    assert_eq!(tokens("}"), vec![Token::RBrace]);
    assert_eq!(tokens(","), vec![Token::Comma]);
    assert_eq!(tokens("."), vec![Token::Dot]);
    assert_eq!(tokens(":"), vec![Token::Colon]);
    assert_eq!(tokens("$"), vec![Token::Dollar]);
    assert_eq!(tokens("@"), vec![Token::At]);
}

// ── Keyword recognition ─────────────────────────────────────────

/// Spec: fel-grammar.md §3.7 L160-161 — "trailing ![a-zA-Z0-9_] lookahead
/// applies to prevent trueValue from being parsed as true + Value"
#[test]
fn true_value_is_identifier_not_keyword() {
    assert_eq!(
        tokens("trueValue"),
        vec![Token::Identifier("trueValue".into())]
    );
}

/// Spec: fel-grammar.md §3.3 L93-94 — "informal are not incorrectly matched
/// as containing a reserved word"
#[test]
fn informal_is_identifier_not_keyword() {
    assert_eq!(
        tokens("informal"),
        vec![Token::Identifier("informal".into())]
    );
}

/// Spec: fel-grammar.md §3.3 L87-89 — reserved words are recognized
#[test]
fn all_keywords_recognized() {
    assert_eq!(tokens("true"), vec![Token::True]);
    assert_eq!(tokens("false"), vec![Token::False]);
    assert_eq!(tokens("null"), vec![Token::Null]);
    assert_eq!(tokens("let"), vec![Token::Let]);
    assert_eq!(tokens("in"), vec![Token::In]);
    assert_eq!(tokens("if"), vec![Token::If]);
    assert_eq!(tokens("then"), vec![Token::Then]);
    assert_eq!(tokens("else"), vec![Token::Else]);
    assert_eq!(tokens("and"), vec![Token::And]);
    assert_eq!(tokens("or"), vec![Token::Or]);
    assert_eq!(tokens("not"), vec![Token::Not]);
}

/// Spec: fel-grammar.md §3.3 L90 — keywords with trailing alphanumeric are identifiers
#[test]
fn keyword_prefixes_are_identifiers() {
    assert_eq!(tokens("notify"), vec![Token::Identifier("notify".into())]);
    assert_eq!(tokens("letter"), vec![Token::Identifier("letter".into())]);
    assert_eq!(tokens("iffy"), vec![Token::Identifier("iffy".into())]);
    assert_eq!(tokens("android"), vec![Token::Identifier("android".into())]);
    assert_eq!(tokens("orchard"), vec![Token::Identifier("orchard".into())]);
    assert_eq!(tokens("nothing"), vec![Token::Identifier("nothing".into())]);
    assert_eq!(tokens("elapsed"), vec![Token::Identifier("elapsed".into())]);
    assert_eq!(tokens("thence"), vec![Token::Identifier("thence".into())]);
    assert_eq!(tokens("false0"), vec![Token::Identifier("false0".into())]);
    assert_eq!(
        tokens("null_val"),
        vec![Token::Identifier("null_val".into())]
    );
}

// ── Error cases ─────────────────────────────────────────────────

/// Spec: fel-grammar.md §7 L381 — "An unrecognised escape sequence MUST be rejected as a syntax error"
#[test]
fn unterminated_string_rejected() {
    let err = lex("\"hello").unwrap_err();
    assert!(err.contains("unterminated"), "got: {err}");
}

/// Spec: fel-grammar.md §7 L376-377 — "MUST reject all input strings that do not match"
#[test]
fn unexpected_character_rejected() {
    let err = lex("~").unwrap_err();
    assert!(err.contains("unexpected character"), "got: {err}");
}

/// Spec: fel-grammar.md §7 L376-377 — bare ! without = is invalid
#[test]
fn bare_bang_rejected() {
    let err = lex("!").unwrap_err();
    assert!(err.contains("unexpected character '!'"), "got: {err}");
}

/// Correctness: unterminated single-quoted string
#[test]
fn unterminated_single_quote_string() {
    let err = lex("'hello").unwrap_err();
    assert!(err.contains("unterminated"), "got: {err}");
}

/// Correctness: unterminated string escape at EOF
#[test]
fn unterminated_string_escape() {
    let err = lex(r#""hello\"#).unwrap_err();
    assert!(err.contains("unterminated"), "got: {err}");
}

// ── Whitespace handling ─────────────────────────────────────────

/// Spec: fel-grammar.md §3.1 L53-54 — "Whitespace and comments are insignificant"
#[test]
fn whitespace_is_insignificant() {
    assert_eq!(
        tokens("  42  +  1  "),
        vec![
            Token::Number(Decimal::from(42)),
            Token::Plus,
            Token::Number(Decimal::from(1)),
        ]
    );
}

/// Correctness: tabs and newlines as whitespace
#[test]
fn tabs_and_newlines_are_whitespace() {
    assert_eq!(
        tokens("42\t+\n1"),
        vec![
            Token::Number(Decimal::from(42)),
            Token::Plus,
            Token::Number(Decimal::from(1)),
        ]
    );
}

/// Correctness: empty input produces only Eof
#[test]
fn empty_input() {
    let toks = lex_ok("");
    assert_eq!(toks, vec![Token::Eof]);
}

/// Correctness: whitespace-only input produces only Eof
#[test]
fn whitespace_only_input() {
    let toks = lex_ok("   \t\n  ");
    assert_eq!(toks, vec![Token::Eof]);
}

// ── Multi-token sequences ───────────────────────────────────────

/// Correctness: complete expression tokenization
#[test]
fn full_expression_tokenization() {
    let toks = tokens("$x + 1 > 0 and $y != null");
    assert_eq!(
        toks,
        vec![
            Token::Dollar,
            Token::Identifier("x".into()),
            Token::Plus,
            Token::Number(Decimal::from(1)),
            Token::Gt,
            Token::Number(Decimal::ZERO),
            Token::And,
            Token::Dollar,
            Token::Identifier("y".into()),
            Token::NotEq,
            Token::Null,
        ]
    );
}

/// Correctness: function call tokenization
#[test]
fn function_call_tokenization() {
    let toks = tokens("sum($items[*].qty)");
    assert_eq!(
        toks,
        vec![
            Token::Identifier("sum".into()),
            Token::LParen,
            Token::Dollar,
            Token::Identifier("items".into()),
            Token::LBracket,
            Token::Star,
            Token::RBracket,
            Token::Dot,
            Token::Identifier("qty".into()),
            Token::RParen,
        ]
    );
}

#[test]
fn public_tokenize_exposes_chevrotain_compatible_names_and_spans() {
    let tokens = tokenize("if($name != null, 1, 0)").unwrap();
    let non_eof: Vec<_> = tokens
        .into_iter()
        .filter(|token| token.token_type != "EOF")
        .collect();

    assert_eq!(non_eof[0].token_type, "If");
    assert_eq!(non_eof[0].text, "if");
    assert_eq!(non_eof[1].token_type, "LRound");
    assert_eq!(non_eof[2].token_type, "Dollar");
    assert_eq!(non_eof[3].token_type, "Identifier");
    assert_eq!(non_eof[4].token_type, "NotEquals");
    assert_eq!(non_eof[5].token_type, "Null");
    assert_eq!(non_eof[6].token_type, "Comma");
    assert_eq!(non_eof[7].token_type, "NumberLiteral");
    assert_eq!(non_eof[7].text, "1");
    assert_eq!(non_eof[9].token_type, "NumberLiteral");
    assert_eq!(non_eof[9].text, "0");
    assert_eq!(non_eof[10].token_type, "RRound");
    assert_eq!(non_eof[3].start, 4);
    assert_eq!(non_eof[3].end, 8);
}
