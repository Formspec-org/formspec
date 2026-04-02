//! FEL abstract syntax tree node definitions and operators.
use rust_decimal::Decimal;

/// A path segment for field references and postfix access (`$a.b`, `$a[1]`, `$a[*]`).
#[derive(Debug, Clone, PartialEq)]
pub enum PathSegment {
    /// Property after a dot (identifier name).
    Dot(String),
    /// Numeric index inside `[` `]`.
    Index(usize),
    /// Repeat wildcard `[*]`.
    Wildcard,
}

/// Expression AST for Formspec Expression Language (FEL).
///
/// Covers literals, operators, `let`/`if`, function calls, `$` field refs, and `@` context refs.
/// Shape follows `specs/fel/fel-grammar.llm.md` in the Formspec repo.
#[allow(missing_docs)]
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    // Literals
    Null,
    Boolean(bool),
    Number(Decimal),
    String(String),
    DateLiteral(String),
    DateTimeLiteral(String),

    // Collections
    Array(Vec<Expr>),
    Object(Vec<(String, Expr)>),

    // References
    FieldRef {
        name: Option<String>,
        path: Vec<PathSegment>,
    },
    ContextRef {
        name: String,
        arg: Option<String>,
        tail: Vec<String>,
    },

    // Operators
    UnaryOp {
        op: UnaryOp,
        operand: Box<Expr>,
        /// `true` when the source used `!` instead of keyword `not`.
        /// Only meaningful when `op` is `Not`; always `false` for `Neg`.
        bang: bool,
    },
    BinaryOp {
        op: BinaryOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
    Ternary {
        condition: Box<Expr>,
        then_branch: Box<Expr>,
        else_branch: Box<Expr>,
    },
    IfThenElse {
        condition: Box<Expr>,
        then_branch: Box<Expr>,
        else_branch: Box<Expr>,
    },
    Membership {
        value: Box<Expr>,
        container: Box<Expr>,
        negated: bool,
    },
    NullCoalesce {
        left: Box<Expr>,
        right: Box<Expr>,
    },

    // Control flow
    LetBinding {
        name: String,
        value: Box<Expr>,
        body: Box<Expr>,
    },

    // Function call
    FunctionCall {
        name: String,
        args: Vec<Expr>,
    },

    // Postfix access on an expression
    PostfixAccess {
        expr: Box<Expr>,
        path: Vec<PathSegment>,
    },
}

/// Unary operators (`not`, unary `-`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    /// Logical not.
    Not,
    /// Arithmetic negation.
    Neg,
}

/// Binary and logical operators (precedence enforced in the parser).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    /// `+`
    Add,
    /// `-`
    Sub,
    /// `*`
    Mul,
    /// `/`
    Div,
    /// `%`
    Mod,
    /// `&` string concatenation.
    Concat,
    /// `=` or `==`
    Eq,
    /// `!=`
    NotEq,
    /// `<`
    Lt,
    /// `>`
    Gt,
    /// `<=`
    LtEq,
    /// `>=`
    GtEq,
    /// `and`
    And,
    /// `or`
    Or,
}
