/**
 * Structure tools: field, content, group, place, edit (batch-enabled via items[] array).
 * Plus: page CRUD, update, submit.
 */

import { HelperError } from 'formspec-studio-core';
import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, wrapBatchCall, errorResponse, formatToolError } from '../errors.js';
import type { BatchItem } from '../batch.js';

/** Safely get project, returning error response on failure */
function getProjectSafe(registry: ProjectRegistry, projectId: string) {
  try {
    return { project: registry.getProject(projectId), error: null };
  } catch (err) {
    if (err instanceof HelperError) {
      return { project: null, error: errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>)) };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { project: null, error: errorResponse(formatToolError('COMMAND_FAILED', message)) };
  }
}
import type {
  FieldProps,
  ContentProps,
  GroupProps,
  RepeatProps,
  PlacementOptions,
  ItemChanges,
  MetadataChanges,
} from 'formspec-studio-core';

/**
 * Merge top-level parentPath into props when props.parentPath is absent.
 * Handles the common LLM mistake of passing parentPath at the top level
 * instead of nesting it inside props.
 */
function mergeParentPath<T extends { parentPath?: string }>(
  props: T | undefined,
  parentPath: string | undefined,
): T | undefined {
  if (!parentPath) return props;
  if (props?.parentPath) return props; // explicit props.parentPath wins
  return { ...props, parentPath } as T;
}

// ── Batch-enabled add tools ─────────────────────────────────────────

export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; label: string; type: string; props?: FieldProps; parentPath?: string },
): ReturnType<typeof wrapHelperCall>;
export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; label: string; type: string; props?: FieldProps }> },
): ReturnType<typeof wrapBatchCall>;
export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; label?: string; type?: string; props?: FieldProps; parentPath?: string; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const props = mergeParentPath(item.props as FieldProps | undefined, (item as any).parentPath);
      return project!.addField(
        item.path as string,
        item.label as string,
        item.type as string,
        props,
      );
    });
  }
  const props = mergeParentPath(params.props, params.parentPath);
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addField(params.path!, params.label!, params.type!, props);
  });
}

export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; body: string; kind?: string; props?: ContentProps; parentPath?: string },
): ReturnType<typeof wrapHelperCall>;
export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; body: string; kind?: string; props?: ContentProps }> },
): ReturnType<typeof wrapBatchCall>;
export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; body?: string; kind?: string; props?: ContentProps; parentPath?: string; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const props = mergeParentPath(item.props as ContentProps | undefined, (item as any).parentPath);
      return project!.addContent(
        item.path as string,
        item.body as string,
        item.kind as 'heading' | 'paragraph' | 'banner' | 'divider' | undefined,
        props,
      );
    });
  }
  const props = mergeParentPath(params.props, params.parentPath);
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addContent(
      params.path!,
      params.body!,
      params.kind as 'heading' | 'paragraph' | 'banner' | 'divider' | undefined,
      props,
    );
  });
}

export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; label: string; props?: GroupProps & { repeat?: RepeatProps }; parentPath?: string },
): ReturnType<typeof wrapHelperCall>;
export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; label: string; props?: GroupProps & { repeat?: RepeatProps } }> },
): ReturnType<typeof wrapBatchCall>;
export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; label?: string; props?: GroupProps & { repeat?: RepeatProps }; parentPath?: string; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const merged = mergeParentPath(
        item.props as (GroupProps & { repeat?: RepeatProps }) | undefined,
        (item as any).parentPath,
      );
      const { repeat, ...groupProps } = merged ?? {};
      const result = project!.addGroup(
        item.path as string,
        item.label as string,
        Object.keys(groupProps).length ? groupProps as GroupProps : undefined,
      );
      if (repeat) {
        project!.makeRepeatable(item.path as string, repeat);
        appendRepeatSummary(result, repeat);
      }
      return result;
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    const merged = mergeParentPath(params.props, params.parentPath);
    const { repeat, ...groupProps } = merged ?? {};
    const result = project.addGroup(
      params.path!,
      params.label!,
      Object.keys(groupProps).length ? groupProps as GroupProps : undefined,
    );
    if (repeat) {
      project.makeRepeatable(params.path!, repeat);
      appendRepeatSummary(result, repeat);
    }
    return result;
  });
}

