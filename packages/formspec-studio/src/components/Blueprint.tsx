/** @filedesc Blueprint sidebar showing all project sections (structure, theme, screener, etc.) with counts. */
import { useProjectState } from '../state/useProjectState';
import { Pill } from './ui/Pill';

interface BlueprintProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface SectionDef {
  name: string;
  countFn: ((state: ReturnType<typeof useProjectState>) => number) | null;
  help: string;
  link?: { tab: string; subTab?: string };
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
    countFn: (s) => countComponentNodes(s.component?.tree ?? s.generatedComponent?.tree),
    help: 'UI component hierarchy generated from the item tree',
  },
  { name: 'Theme', countFn: (s) => Object.keys(s.theme.tokens ?? {}).length, help: 'Visual tokens, selectors, and presentation defaults', link: { tab: 'Theme', subTab: 'tokens' } },
  { name: 'Screener', countFn: null, help: 'Pre-qualification gate before the main form' },
  { name: 'Variables', countFn: (s) => s.definition.variables?.length ?? 0, help: 'Named computed values reusable across expressions', link: { tab: 'Logic' } },
  { name: 'Data Sources', countFn: (s) => Object.keys(s.definition.instances ?? {}).length, help: 'Secondary data instances for lookups and reference data', link: { tab: 'Data', subTab: 'Data Sources' } },
  { name: 'Option Sets', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length, help: 'Reusable option lists for choice and multiChoice fields', link: { tab: 'Data', subTab: 'Option Sets' } },
  { name: 'Mappings', countFn: (s) => (s.mapping.rules as unknown[] | undefined)?.length ?? 0, help: 'Bidirectional data transforms for import/export', link: { tab: 'Mapping', subTab: 'rules' } },
  { name: 'Settings', countFn: null, help: 'Form identity, presentation, and behavioral defaults' },
];

/**
 * Blueprint sidebar navigation.
 * Lists all functional areas of the project with entity counts.
 */
export function Blueprint({ activeSection, onSectionChange }: BlueprintProps) {
  const state = useProjectState();

  return (
    <div className="flex flex-col shrink-0">
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <h2 className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-muted/70 mb-1.5 px-1">
          Blueprint
        </h2>
        
        <nav data-testid="blueprint" className="flex flex-col gap-px">
          {SECTIONS.map(({ name, countFn, help, link }) => {
            const isActive = activeSection === name;
            const count = countFn ? countFn(state) : null;
            const hasData = count !== null && count > 0;

            return (
              <div
                key={name}
                data-testid={`blueprint-section-${name}`}
                title={help}
                className={`flex items-center justify-between px-2 py-1 text-[12.5px] text-left transition-all rounded-[3px] group ${
                  isActive
                    ? 'bg-subtle text-ink font-semibold'
                    : 'text-muted hover:text-ink hover:bg-subtle/60'
                }`}
              >
                <button
                  className="flex-1 truncate text-left cursor-pointer"
                  onClick={() => onSectionChange(name)}
                >
                  {name}
                </button>
                {name === 'Settings' && (
                  <button
                    type="button"
                    data-testid="settings-edit-btn"
                    aria-label="Edit settings"
                    className="p-0.5 rounded shrink-0 text-muted/40 hover:text-accent transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('formspec:open-settings'));
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
                )}
                {link && (
                  <button
                    type="button"
                    aria-label={`Open ${name} tab`}
                    className="p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100 text-muted/40 hover:text-accent transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: link }));
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17 17 7" /><path d="M7 7h10v10" />
                    </svg>
                  </button>
                )}
                {count !== null && hasData && (
                  <span className={`font-mono text-[11px] tabular-nums shrink-0 px-1 rounded-[2px] transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent/80'
                      : 'bg-border text-muted/70'
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
