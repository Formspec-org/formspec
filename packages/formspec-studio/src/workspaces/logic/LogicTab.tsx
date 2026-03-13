import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { FilterBar } from './FilterBar';
import { HelpTip } from '../../components/ui/HelpTip';
import { VariablesSection } from './VariablesSection';
import { BindsSection } from './BindsSection';
import { ShapesSection } from './ShapesSection';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { LogicEditorDialog } from './LogicEditorDialog';

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
  const [editingLogic, setEditingLogic] = useState<{
    type: 'variable' | 'bind' | 'shape';
    nameOrPath: string;
    bindType?: string;
    expression: string;
  } | null>(null);

  const binds = normalizeBinds(definition?.binds);
  const shapes = Array.isArray(definition?.shapes) ? definition.shapes.map((s: any) => ({ name: s.id, ...s })) : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  const [sectionFilter, setSectionFilter] = useState<'all' | 'values' | 'behaviors' | 'rules'>('all');

  const showValues = sectionFilter === 'all' || sectionFilter === 'values';
  const showBehaviors = sectionFilter === 'all' || sectionFilter === 'behaviors';
  const showRules = sectionFilter === 'all' || sectionFilter === 'rules';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40">
        <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
          {[
            { id: 'all', label: 'All Logic' },
            { id: 'values', label: 'Values' },
            { id: 'behaviors', label: 'Behaviors' },
            { id: 'rules', label: 'Rules' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionFilter(tab.id as any)}
              className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-all duration-200 ${
                sectionFilter === tab.id 
                  ? 'bg-ink text-white shadow-sm' 
                  : 'text-muted hover:text-ink hover:bg-subtle'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-10">
        {variables.length > 0 && showValues && (
          <LogicPillar
            title="Calculated Values (@)"
            subtitle="Form-level constants and expressions"
            helpText="Global variables and reusable FEL expressions. Reference them anywhere using the @ prefix."
            accentColor="bg-accent"
          >
            <VariablesSection 
              variables={variables} 
              onEditVariable={(v) => setEditingLogic({ type: 'variable', nameOrPath: v.name, expression: v.expression })}
            />
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
              onSelectPath={(path) => select(path, 'field')} 
              onEditBind={(path, type, expr) => setEditingLogic({ type: 'bind', nameOrPath: path, bindType: type, expression: expr })}
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
            <ShapesSection 
              shapes={shapes} 
              onEditShape={(s) => setEditingLogic({ 
                type: 'shape', 
                nameOrPath: s.id || s.name, 
                expression: s.constraint ?? '' 
              })}
            />
          </LogicPillar>
        )}
      </WorkspacePageSection>

      <LogicEditorDialog 
        open={!!editingLogic} 
        onClose={() => setEditingLogic(null)} 
        target={editingLogic} 
      />
    </WorkspacePage>
  );
}
