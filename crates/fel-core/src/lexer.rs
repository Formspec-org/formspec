//! FEL hand-rolled lexer — tokenization with spans and decimal numbers.
//!
//! Internal scanning uses a char buffer and cursor; [`Lexer::tokenize`] is the public entry point.
#![allow(clippy::missing_docs_in_private_items)]
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

/// Lexical token for FEL source (literals, keywords, operators, punctuation).
#[allow(missing_docs)]
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Literals
    Number(Decimal),
    StringLit(String),
    True,
    False,
    Null,
    DateLiteral(String),
    DateTimeLiteral(String),

    // Identifiers and keywords
    Identifier(String),
    Let,
    In,
    If,
    Then,
    Else,
    And,
    Or,
    Not,

    // Operators
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Ampersand,
    Eq,    // = or ==
    NotEq, // !=
    Lt,
    Gt,
    LtEq,
    GtEq,
    DoubleQuestion, // ??
    Question,       // ?

    // Punctuation
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    Comma,
    Dot,
    Colon,

    // Special
    Dollar,
    At,

    // End
    Eof,
}

/// Byte/char span in the original source (Unicode scalar indices, inclusive start, exclusive end).
#[derive(Debug, Clone)]
pub struct Span {
    /// Start offset.
    pub start: usize,
    /// End offset (exclusive).
    pub end: usize,
}

/// A [`Token`] with its [`Span`].
#[derive(Debug, Clone)]
pub struct SpannedToken {
    /// Classified token.
    pub token: Token,
    /// Position in source.
    pub span: Span,
}

/// Character-based lexer over a FEL expression string.
pub struct Lexer<'a> {
    _input: &'a str,
    chars: Vec<char>,
    pos: usize,
}

impl<'a> Lexer<'a> {
    /// Create a lexer for `input` (no allocation beyond char buffer).
    pub fn new(input: &'a str) -> Self {
        Lexer {
            _input: input,
            chars: input.chars().collect(),
            pos: 0,
        }
    }

