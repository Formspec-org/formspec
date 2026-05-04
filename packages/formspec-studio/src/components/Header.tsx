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
import type { WorkspaceShellTab } from '../studio/workspace-shell-tabs';
import { WORKSPACE_HEADER_TAB_CONFIG } from '../studio/workspace-shell-tabs';

interface HeaderProps {
  activeTab: WorkspaceShellTab;
  onTabChange: (tab: WorkspaceShellTab) => void;
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

    const lastIndex = WORKSPACE_HEADER_TAB_CONFIG.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    const nextTab = WORKSPACE_HEADER_TAB_CONFIG[nextIndex];
    onTabChange(nextTab.name);
    tabRefs.current[nextIndex]?.focus();
  };

  const tabButtons = WORKSPACE_HEADER_TAB_CONFIG.map(({ name, help }, index) => (
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
      className={`relative flex items-center px-4 h-full text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 focus-ring ${
        activeTab === name
          ? 'text-ink'
          : 'text-muted hover:text-ink hover:bg-subtle/50'
      }`}
      onClick={() => onTabChange(name)}
      onKeyDown={(event) => handleTabKeyDown(event, index)}
    >
      {name}
      {activeTab === name && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
      )}
    </button>
  ));

  const profileMenu = (
    <div ref={menuRef} className="relative ml-1 sm:ml-2">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={menuOpen}
        className={`w-8 h-8 rounded border shrink-0 focus-ring ${
          menuOpen ? 'border-accent bg-surface' : 'border-border bg-subtle'
        }`}
        onClick={() => setMenuOpen(!menuOpen)}
      />
      {menuOpen && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
        <div className="right-0 top-full mt-2 w-64 dropdown-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2 text-[13px] font-bold rounded hover:bg-accent/10 hover:text-accent focus-ring"
            onClick={() => { setMenuOpen(false); onNew?.(); }}
          >
            New Form
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="import-btn"
            className="w-full text-left px-4 py-2 text-[13px] font-medium rounded hover:bg-accent/10 hover:text-accent focus-ring"
            onClick={() => { setMenuOpen(false); onImport(); }}
          >
            Import
          </button>
          {onExport && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-2 text-[13px] font-medium rounded hover:bg-accent/10 hover:text-accent focus-ring"
              onClick={() => { setMenuOpen(false); onExport(); }}
            >
              Export
            </button>
          )}
          <div className="border-t border-border/40 my-1" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2 text-[13px] font-medium rounded hover:bg-accent/10 hover:text-accent focus-ring"
            onClick={() => { setMenuOpen(false); onOpenMetadata?.(); }}
          >
            Form Settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2 text-[13px] font-bold rounded hover:bg-accent/10 hover:text-accent focus-ring"
            onClick={() => { setMenuOpen(false); onToggleAccountMenu?.(); }}
          >
            App Settings
          </button>
        </div>
        </>
      )}
    </div>
  );

  const actionButtons = (
    <div
      className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
    >
      {/* Search — icon-only on compact, full bar on wide */}
      {isCompact ? (
        <button
          onClick={onSearch}
          aria-label="Search"
          className="rounded border border-border bg-surface p-1.5 text-muted hover:text-ink focus-ring"
          title="Search (⌘K)"
        >
          <IconSearch size={14} />
        </button>
      ) : (
        <button
          onClick={onSearch}
          className="flex items-center gap-2 rounded border border-border bg-subtle px-2 py-1 text-muted hover:border-accent/40 hover:text-ink focus-ring"
        >
          <IconSearch size={14} />
          <span className="text-[12px] font-medium">Search</span>
          <span className="ml-2 rounded border border-border px-1 font-mono text-[9px] text-muted">⌘K</span>
        </button>
      )}

      {!isCompact && (
        <button
          type="button"
          aria-label={`FORMSPEC ${definition.$formspec} metadata`}
          className="rounded border border-border bg-subtle px-2 py-1 text-[11px] font-medium text-ink hover:border-accent/40 focus-ring"
          onClick={() => onOpenMetadata?.()}
        >
          Metadata
        </button>
      )}
      
      <div className="flex items-center gap-0.5 rounded border border-border bg-subtle p-0.5">
        <button
          data-testid="undo-btn"
          aria-label="Undo"
          disabled={!project.canUndo}
          className="rounded p-1 text-muted hover:text-ink disabled:opacity-30 focus-ring"
          onClick={() => project.undo()}
          title="Undo (⌘Z)"
        >
          <IconUndo size={14} />
        </button>
        <button
          data-testid="redo-btn"
          aria-label="Redo"
          disabled={!project.canRedo}
          className="rounded p-1 text-muted hover:text-ink disabled:opacity-30 focus-ring"
          onClick={() => project.redo()}
          title="Redo (⌘⇧Z)"
        >
          <IconRedo size={14} />
        </button>
      </div>

      {assistantMenu && <AssistantEntryMenu {...assistantMenu} />}

      {onSwitchToAssistant && (
        <button
          type="button"
          data-testid="toggle-to-assistant"
          onClick={() => onSwitchToAssistant()}
          className="shrink-0 rounded-sm bg-accent px-3 py-1 text-[9px] font-bold uppercase text-surface hover:bg-accent/90 shadow-sm"
        >
          Ask AI
        </button>
      )}

      {colorScheme && (
        <button
          type="button"
          aria-label={`Switch to ${nextTheme(colorScheme.theme)} theme`}
          title={`Theme: ${colorScheme.theme}`}
          className="rounded border border-transparent p-1.5 text-muted hover:border-border hover:text-ink focus-ring"
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
        <div className="flex min-h-[44px] items-center gap-3 px-3">
          {onToggleMenu && (
            <button
              type="button"
              aria-label="Toggle blueprint menu"
              className="rounded border border-border bg-surface p-1.5 -ml-1 hover:bg-subtle focus-ring"
              onClick={onToggleMenu}
            >
              <IconMenu size={14} />
            </button>
          )}
          <button
            type="button"
            aria-label="The Stack home"
            className="flex items-center gap-2 shrink-0 text-left"
            onClick={() => { onTabChange('Editor'); onHome?.(); }}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-surface" aria-hidden="true">
              <IconStack size={12} className="text-surface" />
            </div>
            <div className="flex flex-col">
              <div className="text-[13px] font-bold tracking-tight text-ink">The Stack</div>
              <div className="text-[9px] font-bold text-muted uppercase">
                <>{formTitle.length > 20 ? formTitle.slice(0, 17) + '...' : formTitle} · {definition.status || 'DRAFT'}</>
              </div>
            </div>
          </button>
          <div className="flex-1" />
          {actionButtons}
        </div>

        {/* Row 2: Mode toggle + workspace tabs (advanced workspaces stay reachable). */}
        {mode && onModeChange ? (
          <div className="flex h-[36px] min-w-0 items-center gap-2 border-t border-border px-2">
            <ModeToggle mode={mode} onModeChange={onModeChange} compact />
            <nav className="flex min-h-0 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Studio workspaces">
              {tabButtons}
            </nav>
          </div>
        ) : (
          <nav className="flex h-[36px] overflow-x-auto scrollbar-none border-t border-border px-3" role="tablist" aria-label="Studio workspaces">
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
      className="sticky top-0 z-40 flex min-h-[48px] shrink-0 items-center gap-6 px-4 bg-surface border-b border-border"
    >
      {/* Left: App Mark + Title */}
      <button
        type="button"
        aria-label="The Stack home"
        className="group flex items-center gap-3 mr-4 shrink-0 text-left focus-ring"
        onClick={() => { onTabChange('Editor'); onHome?.(); }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-surface shadow-sm group-hover:bg-accent/90" aria-hidden="true">
          <IconStack size={12} className="text-surface" />
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] font-bold tracking-tight text-ink group-hover:text-accent">The Stack</div>
          <div className="text-[9px] font-bold text-muted uppercase">
            <>{formTitle} · {definition.status || 'DRAFT'}</>
          </div>
        </div>
      </button>

      {/* Mode toggle + workspace tabs — Evidence/Mapping stay in the header beside primary modes. */}
      {mode && onModeChange ? (
        <div className="flex min-h-10 min-w-0 max-w-[min(100%,52rem)] flex-1 items-end gap-3 self-stretch">
          <div className="shrink-0">
            <ModeToggle mode={mode} onModeChange={onModeChange} />
          </div>
          <nav className="flex min-h-0 min-w-0 flex-1 items-end gap-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Studio workspaces">
            {tabButtons}
          </nav>
        </div>
      ) : (
        <nav className="flex h-10 items-end self-stretch gap-1" role="tablist" aria-label="Studio workspaces">
          {tabButtons}
        </nav>
      )}

      <div className="flex-1 min-w-0" />

      {actionButtons}
    </header>
  );
}

