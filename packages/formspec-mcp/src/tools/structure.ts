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

// ── Batch-enabled add tools ─────────────────────────────────────────

export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; label: string; type: string; props?: FieldProps },
): ReturnType<typeof wrapHelperCall>;
export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; label: string; type: string; props?: FieldProps }> },
): ReturnType<typeof wrapBatchCall>;
export function handleField(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; label?: string; type?: string; props?: FieldProps; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      return project!.addField(
        item.path as string,
        item.label as string,
        item.type as string,
        item.props as FieldProps | undefined,
      );
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addField(params.path!, params.label!, params.type!, params.props);
  });
}

export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; body: string; kind?: string; props?: ContentProps },
): ReturnType<typeof wrapHelperCall>;
export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; body: string; kind?: string; props?: ContentProps }> },
): ReturnType<typeof wrapBatchCall>;
export function handleContent(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; body?: string; kind?: string; props?: ContentProps; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      return project!.addContent(
        item.path as string,
        item.body as string,
        item.kind as 'heading' | 'paragraph' | 'banner' | 'divider' | undefined,
        item.props as ContentProps | undefined,
      );
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addContent(
      params.path!,
      params.body!,
      params.kind as 'heading' | 'paragraph' | 'banner' | 'divider' | undefined,
      params.props,
    );
  });
}

export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { path: string; label: string; props?: GroupProps & { repeat?: RepeatProps } },
): ReturnType<typeof wrapHelperCall>;
export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { items: Array<{ path: string; label: string; props?: GroupProps & { repeat?: RepeatProps } }> },
): ReturnType<typeof wrapBatchCall>;
export function handleGroup(
  registry: ProjectRegistry,
  projectId: string,
  params: { path?: string; label?: string; props?: GroupProps & { repeat?: RepeatProps }; items?: BatchItem[] },
) {
  if (params.items) {
    const { project, error } = getProjectSafe(registry, projectId);
    if (error) return error;
    return wrapBatchCall(params.items, (item) => {
      const props = item.props as (GroupProps & { repeat?: RepeatProps }) | undefined;
      const { repeat, ...groupProps } = props ?? {};
      const result = project!.addGroup(
        item.path as string,
        item.label as string,
        Object.keys(groupProps).length ? groupProps as GroupProps : undefined,
      );
      if (repeat) {
        project!.makeRepeatable(item.path as string, repeat);
      }
      return result;
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    const { repeat, ...groupProps } = params.props ?? {};
    const result = project.addGroup(
      params.path!,
      params.label!,
      Object.keys(groupProps).length ? groupProps as GroupProps : undefined,
    );
    if (repeat) {
      project.makeRepeatable(params.path!, repeat);
    }
    return result;
  });
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
  action: 'add' | 'remove' | 'move',
  params: { title?: string; description?: string; page_id?: string; direction?: 'up' | 'down' },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'add':
        return project.addPage(params.title!, params.description);
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

type EditAction = 'remove' | 'move' | 'rename' | 'copy';

interface EditParams {
  path: string;
  target_path?: string;
  index?: number;
  new_key?: string;
  deep?: boolean;
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
        case 'move':
          return project!.moveItem(path, item.target_path as string | undefined, item.index as number | undefined);
        case 'rename':
          return project!.renameItem(path, item.new_key as string);
        case 'copy':
          return project!.copyItem(path, item.deep as boolean | undefined);
      }
    });
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (action) {
      case 'remove':
        return project.removeItem(params.path!);
      case 'move':
        return project.moveItem(params.path!, params.target_path, params.index);
      case 'rename':
        return project.renameItem(params.path!, params.new_key!);
      case 'copy':
        return project.copyItem(params.path!, params.deep);
    }
  });
}
