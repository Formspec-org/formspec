/** @filedesc Top navigation header with workspace tab bar and actions (new, import, export, search). */
import { useState, useRef, useEffect } from 'react';
import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';
import { type ColorScheme, type ThemePreference } from '../hooks/useColorScheme';

const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Definition tree — items, types, and data binds' },
  { name: 'Logic', help: 'Binds, shapes, and variables — all form logic lives here' },
  { name: 'Data', help: 'Response schema, data sources, option sets, and test data' },
  { name: 'Layout', help: 'Visual form builder — pages, layout containers, and widget selection' },
  { name: 'Theme', help: 'Visual tokens, defaults, selectors, and page layouts' },
  { name: 'Mapping', help: 'Bidirectional data transforms for import/export formats' },
  { name: 'Preview', help: 'Live form preview and JSON document view' },
];

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
  onToggleMenu?: () => void;
  onToggleChat?: () => void;
  isCompact?: boolean;
  colorScheme?: ColorScheme;
}

function tabId(name: string): string {
  return `studio-tab-${name.toLowerCase()}`;
}

function panelId(name: string): string {
  return `studio-panel-${name.toLowerCase()}`;
}

/** Cycle order: system → light → dark → system */
const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];

function nextTheme(current: ThemePreference): ThemePreference {
  const idx = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
}