    /// Consume the entire input and return all tokens, ending with [`Token::Eof`].
    pub fn tokenize(&mut self) -> Result<Vec<SpannedToken>, String> {
        let mut tokens = Vec::new();
        loop {
            self.skip_whitespace_and_comments()?;
            if self.pos >= self.chars.len() {
                tokens.push(SpannedToken {
                    token: Token::Eof,
                    span: Span {
                        start: self.pos,
                        end: self.pos,
                    },
                });
                break;
            }
            let start = self.pos;
            let token = self.next_token()?;
            tokens.push(SpannedToken {
                token,
                span: Span {
                    start,
                    end: self.pos,
                },
            });
        }
        Ok(tokens)
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn peek_at(&self, offset: usize) -> Option<char> {
        self.chars.get(self.pos + offset).copied()
    }

    fn advance(&mut self) -> Option<char> {
        let c = self.chars.get(self.pos).copied();
        if c.is_some() {
            self.pos += 1;
        }
        c
    }

    fn skip_whitespace_and_comments(&mut self) -> Result<(), String> {
        let len = self.chars.len();
        loop {
            // Skip whitespace
            while self.pos < len && self.chars[self.pos].is_whitespace() {
                self.pos += 1;
            }
            // Skip line comments
            if self.pos + 1 < len && self.chars[self.pos] == '/' && self.chars[self.pos + 1] == '/'
            {
                while self.pos < len && self.chars[self.pos] != '\n' {
                    self.pos += 1;
                }
                continue;
            }
            // Skip block comments
            if self.pos + 1 < len && self.chars[self.pos] == '/' && self.chars[self.pos + 1] == '*'
            {
                let start = self.pos;
                self.pos += 2;
                let mut closed = false;
                while self.pos + 1 < len {
                    if self.chars[self.pos] == '*' && self.chars[self.pos + 1] == '/' {
                        self.pos += 2;
                        closed = true;
                        break;
                    }
                    self.pos += 1;
                }
                if !closed {
                    return Err(format!("unterminated block comment at position {start}"));
                }
                continue;
            }
            break;
        }
        Ok(())
    }

    fn next_token(&mut self) -> Result<Token, String> {
        let c = self.peek().unwrap();

        // Date/DateTime literals: @YYYY-...
        if c == '@' && self.is_date_literal_ahead() {
            return self.read_date_literal();
        }

        // Number literals (including negative via parser, not lexer)
        if c.is_ascii_digit() || (c == '-' && self.peek_at(1).is_some_and(|c| c.is_ascii_digit())) {
            return self.read_number();
        }

        // String literals
        if c == '"' || c == '\'' {
            return self.read_string(c);
        }

        // Identifiers and keywords
        if c.is_ascii_alphabetic() || c == '_' {
            return self.read_identifier();
        }

        // Operators and punctuation
        self.advance();
        match c {
            '+' => Ok(Token::Plus),
            '-' => Ok(Token::Minus),
            '*' => Ok(Token::Star),
            '/' => Ok(Token::Slash),
            '%' => Ok(Token::Percent),
            '&' => Ok(Token::Ampersand),
            '(' => Ok(Token::LParen),
            ')' => Ok(Token::RParen),
            '[' => Ok(Token::LBracket),
            ']' => Ok(Token::RBracket),
            '{' => Ok(Token::LBrace),
            '}' => Ok(Token::RBrace),
            ',' => Ok(Token::Comma),
            '.' => Ok(Token::Dot),
            ':' => Ok(Token::Colon),
            '$' => Ok(Token::Dollar),
            '@' => Ok(Token::At),
            '?' => {
                if self.peek() == Some('?') {
                    self.advance();
                    Ok(Token::DoubleQuestion)
                } else {
                    Ok(Token::Question)
                }
            }
            '=' => {
                if self.peek() == Some('=') {
                    self.advance();
                }
                Ok(Token::Eq)
            }
            '!' => {
                if self.peek() == Some('=') {
                    self.advance();
                    Ok(Token::NotEq)
                } else {
                    Err(format!(
                        "unexpected character '!' at position {}",
                        self.pos - 1
                    ))
                }
            }
            '<' => {
                if self.peek() == Some('=') {
                    self.advance();
                    Ok(Token::LtEq)
                } else {
                    Ok(Token::Lt)
                }
            }
            '>' => {
                if self.peek() == Some('=') {
                    self.advance();
                    Ok(Token::GtEq)
                } else {
                    Ok(Token::Gt)
                }
            }
            '|' => {
                if self.peek() == Some('>') {
                    self.advance();
                    Err(format!(
                        "pipe operator `|>` is reserved for future use at position {}",
                        self.pos - 2
                    ))
                } else {
                    Err(format!(
                        "unexpected character '|' at position {}",
                        self.pos - 1
                    ))
                }
            }
            _ => Err(format!(
                "unexpected character '{c}' at position {}",
                self.pos - 1
            )),
        }
    }

    fn is_date_literal_ahead(&self) -> bool {
        // Check for @YYYY-MM-DD pattern
        if self.pos + 11 > self.chars.len() {
            return false;
        }
        let slice: String = self.chars[self.pos..self.pos + 11].iter().collect();
        if slice.len() < 11 {
            return false;
        }
        slice.as_bytes()[0] == b'@'
            && slice.as_bytes()[1..5].iter().all(|b| b.is_ascii_digit())
            && slice.as_bytes()[5] == b'-'
            && slice.as_bytes()[6..8].iter().all(|b| b.is_ascii_digit())
            && slice.as_bytes()[8] == b'-'
            && slice.as_bytes()[9..11].iter().all(|b| b.is_ascii_digit())
    }

    fn read_date_literal(&mut self) -> Result<Token, String> {
        let start = self.pos;
        self.advance(); // skip @
        // Read YYYY-MM-DD
        for _ in 0..10 {
            self.advance();
        }
        // Check for T (datetime)
        if self.peek() == Some('T') {
            self.advance(); // T
            // Read HH:MM:SS
            for _ in 0..8 {
                self.advance();
            }
            // Optional timezone
            match self.peek() {
                Some('Z') => {
                    self.advance();
                }
                Some('+') | Some('-') if self.peek_at(1).is_some_and(|c| c.is_ascii_digit()) => {
                    self.advance(); // sign
                    for _ in 0..5 {
                        // HH:MM
                        self.advance();
                    }
                }
                _ => {}
            }
            let s: String = self.chars[start..self.pos].iter().collect();
            Ok(Token::DateTimeLiteral(s))
        } else {
            let s: String = self.chars[start..self.pos].iter().collect();
            Ok(Token::DateLiteral(s))
        }
    }

    fn read_number(&mut self) -> Result<Token, String> {
        let start = self.pos;
        // Optional minus
        if self.peek() == Some('-') {
            self.advance();
        }
        // Integer part
        while self.peek().is_some_and(|c| c.is_ascii_digit()) {
            self.advance();
        }
        // Fractional part
        if self.peek() == Some('.') && self.peek_at(1).is_some_and(|c| c.is_ascii_digit()) {
            self.advance(); // .
            while self.peek().is_some_and(|c| c.is_ascii_digit()) {
                self.advance();
            }
        }
        // Exponent
        if self.peek().is_some_and(|c| c == 'e' || c == 'E') {
            self.advance();
            if self.peek().is_some_and(|c| c == '+' || c == '-') {
                self.advance();
            }
            while self.peek().is_some_and(|c| c.is_ascii_digit()) {
                self.advance();
            }
        }
        let s: String = self.chars[start..self.pos].iter().collect();
        // Decimal doesn't parse scientific notation (e.g. 1e3) directly.
        // Try Decimal first; fall back through f64 for E notation.
        let n: Decimal = s
            .parse()
            .or_else(|_| s.parse::<f64>().ok().and_then(Decimal::from_f64).ok_or(()))
            .map_err(|_| format!("invalid number '{s}' at position {start}"))?;
        Ok(Token::Number(n))
    }

    fn read_string(&mut self, quote: char) -> Result<Token, String> {
        self.advance(); // skip opening quote
        let mut result = String::new();
        loop {
            match self.advance() {
                None => return Err("unterminated string".into()),
                Some(c) if c == quote => return Ok(Token::StringLit(result)),
                Some('\\') => {
                    let esc_pos = self.pos - 1; // position of the backslash
                    match self.advance() {
                        Some('n') => result.push('\n'),
                        Some('t') => result.push('\t'),
                        Some('r') => result.push('\r'),
                        Some('\\') => result.push('\\'),
                        Some('"') => result.push('"'),
                        Some('\'') => result.push('\''),
                        Some('u') => {
                            let mut hex = String::with_capacity(4);
                            for _ in 0..4 {
                                match self.peek() {
                                    Some(h) if h.is_ascii_hexdigit() => {
                                        hex.push(h);
                                        self.advance();
                                    }
                                    _ => {
                                        return Err(format!(
                                            "invalid unicode escape '\\u{hex}' at position {esc_pos}: expected 4 hex digits"
                                        ));
                                    }
                                }
                            }
                            let cp = u32::from_str_radix(&hex, 16).unwrap();
                            match char::from_u32(cp) {
                                Some(ch) => result.push(ch),
                                None => {
                                    return Err(format!(
                                        "invalid unicode codepoint '\\u{hex}' at position {esc_pos}"
                                    ));
                                }
                            }
                        }
                        Some(c) => {
                            return Err(format!(
                                "unrecognized escape sequence '\\{c}' at position {esc_pos}"
                            ));
                        }
                        None => return Err("unterminated string escape".into()),
                    }
                }
                Some(c) => result.push(c),
            }
        }
    }

    fn read_identifier(&mut self) -> Result<Token, String> {
        let start = self.pos;
        while self
            .peek()
            .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            self.advance();
        }
        let word: String = self.chars[start..self.pos].iter().collect();
        Ok(match word.as_str() {
            "true" => Token::True,
            "false" => Token::False,
            "null" => Token::Null,
            "let" => Token::Let,
            "in" => Token::In,
            "if" => Token::If,
            "then" => Token::Then,
            "else" => Token::Else,
            "and" => Token::And,
            "or" => Token::Or,
            "not" => Token::Not,
            _ => Token::Identifier(word),
        })
    }
}

