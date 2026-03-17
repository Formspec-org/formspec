/// FEL parser — hand-rolled recursive descent.
///
/// Operator precedence (lowest → highest):
/// 0: let...in, if...then...else
/// 1: ternary ? :
/// 2: or
/// 3: and
/// 4: = !=
/// 5: < > <= >=
/// 6: in, not in
/// 7: ??
/// 8: + - &
/// 9: * / %
/// 10: unary not, unary -
/// 11: postfix . []
use crate::ast::*;
use crate::error::FelError;
use crate::lexer::{Lexer, SpannedToken, Token};

pub struct Parser {
    tokens: Vec<SpannedToken>,
    pos: usize,
    /// When > 0, suppress `in` as membership operator (inside let-value).
    no_in_depth: usize,
}

/// Parse a FEL expression string into an AST.
pub fn parse(input: &str) -> Result<Expr, FelError> {
    let mut lexer = Lexer::new(input);
    let tokens = lexer
        .tokenize()
        .map_err(|e| FelError::Parse(e))?;
    let mut parser = Parser {
        tokens,
        pos: 0,
        no_in_depth: 0,
    };
    let expr = parser.parse_expression()?;
    if !parser.at_eof() {
        return Err(FelError::Parse(format!(
            "unexpected token {:?} at position {}",
            parser.current().token,
            parser.current().span.start
        )));
    }
    Ok(expr)
}

impl Parser {
    fn current(&self) -> &SpannedToken {
        &self.tokens[self.pos.min(self.tokens.len() - 1)]
    }

    fn peek(&self) -> &Token {
        &self.current().token
    }

    fn at_eof(&self) -> bool {
        matches!(self.peek(), Token::Eof)
    }

    fn advance(&mut self) -> &SpannedToken {
        let tok = &self.tokens[self.pos.min(self.tokens.len() - 1)];
        if self.pos < self.tokens.len() {
            self.pos += 1;
        }
        tok
    }

    fn expect(&mut self, expected: &Token) -> Result<(), FelError> {
        if self.peek() == expected {
            self.advance();
            Ok(())
        } else {
            Err(FelError::Parse(format!(
                "expected {expected:?}, got {:?}",
                self.peek()
            )))
        }
    }

    fn eat_identifier(&mut self) -> Result<String, FelError> {
        match self.peek().clone() {
            Token::Identifier(name) => {
                let name = name.clone();
                self.advance();
                Ok(name)
            }
            _ => Err(FelError::Parse(format!(
                "expected identifier, got {:?}",
                self.peek()
            ))),
        }
    }

    // ── Expression (entry point) ────────────────────────────────

    fn parse_expression(&mut self) -> Result<Expr, FelError> {
        self.parse_let_or_if()
    }

    fn parse_let_or_if(&mut self) -> Result<Expr, FelError> {
        // let <name> = <value> in <body>
        if matches!(self.peek(), Token::Let) {
            self.advance(); // let
            let name = self.eat_identifier()?;
            self.expect(&Token::Eq)?;
            // Suppress `in` as membership in let-value
            self.no_in_depth += 1;
            let value = self.parse_ternary()?;
            self.no_in_depth -= 1;
            self.expect(&Token::In)?;
            let body = self.parse_let_or_if()?;
            return Ok(Expr::LetBinding {
                name,
                value: Box::new(value),
                body: Box::new(body),
            });
        }

        // if <cond> then <then> else <else>
        if matches!(self.peek(), Token::If) {
            // Disambiguate: if followed by identifier+( could be function call if()
            // Check for if...then pattern (keyword form)
            if self.is_if_then_else() {
                self.advance(); // if
                let condition = self.parse_ternary()?;
                self.expect(&Token::Then)?;
                let then_branch = self.parse_let_or_if()?;
                self.expect(&Token::Else)?;
                let else_branch = self.parse_let_or_if()?;
                return Ok(Expr::IfThenElse {
                    condition: Box::new(condition),
                    then_branch: Box::new(then_branch),
                    else_branch: Box::new(else_branch),
                });
            }
        }

        self.parse_ternary()
    }

