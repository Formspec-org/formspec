import { CstParser } from 'chevrotain';
import * as t from './lexer';

export class FelParser extends CstParser {
  constructor() {
    super(t.allTokens);
    this.performSelfAnalysis();
  }

  public expression = this.RULE('expression', () => {
    this.SUBRULE(this.letExpr);
  });

  private letExpr = this.RULE('letExpr', () => {
    this.OR([
      { ALT: () => {
          this.CONSUME(t.Let);
          this.CONSUME(t.Identifier);
          this.CONSUME(t.Equals);
          this.SUBRULE1(this.ifExpr, { LABEL: 'letValue' });
          this.CONSUME(t.In);
          this.SUBRULE(this.letExpr, { LABEL: 'inExpr' });
      }},
      { ALT: () => this.SUBRULE2(this.ifExpr) }
    ]);
  });

  private ifExpr = this.RULE('ifExpr', () => {
    this.OR([
      {
        GATE: () => {
          let i = 1;
          let tok = this.LA(i);
          if (tok.tokenType.name === 'EOF' || tok.tokenType !== t.If) return false;
          let parenLevel = 0;
          while (tok.tokenType.name !== 'EOF' && i < 100) {
            if (tok.tokenType === t.LRound) parenLevel++;
            else if (tok.tokenType === t.RRound) parenLevel--;
            else if (tok.tokenType === t.Then && parenLevel === 0) return true;
            i++;
            tok = this.LA(i);
          }
          return false;
        },
        ALT: () => {
          this.CONSUME(t.If);
          this.SUBRULE1(this.ternary, { LABEL: 'condition' });
          this.CONSUME(t.Then);
          this.SUBRULE1(this.ifExpr, { LABEL: 'thenExpr' });
          this.CONSUME(t.Else);
          this.SUBRULE2(this.ifExpr, { LABEL: 'elseExpr' });
        }
      },
      { ALT: () => this.SUBRULE2(this.ternary) }
    ]);
  });

  private ternary = this.RULE('ternary', () => {
    this.SUBRULE(this.logicalOr);
    this.OPTION(() => {
      this.CONSUME(t.Question);
      this.SUBRULE1(this.expression, { LABEL: 'trueExpr' });
      this.CONSUME(t.Colon);
      this.SUBRULE2(this.expression, { LABEL: 'falseExpr' });
    });
  });

  private logicalOr = this.RULE('logicalOr', () => {
    this.SUBRULE(this.logicalAnd);
    this.MANY(() => {
      this.CONSUME(t.Or);
      this.SUBRULE2(this.logicalAnd);
    });
  });

  private logicalAnd = this.RULE('logicalAnd', () => {
    this.SUBRULE(this.equality);
    this.MANY(() => {
      this.CONSUME(t.And);
      this.SUBRULE2(this.equality);
    });
  });

