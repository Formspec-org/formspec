import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure, buildLabelMap } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';
import type { ResolvedPage } from 'formspec-studio-core';

// ── ModeSelector ──────────────────────────────────────────────────────

function ModeSelector({
  mode,
  onSetMode,
}: {
  mode: string;
  onSetMode: (mode: 'single' | 'wizard' | 'tabs') => void;
}) {
  const modes: Array<{ id: 'single' | 'wizard' | 'tabs'; label: string }> = [
    { id: 'single', label: 'Single' },
    { id: 'wizard', label: 'Wizard' },
    { id: 'tabs', label: 'Tabs' },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSetMode(m.id)}
          className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-all duration-200 ${
            mode === m.id
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:text-ink hover:bg-subtle'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── PageCard ──────────────────────────────────────────────────────────

function PageCard({
  page,
  index,
  total,
  labelMap,
  isExpanded,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateTitle,
  onAddRegion,
  onRemoveRegion,
  onUpdateRegionSpan,
  onReorderRegion,
}: {
  page: ResolvedPage;
  index: number;
  total: number;
  labelMap: Map<string, string>;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateTitle: (title: string) => void;
  onAddRegion: () => void;
  onRemoveRegion: (regionIndex: number) => void;
  onUpdateRegionSpan: (regionIndex: number, span: number) => void;
  onReorderRegion: (regionIndex: number, direction: 'up' | 'down') => void;
}) {
  const regions = page.regions ?? [];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitle = useCallback(() => {
    if (!titleInputRef.current) return;
    const newTitle = titleInputRef.current.value.trim();
    if (newTitle && newTitle !== page.title) {
      onUpdateTitle(newTitle);
    }
    setIsEditingTitle(false);
  }, [page.title, onUpdateTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, [commitTitle]);

  const itemCount = regions.length;
  const itemLabel = itemCount === 0 ? 'Empty' : `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Number badge */}
        <span className="font-mono text-[11px] text-muted w-5 text-center shrink-0">
          {index + 1}
        </span>

        {/* Title (editable) */}
        <div className="flex-1 min-w-0 group/title">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              defaultValue={page.title || page.id}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="text-[13px] font-bold text-ink bg-transparent border-b border-accent outline-none w-full"
            />
          ) : (
            <button
              type="button"
              className="text-[13px] font-bold text-ink text-left truncate w-full flex items-center gap-1.5 cursor-text"
              onClick={() => setIsEditingTitle(true)}
            >
              <span className="truncate">{page.title || page.id}</span>
              <span className="text-[10px] text-muted opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0">
                &#9998;
              </span>
            </button>
          )}
        </div>

        {/* Item count */}
        <span className="text-[11px] text-muted shrink-0">{itemLabel}</span>

        {/* Expand/collapse */}
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="text-[12px] text-muted hover:text-ink transition-colors shrink-0 p-0.5"
        >
          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            &#9656;
          </span>
        </button>
      </div>

      {/* Mini grid preview (collapsed only) */}
      {!isExpanded && regions.length > 0 && (
        <div className="px-3 pb-2">
          <div className="grid grid-cols-12 gap-0.5 h-4">
            {regions.map((r, i) => (
              <div
                key={i}
                className={`rounded-sm ${r.exists === false ? 'bg-amber-300/30' : 'bg-accent/20'}`}
                style={{ gridColumn: `span ${Math.min(r.span ?? 12, 12)}` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Larger grid preview */}
          {regions.length > 0 && (
            <div className="grid grid-cols-12 gap-1 h-8">
              {regions.map((r, i) => (
                <div
                  key={i}
                  className={`border rounded text-[9px] text-center flex items-center justify-center text-muted truncate ${
                    r.exists === false
                      ? 'bg-amber-100/50 border-amber-300/50'
                      : 'bg-accent/15 border-accent/30'
                  }`}
                  style={{ gridColumn: `span ${Math.min(r.span ?? 12, 12)}` }}
                >
                  {labelMap.get(r.key) ?? r.key}
                </div>
              ))}
            </div>
          )}

          {/* Region list with editing controls */}
          {regions.length > 0 && (
            <div className="space-y-1">
              {regions.map((r, ri) => (
                <div key={`rk-${ri}-${r.key}`} className="flex items-center gap-2 text-[12px] px-2 py-1 bg-subtle/30 rounded">
                  <span className="font-mono text-ink flex-1 truncate">
                    {labelMap.get(r.key) ?? r.key}
                  </span>
                  <span className="text-muted text-[10px]">span</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    key={`sp-${ri}-${r.key}-${r.span}`}
                    defaultValue={r.span}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= 12 && val !== r.span) {
                        onUpdateRegionSpan(ri, val);
                      }
                    }}
                    className="font-mono text-ink w-10 text-center bg-transparent border border-border/50 rounded text-[11px] py-0.5"
                  />
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      disabled={ri === 0}
                      onClick={() => onReorderRegion(ri, 'up')}
                      className="text-[9px] text-muted hover:text-ink disabled:opacity-30 px-0.5"
                      title="Move region up"
                    >
                      &#9650;
                    </button>
                    <button
                      type="button"
                      disabled={ri === regions.length - 1}
                      onClick={() => onReorderRegion(ri, 'down')}
                      className="text-[9px] text-muted hover:text-ink disabled:opacity-30 px-0.5"
                      title="Move region down"
                    >
                      &#9660;
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove region"
                    onClick={() => onRemoveRegion(ri)}
                    className="text-[10px] text-muted hover:text-error transition-colors px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add region */}
          <button
            type="button"
            aria-label="Add region"
            onClick={onAddRegion}
            className="text-[10px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider"
          >
            + Add Region
          </button>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
              >
                Move Up
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
              >
                Move Down
              </button>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-wider transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main PagesTab ────────────────────────────────────────────────────

export function PagesTab() {
  const state = useProjectState();
  const project = useProject();
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);

  const labelMap = useMemo(
    () => buildLabelMap(state.definition.items ?? []),
    [state.definition.items],
  );
  const allItemKeys = useMemo(() => Array.from(labelMap.keys()), [labelMap]);
  const structure = usePageStructure(allItemKeys);

  const isSingle = structure.mode === 'single';
  const hasPages = structure.pages.length > 0;

  return (
    <WorkspacePage className="overflow-y-auto">
      {/* Sticky header: mode selector only, no heading */}
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-4 border-b border-border/40"
      >
        <ModeSelector mode={structure.mode} onSetMode={(m) => project.setFlow(m)} />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-6 space-y-6">
        {/* Single mode: no pages */}
        {isSingle && !hasPages && (
          <p className="text-[12px] text-muted">
            Switch to Wizard or Tabs to organize your form into pages.
          </p>
        )}

        {/* Single mode: has dormant pages */}
        {isSingle && hasPages && (
          <p className="text-[12px] text-muted">
            Pages are preserved but not active in single mode.
          </p>
        )}

        {/* Page list */}
        {hasPages && (
          <div className={isSingle ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-3">
              {structure.pages.map((page, i) => (
                <PageCard
                  key={page.id}
                  page={page}
                  index={i}
                  total={structure.pages.length}
                  labelMap={labelMap}
                  isExpanded={expandedPageId === page.id}
                  onToggle={() =>
                    setExpandedPageId(expandedPageId === page.id ? null : page.id)
                  }
                  onDelete={() => project.removePage(page.id)}
                  onMoveUp={() => project.reorderPage(page.id, 'up')}
                  onMoveDown={() => project.reorderPage(page.id, 'down')}
                  onUpdateTitle={(title) => project.updatePage(page.id, { title })}
                  onAddRegion={() => project.addRegion(page.id, 12)}
                  onRemoveRegion={(ri) => project.deleteRegion(page.id, ri)}
                  onUpdateRegionSpan={(ri, span) => project.updateRegion(page.id, ri, 'span', span)}
                  onReorderRegion={(ri, dir) => project.reorderRegion(page.id, ri, dir)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Add page — only in wizard/tabs mode */}
        {!isSingle && (
          <button
            type="button"
            aria-label="Add page"
            onClick={() => project.addPage('New Page')}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + Add Page
          </button>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