    /// Look ahead to determine if this is `if ... then ... else` (keyword form)
    /// vs `if(...)` (function call form).
    fn is_if_then_else(&self) -> bool {
        // If next token after `if` is `(`, it's the function form
        // Actually, both forms can start with various expressions.
        // The key difference: keyword form expects `then` keyword.
        // We check: if the token after `if` is NOT `(` immediately,
        // or if it IS `(` but there are tokens between `)` and `then`.
        // Simplification: if we see `then` anywhere in lookahead before
        // seeing a comma (function args), it's keyword form.
        //
        // Even simpler: `if` followed by `(` where the very next token after
        // the matching `)` is NOT `then` → it's a function call.
        // Otherwise → keyword form.

        let next_pos = self.pos + 1;
        if next_pos >= self.tokens.len() {
            return false;
        }

        // Scan forward to find `then` at the right nesting level
        let mut depth = 0;
        let mut i = self.pos + 1;
        while i < self.tokens.len() {
            match &self.tokens[i].token {
                Token::Then if depth == 0 => return true,
                Token::LParen | Token::LBracket | Token::LBrace => depth += 1,
                Token::RParen | Token::RBracket | Token::RBrace => {
                    if depth > 0 {
                        depth -= 1;
                    }
                }
                Token::Eof => return false,
                _ => {}
            }
            i += 1;
        }
        false
    }

    // ── Ternary ─────────────────────────────────────────────────

    fn parse_ternary(&mut self) -> Result<Expr, FelError> {
        let expr = self.parse_logical_or()?;
        if matches!(self.peek(), Token::Question) {
            self.advance(); // ?
            let then_branch = self.parse_let_or_if()?;
            self.expect(&Token::Colon)?;
            let else_branch = self.parse_let_or_if()?;
            Ok(Expr::Ternary {
                condition: Box::new(expr),
                then_branch: Box::new(then_branch),
                else_branch: Box::new(else_branch),
            })
        } else {
            Ok(expr)
        }
    }

    // ── Logical ─────────────────────────────────────────────────

