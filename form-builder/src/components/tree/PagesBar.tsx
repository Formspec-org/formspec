import type { Signal } from '@preact/signals';
import { useRef, useState } from 'preact/hooks';
import type { FormspecItem } from 'formspec-engine';
import {
  addPage,
  deletePage,
  reorderPage,
  setActivePage,
  setItemText,
  setSelection
} from '../../state/mutations';
import { getPageItems } from '../../state/wiring';
import { projectSignal, type ProjectState } from '../../state/project';

interface PagesBarProps {
  project?: Signal<ProjectState>;
}

export function PagesBar(props: PagesBarProps) {
  const project = props.project ?? projectSignal;
  const state = project.value;
  const pages = getPageItems(state.definition);
  const activePage = state.uiState.activePage;
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  if (pages.length === 0) {
    return null;
  }

  const handleSelect = (page: FormspecItem) => {
    setActivePage(project, page.key);
    setSelection(project, page.key);
  };

  const handleAdd = () => {
    addPage(project);
  };

  const handleDelete = (pageKey: string) => {
    if (pages.length <= 1) return;
    const page = pages.find((p) => p.key === pageKey);
    const label = page?.label ?? pageKey;
    if (!confirm(`Delete "${label}" and all its contents?`)) return;
    deletePage(project, pageKey);
  };

  const handleDoubleClick = (pageKey: string) => {
    setEditingKey(pageKey);
    requestAnimationFrame(() => {
      editInputRef.current?.select();
    });
  };

  const commitEdit = (pageKey: string, value: string) => {
    setEditingKey(null);
    const trimmed = value.trim();
    if (trimmed) {
      setItemText(project, pageKey, 'label', trimmed);
    }
  };

  return (
    <div class="pages-bar" data-testid="pages-bar">
      <div class="pages-bar__header">
        <span class="pages-bar__title">Pages</span>
        <button
          type="button"
          class="pages-bar__add"
          data-testid="pages-bar-add"
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          title="Add page"
        >
          +
        </button>
      </div>
      <ol class="pages-bar__list">
        {pages.map((page, index) => {
          const isActive = page.key === activePage;
          const isEditing = editingKey === page.key;

          return (
            <li
              key={page.key}
              class={`pages-bar__item${isActive ? ' pages-bar__item--active' : ''}`}
              data-testid={`pages-bar-item-${page.key}`}
              onClick={() => handleSelect(page)}
            >
              <span class="pages-bar__reorder">
                <button
                  type="button"
                  class="pages-bar__reorder-btn"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderPage(project, page.key, 'up');
                  }}
                  title="Move up"
                  aria-label="Move page up"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  class="pages-bar__reorder-btn"
                  disabled={index === pages.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderPage(project, page.key, 'down');
                  }}
                  title="Move down"
                  aria-label="Move page down"
                >
                  &#9660;
                </button>
              </span>
              {isEditing ? (
                <input
                  ref={editInputRef}
                  class="pages-bar__edit-input"
                  type="text"
                  value={page.label}
                  onBlur={(e) => commitEdit(page.key, (e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitEdit(page.key, (e.target as HTMLInputElement).value);
                    }
                    if (e.key === 'Escape') {
                      setEditingKey(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  class="pages-bar__label"
                  onDblClick={(e) => {
                    e.stopPropagation();
                    handleDoubleClick(page.key);
                  }}
                >
                  {page.label}
                </span>
              )}
              {pages.length > 1 && (
                <button
                  type="button"
                  class="pages-bar__delete"
                  data-testid={`pages-bar-delete-${page.key}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(page.key);
                  }}
                  title="Delete page"
                  aria-label="Delete page"
                >
                  &times;
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
