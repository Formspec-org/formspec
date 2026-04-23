/** @filedesc Blueprint sidebar showing all project sections (structure, theme, screener, etc.) with counts. */
import { useProjectState } from '../state/useProjectState';
import { useProject } from '../state/useProject';
import { Pill } from './ui/Pill';
import type { EditorView } from '../workspaces/editor/BuildManageToggle';
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
  { name: 'Variables', countFn: (s) => s.definition.variables?.length ?? 0, help: 'Named computed values reusable across expressions', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Data Sources', countFn: (s) => Object.keys(s.definition.instances ?? {}).length, help: 'Secondary data instances for lookups and reference data', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Option Sets', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length, help: 'Reusable option lists for choice and multiChoice fields', link: { tab: 'Editor', view: 'manage' } },
  { name: 'Mappings', countFn: (s) => Object.values(s.mappings ?? {}).reduce((sum, m) => sum + (m.rules?.length ?? 0), 0), help: 'Bidirectional data transforms for import/export', link: { tab: 'Mapping', subTab: 'rules' } },
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

  return (
    <div className="flex flex-col shrink-0">
      <div className="border-b border-border/70 px-3 pt-4 pb-3">
        <h2 className="mb-3 px-1 text-[11px] font-mono font-semibold tracking-[0.18em] uppercase text-muted/75">
          Blueprint
        </h2>

        <nav
          data-testid="blueprint"
          aria-label="Blueprint sections"
          className="flex flex-col gap-0.5"
        >
          {SECTIONS.filter(({ name }) => !visibleSections || visibleSections.has(name)).map(({ name, countFn, help, link }) => {
            const isActive = activeSection === name;
            const count = name === 'Component Tree' ? componentTreeCount : countFn ? countFn(state) : null;
            const hasData = count !== null && count > 0;

            return (
              <div
                key={name}
                data-testid={`blueprint-section-${name}`}
                title={help}
                className={`group flex items-center justify-between rounded-[10px] px-2 py-2 text-[12.5px] text-left transition-colors focus-within:ring-2 focus-within:ring-accent/35 focus-within:ring-offset-2 focus-within:ring-offset-surface ${
                  isActive
                    ? 'bg-bg-default/90 text-ink shadow-[inset_0_0_0_1px_rgba(90,76,56,0.08)]'
                    : 'text-muted hover:text-ink hover:bg-bg-default/50'
                }`}
              >
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className="min-w-0 flex-1 truncate rounded-[6px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={() => {
                    onSectionChange(name);
                    // Auto-switch editor view when clicking a section with a different view target
                    if (link?.view && activeTab === 'Editor' && activeEditorView !== link.view) {
                      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: link }));
                    }
                  }}
                >
                  {name}
                </button>
                {name === 'Settings' && (
                  <button
                    type="button"
                    data-testid="settings-edit-btn"
                    aria-label="Edit settings"
                    className="rounded p-0.5 shrink-0 text-muted/40 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('formspec:open-settings'));
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                )}
                {link && !(activeTab === 'Editor' && link.tab === 'Editor' && link.view && activeEditorView === link.view) && (
                  <button
                    type="button"
                    aria-label={`Open ${name} tab`}
                    className="rounded p-0.5 shrink-0 opacity-0 text-muted/40 transition-colors group-hover:opacity-100 group-focus-within:opacity-100 hover:text-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: link }));
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17 17 7" /><path d="M7 7h10v10" />
                    </svg>
                  </button>
                )}
                {count !== null && hasData && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent/80'
                      : 'bg-border/55 text-muted/78'
                  }`}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
