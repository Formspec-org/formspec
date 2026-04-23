/** @filedesc Logic workspace tab composing Variables, Binds, and Shapes sections with a FilterBar. */
import { useState, useMemo } from 'react';
import { normalizeBindsView, buildDefLookup } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import type { FormShape } from '@formspec-org/types';
import { FilterBar } from './FilterBar';
import { Pillar } from '../shared/Pillar';
import { SectionFilterBar } from '../shared/SectionFilterBar';
import { VariablesSection } from './VariablesSection';
import { BindsSection } from './BindsSection';
import { ShapesSection } from './ShapesSection';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

export function LogicTab() {
  const definition = useDefinition();
  const { select } = useSelection();
  const [activeFilter, setActiveFilter] = useState<'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly' | 'pre-populate' | null>(null);

  const binds = normalizeBindsView(definition?.binds, definition?.items ?? []);
  const shapes = Array.isArray(definition?.shapes) ? definition.shapes.map((s: FormShape) => ({ name: s.id, ...s })) : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  const memoizedFieldPaths = useMemo(() => {
    if (!definition?.items) return [];
    const lookup = buildDefLookup(definition.items);
    return Array.from(lookup.keys());
  }, [definition?.items]);

  const [sectionFilter, setSectionFilter] = useState<'all' | 'values' | 'behaviors' | 'rules'>('all');

  const logicTabs = [
    { id: 'all' as const, label: 'All Logic' },
    { id: 'values' as const, label: 'Values' },
    { id: 'behaviors' as const, label: 'Behaviors' },
    { id: 'rules' as const, label: 'Rules' },
  ];

  const showValues = sectionFilter === 'all' || sectionFilter === 'values';
  const showBehaviors = sectionFilter === 'all' || sectionFilter === 'behaviors';
  const showRules = sectionFilter === 'all' || sectionFilter === 'rules';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40">
        <SectionFilterBar
          tabs={logicTabs}
          activeTab={sectionFilter}
          onTabChange={setSectionFilter}
          ariaLabel="Logic section filter"
        />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-10">
        {showValues && (
          <Pillar
            title="Calculated Values (@)"
            subtitle="Form-level constants and expressions"
            helpText="Global variables and reusable FEL expressions. Reference them anywhere using the @ prefix."
            accentColor="bg-accent"
          >
            <VariablesSection variables={variables} />
          </Pillar>
        )}

        {showBehaviors && (
          <Pillar
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
          </Pillar>
        )}

        {showRules && (
          <Pillar
            title="Validation Rules"
            subtitle="Cross-field constraints and alerts"
            helpText="Advanced form-wide constraints that validate relationships between multiple fields or complex data patterns."
            accentColor="bg-error"
          >
            <ShapesSection shapes={shapes} />
          </Pillar>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
