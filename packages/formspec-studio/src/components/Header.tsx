import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';

const TABS = ['Editor', 'Logic', 'Data', 'Theme', 'Mapping', 'Preview'] as const;

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onImport: () => void;
}

export function Header({ activeTab, onTabChange, onImport }: HeaderProps) {
  const project = useProject();
  const state = useProjectState();

  return (
    <header data-testid="header" className="flex items-center h-12 px-4 border-b border-border bg-surface shrink-0">
      {/* Left: app title and version */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm whitespace-nowrap">The Stack</span>
        <span className="text-xs text-muted">{state.definition.$formspec}</span>
      </div>

      {/* Center: workspace tabs */}
      <nav className="flex-1 flex justify-center" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            data-testid={`tab-${tab}`}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              activeTab === tab
                ? 'bg-accent text-on-accent font-medium'
                : 'text-muted hover:text-ink hover:bg-surface-hover'
            }`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Right: import + undo/redo */}
      <div className="flex items-center gap-1">
        <button
          data-testid="import-btn"
          className="px-2 py-1 text-sm rounded hover:bg-surface-hover"
          onClick={onImport}
        >
          Import
        </button>
        <button
          data-testid="undo-btn"
          aria-label="Undo"
          disabled={!project.canUndo}
          className="px-2 py-1 text-sm rounded disabled:opacity-40 hover:bg-surface-hover"
          onClick={() => project.undo()}
        >
          Undo
        </button>
        <button
          data-testid="redo-btn"
          aria-label="Redo"
          disabled={!project.canRedo}
          className="px-2 py-1 text-sm rounded disabled:opacity-40 hover:bg-surface-hover"
          onClick={() => project.redo()}
        >
          Redo
        </button>
      </div>
    </header>
  );
}
