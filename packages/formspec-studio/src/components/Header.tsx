import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';

const TABS = ['Editor', 'Logic', 'Data', 'Theme', 'Mapping', 'Preview'] as const;

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNew?: () => void;
  onExport?: () => void;
  onImport: () => void;
  onSearch: () => void;
  onHome?: () => void;
  onOpenMetadata?: () => void;
  onToggleAccountMenu?: () => void;
  isCompact?: boolean;
}

export function Header({
  activeTab,
  onTabChange,
  onNew,
  onExport,
  onImport,
  onSearch,
  onHome,
  onOpenMetadata,
  onToggleAccountMenu,
  isCompact = false,
}: HeaderProps) {
  const project = useProject();
  const state = useProjectState();
  const { definition } = state;

  return (
    <header
      data-testid="header"
      className="flex items-center h-[50px] px-4 border-b border-border bg-surface shrink-0"
    >
      {/* Left: App Mark + Title */}
      <button
        type="button"
        aria-label="The Stack home"
        className="flex items-center gap-2 mr-6 shrink-0 text-left"
        onClick={() => {
          onTabChange('Editor');
          onHome?.();
        }}
      >
        <div className="w-6.5 h-6.5 bg-accent rounded-[6px] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="white" />
            <rect x="2" y="5" width="8" height="2" rx=".4" fill="white" fillOpacity=".7" />
            <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="white" fillOpacity=".4" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-[15px] tracking-tight leading-none">The Stack</div>
          <div className="font-mono text-[11px] text-muted tracking-widest uppercase">
            FORMSPEC {definition.$formspec} · {definition.status || 'DRAFT'}
          </div>
        </div>
      </button>

      {/* Tabs */}
      <nav className="flex h-full" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            data-testid={`tab-${tab}`}
            className={`px-3.5 h-full text-[13px] transition-colors border-b-2 cursor-pointer ${
              activeTab === tab
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Center: Search Bar — min-w-0 allows flex shrink on narrow viewports */}
      <div className="flex-1 min-w-0 flex justify-center px-2">
        <button
          onClick={onSearch}
          className="flex items-center gap-2 bg-subtle border border-border rounded-[4px] px-3 py-1.5 w-full max-w-[280px] text-muted hover:border-muted/40 transition-colors group"
        >
          <span className="text-[13px]">🔍</span>
          {!isCompact && <span className="text-[13px] font-ui">Search items, rules, FEL…</span>}
          <span className="ml-auto font-mono text-[11px] border border-border rounded-[2px] px-1.5 py-0.5 group-hover:bg-surface transition-colors">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isCompact && (
          <>
            <button
              type="button"
              aria-label={`FORMSPEC ${definition.$formspec} metadata`}
              className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors"
              onClick={onOpenMetadata}
            >
              Metadata
            </button>
          </>
        )}
        <button
          data-testid="undo-btn"
          aria-label="Undo"
          disabled={!project.canUndo}
          className="p-1.5 rounded hover:bg-subtle disabled:opacity-30 transition-colors"
          onClick={() => project.undo()}
          title="Undo (⌘Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button
          data-testid="redo-btn"
          aria-label="Redo"
          disabled={!project.canRedo}
          className="p-1.5 rounded hover:bg-subtle disabled:opacity-30 transition-colors"
          onClick={() => project.redo()}
          title="Redo (⌘⇧Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {!isCompact && (
          <button
            type="button"
            className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors"
            onClick={onNew}
          >
            New Form
          </button>
        )}
        {!isCompact && (
          <button
            type="button"
            className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors"
            onClick={onExport}
          >
            Export
          </button>
        )}
        <button
          data-testid="import-btn"
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors"
          onClick={onImport}
        >
          Import
        </button>
        <button
          type="button"
          aria-label="Account profile"
          className="w-7 h-7 rounded-full bg-[#E2D9CF] border-2 border-border ml-1 shrink-0"
          onClick={onToggleAccountMenu}
        />
      </div>
    </header>
  );
}
