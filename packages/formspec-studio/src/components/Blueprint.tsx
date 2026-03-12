import { useProjectState } from '../state/useProjectState';
import { Pill } from './ui/Pill';

interface BlueprintProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface SectionDef {
  name: string;
  countFn: ((state: ReturnType<typeof useProjectState>) => number) | null;
}

function countComponentNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const record = node as { children?: unknown[] };
  return 1 + (record.children?.reduce((sum, child) => sum + countComponentNodes(child), 0) ?? 0);
}

const SECTIONS: SectionDef[] = [
  { name: 'Structure', countFn: (s) => s.definition.items?.length ?? 0 },
  { name: 'Component Tree', countFn: (s) => countComponentNodes(s.component?.tree) },
  { name: 'Theme', countFn: (s) => Object.keys(s.theme.tokens ?? {}).length },
  { name: 'Screener', countFn: null },
  { name: 'Variables', countFn: (s) => s.definition.variables?.length ?? 0 },
  { name: 'Data Sources', countFn: (s) => Object.keys(s.definition.instances ?? {}).length },
  { name: 'Option Sets', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length },
  { name: 'Mappings', countFn: (s) => (s.mapping.rules as unknown[] | undefined)?.length ?? 0 },
  { name: 'Migrations', countFn: null },
  { name: 'Settings', countFn: null },
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
          {SECTIONS.map(({ name, countFn }) => {
            const isActive = activeSection === name;
            const count = countFn ? countFn(state) : null;
            const hasData = count !== null && count > 0;

            return (
              <button
                key={name}
                data-testid={`blueprint-section-${name}`}
                className={`flex items-center justify-between px-2 py-1 text-[12.5px] text-left transition-all rounded-[3px] cursor-pointer group ${
                  isActive
                    ? 'bg-subtle text-ink font-semibold'
                    : 'text-muted hover:text-ink hover:bg-subtle/60'
                }`}
                onClick={() => onSectionChange(name)}
              >
                <span className="truncate">{name}</span>
                {count !== null && hasData && <span aria-hidden="true"> </span>}
                {count !== null && hasData && (
                  <span className={`font-mono text-[11px] tabular-nums shrink-0 px-1 rounded-[2px] transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent/80'
                      : 'bg-border text-muted/70'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
