/**
 * Behavior tools: showWhen, readonlyWhen, require, calculate, addRule.
 *
 * These manage conditional visibility, readonly state, required state,
 * calculated values, and validation rules.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { ValidationOptions } from 'formspec-studio-core';

export function handleShowWhen(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  condition: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.showWhen(target, condition);
  });
}

export function handleReadonlyWhen(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  condition: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.readonlyWhen(target, condition);
  });
}

export function handleRequire(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  condition?: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.require(target, condition);
  });
}

export function handleCalculate(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  expression: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.calculate(target, expression);
  });
}

export function handleAddRule(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  rule: string,
  message: string,
  options?: ValidationOptions,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addValidation(target, rule, message, options);
  });
}
