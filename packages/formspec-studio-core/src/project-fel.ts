/** @filedesc FEL expression helpers for form authoring. */
import type { FELParseContext, FELParseResult, FELReferenceSet, FELFunctionEntry } from '@formspec-org/core';
import type { FELValidationResult, FELSuggestion } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';
import { humanizeFEL } from './authoring-helpers.js';

/** Validate a FEL expression and return detailed diagnostics. */
export function validateFELExpression(project: ProjectInternals, expression: string, contextPath?: string): FELValidationResult {
  const context: FELParseContext | undefined = contextPath ? { targetPath: contextPath } : undefined;
  const parseResult = project.core.parseFEL(expression, context);
  return {
    valid: parseResult.valid,
    errors: parseResult.errors.map(d => ({
      message: d.message,
      line: d.line,
      column: d.column,
    })),
    references: parseResult.references,
    functions: parseResult.functions,
  };
}

/** Return autocomplete suggestions for a partial FEL expression. */
export function felAutocompleteSuggestions(project: ProjectInternals, partial: string, contextPath?: string): FELSuggestion[] {
  const context: FELParseContext | undefined = contextPath ? { targetPath: contextPath } : undefined;
  const refs = project.core.availableReferences(context);
  const catalog = project.core.felFunctionCatalog();

  // Extract the token being typed — strip leading $ or @ if present
  const stripped = partial.replace(/^\$/, '').replace(/^@/, '');
  const isFieldPrefix = partial.startsWith('$');
  const isVarPrefix = partial.startsWith('@');
  const lowerStripped = stripped.toLowerCase();

  const suggestions: FELSuggestion[] = [];

  // Field suggestions
  if (!isVarPrefix) {
    for (const field of refs.fields) {
      if (lowerStripped && !field.path.toLowerCase().startsWith(lowerStripped)) continue;
      suggestions.push({
        label: field.path,
        kind: 'field',
        detail: field.label ? `${field.label} (${field.dataType})` : field.dataType,
        insertText: `$${field.path}`,
      });
    }
  }

  // Function suggestions
  if (!isFieldPrefix && !isVarPrefix) {
    for (const fn of catalog) {
      if (lowerStripped && !fn.name.toLowerCase().startsWith(lowerStripped)) continue;
      suggestions.push({
        label: fn.name,
        kind: 'function',
        detail: fn.description ?? fn.signature ?? fn.category,
        insertText: `${fn.name}(`,
      });
    }
  }

  // Variable suggestions
  if (!isFieldPrefix) {
    for (const v of refs.variables) {
      if (lowerStripped && !v.name.toLowerCase().startsWith(lowerStripped)) continue;
      suggestions.push({
        label: v.name,
        kind: 'variable',
        detail: v.expression ? `= ${v.expression}` : undefined,
        insertText: `@${v.name}`,
      });
    }
  }

  // Instance suggestions
  if (!isFieldPrefix && !isVarPrefix) {
    for (const inst of refs.instances) {
      if (lowerStripped && !inst.name.toLowerCase().startsWith(lowerStripped)) continue;
      suggestions.push({
        label: inst.name,
        kind: 'instance',
        detail: inst.source,
        insertText: `instance('${inst.name}')`,
      });
    }
  }

  // Context-specific keyword suggestions (e.g. @current, @index, @count)
  if (!isFieldPrefix) {
    for (const ref of refs.contextRefs) {
      const name = ref.startsWith('@') ? ref.slice(1) : ref;
      if (lowerStripped && !name.toLowerCase().startsWith(lowerStripped)) continue;
      suggestions.push({
        label: ref,
        kind: 'keyword',
        detail: 'context reference',
        insertText: ref.startsWith('@') ? ref : `@${name}`,
      });
    }
  }

  return suggestions;
}

/** Convert a FEL expression to a human-readable English string. */
export function humanizeFELExpression(project: ProjectInternals, expression: string): { text: string; supported: boolean } {
  return humanizeFEL(expression);
}