/** Attach repeat summary to a group creation HelperResult (UX-4c). */
function appendRepeatSummary(result: unknown, repeat: RepeatProps): void {
  (result as any).repeat = repeat;
}

// ── Submit button (folded into content conceptually, separate handler) ──

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

// ── Page CRUD ───────────────────────────────────────────────────────

export function handlePage(
  registry: ProjectRegistry,
  projectId: string,
  action: 'add' | 'remove' | 'move' | 'list',
  params: { title?: string; description?: string; page_id?: string; direction?: 'up' | 'down' },
) {
  if (action === 'list') {
    try {
      const project = registry.getProject(projectId);
      const pages = project.listPages();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ pages }, null, 2) }] };
    } catch (err) {
      if (err instanceof HelperError) {
        return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(formatToolError('COMMAND_FAILED', message));
    }
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'add':
        return project.addPage(params.title!, params.description, params.page_id);
      case 'remove':
        return project.removePage(params.page_id!);
      case 'move':
        return project.reorderPage(params.page_id!, params.direction!);
    }
  });
}

// ── Placement (batch-enabled) ────────────────────────────────────────

export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: { action: 'place' | 'unplace'; target: string; page_id: string; options?: PlacementOptions },
): ReturnType<typeof wrapHelperCall>;
export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ action: 'place' | 'unplace'; target: string; page_id: string; options?: PlacementOptions }> },
): ReturnType<typeof wrapBatchCall>;
export function handlePlace(
  registry: ProjectRegistry,
  projectId: string,
  params: {
    action?: 'place' | 'unplace';
    target?: string;
    page_id?: string;
    options?: PlacementOptions;
    items?: BatchItem[];
  },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const action = item.action as 'place' | 'unplace';
      const target = item.target as string;
      const pageId = item.page_id as string;
      if (action === 'place') {
        return project!.placeOnPage(target, pageId, item.options as PlacementOptions | undefined);
      }
      return project!.unplaceFromPage(target, pageId);
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    if (params.action === 'place') {
      return project.placeOnPage(params.target!, params.page_id!, params.options);
    }
    return project.unplaceFromPage(params.target!, params.page_id!);
  });
}

// ── formspec_update: change properties on existing items or metadata ──

/** Expand nested `repeat` shape to the flat keys updateItem expects. */
function normalizeItemChanges(changes: Record<string, unknown>): ItemChanges {
  const { repeat, ...rest } = changes as { repeat?: { min?: number; max?: number }; [k: string]: unknown };
  if (!repeat) return rest as ItemChanges;

  const expanded: Record<string, unknown> = { ...rest, repeatable: true };
  if (repeat.min !== undefined) expanded.minRepeat = repeat.min;
  if (repeat.max !== undefined) expanded.maxRepeat = repeat.max;
  return expanded as ItemChanges;
}

export function handleUpdate(
  registry: ProjectRegistry,
  projectId: string,
  target: 'item' | 'metadata',
  params: { path?: string; changes: ItemChanges | MetadataChanges },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    if (target === 'metadata') {
      return project.setMetadata(params.changes as MetadataChanges);
    }
    const normalized = normalizeItemChanges(params.changes as Record<string, unknown>);
    return project.updateItem(params.path!, normalized);
  });
}

// ── formspec_edit: structural mutations ──────────────────────────────

/** Error response when action is missing in non-batch edit mode */
export function editMissingAction() {
  return errorResponse(formatToolError(
    'MISSING_ACTION',
    'action is required for single-item mode. Provide action or use items[] for batch mode with per-item action overrides.',
  ));
}

type EditAction = 'remove' | 'move' | 'rename' | 'copy';

type MovePosition = 'inside' | 'after' | 'before';

interface EditParams {
  path: string;
  target_path?: string;
  index?: number;
  new_key?: string;
  deep?: boolean;
  position?: MovePosition;
}

/**
 * Resolve sibling-relative positioning into (parentPath, index) for moveItem.
 *
 * 'inside' (default): target_path is the parent container.
 * 'before'/'after': target_path is a sibling. We find its parent and index,
 * then return the parent path and the computed insertion index.
 */