  private equality = this.RULE('equality', () => {
    this.SUBRULE(this.comparison);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(t.Equals) },
        { ALT: () => this.CONSUME(t.NotEquals) }
      ]);
      this.SUBRULE2(this.comparison);
    });
  });

  private comparison = this.RULE('comparison', () => {
    this.SUBRULE(this.membership);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(t.LessEqual) },
        { ALT: () => this.CONSUME(t.GreaterEqual) },
        { ALT: () => this.CONSUME(t.Less) },
        { ALT: () => this.CONSUME(t.Greater) }
      ]);
      this.SUBRULE2(this.membership);
    });
  });

  private membership = this.RULE('membership', () => {
    this.SUBRULE(this.nullCoalesce);
    this.OPTION(() => {
      this.OR([
        { ALT: () => {
            this.CONSUME(t.Not);
            this.CONSUME(t.In);
        }},
        { ALT: () => this.CONSUME2(t.In) }
      ]);
      this.SUBRULE2(this.nullCoalesce);
    });
  });

  private nullCoalesce = this.RULE('nullCoalesce', () => {
    this.SUBRULE(this.addition);
    this.MANY(() => {
      this.CONSUME(t.DoubleQuestion);
      this.SUBRULE2(this.addition);
    });
  });

  private addition = this.RULE('addition', () => {
    this.SUBRULE(this.multiplication);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(t.Plus) },
        { ALT: () => this.CONSUME(t.Minus) },
        { ALT: () => this.CONSUME(t.Ampersand) }
      ]);
      this.SUBRULE2(this.multiplication);
    });
  });

  private multiplication = this.RULE('multiplication', () => {
    this.SUBRULE(this.unary);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(t.Asterisk) },
        { ALT: () => this.CONSUME(t.Slash) },
        { ALT: () => this.CONSUME(t.Percent) }
      ]);
      this.SUBRULE2(this.unary);
    });
  });

  private unary = this.RULE('unary', () => {
    this.OR([
      { ALT: () => {
          this.CONSUME(t.Not);
          this.SUBRULE1(this.unary);
      }},
      { ALT: () => {
          this.CONSUME(t.Minus);
          this.SUBRULE2(this.unary);
      }},
      { ALT: () => this.SUBRULE(this.postfix) }
    ]);
  });

  private postfix = this.RULE('postfix', () => {
    this.SUBRULE(this.atom);
    this.MANY(() => {
      this.SUBRULE(this.pathTail);
    });
  });

  private pathTail = this.RULE('pathTail', () => {
    this.OR([
      { ALT: () => {
          this.CONSUME(t.Dot);
          this.CONSUME(t.Identifier);
      }},
      { ALT: () => {
          this.CONSUME(t.LSquare);
          this.OR1([
            { ALT: () => this.CONSUME(t.NumberLiteral) },
            { ALT: () => this.CONSUME(t.Asterisk) }
          ]);
          this.CONSUME(t.RSquare);
      }}
    ]);
  });

  private atom = this.RULE('atom', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.functionCall) },
      { ALT: () => this.SUBRULE(this.fieldRef) },
      { ALT: () => this.SUBRULE(this.objectLiteral) },
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => {
          this.CONSUME(t.LRound);
          this.SUBRULE(this.expression);
          this.CONSUME(t.RRound);
      }}
    ]);
  });

  private functionCall = this.RULE('functionCall', () => {
    this.CONSUME(t.Identifier);
    this.CONSUME(t.LRound);
    this.OPTION(() => this.SUBRULE(this.argList));
    this.CONSUME(t.RRound);
  });

  private argList = this.RULE('argList', () => {
    this.SUBRULE(this.expression);
    this.MANY(() => {
      this.CONSUME(t.Comma);
      this.SUBRULE2(this.expression);
    });
  });

  private objectLiteral = this.RULE('objectLiteral', () => {
    this.CONSUME(t.LCurly);
    this.OPTION(() => this.SUBRULE(this.objectEntries));
    this.CONSUME(t.RCurly);
  });

  private objectEntries = this.RULE('objectEntries', () => {
    this.SUBRULE(this.objectEntry);
    this.MANY(() => {
      this.CONSUME(t.Comma);
      this.SUBRULE2(this.objectEntry);
    });
  });

  private objectEntry = this.RULE('objectEntry', () => {
    this.OR([
      { ALT: () => this.CONSUME(t.Identifier) },
      { ALT: () => this.CONSUME(t.StringLiteral) }
    ]);
    this.CONSUME(t.Colon);
    this.SUBRULE(this.expression);
  });

  private arrayLiteral = this.RULE('arrayLiteral', () => {
    this.CONSUME(t.LSquare);
    this.OPTION(() => {
      this.SUBRULE(this.expression);
      this.MANY(() => {
        this.CONSUME(t.Comma);
        this.SUBRULE2(this.expression);
      });
    });
    this.CONSUME(t.RSquare);
  });

  private literal = this.RULE('literal', () => {
    this.OR([
      { ALT: () => this.CONSUME(t.DateTimeLiteral) },
      { ALT: () => this.CONSUME(t.DateLiteral) },
      { ALT: () => this.CONSUME(t.NumberLiteral) },
      { ALT: () => this.CONSUME(t.StringLiteral) },
      { ALT: () => this.CONSUME(t.True) },
      { ALT: () => this.CONSUME(t.False) },
      { ALT: () => this.CONSUME(t.Null) }
    ]);
  });

  private fieldRef = this.RULE('fieldRef', () => {
    this.OR([
      { ALT: () => {
          this.CONSUME(t.Dollar);
          this.OPTION(() => this.CONSUME(t.Identifier));
          this.MANY(() => this.SUBRULE(this.pathTail));
      }},
      { ALT: () => this.SUBRULE(this.contextRef) }
    ]);
  });

  private contextRef = this.RULE('contextRef', () => {
    this.CONSUME(t.At);
    this.CONSUME(t.Identifier);
    this.OPTION(() => {
        this.CONSUME(t.LRound);
        this.CONSUME(t.StringLiteral);
        this.CONSUME(t.RRound);
    });
    this.MANY(() => {
        this.CONSUME(t.Dot);
        this.CONSUME2(t.Identifier);
    });
  });
}

export const parser = new FelParser();