/// FEL reserved keywords — identifiers that cannot be used as field/variable names.
const FEL_KEYWORDS: &[&str] = &[
    "true", "false", "null", "let", "in", "if", "then", "else", "and", "or", "not",
];

/// Returns `true` if `s` is a valid FEL identifier: `[a-zA-Z_][a-zA-Z0-9_]*` and not a reserved keyword.
pub fn is_valid_fel_identifier(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    let mut chars = s.chars();
    let first = chars.next().unwrap();
    if !first.is_ascii_alphabetic() && first != '_' {
        return false;
    }
    if !chars.all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return false;
    }
    !FEL_KEYWORDS.contains(&s)
}

/// Sanitizes a string into a valid FEL identifier.
///
/// - Strips characters that aren't ASCII alphanumeric or underscore.
/// - Prepends `_` if the result starts with a digit.
/// - Appends `_` if the result is a reserved keyword.
/// - Returns `"_"` for an empty or all-invalid input.
pub fn sanitize_fel_identifier(s: &str) -> String {
    let mut result: String = s
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect();
    if result.is_empty() {
        return "_".to_string();
    }
    if result.chars().next().unwrap().is_ascii_digit() {
        result.insert(0, '_');
    }
    if FEL_KEYWORDS.contains(&result.as_str()) {
        result.push('_');
    }
    result
}

#[cfg(test)]
mod tests {
    #![allow(clippy::missing_docs_in_private_items)]
    use super::*;

    fn lex_string(input: &str) -> Result<Vec<Token>, String> {
        let mut lexer = Lexer::new(input);
        lexer
            .tokenize()
            .map(|tokens| tokens.into_iter().map(|st| st.token).collect())
    }

