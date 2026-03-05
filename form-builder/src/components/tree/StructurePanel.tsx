import type { Signal } from '@preact/signals';
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { moveItem, setSelection } from '../../state/mutations';
import { projectSignal, type ProjectState } from '../../state/project';
import { joinPath } from '../../state/wiring';
import { TreeNode } from './TreeNode';

export interface StructurePanelProps {
  project?: Signal<ProjectState>;
}

interface DropTarget {
  parentPath: string | null;
  index: number;
}

export function StructurePanel(props: StructurePanelProps) {
  const project = props.project ?? projectSignal;
  const state = project.value;
  const bindByPath = useMemo(() => buildBindIndex(state.definition.binds), [state.definition.binds]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    if (!state.selection) {
      return;
    }
    const segments = state.selection.split('.').filter(Boolean);
    if (segments.length <= 1) {
      return;
    }

    const ancestors: string[] = [];
    for (let index = 0; index < segments.length - 1; index += 1) {
      ancestors.push(segments.slice(0, index + 1).join('.'));
    }

    setCollapsedGroups((current) => {
      const next = new Set(current);
      let changed = false;
      for (const ancestor of ancestors) {
        if (next.delete(ancestor)) {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [state.selection]);

  const selectPath = (path: string) => {
    setSelection(project, path);
    scrollSurfaceItemIntoView(path);
  };

  const handleDragStart = (path: string, event: DragEvent) => {
    event.stopPropagation();
    const transfer = event.dataTransfer;
    if (transfer) {
      transfer.setData('text/plain', path);
      transfer.effectAllowed = 'move';
    }
    setDraggingPath(path);
  };

  const handleDragEnd = () => {
    setDraggingPath(null);
    setDropTarget(null);
  };

  const handleDrop = (target: DropTarget, event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedPath = event.dataTransfer?.getData('text/plain');
    const fromPath = (draggedPath ? draggedPath.trim() : '') || draggingPath;
    setDropTarget(null);
    setDraggingPath(null);

    if (!fromPath) {
      return;
    }

    try {
      const nextPath = moveItem(project, fromPath, target);
      setSelection(project, nextPath);
      scrollSurfaceItemIntoView(nextPath);
    } catch (error) {
      console.warn(error);
    }
  };

  const renderDropZone = (parentPath: string | null, index: number) => {
    const active = isDropTarget(dropTarget, parentPath, index);
    const testId = `structure-dropzone-${toTestToken(parentPath)}-${index}`;

    return (
      <li class="structure-tree__drop-slot" key={`drop-${parentPath ?? 'root'}-${index}`}>
        <div
          class={`structure-tree__dropzone${active ? ' is-active' : ''}`}
          data-testid={testId}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isDropTarget(dropTarget, parentPath, index)) {
              setDropTarget({ parentPath, index });
            }
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = 'move';
            }
          }}
          onDragLeave={() => {
            if (isDropTarget(dropTarget, parentPath, index)) {
              setDropTarget(null);
            }
          }}
          onDrop={(event) => {
            handleDrop({ parentPath, index }, event as DragEvent);
          }}
        />
      </li>
    );
  };

  const renderLevel = (items: FormspecItem[], parentPath: string | null, depth: number) => {
    return (
      <ol class="structure-tree__list" data-parent-path={parentPath ?? 'root'}>
        {renderDropZone(parentPath, 0)}
        {items.map((item, index) => {
          const path = joinPath(parentPath, item.key);
          const children = item.type === 'group' ? item.children ?? [] : [];
          const collapsed = collapsedGroups.has(path);

          return (
            <Fragment key={path}>
              <li class="structure-tree__item">
                <TreeNode
                  item={item}
                  path={path}
                  depth={depth}
                  selected={state.selection === path}
                  bind={bindByPath.get(path)}
                  hasChildren={children.length > 0}
                  collapsed={collapsed}
                  dragging={draggingPath === path}
                  onSelect={selectPath}
                  onToggleCollapse={(targetPath) => {
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(targetPath)) {
                        next.delete(targetPath);
                      } else {
                        next.add(targetPath);
                      }
                      return next;
                    });
                  }}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
                {item.type === 'group' && children.length > 0 && !collapsed ? renderLevel(children, path, depth + 1) : null}
              </li>
              {renderDropZone(parentPath, index + 1)}
            </Fragment>
          );
        })}
      </ol>
    );
  };

  return (
    <section class="structure-panel" data-testid="structure-tree">
      {state.definition.items.length ? (
        renderLevel(state.definition.items, null, 0)
      ) : (
        <p class="structure-panel__empty">No form items yet.</p>
      )}
    </section>
  );
}

function buildBindIndex(binds: FormspecBind[] | undefined): Map<string, FormspecBind> {
  const index = new Map<string, FormspecBind>();
  if (!binds?.length) {
    return index;
  }
  for (const bind of binds) {
    index.set(bind.path, bind);
  }
  return index;
}

function isDropTarget(target: DropTarget | null, parentPath: string | null, index: number): boolean {
  if (!target) {
    return false;
  }
  return target.parentPath === parentPath && target.index === index;
}

function toTestToken(path: string | null): string {
  if (!path) {
    return 'root';
  }
  return path.replace(/[^A-Za-z0-9_-]/g, '_');
}

function scrollSurfaceItemIntoView(path: string): void {
  const escapedPath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const element = document.querySelector<HTMLElement>(`[data-item-path="${escapedPath}"]`);
  if (element?.scrollIntoView) {
    element.scrollIntoView({ block: 'nearest' });
  }
}