function resolveMovePosition(
  project: import('formspec-studio-core').Project,
  sourcePath: string,
  targetPath: string | undefined,
  position: MovePosition | undefined,
  explicitIndex: number | undefined,
): { parentPath?: string; index?: number } {
  if (!position || position === 'inside') {
    return { parentPath: targetPath, index: explicitIndex };
  }

  if (!targetPath) {
    throw new HelperError('MISSING_PARAM', 'target_path is required when position is "before" or "after"');
  }

  // Parse target_path to find parent and leaf key
  const segments = targetPath.split('.');
  const leafKey = segments.pop()!;
  const parentPath = segments.length > 0 ? segments.join('.') : undefined;

  // Find the sibling's index among its parent's children
  const parentItem = parentPath ? project.itemAt(parentPath) : null;
  const children = parentItem
    ? (parentItem.children ?? [])
    : (project.definition.items ?? []);

  const siblingIndex = children.findIndex((c: any) => c.key === leafKey);
  if (siblingIndex === -1) {
    throw new HelperError('PATH_NOT_FOUND', `Target sibling not found: ${targetPath}`);
  }

  // For 'before': insert at sibling's index. For 'after': insert after it.
  // Account for the source item being removed from the same parent first:
  // if the source is in the same parent AND before the target, the target index
  // shifts down by 1 after removal.
  const sourceSegments = sourcePath.split('.');
  const sourceLeaf = sourceSegments.pop()!;
  const sourceParent = sourceSegments.length > 0 ? sourceSegments.join('.') : undefined;
  const sameParent = sourceParent === parentPath;

  let sourceIndex = -1;
  if (sameParent) {
    sourceIndex = children.findIndex((c: any) => c.key === sourceLeaf);
  }

  let insertIndex: number;
  if (position === 'before') {
    insertIndex = siblingIndex;
    // If source is in same parent and before the target, removal shifts target down
    if (sameParent && sourceIndex >= 0 && sourceIndex < siblingIndex) {
      insertIndex -= 1;
    }
  } else {
    // 'after'
    insertIndex = siblingIndex + 1;
    // If source is in same parent and before or at the sibling, removal shifts target down
    if (sameParent && sourceIndex >= 0 && sourceIndex < siblingIndex) {
      insertIndex -= 1;
    }
  }

  return { parentPath, index: insertIndex };
}

export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: EditAction,
  params: EditParams,
): ReturnType<typeof wrapHelperCall>;
export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: EditAction,
  params: { items: Array<{ action?: EditAction } & Partial<EditParams>> },
): ReturnType<typeof wrapBatchCall>;
export function handleEdit(
  registry: ProjectRegistry,
  projectId: string,
  action: EditAction,
  params: Partial<EditParams> & { items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const itemAction = (item.action as EditAction) ?? action;
      const path = item.path as string;
      switch (itemAction) {
        case 'remove':
          return project!.removeItem(path);
        case 'move': {
          const pos = resolveMovePosition(
            project!, path, item.target_path as string | undefined,
            (item as any).position as MovePosition | undefined,
            item.index as number | undefined,
          );
          return project!.moveItem(path, pos.parentPath, pos.index);
        }
        case 'rename':
          return project!.renameItem(path, item.new_key as string);
        case 'copy':
          return project!.copyItem(path, item.deep as boolean | undefined, item.target_path as string | undefined);
        default:
          throw new HelperError('INVALID_ACTION', `Unknown edit action: ${itemAction}`);
      }
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'remove':
        return project.removeItem(params.path!);
      case 'move': {
        const pos = resolveMovePosition(
          project, params.path!, params.target_path,
          params.position, params.index,
        );
        return project.moveItem(params.path!, pos.parentPath, pos.index);
      }
      case 'rename':
        return project.renameItem(params.path!, params.new_key!);
      case 'copy':
        return project.copyItem(params.path!, params.deep, params.target_path);
      default:
        throw new HelperError('INVALID_ACTION', `Unknown edit action: ${action}`);
    }
  });
}
