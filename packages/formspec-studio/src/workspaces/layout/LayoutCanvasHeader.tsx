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
      className="h-9 flex items-center gap-1.5 px-3 rounded-md bg-accent text-surface hover:bg-accent/90 text-[10px] font-bold uppercase tracking-normal transition-all shadow-sm"
      onClick={onAddPage}
    >
      <span className="text-[12px] leading-none">+</span> Page
    </button>
  );

  return (
    <div className="sticky top-0 z-30 w-full shrink-0 border-b border-border bg-bg-default py-4">
      <div className="mx-auto w-full max-w-[1020px] px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <p className="font-display text-[9px] font-bold uppercase tracking-normal text-muted">Layout Orchestration</p>
                <div className="flex items-center gap-3">
                   <h2 className="font-display text-[16px] font-bold tracking-tight text-ink">Surface Flow</h2>
                   <div className="h-4 w-[1px] bg-border/40" />
                   <ModeSelector mode={mode} onSetMode={onSetMode} />
                </div>
              </div>
            </div>
            {showAddPageButton && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                {addPageButton}
              </div>
            )}
          </div>
          
          {isMultiPage && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
