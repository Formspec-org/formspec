/** @filedesc Focus Mode container for editing a single page's layout. */
import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { WorkspacePage } from '../../components/ui/WorkspacePage';
import { SplitPane } from '../../components/ui/SplitPane';
import { BreakpointBar } from './BreakpointBar';
import { FieldPalette } from './FieldPalette';
import { GridCanvas } from './GridCanvas';
import { usePageStructure } from './usePageStructure';
import { useProject } from '../../state/useProject';

interface PagesFocusViewProps {
  pageId: string;
  onBack: () => void;
  onNavigate: (pageId: string) => void;
}

export function PagesFocusView({ pageId, onBack, onNavigate }: PagesFocusViewProps) {
  const project = useProject();
  const structure = usePageStructure();

  const [activeBreakpoint, setActiveBreakpoint] = useState('base');
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Find current page
  const pageIndex = structure.pages.findIndex((p) => p.id === pageId);
  const page = structure.pages[pageIndex];
  const totalPages = structure.pages.length;

  // Keyboard handler: Escape priority
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Don't intercept if the focus is inside an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (selectedItemKey) {
          setSelectedItemKey(null);
        } else {
          onBack();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemKey, onBack]);

  // Reset selection when page changes
  useEffect(() => {
    setSelectedItemKey(null);
  }, [pageId]);

  const commitTitle = useCallback(() => {
    if (!titleInputRef.current) return;
    const newTitle = titleInputRef.current.value.trim();
    if (newTitle && page && newTitle !== page.title) {
      project.updatePage(pageId, { title: newTitle });
    }
  }, [page, pageId, project]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle();
      (e.target as HTMLElement).blur();
    }
  }, [commitTitle]);

  const handlePrevPage = useCallback(() => {
    if (pageIndex > 0) {
      onNavigate(structure.pages[pageIndex - 1].id);
    }
  }, [pageIndex, structure.pages, onNavigate]);

  const handleNextPage = useCallback(() => {
    if (pageIndex < totalPages - 1) {
      onNavigate(structure.pages[pageIndex + 1].id);
    }
  }, [pageIndex, totalPages, structure.pages, onNavigate]);

  // D2/D3: Unified drag-end handler for grid reorder + palette-to-grid
  const handleDragEnd = useCallback((event: any) => {
    if (event.canceled) return;
    const sourceData = event.operation?.source?.data ?? {};
    const targetData = event.operation?.target?.data ?? {};
    const targetId = String(event.operation?.target?.id ?? '');

    if (sourceData.type === 'palette-item') {
      // D3: Palette item dropped onto grid
      project.placeOnPage(sourceData.key, pageId, { span: 12 });
      // If dropped on a specific grid item, reorder to that position
      if (page) {
        const targetIndex = page.items.findIndex(i => i.key === targetId);
        if (targetIndex >= 0) {
          project.moveItemOnPageToIndex(pageId, sourceData.key, targetIndex);
        }
      }
    } else if (sourceData.type === 'grid-item') {
      // D2: Grid item reordered
      if (page) {
        const targetIndex = page.items.findIndex(i => i.key === targetId);
        if (targetIndex >= 0 && sourceData.key !== targetId) {
          project.moveItemOnPageToIndex(pageId, sourceData.key, targetIndex);
        }
      }
    }
  }, [project, pageId, page]);

  if (!page) {
    return (
      <WorkspacePage maxWidth="max-w-full">
        <div className="p-4 text-muted text-[12px]">Page not found.</div>
      </WorkspacePage>
    );
  }

  const isDormant = structure.mode === 'single';

  const gridCanvas = (
    <GridCanvas
      items={page.items}
      activeBreakpoint={activeBreakpoint}
      selectedItemKey={selectedItemKey}
      onSelectItem={setSelectedItemKey}
      onRemoveItem={(key) => project.removeItemFromPage(pageId, key)}
      onSetWidth={(key, width) => project.setItemWidth(pageId, key, width)}
      onSetOffset={(key, offset) => project.setItemOffset(pageId, key, offset)}
      onSetResponsive={(key, bp, overrides) => project.setItemResponsive(pageId, key, bp, overrides)}
      onMoveItem={(key, targetIndex) => project.moveItemOnPageToIndex(pageId, key, targetIndex)}
    />
  );

  const mainContent = isPaletteOpen ? (
    <SplitPane
      initialSplit={70}
      minRight={200}
      left={gridCanvas}
      right={
        <FieldPalette
          pageId={pageId}
          isOpen={isPaletteOpen}
          onToggle={() => setIsPaletteOpen(false)}
        />
      }
    />
  ) : (
    gridCanvas
  );

  return (
    <WorkspacePage maxWidth="max-w-full" className="overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-surface shrink-0">
        {/* Back button */}
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="text-[14px] text-muted hover:text-ink transition-colors p-1"
        >
          &#8592;
        </button>

        {/* Editable page title */}
        <input
          ref={titleInputRef}
          type="text"
          aria-label="Page title"
          defaultValue={page.title || page.id}
          key={`title-${pageId}-${page.title}`}
          onBlur={commitTitle}
          onKeyDown={handleTitleKeyDown}
          className="text-[14px] font-bold text-ink bg-transparent border-none outline-none flex-1 min-w-0 px-1 hover:bg-subtle/30 focus:bg-subtle/50 rounded transition-colors"
        />

        {/* Dormant badge */}
        {isDormant && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded shrink-0">
            Dormant
          </span>
        )}

        {/* Page navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Previous page"
            disabled={pageIndex <= 0}
            onClick={handlePrevPage}
            className="text-[12px] text-muted hover:text-ink disabled:opacity-30 transition-colors p-1"
          >
            &#9664;
          </button>
          <span className="text-[11px] text-muted font-mono">
            {pageIndex + 1} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={pageIndex >= totalPages - 1}
            onClick={handleNextPage}
            className="text-[12px] text-muted hover:text-ink disabled:opacity-30 transition-colors p-1"
          >
            &#9654;
          </button>
        </div>

        {/* Palette toggle (when closed) */}
        {!isPaletteOpen && (
          <button
            type="button"
            aria-label="Open palette"
            onClick={() => setIsPaletteOpen(true)}
            className="text-[10px] text-muted hover:text-ink font-bold uppercase tracking-wider transition-colors"
          >
            Fields
          </button>
        )}
      </div>

      {/* Page description */}
      {page.description && (
        <div className="px-4 py-1.5 text-[12px] text-muted border-b border-border/20">
          {page.description}
        </div>
      )}

      {/* Breakpoint bar */}
      <BreakpointBar
        breakpointNames={structure.breakpointNames}
        breakpointValues={structure.breakpointValues}
        active={activeBreakpoint}
        onSelect={setActiveBreakpoint}
      />

      {/* Main content area — DragDropProvider wraps both grid and palette */}
      <div className="flex-1 overflow-hidden">
        <DragDropProvider
          onDragEnd={handleDragEnd}
          sensors={() => [
            PointerSensor.configure({
              activationConstraints: [
                new PointerActivationConstraints.Distance({ value: 5 }),
              ],
            }),
          ]}
        >
          {mainContent}
        </DragDropProvider>
      </div>
    </WorkspacePage>
  );
}
