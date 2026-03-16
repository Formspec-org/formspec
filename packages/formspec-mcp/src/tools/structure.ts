/**
 * Structure tools: field, content, group, repeat, page, place, update, remove, copy, metadata, submit.
 *
 * These manage the form's item tree — adding, removing, and modifying items.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type {
  FieldProps,
  GroupProps,
  RepeatProps,
  PlacementOptions,
  ItemChanges,
  MetadataChanges,
} from 'formspec-studio-core';

export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  label: string,
  type: string,
  props?: FieldProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addField(path, label, type, props);
  });
}

export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  body: string,
  kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider',
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addContent(path, body, kind);
  });
}

export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  label: string,
  props?: GroupProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addGroup(path, label, props);
  });
}

export function handleRepeat(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  props?: RepeatProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.makeRepeatable(target, props);
  });
}

export function handlePage(
  registry: ProjectRegistry,
  projectId: string,
  title: string,
  description?: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addPage(title, description);
  });
}

export function handleRemovePage(
  registry: ProjectRegistry,
  projectId: string,
  pageId: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removePage(pageId);
  });
}

export function handleMovePage(
  registry: ProjectRegistry,
  projectId: string,
  pageId: string,
  direction: 'up' | 'down',
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.reorderPage(pageId, direction);
  });
}

export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  pageId: string,
  options?: PlacementOptions,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.placeOnPage(target, pageId, options);
  });
}

export function handleUnplace(
  registry: ProjectRegistry,
  projectId: string,
  target: string,
  pageId: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.unplaceFromPage(target, pageId);
  });
}

export function handleUpdate(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  changes: ItemChanges,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.updateItem(path, changes);
  });
}

export function handleRemove(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removeItem(path);
  });
}

export function handleCopy(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  deep?: boolean,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.copyItem(path, deep);
  });
}

export function handleMetadata(
  registry: ProjectRegistry,
  projectId: string,
  changes: MetadataChanges,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.setMetadata(changes);
  });
}

export function handleSubmitButton(
  registry: ProjectRegistry,
  projectId: string,
  label?: string,
  pageId?: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addSubmitButton(label, pageId);
  });
}
