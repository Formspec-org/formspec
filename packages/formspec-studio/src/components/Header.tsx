/** @filedesc Top navigation header with mode toggle or workspace tab bar and actions (new, import, export, search). */
import { useState, useRef, useEffect } from 'react';
import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';
import { type ColorScheme, type ThemePreference } from '../hooks/useColorScheme';
import {
  IconMonitor,
  IconMoon,
  IconSun,
  IconSearch,
  IconUndo,
  IconRedo,
  IconMenu,
  IconStack,
} from './icons';
import { AssistantEntryMenu, type AssistantEntryMenuProps } from './AssistantEntryMenu';
import { ModeToggle } from './ModeToggle';
import type { StudioMode } from '../studio-app/ModeProvider';

const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Build your form structure and manage shared resources' },
  { name: 'Design', help: 'Visual brand, layout regions, and style controls' },
  { name: 'Evidence', help: 'Review source documents, citations, missing coverage, and conflicts' },
  { name: 'Mapping', help: 'Bidirectional data transforms for import/export formats' },
  { name: 'Preview', help: 'Live form preview, behavior lab, and JSON document view' },
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

  /** In-shell chat control (dock/hide assistant panel within workspace). */
  assistantMenu?: AssistantEntryMenuProps | null;
  /** Switches from workspace to full assistant surface. */
  onSwitchToAssistant?: (() => void) | null;
  isCompact?: boolean;
  colorScheme?: ColorScheme;
  /** When provided, renders ModeToggle instead of workspace tabs. */
  mode?: StudioMode;
  onModeChange?: (mode: StudioMode) => void;
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
    return <IconMonitor />;
  }
  if (resolved === 'dark') {
    return <IconMoon />;
  }
  return <IconSun />;
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

  assistantMenu,
  onSwitchToAssistant,
  isCompact = false,
  colorScheme,
  mode,
  onModeChange,
}: HeaderProps) {
  const project = useProject();
  const state = useProjectState();
  const { definition } = state;
  const formTitle = definition.title?.trim() ? definition.title.trim() : 'Untitled form';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
      className={`flex items-center px-4 sm:px-5 h-full text-[14px] transition-all border-b-2 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset ${
        activeTab === name
          ? 'border-accent text-ink font-semibold'
          : 'border-transparent text-muted hover:text-ink hover:bg-subtle/50'
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
        aria-label="Open account menu"
        aria-expanded={menuOpen}
        className={`w-7 h-7 rounded-full bg-[#E2D9CF] border-2 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          menuOpen ? 'border-accent' : 'border-border hover:border-muted/40'
        }`}
        onClick={() => setMenuOpen(!menuOpen)}
      />
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-[6px] shadow-lg py-1 z-50" role="menu" aria-label="Account actions">
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset"
            onClick={() => { setMenuOpen(false); onNew?.(); }}
          >
            New Form
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="import-btn"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset"
            onClick={() => { setMenuOpen(false); onImport(); }}
          >
            Import
          </button>
          {onExport && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset"
              onClick={() => { setMenuOpen(false); onExport(); }}
            >
              Export
            </button>
          )}
          <div className="border-t border-border my-1" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset"
            onClick={() => { setMenuOpen(false); onOpenMetadata?.(); }}
          >
            Form Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset"
            onClick={() => { setMenuOpen(false); onToggleAccountMenu?.(); }}
          >
            App Settings
          </button>
        </div>
      )}
    </div>
  );

  const actionButtons = (
    <div
      className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2"
    >
      {/* Search — icon-only on compact, full bar on wide */}
      {isCompact ? (
        <button
          onClick={onSearch}
          aria-label="Search"
          className="rounded-full border border-border/65 bg-surface/70 p-2 text-muted hover:bg-surface hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          title="Search (⌘K)"
        >
          <IconSearch />
        </button>
      ) : (
        <button
          onClick={onSearch}
          className="group flex max-w-[220px] items-center gap-2 rounded-full border border-border/55 bg-subtle/40 px-4 py-2 text-muted hover:border-border/80 hover:bg-subtle/60 hover:text-ink transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        >
          <IconSearch size={14} />
          <span className="text-[14px] font-ui">Search…</span>
          <span className="ml-auto rounded-md border border-border/50 px-1.5 py-0.5 font-mono text-[11px] text-muted group-hover:text-ink/80 transition-colors">
            ⌘K
          </span>
        </button>
      )}

      {!isCompact && (
        <button
          type="button"
          aria-label={`FORMSPEC ${definition.$formspec} metadata`}
          className="rounded-full border border-border/60 bg-subtle/30 px-4 py-2 text-[13px] font-medium text-ink hover:bg-subtle/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={() => onOpenMetadata?.()}
        >
          Metadata
        </button>
      )}
      
      <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-subtle/30 p-0.5">
        <button
          data-testid="undo-btn"
          aria-label="Undo"
          disabled={!project.canUndo}
          className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink disabled:opacity-20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={() => project.undo()}
          title="Undo (⌘Z)"
        >
          <IconUndo size={16} />
        </button>
        <button
          data-testid="redo-btn"
          aria-label="Redo"
          disabled={!project.canRedo}
          className="rounded-full p-2 text-muted hover:bg-surface hover:text-ink disabled:opacity-20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={() => project.redo()}
          title="Redo (⌘⇧Z)"
        >
          <IconRedo size={16} />
        </button>
      </div>

      {assistantMenu && <AssistantEntryMenu {...assistantMenu} />}

      {onSwitchToAssistant && (
        <button
          type="button"
          data-testid="toggle-to-assistant"
          className={`shrink-0 rounded-full border border-accent/25 bg-accent/10 font-semibold text-accent hover:bg-accent/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
            isCompact ? 'p-2' : 'px-3 py-1.5 text-[12px]'
          }`}
          onClick={onSwitchToAssistant}
          aria-label="Switch to AI authoring"
        >
          Ask AI
        </button>
      )}

      {colorScheme && (
        <button
          type="button"
          aria-label={`Switch to ${nextTheme(colorScheme.theme)} theme`}
          title={`Theme: ${colorScheme.theme} (click to switch to ${nextTheme(colorScheme.theme)})`}
          className="rounded-full border border-transparent p-2 text-muted hover:border-border/60 hover:bg-surface/75 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
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
      <div data-testid="header" className="shrink-0 border-b border-border bg-surface">
        {/* Row 1: Logo + Title + Actions */}
        <div className="flex min-h-[56px] items-center gap-3 px-3">
          {onToggleMenu && (
            <button
              type="button"
              aria-label="Toggle blueprint menu"
              className="rounded-full border border-border/60 bg-surface/75 p-2 -ml-1.5 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={onToggleMenu}
            >
              <IconMenu />
            </button>
          )}
          <button
            type="button"
            aria-label="The Stack home"
            className="flex items-center gap-2.5 shrink-0 text-left"
            onClick={() => { onTabChange('Editor'); onHome?.(); }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-surface" aria-hidden="true">
              <IconStack size={11} className="text-surface" />
            </div>
            <div>
              <div className="font-display text-[22px] tracking-[-0.04em] leading-none whitespace-nowrap text-ink">The Stack</div>
            <div className="font-ui text-[11px] text-muted/80 tracking-wider uppercase whitespace-nowrap">
                <>{formTitle} · FORMSPEC {definition.$formspec} · {definition.status || 'DRAFT'}</>
              </div>
            </div>
          </button>
          <div className="flex-1" />
          {actionButtons}
        </div>

        {/* Row 2: Mode toggle or workspace tabs */}
        {mode && onModeChange ? (
          <div className="flex h-[42px] items-center justify-center border-t border-border/40 px-3">
            <ModeToggle mode={mode} onModeChange={onModeChange} compact />
          </div>
        ) : (
          <nav className="flex h-[42px] overflow-x-auto scrollbar-none border-t border-border/40 px-3" role="tablist" aria-label="Studio workspaces">
            {tabButtons}
          </nav>
        )}
      </div>
    );
  }

  /* ── Desktop: single row ── */
  return (
    <header
      data-testid="header"
      className="glass sticky top-0 z-40 flex min-h-[72px] shrink-0 items-center gap-5 px-6 py-3 transition-all duration-300 shadow-premium"
    >
      {/* Left: App Mark + Title */}
      <button
        type="button"
        aria-label="The Stack home"
        className="group flex items-center gap-3.5 mr-6 shrink-0 text-left focus-visible:outline-none"
        onClick={() => { onTabChange('Editor'); onHome?.(); }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent text-surface shadow-md group-hover:scale-105 group-hover:rotate-3 transition-all duration-300" aria-hidden="true">
          <IconStack size={18} className="text-surface" />
        </div>
        <div className="space-y-0.5">
          <div className="font-display text-[32px] tracking-[-0.06em] leading-none text-ink group-hover:text-accent transition-colors duration-300">The Stack</div>
          <div className="font-ui text-[10px] font-medium text-muted/70 tracking-[0.1em] uppercase">
            <>{formTitle} · {definition.status || 'DRAFT'}</>
          </div>
        </div>
      </button>

      {/* Mode toggle or workspace tabs */}
      {mode && onModeChange ? (
        <div className="flex h-12 items-center">
          <ModeToggle mode={mode} onModeChange={onModeChange} />
        </div>
      ) : (
        <nav className="flex h-12 items-end self-stretch" role="tablist" aria-label="Studio workspaces">
          {tabButtons}
        </nav>
      )}

      <div className="flex-1 min-w-0" />

      {actionButtons}
    </header>
  );
}

