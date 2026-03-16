import { useState } from 'react';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';

interface Region {
  key?: string;
  span?: number;
  start?: number;
}

interface Page {
  id: string;
  title?: string;
  description?: string;
  regions?: Region[];
}

export function PageDefinitions() {
  const theme = useTheme();
  const project = useProject();
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);

  const pages = (theme?.pages ?? []) as Page[];

  const addPage = () => {
    const result = project.addPage('New Page');
    if (result.createdId) setExpandedPageId(result.createdId);
  };

  const updatePageProperty = (pageId: string, property: string, value: unknown) => {
    project.updatePage(pageId, { [property]: value } as any);
  };

  const deletePage = (pageId: string) => {
    project.removePage(pageId);
    if (expandedPageId === pageId) setExpandedPageId(null);
  };

  const reorderPage = (pageId: string, direction: 'up' | 'down') => {
    project.reorderPage(pageId, direction);
  };

  const renamePage = (pageId: string, newId: string) => {
    project.renamePage(pageId, newId);
    if (expandedPageId === pageId) setExpandedPageId(newId);
  };

  const addRegion = (pageId: string) => {
    project.addRegion(pageId, 12);
  };

  const setRegionProperty = (pageId: string, regionIndex: number, property: string, value: unknown) => {
    project.updateRegion(pageId, regionIndex, property, value);
  };

  const deleteRegion = (pageId: string, regionIndex: number) => {
    project.deleteRegion(pageId, regionIndex);
  };

  const reorderRegion = (pageId: string, regionIndex: number, direction: 'up' | 'down') => {
    project.reorderRegion(pageId, regionIndex, direction);
  };

  const setRegionKey = (pageId: string, regionIndex: number, newKey: string) => {
    project.setRegionKey(pageId, regionIndex, newKey);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Pages</h4>
        <button
          type="button"
          onClick={addPage}
          className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
        >
          + New Page
        </button>
      </div>

      {pages.length === 0 && (
        <div className="py-2 text-xs text-muted italic">
          No pages defined. Add pages to create a multi-step form.
        </div>
      )}

      {pages.map((page) => {
        const isExpanded = expandedPageId === page.id;
        const regions = page.regions ?? [];
        const pageIndex = pages.indexOf(page);

        return (
          <div key={page.id} className="border border-border rounded-lg bg-surface overflow-hidden">
            {/* Collapsed header */}
            <div
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-subtle/50 transition-colors"
              onClick={() => setExpandedPageId(isExpanded ? null : page.id)}
            >
              <span className="text-[13px] font-bold text-ink flex-1">
                {page.title || page.id}
              </span>
              <span className="text-[11px] text-muted">
                {regions.length} region{regions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Mini grid bar (collapsed preview) */}
            {!isExpanded && regions.length > 0 && (
              <div className="px-3 pb-2">
                <div className="grid grid-cols-12 gap-0.5 h-3">
                  {regions.map((r, i) => (
                    <div
                      key={i}
                      className="bg-accent/20 rounded-sm text-[7px] text-center text-muted truncate"
                      style={{ gridColumn: `span ${Math.min(r.span ?? 12, 12)}` }}
                    >
                      {r.key || ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border p-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Page ID */}
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">Page ID</label>
                  <input
                    type="text"
                    defaultValue={page.id}
                    key={`id-${page.id}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== page.id) {
                        renamePage(page.id, v);
                      }
                    }}
                    className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
                  />
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">Title</label>
                  <input
                    type="text"
                    defaultValue={page.title ?? ''}
                    key={`title-${page.title}`}
                    onBlur={(e) => updatePageProperty(page.id, 'title', e.target.value.trim() || null)}
                    className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
                  />
                </div>

                {/* 12-column grid visual */}
                {regions.length > 0 && (
                  <div className="grid grid-cols-12 gap-1 h-8">
                    {regions.map((r, i) => (
                      <div
                        key={i}
                        className="bg-accent/15 border border-accent/30 rounded text-[9px] text-center flex items-center justify-center text-muted truncate"
                        style={{ gridColumn: `span ${Math.min(r.span ?? 12, 12)}` }}
                      >
                        {r.key || `region ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Region list */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Regions</div>
                  {regions.map((region, ri) => (
                    <div key={ri} className="flex items-center gap-2 py-1 px-2 rounded bg-subtle/30">
                      <input
                        type="text"
                        defaultValue={region.key ?? ''}
                        key={`rk-${ri}-${region.key}`}
                        placeholder="field key"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (region.key ?? '')) setRegionKey(page.id, ri, v);
                        }}
                        className="flex-1 px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
                      />
                      <input
                        type="number"
                        defaultValue={region.span ?? 12}
                        key={`rs-${ri}-${region.span}`}
                        min={1}
                        max={12}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v !== (region.span ?? 12)) {
                            setRegionProperty(page.id, ri, 'span', v);
                          }
                        }}
                        className="w-14 px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent text-center"
                      />
                      <button
                        type="button"
                        aria-label="Move region up"
                        disabled={ri === 0}
                        onClick={() => reorderRegion(page.id, ri, 'up')}
                        className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        aria-label="Move region down"
                        disabled={ri === regions.length - 1}
                        onClick={() => reorderRegion(page.id, ri, 'down')}
                        className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        aria-label="Delete region"
                        onClick={() => deleteRegion(page.id, ri)}
                        className="text-[10px] text-muted hover:text-error font-mono uppercase"
                      >
                        Del
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRegion(page.id)}
                    className="text-[11px] text-accent hover:text-accent-hover font-mono transition-colors"
                  >
                    + Add Region
                  </button>
                </div>

                {/* Page actions */}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label="Move page up"
                      disabled={pageIndex === 0}
                      onClick={() => reorderPage(page.id, 'up')}
                      className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
                    >
                      Move Page Up
                    </button>
                    <button
                      type="button"
                      aria-label="Move page down"
                      disabled={pageIndex === pages.length - 1}
                      onClick={() => reorderPage(page.id, 'down')}
                      className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
                    >
                      Move Page Down
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete page"
                    disabled={pages.length <= 1}
                    onClick={() => deletePage(page.id)}
                    className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-wider transition-colors disabled:opacity-30"
                  >
                    Delete Page
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