    #[test]
    fn test_unicode_escape_basic() {
        let tokens = lex_string(r#""\u0041""#).unwrap();
        assert_eq!(tokens[0], Token::StringLit("A".into()));
    }

    #[test]
    fn test_unicode_escape_multibyte() {
        // \u00E9 = e-acute
        let tokens = lex_string(r#""\u00E9""#).unwrap();
        assert_eq!(tokens[0], Token::StringLit("\u{00E9}".into()));
    }

    #[test]
    fn test_unicode_escape_too_few_hex_digits() {
        let err = lex_string(r#""\u00G1""#).unwrap_err();
        assert!(err.contains("invalid unicode escape"), "got: {err}");
    }

    #[test]
    fn test_unicode_escape_no_digits() {
        let err = lex_string(r#""\u""#).unwrap_err();
        assert!(err.contains("invalid unicode escape"), "got: {err}");
    }

    #[test]
    fn test_unrecognized_escape_error() {
        let err = lex_string(r#""\q""#).unwrap_err();
        assert!(
            err.contains("unrecognized escape sequence '\\q'"),
            "got: {err}"
        );
    }

    #[test]
    fn test_slash_escape_removed() {
        // \/ is no longer a valid escape
        let err = lex_string(r#""\/""#).unwrap_err();
        assert!(err.contains("unrecognized escape sequence"), "got: {err}");
    }

    #[test]
    fn test_valid_escapes_still_work() {
        let tokens = lex_string(r#""a\nb\tc\\d\"e\'f""#).unwrap();
        assert_eq!(tokens[0], Token::StringLit("a\nb\tc\\d\"e'f".into()));
    }

    #[test]
    fn test_pipe_operator_rejected_as_reserved() {
        let err = lex_string("$a |> $b").unwrap_err();
        assert!(
            err.contains("pipe operator `|>` is reserved for future use"),
            "got: {err}"
        );
    }

    #[test]
    fn test_bare_pipe_rejected() {
        let err = lex_string("$a | $b").unwrap_err();
        assert!(err.contains("unexpected character '|'"), "got: {err}");
    }

    #[test]
    fn test_pipe_in_expression_rejected() {
        let err = lex_string("concat('a', 'b') |> upper()").unwrap_err();
        assert!(
            err.contains("pipe operator `|>` is reserved for future use"),
            "got: {err}"
        );
    }

    // ── is_valid_fel_identifier tests ────────────────────────────────

    #[test]
    fn test_valid_identifiers() {
        assert!(is_valid_fel_identifier("foo"));
        assert!(is_valid_fel_identifier("_bar"));
        assert!(is_valid_fel_identifier("camelCase123"));
        assert!(is_valid_fel_identifier("_"));
        assert!(is_valid_fel_identifier("x"));
        assert!(is_valid_fel_identifier("snake_case_name"));
    }

    #[test]
    fn test_invalid_identifiers() {
        assert!(!is_valid_fel_identifier(""));
        assert!(!is_valid_fel_identifier("123abc"));
        assert!(!is_valid_fel_identifier("$ref"));
        assert!(!is_valid_fel_identifier("foo-bar"));
        assert!(!is_valid_fel_identifier("foo bar"));
        assert!(!is_valid_fel_identifier("a.b"));
    }

    #[test]
    fn test_keywords_are_not_valid_identifiers() {
        for kw in FEL_KEYWORDS {
            assert!(!is_valid_fel_identifier(kw), "keyword '{kw}' should be invalid");
        }
    }

    // ── sanitize_fel_identifier tests ────────────────────────────────

    #[test]
    fn test_sanitize_valid_stays_unchanged() {
        assert_eq!(sanitize_fel_identifier("foo"), "foo");
        assert_eq!(sanitize_fel_identifier("_bar"), "_bar");
    }

    #[test]
    fn test_sanitize_strips_invalid_chars() {
        assert_eq!(sanitize_fel_identifier("foo-bar"), "foobar");
        assert_eq!(sanitize_fel_identifier("hello world"), "helloworld");
        assert_eq!(sanitize_fel_identifier("$ref"), "ref");
        assert_eq!(sanitize_fel_identifier("a.b.c"), "abc");
    }

    #[test]
    fn test_sanitize_prepends_underscore_for_digit_start() {
        assert_eq!(sanitize_fel_identifier("123abc"), "_123abc");
    }

    #[test]
    fn test_sanitize_appends_underscore_for_keyword() {
        assert_eq!(sanitize_fel_identifier("true"), "true_");
        assert_eq!(sanitize_fel_identifier("null"), "null_");
        assert_eq!(sanitize_fel_identifier("and"), "and_");
    }

    #[test]
    fn test_sanitize_empty_or_all_invalid() {
        assert_eq!(sanitize_fel_identifier(""), "_");
        assert_eq!(sanitize_fel_identifier("!@#$"), "_");
    }
}
