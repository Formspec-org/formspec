/** @filedesc Blueprint sidebar showing all project sections (structure, theme, screener, etc.) with counts. */
import { useEffect } from 'react';
import { useProjectState } from '../state/useProjectState';
import { useProject } from '../state/useProject';
import type { EditorView } from '../workspaces/editor/BuildManageToggle';
import { addStudioEventListener, dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';
import type { FormScreenerPhase, ThemeDocument } from '@formspec-org/types';
import type { CompNode } from '@formspec-org/studio-core';

interface BlueprintProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  sections?: readonly string[];
  activeEditorView?: EditorView;
  activeTab?: string;
}

interface SectionDef {
  name: string;
  label?: string;
  countFn: ((state: ReturnType<typeof useProjectState>) => number) | null;
  help: string;
  link?: { tab: string; subTab?: string; view?: string; section?: string };
}

function countComponentNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const record = node as { children?: unknown[] };
  return 1 + (record.children?.reduce<number>((sum, child) => sum + countComponentNodes(child), 0) ?? 0);
}

const SECTIONS: SectionDef[] = [
  { name: 'Structure', countFn: (s) => s.definition.items?.length ?? 0, help: 'Item tree defining fields, groups, and display elements' },
  {
    name: 'Component Tree',
    countFn: null, // computed from authored component below
    help: 'UI component hierarchy generated from the item tree',
  },
  { name: 'Theme', countFn: (s) => Object.keys(s.theme.tokens ?? {}).length, help: 'Visual tokens, selectors, and presentation defaults', link: { tab: 'Layout', section: 'Colors' } },
  { name: 'Screener', countFn: (s) => {
    const scr = s.screener;
    if (!scr) return 0;
    const routes = scr.evaluation?.reduce((sum: number, p: FormScreenerPhase) => sum + (p.routes?.length ?? 0), 0) ?? 0;
    return (scr.items?.length ?? 0) + routes;
  }, help: 'Pre-qualification gate before the main form', link: { tab: 'Editor', view: 'screener' } },
  { name: 'Variables', label: 'Calculations', countFn: (s) => s.definition.variables?.length ?? 0, help: 'Named computed values reusable across expressions', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Data Sources', label: 'External data', countFn: (s) => Object.keys(s.definition.instances ?? {}).length, help: 'Secondary data instances for lookups and reference data', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Option Sets', label: 'Reusable choices', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length, help: 'Reusable option lists for choice and multiChoice fields', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Mappings', label: 'Field mappings', countFn: (s) => Object.values(s.mappings ?? {}).reduce((sum, m) => sum + (m.rules?.length ?? 0), 0), help: 'Bidirectional data transforms for import/export', link: { tab: 'Mapping', subTab: 'all' } },
  { name: 'Settings', countFn: null, help: 'Form identity, presentation, and behavioral defaults' },
  // Theme-mode sidebar sections (shown in Layout workspace Theme mode)
  { name: 'Colors', countFn: (s) => Object.keys(s.theme.tokens ?? {}).length, help: 'Color tokens and brand palette' },
  { name: 'Typography', countFn: null, help: 'Typography and spacing tokens' },
  { name: 'Field Defaults', countFn: null, help: 'Default label position, widget, and CSS class for all fields' },
  { name: 'Field Rules', countFn: (s) => ((s.theme.selectors ?? []) as unknown[]).length, help: 'Selector rules for field-type-specific presentation' },
  { name: 'Breakpoints', countFn: (s) => Object.keys((s.theme as ThemeDocument).breakpoints ?? {}).length, help: 'Responsive breakpoint definitions' },
  { name: 'All Tokens', countFn: null, help: 'Full token reference for the active theme' },
];

/**
 * Blueprint sidebar navigation.
 * Lists all functional areas of the project with entity counts.
 */
export function Blueprint({ activeSection, onSectionChange, sections, activeEditorView, activeTab }: BlueprintProps) {
  const state = useProjectState();
  const project = useProject();
  const componentTreeCount = countComponentNodes(project.component.tree as CompNode | undefined);
  const visibleSections = sections ? new Set(sections) : null;

  /** Scrolls the blueprint nav when {@link STUDIO_EVENTS.SCROLL_TO_SECTION} fires (e.g. after navigate-workspace with section). */
  useEffect(() => {
    return addStudioEventListener(STUDIO_EVENTS.SCROLL_TO_SECTION, (e) => {
      const { section } = e.detail;
      if (typeof section !== 'string' || !section.trim()) return;
      const testId = `blueprint-section-${section}`;
      const el = document.querySelector(`[data-testid=${JSON.stringify(testId)}]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  return (
    <div className="flex flex-col shrink-0">
      <div className="px-3 pt-6 pb-4">
        <h2 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-normal text-muted">
          Blueprint
        </h2>
 
        <nav
          data-testid="blueprint"
          aria-label="Blueprint sections"
          className="flex flex-col gap-1.5"
        >
          {SECTIONS.filter(({ name }) => (!visibleSections || visibleSections.has(name)) && !['Mappings', 'Evidence', 'Screener'].includes(name)).map(({ name, label, countFn, help, link }) => {
             return renderSection(name, label, countFn, help, link);
          })}
        </nav>
 
        {/* Advanced Section */}
        {(!visibleSections || ['Mappings', 'Evidence', 'Screener'].some(s => visibleSections.has(s))) && (
          <div className="mt-6 pt-4 border-t border-border/10">
            <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-normal text-muted">
              Advanced
            </h3>
            <nav className="flex flex-col gap-1.5">
              {SECTIONS.filter(({ name }) => ['Mappings', 'Evidence', 'Screener'].includes(name) && (!visibleSections || visibleSections.has(name))).map(({ name, label, countFn, help, link }) => {
                return renderSection(name, label, countFn, help, link);
              })}
            </nav>
          </div>
        )}
      </div>
    </div>

  );

  function renderSection(name: string, label: string | undefined, countFn: any, help: string, link: any) {
    const isActive = activeSection === name;
    const count = name === 'Component Tree' ? componentTreeCount : countFn ? countFn(state) : null;
    const hasData = count !== null && count > 0;

    return (
      <div
        key={name}
        data-testid={`blueprint-section-${name}`}
        title={help}
        className={`group relative flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-left transition-all duration-200 focus-within:ring-2 focus-within:ring-accent/20 ${
          isActive
            ? 'bg-accent/5 text-ink font-semibold'
            : 'text-muted hover:text-ink hover:bg-subtle'
        }`}
      >
        {isActive && (
          <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent" />
        )}
        <button
          aria-current={isActive ? 'page' : undefined}
          className="min-w-0 flex-1 truncate rounded-[8px] text-left cursor-pointer focus-ring"
          onClick={() => {
            onSectionChange(name);
            if (link?.view && activeTab === 'Editor' && activeEditorView !== link.view) {
              dispatchStudioEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, link);
            }
          }}
        >
          {label ?? name}
        </button>
        <div className="flex items-center gap-2.5 shrink-0">
          {name === 'Settings' && (
            <button
              type="button"
              data-testid="settings-edit-btn"
              aria-label="Edit settings"
              className="rounded-md p-1.5 shrink-0 text-muted transition-colors hover:text-accent focus-ring"
              onClick={(e) => {
                e.stopPropagation();
                dispatchStudioEvent(STUDIO_EVENTS.OPEN_SETTINGS);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
          )}
          {link && !(activeTab === 'Editor' && link.tab === 'Editor' && link.view && activeEditorView === link.view) && (
            <button
              type="button"
                aria-label={`Open ${name} tab`}
              className="rounded-md p-1.5 shrink-0 opacity-0 text-muted transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-accent focus-visible:opacity-100 focus-ring"
              onClick={(e) => {
                e.stopPropagation();
                dispatchStudioEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, link);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" /><path d="M7 7h10v10" />
              </svg>
            </button>
          )}
          {count !== null && hasData && (
            <span className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums transition-all duration-200 ${
              isActive
                ? 'bg-accent text-surface'
                : 'bg-border/40 text-muted group-hover:bg-border group-hover:text-ink'
            }`}>
              {count}
            </span>
          )}
        </div>
      </div>
    );
  }
}

