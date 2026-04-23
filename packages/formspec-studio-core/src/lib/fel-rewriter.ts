/** @filedesc Pure FEL rewrite helpers for repeat-scoped shape rules and variable checks. */
import { analyzeFEL } from '@formspec-org/engine/fel-runtime';
import { rewriteFELReferences, rewriteMessageTemplate } from '@formspec-org/engine/fel-tools';
import { HelperError } from '../helper-types.js';

/** Throw CIRCULAR_REFERENCE if the expression references the variable being defined. */
export function checkVariableSelfReference(name: string, expression: string): void {
  const analysis = analyzeFEL(expression);
  if (analysis.valid && analysis.variables.includes(name)) {
    throw new HelperError('CIRCULAR_REFERENCE', `Variable "${name}" references itself`, {
      name,
      expression,
    });
  }
}

/**
 * Build a rewriter that canonicalizes FEL references from template (authored)
 * paths to row-scoped paths after normalizeShapeTarget inserts [*].
 */
export function buildRepeatScopeRewriter(
  authoredTarget: string,
): { rewriteExpression: (expr: string) => string; rewriteMessage: (msg: string) => string } {
  const authoredParts = authoredTarget.split('.');
  const authoredRowScope = authoredParts.slice(0, -1).join('.');

  const rewriteFieldPath = (refPath: string): string => {
    if (refPath.includes('[*]')) return refPath;
    if (refPath === authoredTarget) return '';
    if (authoredRowScope && refPath.startsWith(authoredRowScope + '.')) {
      const relative = refPath.slice(authoredRowScope.length + 1);
      return relative;
    }
    return refPath;
  };

  const buildRewriteMap = (source: string): Record<string, string> => {
    const map: Record<string, string> = {};
    const refPattern = /\$([a-zA-Z_]\w*(?:\.\w+)*)/g;
    let match;
    while ((match = refPattern.exec(source)) !== null) {
      const refPath = match[1];
      const rewritten = rewriteFieldPath(refPath);
      if (rewritten !== refPath) {
        map[refPath] = rewritten;
      }
    }
    return map;
  };

  return {
    rewriteExpression: (expr: string): string => {
      try {
        return rewriteFELReferences(expr, { rewriteFieldPath });
      } catch {
        return expr;
      }
    },
    rewriteMessage: (msg: string): string => {
      const fieldMap = buildRewriteMap(msg);
      if (Object.keys(fieldMap).length === 0) return msg;
      try {
        return rewriteMessageTemplate(msg, { fieldPaths: fieldMap });
      } catch {
        return msg;
      }
    },
  };
}
