import React from 'react';
import { ModeSelector } from './ModeSelector';
import { LayoutStepNav, type LayoutStepNavPage } from './LayoutStepNav';

interface LayoutCanvasHeaderProps {
  mode: 'single' | 'wizard' | 'tabs';
  onSetMode: (mode: 'single' | 'wizard' | 'tabs') => void;
  isMultiPage: boolean;
  showAddPageButton: boolean;
  onAddPage: () => void;
  pageNavItems: LayoutStepNavPage[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onRenamePage: (pageId: string, title: string, groupPath?: string, componentPageId?: string) => void;
  onReorderPage: (navPageId: string, direction: 'up' | 'down') => void;
  onMovePageToIndex: (navPageId: string, targetIndex: number) => void;
  onRequestRemovePage: (id: string) => void;
}

export function LayoutCanvasHeader({
  mode,
  onSetMode,
  isMultiPage,
  showAddPageButton,
  onAddPage,
  pageNavItems,
  activePageId,
  onSelectPage,
  onRenamePage,
  onReorderPage,
  onMovePageToIndex,
  onRequestRemovePage,
}: LayoutCanvasHeaderProps) {
  const addPageButton = (
    <button
      type="button"
      data-testid="layout-add-page"
      aria-label="Add page to layout"
      className="min-h-11 rounded-full border border-transparent px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:border-border/60 hover:bg-bg-default/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      onClick={onAddPage}
    >
      + Page
    </button>
  );

  return (
    <div className="sticky top-0 z-20 w-full shrink-0 border-b border-border/40 bg-bg-default/85 py-4 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[980px] px-7">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ModeSelector mode={mode} onSetMode={onSetMode} />
            </div>
            {showAddPageButton && addPageButton}
          </div>
          {isMultiPage && (
            <LayoutStepNav
              pages={pageNavItems}
              activePageId={activePageId ?? pageNavItems[0]?.id ?? null}
              onSelectPage={onSelectPage}
              onRenamePage={onRenamePage}
              onReorderPage={onReorderPage}
              onMovePageToIndex={onMovePageToIndex}
              onRequestRemovePage={onRequestRemovePage}
              trailing={addPageButton}
            />
          )}
        </div>
      </div>
    </div>
  );
}
