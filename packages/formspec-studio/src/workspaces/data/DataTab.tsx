/** @filedesc Data workspace tab composing ResponseSchema, DataSources, OptionSets, and TestResponse panels. */
import { useState } from 'react';
import { ResponseSchema } from './ResponseSchema';
import { DataSources } from './DataSources';
import { OptionSets } from './OptionSets';
import { TestResponse } from './TestResponse';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { HelpTip } from '../../components/ui/HelpTip';

/**
 * Visual wrapper for a Data Pillar.
 */
function DataPillar({ 
  title, 
  subtitle, 
  helpText, 
  children, 
  accentColor = "bg-accent" 
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

const sectionTabs = [
  { id: 'all', label: 'All Data' },
  { id: 'structure', label: 'Structure' },
  { id: 'tables', label: 'Tables' },
  { id: 'sources', label: 'Sources' },
  { id: 'simulation', label: 'Simulation' },
] as const;

export type DataSectionFilter = typeof sectionTabs[number]['id'];

interface DataTabProps {
  sectionFilter?: DataSectionFilter;
  onSectionFilterChange?: (filter: DataSectionFilter) => void;
}

export function DataTab({ sectionFilter: controlledFilter, onSectionFilterChange }: DataTabProps = {}) {
  const [internalFilter, setInternalFilter] = useState<DataSectionFilter>('all');
  const sectionFilter = controlledFilter ?? internalFilter;
  const setSectionFilter = (filter: DataSectionFilter) => {
    setInternalFilter(filter);
    onSectionFilterChange?.(filter);
  };

  const showStructure = sectionFilter === 'all' || sectionFilter === 'structure';
  const showTables = sectionFilter === 'all' || sectionFilter === 'tables';
  const showSources = sectionFilter === 'all' || sectionFilter === 'sources';
  const showSimulation = sectionFilter === 'all' || sectionFilter === 'simulation';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40">
        <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
          {sectionTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionFilter(tab.id)}
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
        {showStructure && (
          <DataPillar
            title="Submission Structure"
            subtitle="The shape of the form's final output"
            helpText="This is the JSON document structure that will be generated and submitted when the form is completed."
            accentColor="bg-accent"
          >
            <ResponseSchema />
          </DataPillar>
        )}

        {showTables && (
          <DataPillar
            title="Lookup Tables"
            subtitle="Shared lists of choices and options"
            helpText="Reusable lists of options that multiple fields can reference (Option Sets)."
            accentColor="bg-logic"
          >
            <OptionSets />
          </DataPillar>
        )}

        {showSources && (
          <DataPillar
            title="External Sources"
            subtitle="Data loaded from external APIs or documents"
            helpText="External data sources (Instances) that FEL expressions @instance('name') can reference."
            accentColor="bg-green"
          >
            <DataSources />
          </DataPillar>
        )}

        {showSimulation && (
          <DataPillar
            title="Simulation"
            subtitle="Preview current response document"
            helpText="Run the form engine against the current definition to see what the resulting data would look like."
            accentColor="bg-amber"
          >
            <TestResponse />
          </DataPillar>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
