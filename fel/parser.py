"""FEL scannerless recursive-descent parser.

Operates directly on the source string (no separate lexer).
Implements the normative PEG grammar from fel-grammar.md.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation

from .ast_nodes import (
    ArrayLiteral, BinaryOp, BooleanLiteral, ContextRef, DateLiteral,
    DotSegment, FieldRef, FunctionCall, IfThenElse, IndexSegment,
    LetBinding, MembershipOp, NullLiteral, NumberLiteral, ObjectLiteral,
    PostfixAccess, StringLiteral, TernaryOp, UnaryOp, WildcardSegment,
)
from .errors import FelSyntaxError, SourcePos

RESERVED_WORDS = frozenset({
    'true', 'false', 'null',
    'and', 'or', 'not', 'in',
    'if', 'then', 'else', 'let',
})


def parse(source: str):
    """Parse a FEL expression string into an AST node.

    Raises FelSyntaxError on invalid input.
    """
    p = _Parser(source)
    node = p.parse_expression()
    p.skip_ws()
    if p.pos < len(p.src):
        p.error(f"Unexpected input: {p.src[p.pos:p.pos+20]!r}")
    return node


class _Parser:
    """Scannerless recursive-descent parser for FEL."""

    def __init__(self, src: str):
        self.src = src
        self.pos = 0
        # Pre-compute line starts for position mapping
        self._line_starts: list[int] = [0]
        for i, ch in enumerate(src):
            if ch == '\n':
                self._line_starts.append(i + 1)

    # -- Position helpers --------------------------------------------------

    def _source_pos(self, offset: int | None = None) -> SourcePos:
        if offset is None:
            offset = self.pos
        # Binary search for line number
        lo, hi = 0, len(self._line_starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if self._line_starts[mid] <= offset:
                lo = mid
            else:
                hi = mid - 1
        line = lo + 1
        col = offset - self._line_starts[lo] + 1
        return SourcePos(offset, line, col)

    def error(self, msg: str, offset: int | None = None) -> None:
        raise FelSyntaxError(msg, self._source_pos(offset))

    # -- Low-level matching ------------------------------------------------

    def at_end(self) -> bool:
        return self.pos >= len(self.src)

    def peek_char(self) -> str:
        if self.pos < len(self.src):
            return self.src[self.pos]
        return ''

    def match_str(self, s: str) -> bool:
        """Try to match literal string, advance if matched."""
        if self.src[self.pos:self.pos + len(s)] == s:
            self.pos += len(s)
            return True
        return False

    def expect_str(self, s: str) -> None:
        if not self.match_str(s):
            self.error(f"Expected {s!r}")

    def match_keyword(self, word: str) -> bool:
        """Match a keyword followed by non-identifier character."""
        end = self.pos + len(word)
        if self.src[self.pos:end] == word:
            if end >= len(self.src) or not self._is_id_continue(self.src[end]):
                self.pos = end
                return True
        return False

    def _is_id_start(self, ch: str) -> bool:
        return ch.isascii() and (ch.isalpha() or ch == '_')

    def _is_id_continue(self, ch: str) -> bool:
        return ch.isascii() and (ch.isalnum() or ch == '_')

    # -- Whitespace and comments -------------------------------------------

    def skip_ws(self) -> None:
        """Skip whitespace and comments."""
        while self.pos < len(self.src):
            ch = self.src[self.pos]
            # Whitespace
            if ch in ' \t\n\r':
                self.pos += 1
                continue
            # Line comment
            if self.src[self.pos:self.pos + 2] == '//':
                self.pos += 2
                while self.pos < len(self.src) and self.src[self.pos] not in '\n\r':
                    self.pos += 1
                continue
            # Block comment (non-nesting)
            if self.src[self.pos:self.pos + 2] == '/*':
                self.pos += 2
                while self.pos < len(self.src):
                    if self.src[self.pos:self.pos + 2] == '*/':
                        self.pos += 2
                        break
                    self.pos += 1
                else:
                    self.error("Unterminated block comment")
                continue
            # Pipe operator reserved
            if self.src[self.pos:self.pos + 2] == '|>':
                self.error("Pipe operator '|>' is reserved for future use")
            break

    # -- Expression grammar ------------------------------------------------

    def parse_expression(self):
        """Expression ← _ LetExpr _"""
        self.skip_ws()
        return self.parse_let_expr()

    def parse_let_expr(self):
        """LetExpr ← 'let' _ Identifier _ '=' _ IfExpr _ 'in' _ LetExpr / IfExpr"""
        start = self.pos
        if self.match_keyword('let'):
            self.skip_ws()
            name = self._expect_identifier()
            self.skip_ws()
            self.expect_str('=')
            self.skip_ws()
            # Value position: parse up to (but not including) bare 'in'
            # to avoid ambiguity with let...in. Use parentheses for
            # membership in let values: let x = (1 in $y) in ...
            value = self._parse_let_value()
            self.skip_ws()
            if not self.match_keyword('in'):
                self.error("Expected 'in' after let value")
            self.skip_ws()
            body = self.parse_let_expr()
            return LetBinding(name, value, body, self._source_pos(start))
        return self.parse_if_expr()

    def parse_if_expr(self):
        """IfExpr ← 'if' _ Ternary _ 'then' _ IfExpr _ 'else' _ IfExpr
                  / 'if' _ '(' ...  (IfCall)
                  / Ternary
        """
        start = self.pos
        if self.match_keyword('if'):
            self.skip_ws()
            # Disambiguate: if( = function call, if ... then = keyword
            if self.peek_char() == '(':
                return self._parse_if_call(start)
            condition = self.parse_ternary()
            self.skip_ws()
            if not self.match_keyword('then'):
                self.error("Expected 'then' after if-condition")
            self.skip_ws()
            then_expr = self.parse_if_expr()
            self.skip_ws()
            if not self.match_keyword('else'):
                self.error("Expected 'else' in if-then-else")
            self.skip_ws()
            else_expr = self.parse_if_expr()
            return IfThenElse(condition, then_expr, else_expr, self._source_pos(start))
        return self.parse_ternary()

    def _parse_if_call(self, start: int):
        """Parse if(a, b, c) as FunctionCall('if', ...)."""
        self.expect_str('(')
        self.skip_ws()
        args = self._parse_arg_list()
        self.skip_ws()
        self.expect_str(')')
        node = FunctionCall('if', tuple(args), self._source_pos(start))
        return self._parse_postfix_tail(node, start)

    def parse_ternary(self):
        """Ternary ← LogicalOr (_ '?' _ Expression _ ':' _ Expression)?"""
        start = self.pos
        left = self.parse_logical_or()
        self.skip_ws()
        if self.match_str('??'):
            # Oops, that's null-coalesce not ternary. Put it back.
            self.pos -= 2
            return left
        if self.match_str('?'):
            self.skip_ws()
            then_expr = self.parse_expression()
            self.skip_ws()
            self.expect_str(':')
            self.skip_ws()
            else_expr = self.parse_expression()
            return TernaryOp(left, then_expr, else_expr, self._source_pos(start))
        return left

    def parse_logical_or(self):
        """LogicalOr ← LogicalAnd (_ 'or' !IdContinue _ LogicalAnd)*"""
        start = self.pos
        left = self.parse_logical_and()
        while True:
            self.skip_ws()
            if self.match_keyword('or'):
                self.skip_ws()
                right = self.parse_logical_and()
                left = BinaryOp('or', left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_logical_and(self):
        """LogicalAnd ← Equality (_ 'and' !IdContinue _ Equality)*"""
        start = self.pos
        left = self.parse_equality()
        while True:
            self.skip_ws()
            if self.match_keyword('and'):
                self.skip_ws()
                right = self.parse_equality()
                left = BinaryOp('and', left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_equality(self):
        """Equality ← Comparison ((_ '!=' / _ '=') _ Comparison)*"""
        start = self.pos
        left = self.parse_comparison()
        while True:
            self.skip_ws()
            if self.match_str('!='):
                self.skip_ws()
                right = self.parse_comparison()
                left = BinaryOp('!=', left, right, self._source_pos(start))
            elif self.peek_char() == '=' and self.src[self.pos:self.pos + 2] != '==':
                self.pos += 1
                self.skip_ws()
                right = self.parse_comparison()
                left = BinaryOp('=', left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_comparison(self):
        """Comparison ← Membership ((_ '<=' / _ '>=' / _ '<' / _ '>') _ Membership)*"""
        start = self.pos
        left = self.parse_membership()
        while True:
            self.skip_ws()
            op = None
            for candidate in ('<=', '>=', '<', '>'):
                if self.match_str(candidate):
                    op = candidate
                    break
            if op:
                self.skip_ws()
                right = self.parse_membership()
                left = BinaryOp(op, left, right, self._source_pos(start))
            else:
                break
        return left

    def _parse_let_value(self):
        """Parse expression for let-value position.

        Same as parse_if_expr but skips the membership 'in' operator
        to avoid ambiguity with let...in.
        """
        start = self.pos
        if self.match_keyword('if'):
            self.skip_ws()
            if self.peek_char() == '(':
                return self._parse_if_call(start)
            condition = self.parse_ternary()
            self.skip_ws()
            if not self.match_keyword('then'):
                self.error("Expected 'then' after if-condition")
            self.skip_ws()
            then_expr = self._parse_let_value()
            self.skip_ws()
            if not self.match_keyword('else'):
                self.error("Expected 'else' in if-then-else")
            self.skip_ws()
            else_expr = self._parse_let_value()
            return IfThenElse(condition, then_expr, else_expr, self._source_pos(start))
        # Ternary -> LogicalOr -> ... -> Membership(no bare in) -> ...
        return self._parse_ternary_no_in()

    def _parse_ternary_no_in(self):
        start = self.pos
        left = self._parse_logical_or_no_in()
        self.skip_ws()
        if self.match_str('??'):
            self.pos -= 2
            return left
        if self.match_str('?'):
            self.skip_ws()
            then_expr = self.parse_expression()
            self.skip_ws()
            self.expect_str(':')
            self.skip_ws()
            else_expr = self.parse_expression()
            return TernaryOp(left, then_expr, else_expr, self._source_pos(start))
        return left

    def _parse_logical_or_no_in(self):
        start = self.pos
        left = self._parse_logical_and_no_in()
        while True:
            self.skip_ws()
            if self.match_keyword('or'):
                self.skip_ws()
                right = self._parse_logical_and_no_in()
                left = BinaryOp('or', left, right, self._source_pos(start))
            else:
                break
        return left

    def _parse_logical_and_no_in(self):
        start = self.pos
        left = self._parse_equality_no_in()
        while True:
            self.skip_ws()
            if self.match_keyword('and'):
                self.skip_ws()
                right = self._parse_equality_no_in()
                left = BinaryOp('and', left, right, self._source_pos(start))
            else:
                break
        return left

    def _parse_equality_no_in(self):
        start = self.pos
        left = self._parse_comparison_no_in()
        while True:
            self.skip_ws()
            if self.match_str('!='):
                self.skip_ws()
                right = self._parse_comparison_no_in()
                left = BinaryOp('!=', left, right, self._source_pos(start))
            elif self.peek_char() == '=' and self.src[self.pos:self.pos + 2] != '==':
                self.pos += 1
                self.skip_ws()
                right = self._parse_comparison_no_in()
                left = BinaryOp('=', left, right, self._source_pos(start))
            else:
                break
        return left

    def _parse_comparison_no_in(self):
        start = self.pos
        left = self.parse_null_coalesce()  # Skip membership entirely
        while True:
            self.skip_ws()
            op = None
            for candidate in ('<=', '>=', '<', '>'):
                if self.match_str(candidate):
                    op = candidate
                    break
            if op:
                self.skip_ws()
                right = self.parse_null_coalesce()
                left = BinaryOp(op, left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_membership(self):
        """Membership ← NullCoalesce (_ 'not' _ 'in' _ NullCoalesce
                                      / _ 'in' !IdContinue _ NullCoalesce)?"""
        start = self.pos
        left = self.parse_null_coalesce()
        self.skip_ws()
        save = self.pos
        if self.match_keyword('not'):
            self.skip_ws()
            if self.match_keyword('in'):
                self.skip_ws()
                right = self.parse_null_coalesce()
                return MembershipOp(left, right, True, self._source_pos(start))
            # Not "not in", rewind
            self.pos = save
        elif self.match_keyword('in'):
            self.skip_ws()
            right = self.parse_null_coalesce()
            return MembershipOp(left, right, False, self._source_pos(start))
        return left

    def parse_null_coalesce(self):
        """NullCoalesce ← Addition (_ '??' _ Addition)*"""
        start = self.pos
        left = self.parse_addition()
        while True:
            self.skip_ws()
            if self.match_str('??'):
                self.skip_ws()
                right = self.parse_addition()
                left = BinaryOp('??', left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_addition(self):
        """Addition ← Multiplication ((_ '+' / _ '-' / _ '&') _ Multiplication)*"""
        start = self.pos
        left = self.parse_multiplication()
        while True:
            self.skip_ws()
            ch = self.peek_char()
            if ch and ch in '+-&':
                self.pos += 1
                op = ch
                self.skip_ws()
                right = self.parse_multiplication()
                left = BinaryOp(op, left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_multiplication(self):
        """Multiplication ← Unary ((_ '*' / _ '/' / _ '%') _ Unary)*"""
        start = self.pos
        left = self.parse_unary()
        while True:
            self.skip_ws()
            ch = self.peek_char()
            if ch and ch in '*/%':
                self.pos += 1
                op = ch
                self.skip_ws()
                right = self.parse_unary()
                left = BinaryOp(op, left, right, self._source_pos(start))
            else:
                break
        return left

    def parse_unary(self):
        """Unary ← 'not' !IdContinue _ Unary / '-' _ Unary / Postfix"""
        start = self.pos
        if self.match_keyword('not'):
            self.skip_ws()
            operand = self.parse_unary()
            return UnaryOp('not', operand, self._source_pos(start))
        if self.peek_char() == '-':
            # Unary minus: only if not a number literal (handled in atom)
            # We parse it as unary and let number literals be positive only at atom level
            self.pos += 1
            self.skip_ws()
            operand = self.parse_unary()
            return UnaryOp('-', operand, self._source_pos(start))
        return self.parse_postfix()

    def parse_postfix(self):
        """Postfix ← Atom PathTail*"""
        start = self.pos
        node = self.parse_atom()
        segments = self._parse_path_tails()
        if segments:
            return PostfixAccess(node, tuple(segments), self._source_pos(start))
        return node

    def _parse_path_tails(self) -> list:
        """Parse zero or more PathTail: '.' Identifier / '[' _ (Integer/'*') _ ']'"""
        segments = []
        while True:
            if self.pos < len(self.src) and self.src[self.pos] == '.':
                self.pos += 1
                name = self._try_identifier()
                if name is None:
                    self.pos -= 1
                    break
                segments.append(DotSegment(name))
            elif self.pos < len(self.src) and self.src[self.pos] == '[':
                self.pos += 1
                self.skip_ws()
                if self.match_str('*'):
                    segments.append(WildcardSegment())
                else:
                    idx = self._match_integer()
                    if idx is None:
                        # Rewind - not a path tail
                        self.pos -= 1
                        break
                    segments.append(IndexSegment(idx))
                self.skip_ws()
                self.expect_str(']')
            else:
                break
        return segments

    def parse_atom(self):
        """Atom ← IfCall / FunctionCall / FieldRef / ObjectLiteral
                  / ArrayLiteral / Literal / '(' _ Expression _ ')'"""
        self.skip_ws()
        if self.at_end():
            self.error("Unexpected end of expression")

        ch = self.peek_char()

        # Parenthesized expression
        if ch == '(':
            self.pos += 1
            self.skip_ws()
            expr = self.parse_expression()
            self.skip_ws()
            self.expect_str(')')
            return expr

        # Field reference: $ ...
        if ch == '$':
            return self._parse_field_ref()

        # @ could be date/datetime literal or context ref
        if ch == '@':
            return self._parse_at_prefix()

        # Array literal
        if ch == '[':
            return self._parse_array_literal()

        # Object literal
        if ch == '{':
            return self._parse_object_literal()

        # String literal
        if ch in "'\"":
            return self._parse_string_literal()

        # Number literal (positive only; unary minus handled in parse_unary)
        if ch.isdigit():
            return self._parse_number_literal()

        # Keywords: true, false, null (checked before identifier)
        if self._is_id_start(ch):
            return self._parse_identifier_or_keyword_or_call()

        self.error(f"Unexpected character: {ch!r}")

    # -- Atom sub-parsers --------------------------------------------------

    def _parse_field_ref(self):
        """FieldRef ← '$' Identifier PathTail* / '$'"""
        start = self.pos
        self.pos += 1  # consume '$'
        name = self._try_identifier_raw()  # No reserved-word check for field names
        if name is None:
            # Bare $
            return FieldRef((), self._source_pos(start))
        segments = [DotSegment(name)]
        segments.extend(self._parse_path_tails())
        return FieldRef(tuple(segments), self._source_pos(start))

    def _parse_at_prefix(self):
        """@ followed by digits = date/datetime. @ followed by letter = ContextRef."""
        start = self.pos
        # Look ahead past '@'
        if self.pos + 1 < len(self.src) and self.src[self.pos + 1].isdigit():
            return self._parse_date_or_datetime_literal()
        # Context reference
        self.pos += 1  # consume '@'
        name = self._try_identifier_raw()
        if name is None:
            self.error("Expected identifier after '@'")
        # Optional (StringLiteral) argument
        arg = None
        if self.pos < len(self.src) and self.src[self.pos] == '(':
            self.pos += 1
            self.skip_ws()
            arg_node = self._parse_string_literal()
            arg = arg_node.value
            self.skip_ws()
            self.expect_str(')')
        # Optional dot-chained tail
        tail = []
        while self.pos < len(self.src) and self.src[self.pos] == '.':
            self.pos += 1
            t = self._try_identifier_raw()
            if t is None:
                self.pos -= 1
                break
            tail.append(t)
        return ContextRef(name, arg, tuple(tail), self._source_pos(start))

    def _parse_date_or_datetime_literal(self):
        """DateTimeLiteral / DateLiteral starting with '@'."""
        start = self.pos
        self.pos += 1  # consume '@'
        # Match YYYY-MM-DD
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})', self.src[self.pos:])
        if not m:
            self.error("Invalid date literal after '@'")
        yr, mo, dy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        self.pos += len(m.group(0))
        # Try datetime: T followed by HH:MM:SS
        mt = re.match(r'T(\d{2}):(\d{2}):(\d{2})', self.src[self.pos:])
        if mt:
            hr, mn, sc = int(mt.group(1)), int(mt.group(2)), int(mt.group(3))
            self.pos += len(mt.group(0))
            # Optional timezone
            tz = None
            if self.pos < len(self.src) and self.src[self.pos] == 'Z':
                self.pos += 1
                tz = timezone.utc
            else:
                mtz = re.match(r'([+-])(\d{2}):(\d{2})', self.src[self.pos:])
                if mtz:
                    sign = 1 if mtz.group(1) == '+' else -1
                    tz = timezone(timedelta(hours=sign * int(mtz.group(2)),
                                            minutes=sign * int(mtz.group(3))))
                    self.pos += len(mtz.group(0))
            try:
                dt = datetime(yr, mo, dy, hr, mn, sc, tzinfo=tz)
            except ValueError as e:
                self.error(f"Invalid datetime: {e}", start)
            return DateLiteral(dt, self._source_pos(start))
        # Date only
        try:
            d = date(yr, mo, dy)
        except ValueError as e:
            self.error(f"Invalid date: {e}", start)
        return DateLiteral(d, self._source_pos(start))

    def _parse_string_literal(self):
        """StringLiteral ← single or double quoted with escape sequences."""
        start = self.pos
        quote = self.src[self.pos]
        if quote not in "'\"":
            self.error("Expected string literal")
        self.pos += 1
        chars = []
        while self.pos < len(self.src):
            ch = self.src[self.pos]
            if ch == quote:
                self.pos += 1
                return StringLiteral(''.join(chars), self._source_pos(start))
            if ch == '\\':
                self.pos += 1
                if self.pos >= len(self.src):
                    self.error("Unterminated escape sequence")
                esc = self.src[self.pos]
                if esc == '\\':
                    chars.append('\\')
                elif esc == "'":
                    chars.append("'")
                elif esc == '"':
                    chars.append('"')
                elif esc == 'n':
                    chars.append('\n')
                elif esc == 'r':
                    chars.append('\r')
                elif esc == 't':
                    chars.append('\t')
                elif esc == 'u':
                    # \uXXXX
                    hex_str = self.src[self.pos + 1:self.pos + 5]
                    if len(hex_str) < 4 or not all(c in '0123456789abcdefABCDEF' for c in hex_str):
                        self.error("Invalid unicode escape: expected 4 hex digits")
                    chars.append(chr(int(hex_str, 16)))
                    self.pos += 4
                else:
                    self.error(f"Unrecognized escape sequence: \\{esc}")
                self.pos += 1
            else:
                chars.append(ch)
                self.pos += 1
        self.error("Unterminated string literal", start)

    def _parse_number_literal(self):
        """NumberLiteral (positive only — unary minus handled in parse_unary)."""
        start = self.pos
        m = re.match(r'(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?', self.src[self.pos:])
        if not m or not m.group(0):
            self.error("Invalid number literal")
        text = m.group(0)
        # Check no trailing dot: matched decimal part must have digits after dot
        self.pos += len(text)
        try:
            value = Decimal(text)
        except InvalidOperation:
            self.error(f"Invalid number: {text}", start)
        return NumberLiteral(value, self._source_pos(start))

    def _parse_array_literal(self):
        """ArrayLiteral ← '[' _ (Expression (_ ',' _ Expression)*)? _ ']'"""
        start = self.pos
        self.pos += 1  # consume '['
        self.skip_ws()
        elements = []
        if self.peek_char() != ']':
            elements.append(self.parse_expression())
            while True:
                self.skip_ws()
                if self.match_str(','):
                    self.skip_ws()
                    elements.append(self.parse_expression())
                else:
                    break
        self.skip_ws()
        self.expect_str(']')
        return ArrayLiteral(tuple(elements), self._source_pos(start))

    def _parse_object_literal(self):
        """ObjectLiteral ← '{' _ ObjectEntries? _ '}'"""
        start = self.pos
        self.pos += 1  # consume '{'
        self.skip_ws()
        entries = []
        seen_keys = set()
        if self.peek_char() != '}':
            key, val = self._parse_object_entry()
            if key in seen_keys:
                self.error(f"Duplicate key in object literal: {key!r}")
            seen_keys.add(key)
            entries.append((key, val))
            while True:
                self.skip_ws()
                if self.match_str(','):
                    self.skip_ws()
                    key, val = self._parse_object_entry()
                    if key in seen_keys:
                        self.error(f"Duplicate key in object literal: {key!r}")
                    seen_keys.add(key)
                    entries.append((key, val))
                else:
                    break
        self.skip_ws()
        self.expect_str('}')
        return ObjectLiteral(tuple(entries), self._source_pos(start))

    def _parse_object_entry(self):
        """ObjectEntry ← (Identifier / StringLiteral) _ ':' _ Expression"""
        self.skip_ws()
        ch = self.peek_char()
        if ch in "'\"":
            key_node = self._parse_string_literal()
            key = key_node.value
        else:
            key = self._try_identifier_raw()
            if key is None:
                self.error("Expected object key (identifier or string)")
        self.skip_ws()
        self.expect_str(':')
        self.skip_ws()
        val = self.parse_expression()
        return key, val

    def _parse_identifier_or_keyword_or_call(self):
        """Parse an identifier-starting atom: true/false/null, or function call."""
        start = self.pos
        # Try boolean/null literals
        for kw, factory in [('true', lambda s: BooleanLiteral(True, s)),
                             ('false', lambda s: BooleanLiteral(False, s)),
                             ('null', lambda s: NullLiteral(s))]:
            if self.match_keyword(kw):
                return factory(self._source_pos(start))

        # Identifier: could be function call (name followed by '(') or
        # a let-bound variable reference (bare identifier)
        name = self._try_identifier()
        if name is None:
            self.error("Unexpected reserved word or invalid identifier")
        self.skip_ws()
        if self.peek_char() == '(':
            self.pos += 1  # consume '('
            self.skip_ws()
            args = self._parse_arg_list()
            self.skip_ws()
            self.expect_str(')')
            return FunctionCall(name, tuple(args), self._source_pos(start))
        # Bare identifier — let-bound variable (resolved during evaluation)
        return FieldRef((DotSegment(name),), self._source_pos(start))

    def _parse_arg_list(self) -> list:
        """ArgList ← Expression (_ ',' _ Expression)*  (or empty)"""
        args = []
        if self.peek_char() == ')':
            return args
        args.append(self.parse_expression())
        while True:
            self.skip_ws()
            if self.match_str(','):
                self.skip_ws()
                args.append(self.parse_expression())
            else:
                break
        return args

    def _parse_postfix_tail(self, node, start):
        """Wrap node in PostfixAccess if path tails follow."""
        segments = self._parse_path_tails()
        if segments:
            return PostfixAccess(node, tuple(segments), self._source_pos(start))
        return node

    # -- Identifier helpers ------------------------------------------------

    def _try_identifier_raw(self) -> str | None:
        """Match [a-zA-Z_][a-zA-Z0-9_]* without reserved word check."""
        if self.pos >= len(self.src) or not self._is_id_start(self.src[self.pos]):
            return None
        start = self.pos
        self.pos += 1
        while self.pos < len(self.src) and self._is_id_continue(self.src[self.pos]):
            self.pos += 1
        return self.src[start:self.pos]

    def _try_identifier(self) -> str | None:
        """Match Identifier (excluding reserved words)."""
        save = self.pos
        name = self._try_identifier_raw()
        if name is None:
            return None
        if name in RESERVED_WORDS:
            self.pos = save
            return None
        return name

    def _expect_identifier(self) -> str:
        name = self._try_identifier()
        if name is None:
            self.error("Expected identifier")
        return name

    def _match_integer(self) -> int | None:
        """Match [0-9]+, return int or None."""
        if self.pos >= len(self.src) or not self.src[self.pos].isdigit():
            return None
        start = self.pos
        while self.pos < len(self.src) and self.src[self.pos].isdigit():
            self.pos += 1
        return int(self.src[start:self.pos])
