import type { AnyCommand } from '@formspec-org/core';
import { checkVariableSelfReference } from './lib/fel-rewriter.js';
import {
  HelperError,
  type HelperResult,
  type HelperWarning,
  type InstanceProps,
} from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';

function validateInstanceExists(project: ProjectInternals, name: string): void {
  if (!project.core.instanceNames().includes(name)) {
    throw new HelperError('INSTANCE_NOT_FOUND', `Instance "${name}" does not exist`, {
      name,
      validInstances: project.core.instanceNames(),
    });
  }
}

/** Add a named FEL variable. */
export function addVariable(
  project: ProjectInternals,
  name: string,
  expression: string,
  scope?: string,
): HelperResult {
  project._validateFEL(expression);
  checkVariableSelfReference(name, expression);
  const payload: Record<string, unknown> = { name, expression };
  if (scope) payload.scope = scope;

  project.core.dispatch({ type: 'definition.addVariable', payload });

  return {
    summary: `Added variable '${name}'`,
    action: { helper: 'addVariable', params: { name, expression, scope } },
    affectedPaths: [],
  };
}

/** Update a variable's expression. */
export function updateVariable(project: ProjectInternals, name: string, expression: string): HelperResult {
  if (!project.core.variableNames().includes(name)) {
    throw new HelperError('VARIABLE_NOT_FOUND', `Variable "${name}" does not exist`, {
      name,
      validVariables: project.core.variableNames(),
    });
  }
  project._validateFEL(expression);
  checkVariableSelfReference(name, expression);
  project.core.dispatch({
    type: 'definition.setVariable',
    payload: { name, property: 'expression', value: expression },
  });

  return {
    summary: `Updated variable '${name}'`,
    action: { helper: 'updateVariable', params: { name, expression } },
    affectedPaths: [],
  };
}

/** Remove a variable — warns about dangling references. */
export function removeVariable(project: ProjectInternals, name: string): HelperResult {
  if (!project.core.variableNames().includes(name)) {
    throw new HelperError('VARIABLE_NOT_FOUND', `Variable "${name}" does not exist`, {
      name,
      validVariables: project.core.variableNames(),
    });
  }
  const warnings: HelperWarning[] = [];
  const allExprs = project.core.allExpressions();
  const varRefAt = `@${name}`;
  const varRefDollar = `$${name}`;
  const danglingPaths: string[] = [];

  for (const exprLoc of allExprs) {
    if (
      typeof exprLoc.expression === 'string' &&
      (exprLoc.expression.includes(varRefAt) || exprLoc.expression.includes(varRefDollar))
    ) {
      danglingPaths.push(exprLoc.location ?? 'unknown');
    }
  }

  if (danglingPaths.length > 0) {
    warnings.push({
      code: 'DANGLING_REFERENCES',
      message: `${danglingPaths.length} expression(s) still reference @${name}`,
      detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
    });
  }

  project.core.dispatch({ type: 'definition.deleteVariable', payload: { name } });

  return {
    summary: `Removed variable '${name}'`,
    action: { helper: 'removeVariable', params: { name } },
    affectedPaths: [],
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Rename a definition variable and rewrite FEL references — **not implemented**.
 *
 * Blocked on a `definition.renameVariable` (or equivalent) command in
 * `@formspec-org/core`; until that exists this helper always throws
 * {@link HelperError} with code `NOT_IMPLEMENTED`. See the studio README
 * “Known limitations” section for the product-facing note.
 */
export function renameVariable(_project: ProjectInternals, name: string, newName: string): HelperResult {
  throw new HelperError(
    'NOT_IMPLEMENTED',
    `renameVariable is not yet implemented (definition.renameVariable handler does not exist)`,
    { name, newName },
  );
}

/** Add a named external data source. */
export function addInstance(project: ProjectInternals, name: string, props: InstanceProps): HelperResult {
  project.core.dispatch({
    type: 'definition.addInstance',
    payload: { name, ...props },
  });

  return {
    summary: `Added instance '${name}'`,
    action: { helper: 'addInstance', params: { name, ...props } },
    affectedPaths: [],
  };
}

/** Update instance properties. */
export function updateInstance(
  project: ProjectInternals,
  name: string,
  changes: Partial<InstanceProps>,
): HelperResult {
  validateInstanceExists(project, name);
  const commands: AnyCommand[] = [];
  for (const [prop, val] of Object.entries(changes)) {
    if (val !== undefined) {
      commands.push({
        type: 'definition.setInstance',
        payload: { name, property: prop, value: val },
      });
    }
  }
  if (commands.length > 0) project.core.dispatch(commands);

  return {
    summary: `Updated instance '${name}'`,
    action: { helper: 'updateInstance', params: { name, changes } },
    affectedPaths: [],
  };
}

/** Rename an instance — rewrites FEL references. */
export function renameInstance(project: ProjectInternals, name: string, newName: string): HelperResult {
  validateInstanceExists(project, name);
  project.core.dispatch({
    type: 'definition.renameInstance',
    payload: { name, newName },
  });

  return {
    summary: `Renamed instance '${name}' to '${newName}'`,
    action: { helper: 'renameInstance', params: { name, newName } },
    affectedPaths: [],
  };
}

/** Remove an instance. */
export function removeInstance(project: ProjectInternals, name: string): HelperResult {
  validateInstanceExists(project, name);
  const warnings: HelperWarning[] = [];
  const allExprs = project.core.allExpressions();
  const ref = `@instance('${name}')`;
  const danglingPaths: string[] = [];

  for (const exprLoc of allExprs) {
    if (typeof exprLoc.expression === 'string' && exprLoc.expression.includes(ref)) {
      danglingPaths.push(exprLoc.location ?? 'unknown');
    }
  }

  if (danglingPaths.length > 0) {
    warnings.push({
      code: 'DANGLING_REFERENCES',
      message: `${danglingPaths.length} expression(s) still reference @instance('${name}')`,
      detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
    });
  }

  project.core.dispatch({ type: 'definition.deleteInstance', payload: { name } });

  return {
    summary: `Removed instance '${name}'`,
    action: { helper: 'removeInstance', params: { name } },
    affectedPaths: [],
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
