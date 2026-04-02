/** @filedesc Logic workspace tab composing Variables, Binds, and Shapes sections with a FilterBar. */
import { useState, useMemo } from 'react';
import { normalizeBindsView, buildDefLookup } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { FilterBar } from './FilterBar';
import { HelpTip } from '../../components/ui/HelpTip';
import { VariablesSection } from './VariablesSection';
import { BindsSection } from './BindsSection';
import { ShapesSection } from './ShapesSection';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

/**
 * Visual wrapper for a Logic Pillar (Variables, Binds, Shapes).
 * Adds intentional vertical separation and a subtle left-accent.
 */
function LogicPillar({
  title,
  subtitle,
  helpText,
  children,
  accentColor = "border-accent"
}: {
  title: string;
  subtitle: string;
  helpText: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="mb-12 last:mb-0 group animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-1 h-5 rounded-full ${accentColor}`} />
          <h3 className="font-mono text-[13px] font-bold tracking-[0.2em] uppercase text-ink">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <HelpTip text={helpText}>
            <span className="text-[12px] text-muted italic tracking-tight">{subtitle}</span>
          </HelpTip>
        </div>
      </header>
      <div className="pl-6 border-l border-border/60 ml-0.5 mt-4">
        {children}
      </div>
    </div>
  );
}

export function LogicTab() {
  const definition = useDefinition();
  const { select } = useSelection();
  const [activeFilter, setActiveFilter] = useState<'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly' | 'pre-populate' | null>(null);

  const binds = normalizeBindsView(definition?.binds, definition?.items ?? []);
  const shapes = Array.isArray(definition?.shapes) ? definition.shapes.map((s: any) => ({ name: s.id, ...s })) : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  const memoizedFieldPaths = useMemo(() => {
    if (!definition?.items) return [];
    const lookup = buildDefLookup(definition.items);
    return Array.from(lookup.keys());
  }, [definition?.items]);

  const [sectionFilter, setSectionFilter] = useState<'all' | 'values' | 'behaviors' | 'rules'>('all');

  const showValues = sectionFilter === 'all' || sectionFilter === 'values';
  const showBehaviors = sectionFilter === 'all' || sectionFilter === 'behaviors';
  const showRules = sectionFilter === 'all' || sectionFilter === 'rules';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40">
        <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
          {([
            { id: 'all', label: 'All Logic' },
            { id: 'values', label: 'Values' },
            { id: 'behaviors', label: 'Behaviors' },
            { id: 'rules', label: 'Rules' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionFilter(tab.id)}
              className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-all duration-200 ${
                sectionFilter === tab.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-subtle'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-10">
        {showValues && (
          <LogicPillar
            title="Calculated Values (@)"
            subtitle="Form-level constants and expressions"
            helpText="Global variables and reusable FEL expressions. Reference them anywhere using the @ prefix."
            accentColor="bg-accent"
          >
            <VariablesSection variables={variables} />
          </LogicPillar>
        )}

        {showBehaviors && (
          <LogicPillar
            title="Field Behaviors"
            subtitle="Logic attached to individual inputs"
            helpText="Logic attached to specific fields that controls visibility (relevant), interactivity (readonly), and values (calculate)."
            accentColor="bg-logic"
          >
            <div className="mb-6">
              <FilterBar binds={binds} activeFilter={activeFilter} onFilterSelect={setActiveFilter} />
            </div>
            <BindsSection
              binds={binds}
              activeFilter={activeFilter}
              allPaths={memoizedFieldPaths}
              onSelectPath={(path) => select(path, 'field', { tab: 'editor' })}
            />
          </LogicPillar>
        )}

        {showRules && (
          <LogicPillar
            title="Validation Rules"
            subtitle="Cross-field constraints and alerts"
            helpText="Advanced form-wide constraints that validate relationships between multiple fields or complex data patterns."
            accentColor="bg-error"
          >
            <ShapesSection shapes={shapes} />
          </LogicPillar>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
