import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { Section } from '../../components/ui/Section';
import { FilterBar } from './FilterBar';
import { VariablesSection } from './VariablesSection';
import { BindsSection } from './BindsSection';
import { ShapesSection } from './ShapesSection';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

function normalizeBinds(binds: unknown): Record<string, Record<string, string>> {
  if (!binds) return {};
  if (typeof binds === 'object' && !Array.isArray(binds)) {
    return binds as Record<string, Record<string, string>>;
  }
  // Array form: convert to object keyed by path
  if (Array.isArray(binds)) {
    const result: Record<string, Record<string, string>> = {};
    for (const bind of binds) {
      if (bind && typeof bind === 'object' && bind.path) {
        const { path, ...rest } = bind;
        result[path] = rest;
      }
    }
    return result;
  }
  return {};
}

export function LogicTab() {
  const definition = useDefinition();
  const { select } = useSelection();
  const [activeFilter, setActiveFilter] = useState<'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly' | null>(null);

  const binds = normalizeBinds(definition?.binds);
  const shapes = Array.isArray(definition?.shapes) ? definition.shapes.map((s: any) => ({ name: s.id, ...s })) : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-0" className="sticky top-0 bg-bg-default z-10 border-b border-border">
        <FilterBar binds={binds} activeFilter={activeFilter} onFilterSelect={setActiveFilter} />
      </WorkspacePageSection>
      <WorkspacePageSection className="flex-1 py-4">
        {variables.length > 0 && (
          <Section title="Variables">
            <VariablesSection variables={variables} />
          </Section>
        )}
        <Section title="Binds">
          <BindsSection binds={binds} activeFilter={activeFilter} onSelectPath={(path) => select(path, 'field')} />
        </Section>
        <Section title="Shapes">
          <ShapesSection shapes={shapes} />
        </Section>
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
