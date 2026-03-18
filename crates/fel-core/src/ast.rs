//! FEL abstract syntax tree node definitions and operators.
use rust_decimal::Decimal;

/// A path segment for field references and postfix access.
#[derive(Debug, Clone, PartialEq)]
pub enum PathSegment {
    Dot(String),
    Index(usize),
    Wildcard,
}

/// An AST expression node.
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Not,
    Neg,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Concat,
    Eq,
    NotEq,
    Lt,
    Gt,
    LtEq,
    GtEq,
    And,
    Or,
}
