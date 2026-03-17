/** @filedesc Test helpers for formspec-mcp: factory functions for ProjectRegistry states. */
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectRegistry } from '../src/registry.js';

/** Create a registry with a project already in authoring phase */
export function registryWithProject(opts?: {
  seed?: Record<string, unknown>;
}): { registry: ProjectRegistry; projectId: string; project: Project } {
  const registry = new ProjectRegistry();
  const projectId = registry.newProject();
  const project = createProject(opts?.seed ? { seed: opts.seed as any } : undefined);
  registry.transitionToAuthoring(projectId, project);
  return { registry, projectId, project };
}

/** Create a registry with a project in bootstrap phase */
export function registryInBootstrap(): { registry: ProjectRegistry; projectId: string } {
  const registry = new ProjectRegistry();
  const projectId = registry.newProject();
  return { registry, projectId };
}