function ThemeToggleIcon({ theme, resolved }: { theme: ThemePreference; resolved: 'light' | 'dark' }) {
  if (theme === 'system') {
    // Monitor icon for "system"
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    );
  }
  if (resolved === 'dark') {
    // Moon icon
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    );
  }
  // Sun icon
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
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
  onToggleMenu,
  onToggleChat,
  isCompact = false,
  colorScheme,
}: HeaderProps) {
  const project = useProject();
  const state = useProjectState();
  const { definition } = state;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const lastIndex = TABS.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    const nextTab = TABS[nextIndex];
    onTabChange(nextTab.name);
    tabRefs.current[nextIndex]?.focus();
  };

  const tabButtons = TABS.map(({ name, help }, index) => (
    <button
      key={name}
      id={tabId(name)}
      role="tab"
      aria-selected={activeTab === name}
      aria-controls={panelId(name)}
      tabIndex={activeTab === name ? 0 : -1}
      data-testid={`tab-${name}`}
      title={help}
      ref={(node) => {
        tabRefs.current[index] = node;
      }}
      className={`px-3 sm:px-3.5 h-full text-[13px] transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
        activeTab === name
          ? 'border-accent text-accent font-semibold'
          : 'border-transparent text-muted hover:text-ink'
      }`}
      onClick={() => onTabChange(name)}
      onKeyDown={(event) => handleTabKeyDown(event, index)}
    >
      {name}
    </button>
  ));

  const profileMenu = (
    <div ref={menuRef} className="relative ml-0.5 sm:ml-1">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={menuOpen}
        className={`w-7 h-7 rounded-full bg-[#E2D9CF] border-2 shrink-0 transition-colors ${
          menuOpen ? 'border-accent' : 'border-border hover:border-muted/40'
        }`}
        onClick={() => setMenuOpen(!menuOpen)}
      />
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-[6px] shadow-lg py-1 z-50">
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => { setMenuOpen(false); onNew?.(); }}
          >
            New Form
          </button>
          <button
            data-testid="import-btn"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => { setMenuOpen(false); onImport(); }}
          >
            Import
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => { setMenuOpen(false); onExport?.(); }}
          >
            Export
          </button>
          <div className="border-t border-border my-1" />
          {isCompact && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
              onClick={() => { setMenuOpen(false); onOpenMetadata?.(); }}
            >
              Metadata
            </button>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => { setMenuOpen(false); onOpenMetadata?.(); }}
          >
            Form Settings
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => { setMenuOpen(false); onToggleAccountMenu?.(); }}
          >
            App Settings
          </button>
        </div>
      )}
    </div>
  );

  const actionButtons = (
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {/* Search — icon-only on compact, full bar on wide */}
      {isCompact ? (
        <button
          onClick={onSearch}
          aria-label="Search"
          className="p-1.5 rounded hover:bg-subtle transition-colors"
          title="Search (⌘K)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      ) : (
        <button
          onClick={onSearch}
          className="flex items-center gap-2 bg-subtle border border-border rounded-[4px] px-3 py-1.5 max-w-[240px] text-muted hover:border-muted/40 transition-colors group"
        >
          <span className="text-[13px]">🔍</span>
          <span className="text-[13px] font-ui">Search…</span>
          <span className="ml-auto font-mono text-[11px] border border-border rounded-[2px] px-1.5 py-0.5 group-hover:bg-surface transition-colors">
            ⌘K
          </span>
        </button>
      )}

      {!isCompact && (
        <button
          type="button"
          aria-label={`FORMSPEC ${definition.$formspec} metadata`}
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors"
          onClick={onOpenMetadata}
        >
          Metadata
        </button>
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

      {onToggleChat && (
        <button
          type="button"
          data-testid="toggle-chat"
          aria-label="Toggle AI chat"
          className="p-1.5 rounded hover:bg-subtle transition-colors"
          onClick={onToggleChat}
          title="AI Assistant"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
          </svg>
        </button>
      )}

      {colorScheme && (
        <button
          type="button"
          aria-label={`Switch to ${nextTheme(colorScheme.theme)} theme`}
          title={`Theme: ${colorScheme.theme} (click to switch to ${nextTheme(colorScheme.theme)})`}
          className="p-1.5 rounded hover:bg-subtle transition-colors"
          onClick={() => colorScheme.setTheme(nextTheme(colorScheme.theme))}
        >
          <ThemeToggleIcon theme={colorScheme.theme} resolved={colorScheme.resolvedTheme} />
        </button>
      )}

      {profileMenu}
    </div>
  );

  /* ── Compact: two rows (toolbar + tab strip) ── */
  if (isCompact) {
    return (
      <div data-testid="header" className="shrink-0 bg-surface border-b border-border">
        {/* Row 1: Logo + Title + Actions */}
        <div className="flex items-center h-[44px] px-3 gap-4">
          {onToggleMenu && (
            <button
              type="button"
              aria-label="Toggle blueprint menu"
              className="p-1.5 -ml-1.5 rounded hover:bg-subtle transition-colors"
              onClick={onToggleMenu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <button
            type="button"
            aria-label="The Stack home"
            className="flex items-center gap-2.5 shrink-0 text-left"
            onClick={() => { onTabChange('Editor'); onHome?.(); }}
          >
            <div className="w-6 h-6 bg-accent rounded-[5px] flex items-center justify-center shrink-0">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="white" />
                <rect x="2" y="5" width="8" height="2" rx=".4" fill="white" fillOpacity=".7" />
                <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="white" fillOpacity=".4" />
              </svg>
            </div>
            <div className="">
              <div className="font-bold text-[14px] tracking-tight leading-none whitespace-nowrap">The Stack</div>
              <div className="font-mono text-[9px] text-muted tracking-wide uppercase whitespace-nowrap">
                FORMSPEC {definition.$formspec} · {definition.status || 'DRAFT'}
              </div>
            </div>
          </button>
          <div className="flex-1" />
          {actionButtons}
        </div>

        {/* Row 2: Scrollable tab strip */}
        <nav className="flex h-[36px] overflow-x-auto scrollbar-none px-3" role="tablist" aria-label="Studio workspaces">
          {tabButtons}
        </nav>
      </div>
    );
  }

  /* ── Desktop: single row ── */
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
        onClick={() => { onTabChange('Editor'); onHome?.(); }}
      >
        <div className="w-6.5 h-6.5 bg-accent rounded-[6px] flex items-center justify-center shrink-0">
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
      <nav className="flex h-full" role="tablist" aria-label="Studio workspaces">
        {tabButtons}
      </nav>

      <div className="flex-1 min-w-0" />

      {actionButtons}
    </header>
  );
}