    fn parse_logical_or(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_logical_and()?;
        while matches!(self.peek(), Token::Or) {
            self.advance();
            let right = self.parse_logical_and()?;
            left = Expr::BinaryOp {
                op: BinaryOp::Or,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_logical_and(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_equality()?;
        while matches!(self.peek(), Token::And) {
            self.advance();
            let right = self.parse_equality()?;
            left = Expr::BinaryOp {
                op: BinaryOp::And,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    // ── Equality / Comparison ───────────────────────────────────

    fn parse_equality(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_comparison()?;
        loop {
            let op = match self.peek() {
                Token::Eq => BinaryOp::Eq,
                Token::NotEq => BinaryOp::NotEq,
                _ => break,
            };
            self.advance();
            let right = self.parse_comparison()?;
            left = Expr::BinaryOp {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_comparison(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_membership()?;
        loop {
            let op = match self.peek() {
                Token::Lt => BinaryOp::Lt,
                Token::Gt => BinaryOp::Gt,
                Token::LtEq => BinaryOp::LtEq,
                Token::GtEq => BinaryOp::GtEq,
                _ => break,
            };
            self.advance();
            let right = self.parse_membership()?;
            left = Expr::BinaryOp {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    // ── Membership ──────────────────────────────────────────────

    fn parse_membership(&mut self) -> Result<Expr, FelError> {
        let left = self.parse_null_coalesce()?;

        if self.no_in_depth > 0 {
            return Ok(left);
        }

        // Check for `in` or `not in`
        if matches!(self.peek(), Token::Not) {
            // Peek ahead for `not in`
            if self.pos + 1 < self.tokens.len()
                && matches!(self.tokens[self.pos + 1].token, Token::In)
            {
                self.advance(); // not
                self.advance(); // in
                let right = self.parse_null_coalesce()?;
                return Ok(Expr::Membership {
                    value: Box::new(left),
                    container: Box::new(right),
                    negated: true,
                });
            }
        }

        if matches!(self.peek(), Token::In) {
            self.advance(); // in
            let right = self.parse_null_coalesce()?;
            return Ok(Expr::Membership {
                value: Box::new(left),
                container: Box::new(right),
                negated: false,
            });
        }

        Ok(left)
    }

    // ── Null coalesce ───────────────────────────────────────────

    fn parse_null_coalesce(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_addition()?;
        while matches!(self.peek(), Token::DoubleQuestion) {
            self.advance();
            let right = self.parse_addition()?;
            left = Expr::NullCoalesce {
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    // ── Arithmetic ──────────────────────────────────────────────

    fn parse_addition(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_multiplication()?;
        loop {
            let op = match self.peek() {
                Token::Plus => BinaryOp::Add,
                Token::Minus => BinaryOp::Sub,
                Token::Ampersand => BinaryOp::Concat,
                _ => break,
            };
            self.advance();
            let right = self.parse_multiplication()?;
            left = Expr::BinaryOp {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn parse_multiplication(&mut self) -> Result<Expr, FelError> {
        let mut left = self.parse_unary()?;
        loop {
            let op = match self.peek() {
                Token::Star => BinaryOp::Mul,
                Token::Slash => BinaryOp::Div,
                Token::Percent => BinaryOp::Mod,
                _ => break,
            };
            self.advance();
            let right = self.parse_unary()?;
            left = Expr::BinaryOp {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    // ── Unary ───────────────────────────────────────────────────

    fn parse_unary(&mut self) -> Result<Expr, FelError> {
        if matches!(self.peek(), Token::Not) {
            // Make sure it's not `not in` (handled by membership)
            if self.pos + 1 < self.tokens.len()
                && matches!(self.tokens[self.pos + 1].token, Token::In)
            {
                return self.parse_postfix();
            }
            self.advance();
            let operand = self.parse_unary()?;
            return Ok(Expr::UnaryOp {
                op: UnaryOp::Not,
                operand: Box::new(operand),
            });
        }
        if matches!(self.peek(), Token::Minus) {
            // Disambiguate: unary minus vs binary minus
            // Unary if at start of expression or after an operator/opening bracket
            self.advance();
            let operand = self.parse_unary()?;
            return Ok(Expr::UnaryOp {
                op: UnaryOp::Neg,
                operand: Box::new(operand),
            });
        }
        self.parse_postfix()
    }

    // ── Postfix (dot/bracket access) ────────────────────────────

    fn parse_postfix(&mut self) -> Result<Expr, FelError> {
        let mut expr = self.parse_atom()?;
        loop {
            match self.peek() {
                Token::Dot => {
                    self.advance();
                    let name = self.eat_identifier()?;
                    expr = Expr::PostfixAccess {
                        expr: Box::new(expr),
                        path: vec![PathSegment::Dot(name)],
                    };
                }
                Token::LBracket => {
                    self.advance();
                    let seg = if matches!(self.peek(), Token::Star) {
                        self.advance();
                        PathSegment::Wildcard
                    } else if let Token::Number(n) = self.peek().clone() {
                        self.advance();
                        PathSegment::Index(n as usize)
                    } else {
                        return Err(FelError::Parse(format!(
                            "expected number or * in brackets, got {:?}",
                            self.peek()
                        )));
                    };
                    self.expect(&Token::RBracket)?;
                    expr = Expr::PostfixAccess {
                        expr: Box::new(expr),
                        path: vec![seg],
                    };
                }
                _ => break,
            }
        }
        Ok(expr)
    }

    // ── Atoms ───────────────────────────────────────────────────

    fn parse_atom(&mut self) -> Result<Expr, FelError> {
        match self.peek().clone() {
            Token::Number(n) => {
                self.advance();
                Ok(Expr::Number(n))
            }
            Token::StringLit(s) => {
                let s = s.clone();
                self.advance();
                Ok(Expr::String(s))
            }
            Token::True => {
                self.advance();
                Ok(Expr::Boolean(true))
            }
            Token::False => {
                self.advance();
                Ok(Expr::Boolean(false))
            }
            Token::Null => {
                self.advance();
                Ok(Expr::Null)
            }
            Token::DateLiteral(s) => {
                let s = s.clone();
                self.advance();
                Ok(Expr::DateLiteral(s))
            }
            Token::DateTimeLiteral(s) => {
                let s = s.clone();
                self.advance();
                Ok(Expr::DateTimeLiteral(s))
            }
            Token::Dollar => {
                self.advance(); // $
                self.parse_field_ref()
            }
            Token::At => {
                self.advance(); // @
                self.parse_context_ref()
            }
            Token::LParen => {
                self.advance();
                let expr = self.parse_expression()?;
                self.expect(&Token::RParen)?;
                Ok(expr)
            }
            Token::LBracket => self.parse_array_literal(),
            Token::LBrace => self.parse_object_literal(),
            Token::Identifier(name) => {
                let name = name.clone();
                self.advance();
                // Check for function call
                if matches!(self.peek(), Token::LParen) {
                    self.parse_function_call(name)
                } else {
                    // Bare identifier — could be a let-bound variable reference
                    Ok(Expr::FieldRef {
                        name: Some(name),
                        path: vec![],
                    })
                }
            }
            Token::If => {
                // if(...) function form
                self.advance();
                if matches!(self.peek(), Token::LParen) {
                    self.parse_function_call("if".to_string())
                } else {
                    Err(FelError::Parse(
                        "unexpected 'if' — use if...then...else or if(...)".into(),
                    ))
                }
            }
            _ => Err(FelError::Parse(format!(
                "unexpected token {:?}",
                self.peek()
            ))),
        }
    }

    fn parse_field_ref(&mut self) -> Result<Expr, FelError> {
        let mut name: Option<String> = None;
        let mut path = Vec::new();

        // Optional identifier after $
        if let Token::Identifier(n) = self.peek().clone() {
            name = Some(n.clone());
            self.advance();
        }

        // Path segments
        loop {
            match self.peek() {
                Token::Dot => {
                    self.advance();
                    let seg_name = self.eat_identifier()?;
                    path.push(PathSegment::Dot(seg_name));
                }
                Token::LBracket => {
                    self.advance();
                    let seg = if matches!(self.peek(), Token::Star) {
                        self.advance();
                        PathSegment::Wildcard
                    } else if let Token::Number(n) = self.peek().clone() {
                        self.advance();
                        PathSegment::Index(n as usize)
                    } else {
                        return Err(FelError::Parse(format!(
                            "expected number or * in field ref brackets, got {:?}",
                            self.peek()
                        )));
                    };
                    self.expect(&Token::RBracket)?;
                    path.push(seg);
                }
                _ => break,
            }
        }

        Ok(Expr::FieldRef { name, path })
    }

    fn parse_context_ref(&mut self) -> Result<Expr, FelError> {
        let name = self.eat_identifier()?;
        let mut arg = None;
        let mut tail = Vec::new();

        // Optional argument: @instance('name')
        if matches!(self.peek(), Token::LParen) {
            self.advance();
            if let Token::StringLit(s) = self.peek().clone() {
                arg = Some(s.clone());
                self.advance();
            }
            self.expect(&Token::RParen)?;
        }

        // Dot-chain: @instance('name').field.subfield
        while matches!(self.peek(), Token::Dot) {
            self.advance();
            tail.push(self.eat_identifier()?);
        }

        Ok(Expr::ContextRef { name, arg, tail })
    }

    fn parse_function_call(&mut self, name: String) -> Result<Expr, FelError> {
        self.expect(&Token::LParen)?;
        let mut args = Vec::new();
        if !matches!(self.peek(), Token::RParen) {
            args.push(self.parse_expression()?);
            while matches!(self.peek(), Token::Comma) {
                self.advance();
                args.push(self.parse_expression()?);
            }
        }
        self.expect(&Token::RParen)?;
        Ok(Expr::FunctionCall { name, args })
    }

    fn parse_array_literal(&mut self) -> Result<Expr, FelError> {
        self.expect(&Token::LBracket)?;
        let mut elements = Vec::new();
        if !matches!(self.peek(), Token::RBracket) {
            elements.push(self.parse_expression()?);
            while matches!(self.peek(), Token::Comma) {
                self.advance();
                elements.push(self.parse_expression()?);
            }
        }
        self.expect(&Token::RBracket)?;
        Ok(Expr::Array(elements))
    }

    fn parse_object_literal(&mut self) -> Result<Expr, FelError> {
        self.expect(&Token::LBrace)?;
        let mut entries = Vec::new();
        if !matches!(self.peek(), Token::RBrace) {
            entries.push(self.parse_object_entry()?);
            while matches!(self.peek(), Token::Comma) {
                self.advance();
                // Allow trailing comma
                if matches!(self.peek(), Token::RBrace) {
                    break;
                }
                entries.push(self.parse_object_entry()?);
            }
        }
        self.expect(&Token::RBrace)?;
        Ok(Expr::Object(entries))
    }

    fn parse_object_entry(&mut self) -> Result<(String, Expr), FelError> {
        let key = match self.peek().clone() {
            Token::Identifier(name) => {
                self.advance();
                name.clone()
            }
            Token::StringLit(s) => {
                self.advance();
                s.clone()
            }
            _ => {
                return Err(FelError::Parse(format!(
                    "expected object key, got {:?}",
                    self.peek()
                )))
            }
        };
        self.expect(&Token::Colon)?;
        let value = self.parse_expression()?;
        Ok((key, value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_number() {
        let expr = parse("42").unwrap();
        assert_eq!(expr, Expr::Number(42.0));
    }

    #[test]
    fn test_parse_string() {
        let expr = parse("\"hello\"").unwrap();
        assert_eq!(expr, Expr::String("hello".into()));
    }

    #[test]
    fn test_parse_boolean() {
        assert_eq!(parse("true").unwrap(), Expr::Boolean(true));
        assert_eq!(parse("false").unwrap(), Expr::Boolean(false));
    }

    #[test]
    fn test_parse_null() {
        assert_eq!(parse("null").unwrap(), Expr::Null);
    }

    #[test]
    fn test_parse_field_ref() {
        let expr = parse("$name").unwrap();
        assert_eq!(
            expr,
            Expr::FieldRef {
                name: Some("name".into()),
                path: vec![]
            }
        );
    }

    #[test]
    fn test_parse_bare_dollar() {
        let expr = parse("$").unwrap();
        assert_eq!(
            expr,
            Expr::FieldRef {
                name: None,
                path: vec![]
            }
        );
    }

    #[test]
    fn test_parse_field_with_path() {
        let expr = parse("$address.city").unwrap();
        assert_eq!(
            expr,
            Expr::FieldRef {
                name: Some("address".into()),
                path: vec![PathSegment::Dot("city".into())]
            }
        );
    }

    #[test]
    fn test_parse_arithmetic_precedence() {
        let expr = parse("1 + 2 * 3").unwrap();
        assert!(matches!(expr, Expr::BinaryOp { op: BinaryOp::Add, .. }));
    }

    #[test]
    fn test_parse_function_call() {
        let expr = parse("sum($items[*].qty)").unwrap();
        assert!(matches!(expr, Expr::FunctionCall { .. }));
    }

    #[test]
    fn test_parse_if_then_else() {
        let expr = parse("if $x > 0 then 'positive' else 'non-positive'").unwrap();
        assert!(matches!(expr, Expr::IfThenElse { .. }));
    }

    #[test]
    fn test_parse_if_function() {
        let expr = parse("if($x > 0, 'yes', 'no')").unwrap();
        assert!(matches!(expr, Expr::FunctionCall { .. }));
    }

    #[test]
    fn test_parse_ternary() {
        let expr = parse("$x > 0 ? 'yes' : 'no'").unwrap();
        assert!(matches!(expr, Expr::Ternary { .. }));
    }

    #[test]
    fn test_parse_let_binding() {
        let expr = parse("let x = 5 in x + 1").unwrap();
        assert!(matches!(expr, Expr::LetBinding { .. }));
    }

    #[test]
    fn test_parse_membership() {
        let expr = parse("$status in ['active', 'pending']").unwrap();
        assert!(matches!(expr, Expr::Membership { negated: false, .. }));
    }

    #[test]
    fn test_parse_not_in() {
        let expr = parse("$status not in ['deleted']").unwrap();
        assert!(matches!(expr, Expr::Membership { negated: true, .. }));
    }

    #[test]
    fn test_parse_null_coalesce() {
        let expr = parse("$x ?? 0").unwrap();
        assert!(matches!(expr, Expr::NullCoalesce { .. }));
    }

    #[test]
    fn test_parse_context_ref() {
        let expr = parse("@index").unwrap();
        assert_eq!(
            expr,
            Expr::ContextRef {
                name: "index".into(),
                arg: None,
                tail: vec![]
            }
        );
    }

    #[test]
    fn test_parse_context_ref_with_arg() {
        let expr = parse("@instance('priorYear').total").unwrap();
        assert_eq!(
            expr,
            Expr::ContextRef {
                name: "instance".into(),
                arg: Some("priorYear".into()),
                tail: vec!["total".into()]
            }
        );
    }

    #[test]
    fn test_parse_date_literal() {
        let expr = parse("@2024-01-15").unwrap();
        assert_eq!(expr, Expr::DateLiteral("@2024-01-15".into()));
    }

    #[test]
    fn test_parse_object_literal() {
        let expr = parse("{name: 'Alice', age: 30}").unwrap();
        assert!(matches!(expr, Expr::Object(_)));
    }

    #[test]
    fn test_parse_array_literal() {
        let expr = parse("[1, 2, 3]").unwrap();
        assert!(matches!(expr, Expr::Array(_)));
    }

    #[test]
    fn test_parse_wildcard() {
        let expr = parse("$items[*].name").unwrap();
        assert_eq!(
            expr,
            Expr::FieldRef {
                name: Some("items".into()),
                path: vec![PathSegment::Wildcard, PathSegment::Dot("name".into())]
            }
        );
    }

    #[test]
    fn test_parse_unary_not() {
        let expr = parse("not true").unwrap();
        assert!(matches!(expr, Expr::UnaryOp { op: UnaryOp::Not, .. }));
    }

    #[test]
    fn test_parse_complex_nested() {
        parse("if $items[*].qty > 0 then sum($items[*].qty) * $rate else 0").unwrap();
    }

    #[test]
    fn test_parse_let_in_does_not_trigger_membership() {
        // `in` in `let x = $a in x + 1` should be the let-body separator,
        // not the membership operator
        let expr = parse("let x = $a in x + 1").unwrap();
        assert!(matches!(expr, Expr::LetBinding { .. }));
    }
}
