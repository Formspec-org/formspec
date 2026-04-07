/** @filedesc Layout workspace step selector — page tabs with drag-reorder, context menu, and inline rename. */
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getAnchoredDropdownPosition } from '../../components/ui/context-menu-utils';

export interface LayoutStepNavPage {
  id: string;
  title: string;
  groupPath?: string;
  pageId?: string;
}

interface LayoutStepNavProps {
  pages: LayoutStepNavPage[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onRenamePage?: (pageId: string, title: string, groupPath?: string, componentPageId?: string) => void;
  /** Reorder among sibling pages (component tree). */
  onReorderPage?: (navPageId: string, direction: 'up' | 'down') => void;
  /** Move page to a zero-based index among pages (e.g. after drag-drop). */
  onMovePageToIndex?: (navPageId: string, targetIndex: number) => void;
  /** User chose Delete — parent shows confirm then calls remove. */
  onRequestRemovePage?: (navPageId: string) => void;
  /** Rendered after page tabs in the same wrapping row (e.g. + Page). */
  trailing?: ReactNode;
}

const PAGE_DRAG_MIME = 'application/x-formspec-layout-page-nav-id';

export function LayoutStepNav({
  pages,
  activePageId,
  onSelectPage,
  onRenamePage,
  onReorderPage,
  onMovePageToIndex,
  onRequestRemovePage,
  trailing,
}: LayoutStepNavProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; width: number; pageId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (editingPageId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingPageId]);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, closeMenu]);

  if (pages.length === 0) return null;

  const commitRename = () => {
    if (!editingPageId) return;
    const page = pages.find((entry) => entry.id === editingPageId);
    const nextTitle = draftTitle.trim();
    if (page && nextTitle && nextTitle !== page.title) {
      onRenamePage?.(page.id, nextTitle, page.groupPath, page.pageId);
    }
    setEditingPageId(null);
  };

  const startRename = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page || !onRenamePage) return;
    setDraftTitle(page.title);
    setEditingPageId(pageId);
    closeMenu();
  };

  const openContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const pos = getAnchoredDropdownPosition(el.getBoundingClientRect(), {
      minMenuWidth: 180,
      estimatedHeight: 220,
    });
    setMenu({ x: pos.x, y: pos.y, width: pos.width, pageId });
  };

  const menuPageIndex = menu ? pages.findIndex((p) => p.id === menu.pageId) : -1;
  const canDelete = pages.length > 1 && !!onRequestRemovePage;
  const canMoveLeft = menuPageIndex > 0 && !!onReorderPage;
  const canMoveRight = menuPageIndex >= 0 && menuPageIndex < pages.length - 1 && !!onReorderPage;

  return (
    <>
      <nav
        data-testid="page-nav"
        aria-label="Layout step navigation"
        className="flex flex-wrap items-center gap-x-1 gap-y-2"
      >
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isEditing = page.id === editingPageId;
          const isDropTarget = dragOverId === page.id;
          return isEditing ? (
            <div key={page.id} className="shrink-0">
              <input
                ref={inputRef}
                data-testid="page-nav-rename-input"
                aria-label="Rename page"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitRename();
                  }
                  if (e.key === 'Escape') {
                    setEditingPageId(null);
                  }
                }}
                className="min-w-32 shrink-0 rounded-lg border border-accent bg-surface px-3 py-1.5 text-[12px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              />
            </div>
          ) : (
            <div
              key={page.id}
              data-testid={`page-nav-row-${page.id}`}
              className={`flex min-h-11 max-w-[11rem] shrink-0 items-stretch rounded-lg border-x border-t transition-colors ${
                isDropTarget ? 'border-accent ring-1 ring-accent/40' : 'border-border/80'
              } ${
                isActive
                  ? 'border-b-2 border-b-accent bg-accent/[0.08] shadow-sm'
                  : 'border-b-2 border-b-transparent'
              }`}
              onContextMenu={(e) => openContextMenu(e, page.id)}
              onDragOver={
                onMovePageToIndex
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverId(page.id);
                    }
                  : undefined
              }
              onDragLeave={() => {
                setDragOverId((id) => (id === page.id ? null : id));
              }}
              onDrop={
                onMovePageToIndex
                  ? (e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      const draggedId = e.dataTransfer.getData(PAGE_DRAG_MIME) || e.dataTransfer.getData('text/plain');
                      if (!draggedId || draggedId === page.id) return;
                      onMovePageToIndex(draggedId, index);
                    }
                  : undefined
              }
            >
              {onMovePageToIndex ? (
                <button
                  type="button"
                  data-testid={`page-nav-drag-${page.id}`}
                  draggable
                  aria-label={`Reorder page: ${page.title}`}
                  className="flex w-7 shrink-0 cursor-grab items-center justify-center border-0 bg-transparent text-muted hover:bg-subtle/80 hover:text-ink active:cursor-grabbing"
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PAGE_DRAG_MIME, page.id);
                    e.dataTransfer.setData('text/plain', page.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDragOverId(null)}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <span className="select-none text-[10px] leading-none tracking-tighter" aria-hidden>
                    ⋮⋮
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                data-testid={`page-nav-tab-${page.id}`}
                title={page.title}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectPage(page.id)}
                onDoubleClick={() => startRename(page.id)}
                className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
                  isActive ? 'text-ink' : 'text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <span className="shrink-0 text-[10px] tabular-nums opacity-60">{index + 1}</span>
                <span className="line-clamp-2 min-w-0 leading-snug">{page.title}</span>
              </button>
            </div>
          );
        })}
        {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
      </nav>

      {/* Portal to body: sticky header uses backdrop-filter, which creates a fixed-position containing block — in-tree `fixed` + viewport rects from getBoundingClientRect misalign. */}
      {menu
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[60] box-border rounded-md border border-border bg-surface py-1 shadow-lg"
              style={{ left: menu.x, top: menu.y, width: menu.width, minWidth: menu.width }}
              data-testid="page-nav-context-menu"
              role="menu"
            >
              {onRenamePage ? (
                <button
                  type="button"
                  role="menuitem"
                  data-testid="page-nav-ctx-rename"
                  className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-subtle"
                  onClick={() => startRename(menu.pageId)}
                >
                  Rename…
                </button>
              ) : null}
              {onReorderPage ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="page-nav-ctx-move-left"
                    disabled={!canMoveLeft}
                    className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (canMoveLeft) {
                        onReorderPage(menu.pageId, 'up');
                      }
                      closeMenu();
                    }}
                  >
                    Move left
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="page-nav-ctx-move-right"
                    disabled={!canMoveRight}
                    className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (canMoveRight) {
                        onReorderPage(menu.pageId, 'down');
                      }
                      closeMenu();
                    }}
                  >
                    Move right
                  </button>
                </>
              ) : null}
              {onRequestRemovePage ? (
                <>
                  <div className="my-1 h-px bg-border" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="page-nav-ctx-delete"
                    disabled={!canDelete}
                    className="w-full px-3 py-1.5 text-left text-[13px] text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (canDelete) {
                        onRequestRemovePage(menu.pageId);
                      }
                      closeMenu();
                    }}
                  >
                    Delete page…
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
