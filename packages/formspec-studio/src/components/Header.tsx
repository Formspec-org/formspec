/** @filedesc Top navigation header with workspace tab bar and actions (new, import, export, search). */
import { useState, useRef, useEffect } from 'react';
import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';
import { type ColorScheme, type ThemePreference } from '../hooks/useColorScheme';

const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Build your form structure and manage shared resources' },
  { name: 'Layout', help: 'Visual form builder — pages, layout containers, widget selection, and theme overrides' },
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
      className={`flex items-center px-3 sm:px-3.5 h-full text-[13px] transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
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
          <div className="border-t border-border my-1" />
          <a
            href="/chat.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            AI Chat Studio
          </a>
        </div>
      )}
    </div>
  );

  const actionButtons = (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* Search — icon-only on compact, full bar on wide */}
      {isCompact ? (
        <button
          onClick={onSearch}
          aria-label="Search"
          className="rounded-full border border-border/65 bg-surface/70 p-2 text-muted hover:bg-surface hover:text-ink transition-colors"
          title="Search (⌘K)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      ) : (
        <button
          onClick={onSearch}
          className="group flex items-center gap-2 rounded-full border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,237,226,0.88))] dark:bg-[linear-gradient(180deg,rgba(32,44,59,0.9),rgba(26,35,47,0.88))] px-4 py-2 max-w-[260px] text-muted shadow-[0_10px_25px_rgba(23,32,51,0.06)] dark:shadow-[0_12px_26px_rgba(0,0,0,0.28)] hover:border-muted/50 hover:text-ink transition-colors"
        >
          <span className="text-[13px]">⌕</span>
          <span className="text-[13px] font-ui">Search…</span>
          <span className="ml-auto rounded-full border border-border/70 px-2 py-0.5 font-mono text-[11px] group-hover:bg-surface transition-colors">
            ⌘K
          </span>
        </button>
      )}

      {!isCompact && (
        <button
          type="button"
          aria-label={`FORMSPEC ${definition.$formspec} metadata`}
          className="rounded-full border border-border/75 px-3.5 py-2 text-[12.5px] font-medium text-ink/88 hover:bg-surface/70 transition-colors"
          onClick={onOpenMetadata}
        >
          Metadata
        </button>
      )}
      <button
        data-testid="undo-btn"
        aria-label="Undo"
        disabled={!project.canUndo}
        className="rounded-full border border-transparent p-2 text-muted hover:border-border/60 hover:bg-surface/75 hover:text-ink disabled:opacity-30 transition-colors"
        onClick={() => project.undo()}
        title="Undo (⌘Z)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </button>
      <button
        data-testid="redo-btn"
        aria-label="Redo"
        disabled={!project.canRedo}
        className="rounded-full border border-transparent p-2 text-muted hover:border-border/60 hover:bg-surface/75 hover:text-ink disabled:opacity-30 transition-colors"
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
          className="rounded-full border border-transparent p-2 text-muted hover:border-border/60 hover:bg-surface/75 hover:text-ink transition-colors"
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
          className="rounded-full border border-transparent p-2 text-muted hover:border-border/60 hover:bg-surface/75 hover:text-ink transition-colors"
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
        <div className="flex items-center min-h-[56px] px-3 gap-4 bg-[linear-gradient(180deg,rgba(255,251,245,0.95),rgba(247,239,228,0.92))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.96),rgba(32,44,59,0.92))]">
          {onToggleMenu && (
            <button
              type="button"
              aria-label="Toggle blueprint menu"
              className="rounded-full border border-border/60 bg-surface/75 p-2 -ml-1.5 hover:bg-surface transition-colors"
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
            <div className="w-8 h-8 bg-[linear-gradient(160deg,var(--color-accent),color-mix(in_srgb,var(--color-accent)_68%,var(--color-teal)))] rounded-[9px] flex items-center justify-center shrink-0 shadow-[0_12px_30px_rgba(39,87,199,0.24)]">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="white" />
                <rect x="2" y="5" width="8" height="2" rx=".4" fill="white" fillOpacity=".7" />
                <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="white" fillOpacity=".4" />
              </svg>
            </div>
            <div>
              <div className="font-display text-[22px] tracking-[-0.04em] leading-none whitespace-nowrap text-ink">The Stack</div>
              <div className="font-mono text-[11px] text-muted/85 tracking-[0.22em] uppercase whitespace-nowrap">
                FORMSPEC {definition.$formspec} · {definition.status || 'DRAFT'}
              </div>
            </div>
          </button>
          <div className="flex-1" />
          {actionButtons}
        </div>

        {/* Row 2: Scrollable tab strip */}
        <nav className="flex h-[42px] overflow-x-auto scrollbar-none border-t border-border/40 px-3 bg-[linear-gradient(180deg,rgba(255,253,249,0.8),rgba(255,248,239,0.72))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.88),rgba(23,32,46,0.82))]" role="tablist" aria-label="Studio workspaces">
          {tabButtons}
        </nav>
      </div>
    );
  }

  /* ── Desktop: single row ── */
  return (
    <header
      data-testid="header"
      className="relative flex min-h-[72px] items-center gap-5 border-b border-border/80 bg-[linear-gradient(180deg,rgba(255,252,247,0.97),rgba(248,240,229,0.94))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.97),rgba(23,32,46,0.94))] px-4 py-3 shadow-[0_18px_40px_rgba(103,77,44,0.06)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.26)] shrink-0"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(39,87,199,0.3),transparent)]" />
      {/* Left: App Mark + Title */}
      <button
        type="button"
        aria-label="The Stack home"
        className="flex items-center gap-3 mr-4 shrink-0 text-left"
        onClick={() => { onTabChange('Editor'); onHome?.(); }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(145deg,var(--color-accent),color-mix(in_srgb,var(--color-accent)_72%,var(--color-teal)))] shadow-[0_20px_40px_rgba(39,87,199,0.24)] shrink-0">
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="white" />
            <rect x="2" y="5" width="8" height="2" rx=".4" fill="white" fillOpacity=".7" />
            <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="white" fillOpacity=".4" />
          </svg>
        </div>
        <div className="space-y-1">
          <div className="font-display text-[31px] tracking-[-0.05em] leading-none text-ink">The Stack</div>
          <div className="font-mono text-[11px] text-muted tracking-[0.24em] uppercase">
            FORMSPEC {definition.$formspec} · {definition.status || 'DRAFT'}
          </div>
        </div>
      </button>

      {/* Tabs */}
      <nav className="flex h-12 items-end self-stretch" role="tablist" aria-label="Studio workspaces">
        {tabButtons}
      </nav>

      <div className="flex-1 min-w-0" />

      {actionButtons}
    </header>
  );
}
