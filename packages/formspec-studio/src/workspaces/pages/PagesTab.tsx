import { useState } from 'react';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure } from './usePageStructure';
import { useDispatch } from '../../state/useDispatch';
import type { ResolvedPage, PageDiagnostic } from 'formspec-studio-core';

// ── Sub-components ───────────────────────────────────────────────────

function TierStatusBanner({ controllingTier }: { controllingTier: string }) {
  if (controllingTier === 'theme') return null;

  const messages: Record<string, string> = {
    none: 'Single-page form. Enable wizard mode to add pages.',
    definition: 'Pages inferred from definition groups. Add theme pages for full control.',
    component: 'A Wizard component is active in the component tree. Theme pages are shadowed.',
  };

  const colors: Record<string, string> = {
    none: 'bg-subtle text-muted',
    definition: 'bg-amber-50 text-amber-800 border-amber-200',
    component: 'bg-orange-50 text-orange-800 border-orange-200',
  };

  return (
    <div
      data-testid="tier-status-banner"
      className={`px-4 py-3 text-[12px] rounded-lg border ${colors[controllingTier] ?? 'bg-subtle text-muted'}`}
    >
      {messages[controllingTier] ?? ''}
    </div>
  );
}

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
          role="button"
          aria-label={m.label}
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

function PageCard({
  page,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  page: ResolvedPage;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const regions = page.regions ?? [];

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-subtle/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-[13px] font-bold text-ink flex-1">
          {page.title || page.id}
        </span>
        <span className="text-[11px] text-muted">
          {regions.length} region{regions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Mini grid preview */}
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
        <div className="border-t border-border p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {page.description && (
            <p className="text-[12px] text-muted">{page.description}</p>
          )}

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

          {regions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Assigned Items</div>
              {regions.map((r, i) => (
                <div key={i} className="text-[12px] font-mono text-ink px-2 py-1 bg-subtle/30 rounded">
                  {r.key || '(empty)'}
                  {r.span ? ` — span ${r.span}` : ''}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
              >
                Move Up
              </button>
              <button
                type="button"
                disabled={isLast}
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

function DiagnosticsPanel({ diagnostics }: { diagnostics: PageDiagnostic[] }) {
  if (diagnostics.length === 0) return null;

  return (
    <div className="space-y-2">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={`px-3 py-2 text-[12px] rounded-lg border ${
            d.severity === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <span className="font-bold">{d.code}</span>: {d.message}
        </div>
      ))}
    </div>
  );
}

// ── Main PagesTab ────────────────────────────────────────────────────

export function PagesTab() {
  const structure = usePageStructure();
  const dispatch = useDispatch();

  const setMode = (mode: 'single' | 'wizard' | 'tabs') => {
    dispatch({ type: 'pages.setMode', payload: { mode } });
  };

  const addPage = () => {
    dispatch({ type: 'pages.addPage', payload: {} });
  };

  const deletePage = (id: string) => {
    dispatch({ type: 'pages.deletePage', payload: { id } });
  };

  const reorderPage = (id: string, direction: 'up' | 'down') => {
    dispatch({ type: 'pages.reorderPages', payload: { id, direction } });
  };

  const autoGenerate = () => {
    dispatch({ type: 'pages.autoGenerate', payload: {} });
  };

  const isMultiPage = structure.mode !== 'single';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-4 border-b border-border/40"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-[14px] font-bold tracking-[0.15em] uppercase text-ink">Pages</h2>
        </div>
        <ModeSelector mode={structure.mode} onSetMode={setMode} />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-6 space-y-6">
        <TierStatusBanner controllingTier={structure.controllingTier} />

        <DiagnosticsPanel diagnostics={structure.diagnostics} />

        {isMultiPage && structure.controllingTier !== 'component' && (
          <>
            <div className="space-y-3">
              {structure.pages.map((page, i) => (
                <PageCard
                  key={page.id}
                  page={page}
                  onDelete={() => deletePage(page.id)}
                  onMoveUp={() => reorderPage(page.id, 'up')}
                  onMoveDown={() => reorderPage(page.id, 'down')}
                  isFirst={i === 0}
                  isLast={i === structure.pages.length - 1}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Add page"
                onClick={addPage}
                className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
              >
                + Add Page
              </button>
              <button
                type="button"
                aria-label="Generate from definition"
                onClick={autoGenerate}
                className="text-[11px] text-muted hover:text-ink font-bold uppercase tracking-wider transition-colors"
              >
                Generate from Groups
              </button>
            </div>
          </>
        )}

        {isMultiPage && structure.controllingTier === 'component' && (
          <div className="space-y-3">
            {structure.pages.map((page) => (
              <div key={page.id} className="border border-border rounded-lg bg-surface px-3 py-2">
                <span className="text-[13px] font-bold text-ink">{page.title || page.id}</span>
              </div>
            ))}
            <p className="text-[12px] text-muted italic">
              Pages are controlled by the Wizard component. Edit them in the Component Tree.
            </p>
          </div>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
