import type { Signal } from '@preact/signals';
import { Fragment } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import type { FormspecBind, FormspecItem } from 'formspec-engine';
import {
  addItem,
  setFieldOptions,
  setInspectorSectionOpen,
  setItemExtension,
  setItemText,
  setMobilePanel,
  setSelection
} from '../../state/mutations';
import { projectSignal, type ProjectState } from '../../state/project';
import { joinPath } from '../../state/wiring';
import { AddBetween } from './AddBetween';
import { buildSlashTemplates, type FieldTemplate } from './field-templates';
import type { FieldLogicBadgeKey } from './FieldBlock';
import { ItemBlock } from './ItemBlock';
import { SlashCommandMenu } from './SlashCommandMenu';

export interface FormSurfaceProps {
  project?: Signal<ProjectState>;
}

interface SlashMenuState {
  parentPath: string | null;
  index: number;
  top: number;
  left: number;
  query: string;
}

interface LabelFocusRequest {
  path: string;
  token: number;
}

export function FormSurface(props: FormSurfaceProps) {
  const project = props.project ?? projectSignal;
  const state = project.value;
  const bindByPath = buildBindIndex(state.definition.binds);
  const surfaceRef = useRef<HTMLElement>(null);
  const labelFocusCounterRef = useRef(0);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [labelFocusRequest, setLabelFocusRequest] = useState<LabelFocusRequest | null>(null);
  const slashTemplates = useMemo(
    () => buildSlashTemplates(state.extensions.registries),
    [state.extensions.registries]
  );

  const closeSlashMenu = () => {
    setSlashMenu(null);
  };

  const requestLabelFocus = (path: string) => {
    labelFocusCounterRef.current += 1;
    setLabelFocusRequest({ path, token: labelFocusCounterRef.current });
  };

  const openSlashMenu = (parentPath: string | null, index: number, anchor: HTMLElement | null) => {
    const position = resolveMenuPosition(surfaceRef.current, anchor);
    setSlashMenu({
      parentPath,
      index,
      top: position.top,
      left: position.left,
      query: ''
    });
  };

  const insertTemplate = (template: FieldTemplate) => {
    if (!slashMenu) {
      return;
    }

    const insertedPath = addItem(project, {
      type: template.type,
      dataType: template.dataType,
      key: template.keyPrefix,
      label: template.defaultLabel,
      parentPath: slashMenu.parentPath,
      index: slashMenu.index
    });

    if (template.extensionName) {
      setItemExtension(project, insertedPath, template.extensionName, true);
    }

    requestLabelFocus(insertedPath);
    closeSlashMenu();
  };

  const renderItemList = (items: FormspecItem[], parentPath: string | null) => {
    return (
      <div class="form-surface__item-list" data-parent-path={parentPath ?? '#root'}>
        <AddBetween
          parentPath={parentPath}
          index={0}
          onAdd={(targetPath, index, anchor) => {
            openSlashMenu(targetPath, index, anchor);
          }}
        />
        {items.map((item, index) => {
          const path = joinPath(parentPath, item.key);

          return (
            <Fragment key={path}>
              <ItemBlock
                item={item}
                path={path}
                selected={state.selection === path}
                bind={bindByPath.get(path)}
                labelFocusToken={labelFocusRequest?.path === path ? labelFocusRequest.token : undefined}
                onSelect={(selectedPath) => {
                  closeSlashMenu();
                  setSelection(project, selectedPath);
                }}
                onLogicBadgeClick={(selectedPath, badgeKey) => {
                  closeSlashMenu();
                  setSelection(project, selectedPath);
                  const inspectorSection = resolveInspectorSectionForLogicBadge(badgeKey, bindByPath.get(selectedPath));
                  setInspectorSectionOpen(project, inspectorSection, true);
                }}
                onLabelCommit={(targetPath, value) => {
                  setItemText(project, targetPath, 'label', value);
                }}
                onDescriptionCommit={(targetPath, value) => {
                  setItemText(project, targetPath, 'description', value);
                }}
                onOptionsCommit={(targetPath, options) => {
                  setFieldOptions(project, targetPath, options);
                }}
                renderChildren={(children, childParentPath) => renderItemList(children, childParentPath)}
              />
              <AddBetween
                parentPath={parentPath}
                index={index + 1}
                onAdd={(targetPath, targetIndex, anchor) => {
                  openSlashMenu(targetPath, targetIndex, anchor);
                }}
              />
            </Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <section
      ref={surfaceRef}
      class="surface-card form-surface"
      data-testid="form-surface-document"
      tabIndex={0}
      onClick={() => {
        closeSlashMenu();
        setSelection(project, null);
        if (project.value.uiState.mobilePanel === 'inspector') {
          setMobilePanel(project, 'inspector');
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== '/') {
          return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        if (isTypingContext(event.target as Element | null)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const target = inferInsertionTarget(state.definition.items, state.selection);
        openSlashMenu(target.parentPath, target.index, event.currentTarget as HTMLElement);
      }}
    >
      {state.definition.items.length > 0 ? (
        renderItemList(state.definition.items, null)
      ) : (
        <div class="form-surface__empty-state">
          <h2>Start your form</h2>
          <p>Type <kbd>/</kbd> to add a field, or click the button below.</p>
          <button
            type="button"
            class="toolbar-button"
            data-testid="surface-add-first-item"
            onClick={(event) => {
              event.stopPropagation();
              openSlashMenu(null, 0, event.currentTarget as HTMLElement);
            }}
          >
            + Add first field
          </button>
        </div>
      )}
      <SlashCommandMenu
        open={slashMenu !== null}
        query={slashMenu?.query ?? ''}
        templates={slashTemplates}
        top={slashMenu?.top ?? 0}
        left={slashMenu?.left ?? 0}
        onQueryChange={(value) => {
          setSlashMenu((current) => (current ? { ...current, query: value } : current));
        }}
        onSelect={(template) => {
          insertTemplate(template);
        }}
        onClose={closeSlashMenu}
      />
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

function isTypingContext(target: Element | null): boolean {
  if (!target) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.closest('[contenteditable="true"]') !== null;
}

function resolveMenuPosition(
  surface: HTMLElement | null,
  anchor: HTMLElement | null
): { top: number; left: number } {
  if (!surface || !anchor) {
    return { top: 16, left: 16 };
  }
  const surfaceRect = surface.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  return {
    top: anchorRect.bottom - surfaceRect.top + surface.scrollTop + 6,
    left: anchorRect.left - surfaceRect.left + surface.scrollLeft
  };
}

function inferInsertionTarget(
  items: FormspecItem[],
  selection: string | null
): { parentPath: string | null; index: number } {
  if (!selection) {
    return { parentPath: null, index: items.length };
  }
  const location = findItemLocation(items, selection);
  if (!location) {
    return { parentPath: null, index: items.length };
  }
  return {
    parentPath: location.parentPath,
    index: location.index + 1
  };
}

function findItemLocation(
  items: FormspecItem[],
  path: string,
  parentPath: string | null = null
): { parentPath: string | null; index: number } | null {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) {
    return null;
  }

  const [currentKey, ...rest] = segments;
  const index = items.findIndex((item) => item.key === currentKey);
  if (index < 0) {
    return null;
  }

  if (rest.length === 0) {
    return { parentPath, index };
  }

  const candidate = items[index];
  if (candidate.type !== 'group') {
    return null;
  }

  return findItemLocation(candidate.children ?? [], rest.join('.'), joinPath(parentPath, currentKey));
}

function resolveInspectorSectionForLogicBadge(
  badgeKey: FieldLogicBadgeKey,
  bind: FormspecBind | undefined
): string {
  if (badgeKey === 'constraint') {
    return 'field:validation';
  }
  if (badgeKey === 'required' && typeof bind?.required === 'boolean') {
    return 'field:basics';
  }
  return 'field:logic';
}
