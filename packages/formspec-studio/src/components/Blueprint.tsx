import { useProjectState } from '../state/useProjectState';

interface BlueprintProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface SectionDef {
  name: string;
  countFn: ((state: ReturnType<typeof useProjectState>) => number) | null;
}

const SECTIONS: SectionDef[] = [
  { name: 'Structure', countFn: (s) => s.definition.items?.length ?? 0 },
  { name: 'Component Tree', countFn: () => 0 },
  { name: 'Theme', countFn: (s) => Object.keys(s.theme.tokens ?? {}).length },
  { name: 'Screener', countFn: null },
  { name: 'Variables', countFn: (s) => s.definition.variables?.length ?? 0 },
  { name: 'Data Sources', countFn: (s) => Object.keys(s.definition.instances ?? {}).length },
  { name: 'Option Sets', countFn: (s) => Object.keys(s.definition.optionSets ?? {}).length },
  { name: 'Mappings', countFn: (s) => (s.mapping.rules as unknown[] | undefined)?.length ?? 0 },
  { name: 'Migrations', countFn: null },
  { name: 'FEL Reference', countFn: null },
  { name: 'Settings', countFn: null },
];

export function Blueprint({ activeSection, onSectionChange }: BlueprintProps) {
  const state = useProjectState();

  return (
    <nav className="flex flex-col py-2">
      {SECTIONS.map(({ name, countFn }) => {
        const isActive = activeSection === name;
        const count = countFn ? countFn(state) : null;

        return (
          <button
            key={name}
            data-testid={`blueprint-section-${name}`}
            className={`flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
              isActive
                ? 'bg-accent text-on-accent font-medium'
                : 'text-muted hover:text-ink hover:bg-surface-hover'
            }`}
            onClick={() => onSectionChange(name)}
          >
            <span>{name}</span>
            {count !== null && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-on-accent/20 text-on-accent' : 'bg-border text-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
